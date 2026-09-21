# Reply to Wema Bank — Production Confirmation

## Goal
Send Wema a confirmation that our VAS endpoints are deployed and live, so they can begin testing and issue their production URLs and authentication token. Per your choice, we confirm the current endpoints now and flag that final production URLs will be re-confirmed before go-live if infrastructure changes.

## Draft reply to send to Wema

---

Dear Wema Bank Team,

Thank you for your response.

We hereby confirm that the VAS endpoints shared in our credentials document have been deployed to our live environment and are fully operational:

- Account Lookup
- Transaction Notification
- Mini Statement
- KYC Details
- Block Account

All five endpoints have been tested end-to-end on our side, including Bearer token authentication, account lookup on our `711` test accounts, transaction notification with idempotency handling, and account blocking/unblocking. You may proceed with your testing against the base URL, endpoints, and test account numbers provided in the credentials document.

Please note: should our infrastructure change before go-live, we will re-confirm the final production URLs and authentication token with you in advance of any cutover.

We look forward to the results of your testing and to receiving the production URLs and authentication token.

Best regards,
[Your name]
Ahmadiyya Science College Payment Portal (ASCI)

---

## Follow-up after you send it

- Update `WEMA_VAS_COMPLIANCE.md` to record that Wema was notified on 2026-09-21 that the endpoints are live and that their testing is in progress.
- No code, schema, or secret changes are required for this step.
