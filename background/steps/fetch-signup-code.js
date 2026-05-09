(function attachBackgroundStep4(root, factory) {
  root.MultiPageBackgroundStep4 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep4Module() {
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;

  function createStep4Executor(deps = {}) {
    const {
      addLog,
      chrome,
      completeStepFromBackground,
      confirmCustomVerificationStepBypass,
      generateRandomBirthday,
      generateRandomName,
      ensureMail2925MailboxSession,
      ensureIcloudMailSession,
      getMailConfig,
      getTabId,
      HOTMAIL_PROVIDER,
      isTabAlive,
      LUCKMAIL_PROVIDER,
      CLOUDFLARE_TEMP_EMAIL_PROVIDER,
      CLOUD_MAIL_PROVIDER = 'cloudmail',
      resolveVerificationStep,
      reuseOrCreateTab,
      sendToContentScript,
      sendToContentScriptResilient,
      isRetryableContentScriptTransportError = () => false,
      shouldUseCustomRegistrationEmail,
      STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS,
      throwIfStopped,
      waitForTabStableComplete = null,
      phoneVerificationHelpers = null,
      resolveSignupMethod = () => 'email',
    } = deps;

    function buildSignupProfileForVerificationStep() {
      const name = typeof generateRandomName === 'function' ? generateRandomName() : null;
      const birthday = typeof generateRandomBirthday === 'function' ? generateRandomBirthday() : null;
      if (!name?.firstName || !name?.lastName || !birthday) {
        return null;
      }
      return {
        firstName: name.firstName,
        lastName: name.lastName,
        year: birthday.year,
        month: birthday.month,
        day: birthday.day,
      };
    }

    function getExpectedMail2925MailboxEmail(state = {}) {
      if (Boolean(state?.mail2925UseAccountPool)) {
        const currentAccountId = String(state?.currentMail2925AccountId || '').trim();
        const accounts = Array.isArray(state?.mail2925Accounts) ? state.mail2925Accounts : [];
        const currentAccount = accounts.find((account) => String(account?.id || '') === currentAccountId) || null;
        const accountEmail = String(currentAccount?.email || '').trim().toLowerCase();
        if (accountEmail) {
          return accountEmail;
        }
      }

      return String(state?.mail2925BaseEmail || '').trim().toLowerCase();
    }

    function isPhoneSignupState(state = {}) {
      return resolveSignupMethod(state) === 'phone'
        || state?.accountIdentifierType === 'phone'
        || Boolean(state?.signupPhoneActivation);
    }

    async function executeSignupPhoneCodeStep(state, signupTabId) {
      if (typeof phoneVerificationHelpers?.completeSignupPhoneVerificationFlow !== 'function') {
        throw new Error('步骤 4：手机号注册验证码流程不可用，接码模块尚未初始化。');
      }

      const signupProfile = buildSignupProfileForVerificationStep();
      const result = await phoneVerificationHelpers.completeSignupPhoneVerificationFlow(signupTabId, {
        state,
        signupProfile,
      });

      if (result?.emailVerificationRequired || result?.emailVerificationPage) {
        return result || {};
      }

      await completeStepFromBackground(4, {
        phoneVerification: true,
        code: result?.code || '',
        ...(result?.skipProfileStep ? { skipProfileStep: true } : {}),
        ...(result?.skipProfileStepReason ? { skipProfileStepReason: result.skipProfileStepReason } : {}),
      });
      return result || {};
    }

    async function executeSignupEmailVerificationStep(state, stepStartedAt, verificationSessionKey) {
      if (shouldUseCustomRegistrationEmail(state)) {
        await confirmCustomVerificationStepBypass(4);
        return;
      }

      const mail = getMailConfig(state);
      if (mail.error) throw new Error(mail.error);

      const verificationFilterAfterTimestamp = mail.provider === '2925'
        ? Math.max(0, stepStartedAt - MAIL_2925_FILTER_LOOKBACK_MS)
        : stepStartedAt;

      if (mail.source === 'icloud-mail' && typeof ensureIcloudMailSession === 'function') {
        await addLog('步骤 4：正在确认 iCloud 邮箱登录态...', 'info');
        await ensureIcloudMailSession({
          state,
          step: 4,
          actionLabel: '步骤 4：确认 iCloud 邮箱登录态',
        });
      }

      throwIfStopped();
      if (
        mail.provider === HOTMAIL_PROVIDER
        || mail.provider === LUCKMAIL_PROVIDER
        || mail.provider === CLOUDFLARE_TEMP_EMAIL_PROVIDER
        || mail.provider === CLOUD_MAIL_PROVIDER
      ) {
        await addLog(`步骤 4：正在通过 ${mail.label} 轮询验证码...`);
      } else if (mail.provider === '2925') {
        await addLog(`步骤 4：正在打开${mail.label}...`);
        if (typeof ensureMail2925MailboxSession === 'function') {
          await ensureMail2925MailboxSession({
            accountId: state.currentMail2925AccountId || null,
            forceRelogin: false,
            allowLoginWhenOnLoginPage: Boolean(state?.mail2925UseAccountPool),
            expectedMailboxEmail: getExpectedMail2925MailboxEmail(state),
            actionLabel: '步骤 4：确认 2925 邮箱登录态',
          });
        } else {
          await focusOrOpenMailTab(mail);
        }
        await addLog(`步骤 4：将直接使用当前已登录的 ${mail.label} 轮询验证码。`, 'info');
      } else {
        await addLog(`步骤 4：正在打开${mail.label}...`);
        await focusOrOpenMailTab(mail);
      }

      const shouldRequestFreshCodeFirst = ![
        HOTMAIL_PROVIDER,
        LUCKMAIL_PROVIDER,
        CLOUDFLARE_TEMP_EMAIL_PROVIDER,
        CLOUD_MAIL_PROVIDER,
      ].includes(mail.provider);
      const signupProfile = buildSignupProfileForVerificationStep();

      await resolveVerificationStep(4, state, mail, {
        filterAfterTimestamp: verificationFilterAfterTimestamp,
        sessionKey: verificationSessionKey,
        disableTimeBudgetCap: mail.provider === '2925',
        requestFreshCodeFirst: shouldRequestFreshCodeFirst,
        signupProfile,
        resendIntervalMs: mail.provider === LUCKMAIL_PROVIDER
          ? 15000
          : ((mail.provider === HOTMAIL_PROVIDER || mail.provider === '2925')
            ? 0
            : STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS),
      });
    }

    async function focusOrOpenMailTab(mail) {
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
        await chrome.tabs.update(tabId, { active: true });
        return;
      }

      await reuseOrCreateTab(mail.source, mail.url, {
        inject: mail.inject,
        injectSource: mail.injectSource,
      });
    }

    async function executeStep4(state) {
      const stepStartedAt = Date.now();
      const verificationSessionKey = `4:${stepStartedAt}`;
      const signupTabId = await getTabId('signup-page');

      if (!signupTabId) {
        throw new Error('认证页面标签页已关闭，无法继续步骤 4。请先执行步骤 1 或步骤 2，重新打开认证页后再试。');
      }

      await chrome.tabs.update(signupTabId, { active: true });
      throwIfStopped();
      if (typeof waitForTabStableComplete === 'function') {
        await addLog('步骤 4：等待注册验证码页面完成加载后再继续...', 'info');
        await waitForTabStableComplete(signupTabId, {
          timeoutMs: 45000,
          retryDelayMs: 300,
          stableMs: 800,
          initialDelayMs: 300,
        });
      }
      throwIfStopped();
      await addLog('步骤 4：正在确认注册验证码页面是否就绪，必要时自动恢复密码页超时报错...');

      const prepareRequest = {
        type: 'PREPARE_SIGNUP_VERIFICATION',
        step: 4,
        source: 'background',
        payload: {
          password: state.password || state.customPassword || '',
          prepareSource: 'step4_execute',
          prepareLogLabel: '步骤 4 执行',
        },
      };
      const prepareTimeoutMs = 30000;
      const prepareResponseTimeoutMs = 30000;
      const prepareStartAt = Date.now();
      let prepareResult = null;

      while (Date.now() - prepareStartAt < prepareTimeoutMs) {
        throwIfStopped();

        try {
          prepareResult = typeof sendToContentScript === 'function'
            ? await sendToContentScript('signup-page', prepareRequest, {
              responseTimeoutMs: prepareResponseTimeoutMs,
            })
            : await sendToContentScriptResilient('signup-page', prepareRequest, {
              timeoutMs: Math.max(1000, prepareTimeoutMs - (Date.now() - prepareStartAt)),
              responseTimeoutMs: prepareResponseTimeoutMs,
              retryDelayMs: 700,
              logMessage: '步骤 4：认证页正在切换，等待页面重新就绪后继续检测...',
            });
          break;
        } catch (error) {
          if (!isRetryableContentScriptTransportError(error)) {
            throw error;
          }

          const remainingMs = Math.max(0, prepareTimeoutMs - (Date.now() - prepareStartAt));
          if (remainingMs <= 0) {
            throw error;
          }

          const recoverResult = await sendToContentScriptResilient('signup-page', {
            type: 'RECOVER_AUTH_RETRY_PAGE',
            step: 4,
            source: 'background',
            payload: {
              flow: 'signup',
              step: 4,
              timeoutMs: Math.min(12000, remainingMs),
              maxClickAttempts: 2,
              logLabel: '步骤 4：检测到注册认证重试页，正在点击“重试”恢复',
            },
          }, {
            timeoutMs: Math.min(12000, remainingMs),
            responseTimeoutMs: Math.min(12000, remainingMs),
            retryDelayMs: 700,
            logMessage: '步骤 4：认证页正在切换，等待页面重新就绪后继续检测...',
          });

          if (recoverResult?.error) {
            throw new Error(recoverResult.error);
          }
        }
      }

      if (!prepareResult) {
        throw new Error('步骤 4：等待注册验证码页面就绪超时，请刷新认证页后重试。');
      }

      if (prepareResult && prepareResult.error) {
        throw new Error(prepareResult.error);
      }
      if (prepareResult?.alreadyVerified) {
        await completeStepFromBackground(4, prepareResult?.skipProfileStep ? { skipProfileStep: true } : {});
        return;
      }

      if (isPhoneSignupState(state)) {
        const phoneResult = await executeSignupPhoneCodeStep(state, signupTabId);
        if (phoneResult?.emailVerificationRequired || phoneResult?.emailVerificationPage) {
          await addLog('步骤 4：手机验证码已通过，OpenAI 要求继续邮箱验证，切换到邮箱验证码轮询。', 'info');
          return executeSignupEmailVerificationStep(state, stepStartedAt, verificationSessionKey);
        }
        return phoneResult;
      }

      return executeSignupEmailVerificationStep(state, stepStartedAt, verificationSessionKey);
    }

    return { executeStep4 };
  }

  return { createStep4Executor };
});
