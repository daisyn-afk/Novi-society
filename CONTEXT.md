# NOVI Provider Portal — Domain Glossary

## Growth Studio

The provider-facing launch program (`ProviderLaunchPad`). Guides providers through four phases to go from legal readiness to scaling their practice.

## Launch Roadmap Phase

A named stage in Growth Studio (Foundation, Activation, Growth, Scale). **Phase definitions are global** — every provider sees the same steps and copy, stored in `launch_roadmap_phases`.

## Launch Roadmap Step

A single action inside a phase (e.g. "License Verified by NOVI Admin", "Complete Your Profile"). Steps may auto-complete from provider data or be marked done manually. Embedded tools and steps marked Soon do not count toward progress percentages.

## Launch Roadmap Phase (Coming Soon)

A phase visible in Growth Studio but locked from interaction — excluded from overall progress and phase completion counts. The Scale phase is currently Coming Soon.

## Manual Launch Step

A step with no automatic verification (e.g. "Form an LLC", "Add MD to Insurance Policy"). The provider self-attests completion in Growth Studio. When this step is the Next Best Action, the Next Step bar routes to Growth Studio so the provider can review and mark it done — no admin gate required.

## Provider Launch Progress

**Per-provider** completion state. Manual checklist items live in `provider_launch_roadmap_progress.launch_checklist`. Auto-checked steps derive from each provider's licenses, certifications, profile, and services.

## Next Best Action

The lowest-priority incomplete step across all phases — the single recommended next move for a provider. Shown in the **Growth Studio hero** with full description and a Start action.

## Next Step Bar

A persistent reminder strip at the **top of every provider portal page** (including Growth Studio). Shows the same underlying action as Next Best Action in compact form and navigates to the right destination when clicked.

## Ready to Go Live

Operational launch readiness — distinct from overall roadmap progress. Measured as completion of six gates: license verified, MD on MPI, public profile (bio + photo + city), live treatments, deposit/cancellation policy, and booking link readiness (practice name or bio). When all six are complete, the provider is **Ready to Accept Patients**.
