-- Admin moderation for patient reviews (approve / flag / delete).

alter table if exists public.reviews
  add column if not exists is_flagged boolean not null default false,
  add column if not exists flag_reason text;

create index if not exists idx_reviews_is_flagged on public.reviews (is_flagged);
