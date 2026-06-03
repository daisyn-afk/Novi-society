import crypto from "node:crypto";

// AES-256-GCM application-level encryption for OAuth tokens at rest.
//
// Stored format: "v1.<iv-base64>.<ciphertext-base64>.<authTag-base64>"
// The "v1." prefix is reserved so a future key rotation can be detected and
// rewrapped without breaking existing rows.
//
// Operational notes:
//   - TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded.
//     Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//   - Loss of the key makes all stored tokens unreadable. Back it up the same
//     way you back up other production secrets.
//   - decryptToken() returns plaintext untouched when the value does not start
//     with "v1.", so this helper is safe to deploy *before* the backfill runs.

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_BYTES = 12; // GCM standard nonce length.

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  const b64 = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!b64) {
    const err = new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Generate one with " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
    err.statusCode = 503;
    throw err;
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    const err = new Error(
      `TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`
    );
    err.statusCode = 503;
    throw err;
  }
  cachedKey = key;
  return key;
}

export function isEncryptedToken(value) {
  return typeof value === "string" && value.startsWith(`${FORMAT_VERSION}.`);
}

export function encryptToken(plaintext) {
  if (plaintext == null) return plaintext;
  const text = String(plaintext);
  if (text === "") return text;
  if (isEncryptedToken(text)) return text;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, loadKey(), iv);
  const ct = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(".");
}

export function decryptToken(value) {
  if (value == null) return value;
  const text = String(value);
  if (text === "") return text;
  if (!isEncryptedToken(text)) {
    // Plaintext (pre-migration) — pass through. The backfill script rewrites
    // these in-place; once it has run on every row this branch is unreachable.
    return text;
  }

  const parts = text.split(".");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted token: expected 4 dot-separated segments.");
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, loadKey(), iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch (error) {
    // Wrong key, corrupted ciphertext, or post-rotation stale row — unusable token.
    // Callers treat empty string as disconnected; provider can re-authorize Google.
    // eslint-disable-next-line no-console
    console.warn("[tokenCrypto] decrypt failed:", error?.message || error);
    return "";
  }
}
