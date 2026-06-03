#!/usr/bin/env node
/* eslint-disable no-console */
//
// One-shot backfill: encrypt any pre-existing plaintext Google OAuth tokens
// stored in public.provider_google_connections so that the at-rest format
// matches what providerGoogleConnectionRepository now writes.
//
// Idempotent: rows already in the "v1." format are detected by isEncryptedToken
// and skipped. Re-running this script after a successful pass is a no-op.
//
// Usage:
//   node backend/admin/scripts/encryptExistingGoogleTokens.js
//
// Requires DATABASE_URL and TOKEN_ENCRYPTION_KEY in the environment (loaded
// from .env via the same dotenv path the admin API uses).

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { query, end } = await import("../db.js");
const { encryptToken, isEncryptedToken } = await import("../lib/tokenCrypto.js");

async function main() {
  const { rows } = await query(
    `select id, access_token, refresh_token
       from public.provider_google_connections`
  );

  let touched = 0;
  let skipped = 0;
  for (const row of rows) {
    const accessNeeds = row.access_token && !isEncryptedToken(row.access_token);
    const refreshNeeds = row.refresh_token && !isEncryptedToken(row.refresh_token);

    if (!accessNeeds && !refreshNeeds) {
      skipped += 1;
      continue;
    }

    const nextAccess = accessNeeds ? encryptToken(row.access_token) : row.access_token;
    const nextRefresh = refreshNeeds ? encryptToken(row.refresh_token) : row.refresh_token;

    await query(
      `update public.provider_google_connections
         set access_token = $1,
             refresh_token = $2,
             updated_at = now()
       where id = $3`,
      [nextAccess, nextRefresh, row.id]
    );
    touched += 1;
  }

  console.log(
    `[encrypt-tokens] done. encrypted=${touched} skipped=${skipped} total=${rows.length}`
  );
}

try {
  await main();
} catch (err) {
  console.error("[encrypt-tokens] failed:", err?.message || err);
  process.exitCode = 1;
} finally {
  if (typeof end === "function") {
    try { await end(); } catch { /* ignore */ }
  }
}
