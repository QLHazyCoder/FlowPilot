(function attachBackgroundGoPayManualConfirm(root, factory) {
  root.MultiPageBackgroundGoPayManualConfirm = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundGoPayManualConfirmModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const GOPAY_CONFIRM_NODE_ID = 'gopay-subscription-confirm';
  const SUB2API_SESSION_IMPORT_NODE_ID = 'sub2api-session-import';
  const CPA_SESSION_IMPORT_NODE_ID = 'cpa-session-import';
  const DEFAULT_CONFIRM_TITLE = 'GoPay subscription confirmation';
  const OAUTH_CONTINUATION_LABEL = 'OAuth login';
  const SUB2API_SESSION_CONTINUATION_LABEL = 'Import current ChatGPT session to SUB2API';

  const CPA_SESSION_CONTINUATION_LABEL = 'Import current ChatGPT session to CPA';

  function normalizeString(value = '') {
    return String(value || '').trim();
  }

  function getContinuationActionLabelForNodeId(nodeId = '') {
    const normalizedNodeId = normalizeString(nodeId);
    if (normalizedNodeId === SUB2API_SESSION_IMPORT_NODE_ID) {
      return SUB2API_SESSION_CONTINUATION_LABEL;
    }
    if (normalizedNodeId === CPA_SESSION_IMPORT_NODE_ID) {
      return CPA_SESSION_CONTINUATION_LABEL;
    }
    return OAUTH_CONTINUATION_LABEL;
  }

  function getContinuationActionLabel(state = {}, options = {}) {
    const { getNodeIdsForState = null } = options;
    if (typeof getNodeIdsForState === 'function') {
      const nodeIds = getNodeIdsForState(state)
        .map((nodeId) => normalizeString(nodeId))
        .filter(Boolean);
      const currentNodeId = normalizeString(state?.nodeId || GOPAY_CONFIRM_NODE_ID) || GOPAY_CONFIRM_NODE_ID;
      const currentNodeIndex = nodeIds.indexOf(currentNodeId);
      const nextNodeId = currentNodeIndex >= 0
        ? normalizeString(nodeIds[currentNodeIndex + 1])
        : '';

      if (nextNodeId) {
        return getContinuationActionLabelForNodeId(nextNodeId);
      }
      if (currentNodeIndex < 0) {
        if (nodeIds.includes(SUB2API_SESSION_IMPORT_NODE_ID)) {
          return SUB2API_SESSION_CONTINUATION_LABEL;
        }
        if (nodeIds.includes(CPA_SESSION_IMPORT_NODE_ID)) {
          return CPA_SESSION_CONTINUATION_LABEL;
        }
      }
    }
    return OAUTH_CONTINUATION_LABEL;
  }

  function buildDefaultConfirmMessage(state = {}, options = {}) {
    const continuationActionLabel = getContinuationActionLabel(state, options);
    return `The GoPay subscription page is open. Please complete the subscription manually first, then confirm to continue ${continuationActionLabel}。`;
  }

  function createGoPayManualConfirmExecutor(deps = {}) {
    const {
      addLog,
      broadcastDataUpdate,
      chrome,
      createAutomationTab = null,
      getTabId,
      getNodeIdsForState = null,
      isTabAlive,
      registerTab,
      setState,
    } = deps;

    function buildRequestId() {
      return `gopay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    async function resolveCheckoutTabId(state = {}) {
      const registeredTabId = typeof getTabId === 'function'
        ? await getTabId(PLUS_CHECKOUT_SOURCE)
        : null;
      if (registeredTabId && typeof isTabAlive === 'function' && await isTabAlive(PLUS_CHECKOUT_SOURCE)) {
        return Number(registeredTabId) || 0;
      }

      const storedTabId = Number(state?.plusCheckoutTabId) || 0;
      if (storedTabId && chrome?.tabs?.get) {
        const tab = await chrome.tabs.get(storedTabId).catch(() => null);
        if (tab?.id) {
          if (typeof registerTab === 'function') {
            await registerTab(PLUS_CHECKOUT_SOURCE, tab.id);
          }
          return tab.id;
        }
      }

      const checkoutUrl = normalizeString(state?.plusCheckoutUrl);
      if (!checkoutUrl) {
        throw new Error('Step 7: GoPay subscription page not detected. Run Step 6 first.');
      }

      if (!chrome?.tabs?.create) {
        throw new Error('Step 7: Could not automatically reopen the GoPay subscription page.');
      }

      const tab = typeof createAutomationTab === 'function'
        ? await createAutomationTab({ url: checkoutUrl, active: true })
        : await chrome.tabs.create({ url: checkoutUrl, active: true });
      const tabId = Number(tab?.id) || 0;
      if (!tabId) {
        throw new Error('Step 7: Failed to reopen the GoPay subscription page.');
      }
      if (typeof registerTab === 'function') {
        await registerTab(PLUS_CHECKOUT_SOURCE, tabId);
      }
      return tabId;
    }

    async function executeGoPayManualConfirm(state = {}) {
      const visibleStep = Number(state?.visibleStep) || 7;
      const tabId = await resolveCheckoutTabId(state);
      if (chrome?.tabs?.update && tabId) {
        await chrome.tabs.update(tabId, { active: true }).catch(() => {});
      }

      const continuationActionLabel = getContinuationActionLabel(state, { getNodeIdsForState });
      const payload = {
        plusCheckoutTabId: tabId,
        plusManualConfirmationPending: true,
        plusManualConfirmationRequestId: buildRequestId(),
        plusManualConfirmationStep: visibleStep,
        plusManualConfirmationMethod: 'gopay',
        plusManualConfirmationTitle: DEFAULT_CONFIRM_TITLE,
        plusManualConfirmationMessage: buildDefaultConfirmMessage(state, { getNodeIdsForState }),
      };

      await setState(payload);
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(payload);
      }

      await addLog(
        `Step ${visibleStep}: Waiting for manual GoPay subscription completion. After confirmation, continue ${continuationActionLabel}。`,
        'info'
      );
    }

    return {
      executeGoPayManualConfirm,
    };
  }

  return {
    createGoPayManualConfirmExecutor,
  };
});
