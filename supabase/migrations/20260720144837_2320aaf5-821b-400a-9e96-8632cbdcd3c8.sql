-- 1) Storage: allow authenticated users to read avatars and cover banners
CREATE POLICY "media profile assets read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.avatar_url = storage.objects.name
       OR pr.cover_url  = storage.objects.name
  )
);

-- 2) Default subscription plan prices (cents)
ALTER TABLE public.subscription_plans
  ALTER COLUMN price_monthly_cents SET DEFAULT 1999,
  ALTER COLUMN price_quarterly_cents SET DEFAULT 3999,
  ALTER COLUMN price_yearly_cents SET DEFAULT 4999;

-- Backfill zeroed plans
UPDATE public.subscription_plans
SET price_monthly_cents = 1999,
    price_quarterly_cents = 3999,
    price_yearly_cents = 4999,
    updated_at = now()
WHERE price_monthly_cents = 0
  AND price_quarterly_cents = 0
  AND price_yearly_cents = 0;

-- Ensure every existing profile has a default plan row
INSERT INTO public.subscription_plans (creator_id, price_monthly_cents, price_quarterly_cents, price_yearly_cents)
SELECT p.id, 1999, 3999, 4999
FROM public.profiles p
LEFT JOIN public.subscription_plans sp ON sp.creator_id = p.id
WHERE sp.id IS NULL
ON CONFLICT (creator_id) DO NOTHING;

-- Auto-create default plan on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1))
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscription_plans (creator_id, price_monthly_cents, price_quarterly_cents, price_yearly_cents)
  VALUES (NEW.id, 1999, 3999, 4999)
  ON CONFLICT (creator_id) DO NOTHING;

  SELECT NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$$;