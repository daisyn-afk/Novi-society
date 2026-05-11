-- Add plain-text body column so admins can edit email content without touching HTML.
-- The rendering pipeline converts body_text to HTML and injects it into the master layout.
-- Nullable: existing rows continue to use body_html (legacy fallback).

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS body_text TEXT;
