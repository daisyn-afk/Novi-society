import { getFoundationPlaybook } from "@/data/foundationStepPlaybooks";

export function getStepStatusKey(stepId) {
  return `${stepId}_status`;
}

export function getStepExternalStatusKey(stepId) {
  return `${stepId}_external_status`;
}

export function hasFoundationPlaybook(step) {
  if (!step?.id) return false;
  return !!getFoundationPlaybook(step.playbook || step.id);
}

/** Map license rows to client-facing status keys. */
export function resolveLicenseProgressStatus(licenses = []) {
  if (!Array.isArray(licenses) || licenses.length === 0) {
    return { key: "pending_submission", label: "Pending Submission" };
  }
  if (licenses.some((l) => l.status === "verified")) {
    return { key: "verified", label: "Verified" };
  }
  if (licenses.some((l) => l.status === "pending_review")) {
    return { key: "under_review", label: "Under Review" };
  }
  if (
    licenses.length > 0 &&
    licenses.every((l) => l.status === "rejected") &&
    !licenses.some((l) => l.status === "pending_review" || l.status === "verified")
  ) {
    return { key: "rejected", label: "Rejected" };
  }
  return { key: "pending_submission", label: "Pending Submission" };
}

/** Resolve display status for a playbook step (read-only sources + self-report). */
export function resolvePlaybookDisplayStatus(step, ctx = {}) {
  const playbook = getFoundationPlaybook(step.playbook || step.id);
  if (!playbook) return null;

  const checklist = ctx.me?.launch_checklist || {};
  const stepId = step.id;

  if (playbook.statusSource === "license") {
    return resolveLicenseProgressStatus(ctx.licenses);
  }

  if (playbook.statusSource === "cert") {
    const pending = (ctx.certs || []).some(
      (c) => c.status === "pending" && playbook.certMatcher?.(c)
    );
    const active = (ctx.certs || []).some(
      (c) => c.status === "active" && playbook.certMatcher?.(c)
    );
    if (active) return { key: "verified", label: "Verified" };
    if (pending) return { key: "under_review", label: "Under Review" };
  }

  const externalKey = checklist[getStepExternalStatusKey(stepId)];
  if (externalKey && playbook.futureStatusSource === "webhook") {
    const ext = playbook.statusOptions.find((o) => o.key === externalKey);
    if (ext) return { key: externalKey, label: ext.label };
  }

  const selfKey = checklist[getStepStatusKey(stepId)] || "not_started";
  const opt = playbook.statusOptions.find((o) => o.key === selfKey);
  return { key: selfKey, label: opt?.label || "Not Started" };
}

export function isPlaybookStepComplete(step, autoChecks, manualChecklist, ctx = {}) {
  const playbook = getFoundationPlaybook(step.playbook || step.id);
  if (!playbook) return null;

  const stepId = step.id;

  if (playbook.statusSource === "license") {
    return !!autoChecks.license_verified;
  }

  if (playbook.statusSource === "cert" && step.autoCheck) {
    return !!autoChecks[step.autoCheck];
  }

  if (manualChecklist[stepId] === true) return true;

  const status =
    manualChecklist[getStepExternalStatusKey(stepId)] ||
    manualChecklist[getStepStatusKey(stepId)];
  if (status && playbook.completeStatuses?.includes(status)) return true;

  return false;
}

export function mergeChecklistUpdate(current = {}, patch = {}) {
  return { ...current, ...patch };
}
