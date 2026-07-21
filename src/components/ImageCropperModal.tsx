import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  file: File | null;
  aspect: number; // 1 for avatar, 3 for banner
  onClose: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
  title?: string;
};

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.92));
}

export function ImageCropperModal({ open, file, aspect, onClose, onSave, title = "Recadrer" }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const url = file ? URL.createObjectURL(file) : null;

  const onComplete = useCallback((_: Area, a: Area) => setArea(a), []);

  if (!open || !url) return null;

  const save = async () => {
    if (!area || !url) return;
    const blob = await getCroppedBlob(url, area);
    await onSave(blob);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button onClick={onClose} className="rounded-full p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
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
        <ActionSlider label="Glissez pour enregistrer" onConfirm={save} />
      </div>
    </div>
  );
}
