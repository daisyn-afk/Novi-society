import { adminApiRequest } from "./adminApiRequest.js";

export const sessionApi = {
  getMe: () => adminApiRequest("/admin/auth/me", { method: "GET" }),
};
