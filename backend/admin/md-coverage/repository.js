import { query } from "../db.js";

let ensureTablesPromise = null;

export async function ensureMdCoverageTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await query(`
        create table if not exists public.md_subscriptions (
          id uuid primary key default gen_random_uuid(),
          provider_id text,
          provider_email text,
          provider_name text,
          service_type_id text,
          service_type_name text,
          status text not null default 'active',
          signed_at timestamptz,
          signed_by_name text,
          signature_data text,
          activated_at timestamptz,
          enrollment_id text,
          stripe_session_id text,
          stripe_payment_intent_id text,
          cancelled_at timestamptz,
          cancel_reason text,
          cancel_notes text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`);
      await query(`
        create table if not exists public.medical_director_relationships (
          id uuid primary key default gen_random_uuid(),
          provider_id text,
          provider_email text,
          provider_name text,
          medical_director_id text,
          medical_director_email text,
          medical_director_name text,
          service_type_id text,
          service_type_name text,
          status text not null default 'pending',
          supervision_notes text,
          start_date date,
          end_date date,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`);
      await query(`
        create table if not exists public.md_subscription_intents (
          id uuid primary key default gen_random_uuid(),
          provider_id text,
          provider_email text,
          payload jsonb not null default '{}'::jsonb,
          status text not null default 'pending',
          stripe_session_id text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`);
      await query(`
        create table if not exists public.notifications (
          id uuid primary key default gen_random_uuid(),
          user_id text,
          user_email text,
          type text not null default 'general',
          message text not null default '',
          link_page text,
          read_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`);
      await query(`alter table public.users add column if not exists setup_wizard_completed boolean not null default false`);
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }
  return ensureTablesPromise;
}

function mapSubscriptionRow(row) {
  if (!row) return null;
  return {
    ...row,
    created_date: row.created_at || null,
    updated_date: row.updated_at || null,
  };
}

function mapRelationshipRow(row) {
  if (!row) return null;
  return {
    ...row,
    created_date: row.created_at || null,
    updated_date: row.updated_at || null,
  };
}

function mapNotificationRow(row) {
  if (!row) return null;
  return {
    ...row,
    created_date: row.created_at || null,
    updated_date: row.updated_at || null,
  };
}

export async function listMdSubscriptions(filters = {}) {
  await ensureMdCoverageTables();
  const clauses = [];
  const params = [];
  if (filters.provider_id) {
    params.push(String(filters.provider_id));
    clauses.push(`provider_id = $${params.length}`);
  }
  if (filters.provider_email) {
    params.push(String(filters.provider_email).toLowerCase());
    clauses.push(`lower(provider_email) = $${params.length}`);
  }
  if (filters.status) {
    params.push(String(filters.status));
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const { rows } = await query(
    `select * from public.md_subscriptions ${where} order by created_at desc`,
    params
  );
  return (rows || []).map(mapSubscriptionRow);
}

export async function createMdSubscription(values) {
  await ensureMdCoverageTables();
  const { rows } = await query(
    `insert into public.md_subscriptions (
      provider_id, provider_email, provider_name, service_type_id, service_type_name,
      status, signed_at, signed_by_name, signature_data, activated_at, enrollment_id,
      stripe_session_id, stripe_payment_intent_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    returning *`,
    [
      values.provider_id || null,
      values.provider_email || null,
      values.provider_name || null,
      values.service_type_id || null,
      values.service_type_name || null,
      values.status || "active",
      values.signed_at || null,
      values.signed_by_name || null,
      values.signature_data || null,
      values.activated_at || null,
      values.enrollment_id || null,
      values.stripe_session_id || null,
      values.stripe_payment_intent_id || null,
    ]
  );
  return mapSubscriptionRow(rows[0]);
}

export async function updateMdSubscription(id, values) {
  await ensureMdCoverageTables();
  const allowed = [
    "status",
    "cancelled_at",
    "cancel_reason",
    "cancel_notes",
    "activated_at",
    "signature_data",
    "signed_at",
    "signed_by_name",
  ];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      params.push(values[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await query(`select * from public.md_subscriptions where id = $1 limit 1`, [id]);
    return mapSubscriptionRow(rows[0]);
  }
  sets.push("updated_at = now()");
  const { rows } = await query(
    `update public.md_subscriptions set ${sets.join(", ")} where id = $1 returning *`,
    params
  );
  return mapSubscriptionRow(rows[0]);
}

export async function listMedicalDirectorRelationships(filters = {}) {
  await ensureMdCoverageTables();
  const clauses = [];
  const params = [];
  if (filters.provider_id) {
    params.push(String(filters.provider_id));
    clauses.push(`provider_id = $${params.length}`);
  }
  if (filters.medical_director_id) {
    params.push(String(filters.medical_director_id));
    clauses.push(`medical_director_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(String(filters.status));
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const { rows } = await query(
    `select * from public.medical_director_relationships ${where} order by created_at desc`,
    params
  );
  return (rows || []).map(mapRelationshipRow);
}

export async function createMedicalDirectorRelationship(values) {
  await ensureMdCoverageTables();
  const { rows } = await query(
    `insert into public.medical_director_relationships (
      provider_id, provider_email, provider_name,
      medical_director_id, medical_director_email, medical_director_name,
      service_type_id, service_type_name, status, supervision_notes, start_date, end_date
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    returning *`,
    [
      values.provider_id || null,
      values.provider_email || null,
      values.provider_name || null,
      values.medical_director_id || null,
      values.medical_director_email || null,
      values.medical_director_name || null,
      values.service_type_id || null,
      values.service_type_name || null,
      values.status || "pending",
      values.supervision_notes || null,
      values.start_date || null,
      values.end_date || null,
    ]
  );
  return mapRelationshipRow(rows[0]);
}

export async function updateMedicalDirectorRelationship(id, values) {
  await ensureMdCoverageTables();
  const allowed = ["status", "supervision_notes", "start_date", "end_date", "service_type_id", "service_type_name"];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      params.push(values[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await query(`select * from public.medical_director_relationships where id = $1 limit 1`, [id]);
    return mapRelationshipRow(rows[0]);
  }
  sets.push("updated_at = now()");
  const { rows } = await query(
    `update public.medical_director_relationships set ${sets.join(", ")} where id = $1 returning *`,
    params
  );
  return mapRelationshipRow(rows[0]);
}

export async function deleteMedicalDirectorRelationship(id) {
  await ensureMdCoverageTables();
  await query(`delete from public.medical_director_relationships where id = $1`, [id]);
  return { success: true };
}

export async function listNotifications(filters = {}, { sort = "-created_at", limit = 50 } = {}) {
  await ensureMdCoverageTables();
  const clauses = [];
  const params = [];
  if (filters.user_id) {
    params.push(String(filters.user_id));
    clauses.push(`user_id = $${params.length}`);
  }
  if (filters.user_email) {
    params.push(String(filters.user_email).toLowerCase());
    clauses.push(`lower(user_email) = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const order = String(sort || "-created_at").startsWith("-") ? "desc" : "asc";
  const column = String(sort || "-created_at").replace(/^-/, "") || "created_at";
  const safeColumn = column === "created_date" ? "created_at" : column;
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { rows } = await query(
    `select * from public.notifications ${where} order by ${safeColumn} ${order} limit ${safeLimit}`,
    params
  );
  return (rows || []).map(mapNotificationRow);
}

export async function createNotification(values) {
  await ensureMdCoverageTables();
  const { rows } = await query(
    `insert into public.notifications (user_id, user_email, type, message, link_page)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [
      values.user_id || null,
      values.user_email || null,
      values.type || "general",
      values.message || "",
      values.link_page || null,
    ]
  );
  return mapNotificationRow(rows[0]);
}

export async function updateNotification(id, values) {
  await ensureMdCoverageTables();
  const allowed = ["read_at", "message", "link_page", "type"];
  const sets = [];
  const params = [id];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      params.push(values[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await query(`select * from public.notifications where id = $1 limit 1`, [id]);
    return mapNotificationRow(rows[0]);
  }
  sets.push("updated_at = now()");
  const { rows } = await query(
    `update public.notifications set ${sets.join(", ")} where id = $1 returning *`,
    params
  );
  return mapNotificationRow(rows[0]);
}

export async function createMdSubscriptionIntent(values) {
  await ensureMdCoverageTables();
  const { rows } = await query(
    `insert into public.md_subscription_intents (provider_id, provider_email, payload, status)
     values ($1,$2,$3::jsonb,$4)
     returning *`,
    [
      values.provider_id || null,
      values.provider_email || null,
      JSON.stringify(values.payload || {}),
      values.status || "pending",
    ]
  );
  return rows[0];
}

export async function getMdSubscriptionIntent(id) {
  await ensureMdCoverageTables();
  const { rows } = await query(`select * from public.md_subscription_intents where id = $1 limit 1`, [id]);
  return rows[0] || null;
}

export async function updateMdSubscriptionIntent(id, values) {
  await ensureMdCoverageTables();
  const sets = [];
  const params = [id];
  if (Object.prototype.hasOwnProperty.call(values, "status")) {
    params.push(values.status);
    sets.push(`status = $${params.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(values, "stripe_session_id")) {
    params.push(values.stripe_session_id);
    sets.push(`stripe_session_id = $${params.length}`);
  }
  if (!sets.length) return getMdSubscriptionIntent(id);
  sets.push("updated_at = now()");
  const { rows } = await query(
    `update public.md_subscription_intents set ${sets.join(", ")} where id = $1 returning *`,
    params
  );
  return rows[0] || null;
}

export async function setUserSetupWizardCompleted(userId, completed = true) {
  await ensureMdCoverageTables();
  if (!userId) return null;
  const { rows } = await query(
    `update public.users
     set setup_wizard_completed = $2, updated_at = now()
     where auth_user_id::text = $1 or id::text = $1
     returning auth_user_id::text as id, setup_wizard_completed`,
    [String(userId), Boolean(completed)]
  );
  return rows[0] || null;
}

export async function getUserSetupWizardCompleted(userId) {
  await ensureMdCoverageTables();
  if (!userId) return false;
  const { rows } = await query(
    `select setup_wizard_completed
     from public.users
     where auth_user_id::text = $1 or id::text = $1
     limit 1`,
    [String(userId)]
  );
  return Boolean(rows?.[0]?.setup_wizard_completed);
}
