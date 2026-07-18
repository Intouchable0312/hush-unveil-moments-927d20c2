import { createFileRoute, useParams } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { uploadMedia } from "@/lib/media";
import { AmbassadorBadge } from "@/components/AmbassadorBadge";
import { Send, Image as ImageIcon, DollarSign, ImageOff, ImagePlus, Lock } from "lucide-react";

export const Route = createFileRoute("/messages/$otherId")({ component: Chat });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function Chat() {
  const { otherId } = useParams({ from: "/messages/$otherId" });
  const { session } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [other, setOther] = useState<Any>(null);
  const [messages, setMessages] = useState<Any[]>([]);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [ppvPrice, setPpvPrice] = useState("");
  const [showPpv, setShowPpv] = useState(false);
  const [myAllow, setMyAllow] = useState(false);
  const [otherAllow, setOtherAllow] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation (bidirectional) and messages
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: o } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(o);

      // Find existing conv either direction, using SECURITY DEFINER RPC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingId } = await (supabase as any).rpc("find_conversation", { _a: session.user.id, _b: otherId });
      let cid: string | null = existingId ?? null;

      if (!cid) {
        // Determine who is fan / creator for the insert (RLS requires fan is subscribed)
        const { data: iSubToOther } = await supabase
          .from("subscriptions").select("id").eq("fan_id", session.user.id).eq("creator_id", otherId).eq("active", true).maybeSingle();
        const iAmFan = !!iSubToOther;
        const fanId = iAmFan ? session.user.id : otherId;
        const creatorId = iAmFan ? otherId : session.user.id;
        if (iAmFan) {
          const { data: c2, error } = await supabase.from("conversations").insert({ fan_id: fanId, creator_id: creatorId }).select().single();
          if (!error && c2) cid = c2.id;
        }
      }
      if (!cid) return;
      setConvId(cid);

      const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", cid).order("created_at");
      setMessages(msgs ?? []);
      const { data: pu } = await supabase.from("message_media_purchases").select("message_id").eq("buyer_id", session.user.id);
      setPurchases(new Set((pu ?? []).map((r) => r.message_id)));
      const { data: settings } = await supabase.from("conversation_settings").select("*").eq("conversation_id", cid);
      const mine = settings?.find((s) => s.user_id === session.user.id);
      const theirs = settings?.find((s) => s.user_id === otherId);
      setMyAllow(mine ? !!mine.allow_photos_from_other : false);
      setOtherAllow(theirs ? !!theirs.allow_photos_from_other : false);
    })();
  }, [session, otherId]);

  // Mark read
  useEffect(() => {
    if (!convId || !session) return;
    supabase.from("conversation_settings").upsert(
      { conversation_id: convId, user_id: session.user.id, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" }
    ).then(() => {});
  }, [convId, session, messages.length]);

  // Realtime
  useEffect(() => {
    if (!convId || !session) return;
    const ch = supabase.channel(`conv-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (p) => setMessages((m) => [...m, p.new]))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_media_purchases", filter: `buyer_id=eq.${session.user.id}` },
        (p) => setPurchases((prev) => new Set([...prev, (p.new as Any).message_id])))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_settings", filter: `conversation_id=eq.${convId}` },
        (p) => {
          const row: Any = p.new ?? p.old;
          if (!row) return;
          const allow = "allow_photos_from_other" in (p.new ?? {}) ? (p.new as Any).allow_photos_from_other : false;
          if (row.user_id === session.user.id) setMyAllow(allow);
          else if (row.user_id === otherId) setOtherAllow(allow);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convId, session, otherId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const togglePhotoPermission = async () => {
    if (!convId || !session) return;
    const next = !myAllow;
    setMyAllow(next);
    await supabase.from("conversation_settings").upsert(
      { conversation_id: convId, user_id: session.user.id, allow_photos_from_other: next },
      { onConflict: "conversation_id,user_id" }
    );
  };

  const send = async (body?: string, media_url?: string, ppv?: number) => {
    if (!convId || !session) return;
    await supabase.from("messages").insert({ conversation_id: convId, sender_id: session.user.id, body: body ?? null, media_url: media_url ?? null, ppv_price_cents: ppv ?? 0 });
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    setText(""); setShowPpv(false); setPpvPrice("");
  };

  const sendPhoto = async (f: File) => {
    if (!session) return;
    if (!otherAllow) { alert("Cette personne n'accepte pas les photos dans cette conversation."); return; }
    const path = await uploadMedia(f, session.user.id);
    const ppv = showPpv && ppvPrice ? Math.round(Number(ppvPrice) * 100) : 0;
    await send(undefined, path, ppv);
  };

  const buyMedia = async (mid: string) => {
    const res = await authFetch("/api/public/stripe-checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "message_media", message_id: mid }),
    });
    const j = await res.json() as { url?: string; error?: string };
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? "Erreur de paiement");
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-lg flex-col px-4 pt-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
            {other?.avatar_url && <SignedImage path={other.avatar_url} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-bold">
              @{other?.username}
              {other?.is_ambassador && <AmbassadorBadge />}
            </p>
          </div>
        </div>
        <button
          onClick={togglePhotoPermission}
          title={myAllow ? "Vous acceptez ses photos" : "Vous refusez ses photos"}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${myAllow ? "border-border bg-card" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
        >
          {myAllow ? <ImagePlus className="h-3.5 w-3.5" /> : <ImageOff className="h-3.5 w-3.5" />}
          Photos {myAllow ? "activées" : "bloquées"}
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-3xl border border-border bg-card p-3">
        {messages.map((m) => {
          const mine = m.sender_id === session?.user.id;
          const locked = m.media_url && m.ppv_price_cents > 0 && !mine && !purchases.has(m.id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {m.media_url && (
                  <div className="relative mb-1 h-48 w-48 overflow-hidden rounded-xl bg-muted">
                    <SignedImage path={m.media_url} className="h-full w-full object-cover" blurred={locked} />
                    {locked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 p-2">
                        <Lock className="h-5 w-5" />
                        <p className="text-xs font-bold text-foreground">Média premium {(m.ppv_price_cents / 100).toFixed(2)}€</p>
                        <button onClick={() => buyMedia(m.id)} className="rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">Déverrouiller</button>
                      </div>
                    )}
                  </div>
                )}
                {m.body && <p className="text-sm">{m.body}</p>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 space-y-2">
        {showPpv && (
          <input placeholder="Prix (€) — 0 = gratuit" value={ppvPrice} onChange={(e) => setPpvPrice(e.target.value)} className="w-full rounded-full border border-border bg-card px-4 py-2 text-sm" />
        )}
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" className="flex-1 rounded-full border border-border bg-card px-4 py-3" onKeyDown={(e) => e.key === "Enter" && text.trim() && send(text.trim())} />
          {otherAllow && (
            <label className="cursor-pointer rounded-full bg-secondary p-3" title="Envoyer une photo">
              <ImageIcon className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])} />
            </label>
          )}
          {otherAllow && (
            <button onClick={() => setShowPpv(!showPpv)} title="Prix pour la prochaine photo" className={`rounded-full p-3 ${showPpv ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              <DollarSign className="h-5 w-5" />
            </button>
          )}
          <button onClick={() => text.trim() && send(text.trim())} className="rounded-full bg-primary p-3 text-primary-foreground"><Send className="h-5 w-5" /></button>
        </div>
        {!otherAllow && <p className="text-center text-xs text-muted-foreground">📵 Cette personne n'a pas activé la réception de photos.</p>}
      </div>
    </div>
  );
}
