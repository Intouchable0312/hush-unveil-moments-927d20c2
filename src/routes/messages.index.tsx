import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";

export const Route = createFileRoute("/messages/")({ component: MessagesList });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

function MessagesList() {
  const { session } = useAuth();
  const [convs, setConvs] = useState<any[] | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase.from("conversations")
        .select("*, fan:profiles!conversations_fan_id_fkey(username,avatar_url,id), creator:profiles!conversations_creator_id_fkey(username,avatar_url,id)")
        .or(`fan_id.eq.${session.user.id},creator_id.eq.${session.user.id}`)
        .order("last_message_at", { ascending: false });
      setConvs(data ?? []);
    })();
  }, [session]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-6 text-3xl font-bold">Messages</h1>
      {convs === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {convs && convs.length === 0 && <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Aucune conversation.</div>}
      <div className="space-y-2">
        {convs?.map((c) => {
          const other = c.fan.id === session?.user.id ? c.creator : c.fan;
          return (
            <L key={c.id} to={`/messages/${other.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                {other.avatar_url && <SignedImage path={other.avatar_url} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <p className="font-bold">@{other.username}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString("fr")}</p>
              </div>
            </L>
          );
        })}
      </div>
    </div>
  );
}
