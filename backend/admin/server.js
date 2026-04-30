import { createAdminApp } from "./app.js";

const app = createAdminApp();

export default app;
export { app };

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 8787;
  const host = process.env.HOST || "0.0.0.0";
  app.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(`Admin API listening on http://127.0.0.1:${port} (host ${host})`);
  });
}
