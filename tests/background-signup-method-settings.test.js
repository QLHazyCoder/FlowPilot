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

test('signup method resolution freezes per run and falls back when phone signup is unavailable', async () => {
  const api = new Function(`
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
const DEFAULT_SIGNUP_METHOD = SIGNUP_METHOD_EMAIL;
const logs = [];
let state = {
  signupMethod: 'phone',
  phoneVerificationEnabled: true,
  plusModeEnabled: false,
  accountContributionEnabled: false,
  resolvedSignupMethod: null,
};
async function getState() { return { ...state }; }
async function setState(updates) { state = { ...state, ...updates }; }
async function addLog(message, level = 'info') { logs.push({ message, level }); }
${extractFunction('normalizeSignupMethod')}
${extractFunction('canUsePhoneSignup')}
${extractFunction('resolveSignupMethod')}
${extractFunction('ensureResolvedSignupMethodForRun')}
return {
  logs,
  get state() { return state; },
  setState,
  resolveSignupMethod,
  ensureResolvedSignupMethodForRun,
};
`)();

  assert.equal(api.resolveSignupMethod({ signupMethod: 'phone', phoneVerificationEnabled: true }), 'phone');
  assert.equal(api.resolveSignupMethod({ signupMethod: 'phone', phoneVerificationEnabled: false }), 'email');
  assert.equal(api.resolveSignupMethod({ signupMethod: 'phone', phoneVerificationEnabled: true, plusModeEnabled: true }), 'email');
  assert.equal(api.resolveSignupMethod({ signupMethod: 'email', resolvedSignupMethod: 'phone', phoneVerificationEnabled: false }), 'phone');

  assert.equal(await api.ensureResolvedSignupMethodForRun(), 'phone');
  assert.equal(api.state.resolvedSignupMethod, 'phone');

  await api.setState({ signupMethod: 'email', phoneVerificationEnabled: false });
  assert.equal(await api.ensureResolvedSignupMethodForRun(), 'phone');
  assert.equal(api.state.resolvedSignupMethod, 'phone');

  await api.setState({ resolvedSignupMethod: null, signupMethod: 'phone', phoneVerificationEnabled: false });
  assert.equal(await api.ensureResolvedSignupMethodForRun({ force: true }), 'email');
  assert.equal(api.state.resolvedSignupMethod, 'email');
  assert.equal(api.logs.some((entry) => /固定为邮箱注册/.test(entry.message)), true);
});

test('signup method resolution respects the shared flow capability registry when available', () => {
  const api = new Function(`
const self = {
  MultiPageFlowCapabilities: {
    createFlowCapabilityRegistry() {
      return {
        resolveSidepanelCapabilities({ state = {}, signupMethod = 'email' } = {}) {
          const phoneAllowed = String(state?.activeFlowId || '').trim().toLowerCase() === 'openai';
          return {
            canUsePhoneSignup: phoneAllowed,
            effectiveSignupMethod: signupMethod === 'phone' && phoneAllowed ? 'phone' : 'email',
          };
        },
      };
    },
  },
};
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
${extractFunction('normalizeSignupMethod')}
${extractFunction('canUsePhoneSignup')}
${extractFunction('resolveSignupMethod')}
return {
  canUsePhoneSignup,
  resolveSignupMethod,
};
`)();

  assert.equal(api.canUsePhoneSignup({
    activeFlowId: 'site-a',
    phoneVerificationEnabled: true,
    signupMethod: 'phone',
  }), false);
  assert.equal(api.resolveSignupMethod({
    activeFlowId: 'site-a',
    phoneVerificationEnabled: true,
    signupMethod: 'phone',
  }), 'email');
  assert.equal(api.resolveSignupMethod({
    activeFlowId: 'openai',
    phoneVerificationEnabled: true,
    signupMethod: 'phone',
  }), 'phone');
});

test('background step definitions resolve titles from the frozen signup method', () => {
const api = new Function(`
const captured = [];
const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const self = {
  MultiPageStepDefinitions: {
    getSteps(options) {
      captured.push(options);
      return [{
        id: 2,
        key: 'submit-signup-email',
        title: options.signupMethod === 'phone' ? '注册并输入手机号' : '注册并输入邮箱',
      }];
    },
  },
};
${extractFunction('isPlusModeState')}
${extractFunction('normalizePlusPaymentMethod')}
${extractFunction('normalizePlusAccountAccessStrategy')}
${extractFunction('normalizeSignupMethod')}
${extractFunction('getSignupMethodForStepDefinitions')}
${extractFunction('buildResolvedStepDefinitionState')}
${extractFunction('getStepDefinitionsForState')}
return {
  getCaptured: () => captured.slice(),
  getStepDefinitionsForState,
};
`)();

  const steps = api.getStepDefinitionsForState({
    plusModeEnabled: true,
    plusPaymentMethod: 'gopay',
    signupMethod: 'email',
    resolvedSignupMethod: 'phone',
  });

  assert.deepEqual(api.getCaptured(), [{
    activeFlowId: 'openai',
    plusModeEnabled: true,
    plusPaymentMethod: 'gopay',
    plusAccountAccessStrategy: 'oauth',
    signupMethod: 'phone',
    phoneVerificationEnabled: false,
    phoneSignupReloginAfterBindEmailEnabled: false,
  }]);
  assert.equal(steps[0].title, '注册并输入手机号');
});
