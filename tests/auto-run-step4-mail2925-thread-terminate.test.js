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

test('auto-run stops step4 restart path when mail2925 ends the current thread', async () => {
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
  email: 'demo123456@2925.com',
  password: 'Secret123!',
  mailProvider: '2925',
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
  return false;
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

async function executeStepAndWait(step) {
  events.steps.push(step);
  if (step === 4) {
    throw new Error('MAIL2925_THREAD_TERMINATED::步骤 4：2925 已切换账号并要求结束当前尝试。');
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

  assert.match(result.error, /^MAIL2925_THREAD_TERMINATED::/);
  assert.deepStrictEqual(result.events.invalidations, []);
  assert.deepStrictEqual(result.events.steps, [1, 2, 3, 4]);
  assert.equal(result.events.logs.some(({ message }) => /回到步骤 1/.test(message)), false);
});
