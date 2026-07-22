const rawSupabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY as
    | string
    | undefined;

if (
  typeof rawSupabaseAnonKey !== "string" ||
  rawSupabaseAnonKey.trim().length === 0
) {
  throw new Error(
    "VITE_SUPABASE_ANON_KEY is required for resume uploads.",
  );
}

// Explicit string assignment fixes the TypeScript union type.
const supabaseAnonKey: string =
  rawSupabaseAnonKey.trim();

export async function uploadResumeToSignedUrl(
  signedUrl: string,
  file: File,
): Promise<void> {
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

    throw new Error(
      message ||
        `Resume upload failed (${response.status}).`,
    );
  }
}