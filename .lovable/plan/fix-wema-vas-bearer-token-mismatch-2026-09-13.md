# Fix Wema VAS Bearer Token Mismatch

## Problem
- Testing `wema-account-lookup` with the Bearer token the user pasted returns `401 {"status":"96","status_desc":"Unauthorized"}`.
- The endpoint does an exact string comparison against the `WEMA_VAS_BEARER_TOKEN` secret, so the token the user has does not match the stored value (typo on save or on copy).
- Secret values cannot be read back, so the fix is to overwrite the stored secret with the value the user intends to use.

## Changes
1. Update the `WEMA_VAS_BEARER_TOKEN` secret to the exact value the user provided in chat (shared secret — Wema will need the same value).
2. Redeploy/rebind secrets so all five Wema VAS functions pick up the new value.
3. Verify: call `wema-account-lookup` with the new token and a real 711 test account — expect HTTP 200 with `"status":"00"`.
4. Verify the negative case: wrong token still returns 401.
5. Update `WEMA_HANDOFF.md` note so the token section reflects that the confirmed token is now the one to share with Wema (token value itself is never written into the repo).

## Security notes
- The token was pasted in chat; it stays out of code, logs, and the repo. Recommend treating it as the final shared secret from here on and not pasting it anywhere else.
- No schema, code logic, or other secrets change.
