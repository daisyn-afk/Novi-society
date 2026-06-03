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
  "../../../supabase/migrations/20260521120000_manufacturers.sql"
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

  for (const table of ["manufacturers", "manufacturer_applications"]) {
    const { rows } = await pool.query(
      "select to_regclass($1) as reg",
      [`public.${table}`]
    );
    console.log(`[migrate] public.${table} exists: ${rows[0]?.reg ? "yes" : "no"}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  pool.end().finally(() => process.exit(1));
});
