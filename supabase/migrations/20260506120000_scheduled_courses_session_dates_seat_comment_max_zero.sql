-- Refresh session_dates column comment: max_seats may be 0 (no capacity / sold out) per app validation.
-- Idempotent COMMENT ON only; does not alter table data.

comment on column public.scheduled_courses.session_dates is
  'JSON array of session/day entries. Each dated entry should include max_seats (integer >= 0) and available_seats (integer from 0 through max_seats) for public booking; missing or invalid values are treated as sold out in the application.';
