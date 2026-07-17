import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { Search } from "lucide-react";

export type PickedUser = { id: string; username: string | null; first_name: string | null; last_name: string | null; avatar_url: string | null };

type Props = {
  onPick: (u: PickedUser) => void;
  creatorsOnly?: boolean;
  placeholder?: string;
};

export function UserSearchPicker({ onPick, creatorsOnly, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      let query = supabase.from("profiles")
        .select("id,username,first_name,last_name,avatar_url")
        .or(`username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(10);
      if (creatorsOnly) query = query.eq("is_creator", true);
      const { data } = await query;
      if (!cancel) setResults((data as PickedUser[]) ?? []);
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [q, creatorsOnly]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input autoFocus placeholder={placeholder ?? "Rechercher un utilisateur"} value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 bg-transparent outline-none" />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {results.map((u) => (
          <button key={u.id} onClick={() => onPick(u)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left hover:bg-secondary">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
              {u.avatar_url && <SignedImage path={u.avatar_url} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">@{u.username ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{u.first_name} {u.last_name}</p>
            </div>
          </button>
        ))}
        {q && results.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Aucun résultat</p>}
      </div>
    </div>
  );
}
