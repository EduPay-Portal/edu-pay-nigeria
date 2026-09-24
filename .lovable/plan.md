# Fix the "Unauthorized" error on the new backend

## What the screenshot shows
- The new backend is working. Its lookup address answered your request with its own "96 Unauthorized" reply.
- All four Wema settings, including the Wema token, are saved on the new backend. So the token stored there does not exactly match the token Postman is sending.
- Common causes: an extra space or line break when pasting, quote marks copied in with the token, or a different token in the Postman Authorization tab.

## Steps
1. **You:** in the new project, go to Edge Functions → Secrets and edit `WEMA_VAS_BEARER_TOKEN`. Paste the same token that works on the live backend. Leave out quotes, the word "Bearer", and any spaces. Save.
2. **You:** in Postman, open the Authorization tab and choose "Bearer Token". Paste the same value with no "Bearer " in front.
3. **Me:** send one lookup for `7110234981` with the right token and one with a wrong token. I'll show you only the results, never the token. You should see "00" for the right token and "96" for the wrong one.
4. **Me:** if it still fails, check the new backend's logs to see why the request is being rejected (for example, no token received, or wrong format).
5. **Me:** mark this stage done in the roadmap. Then remind you to reset the database password and delete both access tokens.

## Not changed
- The live backend and Wema's testing are not touched.
- No code changes, unless step 4 finds a real problem.

## Technical details
- Checked the new project's secrets list (names only): `WEMA_VAS_BEARER_TOKEN` is set.
- The 401/96 reply comes from `checkVasBearer` in `_shared/payments/wema-vas.ts`, so the function deployed and started correctly. The failure is a token mismatch, not a failed deployment.
