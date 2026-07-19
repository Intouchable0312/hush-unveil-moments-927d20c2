import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { AmbassadorBadge } from "@/components/AmbassadorBadge";
import { Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/messages/")({ component: MessagesList });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Row = {
  id: string;
  other_id: string;
  other_username: string | null;
  other_avatar_url: string | null;
  other_is_ambassador: boolean;
  other_is_creator: boolean;
  last_message_at: string;
  last_body: string | null;
  last_has_media: boolean;
  unread: number;
};

function MessagesList() {
  const { session } = useAuth();
  const [convs, setConvs] = useState<Row[] | null>(null);

  const reload = async () => {
    if (!session) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("list_my_conversations", { _user: session.user.id });
    if (error) { console.error("[messages] rpc error", error); setConvs([]); return; }
    const unique = new Map<string, Row>();
    ((data ?? []) as Row[]).forEach((row) => {
      const prev = unique.get(row.other_id);
      if (!prev || new Date(row.last_message_at).getTime() > new Date(prev.last_message_at).getTime()) unique.set(row.other_id, row);
    });
    setConvs([...unique.values()].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
  };

  useEffect(() => { reload(); }, [session]);

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    const ch = supabase.channel(`msg-list-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `fan_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `creator_id=eq.${uid}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_settings", filter: `user_id=eq.${uid}` }, reload)
      .subscribe();
    const poll = window.setInterval(reload, 3500);
    return () => { window.clearInterval(poll); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-4">
      <h1 className="mb-6 text-3xl font-bold">Messages</h1>
      {convs === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {convs && convs.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Aucune conversation.
        </div>
      )}
      <div className="space-y-2">
        {convs?.map((c) => (
          <L key={c.id} to={`/messages/${c.other_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-accent">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
              {c.other_avatar_url && <SignedImage path={c.other_avatar_url} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-bold">@{c.other_username}</p>
                {c.other_is_ambassador && <AmbassadorBadge />}
              </div>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {c.last_has_media && <ImageIcon className="h-3 w-3" />}
                {c.last_body || (c.last_has_media ? "Photo" : "Nouvelle conversation")}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] text-muted-foreground">{new Date(c.last_message_at).toLocaleDateString("fr")}</p>
              {c.unread > 0 && (
                <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {c.unread > 99 ? "99+" : c.unread}
                </span>
              )}
            </div>
          </L>
        ))}
      </div>
    </div>
  );
}
