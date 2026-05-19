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
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = index;
      break;
    }
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

test('background routes plus-checkout-create through a completion signal for hosted checkout', () => {
  const backgroundSetStart = source.indexOf('const AUTO_RUN_BACKGROUND_COMPLETED_STEP_KEYS = new Set([');
  const signalSetStart = source.indexOf('const STEP_COMPLETION_SIGNAL_STEP_KEYS = new Set([');
  const timeoutMapStart = source.indexOf('const STEP_COMPLETION_SIGNAL_TIMEOUTS_BY_STEP_KEY = new Map([');
  const backgroundSetSource = source.slice(backgroundSetStart, signalSetStart);
  const signalSetSource = source.slice(signalSetStart, timeoutMapStart);

  assert.doesNotMatch(backgroundSetSource, /'plus-checkout-create'/);
  assert.match(signalSetSource, /'plus-checkout-create'/);
});

test('background gives PayPal session-import hosted checkout a long completion and idle window', () => {
  const bundle = `
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const AUTO_RUN_SIGNAL_COMPLETION_TIMEOUT_MS = 120000;
const AUTO_RUN_STEP_IDLE_LOG_TIMEOUT_MS = 5 * 60 * 1000;
const HOSTED_CHECKOUT_SUCCESS_SIGNAL_TIMEOUT_MS = 30 * 60 * 1000;
const STEP_COMPLETION_SIGNAL_TIMEOUTS_BY_STEP_KEY = new Map([
  ['fill-profile', 150000],
  ['gopay-subscription-confirm', 1800000],
]);
function normalizePlusAccountAccessStrategy(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION) return PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION;
  if (normalized === PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION) return PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION;
  return PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
}
function getNodeExecutionKeyForState(nodeId, state = {}) {
  return String(state?.nodes?.[nodeId]?.executeKey || nodeId || '').trim();
}
${extractFunction('isHostedCheckoutSuccessCompletionNode')}
${extractFunction('getNodeCompletionSignalTimeoutMs')}
${extractFunction('getAutoRunNodeIdleLogTimeoutMs')}
return { isHostedCheckoutSuccessCompletionNode, getNodeCompletionSignalTimeoutMs, getAutoRunNodeIdleLogTimeoutMs };
`;
  const api = new Function(bundle)();
  const hostedState = {
    plusModeEnabled: true,
    plusPaymentMethod: 'paypal',
    signupMethod: 'email',
    plusAccountAccessStrategy: 'sub2api_codex_session',
  };

  assert.equal(api.isHostedCheckoutSuccessCompletionNode('plus-checkout-create', hostedState), true);
  assert.equal(api.getNodeCompletionSignalTimeoutMs('plus-checkout-create', hostedState), 30 * 60 * 1000);
  assert.equal(api.getAutoRunNodeIdleLogTimeoutMs('plus-checkout-create', hostedState), 30 * 60 * 1000);
  assert.equal(api.isHostedCheckoutSuccessCompletionNode('plus-checkout-create', {
    ...hostedState,
    accountContributionEnabled: true,
    plusAccountAccessStrategy: 'oauth',
  }), true);
  assert.equal(api.isHostedCheckoutSuccessCompletionNode('plus-checkout-create', { ...hostedState, plusAccountAccessStrategy: 'oauth' }), false);
  assert.equal(api.isHostedCheckoutSuccessCompletionNode('plus-checkout-create', { ...hostedState, signupMethod: 'phone' }), false);
  assert.equal(api.isHostedCheckoutSuccessCompletionNode('plus-checkout-create', {
    ...hostedState,
    accountContributionEnabled: true,
    signupMethod: 'phone',
  }), false);
  assert.equal(api.isHostedCheckoutSuccessCompletionNode('plus-checkout-create', { ...hostedState, plusPaymentMethod: 'gopay' }), false);
  assert.equal(api.getNodeCompletionSignalTimeoutMs('plus-checkout-create', { ...hostedState, plusAccountAccessStrategy: 'oauth' }), 120000);
  assert.equal(api.getAutoRunNodeIdleLogTimeoutMs('plus-checkout-create', { ...hostedState, plusAccountAccessStrategy: 'oauth' }), 5 * 60 * 1000);
});

test('background imports and registers the hosted checkout success manager', () => {
  assert.match(source, /importScripts\([\s\S]*'background\/plus-hosted-checkout-success\.js'/);
  assert.match(source, /createPlusHostedCheckoutSuccessManager\(\{/);
  assert.match(source, /chrome\.tabs\.onUpdated\.addListener\(\(tabId, changeInfo, tab\) => \{[\s\S]*plusHostedCheckoutSuccessManager\?\.handleTabUpdated/);
});
