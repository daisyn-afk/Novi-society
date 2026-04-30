import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env for local development; Vercel uses dashboard env vars.
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
const { trainerPrepRouter } = await import("./trainer-prep/routes.js");
const { enrollmentsRouter } = await import("./enrollments/routes.js");
const { usersRouter } = await import("./users/routes.js");
const { providerOnboardingRouter } = await import("./provider-onboarding/routes.js");
const { licensesRouter } = await import("./licenses/routes.js");
const { certificationsRouter } = await import("./certifications/routes.js");
const { classSessionsRouter } = await import("./class-sessions/routes.js");
const { functionsRouter } = await import("./functions/routes.js");

export function createAdminApp() {
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
  app.use("/admin/trainer-prep", trainerPrepRouter);
  app.use("/admin/enrollments", enrollmentsRouter);
  app.use("/admin/users", usersRouter);
  app.use("/admin/provider-onboarding", providerOnboardingRouter);
  app.use("/admin/licenses", licensesRouter);
  app.use("/admin/certifications", certificationsRouter);
  app.use("/admin/class-sessions", classSessionsRouter);
  app.use("/functions", functionsRouter);

  app.use((error, _req, res, _next) => {
    if ((error.statusCode || 500) >= 500 && !error.isOperational) {
      // eslint-disable-next-line no-console
      console.error("[admin-api] request failed:", error);
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File exceeds max allowed size."
      });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Internal server error",
      details: error.details || undefined
    });
  });

  return app;
}

