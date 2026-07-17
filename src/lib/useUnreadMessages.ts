import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages() {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) { setCount(0); return; }
    const uid = session.user.id;

    const refresh = async () => {
      const { data, error } = await supabase.rpc("unread_messages_count", { _user: uid });
      if (!error) setCount(Number(data ?? 0));
    };

    refresh();

    const ch = supabase.channel(`unread-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_settings", filter: `user_id=eq.${uid}` }, refresh)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [session]);

  return count;
}
