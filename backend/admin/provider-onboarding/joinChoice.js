import { query, pool } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";

let joinChoicesTableEnsured = false;

async function ensureProviderJoinChoicesTable() {
  if (joinChoicesTableEnsured) return;
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists public.provider_join_choices (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        choice text not null,
        auth_user_id uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        constraint provider_join_choices_choice_check
          check (choice in ('need_training', 'need_md_coverage', 'explore_skip'))
      );
    `);
    await client.query(`
      create index if not exists idx_provider_join_choices_choice
        on public.provider_join_choices (choice);
    `);
    joinChoicesTableEnsured = true;
  } finally {
    client.release();
  }
}

export const JOIN_CHOICES = new Set(["need_training", "need_md_coverage", "explore_skip"]);

export function joinChoiceLabel(choice) {
  if (choice === "need_md_coverage") return "Already certified — MD coverage";
  if (choice === "need_training") return "Needs certification / training";
  if (choice === "explore_skip") return "Skip — explore app";
  return "Unknown";
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function normalizeChoice({ choice, goal, explore_skip: exploreSkip }) {
  if (exploreSkip === true) return "explore_skip";
  const c = String(choice || goal || "").trim();
  if (JOIN_CHOICES.has(c)) return c;
  return null;
}

/**
 * Upsert one row per email with the latest Join-as-Provider choice.
 */
export async function upsertProviderJoinChoice({ email, choice, goal, explore_skip, authUserId }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedChoice = normalizeChoice({ choice, goal, explore_skip });
  if (!normalizedEmail) {
    const err = new Error("A valid email is required.");
    err.statusCode = 400;
    throw err;
  }
  if (!normalizedChoice) {
    const err = new Error("choice is required (need_training, need_md_coverage, or explore_skip).");
    err.statusCode = 400;
    throw err;
  }

  await ensureProviderJoinChoicesTable();

  const { rows } = await query(
    `insert into public.provider_join_choices (email, choice, auth_user_id)
     values ($1, $2, $3)
     on conflict (email)
     do update set
       choice = excluded.choice,
       auth_user_id = coalesce(excluded.auth_user_id, public.provider_join_choices.auth_user_id),
       updated_at = now()
     returning id, email, choice, auth_user_id, created_at, updated_at`,
    [normalizedEmail, normalizedChoice, authUserId || null]
  );

  const row = rows[0];
  return {
    ...row,
    label: joinChoiceLabel(row?.choice),
  };
}

export async function recordProviderJoinChoiceFromToken({ accessToken, choice, goal, explore_skip }) {
  if (!accessToken) {
    const err = new Error("Missing bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const me = await getMeFromAccessToken(accessToken);
  return upsertProviderJoinChoice({
    email: me.email,
    choice,
    goal,
    explore_skip,
    authUserId: me.id,
  });
}

export async function listProviderJoinChoices({ limit = 200 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const { rows } = await query(
    `select id, email, choice, auth_user_id, created_at, updated_at
       from public.provider_join_choices
      order by updated_at desc
      limit $1`,
    [safeLimit]
  );
  return rows.map((row) => ({
    ...row,
    label: joinChoiceLabel(row.choice),
  }));
}
