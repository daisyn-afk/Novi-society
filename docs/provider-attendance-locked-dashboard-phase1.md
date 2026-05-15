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

---

# Phase 2 — Locked Provider Experience (Freemium Overlay)

Phase 2 takes the prototype concept from Phase 1 and applies it to real provider pages as a freemium "see but not fully use" experience.

## 11) Phase 2 Objective

Make non-certified / non-active providers able to **explore every section of the provider dashboard**, but show a blurred-content + upgrade-card overlay over modules they don't yet have access to. Avoid hard route blocking, avoid sidebar removals, keep the funnel open.

This explicitly addresses items previously marked deferred:

- Page-level lock/unlock UX across provider modules
- Unification of provider lock rendering via a single overlay component

## 12) Behavior Matrix

Source of truth for tier: `useProviderAccess` (`src/components/useProviderAccess.jsx`).

| Provider state | Dashboard | Courses & Enrollments | Apply for Coverage | Supplier Marketplace | Growth Studio | My Practice | Profile |
|---|---|---|---|---|---|---|---|
| `none` (no license) | open | open | open | locked | locked | locked | open |
| `pending` (license under review) | open | open | open | locked | locked | locked | open |
| `courses_only` (license verified) | open | open | open | locked | locked | locked | open |
| `md_eligible` (active cert) | open | open | open | open | open | locked | open |
| `full` (active MD subscription) | open | open | open | open | open | open | open |

"Locked" = route renders, real page mounts and renders blurred underneath, and the `LockedOverlay` card is shown over it. Sidebar item remains clickable; a small lock icon is shown next to its label.

## 13) Phase 2 Architecture

### New files

- `src/lib/providerLockedSections.js`
  - `TIER_ORDER`, `tierRank`, `meetsTier`
  - `PROVIDER_SECTION_LOCKS` map (single source of truth for which pages are locked and at which tier)
  - `getSectionLock(pageKey)`, `isSectionLockedForStatus(pageKey, status)`
- `src/components/LockedOverlay.jsx`
  - Generic, presentational overlay component
  - Props: `title`, `description`, `benefits[]`, `icon`, `accentColor`, `primaryCta`, `secondaryCta`, `statusBadge`, `footnote`, `children`
  - Renders `children` blurred + non-interactive underneath; floating "Unlock this feature" card above

### Updated files

- `src/components/ProviderSalesLock.jsx`
  - Rewritten as a thin business-logic wrapper around `LockedOverlay`
  - Tier comparison delegated to `meetsTier()` (from `providerLockedSections`)
  - Added `growth_studio` feature meta
  - Per-status badges + CTAs for `none`, `pending`, `courses_only`, `md_eligible`
- `src/pages/ProviderLaunchPad.jsx`
  - Wrapped with `ProviderSalesLock feature="growth_studio" requiredTier="md_eligible"`
- `src/pages/ProviderEnrollments.jsx`
  - `requiredTier` lowered from `"courses_only"` → `"none"` (Courses & Enrollments must be always-accessible per spec)
- `src/pages/ProviderCredentialsCoverage.jsx`
  - `requiredTier` lowered from `"courses_only"` → `"none"` ("Apply for Coverage" must be always-accessible — providers need this page to submit licenses/certs in the first place)
- `src/pages/ProviderMarketplace.jsx`
  - `requiredTier` adjusted from `"full"` → `"md_eligible"` so certified providers can use the marketplace without needing an active MD subscription (matches the access map)
- `src/Layout.jsx`
  - Removed hardcoded `isProviderUnlocked = true` and obsolete `PROVIDER_FREE_PAGES` constant
  - Sidebar now consults `isSectionLockedForStatus(page, providerAccessStatus)` for the lock icon
  - Sidebar links remain clickable and navigable for locked sections — only a subtle lock icon + tooltip are added

### Data flow

```
useProviderAccess() ──► status ─┬─► Layout.jsx     (sidebar lock indicators)
                                └─► ProviderSalesLock (overlay or pass-through)
                                       └─► LockedOverlay (UI only)
PROVIDER_SECTION_LOCKS ─────────► both layers, single source of truth
```

## 14) Constraints (Phase 2 Spec)

- [x] No route-level hard block — every route still mounts
- [x] No sidebar items hidden or disabled
- [x] Courses & Enrollments + Apply for Coverage fully accessible to every state
- [x] Locked sections render the real page underneath, blurred + non-interactive
- [x] Overlay includes title, description, benefits, and CTA(s)
- [x] Modular, reusable `LockedOverlay` component (no provider-specific logic inside it)
- [x] Existing tier model (`useProviderAccess`) untouched

## 15) How To Test Phase 2

### 15.1 Environment

```bash
git checkout feature/provider-attendance-locked-dashboard-demo
git pull
npm install
npm run dev
```

`npm run dev` boots Vite at the frontend port and the admin backend in parallel (see `package.json` scripts).

### 15.2 Force a provider tier locally

`useProviderAccess` computes the tier from three Supabase tables: `License`, `Certification`, `MDSubscription`. The easiest ways to flip a provider between tiers for testing are:

1. **Use a fresh provider account** — straight after signup the provider has no license. Tier = `none`.
2. **Admin role flip in the database** — use Supabase admin to set:
   - `License.status = "verified"` → tier becomes `courses_only`
   - Add a `Certification` row with `status = "active"` → tier becomes `md_eligible`
   - Add an `MDSubscription` row with `status = "active"` → tier becomes `full`
3. **Admin UI** — flip license/cert statuses from `AdminLicenses` and `AdminCompliance`.
4. **React Query devtools / browser console** — temporarily stub the hook by editing `useProviderAccess.jsx` to `return { status: "none", isLoading: false }` (or `pending`, `courses_only`, `md_eligible`, `full`) before testing each tier visually.

### 15.3 Smoke checks (per tier)

For each tier (`none`, `pending`, `courses_only`, `md_eligible`, `full`), log in as a matching provider and confirm:

#### Sidebar

1. All provider nav items are visible.
2. All provider nav items are clickable (route changes when clicked).
3. Lock icon appears only next to items locked at the current tier (see matrix in §12).
4. Hovering a locked item shows the tooltip `Preview available — unlock with certification`.

#### Always-accessible sections

1. Open **Courses & Enrollments** — full page content renders, no overlay, can browse and enroll.
2. Open **My Credentials & Coverage** — full page content renders, no overlay, can upload license / external cert.
3. Open **Profile** — full page content renders, no overlay.
4. Open **Dashboard** — full page content renders, no overlay.

#### Locked sections (when expected by matrix)

1. Open **Supplier Marketplace** / **Growth Studio** / **My Practice**.
2. Verify the route mounted (URL updated, page header/inner content visible underneath).
3. Verify the real page content is rendered **blurred** behind a lighter overlay (not blank, not redirected away).
4. Verify the overlay card shows:
   - `Locked Feature` eyebrow
   - Feature title (e.g. `Growth Studio`, `Supplier Marketplace`, `My Practice`)
   - Tagline / description
   - Benefits list
   - Status badge appropriate to current tier (e.g. for `none`: "Apply to NOVI..." with lock icon; for `pending`: "License under review..." with clock; for `courses_only`: "Complete a NOVI course..." with book icon; for `md_eligible`: "Activate MD Board coverage..." with bolt icon)
   - Primary CTA + (optional) secondary CTA that route into the correct next-step page
5. Click primary CTA — confirm navigation to the next action page (e.g. `ProviderBasicOnboarding` for `none`, `ProviderEnrollments` for `courses_only`, `ProviderCredentialsCoverage?tab=coverage` for `md_eligible`).

#### Unlocked transition

1. As `none` provider, open Supplier Marketplace — overlay shown.
2. Promote to `md_eligible` via admin (or stub the hook).
3. Re-open Supplier Marketplace — overlay disappears, real page becomes interactive.
4. Same drill for Growth Studio at `md_eligible` and for My Practice at `full`.

#### Loading / error states

1. Hard refresh on a locked route — confirm a brief "Checking your provider access..." loader, then either overlay or real content (no flash of unblurred locked content).
2. Disable network — confirm the route still mounts and the overlay degrades gracefully without throwing.

### 15.4 Phase 1 regression checks

Re-run §6 from Phase 1 to confirm none of those flows regressed:

- Dashboard attendance banner still shows during live windows.
- Course card attendance still works in `Courses & Enrollments`.
- `Locked Dashboard (Preview)` sidebar item still loads its prototype page (independent from this overlay system).
- Legacy `ProviderCodeRedemption` (`Class Attendance`) still loads.

### 15.5 Lint / build

```bash
npm run lint
npm run build
```

Expected: no new lint errors introduced by Phase 2 files. (Pre-existing lint issues in `ProviderMarketplace.jsx`, `ProviderCredentialsCoverage.jsx`, `ProviderLaunchPad.jsx` are unrelated to Phase 2.)

## 16) Phase 2 Risk and Mitigation

### Risk: Locked overlay obscures something the user genuinely needs to act on

Mitigation: All "core funnel" pages (Courses & Enrollments, Apply for Coverage, Dashboard, Profile) are tier-`none`. Only revenue-side or post-cert tools (Marketplace, Growth Studio, Practice) are gated.

### Risk: Sidebar lock icon mismatches actual gating

Mitigation: Both the sidebar and `ProviderSalesLock` read from the same `PROVIDER_SECTION_LOCKS` map via `isSectionLockedForStatus`/`meetsTier`. To gate or ungate a section, only `src/lib/providerLockedSections.js` needs to change.

### Risk: A locked page's underlying React tree triggers side effects the user shouldn't experience

Mitigation: `LockedOverlay` renders children with `pointer-events: none` and `user-select: none`, so no clicks / form submits land on the blurred content. Network queries still execute (they're already authorized at the API layer), but the user cannot mutate anything from the locked preview.

### Risk: Tier changes mid-session don't refresh the overlay

Mitigation: `useProviderAccess` is React-Query-backed and shares the `["my-licenses"]`, `["my-certs"]`, `["my-md-subscriptions"]` keys. Invalidate any of these after admin status changes (already done in admin flows) and both sidebar lock indicator and overlay update in the same render cycle.

## 17) Rollback Plan (Phase 2)

Rollback is contained to the files listed in §13:

1. Revert `src/lib/providerLockedSections.js` (delete the file).
2. Revert `src/components/LockedOverlay.jsx` (delete the file).
3. Revert `src/components/ProviderSalesLock.jsx` to the Phase 1 version.
4. Revert `requiredTier` props on `ProviderEnrollments`, `ProviderCredentialsCoverage`, `ProviderMarketplace`.
5. Remove the `ProviderSalesLock` wrapper added to `ProviderLaunchPad`.
6. Revert sidebar lock-indicator block in `Layout.jsx`.

No DB migrations, no API changes — purely UI rollback.

## 18) Phase 2 Acceptance Checklist

- [ ] Sidebar shows lock icons only on locked items for current tier
- [ ] All sidebar items remain clickable regardless of tier
- [ ] Courses & Enrollments fully accessible at every tier
- [ ] Apply for Coverage (My Credentials & Coverage) fully accessible at every tier
- [ ] Supplier Marketplace overlay renders below `md_eligible`
- [ ] Growth Studio overlay renders below `md_eligible`
- [ ] My Practice overlay renders below `full`
- [ ] Real page content visibly blurred behind overlay (not blank, not redirected)
- [ ] Overlay displays correct status badge + CTA per tier
- [ ] Promoting a tier removes overlay without a full page reload
- [ ] Phase 1 attendance flows still pass §6 checks

