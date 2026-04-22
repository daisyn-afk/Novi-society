import { createAdminApp } from "../../backend/admin/app.js";

const app = createAdminApp();

export default app;

export const config = {
  api: {
    externalResolver: true
  }
};

