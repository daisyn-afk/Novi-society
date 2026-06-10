import { createAdminApp } from "./app.js";
import {
  runCheckExpirations,
  runComplianceChecks,
} from "./compliance-logs/expirationService.js";

const app = createAdminApp();

export default app;
export { app };

if (!process.env.VERCEL) {
  const runModelAutomationTick = async () => {
    const cronSecret = String(process.env.CRON_SECRET || "").trim();
    const headers = { "Content-Type": "application/json" };
    if (cronSecret) headers.Authorization = `Bearer ${cronSecret}`;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/functions/modelAutomation`, {
        method: "POST",
        headers,
        body: "{}",
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`modelAutomation failed (${response.status}): ${body}`);
      }
      // eslint-disable-next-line no-console
      console.log("[model-automation] tick completed");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[model-automation] tick failed:", error?.message || error);
    }
  };

  const runComplianceAutomationTick = async () => {
    try {
      const expirations = await runCheckExpirations();
      // eslint-disable-next-line no-console
      console.log(
        "[check-expirations] tick completed:",
        expirations?.compliance_logs_created ?? 0,
        "log(s),",
        expirations?.licenses_expired ?? 0,
        "license(s),",
        expirations?.certs_expired ?? 0,
        "cert(s),",
        expirations?.subscriptions_suspended ?? 0,
        "access suspended (Stripe unchanged)"
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[check-expirations] tick failed:", error?.message || error);
    }
    try {
      const reminders = await runComplianceChecks();
      // eslint-disable-next-line no-console
      console.log(
        "[compliance-checks] tick completed:",
        reminders?.notifications_sent ?? 0,
        "notification(s)"
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[compliance-checks] tick failed:", error?.message || error);
    }
  };

  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || "0.0.0.0";
  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Admin API listening on http://127.0.0.1:${port} (host ${host})`);
    // Optional background jobs (require admin auth on /functions/*). Off by default in local dev.
    const modelAutomationEnabled = String(process.env.ENABLE_MODEL_AUTOMATION || "").trim() === "1";
    if (modelAutomationEnabled) {
      setTimeout(() => {
        void runModelAutomationTick();
      }, 15_000);
      setInterval(() => {
        void runModelAutomationTick();
      }, 60 * 60 * 1000);
    }
    const complianceChecksEnabled = String(process.env.ENABLE_COMPLIANCE_CHECKS || "").trim() === "1";
    if (complianceChecksEnabled) {
      setTimeout(() => {
        void runComplianceAutomationTick();
      }, 30_000);
      setInterval(() => {
        void runComplianceAutomationTick();
      }, 24 * 60 * 60 * 1000);
    }
  });
}
