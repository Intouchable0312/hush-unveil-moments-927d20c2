import { useEffect, useState } from "react";
import { signedUrl } from "@/lib/media";

export function SignedImage({ path, alt, className, blurred }: { path: string; alt?: string; className?: string; blurred?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let ok = true; signedUrl(path).then((u) => { if (ok) setUrl(u); }); return () => { ok = false; }; }, [path]);
  if (!url) return <div className={`bg-muted animate-pulse ${className ?? ""}`} />;
  return <img src={url} alt={alt ?? ""} className={`${className ?? ""} ${blurred ? "blur-2xl scale-110" : ""}`} draggable={false} />;
}
