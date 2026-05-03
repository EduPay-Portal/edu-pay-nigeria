## Why the button is disabled

The Bulk Import page reads counts from the `get_import_staging_stats()` database function. That function references two columns that don't exist on `students_import_staging`:

- `processing_error` — actual column is `error_message`
- `import_batch_id` — column does not exist

The call throws, the page falls back to `pending = 0`, and "Process All Pending" is disabled — even though staging actually contains **412 pending rows**.

## Fix

1. **Migration: rewrite `get_import_staging_stats()`** to use the real columns:
   - `processed_records` = `processed = true AND error_message IS NULL`
   - `pending_records` = `processed = false`
   - `error_records` = `error_message IS NOT NULL`
   - Drop `unique_batches` (or return `0::bigint`) since `import_batch_id` doesn't exist on this table.
   - Update the page's TypeScript shape if needed.

2. **Verify** the RPC returns `{ total: 412, pending: 412, processed: 0, errors: 0 }` and the "Process All Pending (412)" button becomes enabled.

3. **Run the import**: click Process All Pending. The `bulk-create-students` edge function processes rows sequentially, creating auth users → triggers create profiles, roles, wallets → DB trigger queues virtual account creation via Paystack. Watch the Processed/Errors counters; use Retry Failed for any rows that error.

4. **Post-import sanity check** with read-only queries: counts in `student_profiles`, `parent_profiles`, `wallets`, `virtual_accounts`.

No changes to the edge function itself — it's the stats wiring that's broken, not the processing.
