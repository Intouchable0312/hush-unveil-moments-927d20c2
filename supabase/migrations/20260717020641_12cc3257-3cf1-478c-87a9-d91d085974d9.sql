
-- Track when a user last read a conversation, for unread badges
ALTER TABLE public.conversation_settings ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- Allow fans to update (cancel) their own subscriptions
DROP POLICY IF EXISTS "sub update own fan" ON public.subscriptions;
CREATE POLICY "sub update own fan" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (fan_id = auth.uid())
  WITH CHECK (fan_id = auth.uid());

-- RPC: count unread messages for the current user across all conversations
CREATE OR REPLACE FUNCTION public.unread_messages_count(_user uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(count(*), 0)::bigint
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.conversation_settings s
    ON s.conversation_id = c.id AND s.user_id = _user
  WHERE (c.fan_id = _user OR c.creator_id = _user)
    AND m.sender_id <> _user
    AND m.created_at > COALESCE(s.last_read_at, 'epoch'::timestamptz);
$$;

GRANT EXECUTE ON FUNCTION public.unread_messages_count(uuid) TO authenticated;
