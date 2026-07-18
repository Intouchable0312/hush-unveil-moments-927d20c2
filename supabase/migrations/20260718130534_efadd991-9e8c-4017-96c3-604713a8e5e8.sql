
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_ambassador boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.conversations_default_photo_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.conversation_settings (conversation_id, user_id, allow_photos_from_other, last_read_at)
  VALUES (NEW.id, NEW.fan_id, false, 'epoch'::timestamptz),
         (NEW.id, NEW.creator_id, false, 'epoch'::timestamptz)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_conversations_default_settings ON public.conversations;
CREATE TRIGGER trg_conversations_default_settings
AFTER INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.conversations_default_photo_settings();

CREATE OR REPLACE FUNCTION public.find_conversation(_a uuid, _b uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.conversations
  WHERE (fan_id = _a AND creator_id = _b) OR (fan_id = _b AND creator_id = _a)
  ORDER BY last_message_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.list_my_conversations(_user uuid)
RETURNS TABLE (
  id uuid, other_id uuid, other_username text, other_avatar_url text,
  other_is_ambassador boolean, other_is_creator boolean,
  last_message_at timestamptz, last_body text, last_has_media boolean,
  unread bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id,
    CASE WHEN c.fan_id = _user THEN c.creator_id ELSE c.fan_id END,
    p.username, p.avatar_url, p.is_ambassador, p.is_creator,
    c.last_message_at,
    (SELECT body FROM public.messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
    (SELECT media_url IS NOT NULL FROM public.messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
    (SELECT COUNT(*) FROM public.messages m
       LEFT JOIN public.conversation_settings s ON s.conversation_id = c.id AND s.user_id = _user
       WHERE m.conversation_id = c.id AND m.sender_id <> _user
         AND m.created_at > COALESCE(s.last_read_at, 'epoch'::timestamptz))
  FROM public.conversations c
  JOIN public.profiles p ON p.id = CASE WHEN c.fan_id = _user THEN c.creator_id ELSE c.fan_id END
  WHERE c.fan_id = _user OR c.creator_id = _user
  ORDER BY c.last_message_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT json_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'creators', (SELECT count(*) FROM public.profiles WHERE is_creator),
    'ambassadors', (SELECT count(*) FROM public.profiles WHERE is_ambassador),
    'posts', (SELECT count(*) FROM public.posts),
    'active_subs', (SELECT count(*) FROM public.subscriptions WHERE active AND expires_at > now()),
    'messages_24h', (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '24 hours'),
    'revenue_30d_cents', (
      COALESCE((SELECT sum(price_paid_cents) FROM public.subscriptions WHERE started_at > now() - interval '30 days'),0)
    + COALESCE((SELECT sum(amount_cents) FROM public.post_purchases WHERE created_at > now() - interval '30 days'),0)
    + COALESCE((SELECT sum(amount_cents) FROM public.message_media_purchases WHERE created_at > now() - interval '30 days'),0)
    ),
    'mrr_cents', COALESCE((SELECT sum(price_paid_cents) FROM public.subscriptions WHERE active AND expires_at > now() AND period='monthly'),0),
    'bans', (SELECT count(*) FROM public.bans)
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_user_stats(_uid uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT json_build_object(
    'posts', (SELECT count(*) FROM public.posts WHERE creator_id = _uid),
    'subscribers', (SELECT count(*) FROM public.subscriptions WHERE creator_id = _uid AND active AND expires_at > now()),
    'subscribed_to', (SELECT count(*) FROM public.subscriptions WHERE fan_id = _uid AND active AND expires_at > now()),
    'revenue_cents', (
      COALESCE((SELECT sum(price_paid_cents) FROM public.subscriptions WHERE creator_id = _uid),0)
    + COALESCE((SELECT sum(pp.amount_cents) FROM public.post_purchases pp JOIN public.posts po ON po.id=pp.post_id WHERE po.creator_id = _uid),0)
    + COALESCE((SELECT sum(mmp.amount_cents) FROM public.message_media_purchases mmp JOIN public.messages m ON m.id=mmp.message_id WHERE m.sender_id = _uid),0)
    ),
    'spent_cents', (
      COALESCE((SELECT sum(price_paid_cents) FROM public.subscriptions WHERE fan_id = _uid),0)
    + COALESCE((SELECT sum(amount_cents) FROM public.post_purchases WHERE buyer_id = _uid),0)
    + COALESCE((SELECT sum(amount_cents) FROM public.message_media_purchases WHERE buyer_id = _uid),0)
    ),
    'messages_sent', (SELECT count(*) FROM public.messages WHERE sender_id = _uid)
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_top_creators(_limit int DEFAULT 20)
RETURNS TABLE(id uuid, username text, subscribers bigint, posts bigint, revenue_cents bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.username,
    (SELECT count(*) FROM public.subscriptions s WHERE s.creator_id = p.id AND s.active AND s.expires_at > now()),
    (SELECT count(*) FROM public.posts po WHERE po.creator_id = p.id),
    (COALESCE((SELECT sum(price_paid_cents) FROM public.subscriptions WHERE creator_id = p.id),0)
     + COALESCE((SELECT sum(pp.amount_cents) FROM public.post_purchases pp JOIN public.posts po ON po.id=pp.post_id WHERE po.creator_id = p.id),0))::bigint
  FROM public.profiles p
  WHERE p.is_creator
  ORDER BY 5 DESC NULLS LAST
  LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_recent_purchases(_limit int DEFAULT 50)
RETURNS TABLE(kind text, at timestamptz, buyer uuid, seller uuid, amount_cents integer, ref uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  (SELECT 'subscription'::text, started_at, fan_id, creator_id, price_paid_cents, id FROM public.subscriptions)
  UNION ALL
  (SELECT 'post_ppv'::text, pp.created_at, pp.buyer_id, po.creator_id, pp.amount_cents, pp.id
     FROM public.post_purchases pp JOIN public.posts po ON po.id=pp.post_id)
  UNION ALL
  (SELECT 'message_ppv'::text, mmp.created_at, mmp.buyer_id, m.sender_id, mmp.amount_cents, mmp.id
     FROM public.message_media_purchases mmp JOIN public.messages m ON m.id=mmp.message_id)
  ORDER BY at DESC
  LIMIT _limit;
END $$;

GRANT EXECUTE ON FUNCTION public.find_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_conversations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_creators(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_purchases(int) TO authenticated;
