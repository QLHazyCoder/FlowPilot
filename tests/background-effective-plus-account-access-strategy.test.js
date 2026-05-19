const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
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

  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

function createHarness() {
  return new Function(`
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const SIGNUP_METHOD_EMAIL = 'email';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const workflowEngine = null;
const self = {
  MultiPageStepDefinitions: {
    getSteps(options = {}) {
      const strategy = String(options.plusAccountAccessStrategy || '').trim();
      if (strategy === 'sub2api_codex_session') {
        return [
          { id: 1, key: 'open-chatgpt' },
          { id: 2, key: 'plus-checkout-create' },
          { id: 3, key: 'plus-checkout-billing' },
          { id: 4, key: 'paypal-approve' },
          { id: 5, key: 'plus-checkout-return' },
          { id: 6, key: 'sub2api-session-import' },
        ];
      }
      return strategy === 'cpa_codex_session'
        ? [
          { id: 1, key: 'open-chatgpt' },
          { id: 2, key: 'plus-checkout-create' },
          { id: 3, key: 'plus-checkout-billing' },
          { id: 4, key: 'paypal-approve' },
          { id: 5, key: 'plus-checkout-return' },
          { id: 6, key: 'cpa-session-import' },
        ]
        : [
          { id: 1, key: 'open-chatgpt' },
          { id: 2, key: 'plus-checkout-create' },
          { id: 3, key: 'plus-checkout-billing' },
          { id: 4, key: 'paypal-approve' },
          { id: 5, key: 'plus-checkout-return' },
          { id: 6, key: 'oauth-login' },
          { id: 7, key: 'fetch-login-code' },
          { id: 8, key: 'confirm-oauth' },
          { id: 9, key: 'platform-verify' },
        ];
    },
    getNodes(options = {}) {
      return this.getSteps(options).map((definition) => ({
        nodeId: String(definition.key || '').trim(),
        displayOrder: Number(definition.id) || 0,
      }));
    },
  },
};
function normalizeSignupMethod(value = '') {
  return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function normalizePlusPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'gopay' || normalized === 'gpc-helper' ? normalized : 'paypal';
}
function normalizePlusAccountAccessStrategy(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sub2api_codex_session') {
    return 'sub2api_codex_session';
  }
  if (normalized === 'cpa_codex_session') {
    return 'cpa_codex_session';
  }
  return 'oauth';
}
function isPlusModeState(state = {}) {
  return Boolean(state?.plusModeEnabled);
}
function resolveCurrentFlowCapabilities(state = {}, options = {}) {
  const requestedStrategy = normalizePlusAccountAccessStrategy(state.plusAccountAccessStrategy);
  const effectiveStrategy = state.accountContributionEnabled && state.plusModeEnabled
    ? 'sub2api_codex_session'
    : requestedStrategy;
  return {
    effectivePanelMode: options.panelMode,
    effectivePlusAccountAccessStrategy: effectiveStrategy,
    effectiveSignupMethod: 'email',
    stepDefinitionOptions: {
      activeFlowId: 'openai',
      panelMode: options.panelMode,
      plusModeEnabled: Boolean(state.plusModeEnabled),
      plusPaymentMethod: normalizePlusPaymentMethod(state.plusPaymentMethod),
      plusAccountAccessStrategy: effectiveStrategy,
      signupMethod: 'email',
    },
  };
}
${extractFunction('getSignupMethodForStepDefinitions')}
${extractFunction('buildResolvedStepDefinitionState')}
${extractFunction('getStepDefinitionsForState')}
${extractFunction('getNodeDefinitionsForState')}
${extractFunction('getNodeIdsForState')}
return {
  buildResolvedStepDefinitionState,
  getNodeIdsForState,
};
`)();
}

test('background step resolution keeps SUB2API session tail independent from the current panel mode', () => {
  const api = createHarness();
  const state = {
    activeFlowId: 'openai',
    flowId: 'openai',
    panelMode: 'cpa',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'sub2api_codex_session',
    signupMethod: 'email',
  };

  const resolvedState = api.buildResolvedStepDefinitionState(state);
  const nodeIds = api.getNodeIdsForState(state);

  assert.equal(resolvedState.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.deepStrictEqual(nodeIds, [
    'open-chatgpt',
    'plus-checkout-create',
    'plus-checkout-billing',
    'paypal-approve',
    'plus-checkout-return',
    'sub2api-session-import',
  ]);
});

test('background step resolution keeps CPA session tail when the effective Plus target supports it', () => {
  const api = createHarness();
  const state = {
    activeFlowId: 'openai',
    flowId: 'openai',
    panelMode: 'cpa',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'cpa_codex_session',
    signupMethod: 'email',
  };

  const resolvedState = api.buildResolvedStepDefinitionState(state);
  const nodeIds = api.getNodeIdsForState(state);

  assert.equal(resolvedState.plusAccountAccessStrategy, 'cpa_codex_session');
  assert.deepStrictEqual(nodeIds, [
    'open-chatgpt',
    'plus-checkout-create',
    'plus-checkout-billing',
    'paypal-approve',
    'plus-checkout-return',
    'cpa-session-import',
  ]);
});

test('background step resolution keeps SUB2API session tail even when the current panel mode is CPA', () => {
  const api = createHarness();
  const state = {
    activeFlowId: 'openai',
    flowId: 'openai',
    panelMode: 'cpa',
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'sub2api_codex_session',
    signupMethod: 'email',
  };

  const resolvedState = api.buildResolvedStepDefinitionState(state);
  const nodeIds = api.getNodeIdsForState(state);

  assert.equal(resolvedState.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.deepStrictEqual(nodeIds, [
    'open-chatgpt',
    'plus-checkout-create',
    'plus-checkout-billing',
    'paypal-approve',
    'plus-checkout-return',
    'sub2api-session-import',
  ]);
});

test('background contribution Plus mode forces SUB2API session import over a CPA session request', () => {
  const api = createHarness();
  const state = {
    activeFlowId: 'openai',
    flowId: 'openai',
    panelMode: 'cpa',
    plusModeEnabled: true,
    accountContributionEnabled: true,
    plusPaymentMethod: 'paypal',
    plusAccountAccessStrategy: 'cpa_codex_session',
    signupMethod: 'email',
  };

  const resolvedState = api.buildResolvedStepDefinitionState(state);
  const nodeIds = api.getNodeIdsForState(state);

  assert.equal(resolvedState.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(nodeIds.includes('cpa-session-import'), false);
  assert.equal(nodeIds.at(-1), 'sub2api-session-import');
});
