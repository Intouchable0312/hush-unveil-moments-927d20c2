import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { PaymentSlider } from "@/components/PaymentSlider";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/u/$username")({ component: CreatorProfile });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

function CreatorProfile() {
  const { username } = useParams({ from: "/u/$username" });
  const { session, isAdmin } = useAuth();
  const nav = useNavigate();
  const [creator, setCreator] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<any>(null);
  const [subbed, setSubbed] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");

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
        const { data: s } = await supabase.from("subscriptions").select("*").eq("fan_id", session.user.id).eq("creator_id", c.id).eq("active", true).maybeSingle();
        setSubbed(!!s);
        const { data: pu } = await supabase.from("post_purchases").select("post_id").eq("buyer_id", session.user.id);
        setPurchases(new Set((pu ?? []).map((r) => r.post_id)));
      }
    })();
  }, [username, session]);

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

  const grantFree = async () => {
    if (!creator || !session) return;
    const now = new Date(); const exp = new Date(now); exp.setFullYear(exp.getFullYear() + 100);
    await supabase.from("subscriptions").upsert({ fan_id: session.user.id, creator_id: creator.id, period: "gift", price_paid_cents: 0, expires_at: exp.toISOString(), active: true });
    setSubbed(true);
  };

  if (!creator) return <div className="p-10 text-center text-sm text-muted-foreground">Créateur introuvable.</div>;

  const isMe = session?.user.id === creator.id;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-muted">
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
        <div className="mt-6 rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex gap-2">
            {(["monthly", "quarterly", "yearly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 rounded-full py-2 text-xs font-semibold ${period === p ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                {p === "monthly" ? "Mois" : p === "quarterly" ? "Trimestre" : "Année"}
              </button>
            ))}
          </div>
          <PaymentSlider label={`S'abonner — ${(price / 100).toFixed(2)}€`} onConfirm={subscribe} />
          {isAdmin && <button onClick={grantFree} className="mt-2 w-full rounded-full border border-border py-2 text-xs">Admin : m'abonner gratuitement</button>}
        </div>
      )}

      {subbed && !isMe && (
        <L to={`/messages/${creator.id}`} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-primary-foreground">
          <MessageCircle className="h-5 w-5" /> Envoyer un message
        </L>
      )}

      <h2 className="mt-8 mb-3 text-lg font-bold">Publications</h2>
      {posts.length === 0 && <p className="text-sm text-muted-foreground">Aucune publication.</p>}
      <div className="grid grid-cols-3 gap-1">
        {posts.map((p) => {
          const locked = !isMe && p.visibility !== "public" && !subbed;
          const ppvLocked = p.visibility === "ppv" && !purchases.has(p.id) && !isMe;
          return (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
              <SignedImage path={p.media_url} className="h-full w-full object-cover" blurred={locked || ppvLocked} />
              {(locked || ppvLocked) && <div className="absolute inset-0 flex items-center justify-center bg-background/40 text-xs font-bold">🔒</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
