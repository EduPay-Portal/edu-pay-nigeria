# ASC-Pay Roadmap

## Backend migration (Wema signed off 2026-09-30 — cutover in progress)
- [x] Stage 1: Fix migration scripts, refresh runbook
- [x] Stage 2: New Supabase project created (ref `gnojeitupgppcioahczj`, London), URL + publishable key received
- [x] Stage 2b: DB password + access token received
- [x] Stage 3: Schema applied (15 tables, 45 policies, 21 functions, 15+2 triggers, 3 sequences) — matches live
- [x] Stage 4: Data snapshot copied 2026-09-24
- [x] Stage 5a: 18 functions deployed, 2 cron jobs active, smoke test passes (no 404s)
- [x] Stage 5b: Wema secrets set on standby; Account Lookup `7110234983` verified `00` with real token
- [x] Delta sync 2026-09-30: 1 transaction, 1 webhook event, recent audit rows copied; wallet balances now match live exactly (₦25,000 / ₦30,000 / ₦100)
- [x] Removed unused `src/lib/env.ts` (held stale hardcoded keys from an unrelated project)
- [x] Stage 7 docs: `WEMA_HANDOFF.md` + compliance doc updated to the new production base URL
- [ ] Stage 6: User updates Vercel env vars to the new project and redeploys
- [ ] Stage 7: Send updated handover doc + bearer token to Wema via secure channel
- [ ] Stage 8: 48h parallel watch, then retire Lovable Cloud backend
- [ ] Security: reset the new DB password and delete the migration access tokens (pasted in chat)

## Notes
- Production base URL: `https://gnojeitupgppcioahczj.supabase.co/functions/v1`
- Old Lovable Cloud backend (`xspfcdxymobmiksiudfo`) stays live through the 48h dual-run window — rollback path.
- Static 711 virtual accounts remain the agreed direction.
