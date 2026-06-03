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
  "../../../supabase/migrations/20260522000000_add_staff_role_permissions.sql"
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
    `select column_name, data_type
       from information_schema.columns
      where table_schema = 'public' and table_name = 'users'
      order by ordinal_position`
  );
  console.log("[migrate] public.users columns:");
  for (const c of cols) console.log(`  - ${c.column_name} (${c.data_type})`);

  const { rows: constraints } = await pool.query(
    `select pg_get_constraintdef(oid) as def
       from pg_constraint
      where conrelid = 'public.users'::regclass
        and contype = 'c'
        and conname = 'users_role_check'`
  );
  console.log("[migrate] role CHECK constraint:", constraints[0]?.def || "not found");

  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  pool.end().finally(() => process.exit(1));
});
