(function attachBackgroundVerificationFlow(root, factory) {
  root.MultiPageBackgroundVerificationFlow = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundVerificationFlowModule() {
  const ICLOUD_MAIL_POLL_MIN_ATTEMPTS = 5;
  const ICLOUD_MAIL_POLL_TIMEOUT_MARGIN_MS = 25000;

  function createVerificationFlowHelpers(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      buildVerificationPollPayload: externalBuildVerificationPollPayload = null,
      chrome,
      closeConflictingTabsForSource,
      CLOUDFLARE_TEMP_EMAIL_PROVIDER,
      CLOUD_MAIL_PROVIDER = 'cloudmail',
      completeNodeFromBackground,
      confirmCustomVerificationStepBypassRequest,
      getNodeIdByStepForState,
      getHotmailVerificationPollConfig,
      getHotmailVerificationRequestTimestamp,
      handleMail2925LimitReachedError,
      getState,
      getTabId,
      HOTMAIL_PROVIDER,
      isMail2925LimitReachedError,
      isStopError,
      LUCKMAIL_PROVIDER,
      YYDS_MAIL_PROVIDER = 'yyds-mail',
      MAIL_2925_VERIFICATION_INTERVAL_MS,
      MAIL_2925_VERIFICATION_MAX_ATTEMPTS,
      pollCloudflareTempEmailVerificationCode,
      pollCloudMailVerificationCode,
      pollHotmailVerificationCode,
      pollLuckmailVerificationCode,
      pollYydsMailVerificationCode,
      sendToContentScript,
      sendToContentScriptResilient,
      sendToMailContentScriptResilient,
      setNodeStatus,
      setState,
      sleepWithStop,
      throwIfStopped,
      VERIFICATION_POLL_MAX_ROUNDS,
    } = deps;
    let activeVerificationLogStep = null;

    function normalizeLogStep(value) {
      const step = Math.floor(Number(value) || 0);
      return step > 0 ? step : null;
    }

    function normalizeVerificationLogMessage(message) {
      return String(message || '')
        .replace(/^步骤\s*\d+\s*[:：]\s*/, '')
        .replace(/^Step\s+\d+\s*[:：]\s*/i, '')
        .trim();
    }

    function addLog(message, level = 'info', options = {}) {
      const normalizedOptions = options && typeof options === 'object' ? { ...options } : {};
      const step = normalizeLogStep(normalizedOptions.step || normalizedOptions.visibleStep)
        || normalizeLogStep(activeVerificationLogStep);
      if (step) {
        normalizedOptions.step = step;
        if (!normalizedOptions.stepKey) {
          normalizedOptions.stepKey = step === 4 ? 'fetch-signup-code' : 'fetch-login-code';
        }
      }
      delete normalizedOptions.visibleStep;
      return rawAddLog(normalizeVerificationLogMessage(message), level, normalizedOptions);
    }

    async function getNodeIdForStep(step) {
      const state = typeof getState === 'function' ? await getState() : {};
      return typeof getNodeIdByStepForState === 'function'
        ? String(getNodeIdByStepForState(step, state) || '').trim()
        : '';
    }

    const isRetryableVerificationTransportError = typeof deps.isRetryableContentScriptTransportError === 'function'
      ? deps.isRetryableContentScriptTransportError
      : ((error) => /back\/forward cache|message channel is closed|Receiving end does not exist|port closed before a response was received|A listener indicated an asynchronous response|内容脚本\s+\d+(?:\.\d+)?\s*秒内未响应|did not respond in \d+s/i.test(
        String(typeof error === 'string' ? error : error?.message || '')
      ));

    function getVerificationCodeStateKey(step) {
      return step === 4 ? 'lastSignupCode' : 'lastLoginCode';
    }

    function getVerificationCodeLabel(step) {
      return step === 4 ? 'signup' : 'login';
    }

    function isIcloudMail(mail) {
      return mail?.source === 'icloud-mail' || mail?.provider === 'icloud';
    }

    function normalizeIcloudMailPollPayload(mail, payload = {}) {
      if (!isIcloudMail(mail)) {
        return payload;
      }

      const currentAttempts = Math.max(1, Math.floor(Number(payload?.maxAttempts) || 1));
      if (currentAttempts >= ICLOUD_MAIL_POLL_MIN_ATTEMPTS) {
        return payload;
      }

      return {
        ...payload,
        maxAttempts: ICLOUD_MAIL_POLL_MIN_ATTEMPTS,
      };
    }

    function getMailPollingResponseTimeoutMs(payload = {}) {
      const maxAttempts = Math.max(1, Math.floor(Number(payload?.maxAttempts) || 1));
      const intervalMs = Math.max(1, Number(payload?.intervalMs) || 3000);
      return Math.max(45000, maxAttempts * intervalMs + ICLOUD_MAIL_POLL_TIMEOUT_MARGIN_MS);
    }

    function resolveMailPollingTimeouts(mail, timedPoll) {
      const payload = normalizeIcloudMailPollPayload(mail, timedPoll?.payload || {});
      const defaultResponseTimeoutMs = Math.max(1000, Number(timedPoll?.responseTimeoutMs) || 30000);
      const defaultTimeoutMs = Math.max(defaultResponseTimeoutMs, Number(timedPoll?.timeoutMs) || defaultResponseTimeoutMs);
      if (!isIcloudMail(mail)) {
        return {
          payload,
          responseTimeoutMs: defaultResponseTimeoutMs,
          timeoutMs: defaultTimeoutMs,
        };
      }

      const derivedResponseTimeoutMs = Math.max(
        defaultResponseTimeoutMs,
        getMailPollingResponseTimeoutMs(payload)
      );
      const derivedTimeoutMs = Math.max(defaultTimeoutMs, derivedResponseTimeoutMs);

      return {
        payload,
        responseTimeoutMs: derivedResponseTimeoutMs,
        timeoutMs: derivedTimeoutMs,
      };
    }

    function isLikelyLoggedInChatgptHomeUrl(rawUrl) {
      const url = String(rawUrl || '').trim();
      if (!url) return false;

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

    function isSignupProfilePageUrl(rawUrl) {
      const url = String(rawUrl || '').trim();
      if (!url) return false;

      try {
        const parsed = new URL(url);
        const host = String(parsed.hostname || '').toLowerCase();
        if (!['auth.openai.com', 'auth0.openai.com', 'accounts.openai.com'].includes(host)) {
          return false;
        }
        return /\/(?:create-account\/profile|u\/signup\/profile|signup\/profile|about-you)(?:[/?#]|$)/i.test(String(parsed.pathname || ''));
      } catch {
        return false;
      }
    }

    async function detectStep4PostSubmitFallback(tabId, options = {}) {
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 8000);
      const pollIntervalMs = Math.max(100, Number(options.pollIntervalMs) || 250);
      const startedAt = Date.now();
      let lastUrl = '';

      while (Date.now() - startedAt < timeoutMs) {
        throwIfStopped();
        try {
          const tab = await chrome.tabs.get(tabId);
          const currentUrl = String(tab?.url || '').trim();
          if (currentUrl) {
            lastUrl = currentUrl;
          }

          if (isLikelyLoggedInChatgptHomeUrl(currentUrl)) {
            return {
              success: true,
              reason: 'chatgpt_home',
              skipProfileStep: true,
              url: currentUrl,
            };
          }

          if (isSignupProfilePageUrl(currentUrl)) {
            return {
              success: true,
              reason: 'signup_profile',
              skipProfileStep: false,
              url: currentUrl,
            };
          }
        } catch {
          // Keep polling until timeout; tab may be mid-navigation.
        }

        await sleepWithStop(pollIntervalMs);
      }

      return {
        success: false,
        reason: 'unknown',
        skipProfileStep: false,
        url: lastUrl,
      };
    }

    async function detectStep8PostSubmitFallback(options = {}) {
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 9000);
      const pollIntervalMs = Math.max(100, Number(options.pollIntervalMs) || 300);
      const step = Number(options.step) || 8;
      const startedAt = Date.now();
      let lastSnapshot = null;

      while (Date.now() - startedAt < timeoutMs) {
        throwIfStopped();
        try {
          const request = {
            type: 'GET_LOGIN_AUTH_STATE',
            source: 'background',
            payload: {},
          };
          const requestTimeoutMs = Math.max(1200, Math.min(5000, timeoutMs));
          const result = typeof sendToContentScriptResilient === 'function'
            ? await sendToContentScriptResilient(
              'openai-auth',
              request,
              {
                timeoutMs: requestTimeoutMs,
                responseTimeoutMs: requestTimeoutMs,
                retryDelayMs: 400,
                logMessage: `Step ${step}: Page is switching after verification code submission, waiting for it to recover and confirm authorization state...`,
              }
            )
            : await sendToContentScript('openai-auth', request, {
              responseTimeoutMs: requestTimeoutMs,
            });

          if (result?.error) {
            throw new Error(result.error);
          }

          const authState = String(result?.state || '').trim();
          const authUrl = String(result?.url || '').trim();
          const verificationErrorText = String(result?.verificationErrorText || '').trim();
          lastSnapshot = {
            state: authState || 'unknown',
            url: authUrl,
          };

          if (authState === 'verification_page' && verificationErrorText) {
            return {
              success: false,
              reason: 'invalid_code',
              invalidCode: true,
              errorText: verificationErrorText,
              url: authUrl,
            };
          }
          if (authState === 'oauth_consent_page') {
            return {
              success: true,
              reason: 'oauth_consent_page',
              addPhonePage: false,
              url: authUrl,
            };
          }
          if (authState === 'add_phone_page' || authState === 'phone_verification_page') {
            return {
              success: true,
              reason: 'add_phone_page',
              addPhonePage: true,
              url: authUrl || 'https://auth.openai.com/add-phone',
            };
          }
          if (authState === 'login_timeout_error_page') {
            return {
              success: false,
              reason: 'login_timeout_error_page',
              restartStep7: true,
              url: authUrl,
            };
          }
        } catch (_) {
          // Ignore transient inspect failures and keep polling.
        }

        await sleepWithStop(pollIntervalMs);
      }

      return {
        success: false,
        reason: 'unknown',
        snapshot: lastSnapshot,
      };
    }

    function getVerificationResendStateKey() {
      return 'verificationResendCount';
    }

    function normalizeVerificationResendCount(value, fallback = 0) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return Math.max(0, Math.floor(Number(fallback) || 0));
      }

      return Math.min(20, Math.max(0, Math.floor(numeric)));
    }

    function getVerificationRequestedAtStateKey(step) {
      if (Number(step) === 4) return 'signupVerificationRequestedAt';
      if (Number(step) === 8) return 'loginVerificationRequestedAt';
      return '';
    }

    function resolveInitialVerificationRequestedAt(step, state = {}, fallback = 0) {
      const stateKey = getVerificationRequestedAtStateKey(step);
      const candidateValues = [
        fallback,
        stateKey ? state?.[stateKey] : 0,
      ];

      for (const value of candidateValues) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          return Math.floor(numeric);
        }
      }
      return 0;
    }

    function getLegacyVerificationResendCountDefault(step, options = {}) {
      const requestFreshCodeFirst = Boolean(options.requestFreshCodeFirst);
      const legacyMaxRounds = Math.max(1, Math.floor(Number(VERIFICATION_POLL_MAX_ROUNDS) || 1));
      if (step === 4 && requestFreshCodeFirst) {
        return legacyMaxRounds;
      }
      return Math.max(0, legacyMaxRounds - 1);
    }

    function getConfiguredVerificationResendCount(step, state, options = {}) {
      const stateKey = getVerificationResendStateKey(step);
      const configuredValue = state?.[stateKey] !== undefined
        ? state[stateKey]
        : (state?.signupVerificationResendCount ?? state?.loginVerificationResendCount);
      return normalizeVerificationResendCount(
        configuredValue,
        getLegacyVerificationResendCountDefault(step, options)
      );
    }

    function resolveMaxResendRequests(pollOverrides = {}) {
      if (pollOverrides.maxResendRequests !== undefined) {
        return normalizeVerificationResendCount(pollOverrides.maxResendRequests, 0);
      }

      const legacyMaxRounds = Number(pollOverrides.maxRounds);
      if (Number.isFinite(legacyMaxRounds)) {
        return Math.max(0, Math.floor(legacyMaxRounds) - 1);
      }

      return Math.max(0, Math.floor(Number(VERIFICATION_POLL_MAX_ROUNDS) || 1) - 1);
    }

    function getCompletionStep(step, options = {}) {
      const completionStep = Number(options.completionStep);
      return Number.isFinite(completionStep) && completionStep > 0 ? completionStep : step;
    }

    async function confirmCustomVerificationStepBypass(step, options = {}) {
      const completionStep = getCompletionStep(step, options);
      const promptStep = getCompletionStep(step, { completionStep: options.promptStep ?? completionStep });
      const verificationLabel = getVerificationCodeLabel(step);
      await addLog(`Step ${completionStep}: Currently in custom email mode. Please enter the ${verificationLabel} verification code on the page manually and proceed to the next page.`, 'warn');

      let response = null;
      try {
        response = await confirmCustomVerificationStepBypassRequest(promptStep);
      } catch {
        throw new Error(`Step ${completionStep}: Could not open the confirmation dialog. Please keep the side panel open and retry.`);
      }

      if (response?.error) {
        throw new Error(response.error);
      }
      if (step === 8 && response?.addPhoneDetected) {
        throw new Error(`Step ${completionStep}: After verification code submission, the page entered the phone-number page; the current flow cannot continue automatic authorization. URL: https://auth.openai.com/add-phone`);
      }
      if (!response?.confirmed) {
        throw new Error(`Step ${completionStep}: Manual ${verificationLabel} verification code confirmation was canceled.`);
      }

      await setState({
        lastEmailTimestamp: null,
        signupVerificationRequestedAt: null,
        loginVerificationRequestedAt: null,
      });
      const completionNodeId = await getNodeIdForStep(completionStep);
      if (!completionNodeId) {
        throw new Error(`Step ${completionStep} is not mapped to a verification code node.`);
      }
      await setNodeStatus(completionNodeId, 'skipped');
      await addLog(`Step ${completionStep}: Confirmed manual ${verificationLabel} verification code entry; the current step has been skipped.`, 'warn');
    }

    function getVerificationPollPayload(step, state, overrides = {}) {
      if (typeof externalBuildVerificationPollPayload === 'function') {
        return externalBuildVerificationPollPayload(step, state, overrides);
      }
      const normalizedStep = Number(step) === 4 ? 4 : 8;
      const is2925Provider = state?.mailProvider === '2925';
      const mail2925MatchTargetEmail = is2925Provider
        && String(state?.mail2925Mode || '').trim().toLowerCase() === 'receive';
      return {
        flowId: String(state?.activeFlowId || '').trim(),
        step: normalizedStep,
        filterAfterTimestamp: is2925Provider ? 0 : getHotmailVerificationRequestTimestamp(normalizedStep, state),
        senderFilters: [],
        subjectFilters: [],
        requiredKeywords: [],
        codePatterns: [],
        targetEmail: normalizedStep === 4
          ? state.email
          : (String(state?.step8VerificationTargetEmail || '').trim() || state.email),
        targetEmailHints: [],
        mail2925MatchTargetEmail,
        maxAttempts: is2925Provider ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : 5,
        intervalMs: is2925Provider ? MAIL_2925_VERIFICATION_INTERVAL_MS : 3000,
        ...overrides,
      };
    }

    async function getRemainingTimeBudgetMs(step, options = {}, actionLabel = '') {
      const resolver = typeof options.getRemainingTimeMs === 'function'
        ? options.getRemainingTimeMs
        : null;
      if (!resolver) {
        return null;
      }

      const value = await resolver({ step, actionLabel });
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return null;
      }

      return Math.max(0, Math.floor(numeric));
    }

    async function getResponseTimeoutMsForStep(step, options = {}, fallbackMs = 30000, actionLabel = '') {
      const remainingMs = await getRemainingTimeBudgetMs(step, options, actionLabel);
      const fallbackTimeoutMs = Math.max(1000, Number(fallbackMs) || 1000);
      const minResponseTimeoutMs = Math.min(
        fallbackTimeoutMs,
        Math.max(1000, Number(options.minResponseTimeoutMs) || 1000)
      );
      if (remainingMs === null) {
        return Math.max(minResponseTimeoutMs, fallbackTimeoutMs);
      }

      return Math.max(minResponseTimeoutMs, Math.min(fallbackTimeoutMs, remainingMs));
    }

    async function applyMailPollingTimeBudget(step, payload, options = {}, actionLabel = '') {
      const nextPayload = { ...payload };
      const intervalMs = Math.max(1, Number(nextPayload.intervalMs) || 3000);
      const baseMaxAttempts = Math.max(1, Number(nextPayload.maxAttempts) || 1);
      const disableTimeBudgetCap = Boolean(options.disableTimeBudgetCap);
      const remainingMs = await getRemainingTimeBudgetMs(step, options, actionLabel);
      const minPollingResponseTimeoutMs = Math.max(
        3000,
        Number(options.minPollingResponseTimeoutMs) || 5000
      );

      if (!disableTimeBudgetCap && remainingMs !== null) {
        nextPayload.maxAttempts = Math.max(
          1,
          Math.min(baseMaxAttempts, Math.floor(Math.max(0, remainingMs - 1000) / intervalMs) + 1)
        );
      }

      const defaultResponseTimeoutMs = Math.max(45000, nextPayload.maxAttempts * intervalMs + 25000);
      const responseTimeoutMs = disableTimeBudgetCap || remainingMs === null
        ? defaultResponseTimeoutMs
        : Math.max(
          minPollingResponseTimeoutMs,
          Math.min(defaultResponseTimeoutMs, remainingMs)
        );

      return {
        payload: nextPayload,
        responseTimeoutMs,
        timeoutMs: responseTimeoutMs,
      };
    }

    async function requestVerificationCodeResend(step, options = {}) {
      throwIfStopped();
      const signupTabId = await getTabId('openai-auth');
      if (!signupTabId) {
        throw new Error('Auth page tab was closed; cannot request a new verification code.');
      }

      throwIfStopped();
      await chrome.tabs.update(signupTabId, { active: true });
      throwIfStopped();

      const result = await sendToContentScript('openai-auth', {
        type: 'RESEND_VERIFICATION_CODE',
        step,
        source: 'background',
        payload: {},
      }, {
        responseTimeoutMs: await getResponseTimeoutMsForStep(
          step,
          options,
          30000,
          `Resend ${getVerificationCodeLabel(step)} verification code`
        ),
      });

      if (result && result.error) {
        throw new Error(result.error);
      }

      await addLog(`Step ${step}: Requested a new ${getVerificationCodeLabel(step)} verification code.`, 'warn');

      const requestedAt = Date.now();
      if (step === 4) {
        await setState({ signupVerificationRequestedAt: requestedAt });
      }
      if (step === 8) {
        await setState({ loginVerificationRequestedAt: requestedAt });
      }

      const currentState = await getState();
      if (currentState.mailProvider === '2925') {
        const mailTabId = await getTabId('mail-2925');
        if (mailTabId) {
          await chrome.tabs.update(mailTabId, { active: true });
          await addLog(`Step ${step}: Switched to the 2925 mailbox tab to wait for new mail.`, 'info');
        }
      }

      return requestedAt;
    }

    function shouldPreclear2925Mailbox(step, mail, options = {}) {
      if (mail?.provider !== '2925' || (step !== 4 && step !== 8)) {
        return false;
      }

      return !(Number(options.filterAfterTimestamp) > 0);
    }

    async function clear2925MailboxBeforePolling(step, mail, options = {}) {
      if (!shouldPreclear2925Mailbox(step, mail, options)) {
        return;
      }

      throwIfStopped();
      await addLog(`Step ${step}: Clearing all emails before refreshing the 2925 mailbox to avoid reading old verification code emails.`, 'warn');

      try {
        const responseTimeoutMs = await getResponseTimeoutMsForStep(
          step,
          options,
          15000,
          'Clear 2925 mailbox history'
        );
        const result = await sendToMailContentScriptResilient(
          mail,
          {
            type: 'DELETE_ALL_EMAILS',
            step,
            source: 'background',
            payload: {},
          },
          {
            timeoutMs: responseTimeoutMs,
            responseTimeoutMs,
            maxRecoveryAttempts: 2,
            logStep: activeVerificationLogStep,
            logStepKey: step === 4 ? 'fetch-signup-code' : 'fetch-login-code',
          }
        );

        if (result?.error) {
          throw new Error(result.error);
        }

        if (result?.deleted === false) {
          await addLog(`Step ${step}: Could not confirm that the 2925 mailbox was cleared; will keep refreshing and wait for new mail.`, 'warn');
          return;
        }

        await addLog(`Step ${step}: 2925 mailbox cleared in advance; refreshing and waiting for new mail.`, 'info');
      } catch (err) {
        if (isStopError(err)) {
          throw err;
        }
        await addLog(`Step ${step}: Failed to pre-clear the 2925 mailbox; will keep refreshing and wait for new mail: ${err.message}`, 'warn');
      }
    }

    async function closeIcloudMailboxTabAfterSuccess(step, mail) {
      if (mail?.source !== 'icloud-mail') {
        return;
      }

      const tabId = typeof getTabId === 'function'
        ? await getTabId(mail.source)
        : null;

      if (Number.isInteger(tabId)) {
        await chrome.tabs.remove(tabId).catch(() => {});
        await addLog(`Step ${step}: Closed the iCloud mailbox tab to avoid long-term accumulation.`, 'info');
        return;
      }

      if (typeof closeConflictingTabsForSource === 'function' && mail.url) {
        await closeConflictingTabsForSource(mail.source, mail.url).catch(() => {});
      }
    }

    function triggerPostSuccessMailboxCleanup(step, mail) {
      if (mail?.provider !== '2925' && mail?.source !== 'icloud-mail') {
        return;
      }

      Promise.resolve().then(async () => {
        try {
          if (mail?.source === 'icloud-mail') {
            await closeIcloudMailboxTabAfterSuccess(step, mail);
            return;
          }

          await sendToMailContentScriptResilient(
            mail,
            {
              type: 'DELETE_ALL_EMAILS',
              step,
              source: 'background',
              payload: {},
            },
            {
              timeoutMs: 10000,
              responseTimeoutMs: 5000,
              maxRecoveryAttempts: 1,
              logStep: activeVerificationLogStep,
              logStepKey: step === 4 ? 'fetch-signup-code' : 'fetch-login-code',
            }
          );
        } catch (_) {
          // Best-effort cleanup only.
        }
      });
    }

    async function pollFreshVerificationCodeWithResendInterval(step, state, mail, pollOverrides = {}) {
      const stateKey = getVerificationCodeStateKey(step);
      const rejectedCodes = new Set();
      if (state[stateKey]) {
        rejectedCodes.add(state[stateKey]);
      }
      for (const code of (pollOverrides.excludeCodes || [])) {
        if (code) rejectedCodes.add(code);
      }

      const {
        maxRounds: _ignoredMaxRounds,
        maxResendRequests: _ignoredMaxResendRequests,
        resendIntervalMs: _ignoredResendIntervalMs,
        lastResendAt: _ignoredLastResendAt,
        onResendRequestedAt: _ignoredOnResendRequestedAt,
        ...payloadOverrides
      } = pollOverrides;
      const onResendRequestedAt = typeof pollOverrides.onResendRequestedAt === 'function'
        ? pollOverrides.onResendRequestedAt
        : null;
      let lastError = null;
      let filterAfterTimestamp = payloadOverrides.filterAfterTimestamp ?? getVerificationPollPayload(step, state).filterAfterTimestamp;
      const maxResendRequests = resolveMaxResendRequests(pollOverrides);
      const totalRounds = maxResendRequests + 1;
      const maxRounds = totalRounds;
      const resendIntervalMs = Math.max(0, Number(pollOverrides.resendIntervalMs) || 0);
      let lastResendAt = Number(pollOverrides.lastResendAt) || 0;
      let usedResendRequests = 0;
      let pollOnlyNoResendRounds = 0;
      let transportErrorStreak = 0;
      const maxTransportErrorStreak = mail?.source === 'icloud-mail' ? 6 : 4;
      const maxIcloudNoResendRounds = mail?.source === 'icloud-mail' ? 4 : 0;
      const hasExistingResendTimestamp = Number(lastResendAt) > 0;
      const initialRoundNoResendWindowMs = resendIntervalMs > 0
        ? Math.max(10000, Math.min(45000, resendIntervalMs))
        : 0;
      const initialRoundNoResendUntil = hasExistingResendTimestamp
        ? 0
        : (initialRoundNoResendWindowMs > 0 ? (Date.now() + initialRoundNoResendWindowMs) : 0);

      for (let round = 1; round <= totalRounds; round++) {
        throwIfStopped();
        if (round === 1 && initialRoundNoResendUntil > 0) {
          const waitSeconds = Math.max(1, Math.ceil((initialRoundNoResendUntil - Date.now()) / 1000));
          await addLog(
            `Step ${step}: Entering verification code polling for the first time; will wait ${waitSeconds} seconds to watch for new mail and avoid resending too early.`,
            'info'
          );
        }
        if (round > 1) {
          lastResendAt = await requestVerificationCodeResend(step, pollOverrides);
          usedResendRequests += 1;
          if (onResendRequestedAt) {
            const nextFilterAfterTimestamp = await onResendRequestedAt(lastResendAt);
            if (nextFilterAfterTimestamp !== undefined) {
              filterAfterTimestamp = nextFilterAfterTimestamp;
            }
          }
        }

        while (true) {
          throwIfStopped();
          const payload = getVerificationPollPayload(step, state, {
            ...payloadOverrides,
            filterAfterTimestamp,
            excludeCodes: [...rejectedCodes],
          });

          if (lastResendAt > 0) {
            const remainingBeforeResendMs = Math.max(0, resendIntervalMs - (Date.now() - lastResendAt));
            const baseMaxAttempts = Math.max(1, Number(payload.maxAttempts) || 5);
            const intervalMs = Math.max(1, Number(payload.intervalMs) || 3000);
            payload.maxAttempts = Math.max(1, Math.min(baseMaxAttempts, Math.floor(remainingBeforeResendMs / intervalMs) + 1));
          }

          try {
            const timedPoll = await applyMailPollingTimeBudget(
              step,
              payload,
              pollOverrides,
              `Poll ${getVerificationCodeLabel(step)} verification code mailbox`
            );
            const timeoutWindow = resolveMailPollingTimeouts(mail, timedPoll);
            const result = await sendToMailContentScriptResilient(
              mail,
              {
                type: 'POLL_EMAIL',
                step,
                source: 'background',
                payload: timeoutWindow.payload,
              },
              {
                timeoutMs: timeoutWindow.timeoutMs,
                maxRecoveryAttempts: 2,
                responseTimeoutMs: timeoutWindow.responseTimeoutMs,
                logStep: activeVerificationLogStep,
                logStepKey: step === 4 ? 'fetch-signup-code' : 'fetch-login-code',
              }
            );

            if (result && result.error) {
              throw new Error(result.error);
            }

            if (!result || !result.code) {
              throw new Error(`Step ${step}: Mailbox polling ended but no verification code was found.`);
            }

            if (rejectedCodes.has(result.code)) {
              throw new Error(`Step ${step}: Received the same ${getVerificationCodeLabel(step)} verification code again: ${result.code}`);
            }

            transportErrorStreak = 0;

            return {
              ...result,
              lastResendAt,
              remainingResendRequests: Math.max(0, maxResendRequests - usedResendRequests),
            };
          } catch (err) {
            if (isStopError(err)) {
              throw err;
            }
            if (mail?.provider === '2925' && typeof isMail2925LimitReachedError === 'function' && isMail2925LimitReachedError(err)) {
              if (typeof handleMail2925LimitReachedError === 'function') {
                throw await handleMail2925LimitReachedError(step, err);
              }
              throw err;
            }
            const isTransportError = isRetryableVerificationTransportError(err);
            if (isTransportError) {
              transportErrorStreak += 1;
              lastError = err;
              await addLog(`Step ${step}: ${err.message}`, 'warn');
              if (transportErrorStreak >= maxTransportErrorStreak) {
                throw new Error(
                  `Step ${step}: ${mail?.label || 'Mailbox'} page communication failed ${transportErrorStreak} times in a row. Stopped the current polling to avoid resending the verification code repeatedly. Last error: ${err.message}`
                );
              }
              const fallbackIntervalMs = Math.max(
                800,
                Math.min(
                  3000,
                  Number(payloadOverrides.intervalMs)
                    || Number(pollOverrides.intervalMs)
                    || 2000
                )
              );
              await sleepWithStop(fallbackIntervalMs);
              continue;
            }
            transportErrorStreak = 0;
            lastError = err;
            await addLog(`Step ${step}: ${err.message}`, 'warn');
          }

          if (mail?.source === 'icloud-mail' && maxIcloudNoResendRounds > 0) {
            pollOnlyNoResendRounds += 1;
            if (pollOnlyNoResendRounds >= maxIcloudNoResendRounds) {
              throw new Error(
                `Step ${step}: The iCloud mailbox failed to produce a verification code in ${pollOnlyNoResendRounds} consecutive polling rounds without triggering a resend. Stopped the current chain to avoid an empty polling loop. Please refresh the mailbox page and retry.`
              );
            }
          }

          const remainingBeforeResendMs = lastResendAt > 0
            ? Math.max(0, resendIntervalMs - (Date.now() - lastResendAt))
            : 0;
          const initialCooldownMs = (round === 1 && initialRoundNoResendUntil > 0)
            ? Math.max(0, initialRoundNoResendUntil - Date.now())
            : 0;
          const effectiveCooldownMs = Math.max(remainingBeforeResendMs, initialCooldownMs);
          if (effectiveCooldownMs > 0) {
            await addLog(
              `Step ${step}: ${Math.ceil(effectiveCooldownMs / 1000)} seconds remain until the next verification code resend; continuing to refresh the mailbox (round ${round}/${maxRounds})...`,
              'info'
            );
            const configuredIntervalMs = Math.max(
              1,
              Number(payloadOverrides.intervalMs)
                || Number(pollOverrides.intervalMs)
                || 3000
            );
            const cooldownSleepMs = Math.min(
              effectiveCooldownMs,
              Math.max(1000, Math.min(configuredIntervalMs, 3000))
            );
            await sleepWithStop(cooldownSleepMs);
            continue;
          }

          if (round < maxRounds) {
            await addLog(`Step ${step}: Reached the 25-second resend interval; preparing to resend the verification code (round ${round + 1}/${maxRounds})...`, 'warn');
          }
          break;
        }
      }

      throw lastError || new Error(`Step ${step}: Could not get a new ${getVerificationCodeLabel(step)} verification code.`);
    }

    function shouldRequestLuckmailResendBeforeRetry(error) {
      const message = String(error?.message || error || '');
      if (!message) {
        return true;
      }

      return !/没有可用 token|token 对应邮箱与当前邮箱不一致|no available token|token does not match current email/i.test(message);
    }

    async function pollLuckmailVerificationCodeWithResend(step, state, pollOverrides = {}) {
      const {
        onResendRequestedAt,
        maxRounds: _ignoredMaxRounds,
        maxResendRequests: _ignoredMaxResendRequests,
        initialPollMaxAttempts: _ignoredInitialPollMaxAttempts,
        pollAttemptPlan: _ignoredPollAttemptPlan,
        ...cleanPollOverrides
      } = pollOverrides;
      const basePayload = {
        ...getVerificationPollPayload(step, state),
        ...cleanPollOverrides,
      };
      const maxAttempts = Math.max(1, Number(basePayload.maxAttempts) || 1);
      const intervalMs = Math.max(15000, Number(basePayload.intervalMs) || 15000);
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        throwIfStopped();
        try {
          return await pollLuckmailVerificationCode(step, state, {
            ...basePayload,
            maxAttempts: 1,
            intervalMs,
          });
        } catch (err) {
          if (isStopError(err)) {
            throw err;
          }

          lastError = err;
          const canRetry = attempt < maxAttempts;
          if (!canRetry) {
            break;
          }

          if (shouldRequestLuckmailResendBeforeRetry(err)) {
            try {
              await requestVerificationCodeResend(step, pollOverrides);
            } catch (resendError) {
              if (isStopError(resendError)) {
                throw resendError;
              }
              await addLog(`Step ${step}: LuckMail failed to click resend verification code: ${resendError.message}. Will continue polling the /code endpoint in ${Math.ceil(intervalMs / 1000)} seconds.`, 'warn');
            }
          }

          await addLog(`Step ${step}: LuckMail has not yet returned a new ${getVerificationCodeLabel(step)} verification code; waiting ${Math.ceil(intervalMs / 1000)} seconds before continuing to poll the /code endpoint (${attempt + 1}/${maxAttempts})...`, 'warn');
          await sleepWithStop(intervalMs);
        }
      }

      throw lastError || new Error(`Step ${step}: Could not get a new ${getVerificationCodeLabel(step)} verification code.`);
    }

    async function pollFreshVerificationCode(step, state, mail, pollOverrides = {}) {
      const {
        onResendRequestedAt,
        maxRounds: _ignoredMaxRounds,
        maxResendRequests: _ignoredMaxResendRequests,
        initialPollMaxAttempts: _ignoredInitialPollMaxAttempts,
        pollAttemptPlan: _ignoredPollAttemptPlan,
        ...cleanPollOverrides
      } = pollOverrides;

      if (mail.provider === HOTMAIL_PROVIDER) {
        const hotmailPollConfig = getHotmailVerificationPollConfig(step);
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...hotmailPollConfig,
          ...cleanPollOverrides,
        }, cleanPollOverrides, `Poll ${getVerificationCodeLabel(step)} verification code mailbox`);
        return pollHotmailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === LUCKMAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `Poll ${getVerificationCodeLabel(step)} verification code mailbox`);
        return pollLuckmailVerificationCodeWithResend(step, state, {
          ...cleanPollOverrides,
          ...timedPoll.payload,
          onResendRequestedAt,
        });
      }
      if (mail.provider === CLOUDFLARE_TEMP_EMAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `Poll ${getVerificationCodeLabel(step)} verification code mailbox`);
        return pollCloudflareTempEmailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === CLOUD_MAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `Poll ${getVerificationCodeLabel(step)} verification code mailbox`);
        return pollCloudMailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === YYDS_MAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `Poll ${getVerificationCodeLabel(step)} verification code mailbox`);
        return pollYydsMailVerificationCode(step, state, timedPoll.payload);
      }

      if (Number(pollOverrides.resendIntervalMs) > 0) {
        return pollFreshVerificationCodeWithResendInterval(step, state, mail, pollOverrides);
      }

      const stateKey = getVerificationCodeStateKey(step);
      const rejectedCodes = new Set();
      if (state[stateKey]) {
        rejectedCodes.add(state[stateKey]);
      }
      for (const code of (pollOverrides.excludeCodes || [])) {
        if (code) rejectedCodes.add(code);
      }

      let lastError = null;
      let filterAfterTimestamp = cleanPollOverrides.filterAfterTimestamp ?? getVerificationPollPayload(step, state).filterAfterTimestamp;
      const maxResendRequests = resolveMaxResendRequests(pollOverrides);
      const maxRounds = maxResendRequests + 1;
      const initialPollMaxAttempts = Math.max(0, Math.floor(Number(pollOverrides.initialPollMaxAttempts) || 0));
      const configuredPollAttemptPlan = Array.isArray(pollOverrides.pollAttemptPlan)
        ? pollOverrides.pollAttemptPlan
          .map((value) => Math.floor(Number(value) || 0))
          .filter((value) => value > 0)
        : [];
      const pollAttemptPlan = rejectedCodes.size > 0 ? [] : configuredPollAttemptPlan;
      let usedResendRequests = 0;

      for (let round = 1; round <= maxRounds; round++) {
        throwIfStopped();
        if (round > 1) {
          const requestedAt = await requestVerificationCodeResend(step, pollOverrides);
          usedResendRequests += 1;
          if (typeof onResendRequestedAt === 'function') {
            const nextFilterAfterTimestamp = await onResendRequestedAt(requestedAt);
            if (nextFilterAfterTimestamp !== undefined) {
              filterAfterTimestamp = nextFilterAfterTimestamp;
            }
          }
        }

        const payload = getVerificationPollPayload(step, state, {
          ...cleanPollOverrides,
          filterAfterTimestamp,
          excludeCodes: [...rejectedCodes],
        });
        const plannedPollMaxAttempts = pollAttemptPlan[round - 1] || 0;
        if (plannedPollMaxAttempts > 0) {
          payload.maxAttempts = plannedPollMaxAttempts;
        } else if (round === 1 && initialPollMaxAttempts > 0) {
          payload.maxAttempts = initialPollMaxAttempts;
        }

        try {
          const timedPoll = await applyMailPollingTimeBudget(
            step,
            payload,
            pollOverrides,
            `Poll ${getVerificationCodeLabel(step)} verification code mailbox`
          );
          const timeoutWindow = resolveMailPollingTimeouts(mail, timedPoll);
          const result = await sendToMailContentScriptResilient(
            mail,
            {
              type: 'POLL_EMAIL',
              step,
              source: 'background',
              payload: timeoutWindow.payload,
            },
            {
              timeoutMs: timeoutWindow.timeoutMs,
              maxRecoveryAttempts: 2,
              responseTimeoutMs: timeoutWindow.responseTimeoutMs,
              logStep: activeVerificationLogStep,
              logStepKey: step === 4 ? 'fetch-signup-code' : 'fetch-login-code',
            }
          );

          if (result && result.error) {
            throw new Error(result.error);
          }

          if (!result || !result.code) {
            throw new Error(`Step ${step}: Mailbox polling ended but no verification code was found.`);
          }

          if (rejectedCodes.has(result.code)) {
            throw new Error(`Step ${step}: Received the same ${getVerificationCodeLabel(step)} verification code again: ${result.code}`);
          }

          return {
            ...result,
            remainingResendRequests: Math.max(0, maxResendRequests - usedResendRequests),
          };
        } catch (err) {
          if (isStopError(err)) {
            throw err;
          }
          if (mail?.provider === '2925' && typeof isMail2925LimitReachedError === 'function' && isMail2925LimitReachedError(err)) {
            if (typeof handleMail2925LimitReachedError === 'function') {
              throw await handleMail2925LimitReachedError(step, err);
            }
            throw err;
          }
          lastError = err;
          await addLog(`Step ${step}: ${err.message}`, 'warn');
          if (round < maxRounds) {
            await addLog(`Step ${step}: Will resend the verification code and retry (${round + 1}/${maxRounds})...`, 'warn');
          }
        }
      }

      throw lastError || new Error(`Step ${step}: Could not get a new ${getVerificationCodeLabel(step)} verification code.`);
    }

    async function submitVerificationCode(step, code, options = {}) {
      const completionStep = getCompletionStep(step, options);
      const authLoginStep = completionStep >= 11 ? 10 : 7;
      const signupTabId = await getTabId('openai-auth');
      if (!signupTabId) {
        throw new Error('Auth page tab was closed; cannot fill the verification code.');
      }

      await chrome.tabs.update(signupTabId, { active: true });
      const completionNodeId = await getNodeIdForStep(completionStep);
      const baseResponseTimeoutMs = await getResponseTimeoutMsForStep(
        step,
        step === 8
          ? {
            ...options,
            minResponseTimeoutMs: Math.max(15000, Number(options.minResponseTimeoutMs) || 0),
          }
          : options,
        step === 7 ? 45000 : 30000,
        `Fill ${getVerificationCodeLabel(step)} verification code`
      );
      const message = {
        type: 'FILL_CODE',
        step,
        source: 'background',
        payload: {
          code,
          ...(completionNodeId ? { nodeId: completionNodeId } : {}),
          ...(step === 4 && options.signupProfile ? { signupProfile: options.signupProfile } : {}),
        },
      };
      let result;
      const shouldAvoidReplaySubmit = step === 8;
      if (typeof sendToContentScriptResilient === 'function' && !shouldAvoidReplaySubmit) {
        try {
          result = await sendToContentScriptResilient('openai-auth', message, {
            timeoutMs: Math.max(baseResponseTimeoutMs + 15000, 30000),
            retryDelayMs: 700,
            responseTimeoutMs: baseResponseTimeoutMs,
            logMessage: 'Auth page is switching, waiting for it to become ready again before confirming the verification code submission result...',
            logStep: completionStep,
            logStepKey: step === 4 ? 'fetch-signup-code' : 'fetch-login-code',
          });
        } catch (err) {
          if (step === 4 && isRetryableVerificationTransportError(err)) {
            const fallback = await detectStep4PostSubmitFallback(signupTabId, {
              timeoutMs: 9000,
              pollIntervalMs: 300,
            });
            if (fallback.success) {
              const fallbackLabel = fallback.reason === 'chatgpt_home'
                ? 'ChatGPT logged-in home'
                : 'signup profile page';
              await addLog(`Step 4: After verification code submission, the page switched to ${fallbackLabel}; treating as success and continuing.`, 'warn');
              return {
                success: true,
                assumed: true,
                transportRecovered: true,
                skipProfileStep: Boolean(fallback.skipProfileStep),
                url: fallback.url,
              };
            }
          }
          if (step === 8 && isRetryableVerificationTransportError(err)) {
            const fallback = await detectStep8PostSubmitFallback({
              step,
              timeoutMs: 9000,
              pollIntervalMs: 300,
            });
            if (fallback.success) {
              if (fallback.addPhonePage) {
                await addLog('Communication was interrupted after verification code submission, but the page already entered the phone verification page; treating as success and continuing.', 'warn', {
                  step: completionStep,
                  stepKey: 'fetch-login-code',
                });
              } else {
                await addLog('Communication was interrupted after verification code submission, but the page already entered the OAuth consent page; treating as success and continuing.', 'warn', {
                  step: completionStep,
                  stepKey: 'fetch-login-code',
                });
              }
              return {
                success: true,
                assumed: true,
                transportRecovered: true,
                addPhonePage: Boolean(fallback.addPhonePage),
                url: fallback.url || '',
              };
            }
            if (fallback.restartStep7) {
              const urlPart = fallback.url ? ` URL: ${fallback.url}` : '';
              throw new Error(`STEP8_RESTART_STEP7::Step ${completionStep}: After verification code submission, the auth page entered the login timeout error page. Please go back to step ${authLoginStep} and start again.${urlPart}`.trim());
            }
          }
          throw err;
        }
      } else if (shouldAvoidReplaySubmit) {
        try {
          result = await sendToContentScript('openai-auth', message, {
            responseTimeoutMs: baseResponseTimeoutMs,
          });
        } catch (err) {
          if (isRetryableVerificationTransportError(err)) {
            await addLog('Auth page is switching, waiting for it to become ready again before confirming the verification code submission result...', 'warn', {
              step: completionStep,
              stepKey: 'fetch-login-code',
            });
            const fallback = await detectStep8PostSubmitFallback({
              step,
              timeoutMs: 9000,
              pollIntervalMs: 300,
            });
            if (fallback.invalidCode) {
              return {
                invalidCode: true,
                errorText: fallback.errorText || 'Verification code was rejected.',
                url: fallback.url || '',
              };
            }
            if (fallback.success) {
              if (fallback.addPhonePage) {
                await addLog('Communication was interrupted after verification code submission, but the page already entered the phone verification page; treating as success and continuing.', 'warn', {
                  step: completionStep,
                  stepKey: 'fetch-login-code',
                });
              } else {
                await addLog('Communication was interrupted after verification code submission, but the page already entered the OAuth consent page; treating as success and continuing.', 'warn', {
                  step: completionStep,
                  stepKey: 'fetch-login-code',
                });
              }
              return {
                success: true,
                assumed: true,
                transportRecovered: true,
                addPhonePage: Boolean(fallback.addPhonePage),
                url: fallback.url || '',
              };
            }
            if (fallback.restartStep7) {
              const urlPart = fallback.url ? ` URL: ${fallback.url}` : '';
              throw new Error(`STEP8_RESTART_STEP7::Step ${completionStep}: After verification code submission, the auth page entered the login timeout error page. Please go back to step ${authLoginStep} and start again.${urlPart}`.trim());
            }
          }
          throw err;
        }
      } else {
        result = await sendToContentScript('openai-auth', message, {
          responseTimeoutMs: baseResponseTimeoutMs,
        });
      }

      if (result && result.error) {
        throw new Error(result.error);
      }

      return result || {};
    }

    async function resolveVerificationStep(step, state, mail, options = {}) {
      const completionStep = getCompletionStep(step, options);
      activeVerificationLogStep = completionStep;
      const completionNodeId = await getNodeIdForStep(completionStep);
      const stateKey = getVerificationCodeStateKey(step);
      const rejectedCodes = new Set();
      const hotmailPollConfig = mail.provider === HOTMAIL_PROVIDER
        ? getHotmailVerificationPollConfig(step)
        : null;
      const beforeSubmit = typeof options.beforeSubmit === 'function'
        ? options.beforeSubmit
        : null;
      const ignorePersistedLastCode = Boolean(hotmailPollConfig?.ignorePersistedLastCode);
      if (state[stateKey] && !ignorePersistedLastCode) {
        rejectedCodes.add(state[stateKey]);
      }

      let nextFilterAfterTimestamp = options.filterAfterTimestamp ?? null;
      const requestFreshCodeFirst = options.requestFreshCodeFirst !== undefined
        ? Boolean(options.requestFreshCodeFirst)
        : (hotmailPollConfig?.requestFreshCodeFirst ?? false);
      let remainingAutomaticResendCount = options.maxResendRequests !== undefined
        ? normalizeVerificationResendCount(
          options.maxResendRequests,
          getLegacyVerificationResendCountDefault(step, { requestFreshCodeFirst })
        )
        : getConfiguredVerificationResendCount(step, state, { requestFreshCodeFirst });
      const maxSubmitAttempts = mail.provider === LUCKMAIL_PROVIDER ? 3 : 15;
      const resendIntervalMs = Math.max(0, Number(options.resendIntervalMs) || 0);
      const externalOnResendRequestedAt = typeof options.onResendRequestedAt === 'function'
        ? options.onResendRequestedAt
        : null;
      let lastResendAt = resolveInitialVerificationRequestedAt(
        step,
        state,
        Number(options.lastResendAt) || 0
      );

      const updateFilterAfterTimestampForVerificationStep = async (requestedAt) => {
        if (externalOnResendRequestedAt) {
          try {
            await externalOnResendRequestedAt(requestedAt);
          } catch (_) {
            // Keep resend flow best-effort; state sync callback failures should not break verification.
          }
        }
        return nextFilterAfterTimestamp;
      };

      await clear2925MailboxBeforePolling(step, mail, options);

      if (requestFreshCodeFirst) {
        if (remainingAutomaticResendCount <= 0) {
          await addLog(`Step ${step}: Current auto-resend verification code count is 0; will poll the mailbox using the current time window directly.`, 'info');
        } else {
          try {
            lastResendAt = await requestVerificationCodeResend(step, options);
            remainingAutomaticResendCount -= 1;
            await updateFilterAfterTimestampForVerificationStep(lastResendAt);
            await addLog(`Step ${step}: Requested a new ${getVerificationCodeLabel(step)} verification code first before polling the mailbox.`, 'warn');
          } catch (err) {
            if (isStopError(err)) {
              throw err;
            }
            await addLog(`Step ${step}: First refresh of the verification code failed: ${err.message}. Will keep polling the current time window.`, 'warn');
          }
        }
      }

      if (mail.provider === HOTMAIL_PROVIDER) {
          const initialDelayMs = Number(options.initialDelayMs ?? hotmailPollConfig.initialDelayMs) || 0;
          if (initialDelayMs > 0) {
            const remainingMs = await getRemainingTimeBudgetMs(
              step,
              options,
              `Wait for ${getVerificationCodeLabel(step)} verification code email to arrive`
            );
            const delayMs = remainingMs === null
              ? initialDelayMs
              : Math.min(initialDelayMs, Math.max(0, remainingMs));
            await addLog(`Step ${step}: Waiting ${Math.round(initialDelayMs / 1000)} seconds so the Hotmail verification code email can arrive first...`, 'info');
            await sleepWithStop(delayMs);
          }
        }

        for (let attempt = 1; attempt <= maxSubmitAttempts; attempt++) {
          const pollOptions = {
            excludeCodes: [...rejectedCodes],
            disableTimeBudgetCap: Boolean(options.disableTimeBudgetCap),
            getRemainingTimeMs: options.getRemainingTimeMs,
            maxResendRequests: remainingAutomaticResendCount,
            initialPollMaxAttempts: mail.provider === '2925' && rejectedCodes.size > 0
              ? undefined
              : options.initialPollMaxAttempts,
            pollAttemptPlan: mail.provider === '2925' && rejectedCodes.size > 0
              ? undefined
              : options.pollAttemptPlan,
            resendIntervalMs,
            lastResendAt,
            onResendRequestedAt: updateFilterAfterTimestampForVerificationStep,
          };
          if (nextFilterAfterTimestamp !== null && nextFilterAfterTimestamp !== undefined) {
            pollOptions.filterAfterTimestamp = nextFilterAfterTimestamp;
          }
          const result = await pollFreshVerificationCode(step, state, mail, pollOptions);
          lastResendAt = Number(result?.lastResendAt) || lastResendAt;
          remainingAutomaticResendCount = normalizeVerificationResendCount(
            result?.remainingResendRequests,
            remainingAutomaticResendCount
          );

          throwIfStopped();
          await addLog(`Step ${step}: Got ${getVerificationCodeLabel(step)} verification code: ${result.code}`);
          if (beforeSubmit) {
            await beforeSubmit(result, {
              attempt,
              rejectedCodes: new Set(rejectedCodes),
              filterAfterTimestamp: nextFilterAfterTimestamp ?? undefined,
              lastResendAt,
            });
          }
          throwIfStopped();
          const submitResult = await submitVerificationCode(step, result.code, options);

          if (submitResult.invalidCode) {
            rejectedCodes.add(result.code);
            await addLog(`Step ${step}: Verification code was rejected by the page: ${submitResult.errorText || result.code}`, 'warn');

            if (attempt >= maxSubmitAttempts) {
              throw new Error(`Step ${step}: Verification code failed repeatedly and reached the retry limit of ${maxSubmitAttempts}.`);
            }

            if (mail.provider === LUCKMAIL_PROVIDER) {
              await addLog(`Step ${step}: LuckMail verification code submission failed; waiting 15 seconds before polling the /code endpoint again (${attempt + 1}/${maxSubmitAttempts})...`, 'warn');
              await sleepWithStop(15000);
              continue;
            }

            if (remainingAutomaticResendCount <= 0) {
              await addLog(`Step ${step}: Reached the auto-resend verification code limit; will exclude the rejected codes and continue polling for new mail.`, 'warn');
              continue;
            }

            lastResendAt = await requestVerificationCodeResend(step, options);
            remainingAutomaticResendCount -= 1;
            await updateFilterAfterTimestampForVerificationStep(lastResendAt);
            await addLog(`Step ${step}: Requested a new verification code after submission failure (${attempt + 1}/${maxSubmitAttempts})...`, 'warn');
            continue;
          }

          await setState({
            lastEmailTimestamp: result.emailTimestamp,
            [stateKey]: result.code,
          });

          if (!completionNodeId) {
            throw new Error(`Step ${completionStep} is not mapped to a verification code node.`);
          }
          await completeNodeFromBackground(completionNodeId, {
            emailTimestamp: result.emailTimestamp,
            code: result.code,
            phoneVerificationRequired: Boolean(submitResult.addPhonePage),
            ...(step === 4 && submitResult?.skipProfileStep ? { skipProfileStep: true } : {}),
            ...(step === 4 && submitResult?.skipProfileStepReason
              ? { skipProfileStepReason: submitResult.skipProfileStepReason }
              : {}),
          });
          triggerPostSuccessMailboxCleanup(step, mail);
          return {
            phoneVerificationRequired: Boolean(submitResult.addPhonePage),
            url: submitResult.url || '',
          };
        }
      }

      return {
        confirmCustomVerificationStepBypass,
        getVerificationCodeLabel,
        getVerificationCodeStateKey,
        getVerificationPollPayload,
        pollFreshVerificationCode,
        pollFreshVerificationCodeWithResendInterval,
        requestVerificationCodeResend,
        resolveVerificationStep,
        submitVerificationCode,
      };
    }

    return {
      createVerificationFlowHelpers,
    };
  });
