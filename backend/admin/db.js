import pg from "pg";

const { Pool } = pg;
function withLibpqCompatIfNeeded(rawConnectionString) {
  if (!rawConnectionString) return rawConnectionString;

  try {
    const parsed = new URL(rawConnectionString);
    const sslMode = parsed.searchParams.get("sslmode");
    const hasCompatFlag = parsed.searchParams.has("uselibpqcompat");

    // pg currently treats sslmode=require as verify-full unless libpq compat is enabled.
    if (sslMode === "require" && !hasCompatFlag) {
      parsed.searchParams.set("uselibpqcompat", "true");
      return parsed.toString();
    }

    return rawConnectionString;
  } catch {
    return rawConnectionString;
  }
}

function buildSupabaseDbUrlFromEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const dbUser = process.env.SUPABASE_DB_USER || "postgres";
  const dbName = process.env.SUPABASE_DB_NAME || "postgres";
  const dbPort = process.env.SUPABASE_DB_PORT || "5432";
  const explicitHost = process.env.SUPABASE_DB_HOST;

  if (!supabaseUrl || !dbPassword) return null;

  let host;
  if (explicitHost) {
    host = explicitHost;
  } else {
    try {
      const projectHost = new URL(supabaseUrl).hostname; // <project-ref>.supabase.co
      const projectRef = projectHost.split(".")[0];
      host = `db.${projectRef}.supabase.co`;
    } catch {
      return null;
    }
  }

  return `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${host}:${dbPort}/${dbName}?sslmode=require`;
}

const connectionString = withLibpqCompatIfNeeded(
  process.env.DATABASE_URL || buildSupabaseDbUrlFromEnv()
);

if (!connectionString) {
  throw new Error(
    "Database connection is not configured. Set DATABASE_URL, or set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD (optional SUPABASE_DB_USER/SUPABASE_DB_NAME/SUPABASE_DB_PORT)."
  );
}

const isSupabase = connectionString.includes("supabase.co");

// Reuse a single pg Pool across warm serverless invocations. Each Vercel
// function instance is its own Node isolate, so we keep the pool small
// (max: 1) to play nicely with Supabase's PgBouncer on port 6543.
const configuredFamily = Number(process.env.DB_IP_FAMILY || 0);
const ipFamilyOptions = configuredFamily === 4 || configuredFamily === 6
  ? { family: configuredFamily }
  : {};

const poolOptions = {
  connectionString,
  ...ipFamilyOptions,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 10_000,
  ssl: process.env.NODE_ENV === "production" || isSupabase
    ? { rejectUnauthorized: false }
    : false
};

const globalScope = globalThis;
const pool =
  globalScope.__noviPgPool ??
  (globalScope.__noviPgPool = new Pool(poolOptions));

export async function query(text, params = []) {
  return pool.query(text, params);
}

export { pool };

