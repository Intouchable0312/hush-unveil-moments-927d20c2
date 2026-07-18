import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { PaymentSlider } from "@/components/PaymentSlider";
import { Modal } from "@/components/Modal";
import { MessageCircle, Lock, Sparkles, Check, Image as ImageIcon, Heart, XCircle } from "lucide-react";
import { AmbassadorBadge } from "@/components/AmbassadorBadge";

export const Route = createFileRoute("/u/$username")({ component: CreatorProfile });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

function CreatorProfile() {
  const { username } = useParams({ from: "/u/$username" });
  const { session, isAdmin } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [creator, setCreator] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plan, setPlan] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [subRow, setSubRow] = useState<any>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [unsubOpen, setUnsubOpen] = useState(false);

  const subbed = !!subRow;

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!c) return;
      setCreator(c);
      const { data: p } = await supabase.from("posts").select("*").eq("creator_id", c.id).order("created_at", { ascending: false });
      setPosts(p ?? []);
      const { data: pl } = await supabase.from("subscription_plans").select("*").eq("creator_id", c.id).maybeSingle();
      setPlan(pl);
      if (session) {
        setCheckingSubscription(true);
        const { data: s } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("fan_id", session.user.id)
          .eq("creator_id", c.id)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        setSubRow(s);
        const { data: pu } = await supabase.from("post_purchases").select("post_id").eq("buyer_id", session.user.id);
        setPurchases(new Set((pu ?? []).map((r) => r.post_id)));
        setCheckingSubscription(false);
      } else {
        setSubRow(null);
        setCheckingSubscription(false);
      }
    })();
  }, [username, session]);

  useEffect(() => {
    if (!creator?.id) return;
    const ch = supabase.channel(`creator-posts-${creator.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `creator_id=eq.${creator.id}` }, (payload) => {
        setPosts((prev) => [payload.new as Post, ...prev]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts", filter: `creator_id=eq.${creator.id}` }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== (payload.old as Post).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [creator?.id]);

  useEffect(() => {
    if (!session || !creator?.id) return;
    const ch = supabase.channel(`sub-${session.user.id}-${creator.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `fan_id=eq.${session.user.id}` }, async () => {
        const { data: s } = await supabase
          .from("subscriptions").select("*")
          .eq("fan_id", session.user.id).eq("creator_id", creator.id).eq("active", true)
          .gt("expires_at", new Date().toISOString()).maybeSingle();
        setSubRow(s);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_purchases", filter: `buyer_id=eq.${session.user.id}` }, (payload) => {
        setPurchases((prev) => new Set([...prev, (payload.new as { post_id: string }).post_id]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, creator?.id]);

  const price = plan ? (period === "monthly" ? plan.price_monthly_cents : period === "quarterly" ? plan.price_quarterly_cents : plan.price_yearly_cents) : 0;

  const subscribe = async () => {
    if (!creator) return;
    const res = await authFetch("/api/public/stripe-checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "subscription", creator_id: creator.id, period }),
    });
    const j = await res.json() as { url?: string; error?: string };
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? "Erreur");
  };

  const unsubscribe = async () => {
    if (!subRow) return;
    await supabase.from("subscriptions")
      .update({ active: false, expires_at: new Date().toISOString() })
      .eq("id", subRow.id);
    setSubRow(null);
    setUnsubOpen(false);
  };

  const buyPost = async (postId: string) => {
    const res = await authFetch("/api/public/stripe-checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "post", post_id: postId }),
    });
    const j = await res.json() as { url?: string; error?: string };
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? "Erreur");
  };

  const grantFree = async () => {
    if (!creator || !session) return;
    const now = new Date(); const exp = new Date(now); exp.setFullYear(exp.getFullYear() + 100);
    await supabase.from("subscriptions").upsert({ fan_id: session.user.id, creator_id: creator.id, period: "gift", price_paid_cents: 0, expires_at: exp.toISOString(), active: true });
    setSubOpen(false);
  };

  if (!creator) return <div className="p-10 text-center text-sm text-muted-foreground">Créateur introuvable.</div>;

  const isMe = session?.user.id === creator.id;
  const publicCount = posts.filter((p) => p.visibility === "public").length;
  const premiumCount = posts.length - publicCount;

  return (
    <div className="pb-28">
      {/* Cover / banner */}
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-muted via-secondary to-muted sm:h-72">
        {creator.cover_url ? (
          <SignedImage path={creator.cover_url} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-accent),transparent_60%),radial-gradient(circle_at_70%_80%,var(--color-secondary),transparent_60%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      <div className="mx-auto -mt-16 max-w-lg px-5">
        {/* Avatar + identity card */}
        <div className="rounded-3xl border border-border bg-card/90 p-5 shadow-xl backdrop-blur">
          <div className="flex items-end gap-4">
            <div className="-mt-14 h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted ring-4 ring-card shadow-lg">
              {creator.avatar_url && <SignedImage path={creator.avatar_url} className="h-full w-full object-cover" />}
            </div>
            <div className="flex-1 pb-1">
              <h1 className="flex items-center gap-1.5 text-xl font-bold leading-tight">
                @{creator.username}
                {subbed && <span title="Abonné" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>}
              </h1>
              <p className="text-xs text-muted-foreground">{creator.first_name} {creator.last_name}</p>
            </div>
          </div>

          {creator.bio && <p className="mt-4 text-sm leading-relaxed">{creator.bio}</p>}
          {creator.hashtags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {creator.hashtags.map((h: string) => (
                <span key={h} className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">#{h}</span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-secondary/50 p-3 text-center">
            <div><p className="text-lg font-bold leading-none">{posts.length}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Posts</p></div>
            <div className="border-x border-border"><p className="text-lg font-bold leading-none">{publicCount}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Publics</p></div>
            <div><p className="text-lg font-bold leading-none">{premiumCount}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Premium</p></div>
          </div>

          {/* Action bar */}
          {!isMe && (
            <div className="mt-5 space-y-2">
              {!subbed && plan && price > 0 && (
                <button onClick={() => setSubOpen(true)} className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.01] active:scale-[0.99]">
                  <span className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-12 bg-white/15 transition-transform duration-700 group-hover:translate-x-[300%]" />
                  <Sparkles className="h-4 w-4" /> S'abonner — {(plan.price_monthly_cents / 100).toFixed(2)}€ / mois
                </button>
              )}
              {subbed && (
                <div className="flex gap-2">
                  <L to={`/messages/${creator.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground shadow">
                    <MessageCircle className="h-5 w-5" /> Message
                  </L>
                  <button onClick={() => setUnsubOpen(true)} className="flex items-center justify-center gap-1 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40" title="Se désabonner">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
              {checkingSubscription && (
                <div className="rounded-2xl border border-border bg-card py-2.5 text-center text-xs font-medium text-muted-foreground">Vérification…</div>
              )}
            </div>
          )}
        </div>

        {/* Posts */}
        <div className="mt-6 mb-3 flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" /> Publications
          </h2>
          <span className="text-xs text-muted-foreground">{posts.length}</span>
        </div>
        {posts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Aucune publication pour l'instant.</div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {posts.map((p) => {
            const locked = !isMe && p.visibility === "subscribers" && !subbed;
            const ppvLocked = p.visibility === "ppv" && !purchases.has(p.id) && !isMe;
            return (
              <button
                key={p.id}
                onClick={() => setOpenPost(p)}
                className="group relative aspect-square overflow-hidden rounded-2xl bg-muted transition-transform hover:scale-[1.02]"
              >
                <SignedImage path={p.media_url} className="h-full w-full object-cover transition-transform group-hover:scale-105" blurred={locked || ppvLocked} />
                {p.visibility !== "public" && (
                  <div className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1 backdrop-blur">
                    {p.visibility === "ppv" ? <span className="px-1 text-[10px] font-bold">€</span> : <Heart className="h-3 w-3" />}
                  </div>
                )}
                {(locked || ppvLocked) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40 text-xs font-bold backdrop-blur-sm">
                    <Lock className="h-4 w-4" />
                    {ppvLocked && <span>{(p.ppv_price_cents / 100).toFixed(2)}€</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Post detail / purchase modal */}
      <Modal open={!!openPost} onClose={() => setOpenPost(null)} title={openPost ? (openPost.visibility === "ppv" ? "Contenu premium" : openPost.visibility === "subscribers" ? "Contenu abonnés" : "Publication") : ""}>
        {openPost && (() => {
          const p = openPost;
          const locked = !isMe && p.visibility === "subscribers" && !subbed;
          const ppvLocked = p.visibility === "ppv" && !purchases.has(p.id) && !isMe;
          return (
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
                <SignedImage path={p.media_url} className="h-full w-full object-cover" blurred={locked || ppvLocked} />
                {(locked || ppvLocked) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <div className="rounded-full bg-primary/90 p-4 text-primary-foreground"><Lock className="h-6 w-6" /></div>
                  </div>
                )}
              </div>
              {p.description && <p className="text-sm">{p.description}</p>}
              {ppvLocked && (
                <>
                  <p className="text-center text-sm font-semibold">Déverrouiller pour {(p.ppv_price_cents / 100).toFixed(2)}€</p>
                  <PaymentSlider label={`Payer ${(p.ppv_price_cents / 100).toFixed(2)}€`} onConfirm={() => buyPost(p.id)} />
                </>
              )}
              {locked && (
                <>
                  <p className="text-center text-sm font-semibold">Abonnez-vous pour voir ce contenu</p>
                  <button onClick={() => { setOpenPost(null); setSubOpen(true); }} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">S'abonner</button>
                </>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Subscribe modal */}
      <Modal open={subOpen} onClose={() => setSubOpen(false)} title={`S'abonner à @${creator.username}`}>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["monthly", "quarterly", "yearly"] as const).map((p) => {
              const cents = p === "monthly" ? plan?.price_monthly_cents : p === "quarterly" ? plan?.price_quarterly_cents : plan?.price_yearly_cents;
              return (
                <button key={p} onClick={() => setPeriod(p)} className={`flex-1 rounded-2xl border p-3 text-center ${period === p ? "border-primary bg-primary/10" : "border-border"}`}>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{p === "monthly" ? "Mois" : p === "quarterly" ? "Trimestre" : "Année"}</p>
                  <p className="mt-1 text-sm font-bold">{cents ? (cents / 100).toFixed(2) : "—"}€</p>
                </button>
              );
            })}
          </div>
          <PaymentSlider label={`S'abonner — ${(price / 100).toFixed(2)}€`} onConfirm={subscribe} />
          {isAdmin && <button onClick={grantFree} className="w-full rounded-full border border-border py-2 text-xs">Admin : m'abonner gratuitement</button>}
        </div>
      </Modal>

      {/* Unsubscribe confirmation */}
      <Modal open={unsubOpen} onClose={() => setUnsubOpen(false)} title="Se désabonner ?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous perdrez l'accès aux contenus abonnés de <span className="font-semibold text-foreground">@{creator.username}</span> et à la messagerie. Cette action est immédiate.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setUnsubOpen(false)} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold">Annuler</button>
            <button onClick={unsubscribe} className="flex-1 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground">Se désabonner</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
