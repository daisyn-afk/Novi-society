-- Add structured content columns to email_templates.
-- These allow admins to edit heading, body, CTA, and footer as separate
-- fields without touching raw HTML. The rendering pipeline composes them
-- into the master email layout at send time.
--
-- Backward-compatible: all columns are nullable. Rows where body_content
-- IS NULL continue to use the existing body_html column (legacy path).

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS heading      TEXT,
  ADD COLUMN IF NOT EXISTS body_content TEXT,
  ADD COLUMN IF NOT EXISTS cta_text     TEXT,
  ADD COLUMN IF NOT EXISTS cta_url      TEXT,
  ADD COLUMN IF NOT EXISTS footer_note  TEXT;
