-- Restore Data API access needed by the app while keeping sensitive profile fields protected.
GRANT SELECT (id, username, first_name, last_name, bio, avatar_url, cover_url, hashtags, theme, allow_fan_photos, is_creator, is_ambassador, created_at, updated_at) ON public.profiles TO authenticated;
GRANT UPDATE (username, first_name, last_name, bio, avatar_url, cover_url, hashtags, theme, allow_fan_photos, is_creator, updated_at) ON public.profiles TO authenticated;
GRANT INSERT (id, username, first_name, last_name, phone, bio, avatar_url, cover_url, hashtags, theme, allow_fan_photos, is_creator) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_settings TO authenticated;
GRANT ALL ON public.conversation_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_purchases TO authenticated;
GRANT ALL ON public.post_purchases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_media_purchases TO authenticated;
GRANT ALL ON public.message_media_purchases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

-- Central media access function. SECURITY DEFINER prevents recursive RLS rewrites
-- when Storage checks posts/messages/profiles ownership and entitlements.
CREATE OR REPLACE FUNCTION public.can_read_media_object(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _object_name IS NULL THEN
    RETURN false;
  END IF;

  -- Owners can always read their own uploaded files.
  IF (storage.foldername(_object_name))[1] = uid::text THEN
    RETURN true;
  END IF;

  -- Profile photos and banners are public inside the authenticated app.
  IF EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.avatar_url = _object_name OR pr.cover_url = _object_name
  ) THEN
    RETURN true;
  END IF;

  -- Publication media follows creator/subscription/purchase rules.
  IF EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.media_url = _object_name
      AND (
        p.creator_id = uid
        OR p.visibility = 'public'
        OR (p.visibility = 'subscribers' AND public.is_subscribed(uid, p.creator_id))
        OR (
          p.visibility = 'ppv'
          AND EXISTS (
            SELECT 1 FROM public.post_purchases pp
            WHERE pp.post_id = p.id AND pp.buyer_id = uid
          )
        )
      )
  ) THEN
    RETURN true;
  END IF;

  -- Message media follows conversation participation and PPV purchase rules.
  IF EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.media_url = _object_name
      AND (c.fan_id = uid OR c.creator_id = uid)
      AND (
        m.sender_id = uid
        OR m.ppv_price_cents = 0
        OR EXISTS (
          SELECT 1 FROM public.message_media_purchases mmp
          WHERE mmp.message_id = m.id AND mmp.buyer_id = uid
        )
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_media_object(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_media_object(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_media_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_media_object(text) TO service_role;

-- Replace recursive Storage policies with direct owner writes and one entitlement read policy.
DROP POLICY IF EXISTS "media auth upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "media entitled message read" ON storage.objects;
DROP POLICY IF EXISTS "media entitled post read" ON storage.objects;
DROP POLICY IF EXISTS "media owner delete" ON storage.objects;
DROP POLICY IF EXISTS "media owner read" ON storage.objects;
DROP POLICY IF EXISTS "media owner update" ON storage.objects;
DROP POLICY IF EXISTS "media profile assets read" ON storage.objects;

CREATE POLICY "media insert own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "media read entitled"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media'
  AND public.can_read_media_object(name)
);

CREATE POLICY "media update own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "media delete own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);