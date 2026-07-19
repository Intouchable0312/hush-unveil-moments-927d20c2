-- 1) Merge duplicate conversations so one pair of users has only one thread
WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY LEAST(fan_id, creator_id), GREATEST(fan_id, creator_id) ORDER BY last_message_at DESC, id) AS keep_id
  FROM public.conversations
), losers AS (SELECT id, keep_id FROM ranked WHERE id <> keep_id)
UPDATE public.messages m SET conversation_id = l.keep_id FROM losers l WHERE m.conversation_id = l.id;

WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY LEAST(fan_id, creator_id), GREATEST(fan_id, creator_id) ORDER BY last_message_at DESC, id) AS keep_id
  FROM public.conversations
), losers AS (SELECT id, keep_id FROM ranked WHERE id <> keep_id)
INSERT INTO public.conversation_settings (conversation_id, user_id, allow_photos_from_other, last_read_at)
SELECT l.keep_id, s.user_id, bool_or(s.allow_photos_from_other), max(COALESCE(s.last_read_at, 'epoch'::timestamptz))
FROM public.conversation_settings s
JOIN losers l ON l.id = s.conversation_id
GROUP BY l.keep_id, s.user_id
ON CONFLICT (conversation_id, user_id) DO UPDATE
SET allow_photos_from_other = public.conversation_settings.allow_photos_from_other OR EXCLUDED.allow_photos_from_other,
    last_read_at = GREATEST(COALESCE(public.conversation_settings.last_read_at, 'epoch'::timestamptz), COALESCE(EXCLUDED.last_read_at, 'epoch'::timestamptz)),
    updated_at = now();

WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY LEAST(fan_id, creator_id), GREATEST(fan_id, creator_id) ORDER BY last_message_at DESC, id) AS keep_id
  FROM public.conversations
), losers AS (SELECT id FROM ranked WHERE id <> keep_id)
DELETE FROM public.conversation_settings s USING losers l WHERE s.conversation_id = l.id;

WITH ranked AS (
  SELECT id, first_value(id) OVER (PARTITION BY LEAST(fan_id, creator_id), GREATEST(fan_id, creator_id) ORDER BY last_message_at DESC, id) AS keep_id
  FROM public.conversations
), losers AS (SELECT id FROM ranked WHERE id <> keep_id)
DELETE FROM public.conversations c USING losers l WHERE c.id = l.id;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_pair_idx ON public.conversations (LEAST(fan_id, creator_id), GREATEST(fan_id, creator_id));

-- 2) Photos are blocked by default for new conversation settings
ALTER TABLE public.conversation_settings ALTER COLUMN allow_photos_from_other SET DEFAULT false;
DROP TRIGGER IF EXISTS conversations_default_photo_settings_trigger ON public.conversations;
CREATE TRIGGER conversations_default_photo_settings_trigger
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.conversations_default_photo_settings();

-- 3) Keep conversation ordering in sync with new messages
CREATE OR REPLACE FUNCTION public.touch_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_conversation_last_message_trigger ON public.messages;
CREATE TRIGGER touch_conversation_last_message_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_conversation_last_message();

-- 4) Harden conversation RPCs: caller can only ask about their own account
CREATE OR REPLACE FUNCTION public.find_conversation(_a uuid, _b uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); res uuid;
BEGIN
  IF uid IS NULL OR (uid <> _a AND uid <> _b) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO res FROM public.conversations
  WHERE (fan_id = _a AND creator_id = _b) OR (fan_id = _b AND creator_id = _a)
  ORDER BY last_message_at DESC LIMIT 1;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); cid uuid; fan uuid; creator uuid;
BEGIN
  IF uid IS NULL OR _other IS NULL OR uid = _other THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT id INTO cid FROM public.conversations
  WHERE (fan_id = uid AND creator_id = _other) OR (fan_id = _other AND creator_id = uid)
  ORDER BY last_message_at DESC LIMIT 1;
  IF cid IS NOT NULL THEN RETURN cid; END IF;

  IF public.is_subscribed(uid, _other) THEN
    fan := uid; creator := _other;
  ELSIF public.is_subscribed(_other, uid) THEN
    fan := _other; creator := uid;
  ELSE
    RAISE EXCEPTION 'Conversation not allowed';
  END IF;

  BEGIN
    INSERT INTO public.conversations (fan_id, creator_id) VALUES (fan, creator) RETURNING id INTO cid;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO cid FROM public.conversations
    WHERE (fan_id = uid AND creator_id = _other) OR (fan_id = _other AND creator_id = uid)
    ORDER BY last_message_at DESC LIMIT 1;
  END;

  RETURN cid;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_my_conversations(_user uuid DEFAULT NULL)
RETURNS TABLE(id uuid, other_id uuid, other_username text, other_avatar_url text, other_is_ambassador boolean, other_is_creator boolean, last_message_at timestamp with time zone, last_body text, last_has_media boolean, unread bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR (_user IS NOT NULL AND _user <> uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT c.id,
    CASE WHEN c.fan_id = uid THEN c.creator_id ELSE c.fan_id END,
    p.username, p.avatar_url, p.is_ambassador, p.is_creator,
    c.last_message_at,
    (SELECT m.body FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
    COALESCE((SELECT m.media_url IS NOT NULL FROM public.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), false),
    (SELECT COUNT(*) FROM public.messages m
      LEFT JOIN public.conversation_settings s ON s.conversation_id = c.id AND s.user_id = uid
      WHERE m.conversation_id = c.id AND m.sender_id <> uid AND m.created_at > COALESCE(s.last_read_at, 'epoch'::timestamptz))::bigint
  FROM public.conversations c
  JOIN public.profiles p ON p.id = CASE WHEN c.fan_id = uid THEN c.creator_id ELSE c.fan_id END
  WHERE c.fan_id = uid OR c.creator_id = uid
  ORDER BY c.last_message_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.unread_messages_count(_user uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); res bigint;
BEGIN
  IF uid IS NULL OR (_user IS NOT NULL AND _user <> uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT COALESCE(count(*), 0)::bigint INTO res
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.conversation_settings s ON s.conversation_id = c.id AND s.user_id = uid
  WHERE (c.fan_id = uid OR c.creator_id = uid) AND m.sender_id <> uid AND m.created_at > COALESCE(s.last_read_at, 'epoch'::timestamptz);
  RETURN res;
END;
$$;

-- 5) Restrict public metadata exposure while keeping the signed-in universal feed
DROP POLICY IF EXISTS "posts read all metadata" ON public.posts;
CREATE POLICY "posts read signed in feed" ON public.posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "likes read authenticated" ON public.post_likes;
CREATE POLICY "likes read entitled" ON public.post_likes FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_likes.post_id
      AND (p.creator_id = auth.uid() OR p.visibility = 'public' OR (p.visibility = 'subscribers' AND public.is_subscribed(auth.uid(), p.creator_id)) OR (p.visibility = 'ppv' AND EXISTS (SELECT 1 FROM public.post_purchases pp WHERE pp.post_id = p.id AND pp.buyer_id = auth.uid())))
  )
);

-- 6) Limit direct function execution grants
REVOKE ALL ON FUNCTION public.find_conversation(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_my_conversations(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unread_messages_count(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_overview_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_user_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_top_creators(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_recent_purchases(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_conversations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_messages_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_creators(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_purchases(integer) TO authenticated;