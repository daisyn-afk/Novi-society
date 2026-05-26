import launchRoadmap from "@/data/launchRoadmap.json";

const PROFILE_FIELDS = [
  "avatar_url",
  "bio",
  "city",
  "state",
  "practice_name",
  "phone",
];

function hasActiveSchedule(me) {
  const schedule = me?.schedule || {};
  return Object.values(schedule).some(
    (day) => day?.enabled && day?.start && day?.end
  );
}

function buildAutoChecks({ me, licenses = [], certs = [], enrollments = [], mdSubs = [] }) {
  const verifiedLicense = licenses.some((l) => l.status === "verified");
  const activeCert = certs.some((c) => c.status === "active");
  const activeMd = mdSubs.some((s) => s.status === "active");
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
    cpr_bls: !!(
      me?.launch_checklist?.cpr_bls ||
      certs.some((c) =>
        /cpr|bls|basic life support/i.test(
          `${c.certification_name || ""} ${c.issued_by || ""}`
        )
      )
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
    _goLiveGates: {
      license_verified: verifiedLicense,
      md_active: activeMd,
      profile_complete: profileBasic && hasActiveSchedule(me) && !!me?.practice_name,
      treatments_live: hasLiveTreatment,
    },
  };
}

function isStepComplete(step, autoChecks, manualChecklist = {}) {
  if (step.autoCheck) {
    return !!autoChecks[step.autoCheck];
  }
  return !!manualChecklist[step.id];
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
    const interactiveSteps = (staticPhase?.steps || []).filter((s) => s.embedded_tool);
    const steps = [...(dbPhase.steps || []), ...interactiveSteps].sort(
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
  phases = getStaticLaunchRoadmapPhases(),
}) {
  const manualChecklist = me?.launch_checklist || {};
  const autoChecks = buildAutoChecks({ me, licenses, certs, enrollments, mdSubs });

  const phasesWithProgress = phases.map((phase) => {
    const steps = phase.steps.map((step) => ({
      ...step,
      done: isStepComplete(step, autoChecks, manualChecklist),
    }));
    const doneCount = steps.filter((s) => s.done).length;
    const pct = steps.length
      ? Math.round((doneCount / steps.length) * 100)
      : 0;
    const complete = doneCount === steps.length;
    return { ...phase, steps, doneCount, pct, complete };
  });

  const allSteps = phasesWithProgress.flatMap((p) =>
    p.steps.map((s) => ({ ...s, phaseId: p.id, phaseLabel: p.label }))
  );
  const totalSteps = allSteps.length;
  const completedCount = allSteps.filter((s) => s.done).length;
  const overallPct = totalSteps
    ? Math.round((completedCount / totalSteps) * 100)
    : 0;

  const goLiveGates = autoChecks._goLiveGates;
  const goLiveComplete = Object.values(goLiveGates).filter(Boolean).length;
  const readyToGoLivePct = Math.round((goLiveComplete / 4) * 100);
  const profileCompletePct = autoChecks._profileCompletePct;
  const phasesDone = phasesWithProgress.filter((p) => p.complete).length;

  const isReadyForPatients = goLiveComplete === 4;

  const nextAction = allSteps
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
    totalPhases: phases.length,
    isReadyForPatients,
    nextAction,
    manualChecklist,
    autoChecks,
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
