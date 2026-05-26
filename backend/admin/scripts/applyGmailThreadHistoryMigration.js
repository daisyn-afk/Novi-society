import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { pool } = await import("../db.js");

const migrationPath = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260526120000_provider_rep_gmail_thread_history.sql"
);

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log(`[migrate] Applying ${path.basename(migrationPath)}`);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("[migrate] OK");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(
    "select to_regclass('public.provider_rep_gmail_thread_history') as reg"
  );
  console.log(
    `[migrate] public.provider_rep_gmail_thread_history exists: ${
      rows[0]?.reg ? "yes" : "no"
    }`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED", err?.message || err);
  process.exit(1);
});
