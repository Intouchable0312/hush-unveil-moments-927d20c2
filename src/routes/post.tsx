import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { Image as ImageIcon, Sparkles, Lock, Coins } from "lucide-react";
import { ActionSlider } from "@/components/ActionSlider";
import { uploadMedia } from "@/lib/media";

export const Route = createFileRoute("/post")({ component: PostPage });

type Kind = "public" | "subscribers" | "ppv";

function PostPage() {
  const { session, profile, refresh } = useAuth();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [kind, setKind] = useState<Kind>("subscribers");
  const [priceCents, setPriceCents] = useState(500);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => { if (session === null) nav({ to: "/auth" as string as any }); }, [session, nav]);

  const onFile = (f: File) => { setFile(f); setPreview(URL.createObjectURL(f)); };

  const publish = async () => {
    if (!file || !session) throw new Error("no file");
    setErr(null);
    setProgress(0);
    try {
      const path = await uploadMedia(file, session.user.id, setProgress, "posts");
      const hashtags = tagsInput.split(/[\s,]+/).map((t) => t.replace(/^#/, "").trim()).filter(Boolean);
      const { error } = await supabase.from("posts").insert({
        creator_id: session.user.id,
        description, hashtags, media_url: path,
        media_type: file.type.startsWith("video") ? "video" : "image",
        visibility: kind,
        ppv_price_cents: kind === "ppv" ? priceCents : 0,
      });
      if (error) throw error;
      if (!profile?.is_creator) {
        await supabase.from("profiles").update({ is_creator: true }).eq("id", session.user.id);
        await refresh();
      }
      nav({ to: "/" as string as any });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setProgress(null);
    }
  };

  const kinds: { id: Kind; icon: typeof Sparkles; title: string; desc: string }[] = [
    { id: "public", icon: Sparkles, title: "Public", desc: "Visible par tous les utilisateurs de Hush." },
    { id: "subscribers", icon: Lock, title: "Abonnés", desc: "Réservé à vos abonnés payants." },
    { id: "ppv", icon: Coins, title: "Payant", desc: "Contenu débloqué à l'unité, prix libre." },
  ];

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-6 text-3xl font-bold">Publier</h1>

      <label className="mb-4 flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card">
        {preview ? <img src={preview} className="h-full w-full object-cover" alt="" /> : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm">Choisir un média</span>
          </div>
        )}
        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      <textarea placeholder="Décrivez votre publication…" className="mb-3 w-full rounded-2xl border border-border bg-card px-4 py-3" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input placeholder="#hashtags (séparés par des espaces)" className="mb-6 w-full rounded-2xl border border-border bg-card px-4 py-3" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visibilité</p>
      <div className="mb-6 space-y-2">
        {kinds.map((k) => {
          const Icon = k.icon;
          const active = kind === k.id;
          return (
            <button
              key={k.id} type="button" onClick={() => setKind(k.id)}
              className={`flex w-full items-center gap-4 rounded-3xl border p-4 text-left transition-all ${active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:bg-secondary"}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold">{k.title}</p>
                <p className="text-xs text-muted-foreground">{k.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {kind === "ppv" && (
        <div className="mb-6 rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Prix</p>
            <p className="text-2xl font-bold tabular-nums">{(priceCents / 100).toFixed(2)} €</p>
          </div>
          <input type="range" min={50} max={10000} step={50} value={priceCents} onChange={(e) => setPriceCents(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>0,50 €</span><span>100 €</span>
          </div>
        </div>
      )}

      {err && <p className="mb-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">{err}</p>}

      {progress !== null && (
        <div className="mb-3 rounded-2xl border border-border bg-card p-3">
          <div className="mb-1 flex justify-between text-xs font-medium">
            <span>Envoi du média…</span><span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-foreground transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <ActionSlider label="Glissez pour publier" onConfirm={publish} disabled={!file || progress !== null} />
    </div>
  );
}
