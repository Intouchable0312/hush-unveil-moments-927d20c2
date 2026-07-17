import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({ component: Admin });

function Admin() {
  const { isAdmin, session, ready } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [banReason, setBanReason] = useState<Record<string, string>>({});

  useEffect(() => { if (ready && !isAdmin) nav({ to: "/" as string as any }); }, [ready, isAdmin, nav]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id,username,first_name,last_name,phone,is_creator");
      const { data: bans } = await supabase.from("bans").select("user_id,reason");
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const banMap = new Map((bans ?? []).map((b) => [b.user_id, b.reason]));
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => { const a = roleMap.get(r.user_id) ?? []; a.push(r.role); roleMap.set(r.user_id, a); });
      setUsers((data ?? []).map((u) => ({ ...u, banned: banMap.get(u.id), roles: roleMap.get(u.id) ?? [] })));
    })();
  }, [isAdmin]);

  const ban = async (id: string) => {
    const reason = banReason[id];
    if (!reason) { alert("Raison requise"); return; }
    await supabase.from("bans").insert({ user_id: id, reason, banned_by: session?.user.id });
    setUsers((us) => us.map((u) => u.id === id ? { ...u, banned: reason } : u));
  };

  const unban = async (id: string) => {
    await supabase.from("bans").delete().eq("user_id", id);
    setUsers((us) => us.map((u) => u.id === id ? { ...u, banned: undefined } : u));
  };

  const makeAdmin = async (id: string) => {
    await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    setUsers((us) => us.map((u) => u.id === id ? { ...u, roles: [...u.roles, "admin"] } : u));
  };

  const giftSub = async (fanId: string) => {
    const creatorUsername = prompt("Username du créateur pour l'abonnement gratuit ?");
    if (!creatorUsername) return;
    const { data: c } = await supabase.from("profiles").select("id").eq("username", creatorUsername).maybeSingle();
    if (!c) { alert("Créateur introuvable"); return; }
    const exp = new Date(); exp.setFullYear(exp.getFullYear() + 100);
    const { error } = await supabase.from("subscriptions").upsert({ fan_id: fanId, creator_id: c.id, period: "gift", price_paid_cents: 0, expires_at: exp.toISOString(), active: true });
    if (error) alert(error.message); else alert("Abonnement offert !");
  };

  if (!isAdmin) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="mb-6 text-3xl font-bold">Administration</h1>
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">@{u.username ?? "(sans pseudo)"} {u.roles.includes("admin") && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">ADMIN</span>}</p>
                <p className="text-xs text-muted-foreground">{u.first_name} {u.last_name} · {u.phone}</p>
                {u.banned && <p className="mt-1 text-xs text-destructive">Banni : {u.banned}</p>}
              </div>
              <div className="flex flex-wrap gap-1">
                {!u.roles.includes("admin") && <button onClick={() => makeAdmin(u.id)} className="rounded-full border border-border px-3 py-1 text-xs">+Admin</button>}
                <button onClick={() => giftSub(u.id)} className="rounded-full border border-border px-3 py-1 text-xs">Offrir abo</button>
              </div>
            </div>
            {!u.banned ? (
              <div className="mt-3 flex gap-2">
                <input placeholder="Raison" value={banReason[u.id] ?? ""} onChange={(e) => setBanReason({ ...banReason, [u.id]: e.target.value })} className="flex-1 rounded-full border border-border bg-background px-3 py-1 text-xs" />
                <button onClick={() => ban(u.id)} className="rounded-full bg-destructive px-3 py-1 text-xs text-destructive-foreground">Bannir</button>
              </div>
            ) : (
              <button onClick={() => unban(u.id)} className="mt-3 w-full rounded-full border border-border py-1 text-xs">Débannir</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
