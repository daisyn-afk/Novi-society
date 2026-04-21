import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const { coursesRouter } = await import("./courses/routes.js");
const { templateCoursesRouter } = await import("./template-courses/routes.js");
const { uploadsRouter } = await import("./uploads/routes.js");
const { locationsRouter } = await import("./locations/routes.js");
const { checkoutRouter } = await import("./checkout/routes.js");
const { webhooksRouter } = await import("./webhooks/routes.js");
const { promoCodesRouter } = await import("./promo-codes/routes.js");
const { authRouter } = await import("./auth/routes.js");
const { serviceTypesCatalogRouter } = await import("./service-types-catalog/routes.js");
const { preOrdersRouter } = await import("./pre-orders/routes.js");

const app = express();
app.use(cors());

// Stripe signature verification requires the exact raw body.
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.use("/webhooks", webhooksRouter);

app.use(express.json({ limit: "2mb" }));

app.use("/admin/template-courses", templateCoursesRouter);
app.use("/admin/courses", coursesRouter);
app.use("/admin/uploads", uploadsRouter);
app.use("/admin/locations", locationsRouter);
app.use("/admin/checkout", checkoutRouter);
app.use("/admin/promo-codes", promoCodesRouter);
app.use("/admin/auth", authRouter);
app.use("/admin/service-types", serviceTypesCatalogRouter);
app.use("/admin/pre-orders", preOrdersRouter);

app.use((error, _req, res, _next) => {
  if ((error.statusCode || 500) >= 500) {
    // eslint-disable-next-line no-console
    console.error("[admin-api] request failed:", error);
  }
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "File exceeds max allowed size."
    });
  }
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

