-- Undo previous security_definer view
DROP VIEW IF EXISTS public.profiles_public;

-- Broaden row policy (column grants will hide sensitive fields)
DROP POLICY IF EXISTS "profiles read own" ON public.profiles;
CREATE POLICY "profiles read all rows"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Column-level: hide phone and stripe_account_id from authenticated and anon
REVOKE SELECT (phone, stripe_account_id) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, stripe_account_id) ON public.profiles FROM anon;

-- Owner full-profile access (includes sensitive columns)
CREATE OR REPLACE FUNCTION public.get_own_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

-- Admin full user listing (includes sensitive columns), gated by role check
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Stop broadcasting profile changes to every connected client
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;