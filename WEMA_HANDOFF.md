# Wema Bank VAS — Test Credentials & Integration Details

**Vendor:** ASCI (Ahmadiyya Science College Payment Portal)
**Environment:** Sandbox / Test
**Account type:** Static virtual accounts (no `amount` field in Account Lookup)
**Test account prefix:** `711` (10-digit NUBAN: `711` + 7-digit serial)
**Verified live:** 2026-09-17 — all five endpoints re-tested end-to-end against the current test accounts (see §8).

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
- **Confirmed working 2026-09-17:** the current token authenticates successfully against the live sandbox endpoints. Use the exact token value with no extra spaces or line breaks.
- Requests with a missing or wrong token receive **HTTP 401**:

```json
{ "status": "96", "status_desc": "Unauthorized" }
```

## 3. Vendor-Hosted Endpoints

All endpoints accept **POST** with `Content-Type: application/json` only.

### 3.1 Account Lookup — `/wema-account-lookup`

Request:

```json
{ "accountnumber": "7110234980" }
```

Success response (`00`) — verified live 2026-09-17:

```json
{
  "accountname": "ASCI/Abdulbasit Abdulsalam",
  "status": "00",
  "status_desc": "Successful",
  "bvn": "22123456789",
  "nin": "80534237367"
}
```

- At least one of `bvn` / `nin` is always returned. Every current test student carries a real NIN from our records; BVN is not yet captured, so the sandbox institution fallback BVN (`22123456789`) is returned.
- Static accounts: no `amount` field.
- Unknown account → `07` "Invalid account" (verified with `7119999999`). Blocked/inactive account → `07` "Inactive account" (with account name and BVN/NIN included).

### 3.2 Transaction Notification — `/wema-transaction-notification`

Request (NIP inflow):

```json
{
  "sessionid": "000001240517115500123456789012",
  "craccount": "7110234981",
  "amount": "5000.00",
  "paymentreference": "NIP/REF/000123456",
  "originatorname": "JOHN DOE",
  "originatoraccountnumber": "0123456789",
  "bankname": "GTBank"
}
```

Required: `sessionid`, `craccount`, `amount` (> 0).

Success response — verified live 2026-09-17:

```json
{
  "transactionreference": "WEMA-000001240517115500123456789012",
  "status": "00",
  "status_desc": "Successful"
}
```

Behavior:
- The student's wallet is credited immediately; the transaction is recorded as a completed bank transfer with payer details.
- **Idempotency (re-verified 2026-09-17):** `sessionid` is unique-keyed. A duplicate notification returns `00` "Duplicate notification acknowledged" with the original reference and is NOT credited twice.
- Unknown/inactive `craccount` → `07`; the event is logged for reconciliation.
- Temporary internal failure → `96` "Temporary processing error" so the bank can retry.

### 3.3 Fetch Mini Statement — `/wema-mini-statement` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234981" }
```

Success response — last 10 days, credits and debits, newest first (max 100). Verified live 2026-09-17:

```json
{
  "status": "00",
  "status_desc": "1 Row(s) returned",
  "accountnumber": "7110234981",
  "accountname": "ASCI/Ibrahim Kazeem",
  "transactions": [
    {
      "transactionreference": "WEMA-SELFTEST1789648859659000000000",
      "sessionid": "SELFTEST1789648859659000000000",
      "amount": "100",
      "type": "C",
      "narration": "Bank transfer from WEMA SELF TEST",
      "status": "completed",
      "transactiondate": "2026-09-17T12:41:02.852436+00:00"
    }
  ]
}
```

`type` is `"C"` (credit) or `"D"` (debit). Invalid account → `07`.

### 3.4 Get KYC Details — `/wema-kyc-details` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234980" }
```

Success response (returned for both active and inactive accounts) — verified live 2026-09-17:

```json
{
  "status": "00",
  "status_desc": "Successful",
  "accountnumber": "7110234980",
  "accountname": "ASCI/Abdulbasit Abdulsalam",
  "phonenumber": "08060164991",
  "bvn": "22123456789",
  "nin": "80534237367",
  "walletbalance": "25000",
  "accountstatus": "active"
}
```

### 3.5 Block Account — `/wema-block-account` *(schema provisional)*

Request:

```json
{ "accountnumber": "7110234995", "reason": "Blocked on Wema Bank request" }
```

Success response — verified live 2026-09-17:

```json
{ "status": "00", "status_desc": "Account blocked successfully" }
```

A blocked account immediately returns "Inactive account" (`07`) on Account Lookup (verified 2026-09-17) and rejects new Transaction Notifications. Every block is written to our audit log. The account used for this test was unblocked afterwards and is active again.

## 4. Status Codes

| Code | Meaning |
| --- | --- |
| `00` | Successful |
| `07` | Invalid account / Inactive account / Invalid request |
| `96` | Unauthorized, or temporary processing error (retryable) |

## 5. Test Virtual Accounts

All 16 sandbox accounts use the `711` prefix and are active. Full current list:

| Account Number | Account Name | Status |
| --- | --- | --- |
| `7110234980` | ASCI/Abdulbasit Abdulsalam | active |
| `7110234981` | ASCI/Ibrahim Kazeem | active |
| `7110234982` | ASCI/Rodiyallah Edun | active |
| `7110234983` | ASCI/Abdul-Baaqi Oniyide | active |
| `7110234984` | ASCI/Mueeb Adeosun | active |
| `7110234985` | ASCI/Halia Akinteye | active |
| `7110234986` | ASCI/Fathia Ojo | active |
| `7110234987` | ASCI/Al-Amin Adeyemi | active |
| `7110234988` | ASCI/Amotugunyi Ajani | active |
| `7110234989` | ASCI/Mazeedat Olaore | active |
| `7110234990` | ASCI/Kismot Ogundeji | active |
| `7110234991` | ASCI/Nimotallahi Animashaun | active |
| `7110234992` | ASCI/Moridiyat Okunola | active |
| `7110234993` | ASCI/Royhannah Adams | active |
| `7110234994` | ASCI/Ulfatullah Akinyemi | active |
| `7110234995` | ASCI/Asci Student (demo) | active |

Suggested for Wema's own tests: `7110234980` (lookup / KYC), `7110234981` (notification + mini statement), `7110234995` (block / unblock).
Invalid-account test: any unassigned `711` number, e.g. `7119999999` → `07`.

## 6. Integration Notes

- Account names are vendor-first: `ASCI/<Customer Name>`.
- NIN is held for every student and returned from the student record. BVN is not yet captured; until then the sandbox institution fallback BVN is returned so a lookup never fails on identity. Real BVNs will be captured before go-live.
- Every notification payload is persisted (raw) plus parsed into transaction fields; duplicate `sessionid`s are acknowledged but never double-credited.
- No secrets appear in any response or log.

## 7. Items Pending Confirmation from Wema

1. Exact request/response schemas for Mini Statement, KYC Details and Block Account (not published; current shapes follow the conventions of the published endpoints).
2. Production account prefix (test prefix is `711`).
3. Transaction Search endpoint URL and credentials (Wema-hosted; released at go-live).
4. Confirmation of static vs dynamic accounts (dynamic requires an `amount` field in Account Lookup).
5. Whether an Unblock Account API is expected (we currently unblock internally via admin).

## 8. Verification Log — 2026-09-17

| Test | Result |
| --- | --- |
| Account Lookup `7110234980` with valid token | PASS — `00`, name + BVN/NIN returned |
| Account Lookup unknown `7119999999` | PASS — `07` Invalid account |
| Transaction Notification (₦100 to `7110234981`) | PASS — `00`, wallet credited, reference `WEMA-SELFTEST1789648859659000000000` |
| Duplicate notification (same `sessionid`) | PASS — `00` acknowledged, NOT double-credited |
| Mini Statement `7110234981` | PASS — `00`, test credit listed |
| KYC Details `7110234980` | PASS — `00`, name/phone/NIN/BVN/balance/status returned |
| Block Account `7110234995` | PASS — `00`; subsequent lookup returned `07` Inactive (account since unblocked) |
| Wrong bearer token | PASS — HTTP 401, `96` Unauthorized |
