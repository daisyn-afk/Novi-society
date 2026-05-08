-- Documents per-date seat inventory on scheduled_courses.session_dates (max_seats, available_seats).
-- Does not modify table data or prior migrations. Re-applying COMMENT ON is idempotent.

comment on column public.scheduled_courses.session_dates is
  'JSON array of session/day entries. Each dated entry should include max_seats (integer >= 1) and available_seats (integer from 0 through max_seats) for public booking; missing or invalid values are treated as sold out in the application.';

comment on column public.scheduled_courses.max_seats is
  'Course-level seat cap deprecated for scheduled courses: capacity is tracked per session_dates[]. Legacy rows may still set this until re-saved via admin.';

comment on column public.scheduled_courses.available_seats is
  'Course-level available seats deprecated for scheduled courses: use session_dates[].available_seats. Legacy rows may still set this until re-saved via admin.';
