(function attachBackgroundPlusReturnConfirm(root, factory) {
  root.MultiPageBackgroundPlusReturnConfirm = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusReturnConfirmModule() {
  const PAYPAL_SOURCE = 'paypal-flow';
  const GOPAY_SOURCE = 'gopay-flow';
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_RETURN_SETTLE_WAIT_MS = 20000;

  function createPlusReturnConfirmExecutor(deps = {}) {
    const {
      addLog,
      completeNodeFromBackground,
      getTabId,
      isTabAlive,
      setState,
      sleepWithStop,
      waitForTabUrlMatchUntilStopped,
    } = deps;

    async function resolveReturnTabId(state = {}) {
      const paypalTabId = await getTabId(PAYPAL_SOURCE);
      if (paypalTabId && await isTabAlive(PAYPAL_SOURCE)) {
        return paypalTabId;
      }
      const gopayTabId = await getTabId(GOPAY_SOURCE);
      if (gopayTabId && await isTabAlive(GOPAY_SOURCE)) {
        return gopayTabId;
      }
      const checkoutTabId = await getTabId(PLUS_CHECKOUT_SOURCE);
      if (checkoutTabId) {
        return checkoutTabId;
      }
      const storedTabId = Number(state.plusCheckoutTabId) || 0;
      if (storedTabId) {
        return storedTabId;
      }
      throw new Error('Step 9: Plus / PayPal / GoPay tab not found. Cannot confirm the subscription return.');
    }

    function isReturnUrl(url = '') {
      return /https:\/\/(?:chatgpt\.com|chat\.openai\.com|openai\.com)\//i.test(String(url || ''))
        && !/paypal\.|gopay|gojek|midtrans|xendit|stripe/i.test(String(url || ''));
    }

    async function executePlusReturnConfirm(state = {}) {
      const tabId = await resolveReturnTabId(state);
      await addLog('Step 9: Waiting to return to the ChatGPT / OpenAI page after payment authorization...', 'info');
      const tab = await waitForTabUrlMatchUntilStopped(tabId, isReturnUrl);
      await addLog('Step 9: Subscription return page detected. Waiting a fixed 20 seconds for the page to finish loading.', 'info');
      await sleepWithStop(PLUS_RETURN_SETTLE_WAIT_MS);

      await setState({
        plusCheckoutTabId: tabId,
        plusReturnUrl: tab?.url || '',
      });
      await completeNodeFromBackground('plus-checkout-return', {
        plusReturnUrl: tab?.url || '',
      });
    }

    return {
      executePlusReturnConfirm,
    };
  }

  return {
    createPlusReturnConfirmExecutor,
  };
});
