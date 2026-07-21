import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { uploadMedia } from "@/lib/media";
import { AmbassadorBadge } from "@/components/AmbassadorBadge";
import { ArrowLeft, Send, Image as ImageIcon, Coins, ImageOff, ImagePlus, Lock, X, Check } from "lucide-react";

export const Route = createFileRoute("/messages/$otherId")({ component: Chat });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

function Chat() {
  const { otherId } = useParams({ from: "/messages/$otherId" });
  const { session } = useAuth();
  const [convId, setConvId] = useState<string | null>(null);
  const [other, setOther] = useState<Any>(null);
  const [messages, setMessages] = useState<Any[]>([]);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [myAllow, setMyAllow] = useState(false);
  const [otherAllow, setOtherAllow] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingPriceCents, setPendingPriceCents] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMessages = async (cid: string) => {
    const { data: msgs, error } = await supabase.from("messages").select("*").eq("conversation_id", cid).order("created_at");
    if (!error) setMessages(msgs ?? []);
  };

  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const { data: o } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
      if (!alive) return;
      setOther(o);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cid, error: convError } = await (supabase as any).rpc("get_or_create_conversation", { _other: otherId });
      if (convError) console.error("[messages] conv error", convError);
      if (!alive || !cid) { loadingRef.current = false; return; }
      setConvId(cid);
      await loadMessages(cid);
      const { data: pu } = await supabase.from("message_media_purchases").select("message_id").eq("buyer_id", session.user.id);
      if (!alive) return;
      setPurchases(new Set((pu ?? []).map((r) => r.message_id)));
      const { data: settings } = await supabase.from("conversation_settings").select("*").eq("conversation_id", cid);
      if (!alive) return;
      const mine = settings?.find((s) => s.user_id === session.user.id);
      const theirs = settings?.find((s) => s.user_id === otherId);
      setMyAllow(mine ? !!mine.allow_photos_from_other : false);
      setOtherAllow(theirs ? !!theirs.allow_photos_from_other : false);
      loadingRef.current = false;
    })();
    return () => { alive = false; loadingRef.current = false; };
  }, [session, otherId]);

  useEffect(() => {
    if (!convId || !session) return;
    supabase.from("conversation_settings").upsert(
      { conversation_id: convId, user_id: session.user.id, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" }
    ).then(() => {});
  }, [convId, session, messages.length]);

  useEffect(() => {
    if (!convId || !session) return;
    const ch = supabase.channel(`conv-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (p) => setMessages((m) => m.some((msg) => msg.id === (p.new as Any).id) ? m : [...m, p.new]))
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
    const poll = window.setInterval(() => { void loadMessages(convId); }, 4000);
    return () => { window.clearInterval(poll); supabase.removeChannel(ch); };
  }, [convId, session, otherId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pendingPreview]);

  const togglePhotoPermission = async () => {
    if (!convId || !session) return;
    const next = !myAllow;
    setMyAllow(next);
    await supabase.from("conversation_settings").upsert(
      { conversation_id: convId, user_id: session.user.id, allow_photos_from_other: next },
      { onConflict: "conversation_id,user_id" }
    );
  };

  const insertMessage = async (body: string | null, media_url: string | null, ppv: number) => {
    if (!convId || !session) return;
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, sender_id: session.user.id, body, media_url, ppv_price_cents: ppv })
      .select().single();
    if (error) { alert("Message non envoyé. Réessayez."); return; }
    if (data) setMessages((m) => m.some((msg) => msg.id === data.id) ? m : [...m, data]);
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    await insertMessage(body, null, 0);
  };

  const pickPhoto = (f: File) => {
    if (!otherAllow) { alert("Cette personne n'accepte pas les photos dans cette conversation."); return; }
    setPendingFile(f);
    setPendingPreview(URL.createObjectURL(f));
    setPendingPriceCents(0);
  };

  const cancelPhoto = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null); setPendingPreview(null); setPendingPriceCents(0);
  };

  const sendPhoto = async () => {
    if (!pendingFile || !session) return;
    setProgress(0);
    try {
      const path = await uploadMedia(pendingFile, session.user.id, setProgress);
      await insertMessage(text.trim() || null, path, pendingPriceCents);
      setText("");
      cancelPhoto();
    } catch (e) {
      alert("Échec de l'envoi : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProgress(null);
    }
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
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-lg flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
        <L to="/messages" className="rounded-full p-1.5 hover:bg-secondary" aria-label="Retour">
          <ArrowLeft className="h-5 w-5" />
        </L>
        <L to="/u/$username" params={{ username: other?.username ?? "" }} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
            {other?.avatar_url && <SignedImage path={other.avatar_url} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              @{other?.username}
              {other?.is_ambassador && <AmbassadorBadge />}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {otherAllow ? "Photos autorisées" : "Photos bloquées"}
            </p>
          </div>
        </L>
        <button
          onClick={togglePhotoPermission}
          title={myAllow ? "Vous acceptez ses photos" : "Vous refusez ses photos"}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition ${myAllow ? "border-border bg-card" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
        >
          {myAllow ? <ImagePlus className="h-3.5 w-3.5" /> : <ImageOff className="h-3.5 w-3.5" />}
          {myAllow ? "Ouvert" : "Fermé"}
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/30 px-4 py-4">
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-xs rounded-3xl border border-dashed border-border bg-background/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">Envoyez votre premier message à @{other?.username}.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === session?.user.id;
          const locked = m.media_url && m.ppv_price_cents > 0 && !mine && !purchases.has(m.id);
          const prev = messages[i - 1];
          const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000;
          return (
            <div key={m.id}>
              {showTime && (
                <p className="my-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                  {new Date(m.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] overflow-hidden rounded-[22px] shadow-sm ${mine ? "bg-foreground text-background" : "border border-border bg-background"}`}>
                  {m.media_url && (
                    <div className="relative aspect-square w-56 bg-muted">
                      <SignedImage path={m.media_url} className="h-full w-full object-cover" blurred={locked} />
                      {locked && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/40 p-3 text-foreground">
                          <div className="rounded-full bg-background/80 p-2"><Lock className="h-4 w-4" /></div>
                          <p className="text-xs font-bold">Média premium</p>
                          <p className="text-lg font-bold tabular-nums">{(m.ppv_price_cents / 100).toFixed(2)} €</p>
                          <button onClick={() => buyMedia(m.id)} className="rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background">
                            Déverrouiller
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {m.body && <p className="px-3.5 py-2 text-sm leading-snug">{m.body}</p>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Pending photo drawer */}
      {pendingPreview && (
        <div className="border-t border-border bg-card px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
              <img src={pendingPreview} alt="" className="h-full w-full object-cover" />
              <button
                onClick={cancelPhoto}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow"
                aria-label="Annuler"
                disabled={progress !== null}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <input
                  type="number" min={0} step="0.5" placeholder="0,00"
                  value={pendingPriceCents ? (pendingPriceCents / 100).toString() : ""}
                  onChange={(e) => setPendingPriceCents(Math.max(0, Math.round(Number(e.target.value || 0) * 100)))}
                  className="w-24 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                  disabled={progress !== null}
                />
                <span className="text-xs text-muted-foreground">€ (0 = gratuit)</span>
              </div>
              {progress !== null ? (
                <div>
                  <div className="mb-1 flex justify-between text-[11px] font-medium">
                    <span>Envoi…</span><span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-foreground transition-all duration-150" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <button
                  onClick={sendPhoto}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground py-2 text-xs font-semibold text-background"
                >
                  <Check className="h-3.5 w-3.5" /> Envoyer la photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-border bg-background px-3 py-2.5">
        {otherAllow && (
          <label className="cursor-pointer rounded-full bg-secondary p-2.5" title="Envoyer une photo">
            <ImageIcon className="h-5 w-5" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])} />
          </label>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={otherAllow ? "Message…" : "Photos bloquées — écrivez un message"}
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-foreground/30"
          onKeyDown={(e) => e.key === "Enter" && sendText()}
        />
        <button
          onClick={sendText}
          disabled={!text.trim()}
          className="rounded-full bg-foreground p-2.5 text-background disabled:opacity-40"
          aria-label="Envoyer"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      {!otherAllow && <p className="border-t border-border bg-background px-4 pb-2 text-center text-[11px] text-muted-foreground">📵 Cette personne n'a pas activé la réception de photos.</p>}
    </div>
  );
}
