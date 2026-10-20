
- Staff page access is defined once in src/lib/permissions.ts (ADMIN_PAGE_ROLES) and used by both routes and sidebar; DB access for staff roles is granted via additive RLS policies using private.has_role. Why: one source of truth, Wema/payment functions untouched.
- Simulator payments (TEST_ refs or metadata.simulation) are excluded from every live total via `src/lib/simulation.ts` and DB `is_simulated_transaction`. Why: test money must never mix with real settlement figures.
- Frontend tests run with `bun run test` (Vitest, `vitest.config.ts`, only `src/**`); edge function tests use Deno. Why: Vitest cannot load Deno https imports.
