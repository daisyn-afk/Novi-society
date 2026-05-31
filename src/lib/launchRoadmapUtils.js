import launchRoadmap from "@/data/launchRoadmap.json";
import { isBbpCert, isCprBlsCert } from "@/lib/complianceCerts";

const PROFILE_FIELDS = [
  "avatar_url",
  "bio",
  "city",
  "state",
  "practice_name",
  "phone",
];

/** Operational launch readiness — 6 gates before accepting patients. */
export const READINESS_MODULE_IDS = [
  "license_verified",
  "md_mpi",
  "profile",
  "treatments",
  "deposit_policy",
  "book_link",
];

function hasActiveSchedule(me) {
  const schedule = me?.schedule || {};
  return Object.values(schedule).some(
    (day) => day?.open || day?.enabled
  );
}

function buildAutoChecks({
  me,
  licenses = [],
  certs = [],
  enrollments = [],
  mdSubs = [],
  mdRelationships = [],
}) {
  const verifiedLicense = licenses.some((l) => l.status === "verified");
  const activeCert = certs.some((c) => c.status === "active");
  const activeMd = mdSubs.some((s) => s.status === "active");
  const activeMdRelationship = mdRelationships.some(
    (r) => String(r.status || "").toLowerCase() === "active"
  );
  const hasLiveTreatment = !!(
    me?.service_offerings_v2 &&
    Object.values(me.service_offerings_v2).some((v) => v?.is_live)
  );

  const profileBasic = !!(me?.bio && me?.avatar_url && me?.city);
  const profileFieldsFilled = PROFILE_FIELDS.filter((key) => {
    const val = me?.[key];
    return val != null && String(val).trim() !== "";
  }).length;
  const profileCompleteScore =
    profileFieldsFilled + (hasActiveSchedule(me) ? 1 : 0) + (hasLiveTreatment ? 1 : 0);

  return {
    license_uploaded: licenses.length > 0,
    license_verified: verifiedLicense,
    md_mpi:
      activeMdRelationship ||
      activeMd ||
      Boolean(String(me?.md_name || "").trim()),
    deposit_policy: !!(
      Number(me?.deposit_percent) > 0 || Number(me?.cancellation_hours) > 0
    ),
    cpr_bls: !!(
      me?.launch_checklist?.cpr_bls ||
      certs.some(isCprBlsCert)
    ),
    bloodborne: !!(
      me?.launch_checklist?.bloodborne ||
      certs.some(isBbpCert)
    ),
    course_enrolled: enrollments.length > 0,
    course_completed: enrollments.some((e) =>
      ["completed", "attended"].includes(String(e.status || "").toLowerCase())
    ),
    certified: activeCert,
    md_active: activeMd,
    profile_basic: profileBasic,
    profile_complete: profileBasic && hasActiveSchedule(me) && !!me?.practice_name,
    treatments_live: hasLiveTreatment,
    book_link: !!(me?.practice_name && profileBasic && hasLiveTreatment),
    _profileCompletePct: Math.round(
      (profileCompleteScore / (PROFILE_FIELDS.length + 2)) * 100
    ),
  };
}

/** Merged completion map: auto-detected readiness + manual checklist overrides. */
export function buildCompleted(ctx) {
  const autoChecks = buildAutoChecks(ctx);
  const manualChecklist = ctx.me?.launch_checklist || {};
  const profileBasic = !!(ctx.me?.bio && ctx.me?.avatar_url && ctx.me?.city);

  const autoDetected = {
    license_verified: autoChecks.license_verified,
    md_mpi: autoChecks.md_mpi,
    profile: profileBasic,
    treatments: autoChecks.treatments_live,
    deposit_policy: autoChecks.deposit_policy,
    book_link: !!(ctx.me?.practice_name || ctx.me?.bio),
  };

  return { ...autoDetected, ...manualChecklist };
}

function isStepComplete(step, autoChecks, manualChecklist = {}) {
  if (step.autoCheck) {
    return !!autoChecks[step.autoCheck];
  }
  return !!manualChecklist[step.id];
}

/** Entire phase locked — visible but not interactive, excluded from progress. */
export function isPhaseComingSoon(phase) {
  return !!(phase?.coming_soon || phase?.comingSoon);
}

/** Checklist steps only — excludes Soon tools, embedded tools, and non-checklist types. */
export function countsTowardProgress(step, phase) {
  if (isPhaseComingSoon(phase)) return false;
  if (step.coming_soon) return false;
  if (step.embedded_tool) return false;
  if (step.type && step.type !== "checklist") return false;
  return true;
}

function getChecklistSteps(steps, phase) {
  return (steps || []).filter((step) => countsTowardProgress(step, phase));
}

export function getStaticLaunchRoadmapPhases() {
  return launchRoadmap.phases;
}

/** @deprecated use getStaticLaunchRoadmapPhases or merged phases from API */
export function getLaunchRoadmapPhases() {
  return getStaticLaunchRoadmapPhases();
}

const PHASE_ORDER = { foundation: 1, activation: 2, growth: 3, scale: 4 };

/** Merge DB-backed phases with static interactive-tool steps and Scale phase. */
export function mergeLaunchRoadmapPhases(dbPhases = [], staticPhases = getStaticLaunchRoadmapPhases()) {
  const staticById = Object.fromEntries(staticPhases.map((p) => [p.id, p]));
  const dbIds = new Set(dbPhases.map((p) => p.id));

  const merged = dbPhases.map((dbPhase) => {
    const staticPhase = staticById[dbPhase.id];
    const dbStepIds = new Set((dbPhase.steps || []).map((s) => s.id));
    const missingStaticSteps = (staticPhase?.steps || []).filter((s) => !dbStepIds.has(s.id));
    const steps = [...(dbPhase.steps || []), ...missingStaticSteps].sort(
      (a, b) => (a.priority || 0) - (b.priority || 0)
    );
    return {
      ...(staticPhase || {}),
      ...dbPhase,
      steps,
    };
  });

  const staticOnly = staticPhases.filter((p) => !dbIds.has(p.id));
  return [...merged, ...staticOnly].sort(
    (a, b) => (PHASE_ORDER[a.id] || 99) - (PHASE_ORDER[b.id] || 99)
  );
}

export function computeLaunchRoadmapStats({
  me,
  licenses = [],
  certs = [],
  enrollments = [],
  mdSubs = [],
  mdRelationships = [],
  phases = getStaticLaunchRoadmapPhases(),
}) {
  const manualChecklist = me?.launch_checklist || {};
  const ctx = { me, licenses, certs, enrollments, mdSubs, mdRelationships };
  const autoChecks = buildAutoChecks(ctx);
  const completed = buildCompleted(ctx);

  const phasesWithProgress = phases.map((phase) => {
    const steps = phase.steps.map((step) => ({
      ...step,
      done: isStepComplete(step, autoChecks, manualChecklist),
    }));
    const checklistSteps = getChecklistSteps(steps, phase);
    const doneCount = checklistSteps.filter((s) => s.done).length;
    const comingSoon = isPhaseComingSoon(phase);
    const pct = comingSoon
      ? null
      : checklistSteps.length
        ? Math.round((doneCount / checklistSteps.length) * 100)
        : 0;
    const complete =
      !comingSoon &&
      checklistSteps.length > 0 &&
      doneCount === checklistSteps.length;
    return {
      ...phase,
      steps,
      doneCount,
      checklistTotal: checklistSteps.length,
      pct,
      complete,
      comingSoon,
    };
  });

  const activePhases = phasesWithProgress.filter((p) => !p.comingSoon);
  const allChecklistSteps = activePhases.flatMap((p) =>
    getChecklistSteps(p.steps, p).map((s) => ({
      ...s,
      phaseId: p.id,
      phaseLabel: p.label,
    }))
  );
  const totalSteps = allChecklistSteps.length;
  const completedCount = allChecklistSteps.filter((s) => s.done).length;
  const overallPct = totalSteps
    ? Math.round((completedCount / totalSteps) * 100)
    : 0;

  const readinessDone = READINESS_MODULE_IDS.filter((id) => completed[id]).length;
  const readyToGoLivePct = Math.round(
    (readinessDone / READINESS_MODULE_IDS.length) * 100
  );
  const profileCompletePct = autoChecks._profileCompletePct;
  const phasesDone = activePhases.filter((p) => p.complete).length;

  const isReadyForPatients = readinessDone === READINESS_MODULE_IDS.length;

  const nextAction =
    allChecklistSteps
      .filter((s) => !s.done)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0] || null;

  return {
    phases: phasesWithProgress,
    overallPct,
    completedCount,
    totalSteps,
    readyToGoLivePct,
    profileCompletePct,
    phasesDone,
    totalPhases: activePhases.length,
    isReadyForPatients,
    nextAction,
    manualChecklist,
    autoChecks,
    completed,
    readinessModules: READINESS_MODULE_IDS.map((id) => ({
      id,
      done: !!completed[id],
    })),
  };
}

export function getStepActionUrl(step, createPageUrl) {
  return resolveNextStepNavigation(step, createPageUrl)?.url || null;
}

/** Where the Next Step / Next Best Action should navigate. */
export function resolveNextStepNavigation(step, createPageUrl) {
  if (!step) return null;

  if (step.navigate_to) {
    return {
      url: createPageUrl(step.navigate_to) + (step.navigate_params || ""),
      type: "internal",
    };
  }

  if (step.link && !step.links?.length) {
    return { url: step.link, type: "external" };
  }

  const phase = step.phaseId || "";
  const stepId = step.id || "";
  const qs = new URLSearchParams();
  if (phase) qs.set("phase", phase);
  if (stepId) qs.set("step", stepId);
  const query = qs.toString();

  return {
    url: `${createPageUrl("ProviderLaunchPad")}${query ? `?${query}` : ""}`,
    type: step.embedded_tool ? "growth_studio_tool" : "growth_studio",
  };
}
