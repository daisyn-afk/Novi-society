import { createAdminApp } from "../../backend/admin/app.js";

const app = createAdminApp();

// Vercel rewrites /admin/* -> /api/admin/* before invoking this function, so
// req.url arrives prefixed with "/api". Express routers are mounted at
// "/admin/*", so we strip the "/api" prefix to keep routing consistent with
// local dev (where Vite proxies /admin/* through unchanged).
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

