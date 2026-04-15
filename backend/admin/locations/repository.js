import { query } from "../db.js";

const COLUMNS = `
  id,
  created_at,
  updated_at,
  venue_name,
  street_address,
  city,
  state,
  zip_code,
  is_active
`;

let schemaReadyPromise = null;

function formatLocationRow(row) {
  const venue = row.venue_name?.trim() || "";
  const cityState = [row.city?.trim(), row.state?.trim()].filter(Boolean).join(", ");
  return {
    ...row,
    display_name: [venue, cityState].filter(Boolean).join(" - "),
  };
}

async function ensureLocationsSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    await query(`create extension if not exists pgcrypto`);
    await query(`
      create table if not exists public.course_locations (
        id uuid primary key default gen_random_uuid(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        venue_name text not null,
        street_address text,
        city text not null,
        state text not null,
        zip_code text,
        is_active boolean not null default true
      )
    `);
    await query(`
      create index if not exists idx_course_locations_lookup
      on public.course_locations (lower(venue_name), lower(city), lower(state))
    `);
    await query(`
      create or replace function public.set_course_locations_updated_at()
      returns trigger as $$
      begin
        new.updated_at = now();
        return new;
      end;
      $$ language plpgsql
    `);
    await query(`
      drop trigger if exists trg_course_locations_updated_at on public.course_locations
    `);
    await query(`
      create trigger trg_course_locations_updated_at
      before update on public.course_locations
      for each row execute function public.set_course_locations_updated_at()
    `);
  })();

  return schemaReadyPromise;
}

export async function listLocations({ search = "", limit = 50 } = {}) {
  await ensureLocationsSchema();
  const cleanSearch = (search || "").trim();
  const clampedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const values = [];
  const where = [`is_active = true`];

  if (cleanSearch) {
    values.push(`%${cleanSearch}%`);
    const idx = values.length;
    where.push(`
      (
        venue_name ilike $${idx}
        or city ilike $${idx}
        or state ilike $${idx}
        or coalesce(street_address, '') ilike $${idx}
        or coalesce(zip_code, '') ilike $${idx}
      )
    `);
  }

  values.push(clampedLimit);

  const { rows } = await query(
    `
      select ${COLUMNS}
      from public.course_locations
      where ${where.join(" and ")}
      order by venue_name asc, city asc, state asc
      limit $${values.length}
    `,
    values
  );

  return rows.map(formatLocationRow);
}

export async function createLocation(payload) {
  await ensureLocationsSchema();

  const normalized = {
    venue_name: (payload.venue_name || "").trim(),
    street_address: (payload.street_address || "").trim() || null,
    city: (payload.city || "").trim(),
    state: (payload.state || "").trim().toUpperCase(),
    zip_code: (payload.zip_code || "").trim() || null,
  };

  const existing = await query(
    `
      select ${COLUMNS}
      from public.course_locations
      where lower(venue_name) = lower($1)
        and lower(city) = lower($2)
        and lower(state) = lower($3)
        and lower(coalesce(street_address, '')) = lower(coalesce($4, ''))
        and lower(coalesce(zip_code, '')) = lower(coalesce($5, ''))
      limit 1
    `,
    [
      normalized.venue_name,
      normalized.city,
      normalized.state,
      normalized.street_address,
      normalized.zip_code,
    ]
  );

  if (existing.rows[0]) {
    return formatLocationRow(existing.rows[0]);
  }

  const { rows } = await query(
    `
      insert into public.course_locations (
        venue_name,
        street_address,
        city,
        state,
        zip_code
      )
      values ($1, $2, $3, $4, $5)
      returning ${COLUMNS}
    `,
    [
      normalized.venue_name,
      normalized.street_address,
      normalized.city,
      normalized.state,
      normalized.zip_code,
    ]
  );

  return formatLocationRow(rows[0]);
}
