import { createAdminApp } from "../../backend/admin/app.js";

const app = createAdminApp();

// Clients call /api/admin/* so the path never collides with React Router SPA
// routes like /admin. Express routers are mounted at /admin/*, so we strip the
// /api prefix before handing off. Locally, Vite's proxy performs the same
// strip before forwarding to the Express server on port 8787.
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

