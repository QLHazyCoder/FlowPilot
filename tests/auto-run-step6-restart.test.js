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

const NODE_COMPAT_HELPERS = `
const FALLBACK_STEP_NODE_IDS = {
  1: 'open-chatgpt',
  2: 'submit-signup-email',
  3: 'fill-password',
  4: 'fetch-signup-code',
  5: 'fill-profile',
  6: 'plus-checkout-create',
  7: 'plus-checkout-billing',
  8: 'paypal-approve',
  9: 'plus-checkout-return',
  10: 'oauth-login',
  11: 'fetch-login-code',
  12: 'confirm-oauth',
  13: 'platform-verify',
};
function getNodeIdByStepForState(step, state = {}) {
  if (typeof getStepDefinitionForState === 'function') {
    const key = String(getStepDefinitionForState(step, state)?.key || '').trim();
    if (key) return key;
  }
  return FALLBACK_STEP_NODE_IDS[Number(step)] || '';
}
function getStepIdByNodeIdForState(nodeId, state = {}) {
  const normalizedNodeId = String(nodeId || '').trim();
  const ids = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : Object.keys(FALLBACK_STEP_NODE_IDS).map(Number);
  for (const step of ids) {
    if (getNodeIdByStepForState(step, state) === normalizedNodeId) {
      return Number(step);
    }
  }
  for (const [step, fallbackNodeId] of Object.entries(FALLBACK_STEP_NODE_IDS)) {
    if (fallbackNodeId === normalizedNodeId) {
      return Number(step);
    }
  }
  return null;
}
function getNodeIdsForState(state = {}) {
  const ids = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : Object.keys(FALLBACK_STEP_NODE_IDS).map(Number);
  return ids
    .map((step) => getNodeIdByStepForState(step, state))
    .filter(Boolean);
}
function getNodeDefinitionForState(nodeId, state = {}) {
  const normalizedNodeId = String(nodeId || '').trim();
  const step = getStepIdByNodeIdForState(normalizedNodeId, state);
  const executeKey = typeof getStepExecutionKeyForState === 'function'
    ? getStepExecutionKeyForState(step, state)
    : normalizedNodeId;
  return normalizedNodeId ? { nodeId: normalizedNodeId, legacyStepId: step, executeKey } : null;
}
function getNodeTitleForState(nodeId) {
  return String(nodeId || '').trim();
}
function projectStepStatusesToNodeStatuses(stepStatuses = {}, state = {}) {
  const nodeStatuses = {};
  for (const [step, status] of Object.entries(stepStatuses || {})) {
    const nodeId = getNodeIdByStepForState(step, state);
    if (nodeId) nodeStatuses[nodeId] = status;
  }
  return nodeStatuses;
}
const rawGetStateForNodeCompat = getState;
getState = async function getStateWithNodeStatuses() {
  const state = await rawGetStateForNodeCompat();
  return {
    ...state,
    nodeStatuses: {
      ...projectStepStatusesToNodeStatuses(state?.stepStatuses || {}, state),
      ...(state?.nodeStatuses || {}),
    },
  };
};
async function executeNodeAndWait(nodeId, delayAfter) {
  const directStep = Number(nodeId);
  if (Number.isInteger(directStep) && directStep > 0) {
    return executeStepAndWait(directStep, delayAfter);
  }
  return executeStepAndWait(getStepIdByNodeIdForState(nodeId, await getState()), delayAfter);
}
function getAutoRunNodeDelayMs() {
  return 0;
}
async function runAutoSequenceFromStep(step, context = {}) {
  return runAutoSequenceFromNode(getNodeIdByStepForState(step, await getState()), context);
}
`;

const bundle = [
  extractFunction('isAddPhoneAuthFailure'),
  extractFunction('isAddPhoneAuthUrl'),
  extractFunction('isAddPhoneAuthState'),
  extractFunction('isPlusCheckoutNonFreeTrialFailure'),
  extractFunction('isPlusCheckoutRestartStep'),
  extractFunction('isPlusCheckoutRestartRequiredFailure'),
  extractFunction('getLatestLogTimestamp'),
  extractFunction('buildAutoRunNodeIdleRestartError'),
  extractFunction('isAutoRunStepIdleRestartError'),
  extractFunction('startAutoRunNodeIdleLogWatchdog'),
  extractFunction('runAutoNodeActionWithIdleLogWatchdog'),
  extractFunction('executeNodeAndWaitWithAutoRunIdleLogWatchdog'),
  extractFunction('getDownstreamStateResets'),
  extractFunction('isEmailSignupPhoneVerificationNode'),
  extractFunction('getPostStep6AutoRestartDecision'),
  NODE_COMPAT_HELPERS,
  extractFunction('getAutoRunWorkflowNodeIds'),
  extractFunction('runAutoSequenceFromNode'),
  extractFunction('runAutoSequenceFromNodeGraph'),
].join('\n');

const defaultStepDefinitions = {
  1: { key: 'open-signup' },
  2: { key: 'prepare-email' },
  3: { key: 'fill-password' },
  4: { key: 'verify-email' },
  5: { key: 'profile-basic' },
  6: { key: 'profile-finish' },
  7: { key: 'oauth-login' },
  8: { key: 'fetch-login-code' },
  9: { key: 'confirm-oauth' },
  10: { key: 'platform-verify' },
};

const PHONE_IDENTITY_STATE_KEYS = [
  'phoneNumber',
  'signupPhoneNumber',
  'signupPhoneActivation',
  'signupPhoneCompletedActivation',
  'signupPhoneVerificationRequestedAt',
  'signupPhoneVerificationPurpose',
  'accountIdentifierType',
  'accountIdentifier',
];

function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createDownstreamResetHarness(stepKey = '') {
  return new Function(`
function getStepExecutionKeyForState() {
  return ${JSON.stringify(stepKey)};
}
${extractFunction('getDownstreamStateResets')}
return { getDownstreamStateResets };
`)();
}

test('downstream restarts after account creation preserve phone signup identity fields', () => {
  const numericResetHarness = createDownstreamResetHarness('');
  const stepKeyResetHarnesses = [
    createDownstreamResetHarness('oauth-login'),
    createDownstreamResetHarness('fetch-login-code'),
    createDownstreamResetHarness('confirm-oauth'),
  ];
  const phoneState = {
    accountIdentifierType: 'phone',
    accountIdentifier: '+447780579093',
    signupPhoneNumber: '+447780579093',
    signupPhoneActivation: { activationId: 'active', phoneNumber: '+447780579093' },
    signupPhoneCompletedActivation: { activationId: 'done', phoneNumber: '+447780579093' },
  };

  for (const step of [5, 6, 7, 8, 9]) {
    const resets = numericResetHarness.getDownstreamStateResets(step, phoneState);
    for (const key of PHONE_IDENTITY_STATE_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(resets, key),
        false,
        `step ${step} reset must not clear ${key}`
      );
    }
  }

  for (const harness of stepKeyResetHarnesses) {
    const resets = harness.getDownstreamStateResets(10, phoneState);
    for (const key of PHONE_IDENTITY_STATE_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(resets, key),
        false,
        `${key} must not be cleared by step-key reset`
      );
    }
  }
});

function createHarness(options = {}) {
  const {
    startStep = 7,
    failureStep = 10,
    failureBudget = 1,
    failureMessage = '认证失败: Request failed with status code 502',
    authState = { state: 'password_page', url: 'https://auth.openai.com/log-in' },
    customState = {},
    stepDefinitions = defaultStepDefinitions,
    stepIds = Object.keys(stepDefinitions).map(Number).sort((a, b) => a - b),
    lastStepId = Math.max(...stepIds),
    finalOAuthChainStartStep = 7,
    idleLogTimeoutMs = 300000,
    idleLogCheckIntervalMs = 5000,
    hangStep = 0,
    hangBudget = 0,
  } = options;

  return new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 };
const LAST_STEP_ID = ${JSON.stringify(lastStepId)};
const FINAL_OAUTH_CHAIN_START_STEP = ${JSON.stringify(finalOAuthChainStartStep)};
const SIGNUP_METHOD_PHONE = 'phone';
const AUTO_RUN_STEP_IDLE_LOG_TIMEOUT_MS = ${JSON.stringify(idleLogTimeoutMs)};
const AUTO_RUN_STEP_IDLE_LOG_CHECK_INTERVAL_MS = ${JSON.stringify(idleLogCheckIntervalMs)};
const AUTO_RUN_STEP_IDLE_RESTART_MAX_ATTEMPTS = 3;
const AUTO_RUN_STEP_IDLE_RESTART_ERROR_PREFIX = 'AUTO_RUN_STEP_IDLE_RESTART::';
const EMAIL_SIGNUP_PHONE_VERIFICATION_RESTART_MAX_ATTEMPTS = 5;
const LOG_PREFIX = '[test]';
const chrome = {
  tabs: {
    update: async () => {},
  },
};
function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

let remainingFailures = ${JSON.stringify(failureBudget)};
let remainingHangs = ${JSON.stringify(hangBudget)};
const events = {
  steps: [],
  logs: [],
  invalidations: [],
  stateUpdates: [],
  cancellations: [],
  stopBroadcasts: 0,
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level, timestamp: Date.now() });
}

async function ensureAutoEmailReady() {}
async function ensureResolvedSignupMethodForRun() { return 'email'; }
async function broadcastAutoRunStatus() {}
let currentState = {
  stepStatuses: { 3: 'completed' },
  mailProvider: '163',
  logs: events.logs,
  ...${JSON.stringify(customState)},
};
async function getState() {
  return {
    ...deepClone(currentState),
    logs: events.logs,
  };
}
async function setState(updates = {}) {
  currentState = {
    ...currentState,
    ...deepClone(updates),
    logs: events.logs,
  };
  events.stateUpdates.push(deepClone(updates));
}
function getStepIdsForState() {
  return ${JSON.stringify(stepIds)};
}
function getStepDefinitionForState(step) {
  const map = ${JSON.stringify(stepDefinitions)};
  return map[Number(step)] || null;
}
function getStepExecutionKeyForState(step, state = {}) {
  return String(getStepDefinitionForState(step, state)?.key || '').trim();
}
function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}
function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}
async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === ${JSON.stringify(hangStep)} && remainingHangs > 0) {
    remainingHangs -= 1;
    return new Promise(() => {});
  }
  if (step === ${JSON.stringify(failureStep)} && remainingFailures > 0) {
    remainingFailures -= 1;
    throw new Error(${JSON.stringify(failureMessage)});
  }
}
async function getTabId() {
  return 1;
}
async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  events.invalidations.push({ step, options });
  const resets = getDownstreamStateResets(step, await getState());
  if (Object.keys(resets).length > 0) {
    await setState(resets);
  }
}
function cancelPendingCommands(reason = '') {
  events.cancellations.push(reason);
}
async function broadcastStopToContentScripts() {
  events.stopBroadcasts += 1;
}
function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}
function getErrorMessage(error) {
  return error?.message || String(error || '');
}
function isPhoneSmsPlatformRateLimitFailure(error) {
  const message = getErrorMessage(error);
  return /FIVE_SIM_RATE_LIMIT::|5sim[\s\S]*(?:限流|rate\s*limit)/i.test(message);
}
async function getLoginAuthStateFromContent() {
  return ${JSON.stringify(authState)};
}

${bundle}

return {
  async run() {
    await runAutoSequenceFromStep(${JSON.stringify(startStep)}, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
    });
    return events;
  },
  async runAndCaptureError() {
    try {
      await runAutoSequenceFromStep(${JSON.stringify(startStep)}, {
        targetRun: 1,
        totalRuns: 1,
        attemptRuns: 1,
        continued: false,
      });
      return null;
    } catch (error) {
      return { error, events };
    }
  },
  getEvents() {
    return events;
  },
  async setState(updates = {}) {
    await setState(updates);
    return getState();
  },
  async getState() {
    return getState();
  },
  async runWithContext(context = {}) {
    await runAutoSequenceFromStep(${JSON.stringify(startStep)}, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
      ...context,
    });
    return events;
  },
  async runWithContextAndCaptureError(context = {}) {
    try {
      await runAutoSequenceFromStep(${JSON.stringify(startStep)}, {
        targetRun: 1,
        totalRuns: 1,
        attemptRuns: 1,
        continued: false,
        ...context,
      });
      return null;
    } catch (error) {
      return { error, events };
    }
  },
};
`)();
}

test('auto-run keeps restarting from step 7 after post-login failures without a hard cap', async () => {
  const harness = createHarness({
    failureStep: 10,
    failureBudget: 6,
    failureMessage: '认证失败: Request failed with status code 502',
    authState: { state: 'password_page', url: 'https://auth.openai.com/log-in' },
  });

  const events = await harness.run();

  assert.equal(events.invalidations.length, 6);
  assert.deepStrictEqual(
    events.steps,
    [
      7, 8, 9, 10,
      7, 8, 9, 10,
      7, 8, 9, 10,
      7, 8, 9, 10,
      7, 8, 9, 10,
      7, 8, 9, 10,
      7, 8, 9, 10,
    ]
  );
  assert.ok(events.logs.some(({ message }) => /回到节点 oauth-login 重新开始授权流程/.test(message)));
});

test('auto-run restarts the current step after five minutes without new logs', async () => {
  const harness = createHarness({
    startStep: 10,
    failureStep: 0,
    hangStep: 10,
    hangBudget: 1,
    idleLogTimeoutMs: 20,
    idleLogCheckIntervalMs: 5,
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [10, 10]);
  assert.deepStrictEqual(events.invalidations.map((entry) => entry.step), [9]);
  assert.equal(events.cancellations.length, 1);
  assert.equal(events.stopBroadcasts, 1);
  assert.ok(events.logs.some(({ message }) => /5 分钟没有新日志，准备重新开始当前节点/.test(message)));
});

test('auto-run applies the idle-log restart watchdog to early steps too', async () => {
  const harness = createHarness({
    startStep: 2,
    failureStep: 0,
    hangStep: 2,
    hangBudget: 1,
    idleLogTimeoutMs: 20,
    idleLogCheckIntervalMs: 5,
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [2, 2, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepStrictEqual(events.invalidations.map((entry) => entry.step), [1]);
  assert.equal(events.cancellations.length, 1);
  assert.equal(events.stopBroadcasts, 1);
});

test('auto-run stops current-step idle restarts after the retry cap', async () => {
  const harness = createHarness({
    startStep: 10,
    failureStep: 0,
    hangStep: 10,
    hangBudget: 4,
    idleLogTimeoutMs: 20,
    idleLogCheckIntervalMs: 5,
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.match(result.error.message, /AUTO_RUN_STEP_IDLE_RESTART::节点 platform-verify/);
  assert.deepStrictEqual(result.events.steps, [10, 10, 10, 10]);
  assert.deepStrictEqual(result.events.invalidations.map((entry) => entry.step), [9, 9, 9]);
  assert.ok(result.events.logs.some(({ message }) => /已连续 3 次因 5 分钟无新日志而重开/.test(message)));
});

test('auto-run restarts email OAuth when an ordinary add-phone error is reported', async () => {
  const harness = createHarness({
    failureStep: 7,
    failureBudget: 1,
    failureMessage: '当前页面已进入手机号页面。URL: https://auth.openai.com/add-phone',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
  });

  const events = await harness.run();

  assert.equal(events.invalidations.length, 1);
  assert.deepStrictEqual(events.steps, [7, 7, 8, 9, 10]);
  assert.ok(events.logs.some(({ message }) => /回到节点 oauth-login 重新开始授权流程/.test(message)));
});

test('auto-run keeps a bare add-phone URL fatal for phone signup', async () => {
  const harness = createHarness({
    failureStep: 7,
    failureBudget: 1,
    failureMessage: 'https://auth.openai.com/add-phone',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
    customState: {
      signupMethod: 'phone',
      resolvedSignupMethod: 'phone',
    },
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.equal(result.events.invalidations.length, 0);
  assert.deepStrictEqual(result.events.steps, [7]);
  assert.ok(result.events.logs.some(({ message }) => /检测到认证流程进入 add-phone/.test(message)));
});

test('auto-run honors explicit STEP8_RESTART_STEP7 regardless of add-phone page state', async () => {
  const harness = createHarness({
    failureStep: 9,
    failureBudget: 1,
    failureMessage: 'STEP8_RESTART_STEP7::步骤 9：认证页进入错误/超时状态，请回到步骤 7 重新开始。URL: https://auth.openai.com/add-phone',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [7, 8, 9, 7, 8, 9, 10]);
  assert.equal(events.invalidations.length, 1);
  assert.ok(events.logs.some(({ message }) => /回到节点 oauth-login 重新开始授权流程/.test(message)));
});

test('auto-run restarts email OAuth on generic phone-page failure messages without add-phone url', async () => {
  const harness = createHarness({
    failureStep: 9,
    failureBudget: 1,
    failureMessage: '步骤 8：当前认证页进入手机号页面，当前流程无法继续自动授权。',
    authState: { state: 'password_page', url: 'https://auth.openai.com/log-in' },
  });

  const events = await harness.run();

  assert.equal(events.invalidations.length, 1);
  assert.deepStrictEqual(events.steps, [7, 8, 9, 7, 8, 9, 10]);
  assert.ok(events.logs.some(({ message }) => /回到节点 oauth-login 重新开始授权流程/.test(message)));
});

test('auto-run does not restart step 7 when phone verification exhausted replacement attempts in add-phone flow', async () => {
  const harness = createHarness({
    failureStep: 9,
    failureBudget: 1,
    failureMessage: 'Step 9: phone verification did not succeed after 3 number replacements. Last reason: sms_timeout_after_resend.',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.equal(result.events.invalidations.length, 0);
  assert.deepStrictEqual(result.events.steps, [7, 8, 9]);
  assert.ok(!result.events.logs.some(({ message }) => /回到步骤 7 重新开始授权流程/.test(message)));
});

test('auto-run does not apply the email-mode restart cap to phone-signup bound-email verification', async () => {
  const emailBoundSteps = {
    10: { key: 'oauth-login' },
    11: { key: 'fetch-login-code' },
    12: { key: 'bind-email' },
    13: { key: 'fetch-bind-email-code' },
    14: { key: 'relogin-bound-email' },
    15: { key: 'fetch-bound-email-login-code' },
    16: { key: 'post-bound-email-phone-verification' },
    17: { key: 'confirm-oauth' },
    18: { key: 'platform-verify' },
  };
  const harness = createHarness({
    startStep: 10,
    failureStep: 16,
    failureBudget: 1,
    failureMessage: '步骤 13：手机号验证失败，当前号码不可用。',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
    stepDefinitions: emailBoundSteps,
    finalOAuthChainStartStep: 10,
    customState: {
      stepStatuses: { 3: 'completed' },
      signupMethod: 'phone',
      resolvedSignupMethod: 'phone',
    },
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.deepStrictEqual(result.events.steps, [10, 11, 12, 13, 14, 15, 16]);
  assert.equal(result.events.invalidations.length, 0);
  assert.ok(result.events.logs.some(({ message }) => /检测到认证流程进入 add-phone/.test(message)));
  assert.ok(!result.events.logs.some(({ message }) => /重新开始授权流程（第 1\/5 次重开）/.test(message)));
});

test('auto-run does not count phone-signup bound-email verification failures against the email restart cap', async () => {
  const emailBoundSteps = {
    10: { key: 'oauth-login' },
    11: { key: 'fetch-login-code' },
    12: { key: 'bind-email' },
    13: { key: 'fetch-bind-email-code' },
    14: { key: 'relogin-bound-email' },
    15: { key: 'fetch-bound-email-login-code' },
    16: { key: 'post-bound-email-phone-verification' },
    17: { key: 'confirm-oauth' },
    18: { key: 'platform-verify' },
  };
  const harness = createHarness({
    startStep: 10,
    failureStep: 16,
    failureBudget: 6,
    failureMessage: '步骤 13：手机号验证失败，当前号码不可用。',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
    stepDefinitions: emailBoundSteps,
    finalOAuthChainStartStep: 10,
    customState: {
      stepStatuses: { 3: 'completed' },
      signupMethod: 'phone',
      resolvedSignupMethod: 'phone',
    },
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.equal(result.events.invalidations.length, 0);
  assert.ok(!result.events.logs.some(({ message }) => /已自动重新开始 5 次/.test(message)));
});


test('auto-run post-login restart decision does not treat 5sim rate limit on add-phone page as add-phone fatal', async () => {
  const harness = createHarness({
    failureStep: 9,
    failureBudget: 1,
    failureMessage: 'FIVE_SIM_RATE_LIMIT::5sim 购买接口触发限流，请稍后再试：印度 (India): rate limit。',
    authState: { state: 'add_phone_page', url: 'https://auth.openai.com/add-phone' },
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.equal(result.events.invalidations.length, 0);
  assert.deepStrictEqual(result.events.steps, [7, 8, 9]);
  assert.ok(!result.events.logs.some(({ message }) => /进入 add-phone/.test(message)));
  assert.ok(!result.events.logs.some(({ message }) => /回到步骤 7 重新开始授权流程/.test(message)));
});

test('auto-run stop errors after step 7 are rethrown immediately instead of restarting', async () => {
  const harness = createHarness({
    failureStep: 9,
    failureBudget: 1,
    failureMessage: '流程已被用户停止。',
    authState: { state: 'password_page', url: 'https://auth.openai.com/log-in' },
  });

  const result = await harness.runAndCaptureError();

  assert.equal(result?.error?.message, '流程已被用户停止。');
  assert.equal(result.events.invalidations.length, 0);
  assert.deepStrictEqual(result.events.steps, [7, 8, 9]);
  assert.ok(!result.events.logs.some(({ message }) => /回到步骤 7 重新开始授权流程/.test(message)));
});

test('auto-run restarts from confirm-oauth step after transient step10 token_exchange_user_error', async () => {
  const harness = createHarness({
    failureStep: 10,
    failureBudget: 1,
    failureMessage: 'token exchange failed: status 400, body: { "error": { "message": "Invalid request. Please try again later.", "type": "invalid_request_error", "param": null, "code": "token_exchange_user_error" } }',
    authState: { state: 'oauth_consent_page', url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent' },
    customState: {
      panelMode: 'sub2api',
      stepStatuses: { 3: 'completed' },
      stepsVersion: 'ultra2.0',
      visibleStep: 10,
      accountContributionEnabled: false,
    },
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [7, 8, 9, 10, 9, 10]);
  assert.equal(events.invalidations.length, 1);
  assert.deepStrictEqual(events.invalidations[0], {
    step: 8,
    options: {
      logLabel: '节点 platform-verify 报错后准备回到 confirm-oauth 重试（第 1 次重开）',
    },
  });
  assert.ok(events.logs.some(({ message }) => /回到节点 confirm-oauth 重新开始授权流程/.test(message)));
});

test('auto-run restarts SUB2API expired oauth session from oauth-login and clears stale session state', async () => {
  const harness = createHarness({
    failureStep: 10,
    failureBudget: 1,
    failureMessage: 'session not found or expired',
    authState: { state: 'oauth_consent_page', url: 'https://auth.openai.com/sign-in-with-chatgpt/codex/consent' },
    customState: {
      panelMode: 'sub2api',
      stepStatuses: { 3: 'completed' },
      stepsVersion: 'ultra2.0',
      visibleStep: 10,
      sub2apiSessionId: 'expired-session',
      sub2apiOAuthState: 'expired-state',
      sub2apiGroupId: 5,
      sub2apiGroupIds: [5],
      sub2apiDraftName: 'draft',
      sub2apiProxyId: 7,
      accountContributionEnabled: false,
    },
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [7, 8, 9, 10, 7, 8, 9, 10]);
  assert.equal(events.invalidations.length, 1);
  assert.deepStrictEqual(events.invalidations[0], {
    step: 6,
    options: {
      logLabel: '节点 platform-verify 报错后准备回到 oauth-login 重试（第 1 次重开）',
    },
  });
  const resetPatch = events.stateUpdates.find((updates) => updates.sub2apiSessionId === null);
  assert.ok(resetPatch, 'expected oauth-login restart to clear stale SUB2API OAuth runtime');
  assert.equal(resetPatch.sub2apiOAuthState, null);
  assert.equal(resetPatch.sub2apiGroupId, null);
  assert.deepStrictEqual(resetPatch.sub2apiGroupIds, []);
  assert.equal(resetPatch.sub2apiDraftName, null);
  assert.equal(resetPatch.sub2apiProxyId, null);
  assert.ok(events.logs.some(({ message }) => /回到节点 oauth-login 重新开始授权流程/.test(message)));
});

test('auto-run restarts Plus checkout from step 6 when checkout creation fails', async () => {
  const plusPaypalSteps = {
    6: { key: 'plus-checkout-create' },
    7: { key: 'plus-checkout-billing' },
    8: { key: 'paypal-approve' },
    9: { key: 'plus-checkout-return' },
    10: { key: 'oauth-login' },
    11: { key: 'fetch-login-code' },
    12: { key: 'confirm-oauth' },
    13: { key: 'platform-verify' },
  };
  const harness = createHarness({
    startStep: 6,
    failureStep: 6,
    failureBudget: 1,
    failureMessage: '步骤 6：创建 Plus Checkout 失败：checkout request failed',
    stepDefinitions: plusPaypalSteps,
    finalOAuthChainStartStep: 10,
    customState: {
      stepStatuses: { 3: 'completed' },
      plusModeEnabled: true,
      plusPaymentMethod: 'paypal',
    },
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [6, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepStrictEqual(events.invalidations.map((entry) => entry.step), [5]);
  assert.ok(events.logs.some(({ message }) => /回到节点 plus-checkout-create 重新创建 Plus Checkout/.test(message)));
});

test('auto-run restarts Plus checkout from step 6 when billing fails for non-free-trial reasons', async () => {
  const plusPaypalSteps = {
    6: { key: 'plus-checkout-create' },
    7: { key: 'plus-checkout-billing' },
    8: { key: 'paypal-approve' },
    9: { key: 'plus-checkout-return' },
    10: { key: 'oauth-login' },
    11: { key: 'fetch-login-code' },
    12: { key: 'confirm-oauth' },
    13: { key: 'platform-verify' },
  };
  const harness = createHarness({
    startStep: 6,
    failureStep: 7,
    failureBudget: 1,
    failureMessage: '步骤 7：账单地址 iframe 无法注入，请重新创建 checkout。',
    stepDefinitions: plusPaypalSteps,
    finalOAuthChainStartStep: 10,
    customState: {
      stepStatuses: { 3: 'completed' },
      plusModeEnabled: true,
      plusPaymentMethod: 'paypal',
    },
  });

  const events = await harness.run();

  assert.deepStrictEqual(events.steps, [6, 7, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepStrictEqual(events.invalidations.map((entry) => entry.step), [5]);
  assert.ok(events.logs.some(({ message }) => /回到节点 plus-checkout-create 重新创建 Plus Checkout/.test(message)));
});

test('auto-run does not reroute SUB2API session import failures into OAuth restarts', async () => {
  const sessionDeliverySteps = {
    1: { key: 'open-chatgpt' },
    2: { key: 'submit-signup-email' },
    3: { key: 'fill-password' },
    4: { key: 'fetch-signup-code' },
    5: { key: 'fill-profile' },
    6: { key: 'wait-registration-success' },
    7: { key: 'sub2api-session-import' },
  };
  const harness = createHarness({
    startStep: 7,
    failureStep: 7,
    failureBudget: 1,
    failureMessage: '步骤 7：当前页面未读取到有效的 ChatGPT session。',
    stepDefinitions: sessionDeliverySteps,
    finalOAuthChainStartStep: 7,
    customState: {
      stepStatuses: {
        1: 'completed',
        2: 'completed',
        3: 'completed',
        4: 'completed',
        5: 'completed',
        6: 'completed',
      },
      plusModeEnabled: false,
      plusPaymentMethod: 'paypal',
      targetId: 'sub2api',
      accountDeliveryMode: 'session',
      accountDeliveryRouteId: 'sub2api-session',
    },
  });

  const result = await harness.runAndCaptureError();

  assert.ok(result?.error);
  assert.match(result.error.message, /未读取到有效的 ChatGPT session/);
  assert.deepStrictEqual(result.events.steps, [7]);
  assert.equal(result.events.invalidations.length, 0);
  assert.ok(!result.events.logs.some(({ message }) => /回到节点 oauth-login|回到节点 confirm-oauth|重新开始授权流程/.test(message)));
});
