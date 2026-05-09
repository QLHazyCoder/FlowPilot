# iCloud Polling And Add Phone Handoff Fix Spec

## Goal

Fix two Ultra8.0 runtime failures on top of the migrated operation-delay branch:

- iCloud verification email polling must wait longer and perform more than one check before declaring the code missing.
- Step 7 password login that lands directly on `https://auth.openai.com/add-phone` must continue into the existing phone verification flow when phone verification is enabled, instead of failing immediately.

## Non-Goals

- Do not add operation-delay waits to email polling, SMS polling, backend retries, or background timers.
- Do not change non-iCloud provider polling cadence unless required by shared test harness setup.
- Do not duplicate phone verification logic inside Step 7.
- Do not treat ordinary phone-login entry pages as add-phone pages.
- Do not continue add-phone when phone verification is disabled or when the existing phone verification flow reports a fatal error.

## iCloud Polling Behavior

The current failure log shows Step 4 iCloud polling using fast timeout protection with a 22 second response timeout and a `最多 1 次` polling payload, then failing after roughly 3 seconds. This is too short for the user's active iCloud-only workflow.

For iCloud verification-code polling:

- Step 4 signup-code polling and Step 8 login-code polling must not be reduced to a single attempt under normal no-code conditions.
- The iCloud polling payload must use an iCloud-specific minimum attempt floor of at least 5 attempts.
- The iCloud polling interval must allow delayed mail arrival and may be longer than the current 3 second effective no-code window.
- The tab-message response timeout for iCloud polling must be large enough for the configured iCloud polling attempts and intervals to complete, plus a small transport margin.
- Transport-unresponsive protection must remain: if the iCloud content script itself does not respond, the flow should fail or recover through the existing transport-error path instead of hanging indefinitely.
- Logs must accurately describe the actual iCloud attempt count and wait window.
- Operation-delay remains excluded from all email polling paths.

## Add Phone Handoff Behavior

When Step 7 password submission transitions directly to an add-phone page:

- If phone verification is enabled, Step 7 must not throw the current fatal `提交密码后页面直接进入手机号页面，未经过登录验证码页` error.
- The flow must hand off to the existing shared phone verification implementation used by later steps.
- After successful phone verification, the automation should continue through the existing OAuth/login flow instead of stopping the run.
- If phone verification is disabled, the flow must keep a clear fatal error telling the user that add-phone requires phone verification to be enabled.
- Existing fatal conditions from the shared phone verification flow remain fatal, including unavailable phone numbers, provider failures, phone already exists, and user stop.
- Existing phone-login entry detection must remain separate from add-phone detection.

## Acceptance Criteria

- Reproducing the reported iCloud Step 4 path no longer emits `开始轮询 iCloud 邮箱（最多 1 次）` for normal iCloud no-code polling.
- iCloud Step 4 no-code polling performs at least 5 configured attempts before the missing-code failure path.
- iCloud polling response timeout is derived from the configured iCloud attempt count and interval rather than being capped to a too-short single-attempt window.
- Mail polling operation-delay exclusion tests still pass.
- Existing non-iCloud provider tests continue to pass.
- Step 7 password-submit to `/add-phone` with phone verification enabled continues into the shared phone verification flow.
- Step 7 password-submit to `/add-phone` with phone verification disabled still fails clearly.
- Step 7 phone-login entry pages are still treated as login phone input, not add-phone.
- Relevant targeted tests and full `npm test` pass.

## Verification Targets

- `node --test tests/verification-flow-polling.test.js tests/icloud-mail-content.test.js`
- `node --test tests/background-step6-retry-limit.test.js tests/auto-run-step6-restart.test.js tests/step7-phone-login-entry.test.js tests/step8-retry-page-recovery.test.js tests/phone-verification-flow.test.js`
- `node --test tests/mail-polling-operation-delay-exclusion.test.js tests/operation-delay-injection.test.js tests/content-operation-delay.test.js`
- `npm test`
