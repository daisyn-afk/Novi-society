import { createAdminApp } from "../backend/admin/app.js";

const app = createAdminApp();

// Single serverless function handles all /api/* traffic.
// `vercel.json` rewrites every `/api/(.*)` request here, which is more
// reliable than Vercel's `[...slug]` catch-all filename convention in
// non-Next.js (Vite) deployments.
//
// Strips the "/api" prefix so Express routers mounted at "/admin/*" and
// "/webhooks/*" match as they do locally (where Vite proxy does the same).
export default function handler(req, res) {
  if (req.url && req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  } else if (req.url === "/api") {
    req.url = "/";
  }
  return app(req, res);
}

export const config = {
  api: {
    // CRITICAL: Vercel's default body parsing must be DISABLED.
    //
    // Stripe webhook signature verification (stripe.webhooks.constructEvent)
    // hashes the raw request bytes. If Vercel parses the JSON body first, the
    // bytes Express sees no longer match what Stripe signed, and every
    // webhook delivery is rejected with "No signatures found matching..."
    //
    // Setting bodyParser: false lets the raw stream pass through to Express,
    // where the per-route express.raw({ type: "application/json" }) middleware
    // (mounted at /webhooks/stripe and /functions/modelCheckoutWebhook in
    // backend/admin/app.js) captures the bytes as a Buffer for Stripe to
    // verify. All non-webhook routes still get express.json() body parsing
    // because Express runs that middleware itself.
    bodyParser: false,
    externalResolver: true
  }
};
