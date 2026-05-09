# Phone Signup Stale Email Verification Fix Plan

## Task 1: Detect Stale Email Verification During Phone SMS Wait

- Add a TDD regression test in the existing phone verification test area.
- Simulate `completeSignupPhoneVerificationFlow()` or its SMS wait helper entering phone-signup Step 4 with a valid signup phone activation while the auth tab is already on `/email-verification`.
- The failing test must show the helper currently continues SMS polling instead of returning/failing fast.
- Implement the smallest background-side page-state check needed to stop SMS waiting when the auth tab is already on email verification before SMS submission.
- Return or throw a distinct stale-phone-signup condition that `executeStep4()` can use to fail fast without treating it as a successful post-SMS handoff.
- Preserve existing successful post-SMS `emailVerificationRequired` handoff behavior.

## Task 2: Verification And Integration

- Run targeted tests covering phone verification and Step 4 handoff.
- Run full `PYTHONDONTWRITEBYTECODE=1 npm test`.
- Clean generated `scripts/__pycache__` artifacts.
- Create one checkpoint commit only after spec and code reviewers approve.
- Push the resulting branch to the Git export refs and the existing GitHub PR fork branch after final verification.
