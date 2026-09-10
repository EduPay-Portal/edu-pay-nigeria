# Wema VAS Integration — Audit and Rebuild

## What the audit found

I read the official Wema documentation (Introduction & Scope, VAS Integration Endpoints, Account Lookup, Transaction Notification, Transaction Search, Transaction Process Flow, Onboarding) and compared it to the current code.

**The integration is built backwards.** The current code assumes the school app *calls* Wema to create accounts (`POST {WEMA_BASE_URL}/virtual-account/create`) and receives an HMAC-signed webhook. The documentation says the opposite:

- The vendor (this app) **generates its own virtual account numbers** — no creation API at Wema exists.
- The vendor **hosts** the APIs the bank calls: Account Lookup, Transaction Notification (plus Fetch Mini Statement, Get KYC Details, Block Account listed in onboarding).
- Authentication is a **static Bearer token issued by the vendor to the bank** — not an API key/HMAC signature.
- Account numbers are `prefix (3 digits) + unique 7 digits`; the test prefix is **711**.
- Transaction Search is the only API provided *by the bank*, production only.

Concrete defects today:
- `wema.ts` invents endpoints, fields and an `x-wema-signature` HMAC scheme that appear nowhere in the documentation.
- Placeholder account numbers start with `9` and are hash-derived (collision-prone), not `711` + unique serial.
- No Account Lookup endpoint exists, so no bank name-enquiry can ever succeed.
- `wema-webhook` expects Wema's invented payload shape, not the documented `craccount` / `sessionid` fields, and returns HTTP-style errors instead of the required `{"status":"00"}` body.
- Idempotency keys off `provider_reference`, not `sessionid`; no account block/inactive state; no `nibssresponse`/`sendresponse` tracking.

## What will be built

### 1. Vendor-hosted APIs (new edge functions, public, Bearer-token protected)
| Endpoint | Method | Documented |
|---|---|---|
| `wema-account-lookup` | POST | Yes — returns `accountname`, `status`, `status_desc`, `bvn`/`nin` |
| `wema-transaction-notification` | POST | Yes — returns `transactionreference`, `status`, `status_desc` |
| `wema-mini-statement` | POST | Listed in onboarding; **payload spec not published** |
| `wema-kyc-details` | POST | Listed in onboarding; **payload spec not published** |
| `wema-block-account` | POST | Listed in onboarding; **payload spec not published** |

Account name format: `ASCI/<Student Name>` (vendor name first, per spec). Status codes: `00` success, `07` + `Invalid account` / `Inactive account`.

The three unpublished specs will be implemented to the onboarding test-scenario wording and clearly marked provisional pending Wema's field definitions.

### 2. Account number generation
Replace the hash-based placeholder with `WEMA_ACCOUNT_PREFIX` (default `711`) + a 7-digit serial drawn from a database sequence, enforced unique. Prefix is read from configuration so production can switch without code changes.

### 3. Transaction notification handling
- Bearer token check, then strict payload validation.
- Idempotency on `sessionid`: a repeat returns `status: "00"` and does **not** re-credit the wallet.
- Resolves `craccount` → student → wallet, credits, writes transaction + reconciliation log.
- Any internal failure returns a non-`00` status so the bank retries.

### 4. Transaction Search client
A thin admin-only client for the bank-hosted search API, disabled until Wema supplies the production endpoint.

### 5. Database
Additive migration only: `virtual_accounts.account_status` (active/inactive/blocked) + `blocked_at`, `transactions.session_id` with a unique index, and `nibss_response` / `send_response` columns. Existing tables and business logic untouched.

### 6. Retire the invented pieces
`wema-webhook` becomes a deprecated shim that forwards to the notification endpoint; the fabricated `createDVA`/`verifyTransaction` HTTP calls and the HMAC parser are removed from `wema.ts`, which becomes a pure local generator.

### 7. Tests and report
Deno tests with mocked requests: auth rejection, valid/invalid/inactive lookup, successful notification, duplicate `sessionid`, malformed payload, and `711` prefix generation. Plus `WEMA_VAS_COMPLIANCE.md` — a requirement-by-requirement checklist of satisfied / changed / outstanding items.

## Configuration you must supply
Nothing is fabricated. These are stored as backend secrets, never in frontend code:

- `WEMA_VAS_BEARER_TOKEN` — the static token you issue to Wema (I can generate this securely).
- `WEMA_ACCOUNT_PREFIX` — `711` for test; your production prefix once Wema assigns it.
- `WEMA_VENDOR_NAME` — the vendor name shown first in account names.
- `WEMA_FALLBACK_BVN` / `WEMA_FALLBACK_NIN` — the responsible-party identity used when a student has neither, since the spec requires at least one.
- `WEMA_SEARCH_BASE_URL` + credentials — bank-provided, production only.

## Blockers that need Wema
- Request/response schemas for Fetch Mini Statement, Get KYC Details and Block Account (referenced in onboarding, not published).
- Your assigned production account prefix.
- The Transaction Search endpoint and credentials.
- Whether your accounts are registered as Static or Dynamic (this plan assumes **static**, one per student).

## Scope guarantee
Auth, wallets, transactions, dashboards, admin functions, imports and notifications are left as-is except where the columns above are added.
