import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { PaymentSlider } from "@/components/PaymentSlider";
import { Modal } from "@/components/Modal";
import { MessageCircle, Lock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/u/$username")({ component: CreatorProfile });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

function CreatorProfile() {
  const { username } = useParams({ from: "/u/$username" });
  const { session, isAdmin } = useAuth();
  const nav = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [creator, setCreator] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plan, setPlan] = useState<any>(null);
  const [subbed, setSubbed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [subOpen, setSubOpen] = useState(false);

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
          .select("id")
          .eq("fan_id", session.user.id)
          .eq("creator_id", c.id)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        setSubbed(!!s);
        const { data: pu } = await supabase.from("post_purchases").select("post_id").eq("buyer_id", session.user.id);
        setPurchases(new Set((pu ?? []).map((r) => r.post_id)));
        setCheckingSubscription(false);
      } else {
        setSubbed(false);
        setCheckingSubscription(false);
      }
    })();
  }, [username, session]);

  // Realtime: new posts from this creator appear instantly
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

  // Realtime: my subscription status
  useEffect(() => {
    if (!session || !creator?.id) return;
    const ch = supabase.channel(`sub-${session.user.id}-${creator.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `fan_id=eq.${session.user.id}` }, async () => {
        const { data: s } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("fan_id", session.user.id)
          .eq("creator_id", creator.id)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        setSubbed(!!s);
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
    setSubbed(true);
    setSubOpen(false);
  };

  if (!creator) return <div className="p-10 text-center text-sm text-muted-foreground">Créateur introuvable.</div>;

  const isMe = session?.user.id === creator.id;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-24">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-muted ring-2 ring-border">
          {creator.avatar_url && <SignedImage path={creator.avatar_url} className="h-full w-full object-cover" />}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">@{creator.username}</h1>
          <p className="text-sm text-muted-foreground">{creator.first_name} {creator.last_name}</p>
        </div>
      </div>
      {creator.bio && <p className="mt-4 text-sm">{creator.bio}</p>}
      {creator.hashtags?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{creator.hashtags.map((h: string) => `#${h}`).join(" ")}</p>}

      {!isMe && !subbed && plan && price > 0 && (
        <button onClick={() => setSubOpen(true)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground">
          <Sparkles className="h-4 w-4" /> S'abonner à partir de {(plan.price_monthly_cents / 100).toFixed(2)}€
        </button>
      )}

      {subbed && !isMe && (
        <L to={`/messages/${creator.id}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground">
          <MessageCircle className="h-5 w-5" /> Envoyer un message
        </L>
      )}

      {!isMe && checkingSubscription && (
        <div className="mt-4 rounded-2xl border border-border bg-card py-3 text-center text-sm font-medium text-muted-foreground">
          Vérification de votre accès message…
        </div>
      )}

      <h2 className="mt-8 mb-3 text-lg font-bold">Publications</h2>
      {posts.length === 0 && <p className="text-sm text-muted-foreground">Aucune publication.</p>}
      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => {
          const locked = !isMe && p.visibility === "subscribers" && !subbed;
          const ppvLocked = p.visibility === "ppv" && !purchases.has(p.id) && !isMe;
          return (
            <button
              key={p.id}
              onClick={() => setOpenPost(p)}
              className="relative aspect-square overflow-hidden rounded-2xl bg-muted"
            >
              <SignedImage path={p.media_url} className="h-full w-full object-cover" blurred={locked || ppvLocked} />
              {(locked || ppvLocked) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40 text-xs font-bold">
                  <Lock className="h-4 w-4" />
                  {ppvLocked && <span>{(p.ppv_price_cents / 100).toFixed(2)}€</span>}
                </div>
              )}
            </button>
          );
        })}
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
    </div>
  );
}
