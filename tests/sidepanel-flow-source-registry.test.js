const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
const sidepanelHtml = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

function extractFunction(source, name) {
  const asyncStart = source.indexOf(`async function ${name}`);
  const normalStart = source.indexOf(`function ${name}`);
  const start = asyncStart !== -1
    ? asyncStart
    : normalStart;
  if (start === -1) {
    throw new Error(`Function ${name} not found`);
  }
  const signatureEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', signatureEnd);
  let depth = 0;
  let end = bodyStart;
  for (; end < source.length; end += 1) {
    const char = source[end];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return source.slice(start, end);
}

test('sidepanel html exposes flow selector and kiro source fields', () => {
  [
    'id="select-flow"',
    '<option value="grok">Grok</option>',
    'id="label-source-selector"',
    'id="btn-open-webchat2api-github"',
    'id="row-step6-cookie-settings"',
    'id="row-shared-auto-run"',
    'id="row-auto-run-thread-interval"',
    'id="row-oauth-callback"',
    'id="row-settings-actions"',
    'id="row-kiro-rs-url"',
    'id="btn-open-kiro-rs-github"',
    'id="row-kiro-rs-key"',
    'id="btn-test-kiro-rs"',
    'id="row-kiro-rs-test-status"',
    'id="row-kiro-web-status"',
    'id="row-kiro-login-url"',
    'id="row-kiro-upload-status"',
    'id="row-grok-register-status"',
    'id="row-grok-sso-status"',
    'id="row-grok-webchat2api-upload-status"',
    'id="display-grok-webchat2api-upload-status"',
    'id="row-grok-sso-settings"',
    'id="btn-copy-grok-sso"',
    'id="btn-clear-grok-sso"',
    '<script src="../flows/grok/index.js"></script>',
    '<script src="../flows/grok/workflow.js"></script>',
  ].forEach((snippet) => {
    assert.match(sidepanelHtml, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
  assert.doesNotMatch(sidepanelHtml, /id="btn-export-grok-sso"/);
  assert.ok(
    sidepanelHtml.indexOf('<script src="../flows/kiro/workflow.js"></script>')
      < sidepanelHtml.indexOf('<script src="../flows/grok/index.js"></script>')
  );
  assert.ok(
    sidepanelHtml.indexOf('<script src="../flows/grok/workflow.js"></script>')
      < sidepanelHtml.indexOf('<script src="../flows/index.js"></script>')
  );
});

test('sidepanel Grok SSO clear action goes through background message instead of direct storage writes', () => {
  const clearButtonIndex = sidepanelSource.indexOf("btnClearGrokSso?.addEventListener('click'");
  assert.notEqual(clearButtonIndex, -1);
  const nextManagerIndex = sidepanelSource.indexOf('const hotmailManager', clearButtonIndex);
  assert.notEqual(nextManagerIndex, -1);
  const block = sidepanelSource.slice(clearButtonIndex, nextManagerIndex);

  assert.match(block, /type:\s*'CLEAR_GROK_SSO_COOKIES'/);
  assert.match(block, /chrome\.runtime\.sendMessage/);
  assert.doesNotMatch(block, /chrome\.storage/);
  assert.doesNotMatch(block, /storage\.local\.set/);
});

test('sidepanel renders Grok SSO status from canonical runtime state', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'getGrokRuntimeState'),
    extractFunction(sidepanelSource, 'normalizeGrokSsoCookies'),
    extractFunction(sidepanelSource, 'getGrokRegisterStatusLabel'),
    extractFunction(sidepanelSource, 'getGrokWebchat2ApiUploadStatusLabel'),
    extractFunction(sidepanelSource, 'renderGrokRuntimeState'),
  ].join('\n');

  const api = new Function(`
let latestState = {};
const displayGrokRegisterStatus = { textContent: '' };
const displayGrokSsoStatus = { textContent: '' };
const displayGrokSsoCookie = { textContent: '', title: '' };
const displayGrokWebchat2ApiUploadStatus = { textContent: '', title: '' };
const buttons = [];
const btnCopyGrokSso = { disabled: false };
const btnClearGrokSso = { disabled: false };
${bundle}
return {
  displayGrokRegisterStatus,
  displayGrokSsoStatus,
  displayGrokSsoCookie,
  displayGrokWebchat2ApiUploadStatus,
  btnCopyGrokSso,
  btnClearGrokSso,
  renderGrokRuntimeState,
};
`)();

  api.renderGrokRuntimeState({
    runtimeState: {
      flowState: {
        grok: {
          register: { status: 'completed' },
          sso: {
            currentCookie: '1234567890abcdef',
            cookies: ['1234567890abcdef', 'second-cookie'],
            extractedAt: 0,
          },
          upload: {
            status: 'uploaded',
            uploadedAt: 0,
            message: '上传成功',
            targetUrl: 'https://remote.example.com/api/remote-account/inject',
          },
        },
      },
    },
  });

  assert.equal(api.displayGrokRegisterStatus.textContent, '已完成');
  assert.match(api.displayGrokSsoStatus.textContent, /^已提取 2 条/);
  assert.equal(api.displayGrokSsoCookie.textContent, '12345678...abcdef');
  assert.equal(api.displayGrokWebchat2ApiUploadStatus.textContent, '已上传：上传成功');
  assert.equal(api.displayGrokWebchat2ApiUploadStatus.title, 'https://remote.example.com/api/remote-account/inject');
  assert.equal(api.btnCopyGrokSso.disabled, false);
  assert.equal(api.btnClearGrokSso.disabled, false);
});

test('sidepanel Kiro GitHub button opens the configured fork', () => {
  assert.match(sidepanelSource, /openExternalUrl\('https:\/\/github\.com\/QLHazyCoder\/kiro\.rs'\)/);
  assert.doesNotMatch(sidepanelSource, /github\.com\/hank9999\/kiro\.rs/);
});

test('sidepanel webchat2api GitHub button opens the configured repository', () => {
  assert.match(sidepanelSource, /openExternalUrl\('https:\/\/github\.com\/zqbxdev\/webchat2api'\)/);
});

test('sidepanel step definitions rerender when active flow changes even if plus/signup settings stay the same', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'normalizeSignupMethod'),
    extractFunction(sidepanelSource, 'normalizePlusPaymentMethod'),
    extractFunction(sidepanelSource, 'getStepDefinitionsForMode'),
    extractFunction(sidepanelSource, 'rebuildStepDefinitionState'),
    extractFunction(sidepanelSource, 'syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return [{ id: options.activeFlowId === 'kiro' ? 88 : 6, order: 1, key: options.activeFlowId }];
    },
  },
};
let latestState = { activeFlowId: 'openai' };
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = 'oauth';
let currentSignupMethod = 'email';
let currentPhoneVerificationEnabled = false;
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
let currentStepDefinitionFlowId = 'openai';
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SIGNUP_METHOD = 'email';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
let stepDefinitions = [{ id: 6, key: 'openai' }];
let STEP_IDS = [6];
let STEP_DEFAULT_STATUSES = { 6: 'pending' };
let SKIPPABLE_STEPS = new Set([6]);
function renderStepsList() {
  calls.push({ type: 'render', stepIds: [...STEP_IDS] });
}
function normalizePlusAccountAccessStrategy(value = '') {
  return String(value || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY).trim().toLowerCase() || DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY;
}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  getStepIds: () => [...STEP_IDS],
  getCurrentFlowId: () => currentStepDefinitionFlowId,
};
`)();

  api.syncStepDefinitionsForMode(false, {
    activeFlowId: 'kiro',
    plusPaymentMethod: 'paypal',
    signupMethod: 'email',
    phoneSignupReloginAfterBindEmailEnabled: false,
  });

  assert.equal(api.getCurrentFlowId(), 'kiro');
  assert.deepEqual(api.getStepIds(), [88]);
  assert.deepEqual(api.calls[0], {
    type: 'getSteps',
    options: {
      activeFlowId: 'kiro',
      plusModeEnabled: false,
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'oauth',
      signupMethod: 'email',
      phoneVerificationEnabled: false,
      phoneSignupReloginAfterBindEmailEnabled: false,
      accountContributionEnabled: false,
    },
  });
  assert.deepEqual(api.calls[1], { type: 'render', stepIds: [88] });
});

test('syncLatestState keeps activeFlowId and flowId in sync when only one side changes', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'syncLatestState'),
  ].join('\n');

  const api = new Function(`
let latestState = {
  activeFlowId: 'openai',
  flowId: 'openai',
  nodeStatuses: { 'open-chatgpt': 'completed' },
};
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const NODE_DEFAULT_STATUSES = { 'open-chatgpt': 'pending' };
const calls = [];
function normalizeFlowId(value = '', fallback = DEFAULT_ACTIVE_FLOW_ID) {
  return String(value || fallback || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
}
function getStoredNodeStatuses(state = {}) {
  return { ...NODE_DEFAULT_STATUSES, ...(state?.nodeStatuses || {}) };
}
function renderAccountRecords(state) {
  calls.push({ ...state });
}
${bundle}
return {
  syncLatestState,
  getLatestState() {
    return latestState;
  },
  getCalls() {
    return calls;
  },
};
`)();

  api.syncLatestState({ flowId: 'kiro' });

  assert.deepStrictEqual(api.getLatestState(), {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    nodeStatuses: { 'open-chatgpt': 'completed' },
    targetId: 'kiro-rs',
  });
  assert.equal(api.getCalls()[0].activeFlowId, 'kiro');
  assert.equal(api.getCalls()[0].flowId, 'kiro');
  assert.equal(api.getCalls()[0].targetId, 'kiro-rs');
});

test('updatePanelModeUI reapplies dynamic Plus and phone visibility after flow group visibility', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'updatePanelModeUI'),
  ].join('\n');

  const api = new Function(`
const calls = [];
let latestState = {
  activeFlowId: 'openai',
  flowId: 'openai',
  targetId: 'cpa',
};
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const selectFlow = { value: '' };
const selectPanelMode = { value: '' };
function normalizeFlowId(value = '', fallback = DEFAULT_ACTIVE_FLOW_ID) {
  return String(value || fallback || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
}
function normalizePanelMode(value = '', fallback = 'cpa') {
  return String(value || fallback || 'cpa').trim().toLowerCase() || 'cpa';
}
function getSelectedFlowId() {
  return latestState.activeFlowId;
}
function getSelectedTargetId() {
  return 'cpa';
}
function renderFlowSelectorOptions(flowId) {
  calls.push({ type: 'render-flow', flowId });
}
function renderTargetSelectorOptions(flowId, targetId) {
  calls.push({ type: 'render-target', flowId, targetId });
}
function applyFlowSettingsGroupVisibility(visibleGroupIds) {
  calls.push({ type: 'groups', visibleGroupIds: [...visibleGroupIds] });
}
function updatePlusModeUI() {
  calls.push({ type: 'plus' });
}
function updatePhoneVerificationSettingsUI() {
  calls.push({ type: 'phone' });
}
function resolveCurrentSidepanelCapabilities() {
  return {
    visibleGroupIds: ['service-account', 'openai-plus', 'openai-phone'],
    effectiveTargetId: 'cpa',
  };
}
const document = {
  querySelector() {
    return null;
  },
};
${bundle}
return {
  calls,
  updatePanelModeUI,
  selectFlow,
  selectPanelMode,
};
`)();

  api.updatePanelModeUI();

  assert.deepEqual(
    api.calls.map((entry) => entry.type),
    ['render-flow', 'render-target', 'groups', 'plus', 'phone']
  );
  assert.equal(api.selectFlow.value, 'openai');
  assert.equal(api.selectPanelMode.value, 'cpa');
});
