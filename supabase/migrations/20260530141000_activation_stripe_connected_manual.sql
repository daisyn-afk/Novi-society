-- Normalize stripe_connected step: manual mark-done, no redirect/auto-check.

update public.launch_roadmap_phases
set steps = (
  select coalesce(
    jsonb_agg(
      case
        when step->>'id' = 'stripe_connected' then jsonb_build_object(
          'id', 'stripe_connected',
          'label', 'Is Stripe Connected',
          'desc', 'Required to collect patient deposits and card payments. Connect your Stripe account so NOVI can process bookings.',
          'priority', 255
        )
        else step
      end
      order by coalesce((step->>'priority')::int, 999)
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(steps) step
)
where phase_id = 'activation'
  and exists (
    select 1
    from jsonb_array_elements(steps) step
    where step->>'id' = 'stripe_connected'
  );
