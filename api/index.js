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
    externalResolver: true
  }
};
