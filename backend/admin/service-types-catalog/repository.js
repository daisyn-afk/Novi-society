import { query } from "../db.js";

/** Map DB row to CourseTemplateForm / legacy Base44-like shape (rich fields in metadata). */
function rowToApi(row) {
  const m = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    is_active: m.is_active !== false,
    md_agreement_text: m.md_agreement_text ?? "",
    scope_rules: Array.isArray(m.scope_rules) ? m.scope_rules : [],
    allowed_areas: Array.isArray(m.allowed_areas) ? m.allowed_areas : [],
  };
}

export async function listServiceTypesForAdmin() {
  const { rows } = await query(
    `select id, name, category, metadata from public.service_type order by name asc`
  );
  return rows.map(rowToApi);
}
