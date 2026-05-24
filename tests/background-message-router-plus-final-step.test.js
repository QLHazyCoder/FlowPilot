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
    'oauth-login',
    'fetch-login-code',
    'confirm-oauth',
    finalNodeId,
  ];
  const nodeStepMap = {
    'oauth-login': 10,
    'fetch-login-code': 11,
    'confirm-oauth': 12,
    'platform-verify': 13,
    'sub2api-session-import': 10,
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
    getState: async () => ({ plusModeEnabled: true, nodeStatuses: { [finalNodeId]: 'pending' } }),
    getNodeIdsForState: () => nodeIds.slice(),
    getStepIdByNodeIdForState: (nodeId) => nodeStepMap[nodeId] || 0,
    getLastStepIdForState: () => Math.max(...Object.values(nodeStepMap)),
    getStepDefinitionForState: (step) => ({
      id: step,
      key: Object.entries(nodeStepMap).find(([, mappedStep]) => mappedStep === step)?.[0] || finalNodeId,
    }),
    getStepIdsForState: () => Object.values(nodeStepMap),
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
    setAccountContributionMode: async () => {},
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

test('message router appends success record on Plus final step instead of hard-coded step 10', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'platform-verify',
    nodeIds: ['open-chatgpt', 'oauth-login', 'fetch-login-code', 'confirm-oauth', 'platform-verify'],
    nodeStepMap: {
      'oauth-login': 10,
      'fetch-login-code': 11,
      'confirm-oauth': 12,
      'platform-verify': 13,
    },
  });

  await router.handleMessage({ type: 'NODE_COMPLETE', nodeId: 'platform-verify', payload: { nodeId: 'platform-verify' } }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});

test('message router appends success record when SUB2API session import is the final Plus node', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'sub2api-session-import',
    nodeIds: [
      'open-chatgpt',
      'plus-checkout-create',
      'plus-checkout-billing',
      'paypal-approve',
      'plus-checkout-return',
      'sub2api-session-import',
    ],
    nodeStepMap: {
      'plus-checkout-create': 6,
      'plus-checkout-billing': 7,
      'paypal-approve': 8,
      'plus-checkout-return': 9,
      'sub2api-session-import': 10,
    },
  });

  await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'sub2api-session-import',
    payload: { nodeId: 'sub2api-session-import' },
  }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});

test('message router appends success record when CPA session import is the final Plus node', async () => {
  const { appendCalls, router } = createRouterWithFinalNode({
    finalNodeId: 'cpa-session-import',
    nodeIds: [
      'open-chatgpt',
      'plus-checkout-create',
      'plus-checkout-billing',
      'paypal-approve',
      'plus-checkout-return',
      'cpa-session-import',
    ],
    nodeStepMap: {
      'plus-checkout-create': 6,
      'plus-checkout-billing': 7,
      'paypal-approve': 8,
      'plus-checkout-return': 9,
      'cpa-session-import': 10,
    },
  });

  await router.handleMessage({
    type: 'NODE_COMPLETE',
    nodeId: 'cpa-session-import',
    payload: { nodeId: 'cpa-session-import' },
  }, {});

  assert.equal(appendCalls.length, 1);
  assert.equal(appendCalls[0][0], 'success');
});
