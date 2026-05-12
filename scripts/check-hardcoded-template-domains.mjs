import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const rawUrl = String(process.env.DATABASE_URL || "").trim();
if (!rawUrl) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const connUrl =
  rawUrl.includes("sslmode=require") && !rawUrl.includes("uselibpqcompat")
    ? `${rawUrl}&uselibpqcompat=true`
    : rawUrl;

const pool = new pg.Pool({
  connectionString: connUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  const { rows } = await pool.query(
    `select id, trigger, name
     from public.email_templates
     where coalesce(body_html, '') ilike '%app.novisociety.com%'
        or coalesce(body_text, '') ilike '%app.novisociety.com%'
        or coalesce(body_html, '') ilike '%www.novisociety.com/patient-signup%'
        or coalesce(body_text, '') ilike '%www.novisociety.com/patient-signup%'
     order by trigger, name`
  );

  console.log(`remaining_hardcoded_templates=${rows.length}`);
  rows.forEach((row) => {
    console.log(`${row.trigger} | ${row.name} | ${row.id}`);
  });
} finally {
  await pool.end();
}
