import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expires > now) return cached.url;
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 3600);
  if (error || !data) {
    if (error) console.warn("[media] signedUrl failed for", path, error.message);
    return null;
  }
  cache.set(path, { url: data.signedUrl, expires: now + 3500_000 });
  return data.signedUrl;
}

/**
 * Upload media with real-time progress via XHR (Supabase storage REST).
 * Falls back to the SDK if something goes wrong.
 */
export async function uploadMedia(
  file: File,
  userId: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/media/${path}`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  if (!token) throw new Error("Non authentifié");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    if (file.type) xhr.setRequestHeader("content-type", file.type);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); }
      else reject(new Error(`Upload ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload"));
    xhr.send(file);
  });

  return path;
}
