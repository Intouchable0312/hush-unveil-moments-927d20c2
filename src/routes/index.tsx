import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HushLogo } from "@/components/HushLogo";
import { SignedImage } from "@/components/SignedImage";
import { Heart, Lock, Sparkles, ChevronDown, Search, X } from "lucide-react";
import { PaymentSlider } from "@/components/PaymentSlider";

export const Route = createFileRoute("/")({ component: Home });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Post = {
  id: string; creator_id: string; description: string | null; hashtags: string[];
  media_url: string; visibility: string; ppv_price_cents: number; likes_count: number; created_at: string;
  creator: { username: string | null; avatar_url: string | null } | null;
};

type Creator = { id: string; username: string | null; avatar_url: string | null; hashtags: string[]; score: number };

const FEED_PAGE_SIZE = 12;

async function attachCreators(rows: Omit<Post, "creator">[]): Promise<Post[]> {
  const creatorIds = [...new Set(rows.map((row) => row.creator_id).filter(Boolean))];
  if (creatorIds.length === 0) return rows.map((row) => ({ ...row, creator: null }));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,avatar_url")
    .in("id", creatorIds);

  const profilesById = new Map((profiles ?? []).map((creator) => [creator.id, creator]));
  return rows.map((row) => {
    const creator = profilesById.get(row.creator_id);
    return {
      ...row,
      creator: creator ? { username: creator.username, avatar_url: creator.avatar_url } : null,
    };
  });
}

async function fetchFeedPage(from: number) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, from + FEED_PAGE_SIZE - 1);

  if (error) throw error;
  const rows = (data ?? []) as Omit<Post, "creator">[];
  return { posts: await attachCreators(rows), hasMore: rows.length === FEED_PAGE_SIZE };
}

function Home() {
  const { session, profile, ready } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [purchases, setPurchases] = useState<Set<string>>(new Set());
  const [creators, setCreators] = useState<Creator[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<Creator[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef(0);
  const loadingPageRef = useRef(false);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedLoadIdRef = useRef(0);
  const userId = session?.user.id;

  useEffect(() => { if (ready && !session) nav({ to: "/auth" as string as any }); }, [ready, session, nav]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const loadId = ++feedLoadIdRef.current;
    (async () => {
      setPosts(null);
      setHasMore(true);
      cursorRef.current = 0;
      try {
        const [firstPage, subsResult, purchasesResult] = await Promise.all([
          fetchFeedPage(0),
          supabase.from("subscriptions").select("creator_id").eq("fan_id", userId).eq("active", true),
          supabase.from("post_purchases").select("post_id").eq("buyer_id", userId),
        ]);
        if (!alive || feedLoadIdRef.current !== loadId) return;
        setPosts(firstPage.posts);
        setHasMore(firstPage.hasMore);
        cursorRef.current = firstPage.posts.length;
        setSubs(new Set((subsResult.data ?? []).map((r) => r.creator_id)));
        setPurchases(new Set((purchasesResult.data ?? []).map((r) => r.post_id)));
      } catch (error) {
        console.error("Impossible de charger le feed", error);
        if (alive && feedLoadIdRef.current === loadId) setPosts([]);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data: cs } = await supabase.from("profiles").select("id,username,avatar_url,hashtags").eq("is_creator", true).neq("id", userId).limit(30);
      if (!alive) return;
      const mine = new Set((profile?.hashtags ?? []).map((h) => h.toLowerCase()));
      const scored: Creator[] = (cs ?? []).map((c) => ({
        ...c as Creator,
        score: (c.hashtags ?? []).reduce((n: number, h: string) => n + (mine.has(h.toLowerCase()) ? 1 : 0), 0),
      }));
      scored.sort((a, b) => b.score - a.score);
      setCreators(scored.slice(0, 12));
    })();
    return () => { alive = false; };
  }, [userId, profile]);

  const loadMorePosts = useCallback(async () => {
    if (!userId || loadingPageRef.current || !hasMore) return;
    loadingPageRef.current = true;
    setLoadingMore(true);
    try {
      const from = cursorRef.current;
      const page = await fetchFeedPage(from);
      setPosts((prev) => {
        const existing = new Set((prev ?? []).map((post) => post.id));
        return [...(prev ?? []), ...page.posts.filter((post) => !existing.has(post.id))];
      });
      cursorRef.current = from + page.posts.length;
      setHasMore(page.hasMore);
    } catch (error) {
      console.error("Impossible de charger les anciennes publications", error);
    } finally {
      setLoadingMore(false);
      loadingPageRef.current = false;
    }
  }, [hasMore, userId]);

  useEffect(() => {
    const node = feedEndRef.current;
    if (!node || !userId || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) void loadMorePosts(); },
      { rootMargin: "800px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMorePosts, posts?.length, userId]);

  // Realtime: prepend new posts as they are created
  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel("home-posts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const [post] = await attachCreators([payload.new as Omit<Post, "creator">]);
        setPosts((prev) => {
          if (!prev || prev.some((p) => p.id === post.id)) return prev;
          cursorRef.current += 1;
          return [post, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, async (payload) => {
        const [post] = await attachCreators([payload.new as Omit<Post, "creator">]);
        setPosts((prev) => prev ? prev.map((p) => (p.id === post.id ? post : p)) : prev);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        const row = payload.old as { id: string };
        setPosts((prev) => {
          if (!prev?.some((p) => p.id === row.id)) return prev;
          cursorRef.current = Math.max(0, cursorRef.current - 1);
          return prev.filter((p) => p.id !== row.id);
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_purchases", filter: `buyer_id=eq.${userId}` }, (payload) => {
        setPurchases((prev) => new Set([...prev, (payload.new as { post_id: string }).post_id]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `fan_id=eq.${userId}` }, async () => {
        const { data: s } = await supabase.from("subscriptions").select("creator_id").eq("fan_id", userId).eq("active", true);
        setSubs(new Set((s ?? []).map((r) => r.creator_id)));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  if (!ready || !session) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="h-8 w-24 text-foreground"><HushLogo className="h-full w-full" /></div>
        <button
          onClick={() => setShowSuggest((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold ${showSuggest ? "bg-primary text-primary-foreground" : "bg-card"}`}
          aria-expanded={showSuggest}
        >
          <Sparkles className="h-3.5 w-3.5" /> Suggestions
          <ChevronDown className={`h-3 w-3 transition-transform ${showSuggest ? "rotate-180" : ""}`} />
        </button>
      </header>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={async (e) => {
            const v = e.target.value; setQ(v);
            if (!v.trim()) { setSearchResults(null); return; }
            const like = `%${v.trim()}%`;
            const { data } = await supabase.from("profiles")
              .select("id,username,avatar_url,hashtags")
              .or(`username.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
              .eq("is_creator", true)
              .limit(20);
            setSearchResults(((data ?? []) as Creator[]).map((c) => ({ ...c, score: 0 })));
          }}
          placeholder="Rechercher un créateur…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        {q && <button onClick={() => { setQ(""); setSearchResults(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>}
      </div>

      {searchResults && (
        <div className="mb-6 rounded-3xl border border-border bg-card p-3">
          {searchResults.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Aucun créateur trouvé</p>
          ) : (
            <div className="space-y-1">
              {searchResults.map((c) => (
                <L key={c.id} to={`/u/${c.username ?? ""}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {c.avatar_url && <SignedImage path={c.avatar_url} className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">@{c.username ?? "—"}</p>
                    {c.hashtags?.length > 0 && <p className="truncate text-xs text-muted-foreground">{c.hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")}</p>}
                  </div>
                </L>
              ))}
            </div>
          )}
        </div>
      )}

      {showSuggest && (
        <div className="mb-6 rounded-3xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Créateurs pour vous</p>
          {creators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun créateur à suggérer pour l'instant.</p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {creators.map((c) => (
                <L key={c.id} to={`/u/${c.username ?? ""}`} className="shrink-0 text-center">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                    {c.avatar_url && <SignedImage path={c.avatar_url} className="h-full w-full object-cover" />}
                  </div>
                  <p className="mt-1 max-w-[4.5rem] truncate text-[11px] font-semibold">@{c.username}</p>
                </L>
              ))}
            </div>
          )}
        </div>
      )}

      {posts === null && <div className="py-16 text-center text-sm text-muted-foreground">Chargement…</div>}
      {posts && posts.length === 0 && (
        <div className="rounded-3xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Aucun créateur n'a encore publié.</p>
          <L to="/post" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Poster le premier média</L>
        </div>
      )}

      <div className="space-y-6">
        {posts?.map((p) => {
          const subscribed = subs.has(p.creator_id) || p.creator_id === session.user.id;
          const purchased = purchases.has(p.id);
          const isPPV = p.visibility === "ppv";
          const locked = p.visibility === "subscribers" && !subscribed;
          const ppvLocked = isPPV && !purchased && p.creator_id !== session.user.id;
          return <PostCard key={p.id} post={p} locked={locked} ppvLocked={ppvLocked} onUnlock={() => setPurchases(new Set([...purchases, p.id]))} />;
        })}
      </div>
      {posts && posts.length > 0 && (
        <div ref={feedEndRef} className="py-8 text-center text-xs font-medium text-muted-foreground">
          {loadingMore ? "Chargement des anciennes publications…" : hasMore ? "" : "Vous avez vu toutes les publications."}
        </div>
      )}
    </div>
  );
}

export function PostCard({ post, locked, ppvLocked, onUnlock }: { post: Post; locked: boolean; ppvLocked: boolean; onUnlock?: () => void }) {
  const { session } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count);

  useEffect(() => {
    if (!session) return;
    supabase.from("post_likes").select("*").eq("post_id", post.id).eq("user_id", session.user.id).maybeSingle().then(({ data }) => setLiked(!!data));
  }, [post.id, session]);

  const toggleLike = async () => {
    if (!session) return;
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", session.user.id);
      setLiked(false); setLikes((l) => Math.max(0, l - 1));
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: session.user.id });
      setLiked(true); setLikes((l) => l + 1);
    }
  };

  const buy = async () => {
    const res = await authFetch("/api/public/stripe-checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "post", post_id: post.id }),
    });
    const j = await res.json() as { url?: string; error?: string };
    if (j.url) window.location.href = j.url;
    else alert(j.error ?? "Erreur");
  };

  const showMedia = !locked && !ppvLocked;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <L to={`/u/${post.creator?.username ?? ""}`} params={{ username: post.creator?.username ?? "" }} className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
            {post.creator?.avatar_url && <SignedImage path={post.creator.avatar_url} className="h-full w-full object-cover" />}
          </div>
          <div>
            <p className="text-sm font-bold">@{post.creator?.username ?? "créateur"}</p>
            <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString("fr")}</p>
          </div>
        </L>
      </header>
      <div className="relative aspect-square bg-muted">
        <SignedImage path={post.media_url} className="h-full w-full object-cover" blurred={!showMedia} />
        {!showMedia && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40">
            <div className="rounded-full bg-primary/90 p-4 text-primary-foreground"><Lock className="h-6 w-6" /></div>
            {locked && <p className="text-sm font-semibold text-foreground">Abonnez-vous pour débloquer</p>}
            {ppvLocked && (
              <div className="w-64">
                <p className="mb-2 text-center text-sm font-semibold">Contenu premium — {(post.ppv_price_cents / 100).toFixed(2)}€</p>
                <PaymentSlider label={`Payer ${(post.ppv_price_cents / 100).toFixed(2)}€`} onConfirm={async () => { await buy(); onUnlock?.(); }} />
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="p-4">
        <div className="flex items-center gap-3">
          <button onClick={toggleLike} className="flex items-center gap-1 text-sm font-semibold">
            <Heart className={`h-5 w-5 ${liked ? "fill-destructive text-destructive" : ""}`} /> {likes}
          </button>
        </div>
        {post.description && <p className="mt-2 text-sm">{post.description}</p>}
        {post.hashtags?.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
      </footer>
    </article>
  );
}
