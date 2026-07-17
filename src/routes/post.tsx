import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { uploadMedia } from "@/lib/media";

export const Route = createFileRoute("/post")({ component: PostPage });

function PostPage() {
  const { session, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [visibility, setVisibility] = useState<"public" | "subscribers" | "ppv">("subscribers");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (session === null) nav({ to: "/auth" as string as any }); }, [session, nav]);

  const onFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !session) return;
    setBusy(true); setErr(null);
    try {
      const path = await uploadMedia(file, session.user.id);
      const hashtags = tagsInput.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
      const { error } = await supabase.from("posts").insert({
        creator_id: session.user.id,
        description, hashtags, media_url: path,
        media_type: file.type.startsWith("video") ? "video" : "image",
        visibility,
        ppv_price_cents: visibility === "ppv" ? Math.round(Number(price) * 100) : 0,
      });
      if (error) throw error;
      // Mark user as creator on first post
      if (!profile?.is_creator) {
        await supabase.from("profiles").update({ is_creator: true }).eq("id", session.user.id);
        await refresh();
      }
      nav({ to: "/" as string as any });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-6 text-3xl font-bold">Publier</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card">
          {preview ? <img src={preview} className="h-full w-full object-cover" alt="" /> : <span className="text-sm text-muted-foreground">Choisir une photo (galerie ou appareil)</span>}
          <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        <textarea placeholder="Description" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input placeholder="#tags (séparés par des espaces)" className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
        <div className="flex gap-2">
          {(["public", "subscribers", "ppv"] as const).map((v) => (
            <button type="button" key={v} onClick={() => setVisibility(v)} className={`flex-1 rounded-full py-2 text-xs font-semibold ${visibility === v ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
              {v === "public" ? "Public" : v === "subscribers" ? "Abonnés" : "Payant"}
            </button>
          ))}
        </div>
        {visibility === "ppv" && (
          <input type="number" min="0.5" step="0.5" placeholder="Prix en €" required className="w-full rounded-2xl border border-border bg-card px-4 py-3" value={price} onChange={(e) => setPrice(e.target.value)} />
        )}
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={!file || busy} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Publication…" : "Publier"}</button>
      </form>
    </div>
  );
}
