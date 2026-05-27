(function attachBackgroundStep8(root, factory) {
  root.MultiPageBackgroundStep8 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep8Module() {
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;

  function createStep8Executor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      chrome,
      CLOUDFLARE_TEMP_EMAIL_PROVIDER,
      CLOUD_MAIL_PROVIDER = 'cloudmail',
      completeNodeFromBackground,
      confirmCustomVerificationStepBypass,
      ensureMail2925MailboxSession,
      ensureIcloudMailSession,
      ensureStep8VerificationPageReady,
      getOAuthFlowRemainingMs,
      getOAuthFlowStepTimeoutMs,
      getMailConfig,
      getState,
      getTabId,
      HOTMAIL_PROVIDER,
      isTabAlive,
      isVerificationMailPollingError,
      LUCKMAIL_PROVIDER,
      resolveSignupEmailForFlow,
      resolveVerificationStep,
      rerunStep7ForStep8Recovery,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      persistRegistrationEmailState = null,
      phoneVerificationHelpers = null,
      setState,
      shouldUseCustomRegistrationEmail,
      sleepWithStop,
      STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS,
      STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS,
      throwIfStopped,
      getStepIdByKeyForState = null,
    } = deps;
    let activeFetchLoginCodeStep = null;
    let activeFetchLoginCodeStepKey = 'fetch-login-code';

    function normalizeLogStep(value) {
      const step = Math.floor(Number(value) || 0);
      return step > 0 ? step : null;
    }

    function normalizeStepLogMessage(message) {
      return String(message || '')
        .replace(/^步骤\s*\d+\s*[:：]\s*/, '')
        .replace(/^Step\s+\d+\s*[:：]\s*/i, '')
        .trim();
    }

    function addLog(message, level = 'info', options = {}) {
      const normalizedOptions = options && typeof options === 'object' ? { ...options } : {};
      const step = normalizeLogStep(normalizedOptions.step || normalizedOptions.visibleStep)
        || normalizeLogStep(activeFetchLoginCodeStep);
      if (step) {
        normalizedOptions.step = step;
        if (!normalizedOptions.stepKey) {
          normalizedOptions.stepKey = activeFetchLoginCodeStepKey || 'fetch-login-code';
        }
      }
      delete normalizedOptions.visibleStep;
      return rawAddLog(normalizeStepLogMessage(message), level, normalizedOptions);
    }

    function getVisibleStep(state, fallback = 8) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep > 0 ? visibleStep : fallback;
    }

    function normalizeSignupMethod(value = '') {
      return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
    }

    function normalizeIdentifierType(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === 'phone' || normalized === 'email' ? normalized : '';
    }

    function isPhoneLoginCodeMode(state = {}) {
      if (normalizeIdentifierType(state?.accountIdentifierType) === 'phone') {
        return true;
      }
      return normalizeSignupMethod(state?.resolvedSignupMethod || state?.signupMethod) === 'phone'
        && Boolean(
          String(state?.signupPhoneNumber || '').trim()
          || String(state?.signupPhoneCompletedActivation?.phoneNumber || '').trim()
          || String(state?.signupPhoneActivation?.phoneNumber || '').trim()
        );
    }

    function getAuthLoginStepForVisibleStep(visibleStep) {
      return visibleStep >= 11 ? Math.max(1, visibleStep - 1) : 7;
    }

    function getAuthLoginStepForState(state = {}, visibleStep = 8) {
      const authStep = typeof getStepIdByKeyForState === 'function'
        ? Number(getStepIdByKeyForState('oauth-login', state))
        : 0;
      if (Number.isInteger(authStep) && authStep > 0) {
        return authStep;
      }
      return getAuthLoginStepForVisibleStep(visibleStep);
    }

    async function getStep8ReadyTimeoutMs(actionLabel, expectedOauthUrl = '', visibleStep = 8) {
      if (typeof getOAuthFlowStepTimeoutMs !== 'function') {
        return 15000;
      }

      return getOAuthFlowStepTimeoutMs(15000, {
        step: visibleStep,
        actionLabel,
        oauthUrl: expectedOauthUrl,
      });
    }

    function getStep8RemainingTimeResolver(expectedOauthUrl = '', visibleStep = 8) {
      if (typeof getOAuthFlowRemainingMs !== 'function') {
        return undefined;
      }

      return async (details = {}) => getOAuthFlowRemainingMs({
        step: visibleStep,
        actionLabel: details.actionLabel || 'Login verification code flow',
        oauthUrl: expectedOauthUrl,
      });
    }

    function normalizeStep8VerificationTargetEmail(value) {
      return String(value || '').trim().toLowerCase();
    }

    function resolveBoundEmailLoginTarget(state = {}, visibleStep = 0) {
      const email = String(
        state?.step8VerificationTargetEmail
        || state?.email
        || state?.registrationEmailState?.current
        || ''
      ).trim();
      if (!email) {
        throw new Error(`Step ${visibleStep || 0}: missing bound email, unable to use email mode to re-initiate OAuth login.`);
      }
      return email;
    }

    function buildBoundEmailLoginState(state = {}, visibleStep = 0) {
      const email = resolveBoundEmailLoginTarget(state, visibleStep);
      return {
        ...state,
        forceLoginIdentifierType: 'email',
        forceEmailLogin: true,
        signupMethod: 'email',
        resolvedSignupMethod: 'email',
        accountIdentifierType: 'email',
        accountIdentifier: email,
        email,
        step8VerificationTargetEmail: normalizeStep8VerificationTargetEmail(email),
      };
    }

    async function getLoginAuthStateFromContent(visibleStep, options = {}) {
      if (typeof sendToContentScriptResilient !== 'function') {
        return {};
      }
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 15000);
      const result = await sendToContentScriptResilient(
        'openai-auth',
        {
          type: 'GET_LOGIN_AUTH_STATE',
          source: 'background',
          payload: {},
        },
        {
          timeoutMs,
          responseTimeoutMs: timeoutMs,
          retryDelayMs: 600,
          logMessage: options.logMessage || `Step ${visibleStep}: auth page is switching, waiting for page to be ready again...`,
          logStep: visibleStep,
          logStepKey: options.logStepKey || activeFetchLoginCodeStepKey || 'fetch-login-code',
        }
      );
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function submitAddEmailIfNeeded(state, visibleStep, initialPageState = null) {
      if (typeof resolveSignupEmailForFlow !== 'function' || typeof sendToContentScriptResilient !== 'function') {
        return { state, pageState: initialPageState };
      }

      const pageState = initialPageState?.state
        ? initialPageState
        : await getLoginAuthStateFromContent(visibleStep, {
          timeoutMs: 15000,
          logMessage: `Step ${visibleStep}: confirming whether the add-email page has been reached...`,
        });
      if (pageState?.state !== 'add_email_page') {
        return { state, pageState };
      }

      const latestState = typeof getState === 'function' ? await getState() : state;
      const resolvedEmail = await resolveSignupEmailForFlow(latestState, {
        preserveAccountIdentity: true,
      });
      await addLog(`Step ${visibleStep}: detected add-email page, adding email ${resolvedEmail} and entering email verification code page...`);

      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(60000, {
          step: visibleStep,
          actionLabel: 'Add email and enter verification code page',
          oauthUrl: latestState?.oauthUrl || state?.oauthUrl || '',
        })
        : 60000;
      const result = await sendToContentScriptResilient(
        'openai-auth',
        {
          type: 'SUBMIT_ADD_EMAIL',
          source: 'background',
          payload: {
            email: resolvedEmail,
            nodeId: state?.nodeId || activeFetchLoginCodeStepKey || 'fetch-login-code',
          },
        },
        {
          timeoutMs,
          responseTimeoutMs: timeoutMs,
          retryDelayMs: 700,
          logMessage: `Step ${visibleStep}: add-email page is switching, waiting for email verification code page to be ready...`,
          logStep: visibleStep,
          logStepKey: activeFetchLoginCodeStepKey || 'fetch-login-code',
        }
      );

      if (result?.error) {
        throw new Error(result.error);
      }

      const displayedEmail = normalizeStep8VerificationTargetEmail(result?.displayedEmail || resolvedEmail);
      let persistedState = latestState;
      if (typeof persistRegistrationEmailState === 'function') {
        await persistRegistrationEmailState(latestState, resolvedEmail, {
          source: activeFetchLoginCodeStepKey === 'bind-email' ? 'bind_email' : 'step8_add_email',
          preserveAccountIdentity: true,
        });
        persistedState = typeof getState === 'function' ? await getState() : latestState;
      } else {
        await setState({
          email: resolvedEmail,
          step8VerificationTargetEmail: displayedEmail,
        });
        persistedState = {
          ...latestState,
          email: resolvedEmail,
          step8VerificationTargetEmail: displayedEmail,
        };
      }

      return {
        state: {
          ...persistedState,
          email: resolvedEmail,
          step8VerificationTargetEmail: displayedEmail,
        },
        pageState: {
          state: result?.directOAuthConsentPage ? 'oauth_consent_page' : 'verification_page',
          displayedEmail,
          url: result?.url || pageState?.url || '',
        },
      };
    }

    async function completeStep8WhenAuthAlreadyOnOauthConsent(visibleStep, options = {}) {
      await setState({
        step8VerificationTargetEmail: '',
        loginVerificationRequestedAt: null,
      });
      const fromRecovery = Boolean(options.fromRecovery);
      const stepKey = options.stepKey || activeFetchLoginCodeStepKey || 'fetch-login-code';
      await addLog(
        `Step ${visibleStep}: current auth page has entered OAuth authorization page${fromRecovery ? ' (post-polling-failure recheck)' : ''}, skipping login verification code fetch and continuing with subsequent flow.`,
        'warn',
        { step: visibleStep, stepKey }
      );
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(options.nodeId || 'fetch-login-code', {
          loginVerificationRequestedAt: null,
          skipLoginVerificationStep: true,
          directOAuthConsentPage: true,
        });
      }
    }

    async function completeStep8WhenDeferredToPostLoginPhone(visibleStep, pageState = {}, options = {}) {
      await setState({
        step8VerificationTargetEmail: '',
        loginVerificationRequestedAt: null,
      });
      const stepKey = options.stepKey || activeFetchLoginCodeStepKey || 'fetch-login-code';
      await addLog(
        `Step ${visibleStep}: current auth page has entered phone number verification flow, skipping login email verification code, deferring to subsequent "phone number verification" step.`,
        'warn',
        { step: visibleStep, stepKey }
      );
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(options.nodeId || 'fetch-login-code', {
          loginVerificationRequestedAt: null,
          skipLoginVerificationStep: true,
          addPhonePage: pageState?.state === 'add_phone_page' || Boolean(pageState?.addPhonePage),
          phoneVerificationPage: pageState?.state === 'phone_verification_page' || Boolean(pageState?.phoneVerificationPage),
        });
      }
    }

    async function completeStep8WhenDeferredToBindEmail(visibleStep, options = {}) {
      await setState({
        step8VerificationTargetEmail: '',
        loginVerificationRequestedAt: null,
      });
      await addLog(
        `Step ${visibleStep}: current auth page has entered the add-email page, skipping login SMS verification code, deferring to subsequent "bind email" step.`,
        'warn'
      );
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(options.nodeId || 'fetch-login-code', {
          loginVerificationRequestedAt: null,
          skipLoginVerificationStep: true,
          addEmailPage: true,
        });
      }
    }

    function isStep8AddPhoneStateError(error) {
      const message = String(error?.message || error || '');
      return /add-phone|手机号页面|手机号验证页|phone[\s-_]verification|phone\s+number/i.test(message);
    }

    async function recoverStep8PollingFailure(currentState, visibleStep) {
      const authLoginStep = getAuthLoginStepForState(currentState, visibleStep);
      try {
        const pageState = await ensureStep8VerificationPageReady({
          visibleStep,
          authLoginStep,
          allowPhoneVerificationPage: true,
          allowAddEmailPage: true,
          timeoutMs: await getStep8ReadyTimeoutMs(
            'Recheck auth page status after login verification code polling exception',
            currentState?.oauthUrl || '',
            visibleStep
          ),
        });
        if (pageState?.state === 'oauth_consent_page') {
          await completeStep8WhenAuthAlreadyOnOauthConsent(visibleStep, { fromRecovery: true, nodeId: currentState?.nodeId });
          return { outcome: 'completed' };
        }
        if (pageState?.state === 'verification_page' || pageState?.state === 'phone_verification_page' || pageState?.state === 'add_email_page') {
          await addLog(
            `Step ${visibleStep}: detected mail polling/page-communication anomaly, but the auth page is still on the current post-login page. Retrying on the current path without going back to step ${authLoginStep}.`,
            'warn'
          );
          return { outcome: 'retry_without_step7' };
        }
      } catch (inspectError) {
        if (isStep8RestartStep7Error(inspectError)) {
          return { outcome: 'restart_step7', error: inspectError };
        }
        if (isStep8AddPhoneStateError(inspectError)) {
          throw inspectError;
        }
        await addLog(
          `Step ${visibleStep}: error while rechecking auth page state after polling failure: ${inspectError?.message || inspectError}. Falling back to step ${authLoginStep}.`,
          'warn'
        );
      }
      return { outcome: 'restart_step7' };
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

    function getStep8ResendIntervalMs(state = {}) {
      const mail = getMailConfig(state);
      if (mail?.provider === LUCKMAIL_PROVIDER) {
        return 15000;
      }
      if (mail?.provider === HOTMAIL_PROVIDER || mail?.provider === '2925') {
        return 0;
      }
      return Math.max(0, Number(STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS) || 0);
    }

    async function executeLoginPhoneCodeStep(state, signupTabId, visibleStep) {
      if (!Number.isInteger(signupTabId)) {
        throw new Error(`Step ${visibleStep}: auth page tab has been closed, cannot continue phone-number login verification code flow.`);
      }
      if (typeof phoneVerificationHelpers?.completeLoginPhoneVerificationFlow !== 'function') {
        throw new Error(`Step ${visibleStep}: phone-number login verification code flow unavailable, SMS verification module not initialized.`);
      }

      const result = await phoneVerificationHelpers.completeLoginPhoneVerificationFlow(signupTabId, {
        state,
        visibleStep,
      });

      await completeNodeFromBackground(state?.nodeId || 'fetch-login-code', {
        phoneVerification: true,
        loginPhoneVerification: true,
        code: result?.code || '',
      });
      return result || {};
    }

    async function ensureAuthTabForPostLoginStep(state, visibleStep) {
      const authTabId = await getTabId('openai-auth');
      if (authTabId) {
        await chrome.tabs.update(authTabId, { active: true });
        return authTabId;
      }
      if (!state?.oauthUrl) {
        throw new Error(`Step ${visibleStep}: missing OAuth login URL, please refresh OAuth and log in first.`);
      }
      return reuseOrCreateTab('openai-auth', state.oauthUrl);
    }

    async function completePostLoginPhoneVerificationSkippedOnOauth(visibleStep, options = {}) {
      const stepKey = options.stepKey || 'post-login-phone-verification';
      await addLog(`Step ${visibleStep}: current auth page has entered OAuth authorization page, skipping phone-number verification step.`, 'warn', {
        step: visibleStep,
        stepKey,
      });
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(options.nodeId || 'post-login-phone-verification', {
          directOAuthConsentPage: true,
          phoneVerification: false,
        });
      }
    }

    async function executePostLoginPhoneVerification(state, runtime = {}) {
      const visibleStep = getVisibleStep(state, 9);
      activeFetchLoginCodeStep = visibleStep;
      activeFetchLoginCodeStepKey = runtime.stepKey || 'post-login-phone-verification';
      const authTabId = await ensureAuthTabForPostLoginStep(state, visibleStep);
      const pageState = await getLoginAuthStateFromContent(visibleStep, {
        timeoutMs: await getStep8ReadyTimeoutMs('Confirm phone-verification page or OAuth authorization page is ready', state?.oauthUrl || '', visibleStep),
        logMessage: `Step ${visibleStep}: confirming whether phone-number verification is needed...`,
        logStepKey: activeFetchLoginCodeStepKey,
      });

      if (pageState?.state === 'oauth_consent_page') {
        await completePostLoginPhoneVerificationSkippedOnOauth(visibleStep, {
          nodeId: state?.nodeId || runtime.fallbackNodeId,
          stepKey: activeFetchLoginCodeStepKey,
        });
        return;
      }
      if (pageState?.state !== 'add_phone_page' && pageState?.state !== 'phone_verification_page') {
        throw new Error(`Step ${visibleStep}: phone-verification step only handles add-phone or phone verification-code pages. Current state: ${pageState?.state || 'unknown'}. URL: ${pageState?.url || ''}`.trim());
      }
      if (!state?.phoneVerificationEnabled) {
        throw new Error(`Step ${visibleStep}: phone-number verification is required, but SMS verification is not enabled. URL: ${pageState?.url || ''}`.trim());
      }
      if (typeof phoneVerificationHelpers?.completePhoneVerificationFlow !== 'function') {
        throw new Error(`Step ${visibleStep}: phone-number verification flow unavailable, SMS verification module not initialized.`);
      }

      const result = await phoneVerificationHelpers.completePhoneVerificationFlow(authTabId, pageState, {
        step: visibleStep,
        visibleStep,
      });
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(state?.nodeId || runtime.fallbackNodeId || 'post-login-phone-verification', {
          phoneVerification: true,
          postLoginPhoneVerification: true,
          code: result?.code || '',
        });
      }
      return result || {};
    }

    async function executeBindEmail(state) {
      const visibleStep = getVisibleStep(state, 9);
      activeFetchLoginCodeStep = visibleStep;
      activeFetchLoginCodeStepKey = 'bind-email';
      await ensureAuthTabForPostLoginStep(state, visibleStep);
      const pageState = await getLoginAuthStateFromContent(visibleStep, {
        timeoutMs: await getStep8ReadyTimeoutMs('Confirm add-email page or OAuth authorization page is ready', state?.oauthUrl || '', visibleStep),
        logMessage: `Step ${visibleStep}: confirming whether email binding is needed...`,
      });

      if (pageState?.state === 'oauth_consent_page') {
        await addLog(`Step ${visibleStep}: current auth page has entered OAuth authorization page, skipping bind-email step.`, 'warn', {
          step: visibleStep,
          stepKey: 'bind-email',
        });
        if (typeof completeNodeFromBackground === 'function') {
          await completeNodeFromBackground(state?.nodeId || 'bind-email', {
            directOAuthConsentPage: true,
            bindEmailSubmitted: false,
          });
        }
        return;
      }

      if (pageState?.state !== 'add_email_page') {
        throw new Error(`Step ${visibleStep}: bind-email step only handles the add-email page. Current state: ${pageState?.state || 'unknown'}. URL: ${pageState?.url || ''}`.trim());
      }

      const addEmailPreparation = await submitAddEmailIfNeeded(state, visibleStep, pageState);
      const preparedState = addEmailPreparation?.state || state;
      const nextPageState = addEmailPreparation?.pageState || pageState;
      if (nextPageState?.state !== 'verification_page') {
        throw new Error(`Step ${visibleStep}: after bind-email submission, must enter the email verification-code page. Current state: ${nextPageState?.state || 'unknown'}. URL: ${nextPageState?.url || ''}`.trim());
      }

      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(state?.nodeId || 'bind-email', {
          bindEmailSubmitted: true,
          email: preparedState?.email || '',
          step8VerificationTargetEmail: preparedState?.step8VerificationTargetEmail || nextPageState?.displayedEmail || '',
        });
      }
    }

    async function pollEmailVerificationCode(preparedState, pageState, visibleStep, runtime = {}) {
      let latestResendAt = Math.max(
        0,
        Number(runtime?.stickyLastResendAt) || 0,
        Number(preparedState?.loginVerificationRequestedAt) || 0
      );
      const notifyResendRequestedAt = typeof runtime?.onResendRequestedAt === 'function'
        ? runtime.onResendRequestedAt
        : null;
      const mail = getMailConfig(preparedState);
      if (mail.error) throw new Error(mail.error);
      const stepStartedAt = Date.now();
      const verificationFilterAfterTimestamp = mail.provider === '2925'
        ? Math.max(0, stepStartedAt - MAIL_2925_FILTER_LOOKBACK_MS)
        : stepStartedAt;
      const verificationSessionKey = `${visibleStep}:${stepStartedAt}`;
      const shouldCompareVerificationEmail = mail.provider !== '2925';
      const displayedVerificationEmail = shouldCompareVerificationEmail
        ? normalizeStep8VerificationTargetEmail(pageState?.displayedEmail)
        : '';
      const fixedTargetEmail = shouldCompareVerificationEmail
        ? (displayedVerificationEmail || normalizeStep8VerificationTargetEmail(preparedState?.step8VerificationTargetEmail || preparedState?.email))
        : '';

      await setState({
        step8VerificationTargetEmail: displayedVerificationEmail || '',
      });

      await addLog(`Step ${visibleStep}: email verification-code page is ready, starting to fetch the verification code.`, 'info');
      if (shouldCompareVerificationEmail && displayedVerificationEmail) {
        await addLog(`Step ${visibleStep}: locked the email ${displayedVerificationEmail} shown on the current verification-code page as the matching target.`, 'info');
      }

      if (shouldUseCustomRegistrationEmail(preparedState)) {
        await confirmCustomVerificationStepBypass(8, {
          completionStep: visibleStep,
          promptStep: visibleStep,
        });
        return { lastResendAt: latestResendAt };
      }

      if (mail.source === 'icloud-mail' && typeof ensureIcloudMailSession === 'function') {
        await addLog(`Step ${visibleStep}: confirming iCloud mailbox sign-in...`, 'info');
        await ensureIcloudMailSession({
          state: preparedState,
          step: 8,
          actionLabel: `Step ${visibleStep}: confirm iCloud mailbox sign-in`,
        });
      }

      throwIfStopped();
      if (
        mail.provider === HOTMAIL_PROVIDER
        || mail.provider === LUCKMAIL_PROVIDER
        || mail.provider === CLOUDFLARE_TEMP_EMAIL_PROVIDER
        || mail.provider === CLOUD_MAIL_PROVIDER
      ) {
        await addLog(`Step ${visibleStep}: polling verification code via ${mail.label}...`);
      } else {
        await addLog(`Step ${visibleStep}: opening ${mail.label}...`);
        if (mail.provider === '2925' && typeof ensureMail2925MailboxSession === 'function') {
          await ensureMail2925MailboxSession({
            accountId: preparedState.currentMail2925AccountId || null,
            forceRelogin: false,
            allowLoginWhenOnLoginPage: Boolean(preparedState?.mail2925UseAccountPool),
            expectedMailboxEmail: getExpectedMail2925MailboxEmail(preparedState),
            actionLabel: `Step ${visibleStep}: ensure 2925 mailbox session`,
          });
        } else {
          await focusOrOpenMailTab(mail);
        }
        if (mail.provider === '2925') {
          await addLog(`Step ${visibleStep}: will poll verification codes directly from the currently logged-in ${mail.label}.`, 'info');
        }
      }

      await resolveVerificationStep(8, {
        ...preparedState,
        step8VerificationTargetEmail: displayedVerificationEmail || '',
      }, mail, {
        completionStep: visibleStep,
        filterAfterTimestamp: verificationFilterAfterTimestamp,
        sessionKey: verificationSessionKey,
        disableTimeBudgetCap: mail.provider === '2925',
        getRemainingTimeMs: getStep8RemainingTimeResolver(preparedState?.oauthUrl || '', visibleStep),
        requestFreshCodeFirst: false,
        lastResendAt: latestResendAt,
        onResendRequestedAt: async (requestedAt) => {
          const numericRequestedAt = Number(requestedAt) || 0;
          if (numericRequestedAt > 0) {
            latestResendAt = Math.max(latestResendAt, numericRequestedAt);
          }
          if (notifyResendRequestedAt) {
            await notifyResendRequestedAt(latestResendAt);
          }
        },
        targetEmail: fixedTargetEmail,
        maxResendRequests: mail.provider === '2925' ? 2 : undefined,
        initialPollMaxAttempts: mail.provider === '2925' ? 5 : undefined,
        pollAttemptPlan: mail.provider === '2925' ? [2, 3, 15] : undefined,
        resendIntervalMs: mail.provider === LUCKMAIL_PROVIDER
          ? 15000
          : ((mail.provider === HOTMAIL_PROVIDER || mail.provider === '2925')
            ? 0
            : STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS),
      });
      return {
        lastResendAt: latestResendAt,
      };
    }

    async function completeFetchBindEmailCodeSkippedOnOauth(visibleStep, options = {}) {
      await addLog(`Step ${visibleStep}: current auth page has entered OAuth authorization page, skipping bind-email verification code step.`, 'warn', {
        step: visibleStep,
        stepKey: 'fetch-bind-email-code',
      });
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(options.nodeId || 'fetch-bind-email-code', {
          directOAuthConsentPage: true,
          bindEmailCodeSkipped: true,
        });
      }
    }

    async function executeFetchBindEmailCode(state) {
      const visibleStep = getVisibleStep(state, 10);
      activeFetchLoginCodeStep = visibleStep;
      activeFetchLoginCodeStepKey = 'fetch-bind-email-code';
      await ensureAuthTabForPostLoginStep(state, visibleStep);
      const pageState = await getLoginAuthStateFromContent(visibleStep, {
        timeoutMs: await getStep8ReadyTimeoutMs('Confirm bind-email verification code page is ready', state?.oauthUrl || '', visibleStep),
        logMessage: `Step ${visibleStep}: confirming bind-email verification code page...`,
      });

      if (pageState?.state === 'oauth_consent_page') {
        if (state?.bindEmailSubmitted) {
          throw new Error(`Step ${visibleStep}: after bind-email submission the page must not jump directly to OAuth authorization. Email verification code is required first. URL: ${pageState?.url || ''}`.trim());
        }
        await completeFetchBindEmailCodeSkippedOnOauth(visibleStep, { nodeId: state?.nodeId });
        return;
      }
      if (pageState?.state !== 'verification_page') {
        throw new Error(`Step ${visibleStep}: fetch-bind-email-code step only handles the email verification-code page. Current state: ${pageState?.state || 'unknown'}. URL: ${pageState?.url || ''}`.trim());
      }
      if (!state?.bindEmailSubmitted) {
        throw new Error(`Step ${visibleStep}: bind-email submission not completed, cannot fetch bind-email verification code directly.`);
      }

      return pollEmailVerificationCode(state, pageState, visibleStep, {
        stickyLastResendAt: Number(state?.loginVerificationRequestedAt) || 0,
      });
    }

    async function executeBoundEmailLoginCode(state) {
      const visibleStep = getVisibleStep(state, 11);
      activeFetchLoginCodeStep = visibleStep;
      activeFetchLoginCodeStepKey = 'fetch-bound-email-login-code';
      const preparedState = buildBoundEmailLoginState(state, visibleStep);
      const authTabId = await getTabId('openai-auth');

      if (authTabId) {
        await chrome.tabs.update(authTabId, { active: true });
      } else {
        if (!preparedState.oauthUrl) {
          throw new Error(`Step ${visibleStep}: missing OAuth login URL. Please complete bind-email first, then refresh OAuth and sign in.`);
        }
        await reuseOrCreateTab('openai-auth', preparedState.oauthUrl);
      }

      throwIfStopped();
      const pageState = await ensureStep8VerificationPageReady({
        visibleStep,
        authLoginStep: Math.max(1, visibleStep - 1),
        allowPhoneVerificationPage: true,
        allowAddEmailPage: false,
        timeoutMs: await getStep8ReadyTimeoutMs('Confirm bound-email login verification code page is ready', preparedState?.oauthUrl || '', visibleStep),
      });

      if (pageState?.state === 'oauth_consent_page') {
        await completeStep8WhenAuthAlreadyOnOauthConsent(visibleStep, {
          nodeId: state?.nodeId || 'fetch-bound-email-login-code',
          stepKey: 'fetch-bound-email-login-code',
        });
        return;
      }
      if (pageState?.state === 'add_phone_page' || pageState?.state === 'phone_verification_page') {
        await completeStep8WhenDeferredToPostLoginPhone(visibleStep, pageState, {
          nodeId: state?.nodeId || 'fetch-bound-email-login-code',
          stepKey: 'fetch-bound-email-login-code',
        });
        return;
      }
      if (pageState?.state === 'add_email_page') {
        throw new Error(`Step ${visibleStep}: after binding email, email-mode login should no longer enter the add-email page. URL: ${pageState?.url || ''}`.trim());
      }
      if (pageState?.state !== 'verification_page') {
        throw new Error(`Step ${visibleStep}: post-bind-email login verification code only handles the email login verification-code page. Current state: ${pageState?.state || 'unknown'}. URL: ${pageState?.url || ''}`.trim());
      }

      return pollEmailVerificationCode(preparedState, pageState, visibleStep, {
        stickyLastResendAt: Number(preparedState?.loginVerificationRequestedAt) || 0,
      });
    }

    async function executeBoundEmailPostLoginPhoneVerification(state) {
      return executePostLoginPhoneVerification(state, {
        stepKey: 'post-bound-email-phone-verification',
        fallbackNodeId: 'post-bound-email-phone-verification',
      });
    }

    async function runStep8Attempt(state, runtime = {}) {
      const visibleStep = getVisibleStep(state, 8);
      activeFetchLoginCodeStep = visibleStep;
      activeFetchLoginCodeStepKey = 'fetch-login-code';
      const authTabId = await getTabId('openai-auth');

      if (authTabId) {
        await chrome.tabs.update(authTabId, { active: true });
      } else {
        if (!state.oauthUrl) {
          throw new Error(`Missing OAuth login URL, please complete step ${getAuthLoginStepForState(state, visibleStep)} first.`);
        }
        await reuseOrCreateTab('openai-auth', state.oauthUrl);
      }

      throwIfStopped();
      let pageState = await ensureStep8VerificationPageReady({
        visibleStep,
        authLoginStep: getAuthLoginStepForState(state, visibleStep),
        allowPhoneVerificationPage: true,
        allowAddEmailPage: true,
        timeoutMs: await getStep8ReadyTimeoutMs('Confirm login verification code page is ready', state?.oauthUrl || '', visibleStep),
      });
      if (pageState?.state === 'oauth_consent_page') {
        await completeStep8WhenAuthAlreadyOnOauthConsent(visibleStep, { nodeId: state?.nodeId });
        return;
      }
      const phoneLoginCodeMode = isPhoneLoginCodeMode(state);
      if (phoneLoginCodeMode) {
        if (pageState?.state === 'phone_verification_page') {
          return executeLoginPhoneCodeStep(state, authTabId, visibleStep);
        }
        if (pageState?.state === 'add_email_page') {
          await completeStep8WhenDeferredToBindEmail(visibleStep, { nodeId: state?.nodeId });
          return;
        }
        if (pageState?.state === 'verification_page') {
          throw new Error(`Step ${visibleStep}: in phone-number registration mode, only phone login verification codes are processed, but the page entered the email login verification-code page. It will not fall back to an email provider. URL: ${pageState?.url || ''}`.trim());
        }
        if (pageState?.state === 'add_phone_page') {
          throw new Error(`Step ${visibleStep}: phone-number registration mode should not enter the add-phone page. URL: ${pageState?.url || ''}`.trim());
        }
        throw new Error(`Step ${visibleStep}: in phone-number registration mode, the login verification code step entered a disallowed page: ${pageState?.state || 'unknown'}. URL: ${pageState?.url || ''}`.trim());
      }

      if (pageState?.state === 'add_phone_page' || pageState?.state === 'phone_verification_page') {
        await completeStep8WhenDeferredToPostLoginPhone(visibleStep, pageState, { nodeId: state?.nodeId });
        return;
      }
      if (pageState?.state === 'add_email_page') {
        throw new Error(`Step ${visibleStep}: email registration mode should not enter the add-email page. URL: ${pageState?.url || ''}`.trim());
      }

      return pollEmailVerificationCode(state, pageState, visibleStep, runtime);
    }

    function isStep8RestartStep7Error(error) {
      const message = String(error?.message || error || '');
      return /STEP8_RESTART_STEP7::/i.test(message);
    }

    async function executeStep8(state) {
      let currentState = state;
      let mailPollingAttempt = 1;
      let lastMailPollingError = null;
      let stickyLastResendAt = Number(state?.loginVerificationRequestedAt) || 0;
      let retryWithoutStep7Streak = 0;
      const maxRetryWithoutStep7Streak = 3;

      while (true) {
        try {
          const result = await runStep8Attempt(currentState, {
            stickyLastResendAt,
            onResendRequestedAt: async (requestedAt) => {
              const numericRequestedAt = Number(requestedAt) || 0;
              if (numericRequestedAt > 0) {
                stickyLastResendAt = Math.max(stickyLastResendAt, numericRequestedAt);
              }
            },
          });
          if (Number(result?.lastResendAt) > 0) {
            stickyLastResendAt = Math.max(stickyLastResendAt, Number(result.lastResendAt) || 0);
          }
          retryWithoutStep7Streak = 0;
          return;
        } catch (err) {
          const visibleStep = getVisibleStep(currentState, 8);
          const authLoginStep = getAuthLoginStepForState(currentState, visibleStep);
          let currentError = err;
          let retryWithoutStep7 = false;

          const isMailPollingError = isVerificationMailPollingError(err);
          if (isMailPollingError && !isStep8RestartStep7Error(err)) {
            const recovery = await recoverStep8PollingFailure(currentState, visibleStep);
            if (recovery?.outcome === 'completed') {
              return;
            }
            if (recovery?.outcome === 'retry_without_step7') {
              retryWithoutStep7 = true;
            }
            if (recovery?.error) {
              currentError = recovery.error;
            }
          }
          if (!isVerificationMailPollingError(currentError) && !isStep8RestartStep7Error(currentError)) {
            throw currentError;
          }

          lastMailPollingError = currentError;
          if (mailPollingAttempt >= STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS) {
            break;
          }

          mailPollingAttempt += 1;
          if (retryWithoutStep7) {
            retryWithoutStep7Streak += 1;
            if (retryWithoutStep7Streak > maxRetryWithoutStep7Streak) {
              await addLog(
                `Step ${visibleStep}: mailbox communication anomaly retried ${retryWithoutStep7Streak} times on the current path. Going back to step ${authLoginStep} to reissue the auth flow to avoid an empty polling loop.`,
                'warn'
              );
              await rerunStep7ForStep8Recovery({
                logMessage: `Mailbox communication anomaly persisting, going back to step ${authLoginStep} to restart the login flow...`,
                logStep: visibleStep,
                logStepKey: 'fetch-login-code',
              });
              currentState = await getState();
              retryWithoutStep7Streak = 0;
              continue;
            }
            await addLog(
              `Step ${visibleStep}: auth page is still on the verification-code page. Retrying on the current path (${mailPollingAttempt}/${STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS}) without going back to step ${authLoginStep} (consecutive same-path retries ${retryWithoutStep7Streak}/${maxRetryWithoutStep7Streak}).`,
              'warn'
            );
            const latestState = await getState();
            const latestStateResendAt = Number(latestState?.loginVerificationRequestedAt) || 0;
            if (latestStateResendAt > 0) {
              stickyLastResendAt = Math.max(stickyLastResendAt, latestStateResendAt);
            }
            currentState = latestState;
            if (stickyLastResendAt > 0 && (!latestStateResendAt || latestStateResendAt < stickyLastResendAt)) {
              currentState = {
                ...latestState,
                loginVerificationRequestedAt: stickyLastResendAt,
              };
            }
            const resendIntervalMs = getStep8ResendIntervalMs(currentState);
            const remainingBeforeRetryMs = stickyLastResendAt > 0 && resendIntervalMs > 0
              ? Math.max(0, resendIntervalMs - (Date.now() - stickyLastResendAt))
              : 0;
            if (remainingBeforeRetryMs > 0 && typeof sleepWithStop === 'function') {
              await addLog(
                `Step ${visibleStep}: previous round already triggered a verification-code resend. To avoid duplicate resends, waiting ${Math.ceil(remainingBeforeRetryMs / 1000)} seconds before retrying on the current path.`,
                'info'
              );
              await sleepWithStop(Math.min(remainingBeforeRetryMs, 3000));
            }
            continue;
          }
          retryWithoutStep7Streak = 0;
          await addLog(
            isStep8RestartStep7Error(currentError)
              ? `Step ${visibleStep}: detected auth page entered a retry/timeout error state. Restarting from step ${authLoginStep} (${mailPollingAttempt}/${STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS})...`
              : `Step ${visibleStep}: detected mail polling failure. Restarting from step ${authLoginStep} (${mailPollingAttempt}/${STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS})...`,
            'warn'
          );
          await rerunStep7ForStep8Recovery({
            logMessage: isStep8RestartStep7Error(currentError)
              ? `Auth page entered a retry/timeout error state, going back to step ${authLoginStep} to restart the login flow...`
              : `Going back to step ${authLoginStep} to restart the login verification code flow...`,
            logStep: visibleStep,
            logStepKey: 'fetch-login-code',
          });
          currentState = await getState();
        }
      }

      const visibleStep = getVisibleStep(currentState, 8);
      if (lastMailPollingError) {
        throw new Error(
          `Step ${visibleStep}: login verification code flow did not succeed after ${STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS} rounds of mailbox polling recovery. Last reason: ${lastMailPollingError.message}`
        );
      }

      throw new Error(`Step ${visibleStep}: login verification code flow did not complete successfully.`);
    }

    return {
      executeStep8,
      executePostLoginPhoneVerification,
      executeBindEmail,
      executeFetchBindEmailCode,
      executeBoundEmailLoginCode,
      executeBoundEmailPostLoginPhoneVerification,
    };
  }

  return { createStep8Executor };
});
