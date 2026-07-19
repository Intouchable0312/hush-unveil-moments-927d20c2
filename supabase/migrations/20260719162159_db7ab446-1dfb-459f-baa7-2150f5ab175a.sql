-- Lock down security definer functions: revoke broad execution, then grant only what the app needs.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_subscribed(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unread_messages_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_conversation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_my_conversations(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_overview_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_user_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_top_creators(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_recent_purchases(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_subscribed(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unread_messages_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_conversation(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_my_conversations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_top_creators(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_recent_purchases(integer) TO authenticated, service_role;

-- Harden callable functions so users cannot request another user's data.
CREATE OR REPLACE FUNCTION public.unread_messages_count(_user uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR auth.uid() <> _user THEN 0::bigint
    ELSE (
      SELECT COALESCE(count(*), 0)::bigint
      FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      LEFT JOIN public.conversation_settings s
        ON s.conversation_id = c.id AND s.user_id = _user
      WHERE (c.fan_id = _user OR c.creator_id = _user)
        AND m.sender_id <> _user
        AND m.created_at > COALESCE(s.last_read_at, 'epoch'::timestamptz)
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.find_conversation(_a uuid, _b uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL OR auth.uid() NOT IN (_a, _b) THEN NULL::uuid
    ELSE (
      SELECT id FROM public.conversations
      WHERE (fan_id = _a AND creator_id = _b) OR (fan_id = _b AND creator_id = _a)
      ORDER BY last_message_at DESC
      LIMIT 1
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_conversations(_user uuid)
RETURNS TABLE(id uuid, other_id uuid, other_username text, other_avatar_url text, other_is_ambassador boolean, other_is_creator boolean, last_message_at timestamp with time zone, last_body text, last_has_media boolean, unread bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH my_convs AS (
    SELECT
      c.*,
      CASE WHEN c.fan_id = _user THEN c.creator_id ELSE c.fan_id END AS peer_id
    FROM public.conversations c
    WHERE (c.fan_id = _user OR c.creator_id = _user)
      AND auth.uid() = _user
  ), latest AS (
    SELECT DISTINCT ON (peer_id)
      id, peer_id, last_message_at
    FROM my_convs
    ORDER BY peer_id, last_message_at DESC, id DESC
  )
  SELECT
    l.id,
    l.peer_id,
    p.username, p.avatar_url, p.is_ambassador, p.is_creator,
    l.last_message_at,
    (SELECT m.body FROM public.messages m JOIN my_convs mc ON mc.id = m.conversation_id WHERE mc.peer_id = l.peer_id ORDER BY m.created_at DESC LIMIT 1),
    COALESCE((SELECT m.media_url IS NOT NULL FROM public.messages m JOIN my_convs mc ON mc.id = m.conversation_id WHERE mc.peer_id = l.peer_id ORDER BY m.created_at DESC LIMIT 1), false),
    (SELECT COUNT(*) FROM public.messages m
       JOIN my_convs mc ON mc.id = m.conversation_id
       LEFT JOIN public.conversation_settings s ON s.conversation_id = mc.id AND s.user_id = _user
       WHERE mc.peer_id = l.peer_id
         AND m.sender_id <> _user
         AND m.created_at > COALESCE(s.last_read_at, 'epoch'::timestamptz))::bigint
  FROM latest l
  JOIN public.profiles p ON p.id = l.peer_id
  ORDER BY l.last_message_at DESC NULLS LAST;
$function$;

-- Reduce public exposure of personal profile fields and likes.
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles read authenticated" ON public.profiles
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "likes read all" ON public.post_likes;
CREATE POLICY "likes read authenticated" ON public.post_likes
FOR SELECT TO authenticated
USING (true);

-- Storage: remove blanket media reads and allow only entitled access.
DROP POLICY IF EXISTS "media anon read" ON storage.objects;
DROP POLICY IF EXISTS "media auth read" ON storage.objects;

CREATE POLICY "media owner read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "media entitled post read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.media_url = storage.objects.name
      AND (
        p.creator_id = auth.uid()
        OR p.visibility = 'public'
        OR (p.visibility = 'subscribers' AND public.is_subscribed(auth.uid(), p.creator_id))
        OR (p.visibility = 'ppv' AND EXISTS (
          SELECT 1 FROM public.post_purchases pp
          WHERE pp.post_id = p.id AND pp.buyer_id = auth.uid()
        ))
      )
  )
);

CREATE POLICY "media entitled message read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'media'
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.media_url = storage.objects.name
      AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
      AND (
        m.sender_id = auth.uid()
        OR m.ppv_price_cents = 0
        OR EXISTS (
          SELECT 1 FROM public.message_media_purchases mmp
          WHERE mmp.message_id = m.id AND mmp.buyer_id = auth.uid()
        )
      )
  )
);

-- Prevent future duplicate technical conversation rows for the same pair/direction.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_fan_creator_unique ON public.conversations (fan_id, creator_id);