(function attachBackgroundPayPalApprove(root, factory) {
  root.MultiPageBackgroundPayPalApprove = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPayPalApproveModule() {
  const PAYPAL_SOURCE = 'paypal-flow';
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PAYPAL_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/paypal-flow.js'];
  const PAYPAL_LOGIN_TRANSITION_TIMEOUT_MS = 30000;
  const PAYPAL_LOGIN_TRANSITION_POLL_MS = 500;

  function createPayPalApproveExecutor(deps = {}) {
    const {
      addLog,
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTabUntilStopped,
      getTabId,
      isTabAlive,
      queryTabsInAutomationWindow = null,
      sendTabMessageUntilStopped,
      setState,
      sleepWithStop,
      waitForTabCompleteUntilStopped,
      waitForTabUrlMatchUntilStopped,
    } = deps;

    async function resolvePayPalTabId(state = {}) {
      const paypalTabId = await getTabId(PAYPAL_SOURCE);
      if (paypalTabId && await isTabAlive(PAYPAL_SOURCE)) {
        return paypalTabId;
      }
      const discoveredPayPalTabId = await findOpenPayPalTabId();
      if (discoveredPayPalTabId) {
        await addLog('Step 8: Found the PayPal page in the current browser tabs. Taking over and continuing.', 'info');
        return discoveredPayPalTabId;
      }
      const checkoutTabId = await getTabId(PLUS_CHECKOUT_SOURCE);
      if (checkoutTabId) {
        return checkoutTabId;
      }
      const storedTabId = Number(state.plusCheckoutTabId) || 0;
      if (storedTabId) {
        return storedTabId;
      }
      throw new Error('Step 8: PayPal tab not found. Complete Step 7 first.');
    }

    async function findOpenPayPalTabId() {
      if (!chrome?.tabs?.query) {
        return 0;
      }

      const queryTabs = typeof queryTabsInAutomationWindow === 'function'
        ? queryTabsInAutomationWindow
        : (queryInfo) => chrome.tabs.query(queryInfo);
      const tabs = await queryTabs({}).catch(() => []);
      const candidates = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => Number.isInteger(tab?.id) && isPayPalUrl(tab.url || ''));
      if (!candidates.length) {
        return 0;
      }

      const match = candidates.find((tab) => tab.active && tab.currentWindow)
        || candidates.find((tab) => tab.active)
        || candidates[0];
      if (match?.id && chrome?.tabs?.update) {
        await chrome.tabs.update(match.id, { active: true }).catch(() => {});
      }
      return match?.id || 0;
    }

    async function ensurePayPalReady(tabId, logMessage = '') {
      await waitForTabUrlMatchUntilStopped(tabId, (url) => /paypal\./i.test(url));
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PAYPAL_SOURCE, tabId, {
        inject: PAYPAL_INJECT_FILES,
        injectSource: PAYPAL_SOURCE,
        logMessage: logMessage || 'Step 8: PayPal page is still loading. Waiting for the script to become ready...',
      });
    }

    async function getPayPalState(tabId) {
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_GET_STATE',
        source: 'background',
        payload: {},
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function dismissPrompts(tabId) {
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_DISMISS_PROMPTS',
        source: 'background',
        payload: {},
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    function resolvePayPalCredentials(state = {}) {
      const currentId = String(state?.currentPayPalAccountId || '').trim();
      const accounts = Array.isArray(state?.paypalAccounts) ? state.paypalAccounts : [];
      const selectedAccount = currentId
        ? accounts.find((account) => String(account?.id || '').trim() === currentId) || null
        : null;
      return {
        email: String(selectedAccount?.email || state?.paypalEmail || '').trim(),
        password: String(selectedAccount?.password || state?.paypalPassword || ''),
      };
    }

    async function submitLogin(tabId, state = {}) {
      const credentials = resolvePayPalCredentials(state);
      if (!credentials.password) {
        throw new Error('Step 8: No available PayPal account is configured. Add and select one in the side panel first.');
      }
      await addLog('Step 8: Filling in PayPal login details and submitting...', 'info');
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_SUBMIT_LOGIN',
        source: 'background',
        payload: {
          email: credentials.email,
          password: credentials.password,
        },
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    function isPayPalUrl(url = '') {
      return /paypal\./i.test(String(url || ''));
    }

    function isPayPalPasswordState(pageState = {}) {
      return Boolean(pageState.hasPasswordInput)
        || pageState.loginPhase === 'password'
        || pageState.loginPhase === 'login_combined';
    }

    async function waitForPayPalPostLoginDecision(tabId, actionResult = {}) {
      const phase = String(actionResult?.phase || '').trim();
      const startedAt = Date.now();

      while (Date.now() - startedAt < PAYPAL_LOGIN_TRANSITION_TIMEOUT_MS) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
          throw new Error('Step 8: PayPal tab was closed. Cannot continue identifying the page after login.');
        }

        const currentUrl = tab.url || '';
        if (!currentUrl) {
          await sleepWithStop(PAYPAL_LOGIN_TRANSITION_POLL_MS);
          continue;
        }
        if (currentUrl && !isPayPalUrl(currentUrl)) {
          return {
            outcome: 'left_paypal',
            url: currentUrl,
          };
        }

        if (tab.status !== 'complete') {
          await sleepWithStop(PAYPAL_LOGIN_TRANSITION_POLL_MS);
          continue;
        }

        await ensurePayPalReady(
          tabId,
          phase === 'email_submitted'
            ? 'Step 8: PayPal account submitted. Identifying the next page...'
            : 'Step 8: PayPal password submitted. Identifying the navigation result...'
        );
        const pageState = await getPayPalState(tabId);

        if (pageState.hasPasskeyPrompt) {
          return {
            outcome: 'prompt',
            pageState,
          };
        }

        if (pageState.approveReady) {
          return {
            outcome: 'approve_ready',
            pageState,
          };
        }

        if (phase === 'email_submitted' && isPayPalPasswordState(pageState)) {
          return {
            outcome: 'password_ready',
            pageState,
          };
        }

        if (phase === 'password_submitted' && !pageState.needsLogin) {
          return {
            outcome: 'post_login_state',
            pageState,
          };
        }

        await sleepWithStop(PAYPAL_LOGIN_TRANSITION_POLL_MS);
      }

      return {
        outcome: 'timeout',
        phase,
      };
    }

    async function clickApprove(tabId) {
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_CLICK_APPROVE',
        source: 'background',
        payload: {},
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return Boolean(result?.clicked);
    }

    async function executePayPalApprove(state = {}) {
      const tabId = await resolvePayPalTabId(state);
      await ensurePayPalReady(tabId);
      await setState({ plusCheckoutTabId: tabId });

      let loggedWaiting = false;
      while (true) {
        const currentUrl = (await chrome.tabs.get(tabId).catch(() => null))?.url || '';
        if (currentUrl && !isPayPalUrl(currentUrl)) {
          await addLog('Step 8: PayPal has navigated away from the authorization page. Preparing to confirm the return.', 'ok');
          break;
        }

        await ensurePayPalReady(tabId, 'Step 8: PayPal page is switching. Waiting for the script to become ready again...');
        const pageState = await getPayPalState(tabId);

        if (pageState.needsLogin) {
          const submitResult = await submitLogin(tabId, state);
          const decision = await waitForPayPalPostLoginDecision(tabId, submitResult);
          if (decision.outcome === 'left_paypal') {
            await addLog('Step 8: After PayPal login, the page has left the login/authorization view. Continuing to return confirmation.', 'ok');
            break;
          }
          if (decision.outcome === 'password_ready') {
            await addLog('Step 8: After submitting the PayPal account page, the password page was detected. Continuing to fill the password.', 'info');
          } else if (decision.outcome === 'approve_ready') {
            await addLog('Step 8: After PayPal login, the authorization confirmation page was detected. Continuing to authorize.', 'info');
          } else if (decision.outcome === 'prompt') {
            await addLog('Step 8: After PayPal login, a prompt dialog was detected. Continuing to handle it.', 'info');
          } else if (decision.outcome === 'timeout') {
            await addLog('Step 8: No new page was detected after the PayPal login action. Rechecking the current page state.', 'warn');
          }
          loggedWaiting = false;
          continue;
        }

        if (pageState.hasPasskeyPrompt) {
          await addLog('Step 8: Detected a PayPal passkey prompt. Closing it...', 'info');
          await dismissPrompts(tabId);
          await sleepWithStop(1000);
          continue;
        }

        const dismissed = await dismissPrompts(tabId).catch(() => ({ clicked: 0 }));
        if (dismissed.clicked) {
          await sleepWithStop(1000);
          continue;
        }

        if (pageState.approveReady) {
          await addLog('Step 8: Clicking PayPal "Agree and continue"...', 'info');
          const clicked = await clickApprove(tabId);
          if (clicked) {
            await setState({ plusPaypalApprovedAt: Date.now() });
            break;
          }
        }

        if (!loggedWaiting) {
          loggedWaiting = true;
          await addLog('Step 8: Waiting for the PayPal authorization button or the next page to appear...', 'info');
        }
        await sleepWithStop(500);
      }

      await completeNodeFromBackground('paypal-approve', {
        plusPaypalApprovedAt: Date.now(),
      });
    }

    return {
      executePayPalApprove,
    };
  }

  return {
    createPayPalApproveExecutor,
  };
});
