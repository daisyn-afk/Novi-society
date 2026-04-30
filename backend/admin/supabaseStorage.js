import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "course-covers";

let supabaseClient;
const STORAGE_UPLOAD_MAX_ATTEMPTS = 3;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
    err.statusCode = 500;
    throw err;
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return supabaseClient;
}

export async function uploadCourseCoverImage({ buffer, mimeType, extension }) {
  const client = getSupabaseClient();
  const cleanExt = (extension || "bin").replace(/^\./, "");
  const objectPath = `admin-courses/${Date.now()}-${randomUUID()}.${cleanExt}`;

  const { error: uploadError } = await uploadWithRetry({
    client,
    bucket: SUPABASE_STORAGE_BUCKET,
    objectPath,
    buffer,
    mimeType
  });

  if (uploadError) {
    const err = new Error(`Supabase upload failed: ${uploadError.message}`);
    err.statusCode = 502;
    throw err;
  }

  const { data } = client.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    const err = new Error("Supabase upload succeeded but public URL could not be generated.");
    err.statusCode = 502;
    throw err;
  }

  return {
    bucket: SUPABASE_STORAGE_BUCKET,
    path: objectPath,
    url: data.publicUrl
  };
}

export async function uploadLicenseDocument({ buffer, mimeType, extension }) {
  const client = getSupabaseClient();
  const cleanExt = (extension || "bin").replace(/^\./, "");
  const objectPath = `license-photos/${Date.now()}-${randomUUID()}.${cleanExt}`;

  const { error: uploadError } = await uploadWithRetry({
    client,
    bucket: SUPABASE_STORAGE_BUCKET,
    objectPath,
    buffer,
    mimeType
  });

  if (uploadError) {
    const err = new Error(`Supabase upload failed: ${uploadError.message}`);
    err.statusCode = 502;
    throw err;
  }

  const { data } = client.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    const err = new Error("Supabase upload succeeded but public URL could not be generated.");
    err.statusCode = 502;
    throw err;
  }

  return {
    bucket: SUPABASE_STORAGE_BUCKET,
    path: objectPath,
    url: data.publicUrl
  };
}

async function uploadWithRetry({ client, bucket, objectPath, buffer, mimeType }) {
  let lastError = null;
  for (let attempt = 1; attempt <= STORAGE_UPLOAD_MAX_ATTEMPTS; attempt += 1) {
    const result = await client.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false
      });

    if (!result.error) return result;
    lastError = result.error;

    const isNetworkFetchFailure = String(result.error.message || "").toLowerCase().includes("fetch failed");
    if (!isNetworkFetchFailure || attempt === STORAGE_UPLOAD_MAX_ATTEMPTS) {
      return result;
    }

    // Brief linear backoff for transient storage network failures.
    await new Promise((resolve) => setTimeout(resolve, attempt * 300));
  }
  return { error: lastError };
}
