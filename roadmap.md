# ASC-Pay Roadmap

## Backend migration (standby build — live Lovable Cloud untouched)
- [x] Stage 1: Fix migration scripts, refresh runbook
- [x] Stage 2: New Supabase project created (ref `gnojeitupgppcioahczj`), URL + publishable key received
- [x] Stage 2b: DB password + access token received
- [x] Stage 3: Schema applied (15 tables, 45 policies, 21 functions, 15+2 triggers, 3 sequences) — matches live
- [x] Stage 4: Data snapshot copied 2026-09-24 (33 logins w/ passwords, all 15 tables row-count match, wallets ₦50,100 match, parent login verified)
- [x] Stage 5a: 18 functions deployed, WEMA_ACCOUNT_PREFIX/WEMA_ENV/CRON_SECRET set, 2 cron jobs active, smoke test passes (no 404s)
- [ ] Stage 5b: Set WEMA_VAS_BEARER_TOKEN, WEMA_VENDOR_NAME, WEMA_FALLBACK_BVN, WEMA_FALLBACK_NIN on standby — BLOCKED: values must come from user (not readable from live)
- [ ] After build: user resets DB password and deletes the migration tokens (they were pasted in chat)
- [ ] At cutover: re-copy data changed since the snapshot
- [ ] Stage 6: Repoint Vercel env vars (ONLY after Wema sign-off)
- [ ] Stage 7: Hand new URLs + fresh token to Wema
- [ ] Stage 8: 48h parallel watch, then retire Lovable Cloud

## Notes
- Do NOT touch the live Lovable Cloud backend (`xspfcdxymobmiksiudfo`) — Wema is testing it.
- Static 711 virtual accounts remain the agreed direction.
