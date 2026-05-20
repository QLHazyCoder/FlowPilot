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
      ensureContentScriptReadyOnTab,
      getNodeIdByStepForState,
      getHotmailVerificationPollConfig,
      getHotmailVerificationRequestTimestamp,
      handleMail2925LimitReachedError,
      getState,
      getTabId,
      HOTMAIL_PROVIDER,
      isMail2925LimitReachedError,
      isStopError,
      isTabAlive,
      LUCKMAIL_PROVIDER,
      YYDS_MAIL_PROVIDER = 'yyds-mail',
      MAIL_2925_VERIFICATION_INTERVAL_MS,
      MAIL_2925_VERIFICATION_MAX_ATTEMPTS,
      pollCloudflareTempEmailVerificationCode,
      pollCloudMailVerificationCode,
      pollHotmailVerificationCode,
      pollLuckmailVerificationCode,
      pollYydsMailVerificationCode,
      reuseOrCreateTab,
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
      return step === 4 ? '注册' : '登录';
    }

    function getYahooRejectedCodesFromState(step, state = {}) {
      const rejectedCodes = [];
      if (step === 8) {
        const lastSignupCode = String(state?.lastSignupCode || '').trim();
        if (lastSignupCode) {
          rejectedCodes.push(lastSignupCode);
        }
      }
      return rejectedCodes;
    }

    function inferMailProvider(mail = {}, state = {}) {
      const explicitProvider = String(mail?.provider || '').trim().toLowerCase();
      if (explicitProvider) {
        return explicitProvider;
      }

      const stateProvider = String(state?.mailProvider || '').trim().toLowerCase();
      if (stateProvider) {
        return stateProvider;
      }

      const source = String(mail?.source || '').trim().toLowerCase();
      const injectSource = String(mail?.injectSource || '').trim().toLowerCase();
      const label = String(mail?.label || '').trim().toLowerCase();
      const url = String(mail?.url || '').trim().toLowerCase();
      const combined = `${source} ${injectSource} ${label} ${url}`;

      if (/yahoo/.test(combined)) return 'yahoo';
      if (/2925/.test(combined)) return '2925';
      if (/hotmail/.test(combined)) return HOTMAIL_PROVIDER;
      if (/luckmail/.test(combined)) return LUCKMAIL_PROVIDER;
      if (/cloudmail/.test(combined)) return CLOUD_MAIL_PROVIDER;
      if (/yyds/.test(combined)) return YYDS_MAIL_PROVIDER;
      if (/cloudflare/.test(combined)) return CLOUDFLARE_TEMP_EMAIL_PROVIDER;
      return explicitProvider || stateProvider || '';
    }

    function withResolvedMailProvider(mail = {}, state = {}) {
      const provider = inferMailProvider(mail, state);
      if (!mail || typeof mail !== 'object') {
        return { provider };
      }
      if (String(mail?.provider || '').trim().toLowerCase() === provider) {
        return mail;
      }
      return { ...mail, provider };
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
              'signup-page',
              request,
              {
                timeoutMs: requestTimeoutMs,
                responseTimeoutMs: requestTimeoutMs,
                retryDelayMs: 400,
                logMessage: `步骤 ${step}：验证码提交后页面正在切换，等待页面恢复并确认授权状态...`,
              }
            )
            : await sendToContentScript('signup-page', request, {
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
      await addLog(`步骤 ${completionStep}：当前为自定义邮箱模式，请手动在页面中输入${verificationLabel}验证码并进入下一页面。`, 'warn');

      let response = null;
      try {
        response = await confirmCustomVerificationStepBypassRequest(promptStep);
      } catch {
        throw new Error(`步骤 ${completionStep}：无法打开确认弹窗，请先保持侧边栏打开后重试。`);
      }

      if (response?.error) {
        throw new Error(response.error);
      }
      if (step === 8 && response?.addPhoneDetected) {
        throw new Error(`步骤 ${completionStep}：验证码提交后页面进入手机号页面，当前流程无法继续自动授权。 URL: https://auth.openai.com/add-phone`);
      }
      if (!response?.confirmed) {
        throw new Error(`步骤 ${completionStep}：已取消手动${verificationLabel}验证码确认。`);
      }

      await setState({
        lastEmailTimestamp: null,
        signupVerificationRequestedAt: null,
        loginVerificationRequestedAt: null,
      });
      const completionNodeId = await getNodeIdForStep(completionStep);
      if (!completionNodeId) {
        throw new Error(`步骤 ${completionStep} 未映射到验证码节点。`);
      }
      await setNodeStatus(completionNodeId, 'skipped');
      await addLog(`步骤 ${completionStep}：已确认手动完成${verificationLabel}验证码输入，当前步骤已跳过。`, 'warn');
    }

    function getVerificationPollPayload(step, state, overrides = {}) {
      if (typeof externalBuildVerificationPollPayload === 'function') {
        return externalBuildVerificationPollPayload(step, state, overrides);
      }
      const normalizedStep = Number(step) === 4 ? 4 : 8;
      const is2925Provider = state?.mailProvider === '2925';
      const isYahooProvider = state?.mailProvider === 'yahoo';
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
        maxAttempts: is2925Provider ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : (isYahooProvider ? 60 : 5),
        intervalMs: is2925Provider ? MAIL_2925_VERIFICATION_INTERVAL_MS : (isYahooProvider ? 5000 : 3000),
        keepRefreshingUntilCode: isYahooProvider,
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
      const signupTabId = await getTabId('signup-page');
      if (!signupTabId) {
        throw new Error('认证页面标签页已关闭，无法重新请求验证码。');
      }

      throwIfStopped();
      await chrome.tabs.update(signupTabId, { active: true });
      throwIfStopped();

      const result = await sendToContentScript('signup-page', {
        type: 'RESEND_VERIFICATION_CODE',
        step,
        source: 'background',
        payload: {},
      }, {
        responseTimeoutMs: await getResponseTimeoutMsForStep(
          step,
          options,
          30000,
          `重新发送${getVerificationCodeLabel(step)}验证码`
        ),
      });

      if (result && result.error) {
        throw new Error(result.error);
      }

      await addLog(`步骤 ${step}：已请求新的${getVerificationCodeLabel(step)}验证码。`, 'warn');

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
          await addLog(`步骤 ${step}：已切换到 2925 邮箱标签页等待新邮件。`, 'info');
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
      await addLog(`步骤 ${step}：开始刷新 2925 邮箱前先清空全部邮件，避免读取旧验证码邮件。`, 'warn');

      try {
        const responseTimeoutMs = await getResponseTimeoutMsForStep(
          step,
          options,
          15000,
          '清空 2925 邮箱历史邮件'
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
          await addLog(`步骤 ${step}：未能确认 2925 邮箱已清空，将继续刷新等待新邮件。`, 'warn');
          return;
        }

        await addLog(`步骤 ${step}：2925 邮箱已预先清空，开始刷新等待新邮件。`, 'info');
      } catch (err) {
        if (isStopError(err)) {
          throw err;
        }
        await addLog(`步骤 ${step}：预清空 2925 邮箱失败，将继续刷新等待新邮件：${err.message}`, 'warn');
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
        await addLog(`步骤 ${step}：已关闭 iCloud 邮箱标签页，避免长期累积。`, 'info');
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

    function parseYahooReopenRequirement(error) {
      const message = String(error?.message || error || '');
      const match = message.match(/YAHOO_(?:INBOX|SETTINGS)_REOPEN_REQUIRED::(https?:\/\/\S+)/i);
      return match ? match[1] : '';
    }

    function getYahooInboxUrl(mail) {
      const fallbackUrl = 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX';
      const candidateUrl = String(mail?.url || '').trim();

      try {
        const parsed = new URL(candidateUrl);
        const isYahooInbox = /(^|\.)mail\.yahoo\.com$/i.test(parsed.hostname)
          && /^\/n\/inbox\/all\/?$/i.test(parsed.pathname || '');
        if (isYahooInbox) {
          const accountIds = String(parsed.searchParams.get('accountIds') || '').trim();
          return accountIds
            ? `${fallbackUrl}&accountIds=${encodeURIComponent(accountIds)}`
            : fallbackUrl;
        }
      } catch (_) {}

      return fallbackUrl;
    }

    async function getYahooMailTabSnapshot(mail) {
      const source = String(mail?.source || '').trim();
      if (!source) {
        return { source, tabId: null, alive: false };
      }

      let tabId = null;
      if (typeof getTabId === 'function') {
        try {
          tabId = await getTabId(source);
        } catch (_) {
          tabId = null;
        }
      }

      let alive = Number.isInteger(tabId);
      if (typeof isTabAlive === 'function') {
        try {
          alive = await isTabAlive(source);
        } catch (_) {
          alive = Number.isInteger(tabId);
        }
      }

      return {
        source,
        tabId: Number.isInteger(tabId) ? tabId : null,
        alive: Boolean(alive),
      };
    }

    async function assertYahooMailTabAvailable(step, mail, contextLabel = '收件箱重建后') {
      let snapshot = null;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        snapshot = await getYahooMailTabSnapshot(mail);
        if (snapshot.alive && Number.isInteger(snapshot.tabId)) {
          return snapshot;
        }
        if (attempt < 5) {
          await sleepWithStop(300);
        }
      }

      const sourceLabel = snapshot?.source || String(mail?.source || '').trim() || 'yahoo-mail';
      throw new Error(`步骤 ${step}：Yahoo ${contextLabel}仍未能定位到可用标签页（source=${sourceLabel}，tabId=${snapshot?.tabId ?? 'null'}）。请停止当前流程后重试。`);
    }

    async function reopenYahooMailTabIfNeeded(step, mail, error) {
      const reopenUrl = parseYahooReopenRequirement(error);
      if (!reopenUrl || mail?.provider !== 'yahoo' || typeof reuseOrCreateTab !== 'function') {
        return false;
      }

      const targetUrl = /\/n\/settings(?:\/2)?/i.test(reopenUrl)
        ? reopenUrl
        : getYahooInboxUrl(mail);

      await addLog(`步骤 ${step}：Yahoo 页面要求重开，正在关闭旧标签并重新打开标准页面。`, 'warn');

      try {
        const snapshot = await getYahooMailTabSnapshot(mail);
        if (snapshot.alive && Number.isInteger(snapshot.tabId)) {
          await chrome.tabs.remove(snapshot.tabId).catch(() => {});
          await sleepWithStop(400);
        }
      } catch (err) {
        await addLog(`步骤 ${step}：检查 Yahoo 旧标签页失败，将继续创建新标签页：${err?.message || err}`, 'warn');
      }

      const newTabId = await reuseOrCreateTab(mail.source, targetUrl, {
        inject: mail.inject,
        injectSource: mail.injectSource,
        navigateOnReuse: true,
      });

      if (!Number.isInteger(newTabId)) {
        throw new Error('Yahoo：重开标签页失败，未能获取有效的标签页 ID。');
      }

      await sleepWithStop(2500);
      await assertYahooMailTabAvailable(step, mail, '标签页重开后');

      if (typeof ensureContentScriptReadyOnTab === 'function') {
        try {
          await ensureContentScriptReadyOnTab(mail.source, newTabId, {
            inject: mail.inject,
            injectSource: mail.injectSource,
            timeoutMs: 30000,
            retryDelayMs: 800,
            logMessage: `步骤 ${step}：Yahoo 收件箱标签页重开后内容脚本仍在加载，正在等待就绪...`,
          });
        } catch (err) {
          await addLog(`步骤 ${step}：Yahoo 内容脚本就绪检查失败，将继续尝试读取顶部邮件：${err?.message || err}`, 'warn');
        }
      }

      return true;
    }

    async function ensureYahooInboxBeforePolling(step, mail, options = {}) {
      const effectiveProvider = inferMailProvider(mail);
      if (effectiveProvider !== 'yahoo') {
        return false;
      }

      const mailSource = String(mail?.source || '').trim();
      if (!mailSource) {
        await addLog(`步骤 ${step}：当前未提供可复用的 Yahoo 邮箱标签页上下文，跳过强制切回标准收件箱。`, 'warn');
        return false;
      }

      const targetUrl = getYahooInboxUrl(mail);
      const waitMs = Math.max(0, Number(options.waitMs) || 1800);
      const logMessage = options.logMessage === undefined
        ? `步骤 ${step}：轮询 Yahoo 前先强制回到标准收件箱页。`
        : String(options.logMessage || '').trim();
      const normalizedMail = {
        ...mail,
        url: targetUrl,
        navigateOnReuse: true,
      };
      const snapshotBefore = await getYahooMailTabSnapshot(normalizedMail);
      const hasReusableTab = snapshotBefore.alive && Number.isInteger(snapshotBefore.tabId);

      if (hasReusableTab && typeof chrome?.tabs?.get === 'function') {
        try {
          const currentTab = await chrome.tabs.get(snapshotBefore.tabId);
          const currentUrl = String(currentTab?.url || '').trim();
          if (currentUrl && currentUrl.includes('/n/inbox')) {
            if (waitMs > 0) {
              await sleepWithStop(waitMs);
            }
            return true;
          }
        } catch (err) {
          await addLog(`步骤 ${step}：检查 Yahoo 标签页当前 URL 失败，将继续强制导航：${err?.message || err}`, 'warn');
        }
      }

      if (typeof reuseOrCreateTab === 'function') {
        if (logMessage) {
          await addLog(logMessage, options.logLevel || 'info');
        }
        await reuseOrCreateTab(normalizedMail.source, targetUrl, {
          inject: normalizedMail.inject,
          injectSource: normalizedMail.injectSource,
          reloadIfSameUrl: true,
          navigateOnReuse: true,
        });
        await assertYahooMailTabAvailable(step, normalizedMail, hasReusableTab ? '收件箱刷新后' : '收件箱标签页重建后');
        if (waitMs > 0) {
          await sleepWithStop(waitMs);
        }
        if (mail && typeof mail === 'object' && mail.url !== targetUrl) {
          mail.url = targetUrl;
        }
        return true;
      }

      const mailTabId = hasReusableTab ? snapshotBefore.tabId : null;
      if (!Number.isInteger(mailTabId) || !chrome?.tabs?.update) {
        throw new Error(`步骤 ${step}：当前没有可用的 Yahoo 标签页可供导航。请停止当前流程后重试。`);
      }

      await chrome.tabs.update(mailTabId, { url: targetUrl, active: true }).catch(() => {});
      if (waitMs > 0) {
        await sleepWithStop(waitMs);
      }
      if (mail && typeof mail === 'object' && mail.url !== targetUrl) {
        mail.url = targetUrl;
      }
      return true;
    }

    async function pollYahooVerificationCodeWithForegroundRefresh(step, state, mail, pollOverrides = {}) {
      mail = withResolvedMailProvider(mail, state);
      const stateKey = getVerificationCodeStateKey(step);
      const rejectedCodes = new Set();
      if (state[stateKey] && pollOverrides?.seedRejectedCodesFromState !== false) {
        rejectedCodes.add(state[stateKey]);
      }
      for (const code of getYahooRejectedCodesFromState(step, state)) {
        if (code) rejectedCodes.add(code);
      }
      for (const code of (pollOverrides.excludeCodes || [])) {
        if (code) rejectedCodes.add(code);
      }

      const refreshIntervalMs = Math.max(1000, Number(pollOverrides.intervalMs) || 5000);
      const maxPageRefreshes = Math.max(1, Math.floor(Number(pollOverrides.maxAttempts) || 60));
      const refreshesBeforeResend = Math.max(1, Math.floor(Number(pollOverrides.refreshesBeforeResend) || 5));
      const payloadOverrides = { ...pollOverrides };
      delete payloadOverrides.excludeCodes;
      delete payloadOverrides.intervalMs;
      delete payloadOverrides.maxAttempts;
      delete payloadOverrides.refreshesBeforeResend;
      delete payloadOverrides.resendIntervalMs;
      delete payloadOverrides.lastResendAt;
      delete payloadOverrides.maxResendRequests;
      delete payloadOverrides.onResendRequestedAt;
      delete payloadOverrides.keepRefreshingUntilCode;
      delete payloadOverrides.filterAfterTimestamp;
      delete payloadOverrides.seedRejectedCodesFromState;

      let totalPageRefreshes = 0;
      let resendCycle = 0;
      let lastError = null;
      let lastResendAt = Number(pollOverrides.lastResendAt) || 0;
      let lastObservedTopMessageFingerprint = String(
        pollOverrides.previousTopMessageFingerprint || state.lastYahooTopMessageFingerprint || ''
      ).trim();
      const previousAcceptedEmailTimestamp = Math.max(0, Number(
        pollOverrides.previousAcceptedEmailTimestamp || state.lastEmailTimestamp || 0
      ) || 0);

      await addLog(
        `步骤 ${step}：Yahoo 专用取码流程已启动：先重发验证码，再切回收件箱顶部邮件检查，每 ${Math.round(refreshIntervalMs / 1000)} 秒刷新一次。`,
        'warn'
      );

      while (totalPageRefreshes < maxPageRefreshes) {
        throwIfStopped();
        resendCycle += 1;
        lastResendAt = await requestVerificationCodeResend(step, {
          ...pollOverrides,
          allowMissingSignupTab: true,
        });

        await ensureYahooInboxBeforePolling(step, mail, {
          logMessage: `步骤 ${step}：已跳转到 Yahoo 收件箱页面，开始检查最顶部验证码邮件。`,
          logLevel: 'warn',
          waitMs: 2500,
        });

        let refreshesThisCycle = 0;
        const maxCycleRefreshes = Math.min(refreshesBeforeResend, maxPageRefreshes - totalPageRefreshes);
        while (refreshesThisCycle < maxCycleRefreshes && totalPageRefreshes < maxPageRefreshes) {
          throwIfStopped();
          const payload = getVerificationPollPayload(step, state, {
            ...payloadOverrides,
            excludeCodes: [...rejectedCodes],
            intervalMs: refreshIntervalMs,
            maxAttempts: 1,
            keepRefreshingUntilCode: false,
            yahooTopRowOnly: true,
            filterAfterTimestamp: 0,
            requestedAt: lastResendAt,
            previousTopMessageFingerprint: lastObservedTopMessageFingerprint,
            previousAcceptedEmailTimestamp,
            yahooFreshnessSkewMs: Math.max(refreshIntervalMs * 2, 180000),
          });

          const timedPoll = await applyMailPollingTimeBudget(
            step,
            payload,
            { ...pollOverrides, disableTimeBudgetCap: Boolean(pollOverrides.disableTimeBudgetCap) },
            `检查 Yahoo 收件箱顶部${getVerificationCodeLabel(step)}验证码邮件`
          );

          let result;
          try {
            result = await sendToMailContentScriptResilient(
              mail,
              {
                type: 'YAHOO_CHECK_TOP_MESSAGE',
                step,
                source: 'background',
                payload: {
                  ...timedPoll.payload,
                  intervalMs: refreshIntervalMs,
                  maxAttempts: 1,
                  keepRefreshingUntilCode: false,
                  yahooTopRowOnly: true,
                  filterAfterTimestamp: 0,
                },
              },
              {
                timeoutMs: Math.min(timedPoll.timeoutMs, 30000),
                maxRecoveryAttempts: 2,
                responseTimeoutMs: Math.min(timedPoll.responseTimeoutMs, 30000),
                logStep: activeVerificationLogStep,
                logStepKey: step === 4 ? 'fetch-signup-code' : 'fetch-login-code',
              }
            );
          } catch (err) {
            if (await reopenYahooMailTabIfNeeded(step, mail, err)) {
              await addLog(`步骤 ${step}：Yahoo 标签页已重开，继续检查顶部邮件。`, 'warn');
              continue;
            }
            throw err;
          }

          if (result?.error) {
            const resultError = new Error(result.error);
            if (await reopenYahooMailTabIfNeeded(step, mail, resultError)) {
              await addLog(`步骤 ${step}：Yahoo 顶部检查要求重开收件箱，已处理并继续。`, 'warn');
              continue;
            }
            throw resultError;
          }

          if (result?.topMessageFingerprint !== undefined) {
            lastObservedTopMessageFingerprint = String(result.topMessageFingerprint || '').trim();
          }

          if (result?.code && !rejectedCodes.has(result.code)) {
            if (result.freshnessMatched) {
              await addLog(`步骤 ${step}：Yahoo 顶部邮件命中${getVerificationCodeLabel(step)}验证码 ${result.code}`, 'warn');
              return {
                ...result,
                lastResendAt,
                remainingResendRequests: 0,
                totalPageRefreshes,
              };
            }
            await addLog(`步骤 ${step}：Yahoo 顶部邮件发现验证码 ${result.code}，但不是本轮新验证码，继续等待。`, 'warn');
          }

          lastError = new Error(result?.reason || `步骤 ${step}：Yahoo 顶部邮件未读取到新的验证码。`);
          refreshesThisCycle += 1;
          totalPageRefreshes += 1;

          if (refreshesThisCycle < maxCycleRefreshes && totalPageRefreshes < maxPageRefreshes) {
            await addLog(
              `步骤 ${step}：Yahoo 顶部邮件未命中，${Math.round(refreshIntervalMs / 1000)} 秒后刷新收件箱继续检查（${totalPageRefreshes}/${maxPageRefreshes}）。`,
              'warn'
            );
            await sleepWithStop(refreshIntervalMs);
            await ensureYahooInboxBeforePolling(step, mail, {
              logMessage: `步骤 ${step}：正在刷新 Yahoo 收件箱并重新检查顶部邮件。`,
              logLevel: 'warn',
              waitMs: 2500,
            });
          }
        }

        if (refreshesThisCycle >= maxCycleRefreshes) {
          await addLog(`步骤 ${step}：Yahoo 连续 ${refreshesThisCycle} 次前台刷新仍未命中，返回认证页重新获取验证码。`, 'warn');
        }
      }

      throw lastError || new Error(`步骤 ${step}：Yahoo 前台刷新 ${maxPageRefreshes} 次后仍未获取到新的${getVerificationCodeLabel(step)}验证码。`);
    }

    async function pollFreshVerificationCodeWithResendInterval(step, state, mail, pollOverrides = {}) {
      mail = withResolvedMailProvider(mail, state);
      if (mail?.provider === 'yahoo') {
        throw new Error(`步骤 ${step}：Yahoo 已禁用普通定时邮箱轮询，仅允许专用前台刷新取码流程。`);
      }

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
            `步骤 ${step}：首次进入验证码轮询，先等待 ${waitSeconds} 秒观察新邮件，避免过早重复重发。`,
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
              `轮询${getVerificationCodeLabel(step)}验证码邮箱`
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
              throw new Error(`步骤 ${step}：邮箱轮询结束，但未获取到验证码。`);
            }

            if (rejectedCodes.has(result.code)) {
              throw new Error(`步骤 ${step}：再次收到了相同的${getVerificationCodeLabel(step)}验证码：${result.code}`);
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
              await addLog(`步骤 ${step}：${err.message}`, 'warn');
              if (transportErrorStreak >= maxTransportErrorStreak) {
                throw new Error(
                  `步骤 ${step}：${mail?.label || '邮箱'}页面通信异常连续 ${transportErrorStreak} 次，已停止当前轮询以避免重复重发验证码。最后错误：${err.message}`
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
            await addLog(`步骤 ${step}：${err.message}`, 'warn');
          }

          if (mail?.source === 'icloud-mail' && maxIcloudNoResendRounds > 0) {
            pollOnlyNoResendRounds += 1;
            if (pollOnlyNoResendRounds >= maxIcloudNoResendRounds) {
              throw new Error(
                `步骤 ${step}：iCloud 邮箱连续 ${pollOnlyNoResendRounds} 轮轮询均未拿到验证码且未触发重发，已停止当前链路以避免空轮询循环，请刷新邮箱页后重试。`
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
              `步骤 ${step}：距离下次重新发送验证码还差 ${Math.ceil(effectiveCooldownMs / 1000)} 秒，继续刷新邮箱（第 ${round}/${maxRounds} 轮）...`,
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
            await addLog(`步骤 ${step}：已到 25 秒重发间隔，准备重新发送验证码（第 ${round + 1}/${maxRounds} 轮）...`, 'warn');
          }
          break;
        }
      }

      throw lastError || new Error(`步骤 ${step}：无法获取新的${getVerificationCodeLabel(step)}验证码。`);
    }

    function shouldRequestLuckmailResendBeforeRetry(error) {
      const message = String(error?.message || error || '');
      if (!message) {
        return true;
      }

      return !/没有可用 token|token 对应邮箱与当前邮箱不一致/i.test(message);
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
              await addLog(`步骤 ${step}：LuckMail 点击重新发送验证码失败：${resendError.message}，仍将在 ${Math.ceil(intervalMs / 1000)} 秒后继续轮询 /code 接口。`, 'warn');
            }
          }

          await addLog(`步骤 ${step}：LuckMail 暂未获取到新的${getVerificationCodeLabel(step)}验证码，等待 ${Math.ceil(intervalMs / 1000)} 秒后继续轮询 /code 接口（${attempt + 1}/${maxAttempts}）...`, 'warn');
          await sleepWithStop(intervalMs);
        }
      }

      throw lastError || new Error(`步骤 ${step}：无法获取新的${getVerificationCodeLabel(step)}验证码。`);
    }

    async function pollFreshVerificationCode(step, state, mail, pollOverrides = {}) {
      mail = withResolvedMailProvider(mail, state);
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
        }, cleanPollOverrides, `轮询${getVerificationCodeLabel(step)}验证码邮箱`);
        return pollHotmailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === LUCKMAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `轮询${getVerificationCodeLabel(step)}验证码邮箱`);
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
        }, cleanPollOverrides, `轮询${getVerificationCodeLabel(step)}验证码邮箱`);
        return pollCloudflareTempEmailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === CLOUD_MAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `轮询${getVerificationCodeLabel(step)}验证码邮箱`);
        return pollCloudMailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === YYDS_MAIL_PROVIDER) {
        const timedPoll = await applyMailPollingTimeBudget(step, {
          ...getVerificationPollPayload(step, state),
          ...cleanPollOverrides,
        }, cleanPollOverrides, `轮询${getVerificationCodeLabel(step)}验证码邮箱`);
        return pollYydsMailVerificationCode(step, state, timedPoll.payload);
      }
      if (mail.provider === 'yahoo') {
        const refreshesBeforeResend = Math.max(1, Number(pollOverrides.refreshesBeforeResend) || 5);
        const refreshIntervalSeconds = Math.max(1, Math.round((Number(pollOverrides.intervalMs) || 5000) / 1000));
        const maxRefreshAttempts = Math.max(1, Number(pollOverrides.maxAttempts) || 60);
        await addLog(
          `步骤 ${step}：本次将走 Yahoo 专用前台刷新取码逻辑：先重发，再跳转收件箱，只检查顶部邮件，每 ${refreshIntervalSeconds} 秒刷新一次，连续 ${refreshesBeforeResend} 次未命中就回认证页重新获取验证码，总刷新上限 ${maxRefreshAttempts} 次。`,
          'warn'
        );
        return pollYahooVerificationCodeWithForegroundRefresh(step, state, mail, pollOverrides);
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
            `轮询${getVerificationCodeLabel(step)}验证码邮箱`
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
            throw new Error(`步骤 ${step}：邮箱轮询结束，但未获取到验证码。`);
          }

          if (rejectedCodes.has(result.code)) {
            throw new Error(`步骤 ${step}：再次收到了相同的${getVerificationCodeLabel(step)}验证码：${result.code}`);
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
          await addLog(`步骤 ${step}：${err.message}`, 'warn');
          if (round < maxRounds) {
            await addLog(`步骤 ${step}：将重新发送验证码后重试（${round + 1}/${maxRounds}）...`, 'warn');
          }
        }
      }

      throw lastError || new Error(`步骤 ${step}：无法获取新的${getVerificationCodeLabel(step)}验证码。`);
    }

    async function submitVerificationCode(step, code, options = {}) {
      const completionStep = getCompletionStep(step, options);
      const authLoginStep = completionStep >= 11 ? 10 : 7;
      const signupTabId = await getTabId('signup-page');
      if (!signupTabId) {
        throw new Error('认证页面标签页已关闭，无法填写验证码。');
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
        `填写${getVerificationCodeLabel(step)}验证码`
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
          result = await sendToContentScriptResilient('signup-page', message, {
            timeoutMs: Math.max(baseResponseTimeoutMs + 15000, 30000),
            retryDelayMs: 700,
            responseTimeoutMs: baseResponseTimeoutMs,
            logMessage: '认证页正在切换，等待页面重新就绪后继续确认验证码提交结果...',
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
                ? 'ChatGPT 已登录首页'
                : '注册资料页';
              await addLog(`步骤 4：验证码提交后页面已切换到${fallbackLabel}，按提交成功继续。`, 'warn');
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
                await addLog('验证码提交后通信中断，但页面已进入手机号验证页，按提交成功继续。', 'warn', {
                  step: completionStep,
                  stepKey: 'fetch-login-code',
                });
              } else {
                await addLog('验证码提交后通信中断，但页面已进入 OAuth 授权页，按提交成功继续。', 'warn', {
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
              throw new Error(`STEP8_RESTART_STEP7::步骤 ${completionStep}：验证码提交后认证页进入登录超时报错页，请回到步骤 ${authLoginStep} 重新开始。${urlPart}`.trim());
            }
          }
          throw err;
        }
      } else if (shouldAvoidReplaySubmit) {
        try {
          result = await sendToContentScript('signup-page', message, {
            responseTimeoutMs: baseResponseTimeoutMs,
          });
        } catch (err) {
          if (isRetryableVerificationTransportError(err)) {
            await addLog('认证页正在切换，等待页面重新就绪后继续确认验证码提交结果...', 'warn', {
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
                errorText: fallback.errorText || '验证码被拒绝。',
                url: fallback.url || '',
              };
            }
            if (fallback.success) {
              if (fallback.addPhonePage) {
                await addLog('验证码提交后通信中断，但页面已进入手机号验证页，按提交成功继续。', 'warn', {
                  step: completionStep,
                  stepKey: 'fetch-login-code',
                });
              } else {
                await addLog('验证码提交后通信中断，但页面已进入 OAuth 授权页，按提交成功继续。', 'warn', {
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
              throw new Error(`STEP8_RESTART_STEP7::步骤 ${completionStep}：验证码提交后认证页进入登录超时报错页，请回到步骤 ${authLoginStep} 重新开始。${urlPart}`.trim());
            }
          }
          throw err;
        }
      } else {
        result = await sendToContentScript('signup-page', message, {
          responseTimeoutMs: baseResponseTimeoutMs,
        });
      }

      if (result && result.error) {
        throw new Error(result.error);
      }

      return result || {};
    }

    async function resolveVerificationStep(step, state, mail, options = {}) {
      mail = withResolvedMailProvider(mail, state);
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
      if (state[stateKey] && !ignorePersistedLastCode && mail?.provider !== 'yahoo') {
        rejectedCodes.add(state[stateKey]);
      }
      if (mail?.provider === 'yahoo') {
        for (const code of getYahooRejectedCodesFromState(step, state)) {
          if (code) rejectedCodes.add(code);
        }
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

      if (requestFreshCodeFirst && mail?.provider === 'yahoo') {
        await addLog(`步骤 ${step}：Yahoo 专用取码流程会在主循环内先重发验证码，跳过进入主循环前的额外预发。`, 'warn');
      }

      if (requestFreshCodeFirst && mail?.provider !== 'yahoo') {
        if (remainingAutomaticResendCount <= 0) {
          await addLog(`步骤 ${step}：当前自动重新发送验证码次数为 0，将直接使用当前时间窗口轮询邮箱。`, 'info');
        } else {
          try {
            lastResendAt = await requestVerificationCodeResend(step, options);
            remainingAutomaticResendCount -= 1;
            await updateFilterAfterTimestampForVerificationStep(lastResendAt);
            await addLog(`步骤 ${step}：已先请求一封新的${getVerificationCodeLabel(step)}验证码，再开始轮询邮箱。`, 'warn');
          } catch (err) {
            if (isStopError(err)) {
              throw err;
            }
            await addLog(`步骤 ${step}：首次重新获取验证码失败：${err.message}，将继续使用当前时间窗口轮询。`, 'warn');
          }
        }
      }

      if (mail.provider === HOTMAIL_PROVIDER) {
          const initialDelayMs = Number(options.initialDelayMs ?? hotmailPollConfig.initialDelayMs) || 0;
          if (initialDelayMs > 0) {
            const remainingMs = await getRemainingTimeBudgetMs(
              step,
              options,
              `等待${getVerificationCodeLabel(step)}验证码邮件到达`
            );
            const delayMs = remainingMs === null
              ? initialDelayMs
              : Math.min(initialDelayMs, Math.max(0, remainingMs));
            await addLog(`步骤 ${step}：等待 ${Math.round(initialDelayMs / 1000)} 秒，让 Hotmail 验证码邮件先到达...`, 'info');
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
            seedRejectedCodesFromState: !Boolean(mail?.provider === 'yahoo'),
          };
          if (Number(options.intervalMs) > 0) {
            pollOptions.intervalMs = Number(options.intervalMs);
          }
          if (Number(options.maxAttempts) > 0) {
            pollOptions.maxAttempts = Number(options.maxAttempts);
          }
          if (Number(options.refreshesBeforeResend) > 0) {
            pollOptions.refreshesBeforeResend = Number(options.refreshesBeforeResend);
          }
          if (options.keepRefreshingUntilCode !== undefined) {
            pollOptions.keepRefreshingUntilCode = Boolean(options.keepRefreshingUntilCode);
          }
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
          await addLog(`步骤 ${step}：已获取${getVerificationCodeLabel(step)}验证码：${result.code}`);
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
            await addLog(`步骤 ${step}：验证码被页面拒绝：${submitResult.errorText || result.code}`, 'warn');

            if (attempt >= maxSubmitAttempts) {
              throw new Error(`步骤 ${step}：验证码连续失败，已达到 ${maxSubmitAttempts} 次重试上限。`);
            }

            if (mail.provider === LUCKMAIL_PROVIDER) {
              await addLog(`步骤 ${step}：LuckMail 验证码提交失败，等待 15 秒后重新轮询 /code 接口（${attempt + 1}/${maxSubmitAttempts}）...`, 'warn');
              await sleepWithStop(15000);
              continue;
            }

            if (remainingAutomaticResendCount <= 0) {
              await addLog(`步骤 ${step}：已达到自动重新发送验证码次数上限，将排除已拒绝验证码并继续轮询新邮件。`, 'warn');
              continue;
            }

            lastResendAt = await requestVerificationCodeResend(step, options);
            remainingAutomaticResendCount -= 1;
            await updateFilterAfterTimestampForVerificationStep(lastResendAt);
            await addLog(`步骤 ${step}：提交失败后已请求新验证码（${attempt + 1}/${maxSubmitAttempts}）...`, 'warn');
            continue;
          }

          await setState({
            lastEmailTimestamp: result.emailTimestamp,
            [stateKey]: result.code,
            ...(mail?.provider === 'yahoo'
              ? { lastYahooTopMessageFingerprint: result.topMessageFingerprint || null }
              : {}),
          });

          if (!completionNodeId) {
            throw new Error(`步骤 ${completionStep} 未映射到验证码节点。`);
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
