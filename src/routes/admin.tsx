import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, ShieldPlus, Gift, ShieldOff, Star, StarOff, BarChart3, Users, Crown, FileImage, Euro, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { UserSearchPicker, type PickedUser } from "@/components/UserSearchPicker";
import { ActionSlider } from "@/components/ActionSlider";
import { AmbassadorBadge } from "@/components/AmbassadorBadge";

export const Route = createFileRoute("/admin")({ component: Admin });

type Row = { id: string; username: string | null; first_name: string | null; last_name: string | null; phone: string | null; is_creator: boolean; is_ambassador: boolean; banned?: string; roles: string[] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

type Tab = "overview" | "users" | "creators" | "content" | "finances";

function Admin() {
  const { isAdmin, session, ready } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [users, setUsers] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [banFor, setBanFor] = useState<Row | null>(null);
  const [banReason, setBanReason] = useState("");
  const [giftFor, setGiftFor] = useState<Row | null>(null);
  const [giftCreator, setGiftCreator] = useState<PickedUser | null>(null);
  const [giftMonths, setGiftMonths] = useState(1);
  const [statsFor, setStatsFor] = useState<Row | null>(null);
  const [userStats, setUserStats] = useState<Any>(null);

  const [overview, setOverview] = useState<Any>(null);
  const [topCreators, setTopCreators] = useState<Any[]>([]);
  const [posts, setPosts] = useState<Any[]>([]);
  const [purchases, setPurchases] = useState<Any[]>([]);

  useEffect(() => { if (ready && !isAdmin) nav({ to: "/" as string as any }); }, [ready, isAdmin, nav]);

  const reloadUsers = async () => {
    const [{ data }, { data: bans }, { data: roles }] = await Promise.all([
      (supabase as Any).rpc("admin_list_users"),
      supabase.from("bans").select("user_id,reason"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const banMap = new Map((bans ?? []).map((b: Any) => [b.user_id, b.reason]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: Any) => { const a = roleMap.get(r.user_id) ?? []; a.push(r.role); roleMap.set(r.user_id, a); });
    setUsers(((data ?? []) as Any[]).map((u) => ({ ...u, banned: banMap.get(u.id), roles: roleMap.get(u.id) ?? [] })));
  };

  const reloadOverview = async () => {
    const { data } = await (supabase as Any).rpc("admin_overview_stats");
    setOverview(data);
  };
  const reloadTop = async () => {
    const { data } = await (supabase as Any).rpc("admin_top_creators", { _limit: 25 });
    setTopCreators(data ?? []);
  };
  const reloadContent = async () => {
    const { data } = await supabase.from("posts").select("id,creator_id,description,media_url,visibility,ppv_price_cents,created_at").order("created_at", { ascending: false }).limit(50);
    setPosts(data ?? []);
  };
  const reloadPurchases = async () => {
    const { data } = await (supabase as Any).rpc("admin_recent_purchases", { _limit: 100 });
    setPurchases(data ?? []);
  };

  useEffect(() => {
    if (!isAdmin) return;
    reloadUsers();
    reloadOverview();
    reloadTop();
    reloadContent();
    reloadPurchases();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bans" }, () => { reloadUsers(); reloadOverview(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, reloadUsers)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { reloadUsers(); reloadOverview(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => { reloadOverview(); reloadTop(); reloadPurchases(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => { reloadOverview(); reloadContent(); reloadTop(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "post_purchases" }, () => { reloadPurchases(); reloadOverview(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_media_purchases" }, () => { reloadPurchases(); reloadOverview(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

  useEffect(() => {
    if (!statsFor) { setUserStats(null); return; }
    (async () => {
      const { data } = await (supabase as Any).rpc("admin_user_stats", { _uid: statsFor.id });
      setUserStats(data);
    })();
  }, [statsFor]);

  const filtered = useMemo(() => {
    if (!q.trim()) return users;
    const s = q.toLowerCase();
    return users.filter((u) =>
      (u.username ?? "").toLowerCase().includes(s) ||
      (u.first_name ?? "").toLowerCase().includes(s) ||
      (u.last_name ?? "").toLowerCase().includes(s) ||
      (u.phone ?? "").includes(s)
    );
  }, [users, q]);

  const doBan = async () => {
    if (!banFor || !banReason.trim()) throw new Error("Raison requise");
    await supabase.from("bans").insert({ user_id: banFor.id, reason: banReason.trim(), banned_by: session?.user.id });
    setBanFor(null); setBanReason("");
  };
  const doUnban = async (id: string) => { await supabase.from("bans").delete().eq("user_id", id); };
  const doMakeAdmin = async (id: string) => { await supabase.from("user_roles").insert({ user_id: id, role: "admin" }); };
  const doRevokeAdmin = async (id: string) => { await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin"); };
  const toggleAmbassador = async (u: Row) => {
    await supabase.from("profiles").update({ is_ambassador: !u.is_ambassador }).eq("id", u.id);
  };
  const deletePost = async (id: string) => {
    if (!confirm("Supprimer cette publication ?")) return;
    await supabase.from("posts").delete().eq("id", id);
  };
  const doGift = async () => {
    if (!giftFor || !giftCreator) throw new Error("Sélection incomplète");
    const exp = new Date(); exp.setMonth(exp.getMonth() + giftMonths);
    const { error } = await supabase.from("subscriptions").upsert({
      fan_id: giftFor.id, creator_id: giftCreator.id, period: "gift",
      price_paid_cents: 0, expires_at: exp.toISOString(), active: true,
    });
    if (error) throw error;
    setGiftFor(null); setGiftCreator(null); setGiftMonths(1);
  };

  if (!isAdmin) return null;

  const fmt = (c: number | null | undefined) => `${((c ?? 0) / 100).toFixed(2)}€`;

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Vue", icon: BarChart3 },
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "creators", label: "Créateurs", icon: Crown },
    { id: "content", label: "Contenu", icon: FileImage },
    { id: "finances", label: "Finances", icon: Euro },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4">
      <h1 className="mb-4 text-3xl font-bold">Administration</h1>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && overview && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Utilisateurs" value={overview.users} />
          <StatCard label="Créateurs" value={overview.creators} />
          <StatCard label="Ambassadeurs" value={overview.ambassadors} />
          <StatCard label="Publications" value={overview.posts} />
          <StatCard label="Abonnements actifs" value={overview.active_subs} />
          <StatCard label="Messages 24h" value={overview.messages_24h} />
          <StatCard label="Revenus 30j" value={fmt(overview.revenue_30d_cents)} />
          <StatCard label="MRR" value={fmt(overview.mrr_cents)} />
          <StatCard label="Bannis" value={overview.bans} />
        </div>
      )}

      {tab === "users" && (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input placeholder="Rechercher (pseudo, nom, téléphone)" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent outline-none" />
            <span className="text-xs text-muted-foreground">{filtered.length}</span>
          </div>
          <div className="space-y-2">
            {filtered.map((u) => {
              const isAdm = u.roles.includes("admin");
              return (
                <div key={u.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 font-bold">
                        @{u.username ?? "(sans pseudo)"}
                        {isAdm && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">ADMIN</span>}
                        {u.is_creator && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">CRÉATEUR</span>}
                        {u.is_ambassador && <AmbassadorBadge />}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.first_name} {u.last_name} · {u.phone}</p>
                      {u.banned && <p className="mt-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Banni : {u.banned}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button onClick={() => setStatsFor(u)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"><BarChart3 className="h-3 w-3" /> Stats</button>
                    <button onClick={() => toggleAmbassador(u)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
                      {u.is_ambassador ? <><StarOff className="h-3 w-3" /> Retirer ambassadeur</> : <><Star className="h-3 w-3" /> Nommer ambassadeur</>}
                    </button>
                    {!isAdm
                      ? <button onClick={() => doMakeAdmin(u.id)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"><ShieldPlus className="h-3 w-3" /> Admin</button>
                      : u.id !== session?.user.id && <button onClick={() => doRevokeAdmin(u.id)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"><ShieldOff className="h-3 w-3" /> Retirer admin</button>}
                    <button onClick={() => setGiftFor(u)} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"><Gift className="h-3 w-3" /> Offrir un abonnement</button>
                    {!u.banned
                      ? <button onClick={() => setBanFor(u)} className="rounded-full bg-destructive px-3 py-1 text-xs text-destructive-foreground">Bannir</button>
                      : <button onClick={() => doUnban(u.id)} className="rounded-full border border-border px-3 py-1 text-xs">Débannir</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "creators" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3 text-left">Créateur</th><th className="p-3 text-right">Abonnés</th><th className="p-3 text-right">Posts</th><th className="p-3 text-right">Revenus</th></tr>
            </thead>
            <tbody>
              {topCreators.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-medium">@{c.username}</td>
                  <td className="p-3 text-right">{c.subscribers}</td>
                  <td className="p-3 text-right">{c.posts}</td>
                  <td className="p-3 text-right font-bold">{fmt(c.revenue_cents)}</td>
                </tr>
              ))}
              {topCreators.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Aucun créateur.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "content" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {posts.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-square bg-muted" />
              <div className="p-2 text-xs">
                <p className="truncate">{p.description || <span className="text-muted-foreground">Sans description</span>}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{p.visibility}</span>
                  <button onClick={() => deletePost(p.id)} className="rounded-full bg-destructive/10 p-1 text-destructive" title="Supprimer"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground">Aucune publication.</p>}
        </div>
      )}

      {tab === "finances" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3 text-left">Type</th><th className="p-3 text-left">Date</th><th className="p-3 text-right">Montant</th></tr>
            </thead>
            <tbody>
              {purchases.map((p, i) => (
                <tr key={`${p.kind}-${p.ref}-${i}`} className="border-t border-border">
                  <td className="p-3">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider">
                      {p.kind === "subscription" ? "Abo" : p.kind === "post_ppv" ? "Post PPV" : "DM PPV"}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(p.at).toLocaleString("fr")}</td>
                  <td className="p-3 text-right font-bold">{fmt(p.amount_cents)}</td>
                </tr>
              ))}
              {purchases.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Aucun paiement.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Ban modal */}
      <Modal open={!!banFor} onClose={() => setBanFor(null)} title={`Bannir @${banFor?.username ?? ""}`}>
        <textarea autoFocus placeholder="Raison du bannissement (affichée à l'utilisateur)" rows={4} className="mb-4 w-full rounded-2xl border border-border bg-background px-4 py-3" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
        <ActionSlider label="Glissez pour bannir" variant="destructive" onConfirm={doBan} disabled={!banReason.trim()} />
      </Modal>

      {/* Gift modal */}
      <Modal open={!!giftFor} onClose={() => { setGiftFor(null); setGiftCreator(null); }} title={`Offrir un abonnement à @${giftFor?.username ?? ""}`}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Créateur</p>
            {giftCreator ? (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-3">
                <div><p className="font-semibold">@{giftCreator.username}</p><p className="text-xs text-muted-foreground">{giftCreator.first_name} {giftCreator.last_name}</p></div>
                <button onClick={() => setGiftCreator(null)} className="text-xs underline">Changer</button>
              </div>
            ) : <UserSearchPicker onPick={setGiftCreator} placeholder="Rechercher un créateur (pseudo ou nom)" />}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Durée</p>
              <p className="text-lg font-bold">{giftMonths} mois</p>
            </div>
            <input type="range" min={1} max={24} step={1} value={giftMonths} onChange={(e) => setGiftMonths(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          </div>
          <ActionSlider label="Glissez pour offrir" onConfirm={doGift} disabled={!giftCreator} />
        </div>
      </Modal>

      {/* User stats modal */}
      <Modal open={!!statsFor} onClose={() => setStatsFor(null)} title={`Statistiques @${statsFor?.username ?? ""}`}>
        {!userStats && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {userStats && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Publications" value={userStats.posts} />
            <StatCard label="Abonnés" value={userStats.subscribers} />
            <StatCard label="Abonnements" value={userStats.subscribed_to} />
            <StatCard label="Messages envoyés" value={userStats.messages_sent} />
            <StatCard label="Revenus générés" value={fmt(userStats.revenue_cents)} />
            <StatCard label="Dépensé" value={fmt(userStats.spent_cents)} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
