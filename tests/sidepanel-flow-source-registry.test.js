const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');

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

function assertHtmlContains(snippet) {
  assert.match(sidepanelHtml, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

function getScriptIndex(scriptPath) {
  const scriptTag = `<script src="../${scriptPath}"></script>`;
  const index = sidepanelHtml.indexOf(scriptTag);
  assert.notEqual(index, -1, `${scriptPath} should be loaded by sidepanel.html`);
  return index;
}

test('sidepanel html loads Grok flow scripts before registry consumers', () => {
  const grokDefinitionIndex = getScriptIndex('flows/grok/index.js');
  const grokWorkflowIndex = getScriptIndex('flows/grok/workflow.js');
  const flowsIndexIndex = getScriptIndex('flows/index.js');
  const stepDefinitionsIndex = getScriptIndex('data/step-definitions.js');

  assert.ok(grokDefinitionIndex < flowsIndexIndex);
  assert.ok(grokWorkflowIndex < flowsIndexIndex);
  assert.ok(grokWorkflowIndex < stepDefinitionsIndex);
});

test('sidepanel flow registry bundle exposes Grok as a selectable flow', () => {
  const scope = {};
  const flowRegistry = new Function('self', `${readFlowRegistryBundle()}; return self.MultiPageFlowRegistry;`)(scope);

  assert.ok(flowRegistry.getRegisteredFlowIds().includes('grok'));
  assert.equal(flowRegistry.getFlowLabel('grok'), 'Grok / xAI');
});

test('sidepanel html exposes flow selector and kiro source fields', () => {
  [
    'id="select-flow"',
    'id="label-source-selector"',
    'id="row-step6-cookie-settings"',
    'id="row-kiro-rs-url"',
    'id="btn-open-kiro-rs-github"',
    'id="row-kiro-rs-key"',
    'id="btn-test-kiro-rs"',
    'id="row-kiro-rs-test-status"',
    'id="row-kiro-web-status"',
    'id="row-kiro-login-url"',
    'id="row-kiro-upload-status"',
  ].forEach(assertHtmlContains);
});

test('sidepanel html exposes Grok SSO controls with Kiro button styling', () => {
  [
    'id="row-grok-sso-settings"',
    'id="btn-export-grok-sso"',
    'id="btn-clear-grok-sso"',
    'id="btn-open-grok-sso-github"',
    'class="btn btn-ghost btn-xs data-inline-btn" type="button">GitHub</button>',
  ].forEach(assertHtmlContains);
});

test('sidepanel Kiro GitHub button opens the configured fork', () => {
  assert.match(sidepanelSource, /openExternalUrl\('https:\/\/github\.com\/QLHazyCoder\/kiro\.rs'\)/);
  assert.doesNotMatch(sidepanelSource, /github\.com\/hank9999\/kiro\.rs/);
});

test('sidepanel Grok SSO GitHub button opens webchat2api', () => {
  assert.match(sidepanelSource, /openExternalUrl\('https:\/\/github\.com\/zqbxdev\/webchat2api'\)/);
});

test('sidepanel Grok SSO export uses webchat2api filename', () => {
  assert.match(sidepanelSource, /downloadTextFile\(`\$\{ssoValues\.join\('\\n'\)\}\\n`, 'webchat2api_grok_sso\.txt', 'text\/plain;charset=utf-8'\)/);
  assert.doesNotMatch(sidepanelSource, /downloadTextFile\(`\$\{ssoValues\.join\('\\n'\)\}\\n`, 'xxx\.txt'/);
});

test('sidepanel Grok target selector displays webchat2api source', () => {
  const scope = {};
  const flowRegistry = new Function('self', `${readFlowRegistryBundle()}; return self.MultiPageFlowRegistry;`)(scope);

  assert.deepEqual(flowRegistry.getTargetOptions('grok'), [
    {
      id: 'webchat2api',
      label: 'zqbxdev/webchat2api',
      groups: ['grok-target-webchat2api'],
    },
  ]);
  assert.equal(flowRegistry.getTargetLabel('grok', 'webchat2api'), 'zqbxdev/webchat2api');
});

test('Grok SSO export values dedupe and remove blanks', () => {
  const bundle = extractFunction(sidepanelSource, 'getGrokSsoValuesFromState');
  const api = new Function(`${bundle}; return { getGrokSsoValuesFromState };`)();

  assert.deepEqual(api.getGrokSsoValuesFromState({
    grokSsoCookie: ' primary ',
    grokSsoCookies: ['primary', '', ' secondary ', 'secondary', null],
  }), ['primary', 'secondary']);
});

test('sidepanel clear Grok SSO only writes Grok SSO state keys', () => {
  assert.match(sidepanelSource, /grokSsoCookie:\s*''/);
  assert.match(sidepanelSource, /grokSsoCookies:\s*\[\]/);
  assert.match(sidepanelSource, /chrome\.storage\?\.local\?\.set\?\.\(nextState\)/);
  assert.doesNotMatch(sidepanelSource, /openaiAt|OpenAI AT|openAiAt/);
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
const rowGrokSsoSettings = { style: { display: 'unexpected' } };
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
