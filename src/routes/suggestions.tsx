import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";

export const Route = createFileRoute("/suggestions")({ component: Suggestions });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L: any = Link;

type Creator = { id: string; username: string | null; avatar_url: string | null; bio: string | null; hashtags: string[]; score: number };

function Suggestions() {
  const { profile } = useAuth();
  const [creators, setCreators] = useState<Creator[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("id,username,avatar_url,bio,hashtags").eq("is_creator", true);
      const mine = new Set((profile?.hashtags ?? []).map((h) => h.toLowerCase()));
      const scored: Creator[] = (data ?? []).map((c) => ({
        ...c as Creator,
        score: (c.hashtags ?? []).reduce((n: number, h: string) => n + (mine.has(h.toLowerCase()) ? 1 : 0), 0),
      }));
      scored.sort((a, b) => b.score - a.score);
      setCreators(scored);
    })();
  }, [profile]);

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-6 text-3xl font-bold">Suggestions</h1>
      {creators === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {creators && creators.length === 0 && (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Aucun créateur pour le moment.</div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {creators?.map((c) => (
          <L key={c.id} to={`/u/${c.username ?? ""}`} className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="aspect-square bg-muted">
              {c.avatar_url && <SignedImage path={c.avatar_url} className="h-full w-full object-cover" />}
            </div>
            <div className="p-3">
              <p className="text-sm font-bold truncate">@{c.username}</p>
              {c.hashtags?.length > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground truncate">{c.hashtags.slice(0,3).map(h=>`#${h}`).join(" ")}</p>
              )}
            </div>
          </L>
        ))}
      </div>
    </div>
  );
}
