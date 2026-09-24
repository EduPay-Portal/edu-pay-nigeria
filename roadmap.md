# ASC-Pay Roadmap

## Backend migration (standby build — live Lovable Cloud untouched)
- [x] Stage 1: Fix migration scripts, refresh runbook
- [x] Stage 2: New Supabase project created (ref `gnojeitupgppcioahczj`), URL + publishable key received
- [ ] Stage 2b: Obtain new project DB password + Supabase access token (user)
- [ ] Stage 3: Apply schema (tables, RLS, functions, triggers) to new project
- [ ] Stage 4: Copy data (auth users w/ passwords, all 15 tables, re-sync sequences)
- [ ] Stage 5: Deploy all 18 edge functions + set 7 secrets + 2 cron jobs
- [ ] Stage 6: Repoint Vercel env vars (ONLY after Wema sign-off)
- [ ] Stage 7: Hand new URLs + fresh token to Wema
- [ ] Stage 8: 48h parallel watch, then retire Lovable Cloud

## Notes
- Do NOT touch the live Lovable Cloud backend (`xspfcdxymobmiksiudfo`) — Wema is testing it.
- Static 711 virtual accounts remain the agreed direction.
