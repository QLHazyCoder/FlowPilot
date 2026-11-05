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
function getNodeIdByStepForState(step) {
  return STEP_NODE_IDS[Number(step)] || '';
}
function getStepIdByNodeIdForState(nodeId) {
  return NODE_STEP_IDS[String(nodeId || '').trim()] || null;
}
function getNodeIdsForState() {
  return Object.keys(STEP_NODE_IDS)
    .map(Number)
    .sort((left, right) => left - right)
    .map((step) => STEP_NODE_IDS[step])
    .filter(Boolean);
}
function getNodeDefinitionForState(nodeId) {
  const normalizedNodeId = String(nodeId || '').trim();
  return normalizedNodeId ? { nodeId: normalizedNodeId, executeKey: normalizedNodeId } : null;
}
function getNodeTitleForState(nodeId) {
  return String(nodeId || '').trim();
}
function projectStepStatusesToNodeStatuses(stepStatuses = {}) {
  const nodeStatuses = {};
  for (const [step, status] of Object.entries(stepStatuses || {})) {
    const nodeId = getNodeIdByStepForState(step);
    if (nodeId) nodeStatuses[nodeId] = status;
  }
  return nodeStatuses;
}
function projectNodeStatusesToStepStatuses(nodeStatuses = {}) {
  const stepStatuses = {};
  for (const [nodeId, status] of Object.entries(nodeStatuses || {})) {
    const step = getStepIdByNodeIdForState(nodeId);
    if (step) stepStatuses[step] = status;
  }
  return stepStatuses;
}
const rawGetStateForNodeCompat = getState;
getState = async function getStateWithNodeStatuses() {
  const state = await rawGetStateForNodeCompat();
  return {
    ...state,
    nodeStatuses: {
      ...projectStepStatusesToNodeStatuses(state?.stepStatuses || {}),
      ...(state?.nodeStatuses || {}),
    },
  };
};
const rawSetStateForNodeCompat = setState;
setState = async function setStateWithNodeStatuses(updates = {}) {
  const stepStatusUpdates = updates?.nodeStatuses
    ? projectNodeStatusesToStepStatuses(updates.nodeStatuses)
    : {};
  return rawSetStateForNodeCompat({
    ...updates,
    ...(Object.keys(stepStatusUpdates).length ? {
      stepStatuses: {
        ...stepStatusUpdates,
        ...(updates.stepStatuses || {}),
      },
    } : {}),
  });
};
async function executeNodeAndWait(nodeId, delayAfter) {
  const directStep = Number(nodeId);
  if (Number.isInteger(directStep) && directStep > 0) {
    return executeStepAndWait(directStep, delayAfter);
  }
  return executeStepAndWait(getStepIdByNodeIdForState(nodeId), delayAfter);
}
function getAutoRunNodeDelayMs() {
  return 0;
}
async function runAutoSequenceFromStep(step, context = {}) {
  return runAutoSequenceFromNode(getNodeIdByStepForState(step), context);
}
`;

const bundle = [
  'const AUTO_RUN_STEP_IDLE_LOG_TIMEOUT_MS = 300000;',
  'const AUTO_RUN_STEP_IDLE_LOG_CHECK_INTERVAL_MS = 5000;',
  'const AUTO_RUN_STEP_IDLE_RESTART_MAX_ATTEMPTS = 3;',
  "const AUTO_RUN_STEP_IDLE_RESTART_ERROR_PREFIX = 'AUTO_RUN_STEP_IDLE_RESTART::';",
  extractFunction('isAddPhoneAuthUrl'),
  extractFunction('isAddPhoneAuthState'),
  extractFunction('isMail2925ThreadTerminatedError'),
  extractFunction('isSignupPhonePasswordMismatchFailure'),
  extractFunction('getSignupPhonePasswordMismatchRestartPayload'),
  extractFunction('restartSignupPhonePasswordMismatchAttemptFromNode'),
  extractFunction('isSignupAccountDeactivatedFailure'),
  extractFunction('isSignupUserAlreadyExistsFailure'),
  extractFunction('isPlusCheckoutNonFreeTrialFailure'),
  extractFunction('isPlusCheckoutRestartStep'),
  extractFunction('isPlusCheckoutRestartRequiredFailure'),
  extractFunction('getLatestLogTimestamp'),
  extractFunction('buildAutoRunNodeIdleRestartError'),
  extractFunction('isAutoRunStepIdleRestartError'),
  extractFunction('startAutoRunNodeIdleLogWatchdog'),
  extractFunction('runAutoNodeActionWithIdleLogWatchdog'),
  extractFunction('executeNodeAndWaitWithAutoRunIdleLogWatchdog'),
  extractFunction('getPostStep6AutoRestartDecision'),
  NODE_COMPAT_HELPERS,
  extractFunction('getAutoRunWorkflowNodeIds'),
  extractFunction('runAutoSequenceFromNode'),
  extractFunction('runAutoSequenceFromNodeGraph'),
].join('\n');

test('auto-run restarts from step 1 with the same email after step 4 failure', async () => {
  const api = new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const chrome = {
  tabs: {
    update: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
  },
};

let remainingFailures = 1;
  let currentState = {
    email: 'keep@example.com',
    password: 'Secret123!',
    mailProvider: '163',
    stepStatuses: {
      1: 'pending',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
    7: 'pending',
    8: 'pending',
    9: 'pending',
    10: 'pending',
  },
};
const events = {
  steps: [],
  emails: [],
  invalidations: [],
  logs: [],
  setStateCalls: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}

async function ensureAutoEmailReady() {
  events.emails.push(currentState.email);
  return currentState.email;
}

async function broadcastAutoRunStatus() {}
async function ensureResolvedSignupMethodForRun() { return 'email'; }

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
  events.setStateCalls.push(updates);
}

function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 4 && remainingFailures > 0) {
    remainingFailures -= 1;
    throw new Error('步骤 4 提交验证码前页面异常。');
  }
}

async function getTabId() {
  return 1;
}


async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  events.invalidations.push({ step, options });
  currentState = {
    ...currentState,
    password: null,
    stepStatuses: {
      1: currentState.stepStatuses[1] || 'completed',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
}

function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getLoginAuthStateFromContent() {
  return { state: 'password_page', url: 'https://auth.openai.com/log-in' };
}

${bundle}

return {
  async run() {
    await runAutoSequenceFromStep(1, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
    });
    return { events, currentState };
  },
};
`)();

  const { events, currentState } = await api.run();

  assert.deepStrictEqual(events.invalidations, [
    {
      step: 1,
      options: {
        logLabel: '节点 fetch-signup-code 报错后准备回到 open-chatgpt 沿用当前邮箱重试（第 1 次重开）',
      },
    },
  ]);
  assert.deepStrictEqual(events.emails, ['keep@example.com', 'keep@example.com']);
  assert.deepStrictEqual(events.steps, [1, 2, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(currentState.email, 'keep@example.com');
  assert.equal(currentState.password, 'Secret123!');
  assert.equal(events.logs.some(({ message }) => /沿用当前邮箱回到节点 open-chatgpt 重新开始/.test(message)), true);
});

test('auto-run does not restart step 4 current attempt when user_already_exists is detected', async () => {
  const api = new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const chrome = {
  tabs: {
    update: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
  },
};

let currentState = {
  email: 'existing@example.com',
  password: 'Secret123!',
  mailProvider: '163',
  stepStatuses: {
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending',
    5: 'pending',
    6: 'pending',
    7: 'pending',
    8: 'pending',
    9: 'pending',
    10: 'pending',
  },
};
const events = {
  steps: [],
  invalidations: [],
  logs: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}

async function ensureAutoEmailReady() {
  return currentState.email;
}

async function broadcastAutoRunStatus() {}
async function ensureResolvedSignupMethodForRun() { return 'email'; }

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
}

function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 4) {
    throw new Error('SIGNUP_USER_ALREADY_EXISTS::步骤 4：检测到 user_already_exists，说明当前用户已存在，当前轮将直接停止。');
  }
}

async function getTabId() {
  return 1;
}

async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  events.invalidations.push({ step, options });
}

function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getLoginAuthStateFromContent() {
  return { state: 'password_page', url: 'https://auth.openai.com/log-in' };
}

${bundle}

return {
  async run() {
    try {
      await runAutoSequenceFromStep(1, {
        targetRun: 1,
        totalRuns: 1,
        attemptRuns: 1,
        continued: false,
      });
      return { events, currentState, error: null };
    } catch (error) {
      return { events, currentState, error: error.message };
    }
  },
};
`)();

  const result = await api.run();

  assert.match(result.error, /SIGNUP_USER_ALREADY_EXISTS::/);
  assert.deepStrictEqual(result.events.invalidations, []);
  assert.deepStrictEqual(result.events.steps, [1, 2, 3, 4]);
  assert.equal(result.events.logs.some(({ message }) => /沿用当前邮箱回到节点 open-chatgpt 重新开始/.test(message)), false);
});

test('auto-run skips steps 4/5 when step 2 has already marked registration chain as skipped', async () => {
  const api = new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const chrome = {
  tabs: {
    update: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
  },
};

let currentState = {
  email: 'already@login.example',
  password: 'Secret123!',
  mailProvider: 'icloud',
  stepStatuses: {
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending',
    5: 'pending',
    6: 'pending',
    7: 'pending',
    8: 'pending',
    9: 'pending',
    10: 'pending',
  },
};
const events = {
  steps: [],
  logs: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}

async function ensureAutoEmailReady() {
  return currentState.email;
}

async function broadcastAutoRunStatus() {}
async function ensureResolvedSignupMethodForRun() { return 'email'; }

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
}

function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 2) {
    currentState = {
      ...currentState,
      stepStatuses: {
        ...currentState.stepStatuses,
        3: 'skipped',
        4: 'skipped',
        5: 'skipped',
      },
    };
  }
}

async function getTabId() {
  return 1;
}

async function invalidateDownstreamAfterStepRestart() {}

function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getLoginAuthStateFromContent() {
  return { state: 'password_page', url: 'https://auth.openai.com/log-in' };
}

${bundle}

return {
  async run() {
    await runAutoSequenceFromStep(1, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
    });
    return { events, currentState };
  },
};
`)();

  const { events } = await api.run();

  assert.deepStrictEqual(events.steps, [1, 2, 6, 7, 8, 9, 10]);
  assert.equal(events.logs.some(({ message }) => /节点 fetch-signup-code 当前状态为 skipped/.test(message)), true);
  assert.equal(events.logs.some(({ message }) => /节点 fill-profile 当前状态为 skipped/.test(message)), true);
});

test('auto-run clears fetched signup phone state before restarting when step 4 detects phone/password mismatch', async () => {
  const api = new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const chrome = {
  tabs: {
    update: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
  },
};

let remainingFailures = 1;
let currentState = {
  email: '',
  password: 'Secret123!',
  signupMethod: 'phone',
  accountIdentifierType: 'phone',
  accountIdentifier: '+56988841722',
  signupPhoneNumber: '+56988841722',
  signupPhoneActivation: {
    activationId: 'act-1',
    phoneNumber: '+56988841722',
  },
  signupPhoneCompletedActivation: {
    activationId: 'act-1',
    phoneNumber: '+56988841722',
  },
  stepStatuses: {
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending',
    5: 'pending',
    6: 'pending',
    7: 'pending',
    8: 'pending',
    9: 'pending',
    10: 'pending',
  },
};
const events = {
  steps: [],
  invalidations: [],
  logs: [],
  setStateCalls: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}

async function ensureAutoEmailReady() {
  return '';
}

async function broadcastAutoRunStatus() {}
async function ensureResolvedSignupMethodForRun() { return 'phone'; }

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
  events.setStateCalls.push(updates);
}

function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 4 && remainingFailures > 0) {
    remainingFailures -= 1;
    throw new Error('SIGNUP_PHONE_PASSWORD_MISMATCH::步骤 3：检测到注册手机号或密码不正确，需要重新开始当前轮。页面提示：Incorrect phone number or password');
  }
}

async function getTabId() {
  return 1;
}

async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  events.invalidations.push({ step, options });
  currentState = {
    ...currentState,
    password: null,
    stepStatuses: {
      1: currentState.stepStatuses[1] || 'completed',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
}

function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getLoginAuthStateFromContent() {
  return { state: 'password_page', url: 'https://auth.openai.com/log-in' };
}

${bundle}

return {
  async run() {
    await runAutoSequenceFromStep(1, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
    });
    return { events, currentState };
  },
};
`)();

  const { events, currentState } = await api.run();

  assert.deepStrictEqual(events.invalidations, [
    {
      step: 1,
      options: {
        logLabel: '节点 fetch-signup-code 检测到手机号/密码不匹配后准备回到 open-chatgpt 重新获取手机号重试（第 1 次重开）',
      },
    },
  ]);
  assert.equal(currentState.signupPhoneNumber, '');
  assert.equal(currentState.signupPhoneActivation, null);
  assert.equal(currentState.signupPhoneCompletedActivation, null);
  assert.equal(currentState.accountIdentifierType, null);
  assert.equal(currentState.accountIdentifier, '');
  assert.equal(currentState.password, 'Secret123!');
  assert.equal(events.logs.some(({ message }) => /丢弃当前注册手机号并回到节点 open-chatgpt 重新开始/.test(message)), true);
  assert.equal(events.logs.some(({ message }) => /已清空本轮注册手机号与接码订单/.test(message)), true);
});

test('auto-run clears fetched signup phone state before restarting when step 4 cannot send text to this phone number', async () => {
  const api = new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const chrome = {
  tabs: {
    update: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
  },
};

let remainingFailures = 1;
let currentState = {
  email: '',
  password: 'Secret123!',
  signupMethod: 'phone',
  accountIdentifierType: 'phone',
  accountIdentifier: '+56988841722',
  signupPhoneNumber: '+56988841722',
  signupPhoneActivation: { activationId: 'signup-activation', phoneNumber: '+56988841722' },
  signupPhoneCompletedActivation: { activationId: 'signup-completed', phoneNumber: '+56988841722' },
  signupPhoneVerificationRequestedAt: 123456,
  signupPhoneVerificationPurpose: 'signup',
  stepStatuses: {
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending',
    5: 'pending',
    6: 'pending',
    7: 'pending',
    8: 'pending',
    9: 'pending',
    10: 'pending',
  },
};
const events = {
  steps: [],
  invalidations: [],
  logs: [],
  setStateCalls: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}

async function ensureAutoEmailReady() {
  return '';
}

async function broadcastAutoRunStatus() {}
async function ensureResolvedSignupMethodForRun() { return 'phone'; }

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
  events.setStateCalls.push(updates);
}

function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 4 && remainingFailures > 0) {
    remainingFailures -= 1;
    throw new Error('PHONE_RESEND_BANNED_NUMBER::Unable to send a text message to this phone number');
  }
}

async function getTabId() {
  return 1;
}

async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  events.invalidations.push({ step, options });
  currentState = {
    ...currentState,
    password: null,
    stepStatuses: {
      1: currentState.stepStatuses[1] || 'completed',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
}

function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

const phoneVerificationHelpers = {
  isPhoneResendBannedNumberError(error) {
    return String(error?.message || error || '').startsWith('PHONE_RESEND_BANNED_NUMBER::');
  },
};

async function getLoginAuthStateFromContent() {
  return { state: 'password_page', url: 'https://auth.openai.com/log-in' };
}

${bundle}

return {
  async run() {
    await runAutoSequenceFromStep(1, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
    });
    return { events, currentState };
  },
};
`)();

  const { events, currentState } = await api.run();

  assert.deepStrictEqual(events.invalidations, [
    {
      step: 1,
      options: {
        logLabel: '节点 fetch-signup-code 检测到当前注册手机号无法接收短信后准备回到 open-chatgpt 重新获取手机号重试（第 1 次重开）',
      },
    },
  ]);
  assert.equal(currentState.signupPhoneNumber, '');
  assert.equal(currentState.signupPhoneActivation, null);
  assert.equal(currentState.signupPhoneCompletedActivation, null);
  assert.equal(currentState.accountIdentifierType, null);
  assert.equal(currentState.accountIdentifier, '');
  assert.equal(currentState.password, 'Secret123!');
  assert.equal(events.logs.some(({ message }) => /丢弃当前注册手机号并回到节点 open-chatgpt 重新开始/.test(message)), true);
  assert.equal(events.logs.some(({ message }) => /已清空本轮注册手机号与接码订单/.test(message)), true);
});

test('auto-run clears manual signup phone state when step 3 detects phone/password mismatch', async () => {
  const api = new Function(`
const AUTO_STEP_DELAYS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
const LAST_STEP_ID = 10;
const FINAL_OAUTH_CHAIN_START_STEP = 7;
const SIGNUP_METHOD_PHONE = 'phone';
const chrome = {
  tabs: {
    update: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
  },
};

let remainingFailures = 1;
let currentState = {
  email: '',
  password: 'Secret123!',
  signupMethod: 'phone',
  accountIdentifierType: 'phone',
  accountIdentifier: '+56988841722',
  signupPhoneNumber: '+56988841722',
  signupPhoneActivation: null,
  signupPhoneCompletedActivation: null,
  stepStatuses: {
    1: 'pending',
    2: 'pending',
    3: 'pending',
    4: 'pending',
    5: 'pending',
    6: 'pending',
    7: 'pending',
    8: 'pending',
    9: 'pending',
    10: 'pending',
  },
};
const events = {
  steps: [],
  invalidations: [],
  logs: [],
  setStateCalls: [],
};

async function addLog(message, level = 'info') {
  events.logs.push({ message, level });
}

async function ensureAutoEmailReady() {
  return '';
}

async function broadcastAutoRunStatus() {}
async function ensureResolvedSignupMethodForRun() { return 'phone'; }

async function getState() {
  return currentState;
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
  };
  events.setStateCalls.push(updates);
}

function isStopError(error) {
  return (error?.message || String(error || '')) === '流程已被用户停止。';
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 3 && remainingFailures > 0) {
    remainingFailures -= 1;
    throw new Error('SIGNUP_PHONE_PASSWORD_MISMATCH::步骤 3：检测到注册手机号或密码不正确，需要重新开始当前轮。页面提示：Incorrect phone number or password');
  }
}

async function getTabId() {
  return 1;
}

async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  events.invalidations.push({ step, options });
  currentState = {
    ...currentState,
    password: null,
    stepStatuses: {
      1: currentState.stepStatuses[1] || 'completed',
      2: 'pending',
      3: 'pending',
      4: 'pending',
      5: 'pending',
      6: 'pending',
      7: 'pending',
      8: 'pending',
      9: 'pending',
      10: 'pending',
    },
  };
}

function getLoginAuthStateLabel(state) {
  return state || 'unknown';
}

function getErrorMessage(error) {
  return error?.message || String(error || '');
}

async function getLoginAuthStateFromContent() {
  return { state: 'password_page', url: 'https://auth.openai.com/log-in' };
}

${bundle}

return {
  async run() {
    await runAutoSequenceFromStep(1, {
      targetRun: 1,
      totalRuns: 1,
      attemptRuns: 1,
      continued: false,
    });
    return { events, currentState };
  },
};
`)();

  const { events, currentState } = await api.run();

  assert.deepStrictEqual(events.steps, [1, 2, 3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepStrictEqual(events.invalidations, [
    {
      step: 1,
      options: {
        logLabel: '节点 fill-password 检测到手机号/密码不匹配后准备回到 open-chatgpt 重新获取手机号重试（第 1 次重开）',
      },
    },
  ]);
  assert.equal(currentState.signupPhoneNumber, '');
  assert.equal(currentState.signupPhoneActivation, null);
  assert.equal(currentState.signupPhoneCompletedActivation, null);
  assert.equal(currentState.accountIdentifierType, null);
  assert.equal(currentState.accountIdentifier, '');
  assert.equal(currentState.password, 'Secret123!');
  assert.equal(events.logs.some(({ message }) => /节点 fill-password：检测到手机号\/密码不匹配/.test(message)), true);
  assert.equal(events.logs.some(({ message }) => /节点 fill-password：已清空本轮注册手机号与接码订单/.test(message)), true);
});
