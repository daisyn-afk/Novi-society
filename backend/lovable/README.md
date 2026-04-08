# Lovable Backend Scaffold

This folder is a migration scaffold for replacing Base44 functions.

## Current contents

- `src/functionHandlers.ts`: endpoint parity registry with explicit TODO stubs.

## Next steps

1. Implement handlers in domain modules (`payments`, `subscriptions`, `compliance`, etc.).
2. Expose `POST /functions/:name` and webhook routes listed in `docs/migration/backend-function-mapping.md`.
3. Add contract tests per migrated function before enabling `VITE_APP_API_PROVIDER=lovable`.

