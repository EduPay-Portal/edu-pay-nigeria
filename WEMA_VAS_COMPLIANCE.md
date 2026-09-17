# Wema Bank VAS — Compliance Report

Source of truth: Wema Bank Third-Party Virtual Account API Integration Documentation
(https://wemabank-doc.notion.site/Wema-Bank-Third-Party-Virtual-Account-API-Integration-Documentation-31f13df490b68074aa99df46b1de9a4f)

Test virtual account prefix: **711** (`711` + unique 7-digit serial → 10-digit NUBAN, e.g. `7110234567`).
This is the only test prefix used anywhere in generation, validation, storage and display.

## A. What was found (pre-audit state)

| Area | Finding |
| --- | --- |
| Integration direction | **Backwards.** The app called an invented outbound `POST /virtual-account/create` on Wema. Wema's model is vendor-hosted: the vendor generates account numbers and **hosts** the APIs the bank calls. |
| Account numbers | Deterministic hash-based placeholders starting with `9`. Not the agreed prefix, not serial-unique. |
| Webhook | `wema-webhook` expected an undocumented API-key + HMAC-SHA512 signature. Wema specifies a static Bearer token and a Transaction Notification API. |
| Required vendor APIs | Account Lookup, Transaction Notification, Mini Statement, KYC Details, Block Account — **all missing**. |
| Idempotency | No `sessionid` idempotency; duplicate notifications could double-credit a wallet. |
| Schema | No account block/status fields, no session id, no provider response storage. |

## B. What changed

Database (migrations applied):
- `virtual_accounts`: `account_status` (`active|inactive|blocked`, checked), `blocked_at`, `block_reason`, unique index on `account_number`.
- `transactions`: `session_id` (unique index), `nibss_response`, `send_response`.
- `student_profiles`: optional `bvn`, `nin`, `phone` (required by Account Lookup / KYC).
- `wema_va_serial_seq` + `allocate_virtual_account_number(prefix)` SECURITY DEFINER function, executable by `service_role` only — guarantees unique, collision-free NUBANs.

Edge Functions (vendor-hosted, static Bearer auth, POST + JSON only):
| Wema requirement | Endpoint |
| --- | --- |
| 1. Account Lookup | `wema-account-lookup` |
| 2. Transaction Notification | `wema-transaction-notification` |
| 4. Fetch Mini Statement | `wema-mini-statement` (provisional schema) |
| 5. Get KYC Details | `wema-kyc-details` (provisional schema) |
| 6. Block Account | `wema-block-account` (provisional schema) |
| 3. Transaction Search (Wema-hosted) | client in `_shared/payments/wema-search.ts` — disabled until Wema supplies URL + token |

Shared code:
- `_shared/payments/wema-vas.ts` — status codes (`00`/`07`), prefix config + validation, vendor-first account-name formatting, timing-safe Bearer check, account allocation, BVN/NIN resolution, sanitised logging.
- `providers/wema.ts` — rewritten: no outbound calls, no HMAC, no hash numbers; builds records from the allocated NUBAN.
- `wema-webhook` — deprecated shim that forwards to `wema-transaction-notification`.
- `dva-create` — allocates the NUBAN from the database before creating the record.

## C. Wema API compliance

**Live end-to-end verification re-run 2026-09-17** against the current account set (valid + invalid token, unknown account, credit, duplicate notification, statement, KYC, block + post-block lookup). Results logged in `WEMA_HANDOFF.md` §8 — all PASS. The blocked test account was restored to active afterwards.

| Requirement | Status |
| --- | --- |
| Static Bearer token authentication on all vendor APIs | Implemented (timing-safe compare; fails closed if unconfigured) |
| POST + `application/json` only | Implemented |
| Account Lookup returns `accountname`, `status`, `status_desc`, `bvn`/`nin` | Implemented |
| Vendor name first in account name | Implemented (`VENDOR/Customer Name`) |
| At least one of BVN or NIN always returned | Implemented (student value, else configured fallback; fails closed if neither) |
| `07 Invalid account` for unknown accounts | Implemented |
| `07 Inactive account` for blocked/inactive accounts | Implemented |
| Static accounts (no `amount` field) | Implemented — **pending Wema confirmation** that static-only is agreed |
| Transaction Notification credits the customer wallet | Implemented |
| `sessionid` idempotency; duplicate returns `00` without re-crediting | Implemented (unique index + duplicate detection) |
| Retryable failures return a non-`00` code (`96`) | Implemented |
| Notification payload persisted (webhook_events, transaction fields) | Implemented |
| Mini Statement — last 10 days, credits and debits | Implemented, schema provisional |
| KYC — name, phone, BVN/NIN, balance, account status | Implemented, schema provisional |
| Block Account — account becomes inactive, rejects new transactions | Implemented, schema provisional |
| Transaction Search | Client written, **blocked** on Wema production credentials |
| Timeouts, error handling, no secret leakage in logs/responses | Implemented |

## D. Configuration required (backend secrets)

| Secret | Set? | Notes |
| --- | --- | --- |
| `WEMA_ACCOUNT_PREFIX` | Yes (`711`) | Change to the production prefix only when Wema issues one |
| `WEMA_VENDOR_NAME` | Yes (`ASCI`) | Appears first in every account name |
| `WEMA_ENV` | Yes (`sandbox`) | Switch to `production` at go-live |
| `WEMA_VAS_BEARER_TOKEN` | Yes | Set and re-verified live 2026-09-17; share the same value with Wema via a secure channel |
| `WEMA_FALLBACK_BVN` / `WEMA_FALLBACK_NIN` | Yes (sandbox test values) | Real NINs now stored per student; BVN still falls back — capture real BVNs before go-live |
| `WEMA_SEARCH_BASE_URL` / `WEMA_SEARCH_BEARER_TOKEN` | Pending | Supplied by Wema at go-live |

## E. Test prefix 711

Enforced in `accountPrefix()` (default and validated as 3 digits), in the database allocator, in `isOurAccountNumber()` used by every vendor endpoint, and in the provider, which rejects any number not matching the configured prefix. Covered by unit tests in `_shared/payments/wema-vas.test.ts` (10 passing).

## F. Remaining blockers

1. ~~`WEMA_VAS_BEARER_TOKEN` created and shared~~ — **Done** (set, re-verified live 2026-09-17; share the value with Wema securely).
2. Exact request/response schemas for Mini Statement, KYC Details and Block Account are **not published**; current implementations are provisional and must be confirmed with Wema.
3. Production account prefix not yet issued by Wema.
4. Transaction Search endpoint and credentials released only at go-live.
5. Confirmation required from Wema on static vs dynamic accounts (dynamic requires an `amount` in the lookup response).
6. ~~Legacy `9`-prefixed accounts reissued~~ — **Done**: no legacy accounts remain. After the 2026-09-17 student data reset and re-import the sandbox holds **16 active `711` accounts** (15 SS 3 students + 1 demo), none blocked.
7. Real BVNs not yet captured for students (NINs are).

**Not production ready** until items 2–5 are resolved with Wema. Sandbox is fully test-ready.
