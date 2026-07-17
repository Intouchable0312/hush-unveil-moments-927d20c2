import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  hashtags: string[];
  theme: "light" | "dark";
  allow_fan_photos: boolean;
  is_creator: boolean;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  ban: { reason: string } | null;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  session: null, user: null, profile: null, isAdmin: false, ban: null, ready: false,
  refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ban, setBan] = useState<{ reason: string } | null>(null);
  const [ready, setReady] = useState(false);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: roles }, { data: b }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("bans").select("reason").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile(p as Profile | null);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    setBan(b ? { reason: b.reason } : null);
    if (p?.theme) {
      document.documentElement.classList.toggle("dark", p.theme === "dark");
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null); setIsAdmin(false); setBan(null);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Realtime ban listener
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`ban-${session.user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bans", filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const row = payload.new as { reason: string };
          setBan({ reason: row.reason });
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bans", filter: `user_id=eq.${session.user.id}` },
        () => setBan(null))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const value: Ctx = {
    session, user: session?.user ?? null, profile, isAdmin, ban, ready,
    refresh: async () => { if (session) await loadProfile(session.user.id); },
    signOut: async () => { await supabase.auth.signOut(); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
