const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadAutoRunControllerApi() {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);
}

test('grok auto-run retry restarts from the first node with fresh pending statuses', async () => {
  const api = loadAutoRunControllerApi();
  const grokNodeIds = [
    'grok-open-signup-page',
    'grok-submit-email',
    'grok-submit-verification-code',
    'grok-submit-profile',
    'grok-extract-sso-cookie',
  ];
  const executedNodeIds = [];
  const retryStartSnapshots = [];
  let sessionSeed = 800;
  let currentState = {
    activeFlowId: 'grok',
    flowId: 'grok',
    autoRunSkipFailures: true,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoRunDelayEnabled: false,
    autoRunDelayMinutes: 30,
    autoStepDelaySeconds: null,
    nodeStatuses: Object.fromEntries(grokNodeIds.map((nodeId) => [nodeId, 'pending'])),
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

  const controller = api.createAutoRunController({
    addLog: async () => {},
    appendAccountRunRecord: async () => null,
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 3000,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload = {}, extraState = {}) => {
      currentState = {
        ...currentState,
        ...extraState,
        autoRunning: ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? currentState.autoRunCurrentRun ?? 0,
        autoRunTotalRuns: payload.totalRuns ?? currentState.autoRunTotalRuns ?? 1,
        autoRunAttemptRun: payload.attemptRun ?? currentState.autoRunAttemptRun ?? 0,
        autoRunSessionId: payload.sessionId ?? currentState.autoRunSessionId ?? 0,
      };
    },
    broadcastStopToContentScripts: async () => {},
    buildFreshAutoRunKeepState: (prevState = {}) => ({
      activeFlowId: prevState.activeFlowId,
      flowId: prevState.flowId || prevState.activeFlowId,
    }),
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    ensureHotmailMailboxReadyForAutoRunRound: async () => {},
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: ['scheduled', 'running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? 1,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedNodeId: (statuses = {}) => {
      for (const nodeId of grokNodeIds) {
        const status = String(statuses?.[nodeId] || 'pending').trim().toLowerCase();
        if (!['completed', 'manual_completed', 'skipped'].includes(status)) {
          return nodeId;
        }
      }
      return '';
    },
    getPendingAutoRunTimerPlan: () => null,
    getRunningNodeIds: () => [],
    getState: async () => ({
      ...currentState,
      nodeStatuses: { ...(currentState.nodeStatuses || {}) },
      tabRegistry: { ...(currentState.tabRegistry || {}) },
      sourceLastUrls: { ...(currentState.sourceLastUrls || {}) },
    }),
    getStopRequested: () => false,
    hasSavedNodeProgress: (statuses = {}) => grokNodeIds.some((nodeId) => String(statuses?.[nodeId] || 'pending') !== 'pending'),
    isAddPhoneAuthFailure: () => false,
    isGpcTaskEndedFailure: () => false,
    isKiroProxyFailure: () => false,
    isPhoneSmsPlatformRateLimitFailure: () => false,
    isPlusCheckoutNonFreeTrialFailure: () => false,
    isRestartCurrentAttemptError: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStopError: () => false,
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: () => 0,
    persistAutoRunTimerPlan: async () => {},
    resetState: async () => {
      currentState = {
        activeFlowId: 'grok',
        flowId: 'grok',
        nodeStatuses: {},
        tabRegistry: {},
        sourceLastUrls: {},
        autoRunRoundSummaries: [],
      };
    },
    runAutoSequenceFromNode: async (nodeId) => {
      executedNodeIds.push(nodeId);
      if (executedNodeIds.length === 1) {
        assert.equal(nodeId, 'grok-open-signup-page');
        currentState = {
          ...currentState,
          currentNodeId: 'grok-extract-sso-cookie',
          nodeStatuses: {
            'grok-open-signup-page': 'completed',
            'grok-submit-email': 'completed',
            'grok-submit-verification-code': 'completed',
            'grok-submit-profile': 'completed',
            'grok-extract-sso-cookie': 'failed',
          },
        };
        throw new Error('Grok SSO extraction failed');
      }

      retryStartSnapshots.push({
        nodeId,
        nodeStatuses: { ...(currentState.nodeStatuses || {}) },
      });
      assert.equal(nodeId, 'grok-open-signup-page');
      assert.deepEqual(currentState.nodeStatuses, Object.fromEntries(grokNodeIds.map((id) => [id, 'pending'])));
      currentState = {
        ...currentState,
        nodeStatuses: Object.fromEntries(grokNodeIds.map((id) => [id, 'completed'])),
      };
    },
    runtime,
    setState: async (updates = {}) => {
      currentState = {
        ...currentState,
        ...updates,
        nodeStatuses: updates.nodeStatuses ? { ...updates.nodeStatuses } : currentState.nodeStatuses,
        tabRegistry: updates.tabRegistry ? { ...updates.tabRegistry } : currentState.tabRegistry,
        sourceLastUrls: updates.sourceLastUrls ? { ...updates.sourceLastUrls } : currentState.sourceLastUrls,
      };
    },
    sleepWithStop: async () => {},
    throwIfAutoRunSessionStopped: () => {},
    waitForRunningNodesToFinish: async () => currentState,
    chrome: {
      runtime: {
        sendMessage: () => Promise.resolve(),
      },
    },
  });

  await controller.autoRunLoop(1, { autoRunSkipFailures: true, mode: 'restart' });

  assert.deepEqual(executedNodeIds, ['grok-open-signup-page', 'grok-open-signup-page']);
  assert.equal(retryStartSnapshots.length, 1);
  assert.equal(currentState.autoRunPhase, 'complete');
});
