const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('auto-run controller preserves kiro flow across fresh reset and starts from the kiro first node', async () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

  const executedNodeIds = [];
  const kiroNodeIds = [
    'kiro-open-register-page',
    'kiro-submit-email',
    'kiro-submit-name',
    'kiro-submit-verification-code',
    'kiro-submit-password',
    'kiro-complete-register-consent',
    'kiro-start-desktop-authorize',
    'kiro-complete-desktop-authorize',
    'kiro-upload-credential',
  ];
  const openAiNodeIds = ['open-chatgpt', 'submit-signup-email', 'fill-password'];
  let helperCalls = 0;
  let sessionSeed = 700;
  let currentState = {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    panelMode: 'cpa',
    kiroTargetId: 'kiro-rs',
    kiroRsUrl: 'https://kiro.example/admin',
    kiroRsKey: 'demo-key',
    customFutureFlowField: 'future-ready',
    plusModeEnabled: false,
    plusPaymentMethod: 'paypal',
    phoneVerificationEnabled: false,
    phoneSignupReloginAfterBindEmailEnabled: false,
    autoRunSkipFailures: false,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoStepDelaySeconds: null,
    signupMethod: 'email',
    stepExecutionRangeByFlow: {
      openai: { enabled: false, fromStep: 1, toStep: 11 },
      kiro: { enabled: false, fromStep: 1, toStep: 9 },
    },
    nodeStatuses: {
      'open-chatgpt': 'stopped',
      'kiro-open-register-page': 'pending',
      'kiro-submit-email': 'pending',
      'kiro-submit-name': 'pending',
      'kiro-submit-verification-code': 'pending',
      'kiro-submit-password': 'pending',
      'kiro-complete-register-consent': 'pending',
      'kiro-start-desktop-authorize': 'pending',
      'kiro-complete-desktop-authorize': 'pending',
      'kiro-upload-credential': 'pending',
    },
    tabRegistry: {
      stale: { tabId: 99 },
    },
    sourceLastUrls: {
      stale: 'https://chatgpt.com/',
    },
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
      this.state = {
        ...this.state,
        ...updates,
      };
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
        autoRunning: ['running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? currentState.autoRunCurrentRun ?? 0,
        autoRunTotalRuns: payload.totalRuns ?? currentState.autoRunTotalRuns ?? 1,
        autoRunAttemptRun: payload.attemptRun ?? currentState.autoRunAttemptRun ?? 0,
      };
    },
    broadcastStopToContentScripts: async () => {},
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    buildFreshAutoRunKeepState: (prevState = {}, context = {}) => {
      helperCalls += 1;
      assert.equal(context.targetRun, 1);
      assert.equal(context.attemptRun, 1);
      return {
        activeFlowId: prevState.activeFlowId,
        flowId: prevState.activeFlowId,
        panelMode: prevState.panelMode,
        kiroTargetId: prevState.kiroTargetId,
        kiroRsUrl: prevState.kiroRsUrl,
        kiroRsKey: prevState.kiroRsKey,
        customFutureFlowField: prevState.customFutureFlowField,
      };
    },
    ensureHotmailMailboxReadyForAutoRunRound: async () => {},
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: ['running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? 1,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedNodeId: (statuses = {}, state = {}) => {
      const flowId = String(state?.activeFlowId || state?.flowId || 'openai').trim().toLowerCase();
      const candidateNodeIds = flowId === 'kiro' ? kiroNodeIds : openAiNodeIds;
      for (const nodeId of candidateNodeIds) {
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
    hasSavedNodeProgress: () => false,
    isAddPhoneAuthFailure: () => false,
    isGpcTaskEndedFailure: () => false,
    isPhoneSmsPlatformRateLimitFailure: () => false,
    isPlusCheckoutNonFreeTrialFailure: () => false,
    isRestartCurrentAttemptError: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStopError: () => false,
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: (value) => Math.max(0, Number(value) || 0),
    persistAutoRunTimerPlan: async () => {},
    resetState: async () => {
      currentState = {
        activeFlowId: 'openai',
        flowId: 'openai',
        panelMode: 'cpa',
        kiroTargetId: '',
        kiroRsUrl: '',
        kiroRsKey: '',
        customFutureFlowField: '',
        plusModeEnabled: false,
        plusPaymentMethod: 'paypal',
        phoneVerificationEnabled: false,
        phoneSignupReloginAfterBindEmailEnabled: false,
        autoRunSkipFailures: false,
        autoRunFallbackThreadIntervalMinutes: 0,
        autoStepDelaySeconds: null,
        signupMethod: 'email',
        stepExecutionRangeByFlow: {
          openai: { enabled: false, fromStep: 1, toStep: 11 },
          kiro: { enabled: false, fromStep: 1, toStep: 9 },
        },
        nodeStatuses: {},
        tabRegistry: {},
        sourceLastUrls: {},
      };
    },
    runAutoSequenceFromNode: async (nodeId) => {
      executedNodeIds.push(nodeId);
      assert.equal(currentState.activeFlowId, 'kiro');
      assert.equal(currentState.flowId, 'kiro');
      assert.equal(currentState.kiroTargetId, 'kiro-rs');
      assert.equal(currentState.customFutureFlowField, 'future-ready');
      assert.equal(currentState.nodeStatuses?.['kiro-open-register-page'], 'pending');
      assert.equal(currentState.nodeStatuses?.['kiro-submit-email'], 'pending');
      currentState = {
        ...currentState,
        nodeStatuses: {
          'kiro-open-register-page': 'completed',
          'kiro-submit-email': 'completed',
          'kiro-submit-name': 'completed',
          'kiro-submit-verification-code': 'completed',
          'kiro-submit-password': 'completed',
          'kiro-complete-register-consent': 'completed',
          'kiro-start-desktop-authorize': 'completed',
          'kiro-complete-desktop-authorize': 'completed',
          'kiro-upload-credential': 'completed',
        },
      };
    },
    runtime,
    setState: async (updates = {}) => {
      currentState = {
        ...currentState,
        ...updates,
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

  await controller.autoRunLoop(1, { autoRunSkipFailures: false, mode: 'restart' });

  assert.deepStrictEqual(executedNodeIds, ['kiro-open-register-page']);
  assert.equal(helperCalls, 1);
});

test('auto-run controller clears stale kiro completed statuses before a fresh restart', async () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

  const kiroNodeIds = [
    'kiro-open-register-page',
    'kiro-submit-email',
    'kiro-submit-name',
  ];
  let currentState = {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    nodeStatuses: {
      'kiro-open-register-page': 'completed',
      'kiro-submit-email': 'pending',
      'kiro-submit-name': 'pending',
    },
    runtimeState: {
      activeFlowId: 'kiro',
      currentNodeId: 'kiro-submit-email',
      nodeStatuses: {
        'kiro-open-register-page': 'completed',
      },
      flowState: {
        kiro: {
          register: {
            loginUrl: '',
          },
        },
      },
    },
    autoRunRoundSummaries: [],
    autoRunSkipFailures: false,
  };
  const executedNodeIds = [];
  let resetCalls = 0;
  let sessionSeed = 1200;
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
    broadcastAutoRunStatus: async (_phase, payload = {}, extraState = {}) => {
      currentState = { ...currentState, ...extraState, ...payload };
    },
    broadcastStopToContentScripts: async () => {},
    buildFreshAutoRunKeepState: (prevState = {}) => ({
      activeFlowId: prevState.activeFlowId,
      flowId: prevState.flowId,
      runtimeState: {
        activeFlowId: 'kiro',
        currentNodeId: 'kiro-submit-email',
        nodeStatuses: {
          'kiro-open-register-page': 'completed',
        },
        flowState: prevState.runtimeState?.flowState || {},
      },
    }),
    cancelPendingCommands: () => {},
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    ensureHotmailMailboxReadyForAutoRunRound: async () => {},
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: phase === 'running',
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? 1,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedNodeId: (statuses = {}) => {
      for (const nodeId of kiroNodeIds) {
        const status = String(statuses?.[nodeId] || 'pending').trim();
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
      runtimeState: currentState.runtimeState ? JSON.parse(JSON.stringify(currentState.runtimeState)) : undefined,
    }),
    getStopRequested: () => false,
    hasSavedNodeProgress: () => false,
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
      resetCalls += 1;
      currentState = {
        activeFlowId: 'kiro',
        flowId: 'kiro',
        nodeStatuses: {},
        runtimeState: {
          activeFlowId: 'kiro',
          flowState: {},
        },
      };
    },
    runAutoSequenceFromNode: async (nodeId) => {
      executedNodeIds.push(nodeId);
      assert.equal(nodeId, 'kiro-open-register-page');
      assert.equal(currentState.currentNodeId, '');
      assert.equal(currentState.nodeStatuses['kiro-open-register-page'], 'pending');
      assert.equal(currentState.nodeStatuses['kiro-submit-email'], 'pending');
      assert.equal(currentState.runtimeState.currentNodeId, undefined);
      assert.equal(currentState.runtimeState.nodeStatuses, undefined);
      currentState.nodeStatuses = Object.fromEntries(kiroNodeIds.map((id) => [id, 'completed']));
    },
    runtime,
    setState: async (updates = {}) => {
      currentState = {
        ...currentState,
        ...updates,
        nodeStatuses: updates.nodeStatuses ? { ...updates.nodeStatuses } : currentState.nodeStatuses,
        runtimeState: updates.runtimeState ? JSON.parse(JSON.stringify(updates.runtimeState)) : currentState.runtimeState,
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

  await controller.autoRunLoop(1, { autoRunSkipFailures: false, mode: 'restart' });

  assert.equal(resetCalls, 1);
  assert.deepEqual(executedNodeIds, ['kiro-open-register-page']);
});

test('auto-run controller stops immediately on kiro proxy failures even when skip-failures is enabled', async () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const controllerApi = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

  const kiroNodeIds = [
    'kiro-open-register-page',
    'kiro-submit-email',
    'kiro-submit-name',
    'kiro-submit-verification-code',
    'kiro-submit-password',
    'kiro-complete-register-consent',
    'kiro-start-desktop-authorize',
    'kiro-complete-desktop-authorize',
    'kiro-upload-credential',
  ];
  const events = {
    logs: [],
    phases: [],
    runCalls: 0,
    cancelReasons: [],
    records: [],
  };
  let currentState = {
    activeFlowId: 'kiro',
    flowId: 'kiro',
    autoRunSkipFailures: true,
    autoRunFallbackThreadIntervalMinutes: 0,
    autoStepDelaySeconds: null,
    nodeStatuses: {
      'kiro-open-register-page': 'pending',
      'kiro-submit-email': 'pending',
      'kiro-submit-name': 'pending',
      'kiro-submit-verification-code': 'pending',
      'kiro-submit-password': 'pending',
      'kiro-complete-register-consent': 'pending',
      'kiro-start-desktop-authorize': 'pending',
      'kiro-complete-desktop-authorize': 'pending',
      'kiro-upload-credential': 'pending',
    },
    tabRegistry: {},
    sourceLastUrls: {},
    autoRunRoundSummaries: [],
  };
  let sessionSeed = 900;
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

  const controller = controllerApi.createAutoRunController({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    appendAccountRunRecord: async (status, _state, reason) => {
      events.records.push({ status, reason });
      return { status, reason };
    },
    AUTO_RUN_MAX_RETRIES_PER_ROUND: 3,
    AUTO_RUN_RETRY_DELAY_MS: 3000,
    AUTO_RUN_TIMER_KIND_BEFORE_RETRY: 'before_retry',
    AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS: 'between_rounds',
    broadcastAutoRunStatus: async (phase, payload = {}) => {
      events.phases.push({ phase, ...payload });
      currentState = {
        ...currentState,
        autoRunning: ['running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? currentState.autoRunCurrentRun ?? 0,
        autoRunTotalRuns: payload.totalRuns ?? currentState.autoRunTotalRuns ?? 1,
        autoRunAttemptRun: payload.attemptRun ?? currentState.autoRunAttemptRun ?? 0,
      };
    },
    broadcastStopToContentScripts: async () => {},
    cancelPendingCommands: (reason) => {
      events.cancelReasons.push(reason);
    },
    clearStopRequest: () => {},
    createAutoRunSessionId: () => {
      sessionSeed += 1;
      return sessionSeed;
    },
    ensureHotmailMailboxReadyForAutoRunRound: async () => {},
    getAutoRunStatusPayload: (phase, payload = {}) => ({
      autoRunning: ['running', 'waiting_step', 'waiting_email', 'retrying', 'waiting_interval'].includes(phase),
      autoRunPhase: phase,
      autoRunCurrentRun: payload.currentRun ?? 0,
      autoRunTotalRuns: payload.totalRuns ?? 1,
      autoRunAttemptRun: payload.attemptRun ?? 0,
      autoRunSessionId: payload.sessionId ?? 0,
    }),
    getErrorMessage: (error) => error?.message || String(error || ''),
    getFirstUnfinishedNodeId: (statuses = {}) => {
      for (const nodeId of kiroNodeIds) {
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
    hasSavedNodeProgress: () => false,
    isAddPhoneAuthFailure: () => false,
    isGpcTaskEndedFailure: () => false,
    isKiroProxyFailure: (error) => /Kiro 注册页出现 AWS 请求异常|Kiro 注册页返回 403|切换代理|更换代理/i.test(error?.message || String(error || '')),
    isPhoneSmsPlatformRateLimitFailure: () => false,
    isPlusCheckoutNonFreeTrialFailure: () => false,
    isRestartCurrentAttemptError: () => false,
    isStep4Route405RecoveryLimitFailure: () => false,
    isSignupUserAlreadyExistsFailure: () => false,
    isStopError: () => false,
    launchAutoRunTimerPlan: async () => false,
    normalizeAutoRunFallbackThreadIntervalMinutes: (value) => Math.max(0, Number(value) || 0),
    persistAutoRunTimerPlan: async () => {},
    resetState: async () => {},
    runAutoSequenceFromNode: async (nodeId) => {
      events.runCalls += 1;
      assert.equal(nodeId, 'kiro-open-register-page');
      throw new Error('Kiro 注册页出现 AWS 请求异常，通常是当前代理 IP 或出口区域异常，请先切换代理后再重试。');
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

  await controller.autoRunLoop(2, { autoRunSkipFailures: true, mode: 'restart' });

  assert.equal(events.runCalls, 1);
  assert.equal(events.phases[0]?.phase, 'running');
  assert.equal(events.phases.at(-1)?.phase, 'stopped');
  assert.equal(events.phases.some((entry) => entry.phase === 'retrying'), false);
  assert.equal(events.cancelReasons.length, 1);
  assert.match(events.cancelReasons[0], /Kiro 代理异常页/);
  assert.ok(events.logs.some((entry) => /切换代理/.test(entry.message)));
  assert.ok(events.records.some((entry) => /failed$/i.test(entry.status)));
});
