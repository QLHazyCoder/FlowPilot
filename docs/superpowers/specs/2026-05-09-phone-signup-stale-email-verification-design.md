# Phone Signup Stale Email Verification Fix Design

## Scope

Fix phone-signup Step 4 behavior when OpenAI has already moved the auth tab to an email verification page before a phone SMS verification code is submitted.

## Required Behavior

- If phone-signup Step 4 is waiting for an SMS code and the auth tab is still on the phone verification page, keep polling the configured SMS provider.
- If phone-signup Step 4 is waiting for an SMS code but the auth tab has moved to `/email-verification`, stop waiting for SMS immediately.
- The `/email-verification` transition before SMS submission means the phone number is not usable for a new phone-signup account in this run. The flow must fail fast with a clear, actionable error so the current auto-run attempt can rotate/restart instead of hanging.
- If phone-signup Step 4 submits a valid phone SMS code and then OpenAI moves to `/email-verification`, preserve the existing handoff behavior and continue mailbox verification.
- Do not add operation-delay to SMS polling, email polling, backend retries, or background timers.
- Do not broaden iCloud-specific polling behavior to other mail providers.

## Error Semantics

The stale email-verification bailout must be distinguishable from SMS-provider timeout, invalid SMS code, user stop, and normal post-SMS email-verification handoff.

The user-facing message should explain that OpenAI moved to email verification before phone SMS verification completed, likely because the phone number is already associated with an existing account or login path, and the current number should be replaced.

## Testing Requirements

- Add a regression test that simulates phone-signup Step 4 polling while the auth tab is already on `/email-verification`; the test must fail before the implementation and pass after.
- Add or update tests to prove normal post-SMS email-verification handoff still works.
- Run targeted phone Step 4 tests and the full suite before completion.
