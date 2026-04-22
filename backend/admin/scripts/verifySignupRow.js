import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { pool } = await import("../db.js");

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/verifySignupRow.js <email>");
  process.exit(2);
}

try {
  const { rows } = await pool.query(
    `select id, auth_user_id, email, first_name, last_name, full_name, role, is_active, created_at
       from public.users
      where email = $1`,
    [email]
  );
  if (!rows.length) {
    console.log(`[verify] No row in public.users for ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`[verify] public.users row for ${email}:`);
    console.log(JSON.stringify(rows[0], null, 2));
  }
} finally {
  await pool.end();
}
