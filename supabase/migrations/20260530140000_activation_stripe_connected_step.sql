-- Add "Is Stripe Connected" checklist step to the Activation phase (global catalog).
-- Manual mark-done only — no navigation or auto-check.

update public.launch_roadmap_phases
set steps = steps || jsonb_build_array(
  jsonb_build_object(
    'id', 'stripe_connected',
    'label', 'Is Stripe Connected',
    'desc', 'Required to collect patient deposits and card payments. Connect your Stripe account so NOVI can process bookings.',
    'priority', 255
  )
)
where phase_id = 'activation'
  and not exists (
    select 1
    from jsonb_array_elements(steps) step
    where step->>'id' = 'stripe_connected'
  );
