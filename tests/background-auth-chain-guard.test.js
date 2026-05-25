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

const OAUTH_TIMEOUT_BUDGET_TEST_REGISTRY = `
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const self = {
  MultiPageFlowRegistry: {
    normalizeFlowId(value, fallback = 'openai') {
      const normalized = String(value || '').trim().toLowerCase();
      return ['openai', 'kiro', 'grok'].includes(normalized) ? normalized : fallback;
    },
    normalizeTargetId(flowId, value, fallback = 'cpa') {
      const normalized = String(value || '').trim().toLowerCase();
      if (flowId === 'openai' && ['cpa', 'sub2api', 'codex2api'].includes(normalized)) return normalized;
      if (flowId === 'kiro') return 'kiro-rs';
      if (flowId === 'grok') return 'webchat2api';
      return fallback;
    },
    getDefaultTargetId(flowId) {
      return flowId === 'openai' ? 'cpa' : '';
    },
    getTargetCapabilities(flowId, targetId) {
      return flowId === 'openai' && targetId === 'cpa'
        ? { usesOauthTimeoutBudget: true }
        : { usesOauthTimeoutBudget: false };
    },
  },
};
`;

test('background auth chain set does not include Plus session import nodes', () => {
  const authChainStart = source.indexOf('const AUTH_CHAIN_NODE_IDS = new Set([');
  const authChainEnd = source.indexOf(']);', authChainStart);
  const authChainBlock = source.slice(authChainStart, authChainEnd);

  assert.ok(authChainStart >= 0, 'expected AUTH_CHAIN_NODE_IDS block to exist');
  assert.doesNotMatch(authChainBlock, /sub2api-session-import/);
  assert.doesNotMatch(authChainBlock, /cpa-session-import/);
});

test('step 8 recovery rebuilds primary phone login identity before rerunning oauth-login', async () => {
  const events = {
    executePayloads: [],
    logs: [],
    statuses: [],
  };
  let state = {
    signupMethod: 'phone',
    resolvedSignupMethod: 'phone',
    phoneVerificationEnabled: true,
    email: 'bound.step8@example.com',
    forceLoginIdentifierType: 'email',
    forceEmailLogin: true,
    accountIdentifierType: 'email',
    accountIdentifier: 'bound.step8@example.com',
    signupPhoneNumber: '+447780579093',
    signupPhoneCompletedActivation: {
      activationId: 'signup-done',
      phoneNumber: '+447780579093',
    },
  };

  const api = new Function('events', 'state', `
const SIGNUP_METHOD_PHONE = 'phone';
const FINAL_OAUTH_CHAIN_START_STEP = 7;
function getNodeIdByStepForState(step) {
  return Number(step) === 7 ? 'oauth-login' : '';
}
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
function isStopError() {
  return false;
}
function isTerminalSecurityBlockedError() {
  return false;
}
async function getState() {
  return { ...state };
}
async function addLog(message, level, options) {
  events.logs.push({ message, level, options });
}
async function setNodeStatus(nodeId, status) {
  events.statuses.push({ nodeId, status });
}
async function appendManualAccountRunRecordIfNeeded() {}
async function sleepWithStop() {}
function throwIfStopped() {}
const step7Executor = {
  async executeStep7(payload) {
    events.executePayloads.push(payload);
  },
};
${extractFunction('normalizeAuthRecoveryIdentifierType')}
${extractFunction('isPhoneSignupAuthRecoveryState')}
${extractFunction('getPhoneSignupAuthRecoveryIdentity')}
${extractFunction('isBoundEmailReloginAuthRecoveryNode')}
${extractFunction('buildAuthLoginRecoveryState')}
${extractFunction('rerunStep7ForStep8Recovery')}
return { rerunStep7ForStep8Recovery };
`)(events, state);

  await api.rerunStep7ForStep8Recovery({
    logMessage: 'retry primary login',
    logStep: 8,
  });

  assert.equal(events.executePayloads.length, 1);
  assert.equal(events.executePayloads[0].nodeId, 'oauth-login');
  assert.equal(events.executePayloads[0].visibleStep, 7);
  assert.equal(events.executePayloads[0].authLoginPhase, 'primary-login');
  assert.equal(events.executePayloads[0].forceLoginIdentifierType, 'phone');
  assert.equal(events.executePayloads[0].forceEmailLogin, false);
  assert.equal(events.executePayloads[0].accountIdentifierType, 'phone');
  assert.equal(events.executePayloads[0].accountIdentifier, '+447780579093');
  assert.equal(events.executePayloads[0].signupPhoneNumber, '+447780579093');
});

const NODE_EXECUTE_COMPAT_HELPERS = `
const AUTH_CHAIN_NODE_IDS = new Set(['oauth-login', 'fetch-login-code', 'confirm-oauth', 'platform-verify']);
const STEP_NODE_IDS = {
  1: 'open-chatgpt',
  2: 'submit-signup-email',
  3: 'fill-password',
  4: 'fetch-signup-code',
  5: 'fill-profile',
  6: 'wait-registration-success',
  7: 'oauth-login',
  8: 'fetch-login-code',
  9: 'confirm-oauth',
  10: 'platform-verify',
};
const NODE_STEP_IDS = Object.fromEntries(Object.entries(STEP_NODE_IDS).map(([step, nodeId]) => [nodeId, Number(step)]));
function isAuthChainNode(nodeId) {
  return AUTH_CHAIN_NODE_IDS.has(String(nodeId || '').trim());
}
function getNodeIdByStepForState(step) {
  const definition = typeof getStepDefinitionForState === 'function' ? getStepDefinitionForState(step) : null;
  const definitionKey = String(definition?.key || '').trim();
  return definitionKey && definitionKey !== 'test-step'
    ? definitionKey
    : String(STEP_NODE_IDS[Number(step)] || '').trim();
}
function getStepIdByNodeIdForState(nodeId) {
  const normalizedNodeId = String(nodeId || '').trim();
  return NODE_STEP_IDS[normalizedNodeId] || null;
}
function getNodeDefinitionForState(nodeId, state = {}) {
  const step = getStepIdByNodeIdForState(nodeId, state);
  const stepDefinition = typeof getStepDefinitionForState === 'function'
    ? getStepDefinitionForState(step, state)
    : null;
  return stepDefinition
    ? { nodeId: String(nodeId || '').trim(), legacyStepId: step, executeKey: String(stepDefinition.key || nodeId || '').trim() }
    : null;
}
async function setNodeStatus(nodeId, status) {
  return setStepStatus(getStepIdByNodeIdForState(nodeId), status);
}
function doesNodeUseCompletionSignal(nodeId, state = {}) {
  return typeof doesStepUseCompletionSignal === 'function'
    ? doesStepUseCompletionSignal(getStepIdByNodeIdForState(nodeId), state)
    : false;
}
const rawGetStepRegistryForState = getStepRegistryForState;
getStepRegistryForState = function getNodeAdaptedStepRegistryForState(state = {}) {
  const registry = rawGetStepRegistryForState(state);
  if (!registry || typeof registry !== 'object' || typeof registry.getNodeDefinition === 'function') {
    return registry;
  }
  return {
    ...registry,
    getNodeDefinition(nodeId) {
      return getNodeDefinitionForState(nodeId, state);
    },
    async executeNode(nodeId, payload = {}) {
      const step = getStepIdByNodeIdForState(nodeId);
      return registry.executeStep(step, payload);
    },
  };
};
`;

test('throwIfStopped rethrows an explicit stop error even when stopRequested has been cleared', () => {
  const api = new Function(`
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
let stopRequested = false;
${extractFunction('isStopError')}
${extractFunction('throwIfStopped')}
return {
  run(error) {
    throwIfStopped(error);
  },
};
`)();

  assert.throws(
    () => api.run(new Error('流程已被用户停止。')),
    /流程已被用户停止。/
  );
});

test('executeNode reuses the active top-level auth chain instead of starting a duplicate node', async () => {
  const api = new Function(`
const LOG_PREFIX = '[test]';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const BROWSER_SWITCH_REQUIRED_ERROR_PREFIX = 'BROWSER_SWITCH_REQUIRED::';
const AUTH_CHAIN_STEP_IDS = new Set([7, 8, 9, 10]);
let activeTopLevelAuthChainExecution = null;
let stopRequested = false;
let releaseStep8 = null;
const events = {
  logs: [],
  statusCalls: [],
  registryCalls: [],
};
const state = {
  stepStatuses: {},
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}
async function setStepStatus(step, status) {
  state.stepStatuses[step] = status;
  events.statusCalls.push({ step, status });
}
async function humanStepDelay() {}
async function getState() {
  return {
    flowStartTime: null,
    stepStatuses: { ...state.stepStatuses },
  };
}
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
async function appendManualAccountRunRecordIfNeeded() {}
function isTerminalSecurityBlockedError() {
  return false;
}
async function handleCloudflareSecurityBlocked() {}
function isBrowserSwitchRequiredError() {
  return false;
}
async function handleBrowserSwitchRequired() {}
function doesStepUseCompletionSignal() {
  return false;
}
function isRetryableContentScriptTransportError() {
  return false;
}
const stepRegistry = {
  getStepDefinition(step) {
    return { id: step, key: 'test-step' };
  },
  async executeStep(step) {
    events.registryCalls.push(step);
    if (step === 8) {
      await new Promise((resolve) => {
        releaseStep8 = resolve;
      });
    }
  },
};
function getStepRegistryForState() {
  return stepRegistry;
}
function getStepDefinitionForState(step) {
  return { id: step, key: 'test-step' };
}

${NODE_EXECUTE_COMPAT_HELPERS}
${extractFunction('isStopError')}
${extractFunction('throwIfStopped')}
${extractFunction('isAuthChainStep')}
${extractFunction('acquireTopLevelAuthChainExecutionForNode')}
${extractFunction('executeNode')}

return {
  executeNode,
  releaseStep8() {
    if (releaseStep8) {
      releaseStep8();
    }
  },
  snapshot() {
    return events;
  },
};
`)();

  const firstRun = api.executeNode('fetch-login-code');
  await new Promise((resolve) => setImmediate(resolve));
  const duplicateRun = api.executeNode('oauth-login');
  await new Promise((resolve) => setImmediate(resolve));
  api.releaseStep8();

  await firstRun;
  await duplicateRun;

  const events = api.snapshot();
  assert.deepStrictEqual(events.registryCalls, [8]);
  assert.deepStrictEqual(events.statusCalls, [
    { step: 8, status: 'running' },
  ]);
  assert.ok(events.logs.some(({ message }) => /复用当前授权链/.test(message)));
});

test('executeNode stops flow when browser-switch-required error is raised', async () => {
  const api = new Function(`
const LOG_PREFIX = '[test]';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const BROWSER_SWITCH_REQUIRED_ERROR_PREFIX = 'BROWSER_SWITCH_REQUIRED::';
const AUTH_CHAIN_STEP_IDS = new Set([7, 8, 9, 10]);
let activeTopLevelAuthChainExecution = null;
let stopRequested = false;
const events = {
  logs: [],
  statusCalls: [],
  stopRequests: [],
  appendRecords: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}
async function setStepStatus(step, status) {
  events.statusCalls.push({ step, status });
}
async function humanStepDelay() {}
async function getState() {
  return {
    flowStartTime: null,
    stepStatuses: {},
  };
}
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
async function appendManualAccountRunRecordIfNeeded(status, _state, reason) {
  events.appendRecords.push({ status, reason });
}
function isTerminalSecurityBlockedError() {
  return false;
}
async function handleCloudflareSecurityBlocked() {}
async function requestStop(options = {}) {
  events.stopRequests.push(options);
}
function doesStepUseCompletionSignal() {
  return false;
}
function isRetryableContentScriptTransportError() {
  return false;
}
const stepRegistry = {
  getStepDefinition(step) {
    return { id: step, key: 'test-step' };
  },
  async executeStep() {
    throw new Error('BROWSER_SWITCH_REQUIRED::请更换浏览器进行注册登录。');
  },
};
function getStepRegistryForState() {
  return stepRegistry;
}
function getStepDefinitionForState(step) {
  return { id: step, key: 'test-step' };
}

${NODE_EXECUTE_COMPAT_HELPERS}
${extractFunction('isStopError')}
${extractFunction('throwIfStopped')}
${extractFunction('isAuthChainStep')}
${extractFunction('acquireTopLevelAuthChainExecutionForNode')}
${extractFunction('isBrowserSwitchRequiredError')}
${extractFunction('getBrowserSwitchRequiredMessage')}
${extractFunction('handleBrowserSwitchRequired')}
${extractFunction('executeNode')}

return {
  executeNode,
  snapshot() {
    return events;
  },
};
`)();

  await assert.rejects(
    () => api.executeNode('platform-verify'),
    /流程已被用户停止。/
  );

  const events = api.snapshot();
  assert.deepStrictEqual(events.stopRequests, [
    { logMessage: '请更换浏览器进行注册登录。' },
  ]);
  assert.deepStrictEqual(events.statusCalls, [
    { step: 10, status: 'running' },
  ]);
  assert.equal(
    events.logs.some(({ message }) => /步骤 10 失败/.test(message)),
    false,
    'browser-switch-required error should stop the flow before generic failed logging'
  );
});

test('oauth timeout budget ignores stale deadlines from an old oauth url', async () => {
  const api = new Function(`
const LOG_PREFIX = '[test]';
const OAUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
${OAUTH_TIMEOUT_BUDGET_TEST_REGISTRY}
${extractFunction('resolveOAuthTimeoutBudgetScope')}
${extractFunction('shouldUseOAuthTimeoutBudget')}
${extractFunction('normalizeOAuthFlowDeadlineAt')}
${extractFunction('normalizeOAuthFlowSourceUrl')}
${extractFunction('getOAuthFlowRemainingMs')}
${extractFunction('getOAuthFlowStepTimeoutMs')}
return {
  getOAuthFlowStepTimeoutMs,
};
`)();

  const timeoutMs = await api.getOAuthFlowStepTimeoutMs(15000, {
    step: 8,
    actionLabel: '登录验证码流程',
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      oauthUrl: 'https://oauth.example/current',
      oauthFlowDeadlineAt: Date.now() + 1200,
      oauthFlowDeadlineSourceUrl: 'https://oauth.example/old',
    },
  });

  assert.equal(timeoutMs, 15000);
});

test('oauth timeout budget clamps local timeout when enabled by default', async () => {
  const api = new Function(`
const LOG_PREFIX = '[test]';
const OAUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
${OAUTH_TIMEOUT_BUDGET_TEST_REGISTRY}
${extractFunction('buildOAuthFlowTimeoutError')}
${extractFunction('resolveOAuthTimeoutBudgetScope')}
${extractFunction('shouldUseOAuthTimeoutBudget')}
${extractFunction('normalizeOAuthFlowDeadlineAt')}
${extractFunction('normalizeOAuthFlowSourceUrl')}
${extractFunction('getOAuthFlowRemainingMs')}
${extractFunction('getOAuthFlowStepTimeoutMs')}
return {
  getOAuthFlowStepTimeoutMs,
};
`)();

  const timeoutMs = await api.getOAuthFlowStepTimeoutMs(15000, {
    step: 8,
    actionLabel: '登录验证码流程',
    state: {
      activeFlowId: 'openai',
      targetId: 'cpa',
      oauthUrl: 'https://oauth.example/current',
      oauthFlowDeadlineAt: Date.now() + 1200,
      oauthFlowDeadlineSourceUrl: 'https://oauth.example/current',
    },
  });

  assert(timeoutMs <= 1200);
  assert(timeoutMs >= 1000);
});

test('oauth timeout budget ignores active deadlines outside openai cpa target', async () => {
  const api = new Function(`
const LOG_PREFIX = '[test]';
const OAUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
${OAUTH_TIMEOUT_BUDGET_TEST_REGISTRY}
${extractFunction('buildOAuthFlowTimeoutError')}
${extractFunction('resolveOAuthTimeoutBudgetScope')}
${extractFunction('shouldUseOAuthTimeoutBudget')}
${extractFunction('normalizeOAuthFlowDeadlineAt')}
${extractFunction('normalizeOAuthFlowSourceUrl')}
${extractFunction('getOAuthFlowRemainingMs')}
${extractFunction('getOAuthFlowStepTimeoutMs')}
return {
  getOAuthFlowStepTimeoutMs,
};
`)();

  const timeoutMs = await api.getOAuthFlowStepTimeoutMs(15000, {
    step: 9,
    actionLabel: 'OAuth localhost 回调',
    state: {
      activeFlowId: 'openai',
      targetId: 'sub2api',
      oauthUrl: 'https://oauth.example/current',
      oauthFlowDeadlineAt: Date.now() - 1000,
      oauthFlowDeadlineSourceUrl: 'https://oauth.example/current',
    },
  });

  assert.equal(timeoutMs, 15000);
});

test('startOAuthFlowTimeoutWindow clears stale deadline outside openai cpa target', async () => {
  const events = {
    stateUpdates: [],
    logs: [],
  };
const api = new Function('events', `
const OAUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
${OAUTH_TIMEOUT_BUDGET_TEST_REGISTRY}
async function getState() {
  return {
    activeFlowId: 'openai',
    targetId: 'sub2api',
    oauthFlowDeadlineAt: Date.now() - 1000,
    oauthFlowDeadlineSourceUrl: 'https://oauth.example/old',
  };
}
async function setState(update) {
  events.stateUpdates.push(update);
}
async function addLog(message, level) {
  events.logs.push({ message, level });
}
${extractFunction('resolveOAuthTimeoutBudgetScope')}
${extractFunction('shouldUseOAuthTimeoutBudget')}
${extractFunction('normalizeOAuthFlowSourceUrl')}
${extractFunction('startOAuthFlowTimeoutWindow')}
return {
  startOAuthFlowTimeoutWindow,
};
`)(events);

  const result = await api.startOAuthFlowTimeoutWindow({
    step: 7,
    oauthUrl: 'https://oauth.example/current',
  });

  assert.equal(result, null);
  assert.deepStrictEqual(events.stateUpdates, [{
    oauthFlowDeadlineAt: null,
    oauthFlowDeadlineSourceUrl: null,
  }]);
  assert.deepStrictEqual(events.logs, []);
});

test('oauth localhost timeout recovery resumes from bound-email relogin tail when present', async () => {
  const events = {
    logs: [],
    recoveryRuns: [],
    stateUpdates: [],
    timeoutWindows: [],
  };

  const api = new Function('events', `
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const state = {
  oauthUrl: 'https://oauth.example/current',
  phoneSignupReloginAfterBindEmailEnabled: true,
};
const STEP_NODE_IDS = {
  7: 'oauth-login',
  8: 'fetch-login-code',
  9: 'bind-email',
  10: 'fetch-bind-email-code',
  11: 'relogin-bound-email',
  12: 'fetch-bound-email-login-code',
  13: 'post-bound-email-phone-verification',
  14: 'confirm-oauth',
  15: 'platform-verify',
};
const NODE_STEP_IDS = Object.fromEntries(Object.entries(STEP_NODE_IDS).map(([step, nodeId]) => [nodeId, Number(step)]));

function getErrorMessage(error) {
  return error?.message || String(error || '');
}
function getAuthChainStartStepId() {
  return 7;
}
function getStepIdByKeyForState(stepKey) {
  return NODE_STEP_IDS[String(stepKey || '').trim()] || null;
}
function getNodeIdByStepForState(step) {
  return STEP_NODE_IDS[Number(step)] || '';
}
function getStepIdByNodeIdForState(nodeId) {
  return NODE_STEP_IDS[String(nodeId || '').trim()] || null;
}
function getAutoRunWorkflowNodeIds() {
  return [
    'oauth-login',
    'fetch-login-code',
    'bind-email',
    'fetch-bind-email-code',
    'relogin-bound-email',
    'fetch-bound-email-login-code',
    'post-bound-email-phone-verification',
    'confirm-oauth',
    'platform-verify',
  ];
}
async function addLog(message, level = 'info', options = {}) {
  events.logs.push({ message, level, options });
}
async function getLoginAuthStateFromContent() {
  return { state: 'oauth_consent_page' };
}
function isAddPhoneAuthState() {
  return false;
}
function getLoginAuthStateLabel(value) {
  return value || 'unknown';
}
async function getState() {
  return { ...state };
}
async function setState(update) {
  events.stateUpdates.push(update);
  Object.assign(state, update);
}
async function startOAuthFlowTimeoutWindow(payload) {
  events.timeoutWindows.push(payload);
}
const step7Executor = {
  async executeStep7(payload) {
    events.recoveryRuns.push({ nodeId: 'oauth-login', visibleStep: payload.visibleStep });
  },
};
const step8Executor = {
  async executeStep8(payload) {
    events.recoveryRuns.push({ nodeId: 'fetch-login-code', visibleStep: payload.visibleStep });
  },
  async executePostLoginPhoneVerification(payload) {
    events.recoveryRuns.push({ nodeId: 'post-login-phone-verification', visibleStep: payload.visibleStep });
  },
  async executeBindEmail(payload) {
    events.recoveryRuns.push({ nodeId: 'bind-email', visibleStep: payload.visibleStep });
  },
  async executeFetchBindEmailCode(payload) {
    events.recoveryRuns.push({ nodeId: 'fetch-bind-email-code', visibleStep: payload.visibleStep });
  },
  async executeBoundEmailLoginCode(payload) {
    events.recoveryRuns.push({ nodeId: 'fetch-bound-email-login-code', visibleStep: payload.visibleStep });
  },
  async executeBoundEmailPostLoginPhoneVerification(payload) {
    events.recoveryRuns.push({ nodeId: 'post-bound-email-phone-verification', visibleStep: payload.visibleStep });
  },
};
async function executeReloginBoundEmail(payload) {
  events.recoveryRuns.push({ nodeId: 'relogin-bound-email', visibleStep: payload.visibleStep });
}

${extractFunction('isStep9OAuthLocalhostTimeoutError')}
${extractFunction('recoverOAuthLocalhostTimeout')}

return {
  recoverOAuthLocalhostTimeout,
};
`)(events);

  const recoveredState = await api.recoverOAuthLocalhostTimeout({
    error: new Error('步骤 14：从拿到 OAuth 登录地址开始，5 分钟内未完成 OAuth localhost 回调，结束当前链路。'),
    state: {
      oauthUrl: 'https://oauth.example/current',
      phoneSignupReloginAfterBindEmailEnabled: true,
    },
    visibleStep: 14,
  });

  assert.deepStrictEqual(events.recoveryRuns, [
    { nodeId: 'relogin-bound-email', visibleStep: 11 },
    { nodeId: 'fetch-bound-email-login-code', visibleStep: 12 },
    { nodeId: 'post-bound-email-phone-verification', visibleStep: 13 },
  ]);
  assert.deepStrictEqual(events.stateUpdates, [{ localhostUrl: null }]);
  assert.deepStrictEqual(events.timeoutWindows, [
    {
      step: 14,
      oauthUrl: 'https://oauth.example/current',
    },
  ]);
  assert.equal(recoveredState.localhostUrl, null);
  assert.ok(events.logs.some(({ message }) => /步骤 11/.test(message)));
  assert.equal(events.recoveryRuns.some(({ nodeId }) => nodeId === 'oauth-login'), false);
});

test('executeNode retries fetch-network errors for fetch-signup-code with cooldown and bounded attempts', async () => {
  const api = new Function(`
const LOG_PREFIX = '[test]';
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const BROWSER_SWITCH_REQUIRED_ERROR_PREFIX = 'BROWSER_SWITCH_REQUIRED::';
const AUTH_CHAIN_STEP_IDS = new Set([7, 8, 9, 10]);
const STEP_FETCH_NETWORK_RETRY_POLICIES = new Map([[4, { maxAttempts: 3, cooldownMs: 1 }]]);
let activeTopLevelAuthChainExecution = null;
let stopRequested = false;
const events = {
  logs: [],
  statusCalls: [],
  registryCalls: [],
  sleepCalls: [],
};
let runCount = 0;

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}
async function setStepStatus(step, status) {
  events.statusCalls.push({ step, status });
}
async function humanStepDelay() {}
async function getState() {
  return {
    flowStartTime: null,
    stepStatuses: {},
  };
}
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
async function appendManualAccountRunRecordIfNeeded() {}
function isTerminalSecurityBlockedError() {
  return false;
}
async function handleCloudflareSecurityBlocked() {}
function doesStepUseCompletionSignal() {
  return false;
}
async function sleepWithStop(ms) {
  events.sleepCalls.push(ms);
}
const stepRegistry = {
  getStepDefinition(step) {
    return { id: step, key: 'fetch-signup-code' };
  },
  async executeStep(step) {
    events.registryCalls.push(step);
    runCount += 1;
    if (runCount < 3) {
      throw new TypeError('Failed to fetch');
    }
  },
};
function getStepRegistryForState() {
  return stepRegistry;
}
function getStepDefinitionForState(step) {
  return { id: step, key: 'fetch-signup-code' };
}

${NODE_EXECUTE_COMPAT_HELPERS}
${extractFunction('isStopError')}
${extractFunction('isRetryableContentScriptTransportError')}
${extractFunction('isStepFetchNetworkRetryableError')}
${extractFunction('getStepFetchNetworkRetryPolicy')}
${extractFunction('throwIfStopped')}
${extractFunction('isAuthChainStep')}
${extractFunction('acquireTopLevelAuthChainExecutionForNode')}
${extractFunction('isBrowserSwitchRequiredError')}
${extractFunction('getBrowserSwitchRequiredMessage')}
${extractFunction('handleBrowserSwitchRequired')}
${extractFunction('executeNode')}

return {
  executeNode,
  snapshot() {
    return events;
  },
};
`)();

  await api.executeNode('fetch-signup-code');

  const events = api.snapshot();
  assert.deepStrictEqual(events.registryCalls, [4, 4, 4]);
  assert.deepStrictEqual(events.sleepCalls, [1, 1]);
  assert.equal(
    events.logs.filter(({ message }) => message.includes('[NETWORK_FETCH_RETRY]')).length >= 3,
    true
  );
});
