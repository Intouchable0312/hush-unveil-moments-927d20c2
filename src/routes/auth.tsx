import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput } from "@/components/PhoneInput";
import { ActionSlider } from "@/components/ActionSlider";
import { isValidPhoneNumber } from "libphonenumber-js";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const { session, ready } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (ready && session) nav({ to: "/" as string as any }); }, [ready, session, nav]);

  const canSubmit = () => {
    if (!form.email || !form.password || form.password.length < 6) return false;
    if (mode === "signup") {
      if (!form.first_name || !form.last_name) return false;
      if (!form.phone || !isValidPhoneNumber(form.phone)) return false;
    }
    return true;
  };

  const submit = async () => {
    setErr(null);
    if (!canSubmit()) { setErr("Vérifiez vos informations."); throw new Error("invalid"); }
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { first_name: form.first_name, last_name: form.last_name, phone: form.phone }, emailRedirectTo: undefined },
        });
        if (error) throw error;
        const { error: e2 } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
      }
      nav({ to: "/" as string as any });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 pt-40 pb-10">
        <p className="mb-10 text-center text-xs uppercase tracking-[0.4em] text-muted-foreground animate-auth-rise" style={{ animationDelay: "0.1s" }}>
          {mode === "login" ? "Bon retour" : "Bienvenue"}
        </p>

        <div className="mb-6 flex rounded-full border border-border bg-card/50 p-1 backdrop-blur animate-auth-rise" style={{ animationDelay: "0.2s" }}>
          <button className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${mode === "login" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setMode("login")}>Connexion</button>
          <button className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${mode === "signup" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`} onClick={() => setMode("signup")}>Créer un compte</button>
        </div>

        <div className="space-y-3 animate-auth-rise" style={{ animationDelay: "0.3s" }}>
          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Prénom" className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <input required placeholder="Nom" className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          )}
          {mode === "signup" && (
            <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          )}
          <input required type="email" placeholder="Email" className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required type="password" placeholder="Mot de passe (6+ caractères)" minLength={6} className="w-full rounded-2xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {err && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">{err}</p>}
        </div>

        <div className="mt-6 animate-auth-rise" style={{ animationDelay: "0.4s" }}>
          <ActionSlider
            label={mode === "login" ? "Glissez pour vous connecter" : "Glissez pour créer votre compte"}
            onConfirm={submit}
            disabled={!canSubmit()}
          />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            En continuant, vous acceptez les conditions d'utilisation de Hush.
          </p>
        </div>
      </div>
    </div>
  );
}
