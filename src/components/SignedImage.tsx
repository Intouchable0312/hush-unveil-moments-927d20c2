import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/media";

export function SignedImage({ path, alt, className, blurred }: { path: string; alt?: string; className?: string; blurred?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (blurred) { setUrl(null); return; }
    let ok = true;
    signedUrl(path).then((u) => { if (ok) setUrl(u); });
    return () => { ok = false; };
  }, [path, blurred]);
  if (blurred) return <LockedMediaPreview className={className} />;
  if (!url) return <div className={`bg-muted animate-pulse ${className ?? ""}`} />;
  return <img src={url} alt={alt ?? ""} className={className ?? ""} draggable={false} />;
}

function LockedMediaPreview({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-muted ${className ?? ""}`} aria-hidden="true">
      <div className="absolute inset-[-18%] bg-[conic-gradient(from_120deg,var(--color-secondary),var(--color-muted),var(--color-accent),var(--color-secondary))] blur-2xl" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0_18%,var(--color-background)_18%_20%,transparent_20%_38%,var(--color-background)_38%_40%,transparent_40%_100%)] opacity-20" />
      <div className="absolute inset-0 backdrop-blur-2xl" />
      <div className="absolute inset-0 bg-background/25" />
      <div className="absolute left-0 top-0 h-full w-1/3 -translate-x-full skew-x-12 bg-foreground/10 blur-md animate-[shimmer_2.4s_ease-in-out_infinite]" />
    </div>
  );
}
