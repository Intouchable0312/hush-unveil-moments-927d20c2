import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/search")({ component: SearchPage });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Creator = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  hashtags: string[] | null;
};

function SearchPage() {
  const { session, ready } = useAuth();
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Creator[]>([]);
  const [top, setTop] = useState<Creator[]>([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => { if (ready && !session) nav({ to: "/auth" as string as any }); }, [ready, session, nav]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 260);
    return () => window.clearTimeout(t);
  }, []);

  // Live results as user types
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const term = q.trim();
      if (!term) { setResults([]); return; }
      const safe = term.replace(/[%,]/g, "");
      const like = `%${safe}%`;
      const { data } = await supabase.from("profiles")
        .select("id,username,avatar_url,hashtags")
        .or(`username.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
        .eq("is_creator", true)
        .limit(24);
      if (!cancelled) setResults((data ?? []) as Creator[]);
    }, 120);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, session]);

  // Top creators (realtime-ish via subscriptions count)
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("profiles")
        .select("id,username,avatar_url,hashtags")
        .eq("is_creator", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (alive) setTop((data ?? []) as Creator[]);
    };
    void load();
    const ch = supabase.channel("search-top-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => void load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [session]);

  const close = () => {
    setClosing(true);
    window.setTimeout(() => nav({ to: "/" as string as any }), 280);
  };

  if (!ready || !session) return null;

  return (
    <div className={`mx-auto flex h-full max-w-lg flex-col px-4 pt-4 pb-6 ${closing ? "animate-search-out" : "animate-search-in"}`}>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2.5 shadow-sm">
        <button onClick={close} aria-label="Retour" className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un créateur…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Effacer" className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Live search results */}
      <div className="mt-5 space-y-1">
        {q.trim() && results.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucun créateur ne correspond à « {q} »
          </p>
        )}
        {results.map((c) => <CreatorRow key={c.id} creator={c} onClose={close} />)}
      </div>

      {/* Divider */}
      <div className="my-6 h-px bg-border" />

      {/* Top creators */}
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Top créatrices en temps réel</p>
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      </div>
      <div className="space-y-1">
        {top.map((c, i) => <CreatorRow key={c.id} creator={c} rank={i + 1} onClose={close} />)}
      </div>
    </div>
  );
}

function CreatorRow({ creator, rank, onClose }: { creator: Creator; rank?: number; onClose: () => void }) {
  return (
    <L
      to={`/u/${creator.username ?? ""}`}
      onClick={onClose}
      className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-secondary"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {creator.avatar_url
          ? <SignedImage path={creator.avatar_url} className="h-full w-full object-cover" />
          : (creator.username?.[0] ?? "?").toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">@{creator.username ?? "—"}</p>
        {creator.hashtags && creator.hashtags.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {creator.hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")}
          </p>
        )}
      </div>
      {rank && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">#{rank}</span>}
    </L>
  );
}
