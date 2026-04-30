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
  "../../../supabase/migrations/20260430122000_certification_provider_submission_fields.sql"
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

  const { rows: cols } = await pool.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public' and table_name = 'certification'
      order by ordinal_position`
  );
  console.log("[migrate] public.certification columns:");
  for (const c of cols) console.log(`  - ${c.column_name}`);

  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  pool.end().finally(() => process.exit(1));
});

