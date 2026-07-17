import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HushLogo } from "@/components/HushLogo";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { session, ready } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && session) nav({ to: "/" as string as any }); }, [ready, session, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: {
            data: { first_name: form.first_name, last_name: form.last_name, phone: form.phone },
            emailRedirectTo: undefined,
          },
        });
        if (error) throw error;
        // Auto sign in (email auto-confirmed)
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
      }
      nav({ to: "/" as string as any });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mx-auto mb-10 h-14 w-48 text-foreground"><HushLogo className="h-full w-full" /></div>
      <div className="flex mb-6 rounded-full bg-secondary p-1">
        <button className={`flex-1 rounded-full py-2 text-sm font-semibold ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => setMode("login")}>Connexion</button>
        <button className={`flex-1 rounded-full py-2 text-sm font-semibold ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`} onClick={() => setMode("signup")}>Inscription</button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <>
            <input required placeholder="Prénom" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input required placeholder="Nom" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <input required placeholder="Téléphone" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </>
        )}
        <input required type="email" placeholder="Email" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required type="password" placeholder="Mot de passe" minLength={6} className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}
