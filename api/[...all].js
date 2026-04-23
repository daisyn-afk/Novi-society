import { createAdminApp } from "../backend/admin/app.js";

const app = createAdminApp();

// Single root-level catch-all function handles all /api/* traffic.
// Vercel's nested dynamic catch-alls (api/admin/[...path].js) have issues
// matching 2+ path segments in non-Next.js deployments, so we use a single
// top-level catch-all instead.
//
// Strips the "/api" prefix so Express routers mounted at "/admin/*" and
// "/webhooks/*" match as they do locally (where Vite proxy does the same).
export default function handler(req, res) {
  if (req.url && req.url.startsWith("/api/")) {
    req.url = req.url.slice(4);
  }
  return app(req, res);
}

export const config = {
  api: {
    externalResolver: true
  }
};
