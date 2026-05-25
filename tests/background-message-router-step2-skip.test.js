const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/message-router.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

function createRouter(overrides = {}) {
  const events = {
    logs: [],
    stepStatuses: [],
    nodeStatuses: [],
    stateUpdates: [],
    broadcasts: [],
    balanceRefreshes: [],
    emailStates: [],
    persistedRegistrationEmails: [],
    signupPhoneStates: [],
    signupPhoneSilentStates: [],
    finalizePayloads: [],
    phoneFinalizations: [],
    notifyCompletions: [],
    notifyErrors: [],
    securityBlocks: [],
    invalidations: [],
    executedSteps: [],
    accountRecords: [],
  };
  const nodeByStep = overrides.nodeByStep || {
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
    11: 'fetch-login-code',
    12: 'confirm-oauth',
    13: 'platform-verify',
  };
  const stepByNode = overrides.stepByNode || null;
  const normalStepByNode = {
    'open-chatgpt': 1,
    'submit-signup-email': 2,
    'fill-password': 3,
    'fetch-signup-code': 4,
    'fill-profile': 5,
    'wait-registration-success': 6,
    'oauth-login': 7,
    'fetch-login-code': 8,
    'confirm-oauth': 9,
    'platform-verify': 10,
  };
  const plusStepByNode = {
    'open-chatgpt': 1,
    'submit-signup-email': 2,
    'fill-password': 3,
    'fetch-signup-code': 4,
    'fill-profile': 5,
    'oauth-login': 10,
    'fetch-login-code': 11,
    'confirm-oauth': 12,
    'platform-verify': 13,
  };
  const getStepForNode = (nodeId) => {
    const state = normalizeState(overrides.state || {});
    if (typeof overrides.getStepIdByNodeIdForState === 'function') {
      return overrides.getStepIdByNodeIdForState(nodeId, state) || 0;
    }
    if (stepByNode && Object.prototype.hasOwnProperty.call(stepByNode, nodeId)) {
      return stepByNode[nodeId] || 0;
    }
    return (state.plusModeEnabled ? plusStepByNode : normalStepByNode)[nodeId] || 0;
  };
  const normalizeState = (state = {}) => {
    const next = { ...(state || {}) };
    if (!next.nodeStatuses && next.stepStatuses) {
      next.nodeStatuses = Object.fromEntries(
        Object.entries(next.stepStatuses)
          .map(([step, status]) => [nodeByStep[Number(step)], status])
          .filter(([nodeId]) => Boolean(nodeId))
      );
    }
    return next;
  };

  const router = api.createMessageRouter({
    addLog: async (message, level, options = {}) => {
      events.logs.push({ message, level, step: options.step, stepKey: options.stepKey, nodeId: options.nodeId });
    },
    appendAccountRunRecord: overrides.appendAccountRunRecord || (async (status, state, reason) => {
      events.accountRecords.push({ status, state, reason });
      return null;
    }),
    batchUpdateLuckmailPurchases: async () => {},
    buildLocalhostCleanupPrefix: () => '',
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: () => ({}),
    broadcastDataUpdate: (updates) => {
      events.broadcasts.push(updates);
    },
    checkIcloudSession: async () => {},
    clearAutoRunTimerAlarm: async () => {},
    clearLuckmailRuntimeState: async () => {},
    clearStopRequest: () => {},
    closeLocalhostCallbackTabs: async () => {},
    closeTabsByUrlPrefix: async () => {},
    completeNodeFromBackground: async (nodeId, payload) => {
      events.notifyCompletions.push({ step: getStepForNode(nodeId), nodeId, payload, via: 'completeNodeFromBackground' });
    },
    deleteHotmailAccount: async () => {},
    deleteHotmailAccounts: async () => {},
    deleteIcloudAlias: async () => {},
    deleteUsedIcloudAliases: async () => {},
    disableUsedLuckmailPurchases: async () => {},
    doesNodeUseCompletionSignal: overrides.doesNodeUseCompletionSignal || (() => false),
    ensureManualInteractionAllowed: async () => ({}),
    executeNode: async (nodeId) => {
      events.executedSteps.push(getStepForNode(nodeId) || nodeId);
    },
    executeNodeViaCompletionSignal: overrides.executeNodeViaCompletionSignal || (async () => ({})),
    exportSettingsBundle: async () => ({}),
    fetchGeneratedEmail: async () => '',
    finalizePhoneActivationAfterSuccessfulFlow: overrides.finalizePhoneActivationAfterSuccessfulFlow || (async (state) => {
      events.phoneFinalizations.push(state);
    }),
    finalizeStep3Completion: overrides.finalizeStep3Completion || (async (payload) => {
      events.finalizePayloads.push(payload);
    }),
    finalizeStep5Completion: overrides.finalizeStep5Completion,
    finalizeIcloudAliasAfterSuccessfulFlow: overrides.finalizeIcloudAliasAfterSuccessfulFlow || (async () => {}),
    findHotmailAccount: async () => null,
    flushCommand: async () => {},
    getCurrentLuckmailPurchase: () => null,
    getPendingAutoRunTimerPlan: () => null,
    getSourceLabel: () => '',
    getState: async () => normalizeState(overrides.state || { nodeStatuses: { 'fill-password': 'pending' } }),
    getNodeIdsForState: overrides.getNodeIdsForState || (() => ['open-chatgpt', 'submit-signup-email', 'fill-password', 'fetch-signup-code', 'fill-profile', 'wait-registration-success', 'oauth-login', 'fetch-login-code', 'confirm-oauth', 'platform-verify']),
    getStepIdByNodeIdForState: overrides.getStepIdByNodeIdForState || ((nodeId, state = {}) => (stepByNode && Object.prototype.hasOwnProperty.call(stepByNode, nodeId))
      ? stepByNode[nodeId] || 0
      : (state.plusModeEnabled ? plusStepByNode : normalStepByNode)[nodeId] || 0),
    getStepDefinitionForState: overrides.getStepDefinitionForState,
    getStepIdsForState: overrides.getStepIdsForState,
    getLastStepIdForState: overrides.getLastStepIdForState,
    getTabId: overrides.getTabId || (async () => null),
    getStopRequested: () => false,
    handleAutoRunLoopUnhandledError: async () => {},
    handleCloudflareSecurityBlocked: overrides.handleCloudflareSecurityBlocked || (async (error) => {
      const message = typeof error === 'string' ? error : error?.message || '';
      events.securityBlocks.push(message);
      return message.replace(/^CF_SECURITY_BLOCKED::/, '') || message;
    }),
    importSettingsBundle: async () => {},
    invalidateDownstreamAfterStepRestart: async (step, options) => {
      events.invalidations.push({ step, options });
    },
    isCloudflareSecurityBlockedError: overrides.isCloudflareSecurityBlockedError || ((error) => /^CF_SECURITY_BLOCKED::/.test(typeof error === 'string' ? error : error?.message || '')),
    isAutoRunLockedState: overrides.isAutoRunLockedState || (() => false),
    isHotmailProvider: () => false,
    isLocalhostOAuthCallbackUrl: () => true,
    isLuckmailProvider: () => false,
    isStopError: () => false,
    isTabAlive: overrides.isTabAlive || (async () => false),
    launchAutoRunTimerPlan: async () => {},
    listIcloudAliases: async () => [],
    listLuckmailPurchasesForManagement: async () => [],
    normalizeHotmailAccounts: (items) => items,
    normalizeRunCount: (value) => value,
    notifyNodeComplete: (nodeId, payload) => {
      events.notifyCompletions.push({ step: getStepForNode(nodeId), nodeId, payload });
    },
    notifyNodeError: (nodeId, error) => {
      events.notifyErrors.push({ step: getStepForNode(nodeId), nodeId, error });
    },
    patchHotmailAccount: async () => {},
    registerTab: async () => {},
    requestStop: async () => {},
    resetState: async () => {},
    resumeAutoRun: async () => {},
    selectLuckmailPurchase: async () => {},
    setCurrentHotmailAccount: async () => {},
    setEmailState: async (email) => {
      events.emailStates.push(email);
    },
    setEmailStateSilently: async () => {},
    persistRegistrationEmailState: async (state, email, options) => {
      events.persistedRegistrationEmails.push({ state, email, options });
    },
    setSignupPhoneState: async (phoneNumber) => {
      events.signupPhoneStates.push(phoneNumber);
    },
    setSignupPhoneStateSilently: async (phoneNumber) => {
      events.signupPhoneSilentStates.push(phoneNumber);
    },
    setIcloudAliasPreservedState: async () => {},
    setIcloudAliasUsedState: async () => {},
    setLuckmailPurchaseDisabledState: async () => {},
    setLuckmailPurchasePreservedState: async () => {},
    setLuckmailPurchaseUsedState: async () => {},
    setPersistentSettings: async () => {},
    setState: async (updates) => {
      events.stateUpdates.push(updates);
    },
    setNodeStatus: async (nodeId, status) => {
      events.nodeStatuses.push({ nodeId, status });
      const step = getStepForNode(nodeId);
      events.stepStatuses.push({ step, status });
    },
    skipAutoRunCountdown: async () => false,
    skipNode: async () => {},
    startAutoRunLoop: async () => {},
    syncHotmailAccounts: async () => {},
    testHotmailAccountMailAccess: async () => {},
    upsertHotmailAccount: async () => {},
    verifyHotmailAccount: async () => {},
    refreshGpcCardBalance: overrides.refreshGpcCardBalance || (async (state, options) => {
      events.balanceRefreshes.push({ state, options });
      return { balance: '余额 3', remainingUses: 3, autoModeEnabled: true, apiKeyStatus: 'active' };
    }),
  });

  return { router, events };
}

test('message router skips step 3 when step 2 lands on verification page', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'pending' } },
  });

  await router.handleStepData(2, {
    email: 'user@example.com',
    skippedPasswordStep: true,
  });

  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.stepStatuses, [{ step: 3, status: 'skipped' }]);
  assert.equal(events.logs[0]?.message, '步骤 2：提交邮箱后页面直接进入验证码页，已自动跳过步骤 3。');
});

test('message router syncs signup phone runtime state from step 2 payload immediately', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'pending' } },
  });

  await router.handleStepData(2, {
    accountIdentifierType: 'phone',
    accountIdentifier: '66959916439',
    signupPhoneNumber: '66959916439',
  });

  assert.deepStrictEqual(events.emailStates, []);
  assert.deepStrictEqual(events.signupPhoneSilentStates, ['66959916439']);
  assert.deepStrictEqual(events.signupPhoneStates, []);
});

test('message router clears stale signup phone runtime when step 2 resolves email identity', async () => {
  const { router, events } = createRouter({
    state: {
      stepStatuses: { 3: 'pending' },
      accountIdentifierType: 'phone',
      accountIdentifier: '+66959916439',
      signupPhoneNumber: '+66959916439',
      signupPhoneActivation: { activationId: 'old', phoneNumber: '+66959916439' },
    },
  });

  await router.handleStepData(2, {
    email: 'user@example.com',
    accountIdentifierType: 'email',
    accountIdentifier: 'user@example.com',
  });

  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.signupPhoneSilentStates, []);
  assert.deepStrictEqual(events.stateUpdates, []);
});

test('message router preserves phone signup identity when step payload only reports registration email', async () => {
  const { router, events } = createRouter({
    state: {
      stepStatuses: { 3: 'pending' },
      accountIdentifierType: 'phone',
      accountIdentifier: '+66959916439',
      signupPhoneNumber: '+66959916439',
      signupPhoneActivation: { activationId: 'active', phoneNumber: '+66959916439' },
    },
  });

  await router.handleStepData(3, {
    email: 'bound@example.com',
    signupVerificationRequestedAt: 123456,
  });

  assert.deepStrictEqual(events.emailStates, []);
  assert.equal(events.persistedRegistrationEmails.length, 1);
  assert.equal(events.persistedRegistrationEmails[0].email, 'bound@example.com');
  assert.deepStrictEqual(events.persistedRegistrationEmails[0].options, {
    source: 'step_identity',
    preserveAccountIdentity: true,
  });
  assert.equal(events.persistedRegistrationEmails[0].state.signupPhoneNumber, '+66959916439');
  assert.equal(events.persistedRegistrationEmails[0].state.accountIdentifierType, 'phone');
  assert.equal(events.signupPhoneSilentStates.length, 0);
  assert.ok(!events.stateUpdates.some((updates) => updates.signupPhoneNumber === ''));
  assert.ok(events.stateUpdates.some((updates) => updates.signupVerificationRequestedAt === 123456));
});

test('message router persists phone signup identity from step 7 completion payload', async () => {
  const completedActivation = {
    activationId: 'signup-done',
    phoneNumber: '+5511917097811',
  };
  const { router, events } = createRouter({
    state: { stepStatuses: { 7: 'completed', 8: 'pending' } },
    getStepDefinitionForState: (step) => (
      step === 7
        ? { key: 'oauth-login' }
        : (step === 8 ? { key: 'fetch-login-code' } : null)
    ),
  });

  await router.handleStepData(7, {
    loginVerificationRequestedAt: 123456,
    accountIdentifierType: 'phone',
    accountIdentifier: '+5511917097811',
    signupPhoneNumber: '+5511917097811',
    signupPhoneActivation: null,
    signupPhoneCompletedActivation: completedActivation,
  });

  assert.deepStrictEqual(events.signupPhoneSilentStates, ['+5511917097811']);
  assert.ok(events.stateUpdates.some((updates) => updates.signupPhoneActivation === null));
  assert.ok(events.stateUpdates.some((updates) => updates.signupPhoneCompletedActivation === completedActivation));
  assert.ok(events.stateUpdates.some((updates) => updates.loginVerificationRequestedAt === 123456));
  assert.deepStrictEqual(events.emailStates, []);
});

test('message router does not overwrite a completed step 3 when step 2 is replayed', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'completed' } },
  });

  await router.handleStepData(2, {
    skippedPasswordStep: true,
  });

  assert.deepStrictEqual(events.stepStatuses, []);
});

test('message router skips steps 3/4/5 when step 2 detects already logged-in session', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 3: 'pending', 4: 'completed', 5: 'pending' } },
  });

  await router.handleStepData(2, {
    email: 'user@example.com',
    skipRegistrationFlow: true,
    skippedPasswordStep: true,
  });

  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.stepStatuses, [
    { step: 3, status: 'skipped' },
    { step: 5, status: 'skipped' },
  ]);
  assert.equal(events.logs[0]?.message, '步骤 2：检测到当前已登录会话，已自动跳过步骤 3/4/5，流程将直接进入步骤 6。');
});

test('message router skips step 5 when step 4 reports already logged-in transition', async () => {
  const { router, events } = createRouter({
    state: { stepStatuses: { 5: 'pending' } },
  });

  await router.handleStepData(4, {
    emailTimestamp: 123,
    skipProfileStep: true,
  });

  assert.deepStrictEqual(events.stepStatuses, [{ step: 5, status: 'skipped' }]);
  assert.equal(events.logs[0]?.message, '步骤 4：检测到账号已直接进入已登录态，已自动跳过步骤 5。');
});

test('message router skips login-code step when oauth login lands on consent page', async () => {
  const stepKeys = {
    7: 'oauth-login',
    8: 'fetch-login-code',
    9: 'confirm-oauth',
  };
  const { router, events } = createRouter({
    state: { stepStatuses: { 7: 'completed', 8: 'pending', 9: 'pending' } },
    getStepDefinitionForState: (step) => ({ id: step, key: stepKeys[step] || '' }),
    getStepIdsForState: () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  });

  await router.handleStepData(7, {
    skipLoginVerificationStep: true,
    directOAuthConsentPage: true,
  });

  assert.deepStrictEqual(events.stepStatuses, [{ step: 8, status: 'skipped' }]);
  assert.equal(events.logs.some(({ message }) => /OAuth 授权页.*步骤 8/.test(message)), true);
});

test('message router skips Plus login-code step when oauth login lands on consent page', async () => {
  const stepKeys = {
    10: 'oauth-login',
    11: 'fetch-login-code',
    12: 'confirm-oauth',
    13: 'platform-verify',
  };
  const { router, events } = createRouter({
    state: { plusModeEnabled: true, stepStatuses: { 10: 'completed', 11: 'pending', 12: 'pending', 13: 'pending' } },
    getStepDefinitionForState: (step) => ({ id: step, key: stepKeys[step] || '' }),
    getStepIdsForState: () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  });

  await router.handleStepData(10, {
    skipLoginVerificationStep: true,
    directOAuthConsentPage: true,
  });

  assert.deepStrictEqual(events.stepStatuses, [{ step: 11, status: 'skipped' }]);
  assert.equal(events.logs.some(({ message }) => /OAuth 授权页.*步骤 11/.test(message)), true);
});

test('message router finalizes step 3 before marking it completed', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'fill-password',
    source: 'openai-auth',
    payload: {
      nodeId: 'fill-password',
      email: 'user@example.com',
      signupVerificationRequestedAt: 123,
    },
  }, {});

  assert.deepStrictEqual(events.finalizePayloads, [
    {
      nodeId: 'fill-password',
      email: 'user@example.com',
      signupVerificationRequestedAt: 123,
      step: 3,
    },
  ]);
  assert.deepStrictEqual(events.stepStatuses, [{ step: 3, status: 'completed' }]);
  assert.deepStrictEqual(events.emailStates, ['user@example.com']);
  assert.deepStrictEqual(events.notifyCompletions, [
    {
      step: 3,
      nodeId: 'fill-password',
      payload: {
        nodeId: 'fill-password',
        email: 'user@example.com',
        signupVerificationRequestedAt: 123,
        step: 3,
      },
    },
  ]);
assert.deepStrictEqual(response, { ok: true });
});

test('message router saves runtime signup phone from sidepanel message', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'SAVE_SIGNUP_PHONE',
    source: 'sidepanel',
    payload: {
      phoneNumber: '66959916439',
    },
  }, {});

  assert.deepStrictEqual(events.signupPhoneStates, ['66959916439']);
  assert.deepStrictEqual(events.signupPhoneSilentStates, []);
  assert.deepStrictEqual(response, { ok: true, phoneNumber: '66959916439' });
});

test('message router finalizes pending phone activation on platform verify success', async () => {
  const state = {
    stepStatuses: { 10: 'pending' },
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
    pendingPhoneActivationConfirmation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const { router, events } = createRouter({
    state,
    getStepDefinitionForState: (step) => ({ id: step, key: step === 10 ? 'platform-verify' : '' }),
  });

  await router.handleStepData(10, {
    localhostUrl: 'http://localhost:1455/auth/callback?code=ok',
  });

  assert.equal(events.phoneFinalizations.length, 1);
  assert.deepStrictEqual(events.phoneFinalizations[0].pendingPhoneActivationConfirmation, state.pendingPhoneActivationConfirmation);
});

test('message router does not finalize pending phone activation when icloud finalization fails', async () => {
  const state = {
    stepStatuses: { 10: 'pending' },
    reusablePhoneActivation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
    pendingPhoneActivationConfirmation: {
      activationId: '123456',
      phoneNumber: '66959916439',
      successfulUses: 0,
      maxUses: 3,
    },
  };
  const { router, events } = createRouter({
    state,
    getStepDefinitionForState: (step) => ({ id: step, key: step === 10 ? 'platform-verify' : '' }),
    finalizeIcloudAliasAfterSuccessfulFlow: async () => {
      throw new Error('icloud finalize failed');
    },
  });

  await assert.rejects(
    () => router.handleStepData(10, {
      localhostUrl: 'http://localhost:1455/auth/callback?code=ok',
    }),
    /icloud finalize failed/
  );

  assert.deepStrictEqual(events.phoneFinalizations, []);
});

test('message router marks step 3 failed when post-submit finalize fails', async () => {
  const { router, events } = createRouter({
    finalizeStep3Completion: async () => {
      throw new Error('步骤 3 提交后仍停留在密码页。');
    },
  });

  const response = await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'fill-password',
    source: 'openai-auth',
    payload: {
      nodeId: 'fill-password',
      email: 'user@example.com',
    },
  }, {});

  assert.deepStrictEqual(events.stepStatuses, [{ step: 3, status: 'failed' }]);
  assert.deepStrictEqual(events.notifyErrors, [
    {
      step: 3,
      nodeId: 'fill-password',
      error: '步骤 3 提交后仍停留在密码页。',
    },
  ]);
  assert.equal(events.logs.some(({ message, nodeId }) => /失败：步骤 3 提交后仍停留在密码页。/.test(message) && nodeId === 'fill-password'), true);
  assert.deepStrictEqual(response, { ok: true, error: '步骤 3 提交后仍停留在密码页。' });
});

test('message router does not duplicate step 3 mismatch failure log after finalize already failed', async () => {
  const mismatchError = 'SIGNUP_PHONE_PASSWORD_MISMATCH::步骤 3：检测到注册手机号或密码不正确，需要重新开始当前轮。页面提示：Incorrect phone number or password';
  const state = {
    stepStatuses: {
      3: 'failed',
    },
  };
  const { router, events } = createRouter({
    state,
  });

  const response = await router.handleMessage({
    type: 'NODE_ERROR',
    nodeId: 'fill-password',
    source: 'openai-auth',
    payload: { nodeId: 'fill-password' },
    error: mismatchError,
  }, {});

  assert.deepStrictEqual(events.stepStatuses, []);
  assert.equal(events.logs.some(({ message, step }) => /失败：SIGNUP_PHONE_PASSWORD_MISMATCH::/.test(message) && step === 3), false);
  assert.deepStrictEqual(events.notifyErrors, [
    {
      step: 3,
      nodeId: 'fill-password',
      error: mismatchError,
    },
  ]);
  assert.deepStrictEqual(response, { ok: true });
});

test('message router stops the flow and surfaces cloudflare security block errors', async () => {
  const { router, events } = createRouter();

  const response = await router.handleMessage({
    type: 'NODE_ERROR',
    nodeId: 'oauth-login',
    source: 'openai-auth',
    payload: { nodeId: 'oauth-login' },
    error: 'CF_SECURITY_BLOCKED::您已触发Cloudflare 安全防护系统',
  }, {});

  assert.deepStrictEqual(events.securityBlocks, ['CF_SECURITY_BLOCKED::您已触发Cloudflare 安全防护系统']);
  assert.deepStrictEqual(events.notifyErrors, [
    {
      step: 7,
      nodeId: 'oauth-login',
      error: '流程已被用户停止。',
    },
  ]);
  assert.deepStrictEqual(response, {
    ok: true,
    error: '您已触发Cloudflare 安全防护系统',
  });
});

test('message router delegates OpenAI manual step 4 to the OpenAI node executor', async () => {
  const { router, events } = createRouter({
    getTabId: async () => null,
    isTabAlive: async () => false,
  });

  await router.handleMessage({
    type: 'EXECUTE_NODE',
    source: 'sidepanel',
    nodeId: 'fetch-signup-code',
    payload: { nodeId: 'fetch-signup-code' },
  }, {});

  assert.deepStrictEqual(events.invalidations, [
    { step: 4, options: { logLabel: '节点 fetch-signup-code 重新执行' } },
  ]);
  assert.deepStrictEqual(events.executedSteps, [4]);
});

test('message router delegates Kiro manual step 4 without OpenAI auth-tab prerequisites', async () => {
  const kiroNodeByStep = {
    1: 'kiro-open-register-page',
    2: 'kiro-submit-email',
    3: 'kiro-submit-name',
    4: 'kiro-submit-verification-code',
    5: 'kiro-submit-password',
    6: 'kiro-complete-register-consent',
    7: 'kiro-start-desktop-authorize',
    8: 'kiro-complete-desktop-authorize',
    9: 'kiro-upload-credential',
  };
  const kiroStepByNode = Object.fromEntries(
    Object.entries(kiroNodeByStep).map(([step, nodeId]) => [nodeId, Number(step)])
  );
  const { router, events } = createRouter({
    state: {
      activeFlowId: 'kiro',
      flowId: 'kiro',
      nodeStatuses: {
        'kiro-open-register-page': 'completed',
        'kiro-submit-email': 'completed',
        'kiro-submit-name': 'completed',
        'kiro-submit-verification-code': 'failed',
      },
    },
    nodeByStep: kiroNodeByStep,
    stepByNode: kiroStepByNode,
    getNodeIdsForState: () => Object.values(kiroNodeByStep),
    getTabId: async (sourceId) => {
      assert.notEqual(sourceId, 'openai-auth');
      return null;
    },
    isTabAlive: async (sourceId) => {
      assert.notEqual(sourceId, 'openai-auth');
      return false;
    },
  });

  await router.handleMessage({
    type: 'EXECUTE_NODE',
    source: 'sidepanel',
    nodeId: 'kiro-submit-verification-code',
    payload: { nodeId: 'kiro-submit-verification-code' },
  }, {});

  assert.deepStrictEqual(events.invalidations, [
    { step: 4, options: { logLabel: '节点 kiro-submit-verification-code 重新执行' } },
  ]);
  assert.deepStrictEqual(events.executedSteps, [4]);
});

test('message router resolves GPC OTP manual confirmation without completing step early', async () => {
  const state = {
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: 'otp-request-1',
    plusManualConfirmationStep: 7,
    plusManualConfirmationMethod: 'gopay-otp',
  };
  const { router, events } = createRouter({ state });

  const response = await router.handleMessage({
    type: 'RESOLVE_PLUS_MANUAL_CONFIRMATION',
    source: 'sidepanel',
    payload: {
      step: 7,
      requestId: 'otp-request-1',
      confirmed: true,
      otp: ' 12-34 56 ',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true });
  assert.equal(events.notifyCompletions.length, 0);
  assert.equal(events.stepStatuses.length, 0);
  assert.equal(events.stateUpdates[0].gopayHelperResolvedOtp, '123456');
  assert.equal(events.stateUpdates[0].plusManualConfirmationPending, false);
  assert.deepStrictEqual(events.broadcasts[0], events.stateUpdates[0]);
});

test('message router refreshes GPC balance through explicit sidepanel message', async () => {
  const state = {
    plusPaymentMethod: 'gpc-helper',
    gopayHelperApiUrl: 'http://localhost:18473/',
    gopayHelperApiKey: 'state_api_key',
  };
  const { router, events } = createRouter({ state });

  const response = await router.handleMessage({
    type: 'REFRESH_GPC_CARD_BALANCE',
    source: 'sidepanel',
    payload: {
      gopayHelperApiKey: 'payload_api_key',
      reason: 'manual',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true, balance: '余额 3', remainingUses: 3, autoModeEnabled: true, apiKeyStatus: 'active' });
  assert.equal(events.balanceRefreshes.length, 1);
  assert.equal(events.balanceRefreshes[0].state.gopayHelperApiUrl, 'http://localhost:18473/');
  assert.equal(events.balanceRefreshes[0].state.gopayHelperApiKey, 'payload_api_key');
  assert.deepStrictEqual(events.balanceRefreshes[0].options, { reason: 'manual' });
});

test('message router ignores stale step 2 errors while auto-run is already on a later step', async () => {
  const { router, events } = createRouter({
    state: {
      autoRunning: true,
      autoRunPhase: 'running',
      currentNodeId: 'wait-registration-success',
      nodeStatuses: {
        'submit-signup-email': 'completed',
        'wait-registration-success': 'running',
      },
    },
    isAutoRunLockedState: (state) => Boolean(state?.autoRunning) && state?.autoRunPhase === 'running',
  });

  const response = await router.handleMessage({
    type: 'NODE_ERROR',
    nodeId: 'submit-signup-email',
    payload: { nodeId: 'submit-signup-email' },
    error: '步骤 2：旧页面异步失败，不应覆盖当前第 6 步记录。',
  }, {});

  assert.deepStrictEqual(response, { ok: true, ignored: true });
  assert.deepStrictEqual(events.stepStatuses, []);
  assert.deepStrictEqual(events.notifyErrors, []);
  assert.deepStrictEqual(events.accountRecords, []);
  assert.equal(events.logs.some(({ message }) => /忽略过期的节点 submit-signup-email 失败消息/.test(message)), true);
});

test('message router ignores stale step 2 completion while auto-run is already on a later step', async () => {
  const { router, events } = createRouter({
    state: {
      autoRunning: true,
      autoRunPhase: 'running',
      currentNodeId: 'wait-registration-success',
      nodeStatuses: {
        'submit-signup-email': 'completed',
        'wait-registration-success': 'running',
      },
    },
    isAutoRunLockedState: (state) => Boolean(state?.autoRunning) && state?.autoRunPhase === 'running',
  });

  const response = await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'submit-signup-email',
    payload: {
      nodeId: 'submit-signup-email',
      email: 'late@example.com',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true, ignored: true });
  assert.deepStrictEqual(events.stepStatuses, []);
  assert.deepStrictEqual(events.notifyCompletions, []);
  assert.deepStrictEqual(events.emailStates, []);
  assert.equal(events.logs.some(({ message }) => /忽略过期的节点 submit-signup-email 完成消息/.test(message)), true);
});

test('message router defers fill-profile completion status until background validation', async () => {
  const { router, events } = createRouter({
    state: {
      currentNodeId: 'fill-profile',
      nodeStatuses: {
        'fill-profile': 'running',
        'wait-registration-success': 'pending',
      },
    },
  });

  const response = await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'fill-profile',
    payload: {
      nodeId: 'fill-profile',
      outcome: 'navigation_started',
      url: 'https://auth.openai.com/about-you',
      navigationStarted: true,
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true });
  assert.deepStrictEqual(events.stepStatuses, []);
  assert.deepStrictEqual(events.nodeStatuses, []);
  assert.deepStrictEqual(events.notifyCompletions, [
    {
      step: 5,
      nodeId: 'fill-profile',
      payload: {
        nodeId: 'fill-profile',
        outcome: 'navigation_started',
        url: 'https://auth.openai.com/about-you',
        navigationStarted: true,
        step: 5,
      },
    },
  ]);
  assert.equal(events.logs.some(({ message }) => /等待后台最终复核后再标记完成/.test(message)), true);
});

test('message router finalizes manual fill-profile execution through background validation', async () => {
  const finalizePayloads = [];
  const { router } = createRouter({
    state: {
      currentNodeId: 'fill-profile',
      nodeStatuses: {
        'fill-profile': 'pending',
      },
    },
    executeNodeViaCompletionSignal: async (nodeId) => ({
      nodeId,
      outcome: 'logged_in_home',
      url: 'https://chatgpt.com/',
    }),
    doesNodeUseCompletionSignal: (nodeId) => nodeId === 'fill-profile',
    finalizeStep5Completion: async (payload) => {
      finalizePayloads.push(payload);
    },
  });

  const response = await router.handleMessage({
    type: 'EXECUTE_NODE',
    source: 'sidepanel',
    nodeId: 'fill-profile',
    payload: {
      nodeId: 'fill-profile',
    },
  }, {});

  assert.deepStrictEqual(response, { ok: true });
  assert.deepStrictEqual(finalizePayloads, [
    {
      nodeId: 'fill-profile',
      outcome: 'logged_in_home',
      url: 'https://chatgpt.com/',
    },
  ]);
});
