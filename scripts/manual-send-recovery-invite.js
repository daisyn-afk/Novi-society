import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || "NOVI Society <support@novisociety.com>";
const email = "daisyn@bpublic.com";

if (!url || !key || !resendApiKey) {
  console.error("Missing required env vars.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const linkRes = await supabase.auth.admin.generateLink({
  type: "recovery",
  email,
  options: { redirectTo: `${appBaseUrl}/` }
});

if (linkRes.error) {
  console.error("Generate recovery link failed:", linkRes.error.message || linkRes.error);
  process.exit(2);
}

const recoveryLink = linkRes.data?.properties?.action_link || linkRes.data?.action_link;
if (!recoveryLink) {
  console.error("No recovery link returned.");
  process.exit(3);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${resendApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    from: resendFrom,
    to: [email],
    subject: "Set your NOVI Society password (fresh link)",
    text: `Use this latest one-time link to set your password:\n\n${recoveryLink}\n\nOpen only this newest email link.`
  })
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error("Resend failed:", res.status, body);
  process.exit(4);
}

console.log(`Recovery email sent successfully to ${email}`);
