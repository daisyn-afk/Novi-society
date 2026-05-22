-- Add 'staff' role and per-user permissions column

-- Extend the role CHECK constraint to include 'staff'
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('provider', 'patient', 'medical_director', 'admin', 'staff'));

-- Add nullable permissions JSONB column (only populated for staff users)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;
