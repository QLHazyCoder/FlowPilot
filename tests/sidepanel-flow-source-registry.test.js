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
    'id="btn-open-target-repository"',
    'id="row-step6-cookie-settings"',
    'id="row-shared-auto-run"',
    'id="row-auto-run-thread-interval"',
    'id="row-oauth-callback"',
    'id="row-kiro-rs-url"',
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
  assert.match(
    sidepanelHtml,
    /id="btn-open-target-repository"[^>]*class="btn btn-outline btn-sm data-inline-btn"[^>]*>GitHub<\/button>/
  );
  const repositoryButtonTag = sidepanelHtml.match(/<button[^>]*id="btn-open-target-repository"[\s\S]*?<\/button>/)?.[0] || '';
  assert.doesNotMatch(repositoryButtonTag, /<svg/);
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

test('sidepanel project repository button resolves the configured target repositories', () => {
  assert.match(sidepanelSource, /cpa:\s*'https:\/\/github\.com\/router-for-me\/CLIProxyAPI'/);
  assert.match(sidepanelSource, /sub2api:\s*'https:\/\/github\.com\/Wei-Shaw\/sub2api'/);
  assert.match(sidepanelSource, /'kiro-rs':\s*'https:\/\/github\.com\/QLHazyCoder\/kiro\.rs'/);
  assert.match(sidepanelSource, /webchat2api:\s*'https:\/\/github\.com\/zqbxdev\/webchat2api'/);
  assert.doesNotMatch(sidepanelSource, /github\.com\/hank9999\/kiro\.rs/);
  assert.match(sidepanelSource, /btnOpenTargetRepository\?\.addEventListener\('click'/);
});

test('sidepanel target repository helper switches URLs by current flow target', () => {
  const bundle = [
    extractFunction(sidepanelSource, 'getTargetRepositoryUrl'),
  ].join('\n');

  const api = new Function(`
const TARGET_REPOSITORY_URLS = Object.freeze({
  openai: Object.freeze({
    cpa: 'https://github.com/router-for-me/CLIProxyAPI',
    sub2api: 'https://github.com/Wei-Shaw/sub2api',
  }),
  kiro: Object.freeze({
    'kiro-rs': 'https://github.com/QLHazyCoder/kiro.rs',
  }),
  grok: Object.freeze({
    webchat2api: 'https://github.com/zqbxdev/webchat2api',
  }),
});
function normalizeFlowId(value) {
  return ['openai', 'kiro', 'grok'].includes(value) ? value : 'openai';
}
function getDefaultTargetIdForFlow(flowId) {
  return flowId === 'grok' ? 'webchat2api' : (flowId === 'kiro' ? 'kiro-rs' : 'cpa');
}
function normalizeTargetIdForFlow(flowId, targetId, fallback) {
  const targets = {
    openai: ['cpa', 'sub2api', 'codex2api'],
    kiro: ['kiro-rs'],
    grok: ['webchat2api'],
  }[flowId] || [];
  return targets.includes(targetId) ? targetId : fallback;
}
function getSelectedFlowId() { return 'openai'; }
function getSelectedTargetId() { return 'cpa'; }
${bundle}
return { getTargetRepositoryUrl };
`)();

  assert.equal(api.getTargetRepositoryUrl('openai', 'cpa'), 'https://github.com/router-for-me/CLIProxyAPI');
  assert.equal(api.getTargetRepositoryUrl('openai', 'sub2api'), 'https://github.com/Wei-Shaw/sub2api');
  assert.equal(api.getTargetRepositoryUrl('grok', 'webchat2api'), 'https://github.com/zqbxdev/webchat2api');
  assert.equal(api.getTargetRepositoryUrl('openai', 'codex2api'), '');
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
function applyOpenAiReauthRowVisibility(activeFlowId) {
  calls.push({ type: 'reauth-visibility', flowId: activeFlowId });
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
    ['render-flow', 'render-target', 'groups', 'plus', 'phone', 'reauth-visibility']
  );
  assert.equal(api.selectFlow.value, 'openai');
  assert.equal(api.selectPanelMode.value, 'cpa');
});
