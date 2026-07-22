REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;

GRANT SELECT (id, username, first_name, last_name, bio, avatar_url, cover_url, hashtags, theme, allow_fan_photos, is_creator, is_ambassador, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (username, first_name, last_name, bio, avatar_url, cover_url, hashtags, theme, allow_fan_photos, is_creator, updated_at) ON public.profiles TO authenticated;
GRANT INSERT (id, username, first_name, last_name, phone, bio, avatar_url, cover_url, hashtags, theme, allow_fan_photos, is_creator) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;