# Attendance + Locked Dashboard Demo (Phase 1)

Manager handoff document for the implementation completed in this thread.

## 1) Context and Objective

This phase was implemented as a **demo/review-first release** to support an upcoming client call while minimizing risk to current provider workflows.

Primary goals completed:

1. Relocate attendance access into contextual provider experiences:
   - Provider Dashboard (live attendance banner)
   - Courses and Enrollments (attendance section in each relevant course card)
2. Build a separate **Locked Dashboard** prototype for review:
   - New route and sidebar entry
   - Isolated from current production-like provider dashboard flow
3. Preserve safety:
   - Keep legacy standalone Class Attendance flow available as fallback
   - Avoid global route-level gating changes in this phase

## 2) Branch and Delivery Model

- Feature branch used: `feature/provider-attendance-locked-dashboard-demo`
- Implementation isolated to this branch for review/demo
- No production replacement behavior introduced in this phase

## 3) Scope Implemented vs Deferred

### Implemented in Phase 1

- Shared attendance domain hook for reuse
- Attendance UI inside course cards
- Dashboard attendance banner for active class windows
- Separate locked dashboard preview page
- Sidebar integration for locked dashboard preview
- Route/policy support for preview page access
- Legacy attendance page retained as fallback

### Explicitly deferred (not implemented yet)

- Global locked/unlocked route restrictions across all provider modules
- Large unification refactor of `ProviderSalesLock` and `ServiceLockGate`
- Removal of standalone `ProviderCodeRedemption`
- Replacement of existing `ProviderDashboard` flow

## 4) Files Added and Updated

### New files

- `src/components/provider/useAttendanceContext.js`
- `src/pages/ProviderDashboardLockedPreview.jsx`

### Updated files

- `src/pages/ProviderEnrollments.jsx`
- `src/components/provider/CourseEnrollmentCard.jsx`
- `src/pages/ProviderDashboard.jsx`
- `src/Layout.jsx`
- `src/App.jsx`
- `src/lib/routeAccessPolicy.ts`

## 5) Detailed Change Breakdown

### 5.1 Shared attendance domain layer

**File:** `src/components/provider/useAttendanceContext.js`

What was added:

- Centralized attendance data gathering and normalization:
  - enrollments (provider id + email + qualifying pre-orders)
  - class sessions
  - courses
- Attendance window calculation using:
  - `src/lib/classCodeWindow.js`
- Computed model exposed to UI:
  - `enrollmentWindows`
  - `activeWindows`
  - `getWindowByEnrollment()`
  - validation and submit helpers
- Submission preserved through existing backend contract:
  - `base44.functions.invoke("redeemClassCode")`
- Query invalidation for immediate UI refresh after successful submit

Why this matters:

- Reduces logic duplication and drift risk across dashboard, enrollment cards, and legacy attendance flow.

### 5.2 Attendance inside course cards

**Files:**

- `src/pages/ProviderEnrollments.jsx`
- `src/components/provider/CourseEnrollmentCard.jsx`

What was changed:

- `ProviderEnrollments` now consumes `useAttendanceContext()` and passes attendance state per enrollment into each course card.
- `CourseEnrollmentCard` now supports attendance props:
  - `attendanceWindow`
  - `onSubmitAttendance`
  - `isSubmittingAttendance`
- New attendance section added in card:
  - state badge: `Class is Live`, `Closed`, `Marked`
  - 6-character attendance code input
  - submit button
  - inline success/error messages

Behavior:

- If session is active/live: attendance input and submit are enabled.
- If no active window: interaction is disabled/closed.
- If already attended: marked state shown and input hidden.

### 5.3 Dashboard attendance banner

**File:** `src/pages/ProviderDashboard.jsx`

What was added:

- Attendance context hook wiring on dashboard.
- Conditional live attendance banner that appears only when `activeWindows` exist.
- Banner includes:
  - current active course/session context
  - selector if multiple active sessions are available
  - attendance input + submit action
  - inline response messaging

Important note:

- Existing Provider Dashboard structure/flow was **not replaced**.
- This is additive behavior for demo and review.

### 5.4 Separate locked dashboard preview prototype

**Files:**

- `src/pages/ProviderDashboardLockedPreview.jsx` (new)
- `src/Layout.jsx`
- `src/App.jsx`
- `src/lib/routeAccessPolicy.ts`

What was added:

- New standalone preview page for locked dashboard concept validation.
- State selector to demonstrate dashboard-state concepts:
  - locked
  - studying
  - external certification pending review
  - active reference
- Reuses existing locked visual (`ProviderDashboardUnlock`) for client-facing prototype.
- New provider sidebar menu item:
  - `Locked Dashboard (Preview)`
- New route:
  - `/ProviderDashboardLockedPreview`
- Provider role allow-list updated so preview route is accessible.

Important note:

- Preview is isolated and does not alter existing `ProviderDashboard`.

### 5.5 Legacy attendance safety retained

Standalone Class Attendance remains available:

- Existing `ProviderCodeRedemption` route and page were intentionally kept in place.
- This provides fallback/rollback safety during demo phase.

## 6) End-to-End Validation Flow (Step-by-Step)

### 6.1 Environment setup

1. Checkout branch:
   - `git checkout feature/provider-attendance-locked-dashboard-demo`
2. Install dependencies:
   - `npm install`
3. Start app:
   - `npm run dev`
4. Login using a provider account with enrollment/session data.

### 6.2 Locked Dashboard Preview checks

1. Open sidebar.
2. Verify menu item exists:
   - `Locked Dashboard (Preview)`
3. Open it and verify page loads.
4. Change state selector values and confirm demo cards change.
5. Confirm this does not alter normal provider dashboard route behavior.

Expected result:

- Preview page works as an isolated review artifact.

### 6.3 Dashboard attendance banner checks

1. Navigate to normal provider dashboard.
2. Verify banner visibility:
   - Visible only during active/live attendance window
   - Hidden when no active windows
3. If multiple active sessions exist, switch selector and verify target changes.
4. Test submit:
   - invalid code (short/nonmatching) => error/blocked
   - valid code => success and UI refresh

Expected result:

- Banner appears only when appropriate and submits through existing backend validation.

### 6.4 Course card attendance checks

1. Go to `Courses & Enrollments` -> `My Courses`.
2. Verify card states:
   - live session => enabled input + submit
   - not live => disabled/closed
   - already attended => marked
3. Submit from card:
   - invalid code => error
   - valid code => success and state update

Expected result:

- Attendance is contextual to the specific course/session card.

### 6.5 Fallback checks

1. Open existing `Class Attendance` page.
2. Ensure legacy flow still loads.

Expected result:

- Legacy attendance remains available during demo phase.

### 6.6 Regression checks

Verify provider routes still load correctly:

- `ProviderDashboard`
- `ProviderEnrollments`
- `ProviderCodeRedemption`
- `ProviderDashboardLockedPreview`

Expected result:

- No new provider route lockouts introduced.

## 7) Risk Assessment and Mitigation

### Risk 1: Logic drift between multiple attendance entry points

Mitigation:

- Shared `useAttendanceContext` introduced as central data/action layer.
- Server remains source of truth via `redeemClassCode`.

### Risk 2: Locked dashboard prototype accidentally changes current dashboard

Mitigation:

- Separate route and sidebar entry used.
- Existing `ProviderDashboard` flow not replaced.

### Risk 3: Scope creep into global access control changes

Mitigation:

- Global restricted-page lock/unlock logic explicitly deferred from this phase.

## 8) Rollback and Safety

Rollback is low risk because this phase is additive and isolated.

If needed:

1. Do not merge feature branch.
2. Remove preview-only entries:
   - sidebar item
   - preview route
   - role policy key
3. Revert attendance banner/card wiring while keeping legacy attendance flow intact.

## 9) Notes for Client Demo

Recommended demo sequence:

1. Show normal Provider Dashboard still works (no replacement).
2. Show live attendance banner (if active window exists).
3. Show attendance inside course cards in `Courses & Enrollments`.
4. Show `Locked Dashboard (Preview)` from sidebar.
5. Switch preview states and explain that this is prototype-only.
6. Confirm fallback legacy Class Attendance still exists.

## 10) Acceptance Checklist

- [ ] Feature branch isolation confirmed
- [ ] Shared attendance domain hook active
- [ ] Course card attendance works (live/closed/marked states)
- [ ] Dashboard attendance banner works during live windows
- [ ] Locked dashboard preview available from sidebar
- [ ] Existing provider dashboard unchanged
- [ ] Legacy Class Attendance fallback still available
- [ ] No global provider gating rollout introduced yet

