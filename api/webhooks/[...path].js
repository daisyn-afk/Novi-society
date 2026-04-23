import { createAdminApp } from "../../backend/admin/app.js";

const app = createAdminApp();

// Vercel rewrites /webhooks/* -> /api/webhooks/* before invoking this
// function, so req.url arrives prefixed with "/api". Express routers are
// mounted at "/webhooks/*", so we strip the "/api" prefix to keep routing
// consistent with local dev.
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

