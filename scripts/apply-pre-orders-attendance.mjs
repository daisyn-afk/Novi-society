/**
 * Applies supabase/migrations/20260507100000_pre_orders_attendance.sql
 * using DATABASE_URL from the project root .env (same as admin API).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");

dotenv.config({ path: resolve(root, ".env") });

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  console.error("DATABASE_URL is not set in .env. Add it (or use Supabase env vars with the admin API), then run:");
  console.error("  npm run db:apply:pre-orders-attendance");
  process.exit(1);
}

const hostMatch = rawUrl.match(/@([^/?:]+)/);
const host = (hostMatch?.[1] || "").toLowerCase();
const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";

// Strip sslmode so Node pg does not force verify-full over our ssl settings (avoids SELF_SIGNED_CERT_IN_CHAIN on many hosts).
const connectionString = rawUrl.replace(/([?&])sslmode=[^&]*/gi, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");

const sqlPath = resolve(root, "supabase/migrations/20260507100000_pre_orders_attendance.sql");
const sql = readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({
  connectionString,
  ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
});

try {
  await pool.query(sql);
  console.log("Applied:", sqlPath);
} finally {
  await pool.end();
}
