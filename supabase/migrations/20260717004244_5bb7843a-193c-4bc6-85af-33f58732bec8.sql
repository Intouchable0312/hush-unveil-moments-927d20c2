
CREATE TABLE public.conversation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_photos_from_other boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_settings TO authenticated;
GRANT ALL ON public.conversation_settings TO service_role;

ALTER TABLE public.conversation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read settings of own conversations" ON public.conversation_settings
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_settings.conversation_id
      AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
  )
);

CREATE POLICY "insert own settings" ON public.conversation_settings
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_settings.conversation_id
      AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
  )
);

CREATE POLICY "update own settings" ON public.conversation_settings
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER touch_conversation_settings BEFORE UPDATE ON public.conversation_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.conversation_settings REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bans; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
