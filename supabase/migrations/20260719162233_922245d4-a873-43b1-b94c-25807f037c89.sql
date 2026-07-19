-- Keep conversations in sync whenever a message is added.
CREATE OR REPLACE FUNCTION public.touch_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS messages_touch_conversation ON public.messages;
CREATE TRIGGER messages_touch_conversation
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_conversation_on_message();

DROP TRIGGER IF EXISTS conversations_default_photo_settings_trigger ON public.conversations;
CREATE TRIGGER conversations_default_photo_settings_trigger
AFTER INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.conversations_default_photo_settings();

REVOKE EXECUTE ON FUNCTION public.touch_conversation_on_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_conversation_on_message() TO service_role;
REVOKE EXECUTE ON FUNCTION public.conversations_default_photo_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.conversations_default_photo_settings() TO service_role;

-- Ensure existing conversations have settings for both participants.
INSERT INTO public.conversation_settings (conversation_id, user_id, allow_photos_from_other, last_read_at)
SELECT c.id, c.fan_id, false, 'epoch'::timestamptz
FROM public.conversations c
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO public.conversation_settings (conversation_id, user_id, allow_photos_from_other, last_read_at)
SELECT c.id, c.creator_id, false, 'epoch'::timestamptz
FROM public.conversations c
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Merge historical duplicate conversations by moving messages to the newest row, then deleting empty duplicates.
WITH ranked AS (
  SELECT
    id,
    fan_id,
    creator_id,
    first_value(id) OVER (PARTITION BY fan_id, creator_id ORDER BY last_message_at DESC, id DESC) AS keep_id,
    row_number() OVER (PARTITION BY fan_id, creator_id ORDER BY last_message_at DESC, id DESC) AS rn
  FROM public.conversations
), moved AS (
  UPDATE public.messages m
  SET conversation_id = r.keep_id
  FROM ranked r
  WHERE m.conversation_id = r.id
    AND r.rn > 1
  RETURNING m.id
), settings_deleted AS (
  DELETE FROM public.conversation_settings s
  USING ranked r
  WHERE s.conversation_id = r.id
    AND r.rn > 1
  RETURNING s.id
)
DELETE FROM public.conversations c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_fan_creator_unique ON public.conversations (fan_id, creator_id);