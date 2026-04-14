import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const { coursesRouter } = await import("./courses/routes.js");
const { templateCoursesRouter } = await import("./template-courses/routes.js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/admin/template-courses", templateCoursesRouter);
app.use("/admin/courses", coursesRouter);

app.use((error, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("[admin-api] request failed:", error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: error.message || "Internal server error",
    details: error.details || undefined
  });
});

const port = Number(process.env.PORT) || 8787;
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Admin API listening on http://127.0.0.1:${port} (host ${host})`);
});

