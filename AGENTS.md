
- Staff page access is defined once in src/lib/permissions.ts (ADMIN_PAGE_ROLES) and used by both routes and sidebar; DB access for staff roles is granted via additive RLS policies using private.has_role. Why: one source of truth, Wema/payment functions untouched.
