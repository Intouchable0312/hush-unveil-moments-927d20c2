import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import { ActionSlider } from "@/components/ActionSlider";
import { LogOut, Shield, Camera, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/account")({ component: Account });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Tab = "profil" | "createur" | "preferences" | "securite";

function Account() {
  const { session, profile, isAdmin, refresh, signOut } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("profil");
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ username: "", bio: "", hashtags: "" });
  const [plans, setPlans] = useState({ monthly: "", quarterly: "", yearly: "" });
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropAspect, setCropAspect] = useState(1);
  const [cropKind, setCropKind] = useState<"avatar" | "cover">("avatar");

  useEffect(() => {
    if (!session) { nav({ to: "/auth" as string as any }); return; }
    if (profile) {
      setF({
        username: profile.username ?? "",
        bio: profile.bio ?? "",
        hashtags: (profile.hashtags ?? []).join(" "),
      });
    }
    (async () => {
      const { data: pl } = await supabase.from("subscription_plans").select("*").eq("creator_id", session!.user.id).maybeSingle();
      if (pl) setPlans({
        monthly: (pl.price_monthly_cents / 100).toString(),
        quarterly: (pl.price_quarterly_cents / 100).toString(),
        yearly: (pl.price_yearly_cents / 100).toString(),
      });
    })();
  }, [session, profile, nav]);

  // Realtime on own profile so remote changes reflect
  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`me-${session.user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${session.user.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, refresh]);

  const saveProfile = async () => {
    if (!session) return;
    setSaving(true);
    const tags = f.hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 5);
    await supabase.from("profiles").update({ username: f.username || null, bio: f.bio, hashtags: tags }).eq("id", session.user.id);
    await refresh();
    setSaving(false);
  };

  const savePlans = async () => {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.from("subscription_plans").upsert({
      creator_id: session.user.id,
      price_monthly_cents: Math.round(Number(plans.monthly || 0) * 100),
      price_quarterly_cents: Math.round(Number(plans.quarterly || 0) * 100),
      price_yearly_cents: Math.round(Number(plans.yearly || 0) * 100),
    }, { onConflict: "creator_id" });
    if (error) { alert("Erreur : " + error.message); setSaving(false); return; }
    const { error: e2 } = await supabase.from("profiles").update({ is_creator: true }).eq("id", session.user.id);
    if (e2) { alert("Erreur profil : " + e2.message); setSaving(false); return; }
    await refresh();
    setSaving(false);
    alert("Tarifs enregistrés ✓");
  };

  const toggleTheme = async () => {
    if (!session || !profile) return;
    const next = profile.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    await supabase.from("profiles").update({ theme: next }).eq("id", session.user.id);
    await refresh();
  };

  const pickImage = (kind: "avatar" | "cover") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setCropAspect(kind === "avatar" ? 1 : 3);
    setCropKind(kind);
    e.target.value = "";
  };

  const saveCropped = async (blob: Blob) => {
    if (!session) return;
    const file = new File([blob], `${cropKind}.jpg`, { type: "image/jpeg" });
    const path = `${session.user.id}/${cropKind}-${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false });
    if (error) { alert(error.message); return; }
    const patch = cropKind === "avatar" ? { avatar_url: path } : { cover_url: path };
    await supabase.from("profiles").update(patch).eq("id", session.user.id);

    await refresh();
  };

  if (!profile) return <div className="p-10 text-center">Chargement…</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "profil", label: "Profil" },
    { id: "createur", label: "Créateur" },
    { id: "preferences", label: "Préférences" },
    { id: "securite", label: "Sécurité" },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      {/* Banner + avatar */}
      <div className="relative mb-16">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-muted">
          <div className="aspect-[3/1] w-full bg-gradient-to-br from-secondary to-accent">
            {profile.cover_url && <SignedImage path={profile.cover_url} className="h-full w-full object-cover" />}
          </div>
          <label className="absolute right-3 top-3 flex cursor-pointer items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            <ImagePlus className="h-3.5 w-3.5" /> Bannière
            <input type="file" accept="image/*" className="hidden" onChange={pickImage("cover")} />
          </label>
        </div>
        <label className="absolute -bottom-12 left-5 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg">
          {profile.avatar_url ? <SignedImage path={profile.avatar_url} className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-muted-foreground" />}
          <input type="file" accept="image/*" className="hidden" onChange={pickImage("avatar")} />
        </label>
      </div>

      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold">{profile.first_name} {profile.last_name}</p>
          <p className="text-sm text-muted-foreground">@{profile.username ?? "—"}</p>
          {profile.username && <L to={`/u/${profile.username}`} className="mt-1 inline-block text-xs underline">Voir ma page publique</L>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profil" && (
        <div className="space-y-3">
          <input placeholder="Pseudo (@)" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
          <textarea placeholder="Bio (une phrase qui vous décrit)" rows={4} className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
          <input placeholder="5 hashtags (ex: art photo mode)" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} />
          <button onClick={saveProfile} disabled={saving} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">{saving ? "…" : "Enregistrer"}</button>
        </div>
      )}

      {tab === "createur" && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="mb-1 text-sm font-semibold">Prix d'abonnement</p>
            <p className="mb-4 text-xs text-muted-foreground">Vos fans pourront choisir la durée à la souscription.</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <span className="w-24 text-xs uppercase tracking-wider text-muted-foreground">Mensuel</span>
                <input placeholder="9.99" className="flex-1 rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={plans.monthly} onChange={(e) => setPlans({ ...plans, monthly: e.target.value })} />
                <span className="text-sm text-muted-foreground">€</span>
              </label>
              <label className="flex items-center gap-3">
                <span className="w-24 text-xs uppercase tracking-wider text-muted-foreground">Trimestriel</span>
                <input placeholder="24.99" className="flex-1 rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={plans.quarterly} onChange={(e) => setPlans({ ...plans, quarterly: e.target.value })} />
                <span className="text-sm text-muted-foreground">€</span>
              </label>
              <label className="flex items-center gap-3">
                <span className="w-24 text-xs uppercase tracking-wider text-muted-foreground">Annuel</span>
                <input placeholder="89.99" className="flex-1 rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={plans.yearly} onChange={(e) => setPlans({ ...plans, yearly: e.target.value })} />
                <span className="text-sm text-muted-foreground">€</span>
              </label>
            </div>
            <button onClick={savePlans} className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground">Enregistrer mes tarifs</button>
          </div>
          <p className="text-xs text-muted-foreground">💡 Le contrôle des photos que vos abonnés vous envoient se fait maintenant conversation par conversation, directement dans la discussion.</p>
        </div>
      )}

      {tab === "preferences" && (
        <div className="space-y-3">
          <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <span className="font-semibold">Thème</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs">{profile.theme === "dark" ? "🌙 Sombre" : "☀️ Clair"}</span>
          </button>
        </div>
      )}

      {tab === "securite" && (
        <div className="space-y-4">
          {isAdmin && (
            <L to="/admin" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <Shield className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-semibold">Panel administrateur</p>
                <p className="text-xs text-muted-foreground">Gérer les utilisateurs, bans, abonnements</p>
              </div>
            </L>
          )}
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <LogOut className="h-4 w-4 text-destructive" />
              <p className="text-sm font-semibold text-destructive">Déconnexion</p>
            </div>
            <ActionSlider label="Glissez pour vous déconnecter" variant="destructive" onConfirm={async () => { await signOut(); nav({ to: "/auth" as string as any }); }} />
          </div>
        </div>
      )}

      <ImageCropperModal
        open={!!cropFile}
        file={cropFile}
        aspect={cropAspect}
        onClose={() => setCropFile(null)}
        onSave={saveCropped}
        title={cropKind === "avatar" ? "Recadrer la photo de profil" : "Recadrer la bannière"}
      />
    </div>
  );
}
