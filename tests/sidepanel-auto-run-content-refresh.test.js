const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => sidepanelSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < sidepanelSource.length; i += 1) {
    const ch = sidepanelSource[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < sidepanelSource.length; end += 1) {
    const ch = sidepanelSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return sidepanelSource.slice(start, end);
}

function createApi({
  refreshImpl,
  runCount = 3,
  persistImpl,
} = {}) {
  const bundle = [
    extractFunction('normalizePendingAutoRunStartRunCount'),
    extractFunction('registerPendingAutoRunStartRunCount'),
    extractFunction('clearPendingAutoRunStartRunCount'),
    extractFunction('startAutoRunFromCurrentSettings'),
  ].join('\n');

return new Function(`
const events = [];
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const latestState = {
  accountContributionEnabled: false,
  activeFlowId: 'openai',
  flowId: 'openai',
  targetId: 'cpa',
};
const inputAutoSkipFailures = { checked: false };
const inputContributionNickname = { value: 'tester' };
const inputContributionQq = { value: '123456' };
const inputAutoSkipFailuresThreadIntervalMinutes = { value: '5' };
const btnAutoRun = { disabled: false, innerHTML: '' };
const inputRunCount = { disabled: false };
const selectFlow = { value: latestState.activeFlowId };
const selectPanelMode = { value: latestState.targetId };
let runCountValue = ${Math.max(1, Number(runCount) || 1)};
let pendingAutoRunStartTotalRuns = 0;
let pendingAutoRunStartExpiresAt = 0;
const chrome = {
  runtime: {
    async sendMessage(message) {
      events.push({ type: 'send', message });
      return { ok: true };
    },
  },
};
const console = {
  warn(...args) {
    events.push({ type: 'warn', args });
  },
};
async function sendSidepanelMessage(message) {
  return chrome.runtime.sendMessage(message);
}
async function persistCurrentSettingsForAction() {
  events.push({ type: 'sync-settings' });
  ${persistImpl ? `return (${persistImpl})(events, {
    setRunCount(value) {
      runCountValue = Math.max(1, Number(value) || 1);
    },
    getRunCount() {
      return runCountValue;
    },
  });` : ''}
}
function getRunCountValue() { return Math.max(1, Number(runCountValue) || 1); }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function normalizePanelMode(value = '', fallback = 'cpa') {
  return String(value || fallback || 'cpa').trim().toLowerCase() || 'cpa';
}
function getSelectedFlowId(state = latestState) {
  return String(selectFlow.value || state.activeFlowId || state.flowId || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
}
function getSelectedTargetId(flowId = getSelectedFlowId()) {
  return String(
    flowId === 'kiro'
      ? (selectPanelMode.value || latestState.targetId || 'kiro-rs')
      : normalizePanelMode(selectPanelMode.value || latestState.targetId || 'cpa')
  ).trim().toLowerCase() || (flowId === 'kiro' ? 'kiro-rs' : 'cpa');
}
function shouldOfferAutoModeChoice() { return false; }
async function openAutoStartChoiceDialog() { throw new Error('should not be called'); }
function getFirstUnfinishedStep() { return 1; }
function getRunningSteps() { return []; }
function shouldWarnAutoRunFallbackRisk() { return false; }
function isAutoRunFallbackRiskPromptDismissed() { return false; }
async function openAutoRunFallbackRiskConfirmModal() { throw new Error('should not be called'); }
function setAutoRunFallbackRiskPromptDismissed() {}
async function refreshContributionContentHint() {
  events.push({ type: 'refresh' });
  ${refreshImpl ? 'return (' + refreshImpl + ')();' : 'return null;'}
}
async function ensureGpcApiKeyReadyForStart() {
  return true;
}
${bundle}
return {
  startAutoRunFromCurrentSettings,
  getEvents() {
    return events;
  },
};
`)();
}

test('startAutoRunFromCurrentSettings kicks off contribution content refresh without blocking auto run', async () => {
  const api = createApi();

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, true);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'send']
  );
  assert.equal(api.getEvents()[2].message.type, 'AUTO_RUN');
});

test('startAutoRunFromCurrentSettings continues auto run when contribution content refresh fails', async () => {
  const api = createApi({
    refreshImpl: 'async () => { throw new Error("refresh failed"); }',
  });

  const result = await api.startAutoRunFromCurrentSettings();
  const events = api.getEvents();

  assert.equal(result, true);
  assert.deepEqual(
    events.map((entry) => entry.type),
    ['refresh', 'sync-settings', 'send', 'warn']
  );
  assert.equal(events[2].message.type, 'AUTO_RUN');
  assert.match(String(events[3].args[0]), /Failed to refresh contribution content hint before auto run/);
});

test('startAutoRunFromCurrentSettings does not wait for a hanging contribution content refresh', async () => {
  const api = createApi({
    refreshImpl: '() => new Promise(() => {})',
  });

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, true);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'send']
  );
});

test('startAutoRunFromCurrentSettings does not block auto run when contribution content has updates', async () => {
  const api = createApi({
    refreshImpl: `async () => ({
      promptVersion: 'questionnaire:2026-04-23T00:00:00Z',
      items: [{ slug: 'questionnaire', isVisible: true }],
    })`,
  });

  const result = await api.startAutoRunFromCurrentSettings();

  assert.equal(result, true);
  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings', 'send']
  );
});

test('startAutoRunFromCurrentSettings freezes run count before async settings sync can repaint it', async () => {
  const api = createApi({
    runCount: 20,
    persistImpl: `(events, controls) => {
      controls.setRunCount(1);
      events.push({ type: 'stale-status-reset', runCount: controls.getRunCount() });
    }`,
  });

  const result = await api.startAutoRunFromCurrentSettings();
  const events = api.getEvents();

  assert.equal(result, true);
  assert.deepEqual(
    events.map((entry) => entry.type),
    ['refresh', 'sync-settings', 'stale-status-reset', 'send']
  );
  assert.equal(events[3].message.payload.totalRuns, 20);
});

test('startAutoRunFromCurrentSettings sends current flow selection with auto run payload', async () => {
  const api = createApi({
    persistImpl: `(events) => {
      selectFlow.value = 'kiro';
      selectPanelMode.value = 'kiro-rs';
      latestState.activeFlowId = 'openai';
      latestState.flowId = 'openai';
      latestState.targetId = 'kiro-rs';
      events.push({ type: 'flow-switch-race' });
    }`,
  });

  const result = await api.startAutoRunFromCurrentSettings();
  const sendEvent = api.getEvents().find((entry) => entry.type === 'send');

  assert.equal(result, true);
  assert.equal(sendEvent.message.payload.activeFlowId, 'kiro');
  assert.equal(sendEvent.message.payload.targetId, 'kiro-rs');
});

test('startAutoRunFromCurrentSettings blocks when shared flow capability validation fails', async () => {
  const bundle = [
    extractFunction('normalizePendingAutoRunStartRunCount'),
    extractFunction('registerPendingAutoRunStartRunCount'),
    extractFunction('clearPendingAutoRunStartRunCount'),
    extractFunction('startAutoRunFromCurrentSettings'),
  ].join('\n');

  const api = new Function(`
const events = [];
const latestState = {
  activeFlowId: 'site-a',
  targetId: 'cpa',
  signupMethod: 'phone',
  accountContributionEnabled: false,
  phoneVerificationEnabled: true,
};
const inputAutoSkipFailures = { checked: false };
const inputContributionNickname = { value: 'tester' };
const inputContributionQq = { value: '123456' };
const inputAutoSkipFailuresThreadIntervalMinutes = { value: '5' };
const btnAutoRun = { disabled: false, innerHTML: '' };
const inputRunCount = { disabled: false, value: '1' };
const inputPhoneVerificationEnabled = { checked: true };
const inputPlusModeEnabled = { checked: false };
let runCountValue = 1;
let pendingAutoRunStartTotalRuns = 0;
let pendingAutoRunStartExpiresAt = 0;
const chrome = {
  runtime: {
    async sendMessage(message) {
      events.push({ type: 'send', message });
      return { ok: true };
    },
  },
};
const console = {
  warn(...args) {
    events.push({ type: 'warn', args });
  },
};
const window = {
  MultiPageFlowCapabilities: {
    createFlowCapabilityRegistry() {
      return {
        validateAutoRunStart() {
          return {
            ok: false,
            errors: [{ message: '当前 flow 不支持手机号注册。' }],
          };
        },
      };
    },
  },
};
async function sendSidepanelMessage(message) {
  return chrome.runtime.sendMessage(message);
}
async function persistCurrentSettingsForAction() {
  events.push({ type: 'sync-settings' });
}
function getRunCountValue() { return Math.max(1, Number(runCountValue) || 1); }
function normalizeAutoRunThreadIntervalMinutes(value) { return Number(value) || 0; }
function shouldOfferAutoModeChoice() { return false; }
async function openAutoStartChoiceDialog() { throw new Error('should not be called'); }
function getFirstUnfinishedStep() { return 1; }
function getRunningSteps() { return []; }
function shouldWarnAutoRunFallbackRisk() { return false; }
function isAutoRunFallbackRiskPromptDismissed() { return false; }
async function openAutoRunFallbackRiskConfirmModal() { throw new Error('should not be called'); }
function setAutoRunFallbackRiskPromptDismissed() {}
async function refreshContributionContentHint() {
  events.push({ type: 'refresh' });
  return null;
}
async function ensureGpcApiKeyReadyForStart() {
  return true;
}
${bundle}
return {
  startAutoRunFromCurrentSettings,
  getEvents() {
    return events;
  },
};
`)();

  await assert.rejects(
    () => api.startAutoRunFromCurrentSettings(),
    /当前 flow 不支持手机号注册。/
  );

  assert.deepEqual(
    api.getEvents().map((entry) => entry.type),
    ['refresh', 'sync-settings']
  );
});

test('persistCurrentSettingsForAction forces a silent save even when settings are not marked dirty', async () => {
  const bundle = [
    extractFunction('waitForSettingsSaveIdle'),
    extractFunction('saveSettings'),
    extractFunction('persistCurrentSettingsForAction'),
  ].join('\n');

  const api = new Function(`
let settingsAutoSaveTimer = 123;
let clearedTimer = null;
let settingsSaveInFlight = false;
let settingsDirty = false;
let settingsSaveRevision = 0;
let phonePersistCalls = 0;
const saveCalls = [];
function clearTimeout(value) {
  clearedTimer = value;
}
async function persistSignupPhoneInputForAction() {
  phonePersistCalls += 1;
}
function updateSaveButtonState() {}
function collectSettingsPayload() {
  return { luckmailApiKey: 'autofilled-key' };
}
function syncLatestState() {}
function updatePanelModeUI() {}
function updateMailProviderUI() {}
function updateButtonStates() {}
function markSettingsDirty() {}
function applySettingsState() {}
const chrome = {
  runtime: {
    async sendMessage(message) {
      saveCalls.push(message.payload);
      return { state: { luckmailApiKey: message.payload.luckmailApiKey } };
    },
  },
};
${bundle}
return {
  persistCurrentSettingsForAction,
  getSnapshot() {
    return { clearedTimer, phonePersistCalls, saveCalls };
  },
};
`)();

  await api.persistCurrentSettingsForAction();
  const snapshot = api.getSnapshot();

  assert.equal(snapshot.clearedTimer, 123);
  assert.equal(snapshot.phonePersistCalls, 1);
  assert.deepStrictEqual(snapshot.saveCalls, [{ luckmailApiKey: 'autofilled-key' }]);
});
