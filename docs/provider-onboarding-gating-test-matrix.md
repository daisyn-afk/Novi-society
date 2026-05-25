# Provider Onboarding Gating Test Matrix

## Scenarios

### 1) Admin-invited provider (new, incomplete onboarding)
- Preconditions:
  - `role=provider`
  - No `provider_basic_onboarding` row
  - No verified license/certification/MD subscription
- Steps:
  - Use invite link
  - Set password
  - Complete login flow
- Expected:
  - Redirect to `ProviderBasicOnboarding`
  - `ProviderDashboard` direct URL redirects to `ProviderBasicOnboarding`

### 2) Provider with onboarding in progress
- Preconditions:
  - `role=provider`
  - No completed basic onboarding
- Steps:
  - Login from `/login`
  - Try `/ProviderDashboard`
- Expected:
  - Routed to `ProviderBasicOnboarding`
  - No dashboard access until onboarding submitted

### 3) Provider with completed basic onboarding
- Preconditions:
  - `role=provider`
  - `provider_basic_onboarding.has_completed_basic=true`
- Steps:
  - Login normally
  - Set-password flow (if relevant)
- Expected:
  - Redirect to `ProviderDashboard`
  - Dashboard route remains accessible

### 4) Legacy active provider without basic onboarding row
- Preconditions:
  - `role=provider`
  - No basic onboarding row
  - At least one legacy activation signal:
    - verified license, or
    - active certification, or
    - active MD subscription
- Steps:
  - Login and access dashboard
- Expected:
  - Dashboard access allowed (backward compatibility)
  - No forced redirect loop to onboarding

### 5) Non-provider roles regression check
- Preconditions:
  - User role is `admin`, `staff`, `patient`, or `medical_director`
- Steps:
  - Login through existing flow
- Expected:
  - Existing role-based dashboard redirects unchanged
  - No provider-onboarding checks applied

### 6) `next=` safety check for provider
- Preconditions:
  - Incomplete provider as in scenario 1
- Steps:
  - Login with `?next=/ProviderDashboard`
- Expected:
  - Redirect still forced to `ProviderBasicOnboarding`

### 7) Route-guard safety check
- Preconditions:
  - Incomplete provider as in scenario 1
- Steps:
  - Open `/ProviderDashboard` directly after session is active
- Expected:
  - Route guard redirects to `ProviderBasicOnboarding`
