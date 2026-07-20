-- 1) Posts feed: entitled-only reads
DROP POLICY IF EXISTS "posts read signed in feed" ON public.posts;
DROP POLICY IF EXISTS "posts read all metadata" ON public.posts;

CREATE POLICY "posts read entitled"
ON public.posts
FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid()
  OR visibility = 'public'
  OR (visibility = 'subscribers' AND public.is_subscribed(auth.uid(), creator_id))
  OR (
    visibility = 'ppv'
    AND EXISTS (
      SELECT 1 FROM public.post_purchases pp
      WHERE pp.post_id = posts.id AND pp.buyer_id = auth.uid()
    )
  )
);
-- Admin bypass already covered by existing "posts admin all"

-- 2) Profiles: owner-only base reads + safe public view
DROP POLICY IF EXISTS "profiles read authenticated" ON public.profiles;

CREATE POLICY "profiles read own"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());
-- Admin cross-user reads already covered by "profiles admin all"

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT
  id,
  username,
  first_name,
  last_name,
  bio,
  avatar_url,
  cover_url,
  hashtags,
  is_creator,
  is_ambassador,
  created_at,
  updated_at
FROM public.profiles;

REVOKE ALL ON public.profiles_public FROM PUBLIC, anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- 3) Lock down SECURITY DEFINER function grants
-- Callable-by-users functions: keep EXECUTE only for authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_subscribed(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_subscribed(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.find_conversation(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_conversation(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_my_conversations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_conversations(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.unread_messages_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_messages_count(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_overview_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_user_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_stats(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_top_creators(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_creators(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_recent_purchases(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_purchases(integer) TO authenticated;

-- Trigger-only functions: no callable EXECUTE needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.conversations_default_photo_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_conversation_on_message() FROM PUBLIC, anon, authenticated;