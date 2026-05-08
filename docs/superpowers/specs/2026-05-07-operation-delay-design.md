# Operation Delay Design Spec

## Goal

Add a default-enabled, sidepanel-controlled 2 second delay between individual page automation operations in Ultra7.0. The feature reduces rapid page interaction failures on slow or unstable networks while keeping the behavior modular enough to port across future upstream versions.

## Non-Goals

- The feature does not add step-to-step delay as its primary behavior.
- The feature does not slow email polling, SMS polling, backend API calls, network retries, background timers, or storage persistence.
- The feature does not run inside `confirm-oauth` or `platform-verify` flows.
- The feature does not create a second tips or log console.
- The feature does not expose a user-editable delay duration in this version.
- The feature does not become Auto-only; manual single-step execution uses the same behavior.

## Scope

The feature covers page-side operations triggered by extension automation during Auto runs and manual single-step runs. A covered operation includes any automation action that writes page DOM state, changes page execution state, selects a value, clicks a page control, submits a form, continues a page flow, or authorizes a page flow.

The delay duration is fixed at 2000 milliseconds. When the setting is enabled, automation waits 2000 milliseconds after each covered page operation completes. For ordinary chains, that pause separates one covered operation from the next. The first covered operation after a page is ready starts immediately. Terminal submit, continue, and authorization actions also receive the 2000 millisecond pause after they complete, even when no later covered operation follows.

The feature treats grouped split verification-code entry as one covered operation. A grouped split code operation fills the full group without per-character or per-field pauses, then receives one 2000 millisecond delay after the group is filled.

## Actors And Entry Points

- Sidepanel user: views and toggles the `操作间延迟` setting in the existing sidepanel settings surface.
- Auto runner: executes the full automation flow and applies the same operation delay setting.
- Manual step runner: executes a selected step from the sidepanel and applies the same operation delay setting.
- Content scripts: perform covered page operations and enforce the delay gate after those operations complete.
- Bottom tips/log console: reports setting changes and setting recovery failures through the existing `log-area` flow.

## Functional Behavior

### Sidepanel Setting

- The sidepanel displays a boolean `操作间延迟` switch in the existing settings surface.
- The switch defaults to enabled when no valid persisted value exists, including first install and upgrades from versions that did not store this setting.
- The switch label communicates that enabled mode waits 2 seconds after page input, selection, click, submit, continue, and authorization operations.
- Toggling the switch persists the new value through the existing settings channel.
- Toggling the switch writes one bottom tips/log entry that states the new enabled or disabled state.
- The enabled-state log message includes the 2 second delay duration.
- The disabled-state log message states that operation delay is off.

### Operation Delay Runtime

- The operation delay gate runs after each covered page operation while the setting is enabled.
- The operation delay gate is skipped while the setting is disabled.
- The operation delay gate is skipped inside steps whose step key is `confirm-oauth` or `platform-verify`.
- The operation delay gate is skipped for background-only work that does not execute page operations.
- A setting change during an active run takes effect after the current covered page operation finishes. A delay already in progress completes unless the user stops the flow.
- A user Stop request interrupts an active 2 second operation delay and propagates the same stop error behavior used by existing content-script waits.

### Covered Operation Examples

- Filling a visible input field is one covered operation.
- Filling a hidden synchronization field is one covered operation.
- Updating page execution state through DOM writes or synthetic input/change events is one covered operation.
- Selecting a dropdown value is one covered operation.
- Clicking a button, link, checkbox, or role-based control is one covered operation.
- Submitting a form through click, dispatch, or request-submit behavior is one covered operation.
- Clicking a continue or authorization button is one covered operation unless the current step key is excluded.
- Filling split OTP or split verification-code fields is one grouped covered operation.

### Excluded Work Examples

- Waiting for an element to appear is not a covered operation.
- Polling mailbox or SMS provider APIs is not a covered operation.
- Sleeping between retry attempts is not a covered operation.
- Writing logs is not a covered operation.
- Persisting sidepanel settings or run state in extension storage is not a covered operation.
- Background tab bookkeeping is not a covered operation.

## State And Data Contracts

- `operationDelayEnabled` is a persisted boolean setting.
- If the persisted value is absent or invalid, the runtime uses `operationDelayEnabled = true`.
- A valid persisted `false` remains `false` across later restores and upgrades.
- The fixed delay duration is 2000 milliseconds.
- The delay duration is not user-editable.
- Runtime page-operation code reads the current enabled state at the start of the delay gate for a covered operation.
- The exclusion set contains exactly these step keys: `confirm-oauth`, `platform-verify`.
- The sidepanel writes setting-change feedback to the existing bottom tips/log stream. It does not write to a separate console.
- Content-side delay enforcement is centralized behind a shared operation delay gate so new page-operation call sites have one integration point.

## Error Handling And Edge Cases

- Missing persisted setting value resolves to enabled.
- Invalid persisted setting value resolves to enabled.
- If setting restoration fails in the sidepanel, the sidepanel displays the default enabled state and writes one warning entry to the bottom tips/log stream.
- If saving a user toggle fails, the sidepanel writes one error entry to the bottom tips/log stream and keeps the visible switch aligned with the last confirmed persisted state.
- If content-side code cannot resolve the setting for a covered operation, the operation delay gate uses enabled mode and a 2000 millisecond delay.
- If a Stop request arrives during an operation delay, the delay rejects with the existing stop error and the current flow stops through the existing stop path.
- Split verification-code input remains a single grouped operation even when the page exposes multiple fields.
- `confirm-oauth` and `platform-verify` perform no operation delay even when they click or submit page controls.

## Acceptance Criteria

- Opening the sidepanel with no persisted setting shows `操作间延迟` enabled.
- Disabling the setting persists `operationDelayEnabled = false` and writes a bottom tips/log entry stating that operation delay is off.
- Enabling the setting persists `operationDelayEnabled = true` and writes a bottom tips/log entry stating that page operations wait 2 seconds.
- Auto execution and manual single-step execution both honor the same setting.
- With the setting enabled, a profile-fill flow starts the first covered page operation immediately after the page is ready, waits 2 seconds after that operation completes, then starts the next covered operation, waits 2 seconds after that operation completes, then starts the next one, and waits 2 seconds after the terminal submit or complete action completes.
- With the setting enabled, a split verification-code flow fills the full group as one covered operation, then waits 2 seconds after the group is filled. It does not wait 2 seconds between individual split fields.
- With the setting disabled, covered page operations run without the 2 second operation delay.
- Email polling, SMS polling, backend retries, background timers, and storage persistence keep their existing cadence.
- `confirm-oauth` and `platform-verify` keep their existing interaction cadence.
- A Stop request during a 2 second operation delay stops the flow through the existing stop behavior.

## Locked Assumptions

- Ultra7.0 uses `data/step-definitions.js` as the canonical source for step keys.
- The existing bottom `log-area` flow is the only tips/log feedback target for this feature.
- The first implementation uses one boolean sidepanel switch and one fixed 2000 millisecond duration.
- The implementation uses a shared content-side operation delay gate instead of scattered business-step sleeps.
- Future page operation call sites use the shared operation delay gate for covered operations.
