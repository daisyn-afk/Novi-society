import { query } from "../db.js";

const SELECT_COLUMNS = `
  id,
  name,
  trigger,
  recipient_type,
  subject,
  body_text,
  body_html,
  is_active,
  send_delay_minutes,
  total_sent,
  last_sent_at,
  created_at,
  updated_at
`;

function normalizePayload(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    trigger: String(payload.trigger || "").trim(),
    recipient_type: String(payload.recipient_type || "provider").trim(),
    subject: String(payload.subject || "").trim(),
    body_text: String(payload.body_text || "").trim() || null,
    is_active: payload.is_active !== false,
    send_delay_minutes: Number(payload.send_delay_minutes) || 0,
  };
}

export async function listEmailTemplates() {
  const { rows } = await query(
    `select ${SELECT_COLUMNS}
     from public.email_templates
     order by created_at desc`
  );
  return rows;
}

export async function getEmailTemplate(id) {
  const { rows } = await query(
    `select ${SELECT_COLUMNS} from public.email_templates where id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getActiveEmailTemplateByTrigger(trigger) {
  const normalized = String(trigger || "").trim();
  if (!normalized) return null;
  const { rows } = await query(
    `select ${SELECT_COLUMNS}
     from public.email_templates
     where trigger = $1
       and is_active = true
     order by updated_at desc, created_at desc
     limit 1`,
    [normalized]
  );
  return rows[0] || null;
}

export async function createEmailTemplate(payload) {
  const d = normalizePayload(payload);
  const { rows } = await query(
    `insert into public.email_templates
       (name, trigger, recipient_type, subject, body_text, is_active, send_delay_minutes)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning ${SELECT_COLUMNS}`,
    [d.name, d.trigger, d.recipient_type, d.subject, d.body_text, d.is_active, d.send_delay_minutes]
  );
  return rows[0];
}

export async function updateEmailTemplate(id, payload) {
  const d = normalizePayload(payload);
  // If the caller supplies an explicit new body_html (admin edited body_text), use it.
  // If clear_body_html is true, set to null (plain-text fallback mode).
  // Otherwise keep the existing body_html untouched.
  const clearBodyHtml = Boolean(payload?.clear_body_html);
  const newBodyHtml = (payload?.new_body_html && String(payload.new_body_html).trim()) || null;
  const { rows } = await query(
    `update public.email_templates
     set name               = $2,
         trigger            = $3,
         recipient_type     = $4,
         subject            = $5,
         body_text          = $6,
         body_html          = case
                                when $9::boolean then null
                                when $10::text is not null then $10::text
                                else body_html
                              end,
         is_active          = $7,
         send_delay_minutes = $8
     where id = $1
     returning ${SELECT_COLUMNS}`,
    [id, d.name, d.trigger, d.recipient_type, d.subject, d.body_text, d.is_active, d.send_delay_minutes, clearBodyHtml, newBodyHtml]
  );
  return rows[0] || null;
}

export async function deleteEmailTemplate(id) {
  const { rowCount } = await query(
    `delete from public.email_templates where id = $1`,
    [id]
  );
  return rowCount > 0;
}

export async function incrementTemplateSentCount(id) {
  await query(
    `update public.email_templates
     set total_sent   = total_sent + 1,
         last_sent_at = now()
     where id = $1`,
    [id]
  );
}
