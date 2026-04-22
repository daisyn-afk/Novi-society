import serverless from "serverless-http";
import app from "../../backend/admin/server.js";

const handler = serverless(app);

export default async function vercelHandler(req, res) {
  return handler(req, res);
}

// Disable Vercel's body parser so Stripe's signature verification sees
// the exact raw request body. The Express app mounts express.raw() on
// /webhooks/stripe itself.
export const config = {
  api: {
    bodyParser: false
  }
};
