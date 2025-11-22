# Paystack Integration Setup Guide

## Phase 1: Foundation - Completed ✅

### What Was Implemented

1. **Database Schema**
   - `virtual_accounts` table for student payment accounts
   - Enhanced `transactions` table with Paystack fields
   - `paystack_webhook_events` table for audit logging
   - RLS policies for secure data access
   - Helper functions for account management

2. **Edge Functions**
   - `paystack-webhook`: Receives and processes payment notifications
   - `create-virtual-account`: Creates Paystack customers and assigns virtual accounts

3. **Security**
   - Webhook signature verification (HMAC-SHA512)
   - Idempotency protection against duplicate payments
   - Row-level security policies

### Setup Instructions

#### Step 1: Run Database Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: SQL Editor
3. Open the migration file: `migrations/003_paystack_virtual_accounts.sql`
4. Copy and paste the entire contents
5. Click "Run" to execute

#### Step 2: Configure Paystack Webhook

1. Log into your Paystack Dashboard: https://dashboard.paystack.com
2. Go to: Settings → Webhooks
3. Add your webhook URL:
   ```
   https://fmajhzepqpnrzbtcdiix.supabase.co/functions/v1/paystack-webhook
   ```
4. Copy your webhook secret and save it in Lovable Secrets (already done ✅)

#### Step 3: Test the Integration

**Test Virtual Account Creation:**
```bash
curl -X POST https://fmajhzepqpnrzbtcdiix.supabase.co/functions/v1/create-virtual-account \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "YOUR_STUDENT_UUID",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com"
  }'
```

**Expected Response:**
```json
{
  "message": "Virtual account created successfully",
  "account": {
    "account_number": "8020151234",
    "account_name": "John Doe",
    "bank_name": "WEMA BANK"
  }
}
```

### Database Schema Overview

**virtual_accounts Table:**
- `id` - UUID primary key
- `student_id` - References auth.users(id)
- `paystack_customer_code` - Paystack customer identifier
- `account_number` - Unique 10-digit account number
- `account_name` - Student's full name
- `bank_name` - Bank name (e.g., "WEMA BANK")
- `bank_code` - Bank code
- `is_active` - Account status
- `total_received` - Total amount received (auto-updated)
- `last_payment_at` - Last payment timestamp

**Enhanced transactions Table:**
- `paystack_reference` - Paystack transaction reference
- `payment_channel` - Payment method (dva, card, bank_transfer)
- `webhook_data` - Full webhook payload (JSONB)

**paystack_webhook_events Table:**
- `event_type` - Webhook event type
- `paystack_reference` - Transaction reference
- `payload` - Full webhook data
- `signature_valid` - Signature verification result
- `processed` - Processing status
- `error_message` - Error details if failed

### How It Works

1. **Virtual Account Creation:**
   - Admin/system creates student profile
   - Edge function calls Paystack API to create customer
   - Paystack assigns unique account number (WEMA Bank)
   - Account details saved to `virtual_accounts` table
   - Student sees account number in dashboard

2. **Payment Flow:**
   - Parent/student transfers money to virtual account
   - Paystack receives payment and sends webhook
   - `paystack-webhook` function verifies signature
   - Function finds student by account number
   - Creates `transaction` record (credit, completed)
   - Updates wallet balance automatically
   - Updates `total_received` on virtual account

3. **Security Measures:**
   - HMAC-SHA512 signature verification on all webhooks
   - Idempotency using Paystack reference (no duplicates)
   - RLS policies restrict data access by role
   - All API keys stored as encrypted secrets

### Next Steps (Phase 2-5)

**Phase 2: UI Integration**
- Display virtual account in Student/Parent dashboard
- Add "Copy Account Number" button
- Show payment instructions
- Create payment history component

**Phase 3: Card Payments**
- Integrate Paystack Inline for wallet top-ups
- Add "Top Up Wallet" button
- Implement payment verification

**Phase 4: Admin Tools**
- Virtual account management dashboard
- Payment reconciliation report
- Failed webhook retry mechanism
- Bulk account creation

**Phase 5: Advanced Features**
- Multi-bank support (Zenith, UBA, GTBank)
- Automated fee reminders
- Payment analytics
- Refund processing

### Troubleshooting

**Webhook Not Receiving Events:**
- Verify webhook URL in Paystack dashboard
- Check edge function logs in Supabase
- Ensure `verify_jwt = false` in config.toml

**Virtual Account Creation Fails:**
- Check Paystack API key is valid
- Verify student_id exists in auth.users
- Check edge function logs for errors

**Payment Not Reflected:**
- Check `paystack_webhook_events` table for delivery
- Verify signature validation passed
- Check if transaction was created in `transactions` table
- Look for errors in webhook event log

### Testing with Paystack Test Mode

1. Use test API keys in Lovable Secrets
2. Create virtual account for test student
3. Use Paystack test account numbers:
   ```
   Bank: Test Bank
   Account: 0123456789
   Amount: Any amount (in test mode)
   ```
4. Check webhook logs in Supabase
5. Verify transaction created and wallet updated

### Support Resources

- Paystack API Docs: https://paystack.com/docs/api
- Paystack DVA Guide: https://paystack.com/docs/dedicated-virtual-account
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Lovable Cloud Docs: https://docs.lovable.dev/features/cloud

---

**Status:** Phase 1 Complete ✅  
**Next:** Run migration → Test virtual account creation → Move to Phase 2 (UI)
