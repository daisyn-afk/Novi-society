import dotenv from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const execFileAsync = promisify(execFile);

const url = "https://rcaqcxhjngbwwlhfgeqi.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjYXFjeGhqbmdid3dsaGZnZXFpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTYzODY4OCwiZXhwIjoyMDkxMjE0Njg4fQ.Q95kF3G1ivmXsQTiXWDzvAAgb5tc_Jn9l9W8tFktUSA";
const publishableKey = "sb_publishable_ra-lrnz5qF4K-Ao-4tZkwQ_2RXW0vnU";
const appBaseUrl =  "https://novisociety.com" 
const email = String(process.argv[2] || process.env.MAGIC_LINK_EMAIL || "").trim().toLowerCase();
const skipOpen = process.argv.includes("--no-open");

if (!url || !serviceKey || !publishableKey) {
  console.error(
    "Missing env vars. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_PUBLISHABLE_KEY."
  );
  process.exit(1);
}
if (!email) {
  console.error("Usage: node scripts/magic-link.js <user-email> [--no-open]");
  process.exit(1);
}

const projectRef = (() => {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    return "unknown";
  }
})();

function buildAutoLoginUrl({ accessToken, refreshToken }) {
  const hash = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
    type: "recovery",
  }).toString();
  return `${appBaseUrl}?auto_login=1#${hash}`;
}

async function openIncognito(url) {
  const attempts = [
    ["Google Chrome", ["-na", "Google Chrome", "--args", "--incognito", url]],
    ["Arc", ["-na", "Arc", "--args", "--incognito", url]],
    ["default browser", [url]],
  ];

  for (const [label, args] of attempts) {
    try {
      await execFileAsync("open", args);
      return label;
    } catch {
      // try next browser
    }
  }
  return null;
}

console.log(`\nSupabase project: ${projectRef}`);
console.log(`Target site:      ${appBaseUrl}`);
console.log("Tokens only work if this Supabase project matches production env vars on that site.\n");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const auth = createClient(url, publishableKey, { auth: { persistSession: false } });

const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: appBaseUrl },
});

if (linkError) {
  console.error("generateLink failed:", linkError.message || linkError);
  process.exit(2);
}

const otp = linkData?.properties?.email_otp;
if (!otp) {
  console.error("No one-time token returned from Supabase.");
  process.exit(3);
}

const { data: sessionData, error: sessionError } = await auth.auth.verifyOtp({
  email,
  token: otp,
  type: "email",
});

if (sessionError || !sessionData?.session?.access_token) {
  console.error("verifyOtp failed:", sessionError?.message || sessionError || "no session");
  process.exit(4);
}

const { access_token, refresh_token } = sessionData.session;
const loginUrl = buildAutoLoginUrl({
  accessToken: access_token,
  refreshToken: refresh_token,
});

console.log(`Logged in as: ${email}`);
console.log("User password was NOT changed.\n");

if (skipOpen) {
  console.log("Auto-login URL (--no-open):\n");
  console.log(loginUrl);
  process.exit(0);
}

console.log("Opening incognito browser...");
const openedWith = await openIncognito(loginUrl);

if (openedWith) {
  console.log(`Opened in ${openedWith}.`);
  console.log("Session will be stored automatically and you will be redirected to the user's dashboard.");
} else {
  console.warn("Could not open a browser automatically. Open this URL manually in incognito:\n");
  console.log(loginUrl);
}
