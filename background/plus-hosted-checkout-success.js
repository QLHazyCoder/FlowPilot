(function attachPlusHostedCheckoutSuccess(root, factory) {
  root.MultiPagePlusHostedCheckoutSuccess = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createPlusHostedCheckoutSuccessModule() {
  const PAYMENT_SUCCESS_URL_PATTERN = /^https:\/\/(?:chatgpt\.com|www\.chatgpt\.com|chat\.openai\.com)\/(?:backend-api\/)?payments\/success(?:[/?#]|$)/i;
  const PLUS_CHECKOUT_NODE_ID = 'plus-checkout-create';
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';

  function normalizeString(value = '') {
    return String(value || '').trim();
  }

  function normalizePaymentMethod(value = '') {
    return normalizeString(value).toLowerCase();
  }

  function isPaymentSuccessUrl(url = '') {
    return PAYMENT_SUCCESS_URL_PATTERN.test(normalizeString(url));
  }

  function isRunnableNodeStatus(value = '') {
    const normalized = normalizeString(value).toLowerCase();
    return !normalized || normalized === 'pending' || normalized === 'running';
  }

  function isHostedCheckoutSuccessWaitActive(state = {}, tabId = null) {
    if (!state || typeof state !== 'object') {
      return false;
    }
    if (!state.plusModeEnabled) {
      return false;
    }
    if (normalizePaymentMethod(state.plusPaymentMethod) !== PLUS_PAYMENT_METHOD_PAYPAL) {
      return false;
    }
    if (state.plusHostedCheckoutCompletionPending !== true) {
      return false;
    }

    const checkoutTabId = Number(state.plusCheckoutTabId);
    if (!Number.isInteger(checkoutTabId) || checkoutTabId <= 0) {
      return false;
    }
    if (tabId !== null && checkoutTabId !== Number(tabId)) {
      return false;
    }

    return isRunnableNodeStatus(state.nodeStatuses?.[PLUS_CHECKOUT_NODE_ID]);
  }

  function createPlusHostedCheckoutSuccessManager(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      completeNodeFromBackground = null,
      failNodeFromBackground = null,
      getState = async () => ({}),
      setState = async () => {},
    } = deps;

    const activeTabIds = new Set();

    function addLog(message, level = 'info', options = {}) {
      return rawAddLog(message, level, {
        stepKey: PLUS_CHECKOUT_NODE_ID,
        nodeId: PLUS_CHECKOUT_NODE_ID,
        ...(options && typeof options === 'object' ? options : {}),
      });
    }

    async function completeFromSuccessTab(tabId, successUrl = '') {
      const numericTabId = Number(tabId);
      if (!Number.isInteger(numericTabId) || numericTabId <= 0) {
        return null;
      }
      if (activeTabIds.has(numericTabId)) {
        return null;
      }
      activeTabIds.add(numericTabId);

      try {
        const initialState = await getState();
        if (!isHostedCheckoutSuccessWaitActive(initialState, numericTabId)) {
          return null;
        }

        const latestState = await getState();
        if (!isHostedCheckoutSuccessWaitActive(latestState, numericTabId)) {
          return null;
        }

        const normalizedSuccessUrl = normalizeString(successUrl);
        await setState({
          plusReturnUrl: normalizedSuccessUrl,
        });
        await addLog('Detected ChatGPT payment success page; continuing Plus session import flow.', 'ok');

        if (typeof completeNodeFromBackground === 'function') {
          await completeNodeFromBackground(PLUS_CHECKOUT_NODE_ID, {
            plusReturnUrl: normalizedSuccessUrl,
            plusHostedCheckoutCompleted: true,
          });
        }

        await setState({
          plusHostedCheckoutCompletionPending: false,
          plusHostedCheckoutCompleted: true,
        });

        return {
          completed: true,
          plusReturnUrl: normalizedSuccessUrl,
        };
      } catch (error) {
        const message = normalizeString(error?.message) || 'unknown error';
        await addLog(`Failed to continue after ChatGPT payment success page: ${message}`, 'error');
        if (typeof failNodeFromBackground === 'function') {
          await failNodeFromBackground(PLUS_CHECKOUT_NODE_ID, message);
          return {
            completed: false,
            failed: true,
            message,
          };
        }
        throw error;
      } finally {
        activeTabIds.delete(numericTabId);
      }
    }

    async function handleTabUpdated(tabId, changeInfo = {}, tab = {}) {
      if (changeInfo?.status !== 'complete' && tab?.status !== 'complete') {
        return null;
      }
      const nextUrl = normalizeString(changeInfo?.url || tab?.url);
      if (!isPaymentSuccessUrl(nextUrl)) {
        return null;
      }
      return completeFromSuccessTab(tabId, nextUrl);
    }

    return {
      completeFromSuccessTab,
      handleTabUpdated,
      isHostedCheckoutSuccessWaitActive,
      isPaymentSuccessUrl,
    };
  }

  return {
    createPlusHostedCheckoutSuccessManager,
    isHostedCheckoutSuccessWaitActive,
    isPaymentSuccessUrl,
  };
});
