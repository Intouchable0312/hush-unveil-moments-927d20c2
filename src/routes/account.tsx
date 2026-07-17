import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";
import { SignedImage } from "@/components/SignedImage";

export const Route = createFileRoute("/account")({ component: Account });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

function Account() {
  const { session, profile, isAdmin, refresh, signOut } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"settings" | "posts" | "analytics">("settings");
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ username: "", bio: "", hashtags: "", allow_fan_photos: false });
  const [plans, setPlans] = useState({ monthly: "", quarterly: "", yearly: "" });
  const [posts, setPosts] = useState<unknown[]>([]);
  const [analytics, setAnalytics] = useState({ subs: 0, revenue: 0, likes: 0, posts: 0 });

  useEffect(() => {
    if (!session) { nav({ to: "/auth" as string as any }); return; }
    if (profile) {
      setF({
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        hashtags: (profile.hashtags ?? []).join(" "),
        allow_fan_photos: profile.allow_fan_photos,
      });
    }
    (async () => {
      const { data: pl } = await supabase.from("subscription_plans").select("*").eq("creator_id", session!.user.id).maybeSingle();
      if (pl) setPlans({
        monthly: (pl.price_monthly_cents / 100).toString(),
        quarterly: (pl.price_quarterly_cents / 100).toString(),
        yearly: (pl.price_yearly_cents / 100).toString(),
      });
      const { data: mp } = await supabase.from("posts").select("*").eq("creator_id", session!.user.id).order("created_at", { ascending: false });
      setPosts(mp ?? []);
      const { data: subs } = await supabase.from("subscriptions").select("*", { count: "exact" }).eq("creator_id", session!.user.id).eq("active", true);
      const { data: pur } = await supabase.from("post_purchases").select("amount_cents, post_id, posts!inner(creator_id)").eq("posts.creator_id", session!.user.id);
      const revenue = (subs ?? []).reduce((s, r) => s + r.price_paid_cents, 0) + (pur ?? []).reduce((s, r) => s + r.amount_cents, 0);
      const likes = (mp ?? []).reduce((s, p) => s + (p.likes_count ?? 0), 0);
      setAnalytics({ subs: subs?.length ?? 0, revenue, likes, posts: mp?.length ?? 0 });
    })();
  }, [session, profile, nav]);

  const save = async () => {
    if (!session) return;
    setSaving(true);
    const tags = f.hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 5);
    await supabase.from("profiles").update({
      username: f.username || null, bio: f.bio, hashtags: tags, allow_fan_photos: f.allow_fan_photos,
    }).eq("id", session.user.id);
    await supabase.from("subscription_plans").upsert({
      creator_id: session.user.id,
      price_monthly_cents: Math.round(Number(plans.monthly || 0) * 100),
      price_quarterly_cents: Math.round(Number(plans.quarterly || 0) * 100),
      price_yearly_cents: Math.round(Number(plans.yearly || 0) * 100),
    });
    await refresh();
    setSaving(false);
  };

  const toggleTheme = async () => {
    if (!session || !profile) return;
    const next = profile.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    await supabase.from("profiles").update({ theme: next }).eq("id", session.user.id);
    await refresh();
  };

  const uploadAvatar = async (file: File) => {
    if (!session) return;
    const path = await uploadMedia(file, session.user.id);
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", session.user.id);
    await refresh();
  };

  if (!profile) return <div className="p-10 text-center">Chargement…</div>;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Compte</h1>
        <button onClick={toggleTheme} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold">
          Thème: {profile.theme === "dark" ? "Sombre" : "Clair"}
        </button>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <label className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-full bg-muted">
          {profile.avatar_url ? <SignedImage path={profile.avatar_url} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs">Ajouter</div>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
        </label>
        <div>
          <p className="text-lg font-bold">{profile.first_name} {profile.last_name}</p>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.username && <L to={`/u/${profile.username}`} className="text-xs underline">Voir ma page publique</L>}
        </div>
      </div>

      <div className="mb-6 flex rounded-full bg-secondary p-1">
        {(["settings", "posts", "analytics"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-full py-2 text-xs font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {t === "settings" ? "Paramètres" : t === "posts" ? "Mes posts" : "Analytiques"}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <div className="space-y-3">
          <input placeholder="Pseudo" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
          <textarea placeholder="Description" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          <input placeholder="5 hashtags (ex: art photo mode)" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.allow_fan_photos} onChange={(e) => setF({ ...f, allow_fan_photos: e.target.checked })} /> Autoriser mes abonnés à m'envoyer des photos</label>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-sm font-semibold">Prix abonnement (€)</p>
            <div className="grid grid-cols-3 gap-2">
              <input placeholder="Mois" className="rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={plans.monthly} onChange={(e) => setPlans({ ...plans, monthly: e.target.value })} />
              <input placeholder="Trim." className="rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={plans.quarterly} onChange={(e) => setPlans({ ...plans, quarterly: e.target.value })} />
              <input placeholder="Année" className="rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={plans.yearly} onChange={(e) => setPlans({ ...plans, yearly: e.target.value })} />
            </div>
          </div>
          <button onClick={save} disabled={saving} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">{saving ? "..." : "Enregistrer"}</button>
          <L to="/messages" className="block w-full rounded-full border border-border bg-card py-3 text-center font-semibold">Mes messages</L>
          {isAdmin && <L to="/admin" className="block w-full rounded-full border border-border bg-card py-3 text-center font-semibold">Panel administrateur</L>}
          <button onClick={async () => { await signOut(); nav({ to: "/auth" as string as any }); }} className="w-full rounded-full border border-destructive py-3 font-semibold text-destructive">Déconnexion</button>
        </div>
      )}

      {tab === "posts" && (
        <div className="grid grid-cols-3 gap-2">
          {posts.length === 0 && <p className="col-span-3 text-center text-sm text-muted-foreground">Aucun post.</p>}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {posts.map((p: any) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
              <SignedImage path={p.media_url} className="h-full w-full object-cover" />
              <button onClick={async () => { if (confirm("Supprimer ce post ?")) { await supabase.from("posts").delete().eq("id", p.id); setPosts(posts.filter((x: any) => x.id !== p.id)); } }} className="absolute right-1 top-1 rounded-full bg-background/80 px-2 py-1 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {tab === "analytics" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "Abonnés", v: analytics.subs },
            { l: "Posts", v: analytics.posts },
            { l: "Likes", v: analytics.likes },
            { l: "Revenu", v: `${(analytics.revenue / 100).toFixed(2)}€` },
          ].map((s) => (
            <div key={s.l} className="rounded-3xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.l}</p>
              <p className="text-2xl font-bold">{s.v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
