const assert = require('assert');
const fs = require('fs');

const helperSource = fs.readFileSync('background.js', 'utf8');
const autoRunModuleSource = fs.readFileSync('background/auto-run-controller.js', 'utf8');

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map(marker => source.indexOf(marker))
    .find(index => index >= 0);
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

const helperBundle = [
  extractFunction(helperSource, 'clearStopRequest'),
  extractFunction(helperSource, 'normalizeAutoRunSessionId'),
  extractFunction(helperSource, 'throwIfStopped'),
  extractFunction(helperSource, 'isStopError'),
  extractFunction(helperSource, 'isStepDoneStatus'),
  extractFunction(helperSource, 'isRestartCurrentAttemptError'),
  extractFunction(helperSource, 'getFirstUnfinishedStep'),
  extractFunction(helperSource, 'hasSavedProgress'),
  extractFunction(helperSource, 'getRunningSteps'),
  extractFunction(helperSource, 'getAutoRunStatusPayload'),
].join('\n');

const api = new Function('autoRunModuleSource', `
const self = {};
const STOP_ERROR_MESSAGE = 'Flow stopped.';
const AUTO_RUN_MAX_RETRIES_PER_ROUND = 3;
const AUTO_RUN_RETRY_DELAY_MS = 3000;
const AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS = 'between_rounds';
const AUTO_RUN_TIMER_KIND_BEFORE_RETRY = 'before_retry';
const STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
function projectStepStatusesToNodeStatuses(stepStatuses = {}) {
  const nodeStatuses = {};
  for (const [step, status] of Object.entries(stepStatuses || {})) {
    const nodeId = getNodeIdByStepForState(step);
    if (nodeId) nodeStatuses[nodeId] = status;
  }
  return nodeStatuses;
}
const DEFAULT_STATE = {
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
DEFAULT_STATE.nodeStatuses = projectStepStatusesToNodeStatuses(DEFAULT_STATE.stepStatuses);

let stopRequested = false;
let runCalls = 0;
let autoRunSessionId = 0;
let autoRunSessionSeed = 1000;

const logs = [];
const broadcasts = [];
let currentState = {
  ...DEFAULT_STATE,
  stepStatuses: { ...DEFAULT_STATE.stepStatuses },
  vpsUrl: 'https://example.com/vps',
  vpsPassword: 'secret',
  customPassword: '',
  autoRunSkipFailures: false,
  autoRunFallbackThreadIntervalMinutes: 0,
  autoStepDelaySeconds: null,
  signupMethod: 'phone',
  resolvedSignupMethod: 'phone',
  accountIdentifierType: 'phone',
  accountIdentifier: '+6612345',
  signupPhoneNumber: '+6612345',
  signupPhoneActivation: { activationId: 'signup-activation', phoneNumber: '+6612345' },
  signupPhoneCompletedActivation: { activationId: 'signup-completed', phoneNumber: '+6612345' },
  signupPhoneVerificationRequestedAt: 123456,
  signupPhoneVerificationPurpose: 'signup',
  mailProvider: '163',
  emailGenerator: 'duck',
  gmailBaseEmail: 'demo@gmail.com',
  mail2925BaseEmail: 'demo@2925.com',
  emailPrefix: 'demo',
  inbucketHost: '',
  inbucketMailbox: '',
  cloudflareDomain: '',
  cloudflareDomains: [],
  reusablePhoneActivation: {
    activationId: '123456',
    phoneNumber: '66959916439',
    successfulUses: 1,
    maxUses: 3,
  },
  tabRegistry: {},
  sourceLastUrls: {},
};

async function getState() {
  return {
    ...currentState,
    stepStatuses: { ...(currentState.stepStatuses || {}) },
    nodeStatuses: {
      ...projectStepStatusesToNodeStatuses(currentState.stepStatuses || {}),
      ...(currentState.nodeStatuses || {}),
    },
    tabRegistry: { ...(currentState.tabRegistry || {}) },
    sourceLastUrls: { ...(currentState.sourceLastUrls || {}) },
  };
}

async function setState(updates) {
  currentState = {
    ...currentState,
    ...updates,
    stepStatuses: updates.stepStatuses
      ? { ...updates.stepStatuses }
      : currentState.stepStatuses,
    nodeStatuses: updates.nodeStatuses
      ? { ...updates.nodeStatuses }
      : currentState.nodeStatuses,
    tabRegistry: updates.tabRegistry
      ? { ...updates.tabRegistry }
      : currentState.tabRegistry,
    sourceLastUrls: updates.sourceLastUrls
      ? { ...updates.sourceLastUrls }
      : currentState.sourceLastUrls,
  };
}

async function resetState() {
  const prev = await getState();
  currentState = {
    ...DEFAULT_STATE,
    stepStatuses: { ...DEFAULT_STATE.stepStatuses },
    nodeStatuses: { ...DEFAULT_STATE.nodeStatuses },
    vpsUrl: prev.vpsUrl,
    vpsPassword: prev.vpsPassword,
    customPassword: prev.customPassword,
    autoRunSkipFailures: prev.autoRunSkipFailures,
    autoRunFallbackThreadIntervalMinutes: prev.autoRunFallbackThreadIntervalMinutes,
    autoStepDelaySeconds: prev.autoStepDelaySeconds,
    signupMethod: prev.signupMethod,
    resolvedSignupMethod: null,
    accountIdentifierType: null,
    accountIdentifier: '',
    signupPhoneNumber: '',
    signupPhoneActivation: null,
    signupPhoneCompletedActivation: null,
    signupPhoneVerificationRequestedAt: null,
    signupPhoneVerificationPurpose: '',
    mailProvider: prev.mailProvider,
    emailGenerator: prev.emailGenerator,
    gmailBaseEmail: prev.gmailBaseEmail,
    mail2925BaseEmail: prev.mail2925BaseEmail,
    emailPrefix: prev.emailPrefix,
    inbucketHost: prev.inbucketHost,
    inbucketMailbox: prev.inbucketMailbox,
    cloudflareDomain: prev.cloudflareDomain,
    cloudflareDomains: [...(prev.cloudflareDomains || [])],
    tabRegistry: { ...(prev.tabRegistry || {}) },
    sourceLastUrls: { ...(prev.sourceLastUrls || {}) },
  };
}

async function addLog(message, level = 'info') {
  logs.push({ message, level });
}

async function broadcastAutoRunStatus(phase, payload = {}) {
  broadcasts.push({ phase, ...payload });
  await setState({
    ...getAutoRunStatusPayload(phase, payload),
  });
}

async function sleepWithStop() {}
async function waitForRunningStepsToFinish() {
  return getState();
}
async function broadcastStopToContentScripts() {}
function cancelPendingCommands() {}
function normalizeAutoRunFallbackThreadIntervalMinutes(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}
async function persistAutoRunTimerPlan() {}
async function launchAutoRunTimerPlan() { return false; }
function getPendingAutoRunTimerPlan() { return null; }
function getErrorMessage(error) { return error?.message || String(error || ''); }
function createAutoRunSessionId() {
  autoRunSessionSeed += 1;
  autoRunSessionId = autoRunSessionSeed;
  return autoRunSessionId;
}
function throwIfAutoRunSessionStopped(sessionId) {
  if (sessionId && sessionId !== autoRunSessionId) {
    throw new Error(STOP_ERROR_MESSAGE);
  }
  throwIfStopped();
}
const chrome = {
  runtime: {
    sendMessage() {
      return Promise.resolve();
    },
  },
};

async function runAutoSequenceFromStep() {
  runCalls += 1;
  const state = await getState();

  if (
    runCalls === 2
    && (Object.keys(state.tabRegistry || {}).length || Object.keys(state.sourceLastUrls || {}).length)
  ) {
    throw new Error('fresh auto-run attempt reused stale runtime tab context');
  }

  currentState = {
    ...currentState,
    stepStatuses: {
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
      7: 'completed',
      8: 'completed',
      9: 'completed',
      10: 'completed',
    },
    nodeStatuses: projectStepStatusesToNodeStatuses({
      1: 'completed',
      2: 'completed',
      3: 'completed',
      4: 'completed',
      5: 'completed',
      6: 'completed',
      7: 'completed',
      8: 'completed',
      9: 'completed',
      10: 'completed',
    }),
    tabRegistry: {
      'openai-auth': { tabId: 88, ready: true },
    },
    sourceLastUrls: {
      'openai-auth': 'https://auth.openai.com/authorize',
    },
  };
}

async function runAutoSequenceFromNode(nodeId, context = {}) {
  return runAutoSequenceFromStep(getStepIdByNodeIdForState(nodeId) || 1, context);
}

function getFirstUnfinishedNodeId() {
  return 'open-chatgpt';
}

function getRunningNodeIds() {
  return [];
}

function hasSavedNodeProgress() {
  return false;
}

async function waitForRunningNodesToFinish() {
  return getState();
}

${helperBundle}
${autoRunModuleSource}

const runtime = {
  state: {
    autoRunActive: false,
    autoRunCurrentRun: 0,
    autoRunTotalRuns: 1,
    autoRunAttemptRun: 0,
    autoRunSessionId: 0,
  },
  get() {
    return { ...this.state };
  },
  set(updates = {}) {
    this.state = { ...this.state, ...updates };
  },
};

const controller = self.MultiPageBackgroundAutoRunController.createAutoRunController({
  addLog,
  AUTO_RUN_MAX_RETRIES_PER_ROUND,
  AUTO_RUN_RETRY_DELAY_MS,
  AUTO_RUN_TIMER_KIND_BEFORE_RETRY,
  AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS,
  broadcastAutoRunStatus,
  broadcastStopToContentScripts,
  cancelPendingCommands,
  clearStopRequest,
  createAutoRunSessionId,
  getAutoRunStatusPayload,
  getErrorMessage,
  getFirstUnfinishedNodeId,
  getPendingAutoRunTimerPlan,
  getRunningNodeIds,
  getState,
  getStopRequested: () => stopRequested,
  hasSavedNodeProgress,
  isRestartCurrentAttemptError,
  isStopError,
  launchAutoRunTimerPlan,
  normalizeAutoRunFallbackThreadIntervalMinutes,
  persistAutoRunTimerPlan,
  resetState,
  runAutoSequenceFromNode,
  runtime,
  setState,
  sleepWithStop,
  throwIfAutoRunSessionStopped,
  waitForRunningNodesToFinish,
  throwIfStopped,
  chrome,
});

return {
  autoRunLoop: controller.autoRunLoop,
  snapshot() {
    return {
      runCalls,
      autoRunActive: runtime.state.autoRunActive,
      autoRunCurrentRun: runtime.state.autoRunCurrentRun,
      autoRunTotalRuns: runtime.state.autoRunTotalRuns,
      autoRunAttemptRun: runtime.state.autoRunAttemptRun,
      currentState,
      logs,
      broadcasts,
    };
  },
};
`)(autoRunModuleSource);

(async () => {
  await api.autoRunLoop(2, { autoRunSkipFailures: false, mode: 'restart' });

  const snapshot = api.snapshot();
  assert.strictEqual(snapshot.runCalls, 2, 'auto-run should enter the second fresh attempt');
  assert.strictEqual(snapshot.currentState.autoRunPhase, 'complete', 'both runs should complete after reset');
  assert.strictEqual(snapshot.currentState.autoRunCurrentRun, 2, 'final run index should be recorded');
  assert.strictEqual(snapshot.autoRunActive, false, 'auto-run should exit active state after completion');
  assert.strictEqual(snapshot.currentState.autoRunSessionId, 0, 'session id should be cleared after completion');
  assert.strictEqual(snapshot.currentState.gmailBaseEmail, 'demo@gmail.com', 'gmail base email should survive fresh-attempt reset');
  assert.strictEqual(snapshot.currentState.mail2925BaseEmail, 'demo@2925.com', '2925 base email should survive fresh-attempt reset');
  assert.strictEqual(snapshot.currentState.signupMethod, 'phone', 'signup method setting should survive fresh-attempt reset');
  assert.strictEqual(snapshot.currentState.resolvedSignupMethod, null, 'resolved signup method should be cleared before the next run freezes it again');
  assert.strictEqual(snapshot.currentState.accountIdentifierType, null, 'account identifier type should be runtime-only');
  assert.strictEqual(snapshot.currentState.accountIdentifier, '', 'account identifier should be runtime-only');
  assert.strictEqual(snapshot.currentState.signupPhoneNumber, '', 'signup phone number should be runtime-only');
  assert.strictEqual(snapshot.currentState.signupPhoneActivation, null, 'signup phone activation should be runtime-only');
  assert.strictEqual(snapshot.currentState.signupPhoneCompletedActivation, null, 'completed signup phone activation should be runtime-only');
  assert.strictEqual(snapshot.currentState.signupPhoneVerificationRequestedAt, null, 'signup phone request time should be runtime-only');
  assert.strictEqual(snapshot.currentState.signupPhoneVerificationPurpose, '', 'signup phone purpose should be runtime-only');
  assert.deepStrictEqual(
    snapshot.currentState.reusablePhoneActivation,
    {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 1,
      maxUses: 3,
    },
    'reusable phone activation should survive fresh-attempt reset'
  );

  console.log('auto-run fresh attempt reset tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
