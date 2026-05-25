const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);
const rawCreateAutoRunController = api.createAutoRunController.bind(api);

const TEST_STEP_NODE_IDS = Object.freeze({
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
});

const TEST_NODE_STEP_IDS = Object.fromEntries(
  Object.entries(TEST_STEP_NODE_IDS).map(([step, nodeId]) => [nodeId, Number(step)])
);

function getTestNodeIdByStep(step) {
  return TEST_STEP_NODE_IDS[Number(step)] || '';
}

function getTestStepIdByNodeId(nodeId) {
  return TEST_NODE_STEP_IDS[String(nodeId || '').trim()] || null;
}

function projectStepStatusesToNodeStatuses(stepStatuses = {}) {
  const nodeStatuses = {};
  for (const [step, status] of Object.entries(stepStatuses || {})) {
    const nodeId = getTestNodeIdByStep(step);
    if (nodeId) {
      nodeStatuses[nodeId] = status;
    }
  }
  return nodeStatuses;
}

api.createAutoRunController = (deps = {}) => {
  const normalized = { ...deps };
  if (typeof normalized.getState === 'function') {
    const getState = normalized.getState;
    normalized.getState = async () => {
      const state = await getState();
      return {
        ...state,
        nodeStatuses: {
          ...projectStepStatusesToNodeStatuses(state?.stepStatuses || {}),
          ...(state?.nodeStatuses || {}),
        },
      };
    };
  }
  if (typeof normalized.runAutoSequenceFromNode !== 'function' && typeof normalized.runAutoSequenceFromStep === 'function') {
    const runAutoSequenceFromStep = normalized.runAutoSequenceFromStep;
    normalized.runAutoSequenceFromNode = (nodeId, context = {}) => (
      runAutoSequenceFromStep(getTestStepIdByNodeId(nodeId) || 1, context)
    );
  }
  if (typeof normalized.getFirstUnfinishedNodeId !== 'function' && typeof normalized.getFirstUnfinishedStep === 'function') {
    const getFirstUnfinishedStep = normalized.getFirstUnfinishedStep;
    normalized.getFirstUnfinishedNodeId = (statuses = {}, state = {}) => (
      getTestNodeIdByStep(getFirstUnfinishedStep(statuses, state))
    );
  }
  if (typeof normalized.getRunningNodeIds !== 'function' && typeof normalized.getRunningSteps === 'function') {
    const getRunningSteps = normalized.getRunningSteps;
    normalized.getRunningNodeIds = (statuses = {}, state = {}) => (
      getRunningSteps(statuses, state).map(getTestNodeIdByStep).filter(Boolean)
    );
  }
  if (typeof normalized.hasSavedNodeProgress !== 'function' && typeof normalized.hasSavedProgress === 'function') {
    normalized.hasSavedNodeProgress = normalized.hasSavedProgress;
  }
  if (typeof normalized.waitForRunningNodesToFinish !== 'function' && typeof normalized.waitForRunningStepsToFinish === 'function') {
    normalized.waitForRunningNodesToFinish = normalized.waitForRunningStepsToFinish;
  }
  delete normalized.runAutoSequenceFromStep;
  delete normalized.getFirstUnfinishedStep;
  delete normalized.getRunningSteps;
  delete normalized.hasSavedProgress;
  delete normalized.waitForRunningStepsToFinish;
  return rawCreateAutoRunController(normalized);
};

test('auto-run controller verifies hotmail mailbox before each fresh attempt starts', async () => {
  const events = {
    order: [],
    preflightCalls: [],
    runCalls: 0,
  };

  let currentState = {
    stepStatuses: {},
    vpsUrl: 'https://example.com/vps',
    vpsPassword: 'secret',
    customPassword: '',
    autoRunSkipFailures: false,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoStepDelaySeconds: null,
    mailProvider: 'hotmail-api',
    emailGenerator: 'duck',
    gmailBaseEmail: '',
    mail2925BaseEmail: '',
    emailPrefix: 'demo',
    inbucketHost: '',
    inbucketMailbox: '',
    cloudflareDomain: '',
    cloudflareDomains: [],
    tabRegistry: {},
    sourceLastUrls: {},
    autoRunRoundSummaries: [],
  };

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

  let sessionSeed = 0;

  const controller = api.createAutoRunController({
    addLog: async () => {},
    appendAccountRunRecord: async () => null,
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 3000,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload = {}) => {
      currentState = {
        ...currentState,
        autoRunning: ['running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? runtime.state.autoRunCurrentRun,
        autoRunTotalRuns: payload.totalRuns ?? runtime.state.autoRunTotalRuns,
        autoRunAttemptRun: payload.attemptRun ?? runtime.state.autoRunAttemptRun,
        autoRunSessionId: payload.sessionId ?? runtime.state.autoRunSessionId,
      };
    },
    broadcastStopToContentScripts: async () => {},
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    ensureHotmailMailboxReadyForAutoRunRound: async (payload = {}) => {
      events.order.push('preflight');
      events.preflightCalls.push({ ...payload });
    },
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: ['running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? 1,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedStep: () => 1,
    getPendingAutoRunTimerPlan: () => null,
    getRunningSteps: () => [],
    getState: async () => ({
      ...currentState,
      stepStatuses: { ...(currentState.stepStatuses || {}) },
      tabRegistry: { ...(currentState.tabRegistry || {}) },
      sourceLastUrls: { ...(currentState.sourceLastUrls || {}) },
    }),
    getStopRequested: () => false,
    hasSavedProgress: () => false,
    isAddPhoneAuthFailure: () => false,
    isRestartCurrentAttemptError: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStopError: (error) => (error?.message || String(error || '')) === '流程已被用户停止。',
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: (value) => Math.max(0, Math.floor(Number(value) || 0)),
    persistAutoRunTimerPlan: async () => ({}),
    resetState: async () => {
      currentState = {
        ...currentState,
        stepStatuses: {},
        tabRegistry: {},
        sourceLastUrls: {},
      };
    },
    runAutoSequenceFromStep: async () => {
      events.order.push('run');
      events.runCalls += 1;
    },
    runtime,
    setState: async (updates = {}) => {
      currentState = {
        ...currentState,
        ...updates,
        stepStatuses: updates.stepStatuses ? { ...updates.stepStatuses } : currentState.stepStatuses,
        tabRegistry: updates.tabRegistry ? { ...updates.tabRegistry } : currentState.tabRegistry,
        sourceLastUrls: updates.sourceLastUrls ? { ...updates.sourceLastUrls } : currentState.sourceLastUrls,
      };
    },
    sleepWithStop: async () => {},
    throwIfAutoRunSessionStopped: (sessionId) => {
      if (sessionId && sessionId !== runtime.state.autoRunSessionId) {
        throw new Error('流程已被用户停止。');
      }
    },
    waitForRunningStepsToFinish: async () => currentState,
    chrome: {
      runtime: {
        sendMessage() {
          return Promise.resolve();
        },
      },
    },
  });

  await controller.autoRunLoop(1, {
    autoRunSkipFailures: false,
    mode: 'restart',
  });

  assert.equal(events.runCalls, 1);
  assert.equal(events.preflightCalls.length, 1);
  assert.deepEqual(events.order, ['preflight', 'run']);
  assert.match(
    JSON.stringify(events.preflightCalls[0]),
    /"targetRun":1/
  );
});
