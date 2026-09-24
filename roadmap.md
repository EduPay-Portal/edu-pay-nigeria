# ASC-Pay Roadmap

## Backend migration (standby build — live Lovable Cloud untouched)
- [x] Stage 1: Fix migration scripts, refresh runbook
- [x] Stage 2: New Supabase project created (ref `gnojeitupgppcioahczj`), URL + publishable key received
- [x] Stage 2b: DB password + access token received
- [x] Stage 3: Schema applied (15 tables, 45 policies, 21 functions, 15+2 triggers, 3 sequences) — matches live
- [x] Stage 4: Data snapshot copied 2026-09-24 (33 logins w/ passwords, all 15 tables row-count match, wallets ₦50,100 match, parent login verified)
- [ ] Stage 5: Deploy 18 functions + secrets + 2 cron jobs — BLOCKED: access token lacks edge-function/secrets write permission; user to create a new token with full access, and supply Wema bearer token via secure form
- [ ] After build: user resets DB password and deletes the migration tokens (they were pasted in chat)
- [ ] At cutover: re-copy data changed since the snapshot
- [ ] Stage 6: Repoint Vercel env vars (ONLY after Wema sign-off)
- [ ] Stage 7: Hand new URLs + fresh token to Wema
- [ ] Stage 8: 48h parallel watch, then retire Lovable Cloud

## Notes
- Do NOT touch the live Lovable Cloud backend (`xspfcdxymobmiksiudfo`) — Wema is testing it.
- Static 711 virtual accounts remain the agreed direction.
