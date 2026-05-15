# Feature: Provider CSV Patient Import — #105

## Overview

Providers can upload a CSV file containing their existing patients/clients and
have them automatically associated with the uploading provider as their default
provider. Patients can later search and select additional providers; this import
sets the initial association only.

Entry point: **My Practice → Patients tab → Import CSV button**

---

## What the Migration File Does

**File:** `supabase/migrations/20260516100000_provider_patients_table.sql`

This migration file is **not** about CSV parsing. It creates the
`provider_patients` table, which is the persistent store for provider–patient
relationships introduced by this feature. CSV parsing happens at runtime in the
backend; this file only defines the database schema needed to store the results
of each import.

### Table: `public.provider_patients`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, auto-generated |
| `provider_id` | `uuid NOT NULL` | FK → `public.users(id)` — the importing provider |
| `patient_user_id` | `uuid` | FK → `public.users(id)`, nullable — set if the patient already has a platform account |
| `email` | `text NOT NULL` | Patient's email; used as the deduplication key per provider |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `full_name` | `text` | Derived from first+last if not supplied directly |
| `phone` | `text` | |
| `date_of_birth` | `date` | |
| `gender` | `text` | |
| `is_default_provider` | `boolean NOT NULL DEFAULT true` | Marks this provider as the patient's default |
| `source` | `text` | `'csv_import'` or `'manual'`; constrained by CHECK |
| `import_batch_id` | `uuid` | Groups rows from a single import session for summary reporting |
| `created_at` / `updated_at` | `timestamptz` | Auto-managed; `updated_at` maintained by trigger |

**Unique constraint:** `unique(provider_id, email)` — a provider cannot have
two records for the same patient email. This is the deduplication key used by
`ON CONFLICT DO UPDATE` during import.

**Indexes:** `idx_provider_patients_provider_id`, `idx_provider_patients_email`

**Trigger:** `trg_provider_patients_updated_at` — reuses the existing
`public.set_updated_at_timestamp()` function defined in earlier migrations.

### Migration status

Applied to the remote Supabase database on 2026-05-16 via:
```
npx supabase db push --db-url <DATABASE_URL>
```

---

## Architecture

### Two data layers in this app

| Layer | Used for | Access |
|---|---|---|
| **base44 BaaS** | Appointments, treatment records, patient journeys | `base44.entities.*` in frontend |
| **Express + raw pg SQL** | Courses, licenses, enrollments, uploads, this feature | `backend/admin/*/routes.js` + `pg` Pool |

Imported patients live in the SQL layer (`provider_patients` table) and are
merged with appointment-derived patients on the frontend at display time.

---

## Files Changed / Created

### New: Database migration

```
supabase/migrations/20260516100000_provider_patients_table.sql
```

Creates the `provider_patients` table (see above).

---

### New: Backend — `backend/admin/provider-patients/`

#### `repository.js`

Pure DB functions, no HTTP concerns.

| Export | Description |
|---|---|
| `getUserDbIdByAuthUserId(authUserId)` | Resolves `users.id` (PK) from a Supabase `auth_user_id` |
| `listProviderPatients(providerDbId)` | Returns all rows for a provider, ordered by `created_at desc` |
| `bulkUpsertProviderPatients(providerDbId, rows, batchId)` | Upserts up to 500 rows; returns `{ imported, skipped, failed, errors }` |
| `validateEmail(email)` | Simple regex check |

**Bulk upsert logic:**
1. Deduplicate rows within the incoming batch by email (keep last).
2. Pre-resolve `patient_user_id` for all emails via a single `WHERE email = ANY(...)` query.
3. Per-row `INSERT ... ON CONFLICT (provider_id, email) DO UPDATE`.
4. Uses PostgreSQL's `(xmax = 0) AS was_inserted` to distinguish new vs updated rows.
5. Per-row errors are caught individually; the rest of the batch continues.

#### `routes.js`

Express router exported as `providerPatientsRouter`. All three routes verify
the bearer token via `getMeFromAccessToken` and resolve `users.id` from
`auth_user_id` before touching the DB. The `provider_id` is **always** taken
from the token, never from the request body.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/admin/provider-patients/csv-parse` | Bearer | Accepts `multipart/form-data` CSV. Parses with `csv-parse`. Returns `{ headers, rows, preview, totalRows }`. No DB writes. |
| `POST` | `/admin/provider-patients/csv-import` | Bearer | Accepts `{ rows, mapping }` JSON. Validates, maps fields, bulk-upserts. Returns import summary. |
| `GET` | `/admin/provider-patients` | Bearer | Returns all patients for the authenticated provider. |

**CSV parse constraints:** `.csv` MIME only, 1 MB max, 500 row limit enforced
on both the parse and import endpoints.

**Dependency added:** `csv-parse` (npm) — no CSV library existed in the project
before this feature.

---

### Modified: `backend/admin/app.js`

Added import and mount:

```js
const { providerPatientsRouter } = await import("./provider-patients/routes.js");
// ...
app.use("/admin/provider-patients", providerPatientsRouter);
```

---

### New: Frontend API client — `src/api/providerPatientsApi.js`

Thin wrappers over the existing `adminApiRequest` utility.

| Function | HTTP | Description |
|---|---|---|
| `parseProviderPatientsCsv(file)` | `POST /admin/provider-patients/csv-parse` | Sends `FormData` |
| `importProviderPatients(rows, mapping)` | `POST /admin/provider-patients/csv-import` | Sends JSON |
| `listProviderPatients()` | `GET /admin/provider-patients` | |

---

### New: `src/components/practice/CSVImportWizard.jsx`

A 4-step `Dialog` (shadcn) wizard. State is fully local; no global state or
external form library — consistent with the project's existing patterns.

#### Step 1 — Upload

- Drag-and-drop zone or click-to-browse file input (`.csv` only).
- On file selection, POSTs to `/admin/provider-patients/csv-parse`.
- Shows spinner while parsing; displays detected row count on success.
- Shows error message if parse fails or file exceeds limits.

#### Step 2 — Map Columns

- Renders a `<Select>` (shadcn) for each of the 6 system fields:
  `email*`, `first_name`, `last_name`, `phone`, `date_of_birth`, `gender`.
- Dropdown options are the CSV column headers returned by the parse step.
- Auto-suggests mappings by fuzzy name matching on load
  (e.g. "Email Address" → `email`, "Mobile" → `phone`).
- "Next" button is disabled until `email` is mapped (the only required field).

#### Step 3 — Preview

- Applies the current mapping to the first 10 rows and renders them in a
  shadcn `Table`.
- Rows missing an email value are highlighted in red.
- Shows "+ N more rows not shown" if total > 10.
- "Import N Patients" button POSTs all rows + mapping to the import endpoint.

#### Step 4 — Summary

- Displays a 2×2 stat grid: Total rows / Imported / Skipped (existing) / Failed.
- "Imported" is green, "Failed" is red if > 0.
- Lists each failed row with row number, email, and error reason.
- Closing the dialog calls `queryClient.invalidateQueries({ queryKey: ["provider-patients"] })`
  so the patient list refreshes automatically.

---

### Modified: `src/components/practice/PracticePatientsTab.jsx`

1. **Import CSV button** — added next to the search input; opens the wizard.
2. **Empty state CTA** — when no patients exist and search is empty, shows an
   "Import patients from CSV" button in the empty state.
3. **Defensive `appointments` access** — changed `p.appointments.filter(...)` to
   `(p.appointments || []).filter(...)` to handle imported-only patients who
   have no appointment history yet.
4. Added `CSVImportWizard` rendered at the bottom (closed by default).

---

### Modified: `src/pages/ProviderPractice.jsx`

Added `listProviderPatients` import and a second TanStack Query:

```js
const { data: importedPatients = [] } = useQuery({
  queryKey: ["provider-patients"],
  queryFn: listProviderPatients,
  enabled: !!me,
});
```

Replaced the simple `appointments.reduce(...)` patient derivation with a
**two-source merge**:

1. Build `appointmentPatientMap` from base44 `Appointment` rows (keyed by
   lowercase email).
2. Iterate `importedPatients` from SQL; for any email not already in the map,
   add a new entry with `appointments: []`.
3. `Object.values(appointmentPatientMap)` produces the final merged list.

Patients who have both an appointment history and a CSV import show once (the
appointment data wins — richer). Patients imported only via CSV appear with
`0 treatments`.

---

## Duplicate Handling

| Scenario | Behavior |
|---|---|
| Same email re-imported by same provider | `ON CONFLICT DO UPDATE` — fields are refreshed, row counted as **skipped** in summary |
| Two rows with same email in one CSV | Deduplicated in backend before upsert (last row wins); reported as 1 row |
| Patient email already in `users` table | `patient_user_id` is set to the existing `users.id` on insert |
| Patient later books an appointment | Frontend merge by email key; appointment data enriches the existing entry |

---

## Security / Permission Scope

- All three backend routes require a valid `Authorization: Bearer <token>`.
- `provider_id` is **always** derived from the token — never trusted from the
  request body.
- All SQL queries filter by `WHERE provider_id = $providerDbId`.
- The CSV parse route writes no data to the DB, so there is no cross-provider
  risk even if a token is misused there.

---

## Scalability (MVP limits)

| Constraint | Value |
|---|---|
| Max CSV file size | 1 MB |
| Max rows per import | 500 |
| Processing model | Synchronous (no job queue) |
| Insert strategy | Per-row upsert in a loop (adequate for ≤ 500 rows) |

For future scale (10k+ rows), replace the per-row loop in `bulkUpsertProviderPatients`
with a multi-row `UNNEST`-based insert and consider a background job queue.
