create extension if not exists pgcrypto;

create table if not exists public.course_promo_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  max_uses integer,
  times_used integer not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz
);

create index if not exists idx_course_promo_codes_active on public.course_promo_codes(active);

create table if not exists public.pre_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  order_type text not null default 'course',
  type text not null default 'course',
  status text not null default 'pending_payment',

  course_id uuid references public.scheduled_courses(id) on delete set null,
  course_title text,
  course_date text,

  customer_name text not null,
  customer_email text not null,
  first_name text,
  last_name text,
  phone text,

  license_type text,
  license_number text,
  license_image_url text,

  terms_confirmed boolean not null default false,
  refund_policy_confirmed boolean not null default false,

  promo_code text,
  promo_code_id uuid references public.course_promo_codes(id) on delete set null,

  amount_subtotal numeric,
  amount_discount numeric not null default 0,
  amount_paid numeric not null default 0,
  currency text not null default 'usd',

  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_checkout_url text,

  paid_at timestamptz,
  notes text
);

create index if not exists idx_pre_orders_status on public.pre_orders(status);
create index if not exists idx_pre_orders_customer_email on public.pre_orders(customer_email);
create index if not exists idx_pre_orders_course_id on public.pre_orders(course_id);
create unique index if not exists idx_pre_orders_stripe_session_id on public.pre_orders(stripe_session_id) where stripe_session_id is not null;

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  course_id uuid references public.scheduled_courses(id) on delete set null,
  pre_order_id uuid references public.pre_orders(id) on delete set null,
  provider_id uuid,

  provider_name text,
  provider_email text not null,
  customer_name text,

  status text not null default 'paid',
  session_date text,
  amount_paid numeric,
  paid_at timestamptz
);

create index if not exists idx_enrollments_course_id on public.enrollments(course_id);
create index if not exists idx_enrollments_provider_email on public.enrollments(provider_email);
create index if not exists idx_enrollments_status on public.enrollments(status);

create table if not exists public.course_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  pre_order_id uuid references public.pre_orders(id) on delete set null,
  enrollment_id uuid references public.enrollments(id) on delete set null,
  course_id uuid references public.scheduled_courses(id) on delete set null,
  course_title text,

  customer_name text,
  customer_email text,
  linked_user_id uuid,

  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,

  amount_total numeric,
  amount_subtotal numeric,
  currency text default 'usd',

  billing_name text,
  billing_email text,
  billing_phone text,
  billing_address jsonb,
  stripe_metadata jsonb not null default '{}'::jsonb,

  status text not null default 'completed',
  was_new_user boolean not null default false,
  confirmation_email_sent boolean not null default false
);

create index if not exists idx_course_payments_pre_order_id on public.course_payments(pre_order_id);
create index if not exists idx_course_payments_course_id on public.course_payments(course_id);
create index if not exists idx_course_payments_customer_email on public.course_payments(customer_email);
create unique index if not exists idx_course_payments_stripe_session_id on public.course_payments(stripe_session_id) where stripe_session_id is not null;

create or replace function public.set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_course_promo_codes_updated_at on public.course_promo_codes;
create trigger trg_course_promo_codes_updated_at
before update on public.course_promo_codes
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_pre_orders_updated_at on public.pre_orders;
create trigger trg_pre_orders_updated_at
before update on public.pre_orders
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_enrollments_updated_at on public.enrollments;
create trigger trg_enrollments_updated_at
before update on public.enrollments
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_course_payments_updated_at on public.course_payments;
create trigger trg_course_payments_updated_at
before update on public.course_payments
for each row execute function public.set_updated_at_timestamp();
