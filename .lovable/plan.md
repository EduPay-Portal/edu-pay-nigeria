## Fix 404s on Parent sidebar links

The Parent sidebar links to `/dashboard/parent/children` and `/dashboard/parent/transactions`, but neither route is registered in `src/App.tsx`, so both hit the catch-all `NotFound` page.

### Changes

1. **Create `src/pages/dashboard/ParentChildrenPage.tsx`**
   - Reuse the children-fetching query already in `ParentDashboard.tsx` (children with profile + wallet + virtual account).
   - Render the same "Children Details" card list currently shown in the Parent dashboard's "Children" tab, as a standalone page with a page header.

2. **Create `src/pages/dashboard/ParentTransactionsPage.tsx`**
   - Fetch the parent's children, then their transactions (same query as the dashboard).
   - Render `TransactionTable` inside a Card with a page header. Show empty state if no children/transactions.

3. **Register routes in `src/App.tsx`** under the existing `/dashboard` protected layout, both gated to `allowedRoles={['parent']}`:
   - `parent/children` → `ParentChildrenPage`
   - `parent/transactions` → `ParentTransactionsPage`

### Out of scope
- No sidebar, dashboard, or backend changes.
- Existing Parent dashboard tabs remain unchanged (the new pages mirror that content for direct navigation).
