# Login diagnostics and session reliability

## User-visible result

Add a public `/diagnostics` page that can be opened even when sign-in fails. It will show the active backend host and project reference, environment mode, publishable-key presence and length, current session state, last authentication attempt, exact returned error text, and a plain-language interpretation. Secrets, tokens, passwords, and full keys will never be displayed.

## Authentication behavior

- Replace the generic sign-in failure toast with categorized guidance for invalid credentials, unconfirmed accounts, rate limits, network/backend reachability failures, and configuration/project mismatches.
- Preserve the exact auth error message and safe metadata locally for the diagnostics page, with timestamps and request context but no credentials or tokens.
- After a successful sign-in, verify the session through the auth service and verify that it can be read back from the configured client storage. If it is missing, invalid, or expired, clear the stale session and prompt the user to sign in again.
- Revalidate the session on protected-app startup, tab visibility/window focus, and a five-minute interval. Handle token refresh failures by recording the failure, signing out stale state, and showing a re-authentication prompt without creating a refresh loop.

## Server-side failure logging

- Add an `auth_event_logs` database table with explicit grants, RLS, retention-safe fields, and policies that prevent users from reading or modifying logs.
- Add a `log-auth-event` edge function that accepts only sanitized auth-failure telemetry, records the request origin, backend project reference, error code/message, browser context, timestamp, and request ID, and never accepts passwords or tokens.
- Call the function best-effort from failed sign-in, session validation, and refresh failures. A logging outage must never replace or obscure the original auth error.
- Add a small recent-events section to `/diagnostics` that is available only when the current user is authenticated; unauthenticated visitors still get the local diagnostics and configuration check.

## Technical details

- Add the diagnostics route and focused UI using the existing design tokens and components.
- Centralize error classification and safe diagnostic data in an auth diagnostics helper so login, refresh, and session checks produce consistent results.
- Keep the diagnostics page public, but require a valid session before querying server-side event history; do not expose service-role access or raw database errors to the browser.
- Validate the flow with browser checks for wrong credentials, backend/network failure handling, successful login persistence, expiry/re-auth messaging, and mobile layout. Confirm that requests use the configured backend host and that no secret or token appears in rendered text or logs.
