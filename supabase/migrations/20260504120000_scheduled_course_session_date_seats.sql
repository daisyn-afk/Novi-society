-- Per-date seat capacity is stored on each object in `scheduled_courses.session_dates`:
--   max_seats (required, integer >= 1) and available_seats (required, integer 0..max_seats).
-- Missing or invalid seat fields are treated as sold out in the app until corrected in admin.
--
-- No DDL change: `session_dates` has been jsonb since 20260413160004_scheduled_courses.sql.
-- Course-level `max_seats` / `available_seats` on this table are deprecated for new scheduled
-- course saves (the app nulls them); legacy rows may still use them until re-saved in admin.

comment on column public.scheduled_courses.session_dates is
  'JSON array of session/day entries. Each entry with a date should include max_seats (>=1) and available_seats (0..max) for public booking.';

comment on column public.scheduled_courses.max_seats is
  'Deprecated for scheduled-course capacity: prefer session_dates[].max_seats. May remain set on legacy rows.';

comment on column public.scheduled_courses.available_seats is
  'Deprecated for scheduled-course capacity: prefer session_dates[].available_seats. May remain set on legacy rows.';
