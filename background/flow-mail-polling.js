(function attachBackgroundFlowMailPolling(root, factory) {
  root.MultiPageBackgroundFlowMailPolling = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundFlowMailPollingModule() {
  const ICLOUD_MAIL_POLL_MIN_ATTEMPTS = 5;
  const ICLOUD_MAIL_POLL_TIMEOUT_MARGIN_MS = 25000;

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function normalizeProviderId(value = '') {
    return cleanString(value).toLowerCase();
  }

  function getMailPollingResponseTimeoutMs(payload = {}) {
    const maxAttempts = Math.max(1, Math.floor(Number(payload?.maxAttempts) || 1));
    const intervalMs = Math.max(1, Number(payload?.intervalMs) || 3000);
    return Math.max(45000, maxAttempts * intervalMs + ICLOUD_MAIL_POLL_TIMEOUT_MARGIN_MS);
  }

  function isIcloudMail(mail = {}) {
    return mail?.source === 'icloud-mail' || mail?.provider === 'icloud';
  }

  function normalizeIcloudMailPollPayload(mail = {}, payload = {}) {
    if (!isIcloudMail(mail)) {
      return payload;
    }

    const maxAttempts = Math.max(1, Math.floor(Number(payload?.maxAttempts) || 1));
    if (maxAttempts >= ICLOUD_MAIL_POLL_MIN_ATTEMPTS) {
      return payload;
    }

    return {
      ...payload,
      maxAttempts: ICLOUD_MAIL_POLL_MIN_ATTEMPTS,
    };
  }

  function resolveMailPollingTimeouts(mail = {}, payload = {}) {
    const normalizedPayload = normalizeIcloudMailPollPayload(mail, payload);
    const responseTimeoutMs = getMailPollingResponseTimeoutMs(normalizedPayload);
    return {
      payload: normalizedPayload,
      responseTimeoutMs,
      timeoutMs: responseTimeoutMs,
    };
  }

  function getExpectedMail2925MailboxEmail(state = {}) {
    if (Boolean(state?.mail2925UseAccountPool)) {
      const currentAccountId = cleanString(state?.currentMail2925AccountId);
      const accounts = Array.isArray(state?.mail2925Accounts) ? state.mail2925Accounts : [];
      const currentAccount = accounts.find((account) => cleanString(account?.id) === currentAccountId) || null;
      const accountEmail = cleanString(currentAccount?.email).toLowerCase();
      if (accountEmail) {
        return accountEmail;
      }
    }

    return cleanString(state?.mail2925BaseEmail).toLowerCase();
  }

  function createFlowMailPollingService(deps = {}) {
    const {
      addLog = async () => {},
      buildVerificationPollPayloadForNode = null,
      chrome = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email',
      CLOUD_MAIL_PROVIDER = 'cloudmail',
      ensureIcloudMailSession = null,
      ensureMail2925MailboxSession = null,
      getMailConfig = null,
      getTabId = async () => null,
      handleMail2925LimitReachedError = null,
      HOTMAIL_PROVIDER = 'hotmail-api',
      isMail2925LimitReachedError = null,
      isStopError = null,
      isTabAlive = async () => false,
      LUCKMAIL_PROVIDER = 'luckmail-api',
      pollCloudflareTempEmailVerificationCode = null,
      pollCloudMailVerificationCode = null,
      pollHotmailVerificationCode = null,
      pollLuckmailVerificationCode = null,
      pollYydsMailVerificationCode = null,
      reuseOrCreateTab = async () => null,
      sendToMailContentScriptResilient = null,
      throwIfStopped = () => {},
      YYDS_MAIL_PROVIDER = 'yyds-mail',
    } = deps;

    const apiProviderHandlers = new Map([
      [normalizeProviderId(HOTMAIL_PROVIDER), {
        label: 'Hotmail',
        poll: pollHotmailVerificationCode,
      }],
      [normalizeProviderId(LUCKMAIL_PROVIDER), {
        label: 'LuckMail',
        poll: pollLuckmailVerificationCode,
      }],
      [normalizeProviderId(CLOUDFLARE_TEMP_EMAIL_PROVIDER), {
        label: 'Cloudflare Temp Email',
        poll: pollCloudflareTempEmailVerificationCode,
      }],
      [normalizeProviderId(CLOUD_MAIL_PROVIDER), {
        label: 'Cloud Mail',
        poll: pollCloudMailVerificationCode,
      }],
      [normalizeProviderId(YYDS_MAIL_PROVIDER), {
        label: 'YYDS Mail',
        poll: pollYydsMailVerificationCode,
      }],
    ]);

    async function log(message, level = 'info', options = {}) {
      const logOptions = options && typeof options === 'object' ? { ...options } : {};
      await addLog(message, level, logOptions);
    }

    async function activateTab(tabId) {
      if (!Number.isInteger(tabId) || !chrome?.tabs?.update) {
        return;
      }
      await chrome.tabs.update(tabId, { active: true });
    }

    async function focusOrOpenMailTab(mail = {}) {
      if (!mail?.source) {
        return;
      }

      const alive = await isTabAlive(mail.source);
      if (alive) {
        if (mail.navigateOnReuse) {
          await reuseOrCreateTab(mail.source, mail.url, {
            inject: mail.inject,
            injectSource: mail.injectSource,
          });
          return;
        }

        const tabId = await getTabId(mail.source);
        if (Number.isInteger(tabId)) {
          await activateTab(tabId);
        }
        return;
      }

      await reuseOrCreateTab(mail.source, mail.url, {
        inject: mail.inject,
        injectSource: mail.injectSource,
      });
    }

    function assertPollResult(result, notFoundMessage) {
      if (result?.error) {
        throw new Error(result.error);
      }
      if (!result?.code) {
        throw new Error(notFoundMessage || '邮箱轮询结束，但未获取到验证码。');
      }
      return result;
    }

    function isMail2925Provider(mail = {}) {
      return normalizeProviderId(mail?.provider) === '2925';
    }

    async function pollThroughApiProvider(providerId, step, state, pollPayload, mail, options) {
      const handler = apiProviderHandlers.get(providerId);
      if (!handler) {
        return null;
      }
      if (typeof handler.poll !== 'function') {
        throw new Error(`${handler.label} 邮箱轮询能力未接入，无法继续执行。`);
      }

      await log(
        `步骤 ${step}：正在通过 ${mail.label || handler.label} 轮询${options.actionLabel || '验证码'}...`,
        'info',
        options.logOptions
      );
      const result = await handler.poll(step, state, pollPayload);
      return assertPollResult(result, options.notFoundMessage);
    }

    async function ensureBrowserMailSession(step, state, mail, options) {
      if (isIcloudMail(mail) && typeof ensureIcloudMailSession === 'function') {
        await log(
          `步骤 ${step}：正在确认 ${mail.label || 'iCloud 邮箱'} 登录状态...`,
          'info',
          options.logOptions
        );
        await ensureIcloudMailSession({
          state,
          step,
          actionLabel: `步骤 ${step}：确认 iCloud 邮箱登录状态`,
        });
        return;
      }

      if (isMail2925Provider(mail) && typeof ensureMail2925MailboxSession === 'function') {
        await log(
          `步骤 ${step}：正在确认 ${mail.label || '2925 邮箱'} 登录状态...`,
          'info',
          options.logOptions
        );
        await ensureMail2925MailboxSession({
          accountId: state.currentMail2925AccountId || null,
          forceRelogin: false,
          allowLoginWhenOnLoginPage: Boolean(state?.mail2925UseAccountPool),
          expectedMailboxEmail: getExpectedMail2925MailboxEmail(state),
          actionLabel: `步骤 ${step}：确认 2925 邮箱登录状态`,
        });
        return;
      }

      await log(`步骤 ${step}：正在打开 ${mail.label || '邮箱'}...`, 'info', options.logOptions);
      await focusOrOpenMailTab(mail);
    }

    async function pollThroughBrowserProvider(step, state, mail, pollPayload, options) {
      await ensureBrowserMailSession(step, state, mail, options);

      if (typeof sendToMailContentScriptResilient !== 'function') {
        throw new Error(options.missingContentScriptMessage || '当前验证码步骤缺少邮箱内容脚本通信能力，无法继续执行。');
      }

      const timeoutWindow = resolveMailPollingTimeouts(mail, pollPayload);
      try {
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
            responseTimeoutMs: timeoutWindow.responseTimeoutMs,
            maxRecoveryAttempts: 2,
            logStep: options.logStep || step,
            logStepKey: options.logStepKey || options.nodeId || '',
          }
        );
        return assertPollResult(result, options.notFoundMessage);
      } catch (error) {
        if (typeof isStopError === 'function' && isStopError(error)) {
          throw error;
        }
        if (
          isMail2925Provider(mail)
          && typeof isMail2925LimitReachedError === 'function'
          && isMail2925LimitReachedError(error)
          && typeof handleMail2925LimitReachedError === 'function'
        ) {
          throw await handleMail2925LimitReachedError(step, error);
        }
        throw error;
      }
    }

    async function pollFlowVerificationCode(options = {}) {
      const {
        actionLabel = '验证码',
        filterAfterTimestamp,
        flowId = '',
        logStep,
        logStepKey = '',
        missingCapabilityMessage = '当前验证码步骤缺少共享邮件轮询能力，无法继续执行。',
        nodeId = '',
        notFoundMessage = '',
        payloadOverrides = {},
        state = {},
        step = 0,
      } = options;

      if (typeof getMailConfig !== 'function') {
        throw new Error('当前验证码步骤缺少邮箱配置能力，无法继续执行。');
      }
      if (typeof buildVerificationPollPayloadForNode !== 'function') {
        throw new Error(missingCapabilityMessage);
      }

      const mail = getMailConfig(state);
      if (mail?.error) {
        throw new Error(mail.error);
      }

      const ruleState = flowId
        ? {
          ...state,
          activeFlowId: flowId,
          flowId,
        }
        : state;
      const nextOverrides = {
        ...(payloadOverrides || {}),
      };
      if (filterAfterTimestamp !== undefined) {
        nextOverrides.filterAfterTimestamp = filterAfterTimestamp;
      }
      const pollPayload = buildVerificationPollPayloadForNode(nodeId, ruleState, nextOverrides);
      const normalizedStep = Math.max(1, Math.floor(Number(pollPayload?.step || step) || 1));
      const providerId = normalizeProviderId(mail?.provider);
      const logOptions = {};
      const normalizedLogStep = Math.floor(Number(logStep || normalizedStep) || 0);
      if (normalizedLogStep > 0) {
        logOptions.step = normalizedLogStep;
      }
      if (logStepKey || nodeId) {
        logOptions.stepKey = logStepKey || nodeId;
        logOptions.nodeId = nodeId || logStepKey;
      }

      throwIfStopped();
      const apiResult = await pollThroughApiProvider(providerId, normalizedStep, ruleState, pollPayload, mail, {
        actionLabel,
        logOptions,
        notFoundMessage,
      });
      if (apiResult) {
        return apiResult;
      }

      return pollThroughBrowserProvider(normalizedStep, ruleState, mail, pollPayload, {
        actionLabel,
        logOptions,
        logStep: normalizedLogStep || normalizedStep,
        logStepKey: logStepKey || nodeId,
        missingContentScriptMessage: missingCapabilityMessage,
        nodeId,
        notFoundMessage: notFoundMessage || `步骤 ${normalizedStep}：邮箱轮询结束，但未获取到验证码。`,
      });
    }

    return {
      focusOrOpenMailTab,
      getExpectedMail2925MailboxEmail,
      getMailPollingResponseTimeoutMs,
      pollFlowVerificationCode,
      resolveMailPollingTimeouts,
    };
  }

  return {
    createFlowMailPollingService,
    getExpectedMail2925MailboxEmail,
    getMailPollingResponseTimeoutMs,
    resolveMailPollingTimeouts,
  };
});
