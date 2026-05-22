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
const { coursePaymentsRouter } = await import("./course-payments/routes.js");
const { migratedUsersRouter } = await import("./migrated-users/routes.js");
const { trainerPrepRouter } = await import("./trainer-prep/routes.js");
const { enrollmentsRouter } = await import("./enrollments/routes.js");
const { usersRouter } = await import("./users/routes.js");
const { providerOnboardingRouter } = await import("./provider-onboarding/routes.js");
const { licensesRouter } = await import("./licenses/routes.js");
const { certificationsRouter } = await import("./certifications/routes.js");
const { classSessionsRouter } = await import("./class-sessions/routes.js");
const { notificationsRouter } = await import("./notifications/routes.js");
const { mdSubscriptionsRouter } = await import("./md-subscriptions/routes.js");
const { mdRelationshipsRouter } = await import("./md-relationships/routes.js");
const { mdServiceOfferingsRouter } = await import("./md-service-offerings/routes.js");
const { mdProfileRouter } = await import("./md-profile/routes.js");
const { functionsRouter } = await import("./functions/routes.js");
const { patientJourneyRouter } = await import("./patient-journey/routes.js");
const { integrationsRouter } = await import("./integrations/routes.js");
const { mdMessagesRouter } = await import("./md-messages/routes.js");
const { appointmentsRouter } = await import("./appointments/routes.js");
const { treatmentRecordsRouter } = await import("./treatment-records/routes.js");

export function createAdminApp() {
  const app = express();
  app.use(cors());

  // Stripe webhook endpoints — signature verification requires the EXACT raw
  // body bytes. These middlewares MUST run before express.json() so the
  // bodies arrive as Buffer (not parsed JSON). Mount one per webhook URL.
  app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
  app.use("/functions/modelCheckoutWebhook", express.raw({ type: "application/json" }));
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
  app.use("/admin/course-payments", coursePaymentsRouter);
  app.use("/admin/migrated-users", migratedUsersRouter);
  app.use("/admin/trainer-prep", trainerPrepRouter);
  app.use("/admin/enrollments", enrollmentsRouter);
  app.use("/admin/users", usersRouter);
  app.use("/admin/provider-onboarding", providerOnboardingRouter);
  app.use("/admin/licenses", licensesRouter);
  app.use("/admin/certifications", certificationsRouter);
  app.use("/admin/class-sessions", classSessionsRouter);
  app.use("/admin/notifications", notificationsRouter);
  app.use("/admin/md-subscriptions", mdSubscriptionsRouter);
  app.use("/admin/md-relationships", mdRelationshipsRouter);
  app.use("/admin/md-service-offerings", mdServiceOfferingsRouter);
  app.use("/admin/md-profile", mdProfileRouter);
  app.use("/admin/patient-journey", patientJourneyRouter);
  app.use("/admin/integrations", integrationsRouter);
  app.use("/admin/md-messages", mdMessagesRouter);
  app.use("/admin/appointments", appointmentsRouter);
  app.use("/admin/treatment-records", treatmentRecordsRouter);
  app.use("/functions", functionsRouter);

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File exceeds max allowed size."
      });
    }
    const status = error.statusCode || 500;
    const causeCode = error?.cause?.code;
    const syscallCode = error?.code;
    const msg = String(error?.message || "");
    const isConnectivity =
      Boolean(error?.isOperational) ||
      status === 503 ||
      causeCode === "UND_ERR_CONNECT_TIMEOUT" ||
      causeCode === "UND_ERR_SOCKET" ||
      syscallCode === "ETIMEDOUT" ||
      syscallCode === "EHOSTUNREACH" ||
      syscallCode === "ENETUNREACH" ||
      syscallCode === "EAI_AGAIN" ||
      syscallCode === "ECONNRESET" ||
      syscallCode === "ECONNREFUSED" ||
      /fetch failed|network|timeout|unavailable/i.test(msg);
    if (status >= 500 && !isConnectivity) {
      // eslint-disable-next-line no-console
      console.error("[admin-api] request failed:", error);
    } else if (status >= 500 && isConnectivity) {
      // eslint-disable-next-line no-console
      console.warn("[admin-api] upstream unavailable:", msg || causeCode || status);
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || "Internal server error",
      details: error.details || undefined
    });
  });

  return app;
}

