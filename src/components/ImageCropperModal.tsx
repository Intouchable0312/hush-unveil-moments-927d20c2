import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, Check, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  file: File | null;
  aspect: number;
  onClose: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
  title?: string;
};

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92)
  );
}

export function ImageCropperModal({ open, file, aspect, onClose, onSave, title = "Recadrer" }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Stable object URL per file
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => { setCrop({ x: 0, y: 0 }); setZoom(1); setArea(null); }, [file]);

  const onComplete = useCallback((_: Area, a: Area) => setArea(a), []);

  if (!open || !url) return null;

  const save = async () => {
    if (!url || saving) return;
    try {
      setSaving(true);
      const blob = await getCroppedBlob(url, area ?? { x: 0, y: 0, width: 1024, height: aspect === 1 ? 1024 : Math.round(1024 / aspect) });
      await onSave(blob);
      onClose();
    } catch (e) {
      alert("Impossible d'enregistrer l'image : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary" aria-label="Fermer"><X className="h-5 w-5" /></button>
        <p className="text-sm font-semibold">{title}</p>
        <div className="w-9" />
      </div>
      <div className="relative flex-1 bg-black">
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={aspect === 1 ? "round" : "rect"}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
        />
      </div>
      <div className="space-y-4 border-t border-border bg-background p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--primary)]"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-full border border-border bg-card py-3 text-sm font-semibold disabled:opacity-50">
            Annuler
          </button>
          <button onClick={save} disabled={saving} className="flex-[2] flex items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-60">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</> : <><Check className="h-4 w-4" /> Valider</>}
          </button>
        </div>
      </div>
    </div>
  );
}
