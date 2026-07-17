import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Search, ShieldPlus, Gift, ShieldOff } from "lucide-react";
import { Modal } from "@/components/Modal";
import { UserSearchPicker, type PickedUser } from "@/components/UserSearchPicker";
import { ActionSlider } from "@/components/ActionSlider";

export const Route = createFileRoute("/admin")({ component: Admin });

type Row = { id: string; username: string | null; first_name: string | null; last_name: string | null; phone: string | null; is_creator: boolean; banned?: string; roles: string[] };

function Admin() {
  const { isAdmin, session, ready } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [banFor, setBanFor] = useState<Row | null>(null);
  const [banReason, setBanReason] = useState("");
  const [giftFor, setGiftFor] = useState<Row | null>(null);
  const [giftCreator, setGiftCreator] = useState<PickedUser | null>(null);
  const [giftMonths, setGiftMonths] = useState(1);

  useEffect(() => { if (ready && !isAdmin) nav({ to: "/" as string as any }); }, [ready, isAdmin, nav]);

  const reload = async () => {
    const [{ data }, { data: bans }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,username,first_name,last_name,phone,is_creator"),
      supabase.from("bans").select("user_id,reason"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const banMap = new Map((bans ?? []).map((b) => [b.user_id, b.reason]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => { const a = roleMap.get(r.user_id) ?? []; a.push(r.role); roleMap.set(r.user_id, a); });
    setUsers((data ?? []).map((u) => ({ ...u, banned: banMap.get(u.id), roles: roleMap.get(u.id) ?? [] })));
  };

  useEffect(() => { if (isAdmin) reload(); }, [isAdmin]);

  // Realtime — refresh on any admin-relevant change
  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bans" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAdmin]);

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

  const doGift = async () => {
    if (!giftFor || !giftCreator) throw new Error("Sélection incomplète");
    const exp = new Date();
    exp.setMonth(exp.getMonth() + giftMonths);
    const { error } = await supabase.from("subscriptions").upsert({
      fan_id: giftFor.id, creator_id: giftCreator.id, period: "gift",
      price_paid_cents: 0, expires_at: exp.toISOString(), active: true,
    });
    if (error) throw error;
    setGiftFor(null); setGiftCreator(null); setGiftMonths(1);
  };

  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="mb-4 text-3xl font-bold">Administration</h1>

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
                  <p className="flex items-center gap-2 font-bold">
                    @{u.username ?? "(sans pseudo)"}
                    {isAdm && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">ADMIN</span>}
                    {u.is_creator && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">CRÉATEUR</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{u.first_name} {u.last_name} · {u.phone}</p>
                  {u.banned && <p className="mt-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Banni : {u.banned}</p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
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

      {/* Ban modal */}
      <Modal open={!!banFor} onClose={() => setBanFor(null)} title={`Bannir @${banFor?.username ?? ""}`}>
        <textarea autoFocus placeholder="Raison du bannissement (affichée à l'utilisateur)" rows={4} className="mb-4 w-full rounded-2xl border border-border bg-background px-4 py-3" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
        <ActionSlider label="Glissez pour bannir" variant="destructive" onConfirm={doBan} disabled={!banReason.trim()} />
      </Modal>

      {/* Gift subscription modal */}
      <Modal open={!!giftFor} onClose={() => { setGiftFor(null); setGiftCreator(null); }} title={`Offrir un abonnement à @${giftFor?.username ?? ""}`}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Créateur</p>
            {giftCreator ? (
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-3">
                <div>
                  <p className="font-semibold">@{giftCreator.username}</p>
                  <p className="text-xs text-muted-foreground">{giftCreator.first_name} {giftCreator.last_name}</p>
                </div>
                <button onClick={() => setGiftCreator(null)} className="text-xs underline">Changer</button>
              </div>
            ) : (
              <UserSearchPicker onPick={setGiftCreator} placeholder="Rechercher un créateur (pseudo ou nom)" />
            )}
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
    </div>
  );
}
