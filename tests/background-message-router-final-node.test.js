const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background/message-router.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundMessageRouter;`)(globalScope);

function createRouterWithFinalNode(options = {}) {
  const finalNodeId = String(options.finalNodeId || 'platform-verify').trim();
  const nodeIds = Array.isArray(options.nodeIds) ? options.nodeIds.slice() : [
    'open-chatgpt',
    'submit-signup-email',
    'fill-password',
    'fetch-signup-code',
    'fill-profile',
    'wait-registration-success',
    'oauth-login',
    'fetch-login-code',
    'post-login-phone-verification',
    'confirm-oauth',
    finalNodeId,
  ];
  const nodeStepMap = {
    'open-chatgpt': 1,
    'submit-signup-email': 2,
    'fill-password': 3,
    'fetch-signup-code': 4,
    'fill-profile': 5,
    'wait-registration-success': 6,
    'oauth-login': 7,
    'fetch-login-code': 8,
    'post-login-phone-verification': 9,
    'confirm-oauth': 10,
    'platform-verify': 11,
    'cpa-session-import': 7,
    'sub2api-session-import': 7,
    'sub2api-agent-identity-import': 7,
    ...(options.nodeStepMap || {}),
  };
  const appendCalls = [];

  const router = api.createMessageRouter({
    addLog: async () => {},
    appendAccountRunRecord: async (...args) => {
      appendCalls.push(args);
    },
    batchUpdateLuckmailPurchases: async () => {},
    buildLocalhostCleanupPrefix: () => '',
    buildLuckmailSessionSettingsPayload: () => ({}),
    buildPersistentSettingsPayload: () => ({}),
    broadcastDataUpdate: () => {},
    checkIcloudSession: async () => {},
    clearAutoRunTimerAlarm: async () => {},
    clearLuckmailRuntimeState: async () => {},
    clearStopRequest: () => {},
    closeLocalhostCallbackTabs: async () => {},
    closeTabsByUrlPrefix: async () => {},
    deleteHotmailAccount: async () => {},
    deleteHotmailAccounts: async () => {},
    deleteIcloudAlias: async () => {},
    deleteUsedIcloudAliases: async () => {},
    disableUsedLuckmailPurchases: async () => {},
    doesNodeUseCompletionSignal: () => false,
    ensureManualInteractionAllowed: async () => ({}),
    executeNode: async () => {},
    executeNodeViaCompletionSignal: async () => {},
    exportSettingsBundle: async () => ({}),
    fetchGeneratedEmail: async () => '',
    finalizeStep3Completion: async () => {},
    finalizeIcloudAliasAfterSuccessfulFlow: async () => {},
    findHotmailAccount: async () => null,
    flushCommand: async () => {},
    getCurrentLuckmailPurchase: () => null,
    getPendingAutoRunTimerPlan: () => null,
    getSourceLabel: () => '',
    getState: async () => ({
      activeFlowId: 'openai',
      targetId: options.targetId || 'cpa',
      accountDeliveryMode: options.accountDeliveryMode || 'oauth',
      accountDeliveryRouteId: options.accountDeliveryRouteId || 'oauth',
      plusModeEnabled: false,
      plusPaymentMethod: 'paypal',
      nodeStatuses: { [finalNodeId]: 'pending' },
    }),
    getNodeIdsForState: () => nodeIds.slice(),
    getStepIdByNodeIdForState: (nodeId) => nodeStepMap[nodeId] || 0,
    getLastStepIdForState: () => Math.max(...nodeIds.map((nodeId) => nodeStepMap[nodeId] || 0)),
    getStepDefinitionForState: (step) => ({
      id: step,
      key: nodeIds.find((nodeId) => nodeStepMap[nodeId] === step) || finalNodeId,
    }),
    getStepIdsForState: () => nodeIds.map((nodeId) => nodeStepMap[nodeId] || 0),
    getTabId: async () => null,
    getStopRequested: () => false,
    handleAutoRunLoopUnhandledError: async () => {},
    handleCloudflareSecurityBlocked: async () => '',
    importSettingsBundle: async () => {},
    invalidateDownstreamAfterStepRestart: async () => {},
    isCloudflareSecurityBlockedError: () => false,
    isAutoRunLockedState: () => false,
    isHotmailProvider: () => false,
    isLocalhostOAuthCallbackUrl: () => true,
    isLuckmailProvider: () => false,
    isStopError: () => false,
    isTabAlive: async () => false,
    launchAutoRunTimerPlan: async () => {},
    listIcloudAliases: async () => [],
    listLuckmailPurchasesForManagement: async () => [],
    normalizeHotmailAccounts: (items) => items,
    normalizeRunCount: (value) => value,
    notifyNodeComplete: () => {},
    notifyNodeError: () => {},
    patchHotmailAccount: async () => {},
    patchMail2925Account: async () => {},
    registerTab: async () => {},
    requestStop: async () => {},
    resetState: async () => {},
    resumeAutoRun: async () => {},
    selectLuckmailPurchase: async () => {},
    setCurrentHotmailAccount: async () => {},
    setCurrentMail2925Account: async () => {},
    setEmailState: async () => {},
    setEmailStateSilently: async () => {},
    setIcloudAliasPreservedState: async () => {},
    setIcloudAliasUsedState: async () => {},
    setLuckmailPurchaseDisabledState: async () => {},
    setLuckmailPurchasePreservedState: async () => {},
    setLuckmailPurchaseUsedState: async () => {},
    setPersistentSettings: async () => {},
    setState: async () => {},
    setNodeStatus: async () => {},
    skipAutoRunCountdown: async () => false,
    skipNode: async () => {},
    startAutoRunLoop: async () => {},
    syncHotmailAccounts: async () => {},
    testHotmailAccountMailAccess: async () => {},
    upsertHotmailAccount: async () => {},
    verifyHotmailAccount: async () => {},
  });

  return {
    appendCalls,
    router,
  };
}

test('message router appends success record on the resolved OAuth workflow final node', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'platform-verify',
  });

  await router.handleMessage({ type: 'NODE_COMPLETE', nodeId: 'platform-verify', payload: { nodeId: 'platform-verify' } }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});

test('message router appends success record when SUB2API Session delivery is the final node', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'sub2api-session-import',
    targetId: 'sub2api',
    accountDeliveryMode: 'session',
    accountDeliveryRouteId: 'sub2api-session',
    nodeIds: [
      'open-chatgpt',
      'submit-signup-email',
      'fill-password',
      'fetch-signup-code',
      'fill-profile',
      'wait-registration-success',
      'sub2api-session-import',
    ],
  });

  await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'sub2api-session-import',
    payload: { nodeId: 'sub2api-session-import' },
  }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});

test('message router appends success record when CPA Session delivery is the final node', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'cpa-session-import',
    targetId: 'cpa',
    accountDeliveryMode: 'session',
    accountDeliveryRouteId: 'cpa-session',
    nodeIds: [
      'open-chatgpt',
      'submit-signup-email',
      'fill-password',
      'fetch-signup-code',
      'fill-profile',
      'wait-registration-success',
      'cpa-session-import',
    ],
  });

  await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'cpa-session-import',
    payload: { nodeId: 'cpa-session-import' },
  }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});

test('message router appends success record when Agent Identity delivery is the final node', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'sub2api-agent-identity-import',
    targetId: 'sub2api',
    accountDeliveryMode: 'agent_identity',
    accountDeliveryRouteId: 'sub2api-agent-identity',
    nodeIds: [
      'open-chatgpt',
      'submit-signup-email',
      'fill-password',
      'fetch-signup-code',
      'fill-profile',
      'wait-registration-success',
      'sub2api-agent-identity-import',
    ],
  });

  await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'sub2api-agent-identity-import',
    payload: { nodeId: 'sub2api-agent-identity-import' },
  }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});
