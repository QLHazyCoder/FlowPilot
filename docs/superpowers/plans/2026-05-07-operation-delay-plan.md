# Operation Delay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default-enabled, sidepanel-controlled 2 second delay after covered page automation operations, without slowing polling, background work, or excluded OAuth/platform verification flows.

**Architecture:** Keep the product contract in one persisted boolean setting and enforce timing through one shared content-side gate loaded after `content/utils.js`. Background owns setting defaults and broadcast, the sidepanel owns all user-facing switch feedback, and covered content scripts wrap page DOM operations through the shared gate instead of adding scattered sleeps.

**Tech Stack:** Chrome extension MV3, plain JavaScript, `node:test`, `chrome.storage.local`, `chrome.runtime` messaging, existing content-script `sleep()` stop behavior.

---

## File Structure

- `background.js`: add `operationDelayEnabled` to `PERSISTED_SETTING_DEFAULTS`, strict boolean normalization, settings payload defaults, `SIGNUP_PAGE_INJECT_FILES` loading, and the `provider === '2925'` dynamic provider injection list for the new content module.
- `background/message-router.js`: keep `SAVE_SETTING` persistence and `DATA_UPDATED` broadcast for `operationDelayEnabled`; do not write operation-delay success logs from the background.
- `sidepanel/sidepanel.html`: add one `操作间延迟` switch near the existing delay settings.
- `sidepanel/sidepanel.js`: bind the switch, restore invalid or missing values as enabled, persist through `SAVE_SETTING`, roll back on save failure, and write exactly one bottom `log-area` entry for each user-visible toggle result.
- `content/operation-delay.js`: new shared content module that caches the persisted setting, defaults unresolved values to enabled, skips excluded step keys, and waits 2000 ms after a covered operation by using the existing stop-aware `sleep()` from `content/utils.js`.
- `manifest.json`: load `content/operation-delay.js` immediately after `content/utils.js` only in manifest content-script bundles that perform covered page operations.
- `background/steps/create-plus-checkout.js`, `background/steps/fill-plus-checkout.js`, `background/steps/paypal-approve.js`, `background/steps/gopay-approve.js`, `background/mail-2925-session.js`: add `content/operation-delay.js` immediately after `content/utils.js` in dynamic injection arrays for covered checkout, payment, and 2925 session pages.
- `content/auth-page-recovery.js`, `content/signup-page.js`, `content/phone-auth.js`: wrap OpenAI/auth page retry clicks, inputs, hidden DOM synchronizations, clicks, submits, continue actions, and grouped split-code entry.
- `content/plus-checkout.js`, `content/paypal-flow.js`, `content/gopay-flow.js`: wrap checkout, payment, and authorization page DOM writes and clicks.
- `content/duck-mail.js`, `content/mail-2925.js`: wrap only non-polling provider UI operations such as Duck address generation and 2925 login/session preparation.
- `content/mail-163.js`, `content/qq-mail.js`, `content/icloud-mail.js`, `content/gmail-mail.js`, `content/inbucket-mail.js`: leave `POLL_EMAIL` handlers and their refresh/navigation/open/delete polling loops unwrapped so mailbox cadence is unchanged.
- `content/mail-2925.js`: leave `POLL_EMAIL` and `DELETE_ALL_EMAILS` handlers unwrapped because they are mailbox polling/cleanup support paths.
- `content/whatsapp-flow.js`: leave WhatsApp code-reading wait loops unwrapped because they are SMS/OTP polling, not covered page operations.
- `background/steps/confirm-oauth.js`, `background/steps/platform-verify.js`, `background/panel-bridge.js`, `content/sub2api-panel.js`: keep these excluded paths free of operation-delay injection and gate calls.
- `README.md`, `docs/使用教程/使用教程.md`: document the new switch, default-enabled behavior, 2 second fixed delay, grouped OTP behavior, and excluded work.
- `tests/*.test.js`: add focused settings, sidepanel, gate, injection, call-site timing, polling-exclusion, docs, and regression tests.

## Implementation Rules

- `operationDelayEnabled` normalization is strict: only boolean `false` disables the feature, boolean `true` enables it, and absent or invalid values such as `undefined`, `null`, `''`, `0`, and `'false'` resolve to `true`.
- Sidepanel is the only success-log owner for user toggles. Background broadcasts state but does not write a second success entry.
- The delay gate always runs the page operation first and then waits 2000 ms when active. The first covered operation has no pre-wait.
- The 2000 ms wait must call the existing content-script `sleep()` from `content/utils.js`, or a test-injected equivalent, so Stop interrupts the delay with the same stop error path.
- Split verification-code fields are one grouped operation: fill all fields, delay once, then treat any submit/continue click as a separate covered operation with its own post-action delay.
- `confirm-oauth` and `platform-verify` remain excluded by step key and by keeping their dedicated injection paths free of `content/operation-delay.js`.
- `POLL_EMAIL`, SMS/OTP polling, background retries, timers, storage writes, and network-only API calls remain unwrapped.

## TASK_GROUP 1: Persisted setting and sidepanel control

### Task 1: Add the new persisted setting and broadcast contract

**Files:**
- Modify: `background.js`
- Modify: `background/message-router.js`
- Test: `tests/background-operation-delay-settings.test.js`
- Test: `tests/background-message-router-module.test.js`

- [ ] **Step 1: Write the failing tests**

Add `tests/background-operation-delay-settings.test.js` with assertions for the strict persisted setting contract:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('operationDelayEnabled defaults to enabled and strictly normalizes values', () => {
  const defaultsBlock = source.slice(
    source.indexOf('const PERSISTED_SETTING_DEFAULTS = {'),
    source.indexOf('const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);')
  );
  assert.match(defaultsBlock, /operationDelayEnabled:\s*true/);

  const api = new Function(`${extractFunction('normalizePersistentSettingValue')}; return { normalizePersistentSettingValue };`)();
  for (const value of [undefined, null, '', 0, 'false']) {
    assert.equal(api.normalizePersistentSettingValue('operationDelayEnabled', value), true);
  }
  assert.equal(api.normalizePersistentSettingValue('operationDelayEnabled', true), true);
  assert.equal(api.normalizePersistentSettingValue('operationDelayEnabled', false), false);
});

test('operationDelayEnabled is normalized through the background settings payload path', () => {
  const api = new Function(`
    const PERSISTED_SETTING_DEFAULTS = { operationDelayEnabled: true };
    const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
    function resolveLegacyAutoStepDelaySeconds() { return undefined; }
    ${extractFunction('normalizePersistentSettingValue')}
    ${extractFunction('buildPersistentSettingsPayload')}
    return { buildPersistentSettingsPayload };
  `)();

  assert.equal(api.buildPersistentSettingsPayload({}, { fillDefaults: true }).operationDelayEnabled, true);
  for (const value of [undefined, null, '', 0, 'false', true]) {
    assert.equal(api.buildPersistentSettingsPayload({ operationDelayEnabled: value }, { fillDefaults: true }).operationDelayEnabled, true);
  }
  assert.equal(api.buildPersistentSettingsPayload({ operationDelayEnabled: false }).operationDelayEnabled, false);
});
```

Extend `tests/background-message-router-module.test.js` with a broadcast-only router assertion:

```js
test('SAVE_SETTING broadcasts operation delay setting without background success log', async () => {
  const source = fs.readFileSync('background/message-router.js', 'utf8');
  const globalScope = { console };
  const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);
  const broadcasts = [];
  const logs = [];
  let state = { operationDelayEnabled: true, plusModeEnabled: false, plusPaymentMethod: 'paypal' };

  const router = api.createMessageRouter({
    addLog: async (message, level = 'info') => logs.push({ message, level }),
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: (input = {}) => Object.prototype.hasOwnProperty.call(input, 'operationDelayEnabled')
      ? { operationDelayEnabled: input.operationDelayEnabled === false ? false : true }
      : {},
    broadcastDataUpdate: (payload) => broadcasts.push(payload),
    getState: async () => ({ ...state }),
    setPersistentSettings: async () => {},
    setState: async (updates) => { state = { ...state, ...updates }; },
  });

  const response = await router.handleMessage({
    type: 'SAVE_SETTING',
    source: 'sidepanel',
    payload: { operationDelayEnabled: false },
  });

  assert.equal(response.ok, true);
  assert.equal(state.operationDelayEnabled, false);
  assert.deepStrictEqual(broadcasts.at(-1), { operationDelayEnabled: false });
  assert.equal(logs.length, 0);
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `node --test tests/background-operation-delay-settings.test.js tests/background-message-router-module.test.js`

Expected: FAIL with assertions showing `operationDelayEnabled` is missing from defaults/normalization and no broadcast-only contract exists yet.

- [ ] **Step 3: Write the minimal implementation**

Patch `background.js` so the new setting is in the persisted defaults and uses strict boolean normalization:

```js
const PERSISTED_SETTING_DEFAULTS = {
  // existing keys stay in place
  operationDelayEnabled: true,
};

function normalizePersistentSettingValue(key, value) {
  switch (key) {
    case 'operationDelayEnabled':
      return typeof value === 'boolean' ? value : true;
    // existing cases stay unchanged
  }
}
```

Keep `background/message-router.js` on the existing `SAVE_SETTING` path. The required behavior is that `buildPersistentSettingsPayload(message.payload)` includes `operationDelayEnabled` when present, `setState(stateUpdates)` persists it into runtime state, and `broadcastDataUpdate(stateUpdates)` emits it once. Do not add an `addLog()` branch for operation-delay success feedback in the router.

- [ ] **Step 4: Run the targeted tests and verify they pass**

Run: `node --test tests/background-operation-delay-settings.test.js tests/background-message-router-module.test.js`

Expected: PASS for all tests in both files.

- [ ] **Step 5: Commit**

```bash
git add background.js background/message-router.js tests/background-operation-delay-settings.test.js tests/background-message-router-module.test.js
git commit -m "feat: persist operation delay setting"
```

### Task 2: Add the sidepanel switch and single-owner tips/log feedback

**Files:**
- Modify: `sidepanel/sidepanel.html`
- Modify: `sidepanel/sidepanel.js`
- Test: `tests/sidepanel-operation-delay.test.js`

- [ ] **Step 1: Write the failing test**

Add `tests/sidepanel-operation-delay.test.js` with structural and behavior-level assertions:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

test('sidepanel exposes one operation delay switch in the existing settings surface', () => {
  assert.match(html, /id="row-operation-delay-settings"/);
  assert.match(html, /id="input-operation-delay-enabled"/);
  assert.match(html, /操作间延迟/);
  assert.match(html, /2\s*秒/);
});

test('sidepanel owns operation delay toggle feedback exactly once', () => {
  assert.match(source, /inputOperationDelayEnabled/);
  assert.match(source, /operationDelayEnabled/);
  assert.match(source, /appendLog\(\{[\s\S]*操作间延迟/);
  assert.doesNotMatch(source, /operationDelayEnabled[\s\S]{0,240}addLog\(/);
});

test('sidepanel operation delay restore and save failure contracts are explicit', () => {
  assert.match(source, /normalizeOperationDelayEnabled/);
  assert.match(source, /lastConfirmedOperationDelayEnabled/);
  assert.match(source, /操作间延迟设置读取失败/);
  assert.match(source, /操作间延迟设置保存失败/);
  assert.match(source, /inputOperationDelayEnabled\.checked\s*=\s*lastConfirmedOperationDelayEnabled/);
});
```

Add a small executable harness in the same file for the new helper behavior. The helper names can be extracted from `sidepanel.js`, but the assertions must prove these contracts:

```js
function loadOperationDelaySidepanelHarness() {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const runtimeMessages = [];
  const logs = [];
  const inputOperationDelayEnabled = { checked: true, disabled: false };

  function extractFunction(name) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `missing ${name}`);
    let depth = 0;
    let signatureEnded = false;
    let bodyStart = -1;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '(') depth += 1;
      if (ch === ')') {
        depth -= 1;
        if (depth === 0) signatureEnded = true;
      }
      if (ch === '{' && signatureEnded) {
        bodyStart = i;
        break;
      }
    }
    let braceDepth = 0;
    for (let i = bodyStart; i < source.length; i += 1) {
      const ch = source[i];
      if (ch === '{') braceDepth += 1;
      if (ch === '}') {
        braceDepth -= 1;
        if (braceDepth === 0) return source.slice(start, i + 1);
      }
    }
    throw new Error(`unterminated ${name}`);
  }

  const chrome = {
    runtime: {
      sendMessage: async (message) => {
        runtimeMessages.push(message);
        return { ok: true, state: { operationDelayEnabled: message.payload.operationDelayEnabled } };
      },
    },
  };

  const harness = new Function('chrome', 'appendLog', 'inputOperationDelayEnabled', 'latestState', `
    let lastConfirmedOperationDelayEnabled = true;
    function syncLatestState(nextState) {
      latestState = { ...(latestState || {}), ...(nextState || {}) };
    }
    ${extractFunction('normalizeOperationDelayEnabled')}
    ${extractFunction('appendOperationDelayLog')}
    ${extractFunction('applyOperationDelayState')}
    ${extractFunction('persistOperationDelayToggle')}
    return {
      applyOperationDelayState,
      persistOperationDelayToggle,
      getLastConfirmedOperationDelayEnabled: () => lastConfirmedOperationDelayEnabled,
      setLastConfirmedOperationDelayEnabled: (value) => { lastConfirmedOperationDelayEnabled = value; },
    };
  `)(chrome, (entry) => logs.push(entry), inputOperationDelayEnabled, { operationDelayEnabled: true });

  return { chrome, harness, inputOperationDelayEnabled, logs, runtimeMessages };
}

test('operation delay switch logs once, defaults restore failures to enabled, and rolls back save failures', async () => {
  const { chrome, harness: helpers, inputOperationDelayEnabled: input, logs, runtimeMessages: sentMessages } = loadOperationDelaySidepanelHarness();

  helpers.applyOperationDelayState({ operationDelayEnabled: undefined }, { restoreFailed: true });
  assert.equal(input.checked, true);
  assert.equal(logs.filter((entry) => entry.level === 'warn').length, 1);

  logs.length = 0;
  input.checked = false;
  await helpers.persistOperationDelayToggle();
  assert.equal(sentMessages.at(-1).payload.operationDelayEnabled, false);
  assert.equal(logs.length, 1);
  assert.match(logs[0].message, /关闭|off/i);

  sentMessages.length = 0;
  chrome.runtime.sendMessage = async () => { throw new Error('network down'); };
  logs.length = 0;
  input.checked = true;
  helpers.setLastConfirmedOperationDelayEnabled(false);
  await assert.rejects(() => helpers.persistOperationDelayToggle(), /network down/);
  assert.equal(input.checked, false);
  assert.equal(logs.filter((entry) => entry.level === 'error').length, 1);
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `node --test tests/sidepanel-operation-delay.test.js`

Expected: FAIL with missing switch/helper/log assertions.

- [ ] **Step 3: Write the minimal implementation**

Add this row near `row-auto-delay-settings` in `sidepanel/sidepanel.html`:

```html
<div class="data-row" id="row-operation-delay-settings">
  <span class="data-label">操作间延迟</span>
  <div class="data-inline setting-pair operation-delay-setting-pair">
    <div class="setting-group setting-group-primary operation-delay-setting">
      <label class="toggle-switch" for="input-operation-delay-enabled" title="开启后，每次页面操作完成后等待 2 秒">
        <input type="checkbox" id="input-operation-delay-enabled" checked />
        <span class="toggle-switch-track" aria-hidden="true">
          <span class="toggle-switch-thumb"></span>
        </span>
        <span>启用</span>
      </label>
      <span class="setting-caption">页面输入/点击/提交后等待 2 秒</span>
    </div>
  </div>
</div>
```

Patch `sidepanel/sidepanel.js` with a narrow sidepanel-owned setting handler:

```js
const inputOperationDelayEnabled = document.getElementById('input-operation-delay-enabled');
let lastConfirmedOperationDelayEnabled = true;

function normalizeOperationDelayEnabled(value) {
  return typeof value === 'boolean' ? value : true;
}

function appendOperationDelayLog(enabled, level = 'info', message = '') {
  appendLog({
    timestamp: Date.now(),
    level,
    message: message || (enabled
      ? '操作间延迟已开启：页面操作完成后等待 2 秒。'
      : '操作间延迟已关闭：页面操作将连续执行。'),
  });
}

function applyOperationDelayState(state = latestState, options = {}) {
  const enabled = normalizeOperationDelayEnabled(state?.operationDelayEnabled);
  lastConfirmedOperationDelayEnabled = enabled;
  if (inputOperationDelayEnabled) inputOperationDelayEnabled.checked = enabled;
  if (options.restoreFailed) {
    appendOperationDelayLog(true, 'warn', '操作间延迟设置读取失败，已回退为默认开启。');
  }
}

async function persistOperationDelayToggle() {
  const nextEnabled = Boolean(inputOperationDelayEnabled?.checked);
  const previousEnabled = lastConfirmedOperationDelayEnabled;
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SETTING',
      source: 'sidepanel',
      payload: { operationDelayEnabled: nextEnabled },
    });
    if (response?.error) throw new Error(response.error);
    const confirmed = normalizeOperationDelayEnabled(response?.state?.operationDelayEnabled ?? nextEnabled);
    lastConfirmedOperationDelayEnabled = confirmed;
    if (inputOperationDelayEnabled) inputOperationDelayEnabled.checked = confirmed;
    syncLatestState({ operationDelayEnabled: confirmed });
    appendOperationDelayLog(confirmed);
  } catch (error) {
    if (inputOperationDelayEnabled) inputOperationDelayEnabled.checked = previousEnabled;
    appendOperationDelayLog(previousEnabled, 'error', `操作间延迟设置保存失败，已恢复为上一次确认的状态：${error.message}`);
    throw error;
  }
}
```

Call `applyOperationDelayState(state)` from `applySettingsState(state)` and from the `DATA_UPDATED` branch when `message.payload.operationDelayEnabled !== undefined`. The `DATA_UPDATED` sync path must update the switch but must not call `appendOperationDelayLog`, because the user toggle handler is the single success-log owner. Add `inputOperationDelayEnabled.addEventListener('change', () => { persistOperationDelayToggle().catch(() => {}); });` with the existing event listener block.

- [ ] **Step 4: Run the targeted test and verify it passes**

Run: `node --test tests/sidepanel-operation-delay.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sidepanel/sidepanel.html sidepanel/sidepanel.js tests/sidepanel-operation-delay.test.js
git commit -m "feat: add operation delay sidepanel toggle"
```

## TASK_GROUP 2: Shared content-side operation gate and loading

### Task 3: Add the shared delay gate and load it on covered pages

**Files:**
- Create: `content/operation-delay.js`
- Modify: `manifest.json`
- Modify: `background.js`
- Modify: `background/steps/create-plus-checkout.js`
- Modify: `background/steps/fill-plus-checkout.js`
- Modify: `background/steps/paypal-approve.js`
- Modify: `background/steps/gopay-approve.js`
- Modify: `background/mail-2925-session.js`
- Test: `tests/content-operation-delay.test.js`
- Test: `tests/operation-delay-injection.test.js`

- [ ] **Step 1: Write the failing tests**

Add `tests/content-operation-delay.test.js` for the gate contract:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadOperationDelayApi(overrides = {}) {
  const source = fs.readFileSync('content/operation-delay.js', 'utf8');
  const root = {
    console,
    sleep: async (ms) => overrides.events?.push(`sleep:${ms}`),
    chrome: overrides.chrome || { storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } } },
  };
  new Function('self', 'globalThis', `${source}; return self.CodexOperationDelay;`)(root, root);
  return root.CodexOperationDelay;
}

test('operation delay runs action first and waits once after completion', async () => {
  const events = [];
  const api = loadOperationDelayApi({ events });
  await api.performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill' }, async () => {
    events.push('operation:start');
    events.push('operation:end');
  }, { sleep: async (ms) => events.push(`sleep:${ms}`), getEnabled: () => true });
  assert.deepStrictEqual(events, ['operation:start', 'operation:end', 'sleep:2000']);
});

test('operation delay skips disabled mode and excluded step keys', async () => {
  const api = loadOperationDelayApi();
  assert.equal(api.shouldDelayOperation({ enabled: false, stepKey: 'fill-profile', kind: 'click' }), false);
  assert.equal(api.shouldDelayOperation({ enabled: true, stepKey: 'confirm-oauth', kind: 'click' }), false);
  assert.equal(api.shouldDelayOperation({ enabled: true, stepKey: 'platform-verify', kind: 'submit' }), false);
  assert.equal(api.shouldDelayOperation({ enabled: true, stepKey: 'fill-profile', kind: 'fill' }), true);
});

test('operation delay defaults unresolved settings to enabled', async () => {
  const events = [];
  const api = loadOperationDelayApi({ events, chrome: { storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } } } });
  await api.performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill' }, async () => events.push('operation'), { sleep: async (ms) => events.push(`sleep:${ms}`) });
  assert.deepStrictEqual(events, ['operation', 'sleep:2000']);
});

test('invalid persisted values still resolve to enabled', async () => {
  const api = loadOperationDelayApi({ chrome: { storage: { local: { get: async () => ({ operationDelayEnabled: 'false' }) }, onChanged: { addListener() {} } } } });
  await api.refreshOperationDelaySetting();
  assert.equal(api.getOperationDelayEnabled(), true);
});

test('operation delay uses stop-aware sleep and propagates stop errors', async () => {
  const api = loadOperationDelayApi();
  await assert.rejects(
    () => api.performOperationWithDelay({ stepKey: 'fill-profile', kind: 'click' }, async () => {}, {
      sleep: async () => { throw new Error('流程已被用户停止。'); },
      getEnabled: () => true,
    }),
    /流程已被用户停止/
  );
});

test('grouped split-code metadata still delays only once', async () => {
  const events = [];
  const api = loadOperationDelayApi();
  await api.performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'grouped-code' }, async () => {
    for (let index = 0; index < 6; index += 1) events.push(`fill:${index}`);
  }, { sleep: async (ms) => events.push(`sleep:${ms}`), getEnabled: () => true });
  assert.deepStrictEqual(events, ['fill:0', 'fill:1', 'fill:2', 'fill:3', 'fill:4', 'fill:5', 'sleep:2000']);
});
```

Add `tests/operation-delay-injection.test.js` to enforce load order and excluded paths:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function assertOrdered(list, before, after) {
  assert.ok(list.includes(before), `missing ${before}`);
  assert.ok(list.includes(after), `missing ${after}`);
  assert.ok(list.indexOf(before) < list.indexOf(after), `${before} must load before ${after}`);
}

test('manifest loads operation delay after utils only for covered auth/provider bundles', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const authBundle = manifest.content_scripts.find((entry) => entry.js.includes('content/signup-page.js')).js;
  assertOrdered(authBundle, 'content/utils.js', 'content/operation-delay.js');
  assertOrdered(authBundle, 'content/operation-delay.js', 'content/auth-page-recovery.js');
  assertOrdered(authBundle, 'content/operation-delay.js', 'content/signup-page.js');

  const duckBundle = manifest.content_scripts.find((entry) => entry.js.includes('content/duck-mail.js')).js;
  assertOrdered(duckBundle, 'content/utils.js', 'content/operation-delay.js');
  assertOrdered(duckBundle, 'content/operation-delay.js', 'content/duck-mail.js');

  for (const pollingFile of ['content/qq-mail.js', 'content/mail-163.js', 'content/icloud-mail.js']) {
    const bundle = manifest.content_scripts.find((entry) => entry.js.includes(pollingFile))?.js || [];
    assert.equal(bundle.includes('content/operation-delay.js'), false, `${pollingFile} polling bundle must not load operation delay`);
  }
});

test('dynamic covered injections load operation delay after utils', () => {
  const expectations = [
    ['background.js', 'SIGNUP_PAGE_INJECT_FILES'],
    ['background/steps/create-plus-checkout.js', 'PLUS_CHECKOUT_INJECT_FILES'],
    ['background/steps/fill-plus-checkout.js', 'PLUS_CHECKOUT_INJECT_FILES'],
    ['background/steps/paypal-approve.js', 'PAYPAL_INJECT_FILES'],
    ['background/steps/gopay-approve.js', 'GOPAY_INJECT_FILES'],
    ['background/mail-2925-session.js', 'MAIL2925_INJECT'],
  ];
  for (const [file, constantName] of expectations) {
    const source = fs.readFileSync(file, 'utf8');
    const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*\\[([^\\]]+)\\]`));
    assert.ok(match, `missing ${constantName} in ${file}`);
    const block = match[1];
    assert.match(block, /'content\/utils\.js'[\s\S]*'content\/operation-delay\.js'/, `${file} must inject operation delay after utils`);
    if (constantName === 'SIGNUP_PAGE_INJECT_FILES') {
      assert.match(block, /'content\/operation-delay\.js'[\s\S]*'content\/auth-page-recovery\.js'/, 'auth recovery must load after operation delay');
    }
  }
});

test('2925 provider reuse path also injects operation delay', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const start = source.indexOf("if (provider === '2925')");
  assert.notEqual(start, -1, 'missing 2925 provider config');
  const end = source.indexOf("return { source: 'qq-mail'", start);
  const block = source.slice(start, end);
  assert.match(block, /inject:\s*\[[\s\S]*'content\/utils\.js'[\s\S]*'content\/operation-delay\.js'[\s\S]*'content\/mail-2925\.js'[\s\S]*\]/);
});

test('excluded platform verification paths do not load operation delay', () => {
  for (const file of ['background/steps/platform-verify.js', 'background/panel-bridge.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /content\/operation-delay\.js/);
  }
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `node --test tests/content-operation-delay.test.js tests/operation-delay-injection.test.js`

Expected: FAIL because `content/operation-delay.js` does not exist and the injection arrays do not include it.

- [ ] **Step 3: Write the minimal implementation**

Create `content/operation-delay.js` with this public content-side API shape:

```js
(function attachOperationDelay(root) {
  const OPERATION_DELAY_MS = 2000;
  const EXCLUDED_STEP_KEYS = new Set(['confirm-oauth', 'platform-verify']);
  let operationDelayEnabled = true;

  function normalizeOperationDelayEnabled(value) {
    return typeof value === 'boolean' ? value : true;
  }

  function getOperationDelayEnabled() {
    return operationDelayEnabled;
  }

  async function refreshOperationDelaySetting() {
    try {
      const data = await root.chrome?.storage?.local?.get?.(['operationDelayEnabled']);
      operationDelayEnabled = normalizeOperationDelayEnabled(data?.operationDelayEnabled);
    } catch {
      operationDelayEnabled = true;
    }
    return operationDelayEnabled;
  }

  function shouldDelayOperation(metadata = {}) {
    if (metadata.skipOperationDelay === true) return false;
    if (metadata.enabled === false) return false;
    if (EXCLUDED_STEP_KEYS.has(String(metadata.stepKey || '').trim())) return false;
    return true;
  }

  async function performOperationWithDelay(metadata = {}, operation, options = {}) {
    const result = await operation();
    const enabled = typeof options.getEnabled === 'function'
      ? normalizeOperationDelayEnabled(options.getEnabled())
      : getOperationDelayEnabled();
    if (shouldDelayOperation({ ...metadata, enabled })) {
      const wait = options.sleep || root.sleep;
      await wait(OPERATION_DELAY_MS);
    }
    return result;
  }

  root.chrome?.storage?.onChanged?.addListener?.((changes, areaName) => {
    if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'operationDelayEnabled')) {
      operationDelayEnabled = normalizeOperationDelayEnabled(changes.operationDelayEnabled?.newValue);
    }
  });

  refreshOperationDelaySetting().catch(() => { operationDelayEnabled = true; });
  root.CodexOperationDelay = { OPERATION_DELAY_MS, normalizeOperationDelayEnabled, refreshOperationDelaySetting, getOperationDelayEnabled, shouldDelayOperation, performOperationWithDelay };
})(typeof self !== 'undefined' ? self : globalThis);
```

Add `content/operation-delay.js` immediately after `content/utils.js` in these covered load paths:

```js
['content/utils.js', 'content/operation-delay.js', 'content/auth-page-recovery.js', 'content/phone-country-utils.js', 'content/phone-auth.js', 'content/signup-page.js']
['content/utils.js', 'content/operation-delay.js', 'content/plus-checkout.js']
['content/utils.js', 'content/operation-delay.js', 'content/paypal-flow.js']
['content/utils.js', 'content/operation-delay.js', 'content/gopay-flow.js']
['content/utils.js', 'content/operation-delay.js', 'content/duck-mail.js']
['content/utils.js', 'content/operation-delay.js', 'content/mail-2925.js']
```

For 2925, update both `background/mail-2925-session.js` `MAIL2925_INJECT` and the `provider === '2925'` injection object in `background.js` so an already-ready tab from the provider polling path still has `window.CodexOperationDelay` available before `ENSURE_MAIL2925_SESSION` runs. Do not add `content/operation-delay.js` to the manifest mail polling bundles, `background/steps/platform-verify.js`, or `background/panel-bridge.js`.

- [ ] **Step 4: Run the targeted tests and verify they pass**

Run: `node --test tests/content-operation-delay.test.js tests/operation-delay-injection.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/operation-delay.js manifest.json background.js background/steps/create-plus-checkout.js background/steps/fill-plus-checkout.js background/steps/paypal-approve.js background/steps/gopay-approve.js background/mail-2925-session.js tests/content-operation-delay.test.js tests/operation-delay-injection.test.js
git commit -m "feat: add shared operation delay gate"
```

## TASK_GROUP 3: Covered page-operation call-site migration

### Task 4: Route OpenAI/auth page operations through the delay gate

**Files:**
- Modify: `content/auth-page-recovery.js`
- Modify: `content/signup-page.js`
- Modify: `content/phone-auth.js`
- Test: `tests/auth-page-recovery.test.js`
- Test: `tests/step5-direct-complete.test.js`
- Test: `tests/step4-split-code-submit.test.js`
- Test: `tests/step7-phone-login-entry.test.js`

- [ ] **Step 1: Write the failing tests**

Extend the representative flow harnesses so they inject a fake `CodexOperationDelay.performOperationWithDelay` that records operation metadata, delegates to the wrapped operation, and records a `delay:2000` event after the operation. Required assertions:

```js
assert.deepStrictEqual(authRetryEvents, [
  'operation:auth-retry-click:start',
  'click:retry',
  'operation:auth-retry-click:end',
  'delay:auth-retry-click:2000',
  'poll-sleep:250',
]);
assert.equal(authRetryEvents.filter((event) => event.startsWith('delay:auth-retry-click')).length, 1);
assert.doesNotMatch(extractFunction(source, 'waitForRetryPageRecoveryAfterClick'), /performOperationWithDelay\(/);
```

```js
assert.deepStrictEqual(profileEvents, [
  'operation:fill-name:start',
  'fill:name',
  'operation:fill-name:end',
  'delay:fill-name:2000',
  'operation:fill-birthday:start',
  'fill:birthday',
  'operation:fill-birthday:end',
  'delay:fill-birthday:2000',
  'operation:submit-profile:start',
  'click:complete',
  'operation:submit-profile:end',
  'delay:submit-profile:2000',
]);
assert.ok(profileEvents.indexOf('operation:fill-name:start') < profileEvents.indexOf('delay:fill-name:2000'));
```

```js
assert.deepStrictEqual(splitCodeEvents, [
  'operation:split-code:start',
  'fill-code:0',
  'fill-code:1',
  'fill-code:2',
  'fill-code:3',
  'fill-code:4',
  'fill-code:5',
  'operation:split-code:end',
  'delay:split-code:2000',
  'operation:submit-code:start',
  'click:submit-code',
  'operation:submit-code:end',
  'delay:submit-code:2000',
]);
assert.equal(splitCodeEvents.filter((event) => event.startsWith('delay:split-code')).length, 1);
```

```js
assert.deepStrictEqual(runModeEvents.auto.map((event) => event.delayMs), runModeEvents.manual.map((event) => event.delayMs));
assert.deepStrictEqual(runModeEvents.auto.map((event) => event.kind), runModeEvents.manual.map((event) => event.kind));
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `node --test tests/auth-page-recovery.test.js tests/step5-direct-complete.test.js tests/step4-split-code-submit.test.js tests/step7-phone-login-entry.test.js`

Expected: FAIL because the OpenAI/auth content scripts still call page operations directly and do not emit delay-gate events.

- [ ] **Step 3: Write the minimal implementation**

In `content/auth-page-recovery.js`, wrap only the retry button click and keep `waitForRetryPageRecoveryAfterClick` polling sleeps unwrapped:

```js
const rootScope = typeof self !== 'undefined' ? self : globalThis;
const performOperationWithDelay = deps.performOperationWithDelay
  || rootScope.CodexOperationDelay?.performOperationWithDelay;

await performOperationWithDelay({ stepKey: options.stepKey || '', kind: 'click', label: 'auth-retry-click' }, async () => {
  simulateClick(retryState.retryButton);
});
```

In `content/signup-page.js` and `content/phone-auth.js`, add a local wrapper alias and route covered operations through it:

```js
const performOperationWithDelay = (...args) => window.CodexOperationDelay.performOperationWithDelay(...args);

await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'fill', label: 'fill-name' }, async () => {
  fillInput(nameInput, fullName);
});

await performOperationWithDelay({ stepKey: 'fill-profile', kind: 'hidden-sync', label: 'profile-dom-sync' }, async () => {
  hiddenInput.value = value;
  hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
  hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
});

await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'grouped-code', label: 'split-code' }, async () => {
  splitInputs.forEach((input, index) => fillInput(input, code[index] || ''));
});

await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'submit', label: 'submit-code' }, async () => {
  simulateClick(submitButton);
});
```

Apply the same wrapper to visible input fills, hidden DOM sync writes, dropdown selections, `simulateClick`/submit/continue actions, and phone-auth submit/resend/verification operations that mutate the page. Do not wrap wait-only helpers such as `waitForElement`, network retry waits, or polling sleeps.

- [ ] **Step 4: Run the targeted tests and verify they pass**

Run: `node --test tests/auth-page-recovery.test.js tests/step5-direct-complete.test.js tests/step4-split-code-submit.test.js tests/step7-phone-login-entry.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/auth-page-recovery.js content/signup-page.js content/phone-auth.js tests/auth-page-recovery.test.js tests/step5-direct-complete.test.js tests/step4-split-code-submit.test.js tests/step7-phone-login-entry.test.js
git commit -m "feat: delay OpenAI page operations"
```

### Task 5: Route checkout and payment page operations through the delay gate

**Files:**
- Modify: `content/plus-checkout.js`
- Modify: `content/paypal-flow.js`
- Modify: `content/gopay-flow.js`
- Test: `tests/plus-checkout-create-wait.test.js`
- Test: `tests/paypal-approve-detection.test.js`
- Test: `tests/gopay-flow-content.test.js`
- Test: `tests/plus-checkout-billing-tab-resolution.test.js`

- [ ] **Step 1: Write the failing tests**

Extend the existing checkout/payment harnesses with gate event assertions instead of regex-only checks:

```js
assert.deepStrictEqual(checkoutEvents.filter((event) => event.type === 'operation').map((event) => event.label), [
  'select-payment-method',
  'fill-billing-address',
  'click-subscribe',
]);
assert.deepStrictEqual(checkoutEvents.filter((event) => event.type === 'delay').map((event) => event.ms), [2000, 2000, 2000]);
```

```js
assert.deepStrictEqual(paypalEvents, [
  'operation:paypal-email:start',
  'fill:paypal-email',
  'operation:paypal-email:end',
  'delay:paypal-email:2000',
  'operation:paypal-approve:start',
  'click:paypal-approve',
  'operation:paypal-approve:end',
  'delay:paypal-approve:2000',
]);
```

```js
assert.deepStrictEqual(gopayEvents.filter((event) => event.type === 'delay').map((event) => event.label), [
  'submit-phone',
  'submit-otp',
  'submit-pin',
  'click-continue',
  'click-pay-now',
]);
assert.equal(gopayEvents.some((event) => event.type === 'delay' && event.ms !== 2000), false);
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `node --test tests/plus-checkout-create-wait.test.js tests/paypal-approve-detection.test.js tests/gopay-flow-content.test.js tests/plus-checkout-billing-tab-resolution.test.js`

Expected: FAIL because checkout and payment page operations still bypass the shared gate.

- [ ] **Step 3: Write the minimal implementation**

Route each covered DOM write or click in `content/plus-checkout.js`, `content/paypal-flow.js`, and `content/gopay-flow.js` through `window.CodexOperationDelay.performOperationWithDelay`. Required wrapped operation labels include these page actions when present:

```js
['select-payment-method', 'fill-billing-address', 'fill-address-query', 'select-address-suggestion', 'click-subscribe']
['paypal-email', 'paypal-password', 'paypal-dismiss-prompt', 'paypal-approve']
['submit-phone', 'submit-otp', 'submit-pin', 'click-continue', 'click-pay-now']
```

Keep terminal subscribe, approve, continue, and pay-now actions inside the wrapper so each receives a post-operation 2000 ms delay after the click completes. Do not wrap background polling waits, page-load waits, or network-only GPC helper API calls.

- [ ] **Step 4: Run the targeted tests and verify they pass**

Run: `node --test tests/plus-checkout-create-wait.test.js tests/paypal-approve-detection.test.js tests/gopay-flow-content.test.js tests/plus-checkout-billing-tab-resolution.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/plus-checkout.js content/paypal-flow.js content/gopay-flow.js tests/plus-checkout-create-wait.test.js tests/paypal-approve-detection.test.js tests/gopay-flow-content.test.js tests/plus-checkout-billing-tab-resolution.test.js
git commit -m "feat: delay checkout and payment page operations"
```

### Task 6: Wrap non-polling provider UI operations and protect polling cadence

**Files:**
- Modify: `content/duck-mail.js`
- Modify: `content/mail-2925.js`
- Test: `tests/provider-operation-delay.test.js`
- Test: `tests/mail-polling-operation-delay-exclusion.test.js`

- [ ] **Step 1: Write the failing tests**

Add `tests/provider-operation-delay.test.js` for non-polling provider actions:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Duck address generation routes the generator click through operation delay', () => {
  const source = fs.readFileSync('content/duck-mail.js', 'utf8');
  assert.match(source, /performOperationWithDelay\([\s\S]*duck-generate-address/);
});

test('2925 session preparation routes through operation delay while cleanup stays delay-free', () => {
  const source = fs.readFileSync('content/mail-2925.js', 'utf8');
  assert.match(source, /ENSURE_MAIL2925_SESSION[\s\S]*performOperationWithDelay/);
  const deleteAllStart = source.indexOf("message.type === 'DELETE_ALL_EMAILS'");
  assert.notEqual(deleteAllStart, -1, 'missing DELETE_ALL_EMAILS handler');
  const deleteAllBlock = source.slice(deleteAllStart, source.indexOf('return false;', deleteAllStart));
  assert.doesNotMatch(deleteAllBlock, /performOperationWithDelay\(/);
});
```

Add `tests/mail-polling-operation-delay-exclusion.test.js` to preserve polling cadence:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function extractPollEmailHandler(source) {
  const start = source.indexOf("message.type === 'POLL_EMAIL'");
  assert.notEqual(start, -1, 'missing POLL_EMAIL handler');
  const nextHandler = source.indexOf("message.type === '", start + 1);
  return nextHandler === -1 ? source.slice(start) : source.slice(start, nextHandler);
}

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map((marker) => source.indexOf(marker)).find((index) => index >= 0);
  assert.notEqual(start, -1, `missing function ${name}`);
  let signatureDepth = 0;
  let signatureEnded = false;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') signatureDepth += 1;
    if (ch === ')') {
      signatureDepth -= 1;
      if (signatureDepth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
      bodyStart = i;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

test('mail polling handlers and cleanup handlers are not wrapped by operation delay', () => {
  const protectedFunctions = {
    'content/mail-163.js': ['handlePollEmail', 'returnToInbox', 'openMailAndGetMessageText', 'deleteEmail', 'refreshInbox'],
    'content/qq-mail.js': ['handlePollEmail', 'refreshInbox'],
    'content/icloud-mail.js': ['openMailItemAndRead', 'refreshInbox', 'handlePollEmail'],
    'content/mail-2925.js': ['handlePollEmail', 'openMailAndGetMessageText', 'deleteCurrentMailboxEmail', 'openMailAndDeleteAfterRead', 'deleteAllMailboxEmails', 'refreshInbox'],
    'content/gmail-mail.js': ['refreshInbox', 'openRowAndGetMessageText', 'handlePollEmail'],
    'content/inbucket-mail.js': ['refreshMailbox', 'openMailboxEntry', 'deleteCurrentMailboxMessage', 'handlePollEmail'],
  };

  for (const [file, functionNames] of Object.entries(protectedFunctions)) {
    const source = fs.readFileSync(file, 'utf8');
    const pollHandler = extractPollEmailHandler(source);
    assert.doesNotMatch(pollHandler, /performOperationWithDelay\(/, `${file} POLL_EMAIL handler must stay delay-free`);

    for (const functionName of functionNames) {
      const functionBody = extractFunction(source, functionName);
      assert.doesNotMatch(functionBody, /performOperationWithDelay\(/, `${file} ${functionName} must stay delay-free`);
    }
  }

  const mail2925Source = fs.readFileSync('content/mail-2925.js', 'utf8');
  const deleteAllStart = mail2925Source.indexOf("message.type === 'DELETE_ALL_EMAILS'");
  assert.notEqual(deleteAllStart, -1, 'missing DELETE_ALL_EMAILS handler');
  const deleteAllBlock = mail2925Source.slice(deleteAllStart, mail2925Source.indexOf('return false;', deleteAllStart));
  assert.doesNotMatch(deleteAllBlock, /performOperationWithDelay\(/, '2925 cleanup must stay delay-free');
});

test('mail polling bundles do not load operation delay module', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  for (const file of ['content/mail-163.js', 'content/qq-mail.js', 'content/icloud-mail.js']) {
    const bundle = manifest.content_scripts.find((entry) => entry.js.includes(file))?.js || [];
    assert.equal(bundle.includes('content/operation-delay.js'), false, `${file} bundle must not include operation delay`);
  }
});

test('WhatsApp code reader remains polling-only and delay-free', () => {
  const source = fs.readFileSync('content/whatsapp-flow.js', 'utf8');
  assert.doesNotMatch(source, /performOperationWithDelay\(/);
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `node --test tests/provider-operation-delay.test.js tests/mail-polling-operation-delay-exclusion.test.js`

Expected: FAIL in `tests/provider-operation-delay.test.js` because non-polling provider UI operations are not routed through the gate yet. Polling-exclusion assertions must pass or fail only if a prior task accidentally added delay to polling paths.

- [ ] **Step 3: Write the minimal implementation**

In `content/duck-mail.js`, wrap only the generator button click as one covered operation:

```js
await window.CodexOperationDelay.performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'click', label: 'duck-generate-address' }, async () => {
  if (typeof simulateClick === 'function') {
    simulateClick(generatorButton);
  } else {
    generatorButton.click();
  }
});
```

In `content/mail-2925.js`, wrap page DOM writes/clicks that run under `ENSURE_MAIL2925_SESSION`. Do not wrap `DELETE_ALL_EMAILS`, `POLL_EMAIL`, or shared helpers when the same helper is called from those handlers.

Do not modify `POLL_EMAIL` handlers, `DELETE_ALL_EMAILS`, or their refresh/navigation/open/delete polling and cleanup loops in `content/mail-163.js`, `content/qq-mail.js`, `content/icloud-mail.js`, `content/mail-2925.js`, `content/gmail-mail.js`, or `content/inbucket-mail.js`.

- [ ] **Step 4: Run the targeted tests and verify they pass**

Run: `node --test tests/provider-operation-delay.test.js tests/mail-polling-operation-delay-exclusion.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/duck-mail.js content/mail-2925.js tests/provider-operation-delay.test.js tests/mail-polling-operation-delay-exclusion.test.js
git commit -m "feat: delay provider UI operations without slowing polling"
```

## TASK_GROUP 4: Exclusion checks, docs, and final regression

### Task 7: Lock excluded flows, update docs, and run full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/使用教程/使用教程.md`
- Test: `tests/background-operation-delay-exclusions.test.js`
- Test: `tests/operation-delay-docs.test.js`
- Test: all existing `tests/*.test.js`

- [ ] **Step 1: Write the failing tests**

Add `tests/background-operation-delay-exclusions.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('confirm-oauth and platform-verify stay free of operation delay gate calls', () => {
  for (const file of [
    'background/steps/confirm-oauth.js',
    'background/steps/platform-verify.js',
    'background/panel-bridge.js',
    'content/sub2api-panel.js',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /performOperationWithDelay\(/, `${file} must not call the operation delay gate`);
    assert.doesNotMatch(source, /content\/operation-delay\.js/, `${file} must not inject operation delay`);
  }
});

test('operation delay gate names exactly the two excluded step keys', () => {
  const source = fs.readFileSync('content/operation-delay.js', 'utf8');
  assert.match(source, /confirm-oauth/);
  assert.match(source, /platform-verify/);
});
```

Add `tests/operation-delay-docs.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

for (const file of ['README.md', 'docs/使用教程/使用教程.md']) {
  test(`${file} documents operation delay`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /操作间延迟/);
    assert.match(source, /默认开启/);
    assert.match(source, /2\s*秒/);
    assert.match(source, /分格|OTP|验证码/);
    assert.match(source, /邮箱|短信|轮询/);
    assert.match(source, /confirm-oauth|platform-verify/);
  });
}
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `node --test tests/background-operation-delay-exclusions.test.js tests/operation-delay-docs.test.js`

Expected: FAIL because docs do not mention the feature yet and the exclusion test file does not exist before this task.

- [ ] **Step 3: Write the minimal implementation**

Keep excluded flow code delay-free. Add a concise docs section to both `README.md` and `docs/使用教程/使用教程.md`:

```md
### 操作间延迟

`操作间延迟` 默认开启。开启后，自动流程和手动单步在每个页面输入、选择、点击、提交、继续或授权操作完成后固定等待 2 秒；第一项页面操作不会提前等待。分格 OTP/验证码会先整组填完，然后只等待一次。

该开关不同于步间间隔，不影响邮箱轮询、短信/WhatsApp 轮询、后台 API、网络重试、后台定时器或存储持久化，也不影响 `confirm-oauth` 和 `platform-verify` 的交互节奏。
```

- [ ] **Step 4: Run targeted and full verification**

Run: `node --test tests/background-operation-delay-exclusions.test.js tests/operation-delay-docs.test.js`

Expected: PASS.

Run: `npm test`

Expected: PASS for the full `node --test tests/*.test.js` suite.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/使用教程/使用教程.md tests/background-operation-delay-exclusions.test.js tests/operation-delay-docs.test.js
git commit -m "docs: document operation delay behavior"
```
