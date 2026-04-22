import serverless from "serverless-http";
import app from "../backend/admin/server.js";

const handler = serverless(app);

export default async function vercelHandler(req, res) {
  return handler(req, res);
}

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" }
  }
};
