# Wema Bank VAS — Test Credentials & Integration Details

**Vendor:** ASCI (Ahmadiyya Science College Payment Portal)
**Environment:** Sandbox / Test
**Account type:** Static virtual accounts (no `amount` field in Account Lookup)
**Test account prefix:** `711` (10-digit NUBAN: `711` + 7-digit serial)

---

## 1. Base URL

```
[PASTE FUNCTIONS BASE URL FROM LOVABLE BACKEND PANEL — e.g. https://<project-ref>.supabase.co/functions/v1]
```

All endpoints below are appended to this base URL.

## 2. Authentication

Every request must carry the static Bearer token:

```
Authorization: Bearer [PASTE WEMA_VAS_BEARER_TOKEN VALUE]
Content-Type: application/json
```

- The token is a shared secret; the same value is configured on our side as `WEMA_VAS_BEARER_TOKEN`.
- **Confirmed working 2026-09-13:** the current token authenticates successfully against the live sandbox endpoints (verified with a real request). Use the exact token value already shared with you, with no extra spaces or line breaks.
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

Success response (`00`):

```json
{
  "accountname": "ASCI/Student Full Name",
  "status": "00",
  "status_desc": "Successful",
  "bvn": "22123456789",
  "nin": ""
}
```

- At least one of `bvn` / `nin` is always returned (student's value, else institution fallback).
- Static accounts: no `amount` field.
- Unknown account → `07` "Invalid account". Blocked/inactive account → `07` "Inactive account" (with account name and BVN/NIN included).

### 3.2 Transaction Notification — `/wema-transaction-notification`

Request (NIP inflow):

```json
{
  "sessionid": "000001240517115500123456789012",
  "craccount": "7110234567",
  "amount": "5000.00",
  "paymentreference": "NIP/REF/000123456",
  "originatorname": "JOHN DOE",
  "originatoraccountnumber": "0123456789",
  "bankname": "GTBank"
}
```

Required: `sessionid`, `craccount`, `amount` (> 0).

Success response:

```json
{
  "transactionreference": "WEMA-000001240517115500123456789012",
  "status": "00",
  "status_desc": "Successful"
}
```

Behavior:
- The student's wallet is credited immediately; the transaction is recorded as a completed bank transfer with payer details.
- **Idempotency:** `sessionid` is unique-keyed. A duplicate notification returns `00` with the original reference and is NOT credited twice.
- Unknown/inactive `craccount` → `07`; the event is logged for reconciliation.
- Temporary internal failure → `96` "Temporary processing error" so the bank can retry.

### 3.3 Fetch Mini Statement — `/wema-mini-statement` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234567" }
```

Success response — last 10 days, credits and debits, newest first (max 100):

```json
{
  "status": "00",
  "status_desc": "2 Row(s) returned",
  "accountnumber": "7110234567",
  "accountname": "ASCI/Student Full Name",
  "transactions": [
    {
      "transactionreference": "WEMA-000001240517115500123456789012",
      "sessionid": "000001240517115500123456789012",
      "amount": "5000.00",
      "type": "C",
      "narration": "Bank transfer from JOHN DOE",
      "status": "completed",
      "transactiondate": "2026-09-13T10:15:00.000Z"
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

Success response (returned for both active and inactive accounts):

```json
{
  "status": "00",
  "status_desc": "Successful",
  "accountnumber": "7110234567",
  "accountname": "ASCI/Student Full Name",
  "phonenumber": "08012345678",
  "bvn": "22123456789",
  "nin": "",
  "walletbalance": "5000.00",
  "accountstatus": "active"
}
```

### 3.5 Block Account — `/wema-block-account` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234567", "reason": "Blocked on Wema Bank request" }
```

Success response:

```json
{ "status": "00", "status_desc": "Account blocked successfully" }
```

A blocked account immediately returns "Inactive account" (`07`) on Account Lookup and rejects new Transaction Notifications. Every block is written to our audit log.

## 4. Status Codes

| Code | Meaning |
| --- | --- |
| `00` | Successful |
| `07` | Invalid account / Inactive account / Invalid request |
| `96` | Unauthorized, or temporary processing error (retryable) |

## 5. Sample Test Virtual Accounts

All test accounts use the `711` prefix. The full live list is available from our Virtual Accounts admin screen; samples will be confirmed after test reissue runs:

| Account Number | Account Name | Status |
| --- | --- | --- |
| `7110XXXXXX` | ASCI/Test Student One | active |
| `7110XXXXXX` | ASCI/Test Student Two | active |
| `7110XXXXXX` | ASCI/Test Student Three | active |

## 6. Integration Notes

- Account names are vendor-first: `ASCI/<Customer Name>`.
- BVN/NIN come from the student record, with an institution-level fallback so a lookup never fails on identity.
- Every notification payload is persisted (raw) plus parsed into transaction fields; duplicate `sessionid`s are acknowledged but never double-credited.
- No secrets appear in any response or log.

## 7. Items Pending Confirmation from Wema

1. Exact request/response schemas for Mini Statement, KYC Details and Block Account (not published; current shapes follow the conventions of the published endpoints).
2. Production account prefix (test prefix is `711`).
3. Transaction Search endpoint URL and credentials (Wema-hosted; released at go-live).
4. Confirmation of static vs dynamic accounts (dynamic requires an `amount` field in Account Lookup).
