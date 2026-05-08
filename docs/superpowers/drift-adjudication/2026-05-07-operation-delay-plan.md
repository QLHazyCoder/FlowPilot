# Operation Delay Drift Adjudication Ledger

Immutable spec path: `/root/projects/resister-codex/codex-oauth-automation-extension-upstream-base-vu7.3/codex-oauth-automation-extension/.worktrees/feature-operation-delay-ultra73/docs/superpowers/specs/2026-05-07-operation-delay-design.md`

Immutable plan path: `/root/projects/resister-codex/codex-oauth-automation-extension-upstream-base-vu7.3/codex-oauth-automation-extension/.worktrees/feature-operation-delay-ultra73/docs/superpowers/plans/2026-05-07-operation-delay-plan.md`

Controller-only mutation rule: only the P9/controller may create, append, supersede, close, summarize, or otherwise mutate this ledger. Subagents may read it, cite `DRIFT_ID`, report evidence, and request supersession, but may not edit it directly.

## Active Adjudications Summary

| DRIFT_ID | STATUS | SCOPE | P9_FINAL_ADJUDICATION | EFFECTIVE_EXECUTION_CONTRACT |
|---|---|---|---|---|
| DRIFT-2026-05-08-T2-001 | ACTIVE | Task 2 sidepanel switch copy | PLAN_DRIFT_CONTINUE_SAFE | Use sidepanel switch copy that communicates input, selection, click, submit, continue, authorization, and 2 seconds; do not regress to the narrower frozen-plan snippet. |
| DRIFT-2026-05-08-T3-001 | ACTIVE | Task 3 2925 provider metadata test scope | PLAN_DRIFT_CONTINUE_SAFE | Treat `tests/background-icloud-mail-provider.test.js` as in scope for Task 3 checkpoint because it asserts the 2925 provider metadata changed by the required operation-delay injection. |
| DRIFT-2026-05-08-T4-001 | ACTIVE | Task 4 Step 3 direct-complete test scope | PLAN_DRIFT_CONTINUE_SAFE | Treat `tests/step3-direct-complete.test.js` as in scope for Task 4 checkpoint because it verifies Step 3 completion-before-navigation plus deferred password-submit operation-delay behavior. |
| DRIFT-2026-05-08-T7-001 | ACTIVE | Task 7 mail-2925 full-suite harness scope | PLAN_DRIFT_CONTINUE_SAFE | Treat `tests/mail-2925-content.test.js` as in scope for Task 7 only for a narrow stale-harness fix providing `performOperationWithDelay` to the existing `ensureAgreementChecked` harness. |

## DRIFT-2026-05-08-T2-001

DRIFT_ID: DRIFT-2026-05-08-T2-001

STATUS: ACTIVE

SUPERSEDES_DRIFT_ID: NONE

SUPERSEDED_BY_DRIFT_ID: NONE

SCOPE: Task 2 sidepanel switch copy

TRIGGER: Task 2 spec reviewer reported that the frozen Task 2 Step 3 HTML copy snippet omitted required operation categories while the implementation used spec-complete copy.

FROZEN_PLAN_STEP: `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:330-348`, especially line 337 title copy and line 344 caption copy.

GOVERNING_SPEC_REQUIREMENT: `docs/superpowers/specs/2026-05-07-operation-delay-design.md:36-38` requires the sidepanel boolean operation-delay switch label to communicate waits after page input, selection, click, submit, continue, and authorization operations.

REPO_OR_WORKTREE_EVIDENCE: `sidepanel/sidepanel.html:578-589` implements the switch; line 582 title copy and line 589 visible caption copy cover input, selection, click, submit, continue, authorization, and 2 seconds.

INVESTIGATOR_JUDGMENTS: Two fresh read-only investigators returned `PLAN_DRIFT_CONTINUE_SAFE`. Investigator 1 found the implementation aligned with the immutable spec and literal frozen-plan copy would under-satisfy the spec. Investigator 2 found Task 2 Step 3's literal HTML snippet not executable as written for the copy requirement, while the rest of Task 2 remains safely executable.

P9_FINAL_ADJUDICATION: PLAN_DRIFT_CONTINUE_SAFE

EFFECTIVE_EXECUTION_CONTRACT: For Task 2 and later reviews, treat the immutable spec's all-six-category sidepanel switch copy requirement as controlling. Preserve copy that communicates input, selection, click, submit, continue, authorization, and 2 seconds. Do not request or implement a regression to the narrower frozen-plan snippet.

SAFE_TO_CONTINUE: YES

REOPEN_ONLY_IF: New immutable spec evidence changes the sidepanel switch copy requirement, or repo evidence shows the implementation no longer communicates all six operation categories and the 2 second duration.

## DRIFT-2026-05-08-T3-001

DRIFT_ID: DRIFT-2026-05-08-T3-001

STATUS: ACTIVE

SUPERSEDES_DRIFT_ID: NONE

SUPERSEDED_BY_DRIFT_ID: NONE

SCOPE: Task 3 2925 provider metadata test scope

TRIGGER: Task 3 spec reviewer reported that the frozen Task 3 file list and commit step omitted `tests/background-icloud-mail-provider.test.js`, but full-suite verification required updating that existing 2925 provider metadata expectation after the required 2925 operation-delay injection change.

FROZEN_PLAN_STEP: `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:421-431` lists Task 3 files and tests without `tests/background-icloud-mail-provider.test.js`; `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:656-660` gives a Task 3 commit step that also omits that test file.

GOVERNING_SPEC_REQUIREMENT: `docs/superpowers/specs/2026-05-07-operation-delay-design.md:16-22`, `44-52`, and `80-83` require covered page operations to use the centralized content-side operation delay gate and current enabled state, while excluding only disabled/background/excluded work.

REPO_OR_WORKTREE_EVIDENCE: `background.js:11173-11180` implements the 2925 provider reuse metadata with `content/utils.js`, `content/operation-delay.js`, and `content/mail-2925.js` in order. `background/mail-2925-session.js:32-36` implements the matching session injection order. `tests/background-icloud-mail-provider.test.js:140-152` is an existing assertion over the same 2925 provider metadata and must expect `content/operation-delay.js` for the full suite to remain aligned. `npm test` passed 817/817 with that update.

INVESTIGATOR_JUDGMENTS: Two fresh read-only investigators returned `PLAN_DRIFT_CONTINUE_SAFE`. Both found the frozen plan's 2925 production requirement spec-correct, but the file list and commit step incomplete because they omitted an existing metadata test naturally affected by the required `background.js` provider metadata change.

P9_FINAL_ADJUDICATION: PLAN_DRIFT_CONTINUE_SAFE

EFFECTIVE_EXECUTION_CONTRACT: For Task 3 and later reviews, treat `tests/background-icloud-mail-provider.test.js` as in scope. Include it in the Task 3 checkpoint commit with the frozen Task 3 files. Preserve 2925 injection order as `content/utils.js`, `content/operation-delay.js`, `content/mail-2925.js` in both provider reuse and Mail2925 session paths. Do not treat this test update as unrelated scope creep.

SAFE_TO_CONTINUE: YES

REOPEN_ONLY_IF: New repo evidence shows `tests/background-icloud-mail-provider.test.js` no longer asserts the 2925 provider metadata changed by Task 3, or immutable spec evidence removes the 2925/provider reuse operation-delay injection need.

## DRIFT-2026-05-08-T4-001

DRIFT_ID: DRIFT-2026-05-08-T4-001

STATUS: ACTIVE

SUPERSEDES_DRIFT_ID: NONE

SUPERSEDED_BY_DRIFT_ID: NONE

SCOPE: Task 4 Step 3 direct-complete test scope

TRIGGER: Task 4 spec reviewer reported that the frozen Task 4 file list and commit step omitted `tests/step3-direct-complete.test.js`, but Step 3 operation-delay migration must preserve the existing completion-before-navigation contract while routing the deferred password submit through the operation-delay gate.

FROZEN_PLAN_STEP: `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:667-674` lists Task 4 files and tests without `tests/step3-direct-complete.test.js`; `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:788-790` gives a Task 4 commit step that also omits that test file.

GOVERNING_SPEC_REQUIREMENT: `docs/superpowers/specs/2026-05-07-operation-delay-design.md:18-20`, `44-52`, `55-60`, and `80-83` require covered page fills/submits/continues to use the centralized content-side operation delay gate. `docs/superpowers/specs/2026-05-07-operation-delay-design.md:111` makes `data/step-definitions.js` canonical for step keys, and `data/step-definitions.js:14` defines Step 3 as `fill-password`.

REPO_OR_WORKTREE_EVIDENCE: `content/signup-page.js:2463-2580` implements `step3_fillEmailPassword`; `content/signup-page.js:2533-2536` routes password fill through `performOperationWithDelay`; `content/signup-page.js:2559` reports Step 3 completion before deferred submit navigation; `content/signup-page.js:2561-2570` routes the deferred password submit through `performOperationWithDelay`. `tests/step3-direct-complete.test.js:54-235` verifies completion-before-navigation and deferred submit operation-delay behavior. Targeted verification including this test passed 38/38.

INVESTIGATOR_JUDGMENTS: Two fresh read-only investigators returned `PLAN_DRIFT_CONTINUE_SAFE`. Both found the frozen plan's broad Task 4 requirement covers Step 3 signup-page operations, but its exact file list and commit step are incomplete because they omit an existing regression test materially affected by the required `content/signup-page.js` change.

P9_FINAL_ADJUDICATION: PLAN_DRIFT_CONTINUE_SAFE

EFFECTIVE_EXECUTION_CONTRACT: For Task 4 and later reviews, treat `tests/step3-direct-complete.test.js` as in scope. Include it in the Task 4 checkpoint commit with the frozen Task 4 files. Preserve Step 3 completion/report before the deferred navigation-prone submit, and keep both password fill and deferred password submit routed through the shared operation-delay gate.

SAFE_TO_CONTINUE: YES

REOPEN_ONLY_IF: New repo evidence shows `tests/step3-direct-complete.test.js` no longer asserts Step 3 direct-completion behavior affected by Task 4, or immutable spec evidence removes Step 3 password fill/submit from covered OpenAI/auth page operations.

## DRIFT-2026-05-08-T7-001

DRIFT_ID: DRIFT-2026-05-08-T7-001

STATUS: ACTIVE

SUPERSEDES_DRIFT_ID: NONE

SUPERSEDED_BY_DRIFT_ID: NONE

SCOPE: Task 7 mail-2925 full-suite harness scope

TRIGGER: Task 7 implementer reported that targeted docs/exclusion tests passed but full `npm test` failed in `tests/mail-2925-content.test.js` because its extracted `ensureAgreementChecked` harness did not provide the new `performOperationWithDelay` dependency introduced by the spec-correct Task 6 `content/mail-2925.js` operation-delay wrapping.

FROZEN_PLAN_STEP: `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:1031-1039` lists Task 7 files and full existing test verification but omits `tests/mail-2925-content.test.js`; `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:1107-1115` requires full `npm test` to pass; `docs/superpowers/plans/2026-05-07-operation-delay-plan.md:1117-1121` gives a Task 7 commit step that omits that harness file.

GOVERNING_SPEC_REQUIREMENT: `docs/superpowers/specs/2026-05-07-operation-delay-design.md:18-22`, `44-52`, `53-62`, and `80-83` require covered page clicks/submits/controls to use the centralized content-side operation delay gate, while `64-71` excludes polling/background work, not 2925 login/session UI clicks.

REPO_OR_WORKTREE_EVIDENCE: `content/mail-2925.js:490-512` has `ensureAgreementChecked()` calling `performOperationWithDelay` for checkbox clicks, `content/mail-2925.js:1057-1060` defines that helper, and `content/mail-2925.js:1144` calls `ensureAgreementChecked()` from `ensureMail2925Session()`. `tests/mail-2925-content.test.js:896-902` extracts `ensureAgreementChecked` without extracting or stubbing `performOperationWithDelay`, causing `node --test tests/mail-2925-content.test.js` to fail 14/1 and full `npm test` to fail 841/1.

INVESTIGATOR_JUDGMENTS: Two fresh read-only investigators returned `PLAN_DRIFT_CONTINUE_SAFE`. Both found the production `content/mail-2925.js` change spec-correct and the failure a narrow stale test harness issue. Both found Task 7's full-suite requirement makes the harness update necessary despite omission from the frozen Task 7 file list and commit step.

P9_FINAL_ADJUDICATION: PLAN_DRIFT_CONTINUE_SAFE

EFFECTIVE_EXECUTION_CONTRACT: For Task 7 and later reviews, treat `tests/mail-2925-content.test.js` as in scope only for a narrow stale-harness fix that provides or extracts `performOperationWithDelay` for the existing `ensureAgreementChecked` test. Include that test update in the Task 7 checkpoint. Do not change runtime `content/mail-2925.js`, do not remove operation-delay wrapping from 2925 session UI, and do not wrap polling/cleanup handlers.

SAFE_TO_CONTINUE: YES

REOPEN_ONLY_IF: New evidence shows `tests/mail-2925-content.test.js` no longer exercises `ensureAgreementChecked`, or immutable spec evidence removes 2925 login/session UI checkbox clicks from covered operation-delay behavior.
