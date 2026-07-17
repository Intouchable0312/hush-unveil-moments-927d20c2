import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/routes/index";

export const Route = createFileRoute("/subscriptions")({ component: Subs });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

async function attachCreators(rows: Post[]) {
  const creatorIds = [...new Set(rows.map((row) => row.creator_id).filter(Boolean))];
  if (creatorIds.length === 0) return rows.map((row) => ({ ...row, creator: null }));

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,username,avatar_url")
    .in("id", creatorIds);

  const profilesById = new Map((profiles ?? []).map((creator) => [creator.id, creator]));
  return rows.map((row) => {
    const creator = profilesById.get(row.creator_id);
    return { ...row, creator: creator ? { username: creator.username, avatar_url: creator.avatar_url } : null };
  });
}

function Subs() {
  const { session } = useAuth();
  const [posts, setPosts] = useState<unknown[] | null>(null);
  const [purchases, setPurchases] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: subs } = await supabase.from("subscriptions").select("creator_id").eq("fan_id", session.user.id).eq("active", true);
      const ids = (subs ?? []).map((s) => s.creator_id);
      if (ids.length === 0) { setPosts([]); return; }
      const { data } = await supabase.from("posts").select("*").in("creator_id", ids).order("created_at", { ascending: false });
      setPosts(await attachCreators(data ?? []));
      const { data: p } = await supabase.from("post_purchases").select("post_id").eq("buyer_id", session.user.id);
      setPurchases(new Set((p ?? []).map((r) => r.post_id)));
    })();
  }, [session]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-6 text-3xl font-bold">Abonnements</h1>
      {posts === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {posts && posts.length === 0 && (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Vous ne suivez encore aucun créateur.</div>
      )}
      <div className="space-y-6">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(posts ?? []).map((p: any) => (
          <PostCard key={p.id} post={p} locked={false} ppvLocked={p.visibility === "ppv" && !purchases.has(p.id) && p.creator_id !== session?.user.id} onUnlock={() => setPurchases(new Set([...purchases, p.id]))} />
        ))}
      </div>
    </div>
  );
}
