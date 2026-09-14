# Wema Bank VAS — Test Credentials & Integration Details

**Vendor:** ASCI (Ahmadiyya Science College Payment Portal)
**Environment:** Sandbox / Test
**Account type:** Static virtual accounts (no `amount` field in Account Lookup)
**Test account prefix:** `711` (10-digit NUBAN: `711` + 7-digit serial)
**Verified live:** 2026-09-14 — all five endpoints tested end-to-end with the bearer token below (see §8).

---

## 1. Base URL

```
https://xspfcdxymobmiksiudfo.supabase.co/functions/v1
```

All endpoints below are appended to this base URL.

## 2. Authentication

Every request must carry the static Bearer token:

```
Authorization: Bearer [WEMA_VAS_BEARER_TOKEN — shared with Wema separately via a secure channel]
Content-Type: application/json
```

- The token is a shared secret; the same value is configured on our side as `WEMA_VAS_BEARER_TOKEN`. It is intentionally not committed to any document or repository.
- **Confirmed working 2026-09-14:** the current token authenticates successfully against the live sandbox endpoints (verified with real requests). Use the exact token value with no extra spaces or line breaks.
- Requests with a missing or wrong token receive **HTTP 401**:

```json
{ "status": "96", "status_desc": "Unauthorized" }
```

## 3. Vendor-Hosted Endpoints

All endpoints accept **POST** with `Content-Type: application/json` only.

### 3.1 Account Lookup — `/wema-account-lookup`

Request:

```json
{ "accountnumber": "7110234567" }
```

Success response (`00`) — verified live 2026-09-14:

```json
{
  "accountname": "ASCI/ABDUL MUHAEMEEN  ABDUL LATEEF",
  "status": "00",
  "status_desc": "Successful",
  "bvn": "22123456789",
  "nin": "70123456789"
}
```

- At least one of `bvn` / `nin` is always returned (student's value, else institution test fallback in sandbox).
- Static accounts: no `amount` field.
- Unknown account → `07` "Invalid account". Blocked/inactive account → `07` "Inactive account" (with account name and BVN/NIN included).

### 3.2 Transaction Notification — `/wema-transaction-notification`

Request (NIP inflow):

```json
{
  "sessionid": "000001240517115500123456789012",
  "craccount": "7110234569",
  "amount": "5000.00",
  "paymentreference": "NIP/REF/000123456",
  "originatorname": "JOHN DOE",
  "originatoraccountnumber": "0123456789",
  "bankname": "GTBank"
}
```

Required: `sessionid`, `craccount`, `amount` (> 0).

Success response — verified live 2026-09-14:

```json
{
  "transactionreference": "WEMA-000001240517115500123456789012",
  "status": "00",
  "status_desc": "Successful"
}
```

Behavior:
- The student's wallet is credited immediately; the transaction is recorded as a completed bank transfer with payer details.
- **Idempotency (verified 2026-09-14):** `sessionid` is unique-keyed. A duplicate notification returns `00` "Duplicate notification acknowledged" with the original reference and is NOT credited twice (confirmed: exactly one transaction row after two identical notifications).
- Unknown/inactive `craccount` → `07`; the event is logged for reconciliation.
- Temporary internal failure → `96` "Temporary processing error" so the bank can retry.

### 3.3 Fetch Mini Statement — `/wema-mini-statement` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234569" }
```

Success response — last 10 days, credits and debits, newest first (max 100). Verified live 2026-09-14:

```json
{
  "status": "00",
  "status_desc": "1 Row(s) returned",
  "accountnumber": "7110234569",
  "accountname": "ASCI/Asci Student",
  "transactions": [
    {
      "transactionreference": "WEMA-SELFTEST1789394129696000000000",
      "sessionid": "SELFTEST1789394129696000000000",
      "amount": "100",
      "type": "C",
      "narration": "Bank transfer from SELF TEST",
      "status": "completed",
      "transactiondate": "2026-09-14T13:55:32.526396+00:00"
    }
  ]
}
```

`type` is `"C"` (credit) or `"D"` (debit). Invalid account → `07`.

### 3.4 Get KYC Details — `/wema-kyc-details` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234567" }
```

Success response (returned for both active and inactive accounts) — verified live 2026-09-14:

```json
{
  "status": "00",
  "status_desc": "Successful",
  "accountnumber": "7110234567",
  "accountname": "ASCI/ABDUL MUHAEMEEN  ABDUL LATEEF",
  "phonenumber": "",
  "bvn": "22123456789",
  "nin": "70123456789",
  "walletbalance": "0",
  "accountstatus": "active"
}
```

### 3.5 Block Account — `/wema-block-account` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234576", "reason": "Blocked on Wema Bank request" }
```

Success response — verified live 2026-09-14:

```json
{ "status": "00", "status_desc": "Account blocked successfully" }
```

A blocked account immediately returns "Inactive account" (`07`) on Account Lookup (verified: post-block lookup of `7110234576` returned `07`) and rejects new Transaction Notifications. Every block is written to our audit log.

## 4. Status Codes

| Code | Meaning |
| --- | --- |
| `00` | Successful |
| `07` | Invalid account / Inactive account / Invalid request |
| `96` | Unauthorized, or temporary processing error (retryable) |

## 5. Sample Test Virtual Accounts

All test accounts use the `711` prefix and are live in the sandbox. The full list is available from our Virtual Accounts admin screen; verified samples:

| Account Number | Account Name | Status |
| --- | --- | --- |
| `7110234567` | ASCI/ABDUL MUHAEMEEN ABDUL LATEEF | active |
| `7110234568` | ASCI/KHALID AYOMIDE ABDUL LATEEF | active |
| `7110234569` | ASCI/Asci Student (demo) | active |
| `7110234570` | ASCI/KAMALDEEN OPEYEMI ADENIJI | active |
| `7110234571` | ASCI/QUADRI AYINDE ADENIYI | active |
| `7110234576` | ASCI/FARUQ ADUOJO MUHAMMED | blocked (self-test — can be unblocked on request) |

## 6. Integration Notes

- Account names are vendor-first: `ASCI/<Customer Name>`.
- BVN/NIN come from the student record; in sandbox an institution-level test fallback (`22123456789` / `70123456789`) is used when a student has none, so a lookup never fails on identity. Real student BVN/NIN will be captured before go-live.
- Every notification payload is persisted (raw) plus parsed into transaction fields; duplicate `sessionid`s are acknowledged but never double-credited.
- No secrets appear in any response or log.

## 7. Items Pending Confirmation from Wema

1. Exact request/response schemas for Mini Statement, KYC Details and Block Account (not published; current shapes follow the conventions of the published endpoints).
2. Production account prefix (test prefix is `711`).
3. Transaction Search endpoint URL and credentials (Wema-hosted; released at go-live).
4. Confirmation of static vs dynamic accounts (dynamic requires an `amount` field in Account Lookup).

## 8. Verification Log — 2026-09-14

| Test | Result |
| --- | --- |
| Account Lookup `7110234567` with valid token | PASS — `00`, name + BVN/NIN returned |
| Transaction Notification (₦100 to `7110234569`) | PASS — `00`, wallet credited, reference `WEMA-SELFTEST1789394129696000000000` |
| Duplicate notification (same `sessionid`) | PASS — `00` acknowledged, NOT double-credited (single transaction row confirmed) |
| Mini Statement `7110234569` | PASS — `00`, test credit listed |
| KYC Details `7110234567` | PASS — `00`, name/BVN/NIN/balance/status returned |
| Block Account `7110234576` | PASS — `00`; subsequent lookup returns `07` Inactive |
| Wrong bearer token | PASS — HTTP 401, `96` Unauthorized |
