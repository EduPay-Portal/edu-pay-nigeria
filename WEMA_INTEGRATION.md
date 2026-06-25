# Wema Bank Direct DVA Integration

> **2026 UPDATE:** Paystack integration has been fully deprecated. Wema Bank DVA
> is the **sole** payment provider. Card top-ups via Paystack have been removed;
> wallets are funded exclusively via bank transfer to dedicated Wema NUBANs.

This platform uses **direct Wema Bank Virtual NUBANs** as the sole collection
method for student fees.


## Architecture

```
Frontend ─► Edge Functions ─► Provider Abstraction ─► Wema / Paystack
                │                       │
                ▼                       ▼
         Supabase DB           Webhook events / Reconciliation
```

All providers implement `DVAProvider` in
`supabase/functions/_shared/payments/types.ts`. Resolution goes through
`registry.ts`. Adding a new bank (Zenith, GTB, …) means dropping a new
file in `providers/` and registering it.

## Edge functions

| Function | Purpose |
|---|---|
| `dva-create` | Provider-agnostic DVA creation. Defaults to Wema. |
| `create-virtual-account` | Backward-compat shim → forwards to `dva-create`. |
| `bulk-create-virtual-accounts` | Bulk creation (sequential, 2s delay, exp. backoff). |
| `dva-reissue` | Reissue Wema NUBANs for students missing an active Wema DVA. |
| `wema-webhook` | Receives Wema bank-transfer notifications. HMAC + IP allowlist + idempotent. |
| `paystack-webhook` | Card top-ups only (`charge.success` from Paystack Inline). |
| `reconcile-transactions` | Admin: counts + manual match override. |

## Database

New columns / tables added in the Wema refactor migration:

- `virtual_accounts.{provider, provider_account_id, provider_customer_id, environment, status, assigned_at, metadata}`
- `transactions.{provider_reference, settlement_id, payer_*, match_status}`
- `webhook_events` — multi-provider webhook log
- `reconciliation_logs` — auto/manual/unmatched/over/under/duplicate
- `settlements` — daily settlement tracking
- `audit_logs` — sensitive admin actions

Unique indexes on `(provider, provider_reference)` give us idempotency
across both `transactions` and `webhook_events`.

## Going live with Wema

When sandbox credentials arrive from Wema:

1. Add these secrets via Lovable Cloud → Backend → Secrets:
   - `WEMA_BASE_URL` (e.g. `https://playground.alat.ng/api/...`)
   - `WEMA_API_KEY`
   - `WEMA_CLIENT_ID`
   - `WEMA_CLIENT_SECRET`
   - `WEMA_WEBHOOK_SECRET`
   - `WEMA_ALLOWED_IPS` (comma-separated)
   - `WEMA_ENV` (`sandbox` or `production`)
   - `WEMA_LIVE` = `true`
2. Configure the webhook URL inside Wema's portal:
   `https://<project-ref>.functions.supabase.co/wema-webhook`
3. From `/dashboard/admin/dva` click **Re-issue Wema DVAs** to mint
   real NUBANs for existing students (sequential, 2s delay, batches of 50).
4. Use the **Payment Simulator** to fire a sample Wema webhook payload
   end-to-end in sandbox before flipping to production.

## Security

- HMAC-SHA512 on every Wema webhook (header: `x-wema-signature`).
- Optional IP allowlist via `WEMA_ALLOWED_IPS`.
- All admin endpoints check `user_roles.role = 'admin'`.
- All RLS policies use `public.has_role()` SECURITY DEFINER.
- Audit log records `dva.create` and `reconciliation.manual_match`.

## Migration from Paystack DVA

Existing Paystack DVAs are NOT deleted — they are marked
`status='archived'`, `is_active=false`. Historical transactions remain
queryable. New collections flow exclusively through Wema.
