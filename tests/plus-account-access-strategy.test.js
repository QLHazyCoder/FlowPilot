const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sidepanelSource = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
const backgroundSource = fs.readFileSync('background.js', 'utf8');

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
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
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

function buildHarness(capabilityStateSource, stateSource) {
  return new Function(`
const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
${extractFunction('normalizePlusAccountAccessStrategy')}
${extractFunction('getRequestedPlusAccountAccessStrategy')}
${extractFunction('updatePlusModeUI')}
function normalizePlusPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'gopay' || normalized === 'gpc-helper' ? normalized : 'paypal';
}
function getSelectedPlusPaymentMethod() {
  return normalizePlusPaymentMethod(selectPlusPaymentMethod.value || latestState?.plusPaymentMethod || currentPlusPaymentMethod || 'paypal');
}
function normalizeGpcHelperPhoneModeValue(value = '') {
  return String(value || '').trim().toLowerCase() === 'auto' ? 'auto' : 'manual';
}
function normalizeGpcOtpChannelValue(value = '') {
  return String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
}
function isGpcAutoModePermissionDenied() {
  return false;
}
function getSelectedPanelMode() {
  return latestState?.panelMode || 'cpa';
}
function resolveCurrentSidepanelCapabilities() {
  return ${capabilityStateSource};
}
let latestState = ${stateSource};
let currentPlusPaymentMethod = 'paypal';
let currentPlusAccountAccessStrategy = latestState.plusAccountAccessStrategy || 'oauth';
const inputPlusModeEnabled = { checked: true };
const rowPlusMode = { style: { display: '' } };
const rowPlusPaymentMethod = { style: { display: 'none' } };
const rowPlusAccountAccessStrategy = { style: { display: 'none' } };
const rowPayPalAccount = { style: { display: 'none' } };
const selectPlusPaymentMethod = { value: latestState.plusPaymentMethod || 'paypal', style: { display: 'none' } };
const selectPlusAccountAccessStrategy = {
  value: latestState.plusAccountAccessStrategy || 'oauth',
  disabled: false,
  dataset: { requestedValue: latestState.plusAccountAccessStrategy || 'oauth' },
  setAttribute(name, value) {
    this[name] = value;
  },
};
const plusPaymentMethodCaption = { textContent: '' };
const plusAccountAccessStrategyCaption = { textContent: '' };
return {
  getRequestedPlusAccountAccessStrategy,
  plusAccountAccessStrategyCaption,
  rowPlusAccountAccessStrategy,
  selectPlusAccountAccessStrategy,
  updatePlusModeUI,
};
`)();
}

test('sidepanel keeps requested SUB2API session strategy independent from the selected target', () => {
  const api = buildHarness(
    `{
      canShowPlusSettings: true,
      runtimeLocks: { plusModeEnabled: true },
      canEditPlusAccountAccessStrategy: true,
      availablePlusAccountAccessStrategies: ['oauth', 'cpa_codex_session', 'sub2api_codex_session'],
      effectivePlusAccountAccessStrategy: 'sub2api_codex_session',
    }`,
    `{
      activeFlowId: 'openai',
      panelMode: 'cpa',
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'sub2api_codex_session',
    }`
  );

  api.updatePlusModeUI();

  assert.equal(api.rowPlusAccountAccessStrategy.style.display, '');
  assert.equal(api.selectPlusAccountAccessStrategy.disabled, false);
  assert.equal(api.selectPlusAccountAccessStrategy.dataset.requestedValue, 'sub2api_codex_session');
  assert.equal(api.selectPlusAccountAccessStrategy.value, 'sub2api_codex_session');
  assert.equal(api.getRequestedPlusAccountAccessStrategy(), 'sub2api_codex_session');
  assert.match(api.plusAccountAccessStrategyCaption.textContent, /SUB2API/);
});

test('sidepanel enables SUB2API session strategy selection when the current Plus target supports it', () => {
  const api = buildHarness(
    `{
      canShowPlusSettings: true,
      runtimeLocks: { plusModeEnabled: true },
      canEditPlusAccountAccessStrategy: true,
      effectivePlusAccountAccessStrategy: 'sub2api_codex_session',
    }`,
    `{
      activeFlowId: 'openai',
      panelMode: 'sub2api',
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'sub2api_codex_session',
    }`
  );

  api.updatePlusModeUI();

  assert.equal(api.rowPlusAccountAccessStrategy.style.display, '');
  assert.equal(api.selectPlusAccountAccessStrategy.disabled, false);
  assert.equal(api.selectPlusAccountAccessStrategy.value, 'sub2api_codex_session');
  assert.equal(api.getRequestedPlusAccountAccessStrategy(), 'sub2api_codex_session');
  assert.match(api.plusAccountAccessStrategyCaption.textContent, /SUB2API/);
});

test('sidepanel enables CPA session strategy selection when the current Plus target supports it', () => {
  const api = buildHarness(
    `{
      canShowPlusSettings: true,
      runtimeLocks: { plusModeEnabled: true },
      canEditPlusAccountAccessStrategy: true,
      availablePlusAccountAccessStrategies: ['oauth', 'cpa_codex_session'],
      effectivePanelMode: 'cpa',
      effectivePlusAccountAccessStrategy: 'cpa_codex_session',
    }`,
    `{
      activeFlowId: 'openai',
      panelMode: 'cpa',
      plusPaymentMethod: 'paypal',
      plusAccountAccessStrategy: 'cpa_codex_session',
    }`
  );

  api.updatePlusModeUI();

  assert.equal(api.rowPlusAccountAccessStrategy.style.display, '');
  assert.equal(api.selectPlusAccountAccessStrategy.disabled, false);
  assert.equal(api.selectPlusAccountAccessStrategy.value, 'cpa_codex_session');
  assert.equal(api.getRequestedPlusAccountAccessStrategy(), 'cpa_codex_session');
  assert.match(api.plusAccountAccessStrategyCaption.textContent, /CPA/);
});

test('sidepanel rebuilds step definitions and workflow nodes with the effective Plus account strategy', () => {
  const bundle = [
    extractFunction('normalizeSignupMethod'),
    extractFunction('normalizePlusPaymentMethod'),
    extractFunction('normalizePlusAccountAccessStrategy'),
    extractFunction('getStepDefinitionsForMode'),
    extractFunction('getWorkflowNodesForMode'),
    extractFunction('rebuildStepDefinitionState'),
    extractFunction('syncStepDefinitionsForMode'),
  ].join('\n');

  const api = new Function(`
const calls = [];
const window = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      calls.push({ type: 'getSteps', options });
      return [{ id: 10, order: 100, key: 'sub2api-session-import', title: 'session-import' }];
    },
    getNodes(options) {
      calls.push({ type: 'getNodes', options });
      return [{ nodeId: 'sub2api-session-import', displayOrder: 10, next: [] }];
    },
  },
};
let latestState = { activeFlowId: 'openai' };
let currentPlusModeEnabled = false;
let currentPlusPaymentMethod = 'paypal';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
let currentPlusAccountAccessStrategy = 'oauth';
let currentSignupMethod = 'email';
let currentPhoneSignupReloginAfterBindEmailEnabled = false;
let currentStepDefinitionFlowId = 'openai';
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_PLUS_PAYMENT_METHOD = 'paypal';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = 'oauth';
const DEFAULT_SIGNUP_METHOD = 'email';
let stepDefinitions = [];
let workflowNodes = [];
let STEP_IDS = [];
let STEP_DEFAULT_STATUSES = {};
let SKIPPABLE_STEPS = new Set();
let NODE_IDS = [];
let NODE_DEFAULT_STATUSES = {};
function getSelectedPlusPaymentMethod() {
  return currentPlusPaymentMethod;
}
function renderStepsList() {}
${bundle}
return {
  calls,
  syncStepDefinitionsForMode,
  snapshot() {
    return {
      currentPlusAccountAccessStrategy,
      workflowNodes,
      stepDefinitions,
      STEP_IDS,
      NODE_IDS,
    };
  },
};
`)();

  api.syncStepDefinitionsForMode(true, {
    activeFlowId: 'openai',
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'sub2api_codex_session',
    signupMethod: 'email',
    render: true,
  });

  const snapshot = api.snapshot();
  assert.equal(snapshot.currentPlusAccountAccessStrategy, 'sub2api_codex_session');
  assert.deepStrictEqual(snapshot.STEP_IDS, [10]);
  assert.deepStrictEqual(snapshot.NODE_IDS, ['sub2api-session-import']);
  assert.equal(snapshot.stepDefinitions[0]?.key, 'sub2api-session-import');
  assert.equal(snapshot.workflowNodes[0]?.nodeId, 'sub2api-session-import');
  assert.deepStrictEqual(api.calls, [
    {
      type: 'getSteps',
      options: {
        activeFlowId: 'openai',
        plusModeEnabled: true,
        plusPaymentMethod: 'paypal',
        plusAccountAccessStrategy: 'sub2api_codex_session',
        signupMethod: 'email',
        phoneSignupReloginAfterBindEmailEnabled: false,
        accountContributionEnabled: false,
      },
    },
    {
      type: 'getNodes',
      options: {
        activeFlowId: 'openai',
        plusModeEnabled: true,
        plusPaymentMethod: 'paypal',
        plusAccountAccessStrategy: 'sub2api_codex_session',
        signupMethod: 'email',
        phoneSignupReloginAfterBindEmailEnabled: false,
        accountContributionEnabled: false,
      },
    },
  ]);
});

test('background declares Plus account access strategy constants before precomputing session-tail step definitions', () => {
  const strategyConstantIndex = backgroundSource.indexOf("const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';");
  const cpaStrategyConstantIndex = backgroundSource.indexOf("const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';");
  const precomputedSessionStepsIndex = backgroundSource.indexOf('const PLUS_PAYPAL_SUB2API_SESSION_STEP_DEFINITIONS =');
  const precomputedCpaSessionStepsIndex = backgroundSource.indexOf('const PLUS_PAYPAL_CPA_SESSION_STEP_DEFINITIONS =');

  assert.ok(strategyConstantIndex >= 0, 'expected Plus account access strategy constant declaration');
  assert.ok(cpaStrategyConstantIndex >= 0, 'expected CPA Plus account access strategy constant declaration');
  assert.ok(precomputedSessionStepsIndex >= 0, 'expected precomputed SUB2API session step definitions');
  assert.ok(precomputedCpaSessionStepsIndex >= 0, 'expected precomputed CPA session step definitions');
  assert.ok(
    strategyConstantIndex < precomputedSessionStepsIndex,
    'strategy constant must be declared before background precomputes session-tail step definitions'
  );
  assert.ok(
    cpaStrategyConstantIndex < precomputedCpaSessionStepsIndex,
    'CPA strategy constant must be declared before background precomputes CPA session-tail step definitions'
  );
});
