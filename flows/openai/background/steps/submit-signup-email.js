(function attachBackgroundStep2(root, factory) {
  root.MultiPageBackgroundStep2 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep2Module() {
  function createStep2Executor(deps = {}) {
    const {
      addLog,
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab,
      ensureSignupAuthEntryPageReady,
      ensureSignupEntryPageReady,
      ensureSignupPostEmailPageReadyInTab,
      ensureSignupPostIdentityPageReadyInTab = ensureSignupPostEmailPageReadyInTab,
      getTabId,
      isTabAlive,
      phoneVerificationHelpers = null,
      resolveSignupMethod = () => 'email',
      resolveSignupEmailForFlow,
      sendToContentScriptResilient,
      OPENAI_AUTH_INJECT_FILES,
      waitForTabStableComplete = null,
    } = deps;

    function getErrorMessage(error) {
      return String(typeof error === 'string' ? error : error?.message || '');
    }

    function isSignupEntryUnavailableErrorMessage(errorLike) {
      const message = getErrorMessage(errorLike);
      return /No available email input entry found|当前页面没有可用的注册入口，也不在邮箱\/密码页/i.test(message);
    }

    function isSignupPhoneEntryUnavailableErrorMessage(errorLike) {
      const message = getErrorMessage(errorLike);
      return /No available phone number input entry found|The current page has no available phone signup entry and is not on the password page/i.test(message);
    }

    function isRetryableStep2TransportErrorMessage(errorLike) {
      const message = getErrorMessage(errorLike);
      return /Content script on [\w-]+ did not respond in \d+s|content script\s+\d+(?:\.\d+)?\s*did not respond within seconds|Receiving end does not exist|message channel closed|A listener indicated an asynchronous response|port closed before a response was received|did not respond in \d+s/i.test(message);
    }

    function isLikelyLoggedInChatgptHomeUrl(rawUrl) {
      const url = String(rawUrl || '').trim();
      if (!url) {
        return false;
      }

      try {
        const parsed = new URL(url);
        const host = String(parsed.hostname || '').toLowerCase();
        if (!['chatgpt.com', 'www.chatgpt.com'].includes(host)) {
          return false;
        }

        const path = String(parsed.pathname || '');
        if (/^\/(?:auth\/|create-account\/|email-verification|log-in|add-phone)(?:[/?#]|$)/i.test(path)) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    }

    function isReadySignupEntryState(state = '') {
      const normalized = String(state || '').trim().toLowerCase();
      return normalized === 'entry_home'
        || normalized === 'email_entry'
        || normalized === 'phone_entry'
        || normalized === 'password_page';
    }

    async function getSignupEntryReadyState(tabId) {
      if (!Number.isInteger(tabId) || typeof sendToContentScriptResilient !== 'function') {
        return '';
      }

      try {
        const result = await sendToContentScriptResilient('openai-auth', {
          type: 'ENSURE_SIGNUP_ENTRY_READY',
          step: 2,
          source: 'background',
          payload: {},
        }, {
          timeoutMs: 12000,
          retryDelayMs: 500,
          logMessage: 'Step 2: Checking the official website signup entry state...',
        });
        if (result?.error) {
          return '';
        }
        return String(result?.state || '').trim().toLowerCase();
      } catch {
        return '';
      }
    }

    async function isLikelyLoggedInChatgptHomeTab(tabId) {
      if (typeof chrome?.tabs?.get !== 'function') {
        return false;
      }

      const readyState = await getSignupEntryReadyState(tabId);
      if (isReadySignupEntryState(readyState)) {
        return false;
      }

      const currentUrl = await getTabUrl(tabId);
      return isLikelyLoggedInChatgptHomeUrl(currentUrl);
    }

    async function shouldForceAuthEntryRetry(tabId) {
      if (!Number.isInteger(tabId)) {
        return false;
      }
      return isLikelyLoggedInChatgptHomeTab(tabId);
    }

    async function getTabUrl(tabId) {
      if (!Number.isInteger(tabId) || typeof chrome?.tabs?.get !== 'function') {
        return '';
      }

      try {
        const tab = await chrome.tabs.get(tabId);
        return String(tab?.url || '');
      } catch {
        return '';
      }
    }

    async function failStep2OnLoggedInSession(tabId, reasonMessage = '') {
      if (!(await isLikelyLoggedInChatgptHomeTab(tabId))) {
        return false;
      }

      const reasonText = getErrorMessage(reasonMessage);
      const reasonSuffix = reasonText ? ` (trigger reason: ${reasonText})` : '';
      const message = `Step 2: Detected that the current page is the logged-in ChatGPT home page. Auto-skip for Steps 3/4/5 has been blocked. Run Step 1 to clear the session, then retry.${reasonSuffix}`;
      await addLog(message, 'error');
      throw new Error(message);
    }

    async function sendSignupIdentity(payload = {}, options = {}) {
      const {
        timeoutMs = 35000,
        retryDelayMs = 700,
        logMessage = 'Step 2: The official website signup entry is switching. Waiting for the page to recover before continuing to enter the email...',
      } = options;

      try {
        return await sendToContentScriptResilient('openai-auth', {
          type: 'EXECUTE_NODE',
          nodeId: 'submit-signup-email',
          step: 2,
          source: 'background',
          payload,
        }, {
          timeoutMs,
          retryDelayMs,
          logMessage,
        });
      } catch (error) {
        return { error: getErrorMessage(error) };
      }
    }

    async function waitForStep2SignupTabToSettle(tabId, logMessage) {
      if (!Number.isInteger(tabId) || typeof waitForTabStableComplete !== 'function') {
        return null;
      }

      await addLog(
        logMessage || 'Step 2: Switched to the signup tab. Waiting for the page to finish loading and remain stable for another 3 seconds...',
        'info',
        { step: 2, stepKey: 'signup-entry' }
      );

      return waitForTabStableComplete(tabId, {
        timeoutMs: 45000,
        retryDelayMs: 300,
        stableMs: 3000,
        initialDelayMs: 300,
      });
    }

    async function keepSignupTabWindowInBackgroundForStep2(tabId) {
      // Intentionally no-op: the task tab is locked to the selected Chrome
      // window by the tab-runtime layer. Step 2 must not focus/raise that
      // window while the user is working in another app or browser window.
      void tabId;
    }

    async function ensureSignupPhoneEntryReady(tabId) {
      if (!Number.isInteger(tabId)) {
        throw new Error('Step 2: No available signup tab was found. Cannot switch to the phone signup entry.');
      }

      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'ENSURE_SIGNUP_PHONE_ENTRY_READY',
        step: 2,
        source: 'background',
        payload: {},
      }, {
        timeoutMs: 30000,
        retryDelayMs: 700,
        logMessage: 'Step 2: Opening the official website signup entry and switching to phone signup...',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function submitSignupEmail(resolvedEmail, options = {}) {
      return sendSignupIdentity({ email: resolvedEmail }, options);
    }

    async function submitSignupPhone(phoneNumber, activation, options = {}) {
      return sendSignupIdentity({
        signupMethod: 'phone',
        phoneNumber,
        countryId: activation?.countryId ?? null,
        countryLabel: String(activation?.countryLabel || '').trim(),
      }, {
        logMessage: 'Step 2: The official website signup entry is switching. Waiting for the phone signup entry to recover...',
        ...options,
      });
    }

    async function ensureSignupTabForStep2() {
      let signupTabId = await getTabId('openai-auth');
      if (!signupTabId || !(await isTabAlive('openai-auth'))) {
        await addLog('Step 2: No available signup tab was found. Reopening the ChatGPT website...', 'warn');
        signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
      } else {
        await chrome.tabs.update(signupTabId, { active: true });
        await keepSignupTabWindowInBackgroundForStep2(signupTabId);
        await waitForStep2SignupTabToSettle(
          signupTabId,
          'Step 2: Switched to the signup tab. Waiting for the page to finish loading and remain stable for another 3 seconds...'
        );
        await ensureContentScriptReadyOnTab('openai-auth', signupTabId, {
          inject: OPENAI_AUTH_INJECT_FILES,
          injectSource: 'openai-auth',
          timeoutMs: 45000,
          retryDelayMs: 900,
          logMessage: 'Step 2: Signup entry page content script is not ready. Waiting for the page to recover...',
        });
      }
      return signupTabId;
    }

    function normalizeSignupPhoneActivationForStep2(activation) {
      if (typeof phoneVerificationHelpers?.normalizeActivation === 'function') {
        return phoneVerificationHelpers.normalizeActivation(activation);
      }
      if (!activation || typeof activation !== 'object' || Array.isArray(activation)) {
        return null;
      }
      const activationId = String(activation.activationId ?? activation.id ?? activation.activation ?? '').trim();
      const phoneNumber = String(activation.phoneNumber ?? activation.number ?? activation.phone ?? '').trim();
      if (!activationId || !phoneNumber) {
        return null;
      }
      return {
        ...activation,
        activationId,
        phoneNumber,
      };
    }

    function getSignupPhoneNumberFromState(state = {}) {
      return String(
        state?.signupPhoneNumber
        || (String(state?.accountIdentifierType || '').trim().toLowerCase() === 'phone' ? state?.accountIdentifier : '')
        || ''
      ).trim();
    }

    async function resolveSignupPhoneForStep2(state = {}) {
      const existingActivation = normalizeSignupPhoneActivationForStep2(state?.signupPhoneActivation);
      if (existingActivation?.phoneNumber) {
        await addLog(`Step 2: Reusing the current signup phone number ${existingActivation.phoneNumber}. Not requesting a new number.`);
        return {
          phoneNumber: existingActivation.phoneNumber,
          activation: existingActivation,
        };
      }

      const manualPhoneNumber = getSignupPhoneNumberFromState(state);
      if (manualPhoneNumber) {
        await addLog(`Step 2: Using the manually entered signup phone number ${manualPhoneNumber}. This round will not request a new number.`, 'warn');
        return {
          phoneNumber: manualPhoneNumber,
          activation: null,
        };
      }

      if (typeof phoneVerificationHelpers?.prepareSignupPhoneActivation !== 'function') {
        throw new Error('Phone signup flow unavailable: the SMS verification module is not initialized yet.');
      }
      const activation = await phoneVerificationHelpers.prepareSignupPhoneActivation(state);
      return {
        phoneNumber: activation.phoneNumber,
        activation,
      };
    }

    async function executeSignupPhoneEntry(state) {
      let signupTabId = await ensureSignupTabForStep2();
      if (await shouldForceAuthEntryRetry(signupTabId)) {
        await addLog('Step 2: Detected that the current page is the logged-in ChatGPT home page. Switching to the auth entry page before submitting the phone number.', 'warn');
        try {
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
        } catch (entryError) {
          const entryErrorMessage = getErrorMessage(entryError);
          if (await failStep2OnLoggedInSession(signupTabId, entryErrorMessage)) {
            return;
          }
          await addLog('Step 2: Failed to switch the auth entry. Reopening the official entry and retrying phone number submission...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
        }
      }

      try {
        await ensureSignupPhoneEntryReady(signupTabId);
      } catch (entryError) {
        const entryErrorMessage = getErrorMessage(entryError);
        if (await failStep2OnLoggedInSession(signupTabId, entryErrorMessage)) {
          return;
        }
        if (
          isSignupPhoneEntryUnavailableErrorMessage(entryErrorMessage)
          || isSignupEntryUnavailableErrorMessage(entryErrorMessage)
          || isRetryableStep2TransportErrorMessage(entryErrorMessage)
        ) {
          await addLog('Step 2: Phone signup entry is not ready yet. Reopening the official entry and retrying once...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
          await ensureSignupPhoneEntryReady(signupTabId);
        } else {
          throw entryError;
        }
      }

      const signupPhone = await resolveSignupPhoneForStep2(state);
      const { phoneNumber, activation } = signupPhone;
      let step2Result = await submitSignupPhone(phoneNumber, activation, {
        timeoutMs: 45000,
        retryDelayMs: 700,
        logMessage: 'Step 2: The official website signup entry is switching. Waiting for the phone signup entry to recover...',
      });

      if (step2Result?.error) {
        const errorMessage = getErrorMessage(step2Result.error);
        if (
          isSignupPhoneEntryUnavailableErrorMessage(errorMessage)
          || isSignupEntryUnavailableErrorMessage(errorMessage)
          || isRetryableStep2TransportErrorMessage(errorMessage)
        ) {
          await addLog('Step 2: Phone signup entry is unavailable or timed out. Preparing the phone signup entry again and retrying once...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
          await ensureSignupPhoneEntryReady(signupTabId);
          step2Result = await submitSignupPhone(phoneNumber, activation, {
            timeoutMs: 45000,
            retryDelayMs: 700,
            logMessage: 'Step 2: Phone signup entry is ready. Resubmitting the phone number...',
          });
        }
      }

      if (step2Result?.error) {
        const finalErrorMessage = getErrorMessage(step2Result.error);
        if (
          (isSignupEntryUnavailableErrorMessage(finalErrorMessage)
            || isRetryableStep2TransportErrorMessage(finalErrorMessage))
          && await failStep2OnLoggedInSession(signupTabId, finalErrorMessage)
        ) {
          return;
        }
        if (activation && typeof phoneVerificationHelpers?.cancelSignupPhoneActivation === 'function') {
          await phoneVerificationHelpers.cancelSignupPhoneActivation(state, activation).catch(() => {});
        }
        throw new Error(finalErrorMessage);
      }

      await addLog(`Step 2: Phone number ${phoneNumber} submitted. Waiting for the page to load and confirm the next entry...`);
      const landingResult = await ensureSignupPostIdentityPageReadyInTab(signupTabId, 2, {
        skipUrlWait: Boolean(step2Result?.alreadyOnPasswordPage),
      });

      await completeNodeFromBackground('submit-signup-email', {
        accountIdentifierType: 'phone',
        accountIdentifier: phoneNumber,
        signupPhoneNumber: phoneNumber,
        signupPhoneActivation: activation || null,
        nextSignupState: landingResult?.state || step2Result?.state || 'password_page',
        nextSignupUrl: landingResult?.url || step2Result?.url || '',
        skippedPasswordStep: landingResult?.state === 'phone_verification_page' || landingResult?.state === 'profile_page',
      });
    }

    async function executeSignupEmailEntry(state) {
      const resolvedEmail = await resolveSignupEmailForFlow(state);

      let signupTabId = await ensureSignupTabForStep2();

      if (await shouldForceAuthEntryRetry(signupTabId)) {
        await addLog('Step 2: Detected that the current page is the logged-in ChatGPT home page. Switching to the auth entry page before submitting the email.', 'warn');
        try {
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
        } catch (entryError) {
          const entryErrorMessage = getErrorMessage(entryError);
          if (await failStep2OnLoggedInSession(signupTabId, entryErrorMessage)) {
            return;
          }
          await addLog('Step 2: Failed to switch the auth entry. Reopening the official entry and retrying email submission...', 'warn');
          signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
        }
      }

      let step2Result = await submitSignupEmail(resolvedEmail, {
        timeoutMs: 35000,
        retryDelayMs: 700,
        logMessage: 'Step 2: The official website signup entry is switching. Waiting for the page to recover before continuing to enter the email...',
      });

      if (step2Result?.error) {
        const errorMessage = getErrorMessage(step2Result.error);
        if (isSignupEntryUnavailableErrorMessage(errorMessage)) {
          await addLog('Step 2: Email input entry was not found. Switching the auth entry page and retrying once...', 'warn');
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
          step2Result = await submitSignupEmail(resolvedEmail, {
            timeoutMs: 35000,
            retryDelayMs: 700,
            logMessage: 'Step 2: Auth entry page is open. Resubmitting the email...',
          });

          if (step2Result?.error) {
            const retryErrorMessage = getErrorMessage(step2Result.error);
            if (isSignupEntryUnavailableErrorMessage(retryErrorMessage)) {
              if (await failStep2OnLoggedInSession(signupTabId, retryErrorMessage)) {
                return;
              }
              await addLog('Step 2: Auth entry is still unavailable. Re-entering the official website signup entry and retrying once...', 'warn');
              signupTabId = (await ensureSignupEntryPageReady(2)).tabId;
              step2Result = await submitSignupEmail(resolvedEmail, {
                timeoutMs: 35000,
                retryDelayMs: 700,
                logMessage: 'Step 2: Retrying email submission after retrying the official website signup entry...',
              });
            }
          }
        } else if (isRetryableStep2TransportErrorMessage(errorMessage)) {
          await addLog('Step 2: Signup entry page communication timed out. Switching the auth entry page and retrying email submission...', 'warn');
          signupTabId = (await ensureSignupAuthEntryPageReady(2)).tabId;
          step2Result = await submitSignupEmail(resolvedEmail, {
            timeoutMs: 45000,
            retryDelayMs: 700,
            logMessage: 'Step 2: Auth entry page is open. Resubmitting the email...',
          });
        }
      }

      if (step2Result?.error) {
        const finalErrorMessage = getErrorMessage(step2Result.error);
        if (
          (isSignupEntryUnavailableErrorMessage(finalErrorMessage)
            || isRetryableStep2TransportErrorMessage(finalErrorMessage))
          && await failStep2OnLoggedInSession(signupTabId, finalErrorMessage)
        ) {
          return;
        }
        throw new Error(finalErrorMessage);
      }

      if (!step2Result?.alreadyOnPasswordPage) {
        await addLog(`Step 2: Email ${resolvedEmail} submitted. Waiting for the page to load and confirm the next entry...`);
      }

      const landingResult = await ensureSignupPostEmailPageReadyInTab(signupTabId, 2, {
        skipUrlWait: Boolean(step2Result?.alreadyOnPasswordPage),
      });

      await completeNodeFromBackground('submit-signup-email', {
        email: resolvedEmail,
        accountIdentifierType: 'email',
        accountIdentifier: resolvedEmail,
        nextSignupState: landingResult?.state || 'password_page',
        nextSignupUrl: landingResult?.url || step2Result?.url || '',
        skippedPasswordStep: landingResult?.state === 'verification_page',
      });
    }

    async function executeStep2(state) {
      if (resolveSignupMethod(state) === 'phone') {
        return executeSignupPhoneEntry(state);
      }
      return executeSignupEmailEntry(state);
    }

    return { executeStep2 };
  }

  return { createStep2Executor };
});
