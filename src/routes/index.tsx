import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authFetch } from "@/lib/authFetch";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { HushLogo } from "@/components/HushLogo";
import { SignedImage } from "@/components/SignedImage";
import { Heart, Lock, Sparkles } from "lucide-react";
import { PaymentSlider } from "@/components/PaymentSlider";

export const Route = createFileRoute("/")({ component: Home });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Post = {
  id: string; creator_id: string; description: string | null; hashtags: string[];
  media_url: string; visibility: string; ppv_price_cents: number; likes_count: number; created_at: string;
  creator: { username: string | null; avatar_url: string | null } | null;
};

function Home() {
  const { session, ready } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [purchases, setPurchases] = useState<Set<string>>(new Set());

  useEffect(() => { if (ready && !session) nav({ to: "/auth" as string as any }); }, [ready, session, nav]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase.from("posts").select("*, creator:profiles!posts_creator_id_fkey(username,avatar_url)").order("created_at", { ascending: false }).limit(50);
      setPosts((data as unknown as Post[]) ?? []);
      const { data: s } = await supabase.from("subscriptions").select("creator_id").eq("fan_id", session.user.id).eq("active", true);
      setSubs(new Set((s ?? []).map((r) => r.creator_id)));
      const { data: p } = await supabase.from("post_purchases").select("post_id").eq("buyer_id", session.user.id);
      setPurchases(new Set((p ?? []).map((r) => r.post_id)));
    })();
  }, [session]);

  if (!ready || !session) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="h-8 w-24 text-foreground"><HushLogo className="h-full w-full" /></div>
        <L to="/suggestions" className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" /> Suggestions
        </L>
      </header>

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
          const isPublic = p.visibility === "public";
          const isPPV = p.visibility === "ppv";
          const locked = !isPublic && !subscribed;
          const ppvLocked = isPPV && !purchased && p.creator_id !== session.user.id;
          return <PostCard key={p.id} post={p} locked={locked} ppvLocked={ppvLocked} onUnlock={() => setPurchases(new Set([...purchases, p.id]))} />;
        })}
      </div>
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
