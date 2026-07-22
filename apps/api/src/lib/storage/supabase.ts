import { env } from "../../config/env.js";

const storageBaseUrl =
  `${env.SUPABASE_URL.replace(/\/+$/, "")}/storage/v1`;

const storageKey =
  env.SUPABASE_SERVICE_ROLE_KEY.trim();

/**
 * New Supabase keys such as `sb_secret_...` are opaque API keys
 * and must be sent only through the `apikey` header.
 *
 * Legacy `service_role` keys are JWTs, so they also require the
 * Authorization Bearer header.
 */
const adminHeaders: Record<string, string> = {
  apikey: storageKey,
};

if (!storageKey.startsWith("sb_")) {
  adminHeaders.Authorization =
    `Bearer ${storageKey}`;
}

const encodeObjectPath = (value: string): string =>
  value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

async function storageError(
  response: Response,
): Promise<string> {
  const body = await response.text();

  if (!body) {
    return `Supabase Storage request failed (${response.status} ${response.statusText}).`;
  }

  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      error?: unknown;
      error_description?: unknown;
      statusCode?: unknown;
    };

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (typeof parsed.error_description === "string") {
      return parsed.error_description;
    }

    if (typeof parsed.error === "string") {
      return parsed.error;
    }

    return `Supabase Storage request failed (${response.status}): ${body}`;
  } catch {
    return body;
  }
}

function resolveSignedUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${storageBaseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

export async function createSignedResumeUploadUrl(
  storagePath: string,
): Promise<{
  signedUrl: string;
}> {
  const bucket = encodeURIComponent(
    env.SUPABASE_RESUME_BUCKET,
  );

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
    throw new Error(
      await storageError(response),
    );
  }

  const data = (await response.json()) as {
    url?: unknown;
  };

  if (
    typeof data.url !== "string" ||
    data.url.length === 0
  ) {
    throw new Error(
      "Supabase Storage did not return a signed upload URL.",
    );
  }

  const signedUrl = resolveSignedUrl(data.url);

  let parsedSignedUrl: URL;

  try {
    parsedSignedUrl = new URL(signedUrl);
  } catch {
    throw new Error(
      "Supabase Storage returned an invalid signed upload URL.",
    );
  }

  const token =
    parsedSignedUrl.searchParams.get("token");

  if (!token) {
    throw new Error(
      "Supabase Storage did not return an upload token.",
    );
  }

  return {
    signedUrl: parsedSignedUrl.toString(),
  };
}

export async function downloadResumeObject(
  storagePath: string,
): Promise<Buffer> {
  const bucket = encodeURIComponent(
    env.SUPABASE_RESUME_BUCKET,
  );

  const objectPath = encodeObjectPath(storagePath);

  const response = await fetch(
    `${storageBaseUrl}/object/${bucket}/${objectPath}`,
    {
      method: "GET",
      headers: adminHeaders,
    },
  );

  if (!response.ok) {
    throw new Error(
      await storageError(response),
    );
  }

  return Buffer.from(
    await response.arrayBuffer(),
  );
}

export async function removeResumeObject(
  storagePath: string,
): Promise<void> {
  const bucket = encodeURIComponent(
    env.SUPABASE_RESUME_BUCKET,
  );

  const response = await fetch(
    `${storageBaseUrl}/object/${bucket}`,
    {
      method: "DELETE",
      headers: {
        ...adminHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prefixes: [storagePath],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await storageError(response),
    );
  }
}