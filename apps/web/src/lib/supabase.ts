const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_ANON_KEY is required for resume uploads.");
}

export async function uploadResumeToSignedUrl(signedUrl: string, file: File) {
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);

  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "x-upsert": "false",
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Resume upload failed (${response.status}).`);
  }
}
