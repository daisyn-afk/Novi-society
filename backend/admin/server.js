import { createAdminApp } from "./app.js";

const app = createAdminApp();

export default app;
export { app };

if (!process.env.VERCEL) {
  const runModelAutomationTick = async () => {
    const trigger = async (routePath) => {
      const response = await fetch(`http://127.0.0.1:${port}/functions/${routePath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`${routePath} failed (${response.status}): ${body}`);
      }
    };
    try {
      await trigger("sendModelReminderBatch");
      await trigger("sendModelGFEReminderBatch");
      await trigger("sendModelPostTrainingBatch");
      // eslint-disable-next-line no-console
      console.log("[model-automation] tick completed");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[model-automation] tick failed:", error?.message || error);
    }
  };

  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || "0.0.0.0";
  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Admin API listening on http://127.0.0.1:${port} (host ${host})`);
    // Kick once at startup, then keep running hourly.
    setTimeout(() => {
      void runModelAutomationTick();
    }, 15_000);
    setInterval(() => {
      void runModelAutomationTick();
    }, 60 * 60 * 1000);
  });
}
