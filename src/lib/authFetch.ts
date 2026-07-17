import { supabase } from "@/integrations/supabase/client";

export async function authFetch(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("content-type") && init.body) headers.set("content-type", "application/json");
  return fetch(url, { ...init, headers });
}
