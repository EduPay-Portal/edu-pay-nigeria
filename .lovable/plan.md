## Reference Lookup + Receipt Download

Two coordinated additions. No schema changes needed — using polling instead of realtime to avoid migrations (transactions table isn't on the supabase_realtime publication, and adding it requires a migration we already have plenty of).

### 1. Shared receipt PDF generator

New `src/lib/receipt.ts` using `jspdf` (already installed):

- `generateReceiptPdf(data: ReceiptData): jsPDF`
- `downloadReceipt(data)` — saves as `receipt-<reference>.pdf`
- Branded with the navy primary `#0d4a6b` header band
- Status pill (green for completed, amber otherwise)
- Two-column key/value rows: amount, internal reference, Paystack reference, date, method/channel, provider, payer name + email, description, wallet balance after
- Footer disclaimer + generation timestamp

### 2. Reference lookup card on Admin Transactions page

`src/pages/dashboard/admin/TransactionsPage.tsx` — add a new card above the existing table.

- Input + "Look up" button → matches by `paystack_reference` first, then falls back to `reference`
- Result card shows: status badge, amount, type/category, payer, both references, payment channel, created_at
- `useQuery` with `refetchInterval: 3000` while a result is loaded and status is `pending` — gives near-real-time status updates without realtime channels
- "Stop refreshing" toggle when polling
- "Download receipt" button (uses shared generator)
- "Clear" button to dismiss

The existing search box in the table stays as-is for browsing; this new card is a focused single-record lookup with live status.

### 3. Receipt download on PaymentSuccess page

`src/pages/PaymentSuccess.tsx` — when state is `success` and `tx` is loaded:

- Add a "Download receipt" outline button next to "Back to dashboard"
- Fetch additional fields (category, type, payment_method, payment_channel, provider, description, created_at) in the same poll query (extend the select)
- Pass `walletBalanceAfter` from the wallet query we already do
- Payer name from `user.user_metadata` / email from `user.email`

### Files touched

- `src/lib/receipt.ts` — new
- `src/pages/dashboard/admin/TransactionsPage.tsx` — new lookup card section
- `src/pages/PaymentSuccess.tsx` — extended select + download button
- `package.json` / `bun.lock` — `jspdf` already added

Approve to apply.