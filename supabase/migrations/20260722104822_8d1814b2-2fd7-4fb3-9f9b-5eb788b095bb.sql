
-- Restore column-level SELECT grants on profiles for authenticated users.
-- Sensitive columns (phone, stripe_account_id) remain excluded and must be
-- fetched via SECURITY DEFINER RPCs (get_own_profile / admin_list_users).
-- Without these grants, storage RLS policies that subquery profiles (avatars,
-- covers) fail, so no media renders.

GRANT SELECT (
  id, username, first_name, last_name, bio,
  avatar_url, cover_url, hashtags, theme,
  allow_fan_photos, is_creator, is_ambassador,
  created_at, updated_at
) ON public.profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Also allow anonymous SELECT on the same safe columns so that public
-- shareable profile pages and OG previews can resolve avatars.
GRANT SELECT (
  id, username, first_name, last_name, bio,
  avatar_url, cover_url, hashtags, is_creator, is_ambassador,
  created_at
) ON public.profiles TO anon;
