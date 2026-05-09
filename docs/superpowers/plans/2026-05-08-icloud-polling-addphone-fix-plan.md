# iCloud Polling And Add Phone Handoff Fix Plan

## Goal

Implement the fix described in `docs/superpowers/specs/2026-05-08-icloud-polling-addphone-fix-design.md` on the Ultra8.0 operation-delay branch.

## Architecture

- Keep operation-delay excluded from polling.
- Adjust iCloud polling in the verification flow and/or iCloud polling payload construction so normal no-code polling uses a larger iCloud-specific attempt/time window.
- Reuse the existing shared phone verification flow when Step 7 lands on `/add-phone` and phone verification is enabled.
- Preserve fatal behavior when phone verification is disabled.

## Implementation Granularity

- Implementer granularity: TaskGroup.
- Reviewer granularity: TaskGroup.
- One checkpoint commit after both spec and code reviewers approve.

## TaskGroup 1: iCloud polling and Step 7 add-phone handoff

### Task 1: Expand iCloud polling window without using operation-delay

Files likely involved:

- `background/verification-flow.js`
- `content/icloud-mail.js`
- `tests/verification-flow-polling.test.js`
- `tests/icloud-mail-content.test.js`
- Existing operation-delay exclusion tests as regression coverage.

Required behavior:

- Add failing tests proving iCloud Step 4 no-code polling is not configured as one attempt under normal conditions.
- Add failing tests proving iCloud response timeout is large enough to cover the configured attempt count and interval.
- Implement the minimum production change that gives iCloud at least 5 configured polling attempts and a response timeout derived from the iCloud polling window.
- Do not wrap iCloud `POLL_EMAIL` handlers with `performOperationWithDelay`.
- Keep provider-specific fast-failure for actual transport non-response.

Suggested verification:

```bash
node --test tests/verification-flow-polling.test.js tests/icloud-mail-content.test.js tests/mail-polling-operation-delay-exclusion.test.js
```

### Task 2: Continue Step 7 direct add-phone through shared phone verification when enabled

Files likely involved:

- `content/signup-page.js`
- `background/steps/oauth-login.js`
- `background.js`
- `tests/background-step6-retry-limit.test.js`
- `tests/auto-run-step6-restart.test.js`
- `tests/step7-phone-login-entry.test.js`
- `tests/step8-retry-page-recovery.test.js`
- `tests/phone-verification-flow.test.js`

Required behavior:

- Add failing tests for Step 7 password submit landing on `/add-phone` with phone verification enabled.
- Add or preserve tests for Step 7 password submit landing on `/add-phone` with phone verification disabled.
- Add or preserve tests proving phone-login entry pages are not misclassified as add-phone.
- Reuse existing shared phone verification helpers; do not implement new phone/SMS submission logic in Step 7.
- Keep existing fatal propagation for shared phone verification failures.

Suggested verification:

```bash
node --test tests/background-step6-retry-limit.test.js tests/auto-run-step6-restart.test.js tests/step7-phone-login-entry.test.js tests/step8-retry-page-recovery.test.js tests/phone-verification-flow.test.js
```

## Final Verification

Run these before completion:

```bash
node --test tests/verification-flow-polling.test.js tests/icloud-mail-content.test.js tests/mail-polling-operation-delay-exclusion.test.js tests/operation-delay-injection.test.js tests/content-operation-delay.test.js
node --test tests/background-step6-retry-limit.test.js tests/auto-run-step6-restart.test.js tests/step7-phone-login-entry.test.js tests/step8-retry-page-recovery.test.js tests/phone-verification-flow.test.js
npm test
git diff --check
git status --short --branch --untracked-files=all
```

If `npm test` creates `scripts/__pycache__/`, remove it before final status.
