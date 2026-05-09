/**
 * Seeds the real email templates into the email_templates table.
 * Uses DATABASE_URL from the project root .env
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

const sqlPath = resolve(__dirname, "../supabase/migrations/20260509010000_seed_real_email_templates.sql");
const sql = readFileSync(sqlPath, "utf8");

try {
  await pool.query(sql);
  console.log("✓ Real email templates seeded successfully.");
} catch (err) {
  console.error("Migration error:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
