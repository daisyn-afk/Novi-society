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
  "../../../supabase/migrations/20260531120000_email_templates_legacy_fix.sql"
);

async function main() {
  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log(`[migrate] Applying ${path.basename(migrationPath)}`);

  console.log("[migrate] Columns before:");
  const before = await pool.query(
    `select column_name, is_nullable, column_default
       from information_schema.columns
      where table_schema = 'public' and table_name = 'email_templates'
      order by ordinal_position`
  );
  for (const c of before.rows) {
    console.log(`  - ${c.column_name} (nullable=${c.is_nullable}, default=${c.column_default ?? "none"})`);
  }

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

  console.log("[migrate] Columns after:");
  const after = await pool.query(
    `select column_name, is_nullable
       from information_schema.columns
      where table_schema = 'public' and table_name = 'email_templates'
      order by ordinal_position`
  );
  for (const c of after.rows) {
    console.log(`  - ${c.column_name} (nullable=${c.is_nullable})`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  pool.end().finally(() => process.exit(1));
});
