/**
 * Restores the CTA button in the new_user_invite email template.
 * Run with: node scripts/fix-new-user-invite-button.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

let connUrl = rawUrl;
if (connUrl.includes("sslmode=require") && !connUrl.includes("uselibpqcompat")) {
  connUrl += "&uselibpqcompat=true";
}
const pool = new pg.Pool({ connectionString: connUrl, ssl: { rejectUnauthorized: false } });

const sqlPath = resolve(__dirname, "../supabase/migrations/20260512000000_fix_new_user_invite_button.sql");
const sql = readFileSync(sqlPath, "utf8");

try {
  const result = await pool.query(sql);
  console.log(`✓ new_user_invite button restored. Rows updated: ${result.rowCount ?? "n/a"}`);
} catch (err) {
  console.error("Migration error:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
