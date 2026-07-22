import { env } from "../../config/env.js";

const storageBaseUrl = `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;

const adminHeaders = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
};

const encodeObjectPath = (value: string) =>
  value
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

async function storageError(response: Response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message || parsed.error || `Supabase Storage request failed (${response.status}).`;
  } catch {
    return body || `Supabase Storage request failed (${response.status}).`;
  }
}

export async function createSignedResumeUploadUrl(storagePath: string) {
  const bucket = encodeURIComponent(env.SUPABASE_RESUME_BUCKET);
  const objectPath = encodeObjectPath(storagePath);
  const response = await fetch(
    `${storageBaseUrl}/object/upload/sign/${bucket}/${objectPath}`,
    {
      method: "POST",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    throw new Error(await storageError(response));
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Supabase Storage did not return a signed upload URL.");
  }

  const signedUrl = data.url.startsWith("http")
    ? data.url
    : `${storageBaseUrl}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
  const token = new URL(signedUrl).searchParams.get("token");
  if (!token) {
    throw new Error("Supabase Storage did not return an upload token.");
  }

  return { signedUrl };
}

export async function downloadResumeObject(storagePath: string) {
  const bucket = encodeURIComponent(env.SUPABASE_RESUME_BUCKET);
  const objectPath = encodeObjectPath(storagePath);
  const response = await fetch(`${storageBaseUrl}/object/${bucket}/${objectPath}`, {
    headers: adminHeaders,
  });

  if (!response.ok) {
    throw new Error(await storageError(response));
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function removeResumeObject(storagePath: string) {
  const bucket = encodeURIComponent(env.SUPABASE_RESUME_BUCKET);
  const response = await fetch(`${storageBaseUrl}/object/${bucket}`, {
    method: "DELETE",
    headers: {
      ...adminHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });

  if (!response.ok) {
    throw new Error(await storageError(response));
  }
}
