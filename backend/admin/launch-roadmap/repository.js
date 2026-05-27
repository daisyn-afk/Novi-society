import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { query } from "../db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PHASES = JSON.parse(
  readFileSync(join(__dirname, "seedPhases.json"), "utf8")
);

function rowToApi(row) {
  return {
    id: row.phase_id,
    label: row.label,
    description: row.description,
    color: row.color,
    textColor: row.text_color,
    icon: row.icon,
    sort_order: row.sort_order,
    steps: Array.isArray(row.steps) ? row.steps : [],
    is_active: row.is_active !== false,
  };
}

export async function seedDefaultPhasesIfEmpty() {
  const { rows } = await query(
    `select count(*)::int as count from public.launch_roadmap_phases`
  );
  if ((rows[0]?.count || 0) > 0) return false;

  for (const phase of SEED_PHASES) {
    await query(
      `insert into public.launch_roadmap_phases (
        phase_id, label, description, color, text_color, icon, sort_order, steps
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        phase.phase_id,
        phase.label,
        phase.description,
        phase.color,
        phase.text_color,
        phase.icon,
        phase.sort_order,
        JSON.stringify(phase.steps || []),
      ]
    );
  }
  return true;
}

export async function listActivePhases() {
  await seedDefaultPhasesIfEmpty();
  const { rows } = await query(
    `select *
     from public.launch_roadmap_phases
     where is_active = true
     order by sort_order asc, phase_id asc`
  );
  return (rows || []).map(rowToApi);
}

export async function replacePhase(phaseId, payload) {
  const { rows } = await query(
    `update public.launch_roadmap_phases
     set label = $2,
         description = $3,
         color = $4,
         text_color = $5,
         icon = $6,
         sort_order = $7,
         steps = $8::jsonb,
         is_active = coalesce($9, is_active)
     where phase_id = $1
     returning *`,
    [
      phaseId,
      payload.label,
      payload.description,
      payload.color,
      payload.text_color || payload.textColor,
      payload.icon,
      payload.sort_order ?? payload.sortOrder ?? 0,
      JSON.stringify(payload.steps || []),
      payload.is_active,
    ]
  );
  return rows[0] ? rowToApi(rows[0]) : null;
}

export async function getProviderLaunchChecklist(providerId) {
  const { rows } = await query(
    `select launch_checklist
     from public.provider_launch_roadmap_progress
     where provider_id = $1
     limit 1`,
    [providerId]
  );
  const checklist = rows[0]?.launch_checklist;
  return checklist && typeof checklist === "object" && !Array.isArray(checklist) ? checklist : {};
}

export async function upsertProviderLaunchChecklist(providerId, checklist) {
  const safeChecklist = checklist && typeof checklist === "object" && !Array.isArray(checklist)
    ? checklist
    : {};
  const { rows } = await query(
    `insert into public.provider_launch_roadmap_progress (provider_id, launch_checklist)
     values ($1, $2::jsonb)
     on conflict (provider_id) do update set
       launch_checklist = excluded.launch_checklist,
       updated_at = now()
     returning launch_checklist`,
    [providerId, JSON.stringify(safeChecklist)]
  );
  return rows[0]?.launch_checklist || {};
}
