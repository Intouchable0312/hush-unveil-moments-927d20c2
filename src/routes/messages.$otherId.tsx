import { createFileRoute, useParams } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { uploadMedia } from "@/lib/media";
import { PaymentSlider } from "@/components/PaymentSlider";
import { Send, Image as ImageIcon, DollarSign } from "lucide-react";

export const Route = createFileRoute("/messages/$otherId")({ component: Chat });

function Chat() {
  const { otherId } = useParams({ from: "/messages/$otherId" });
  const { session, profile } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [other, setOther] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [ppvPrice, setPpvPrice] = useState("");
  const [showPpv, setShowPpv] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [otherAllowsFanPhotos, setOtherAllowsFanPhotos] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: o } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      setOther(o); setOtherAllowsFanPhotos(!!o?.allow_fan_photos);
      // Determine roles: I'm fan if I'm subscribed to them; else I'm the creator being messaged
      const { data: sub } = await supabase.from("subscriptions").select("*").eq("fan_id", session.user.id).eq("creator_id", otherId).eq("active", true).maybeSingle();
      const iAmFan = !!sub;
      setIsCreator(!iAmFan);
      const fanId = iAmFan ? session.user.id : otherId;
      const creatorId = iAmFan ? otherId : session.user.id;
      let { data: conv } = await supabase.from("conversations").select("*").eq("fan_id", fanId).eq("creator_id", creatorId).maybeSingle();
      if (!conv && iAmFan) {
        const { data: c2, error } = await supabase.from("conversations").insert({ fan_id: fanId, creator_id: creatorId }).select().single();
        if (!error) conv = c2;
      }
      if (!conv) return;
      setConvId(conv.id);
      const { data: msgs } = await supabase.from("messages").select("*").eq("conversation_id", conv.id).order("created_at");
      setMessages(msgs ?? []);
      const { data: pu } = await supabase.from("message_media_purchases").select("message_id").eq("buyer_id", session.user.id);
      setPurchases(new Set((pu ?? []).map((r) => r.message_id)));
    })();
  }, [session, otherId]);

  useEffect(() => {
    if (!convId) return;
    const ch = supabase.channel(`msg-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (p) => setMessages((m) => [...m, p.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (body?: string, media_url?: string, ppv?: number) => {
    if (!convId || !session) return;
    await supabase.from("messages").insert({ conversation_id: convId, sender_id: session.user.id, body: body ?? null, media_url: media_url ?? null, ppv_price_cents: ppv ?? 0 });
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convId);
    setText(""); setShowPpv(false); setPpvPrice("");
  };

  const sendPhoto = async (f: File) => {
    if (!session) return;
    const path = await uploadMedia(f, session.user.id);
    const ppv = showPpv && ppvPrice ? Math.round(Number(ppvPrice) * 100) : 0;
    await send(undefined, path, ppv);
  };

  const buyMedia = async (mid: string) => {
    const res = await authFetch("/api/public/stripe-checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "message_media", message_id: mid }),
    });
    const j = await res.json() as { url?: string };
    if (j.url) window.location.href = j.url;
  };

  const canSendPhoto = isCreator || otherAllowsFanPhotos;
  const canSetPpv = isCreator; // only creator can send paid media

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-lg flex-col px-4 pt-6">
      <header className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
          {other?.avatar_url && <SignedImage path={other.avatar_url} className="h-full w-full object-cover" />}
        </div>
        <p className="font-bold">@{other?.username}</p>
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
                        <p className="text-xs font-bold text-foreground">Média premium {(m.ppv_price_cents/100).toFixed(2)}€</p>
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
        {showPpv && canSetPpv && (
          <input placeholder="Prix (€)" value={ppvPrice} onChange={(e) => setPpvPrice(e.target.value)} className="w-full rounded-full border border-border bg-card px-4 py-2 text-sm" />
        )}
        <div className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" className="flex-1 rounded-full border border-border bg-card px-4 py-3" onKeyDown={(e) => e.key === "Enter" && text.trim() && send(text.trim())} />
          {canSendPhoto && (
            <label className="cursor-pointer rounded-full bg-secondary p-3">
              <ImageIcon className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])} />
            </label>
          )}
          {canSetPpv && <button onClick={() => setShowPpv(!showPpv)} className={`rounded-full p-3 ${showPpv ? "bg-primary text-primary-foreground" : "bg-secondary"}`}><DollarSign className="h-5 w-5" /></button>}
          <button onClick={() => text.trim() && send(text.trim())} className="rounded-full bg-primary p-3 text-primary-foreground"><Send className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
