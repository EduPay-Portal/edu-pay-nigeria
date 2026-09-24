# Build the standby backend (Stages 3–5)

Your live app and Wema's testing are not touched at any point. Everything below happens only on your new project (gnojeitupgppcioahczj, London).

## Before anything else: keeping your keys safe
- I'll use the database password and access token you just sent only during this build. They won't be written into any file or saved in the code.
- Because they were pasted into chat, **reset both once the build is done**: reset the database password in Project Settings → Database, and delete the "ASC-Pay migration" token. I'll remind you.

## Stage 3 – Rebuild the structure
- Create all 15 tables, 45 security rules, 21 helper routines, 23 automatic actions and 3 number counters on the new project.
- Compare the new project against the live one and fix anything that doesn't match.

## Stage 4 – Copy the data (a snapshot)
- Copy all users with their passwords unchanged, so everyone logs in the same way as now.
- Copy students, parents, wallets, 711 accounts, transactions, audit logs, the provisioning queue and settings.
- Set the admission-number and reference-number counters to carry on from where they are now.
- Check that every table has exactly the same number of rows as the live one.
- This is a snapshot taken today. At cutover we run a final quick re-copy so the new project picks up any payments made since.

## Stage 5 – Install the endpoints and scheduled jobs
- Put all 18 backend functions on the new project, including the 5 Wema endpoints.
- Set the 7 settings (Wema token, prefix, environment, vendor name, sandbox identity values, scheduled-job key). You'll paste the Wema token yourself in a secure form, since I can't read it.
- Recreate the two scheduled jobs: payment retry every 2 minutes and reconciliation daily at 02:00.
- Run the full check (sign-in, lookups, notifications, block/unblock) against the new project only.

## Not done in this step
- The website stays connected to Lovable Cloud (no Vercel change).
- Wema gets no new addresses yet.
- No change to fees, wallets or how the 711 accounts work.

## Technical details
- Tools: Supabase CLI (via nix) plus psql/pg_dump against the new project's session pooler. The password and token are passed only as environment variables for each command.
- Schema: `supabase db push` of supabase/migrations, then a `pg_dump --schema-only` diff against /tmp/migration-dump.
- Data: the sandbox can't read `auth` on the live project. Auth users will be exported through the live project's admin API (password hashes included where available). If hashes aren't exposed, users get migrated and asked to reset their password at cutover, and I'll tell you before going further.
- Public tables loaded with `--disable-triggers` so wallet balances aren't counted twice; then `setval()` on the sequences.
- Functions: `04_deploy_functions.sh` (--no-verify-jwt), secrets via `05_set_secrets.sh`, cron via `08_setup_cron.sh`, verification via `07_smoke_test.sh`.
- roadmap.md updated to mark Stages 3–5 done and to note the credential rotation reminder.
