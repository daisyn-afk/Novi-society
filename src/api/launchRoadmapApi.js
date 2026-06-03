import { adminApiRequest } from "./adminApiRequest";

export async function fetchLaunchRoadmapPhases() {
  return adminApiRequest("/admin/launch-roadmap/phases", { method: "GET" });
}

export async function fetchLaunchRoadmapProgress() {
  return adminApiRequest("/admin/launch-roadmap/progress", { method: "GET" });
}

export async function updateLaunchRoadmapProgress(launchChecklist) {
  return adminApiRequest("/admin/launch-roadmap/progress", {
    method: "PATCH",
    body: JSON.stringify({ launch_checklist: launchChecklist }),
  });
}
