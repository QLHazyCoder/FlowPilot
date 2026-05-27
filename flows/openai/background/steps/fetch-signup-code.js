(function attachBackgroundStep4(root, factory) {
  root.MultiPageBackgroundStep4 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep4Module() {
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;

  function createStep4Executor(deps = {}) {
    const {
      addLog,
      chrome,
      completeNodeFromBackground,
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
        throw new Error('Step 4: phone-number registration verification code flow unavailable, SMS verification module not initialized.');
      }

      const signupProfile = buildSignupProfileForVerificationStep();
      const result = await phoneVerificationHelpers.completeSignupPhoneVerificationFlow(signupTabId, {
        state,
        signupProfile,
      });

      if (result?.emailVerificationRequired || result?.emailVerificationPage) {
        return result || {};
      }

      await completeNodeFromBackground('fetch-signup-code', {
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
        await addLog('Step 4: confirming iCloud mailbox sign-in...', 'info');
        await ensureIcloudMailSession({
          state,
          step: 4,
          actionLabel: 'Step 4: confirm iCloud mailbox sign-in',
        });
      }

      throwIfStopped();
      if (
        mail.provider === HOTMAIL_PROVIDER
        || mail.provider === LUCKMAIL_PROVIDER
        || mail.provider === CLOUDFLARE_TEMP_EMAIL_PROVIDER
        || mail.provider === CLOUD_MAIL_PROVIDER
      ) {
        await addLog(`Step 4: polling verification code via ${mail.label}...`);
      } else if (mail.provider === '2925') {
        await addLog(`Step 4: opening ${mail.label}...`);
        if (typeof ensureMail2925MailboxSession === 'function') {
          await ensureMail2925MailboxSession({
            accountId: state.currentMail2925AccountId || null,
            forceRelogin: false,
            allowLoginWhenOnLoginPage: Boolean(state?.mail2925UseAccountPool),
            expectedMailboxEmail: getExpectedMail2925MailboxEmail(state),
            actionLabel: 'Step 4: confirm 2925 mailbox sign-in',
          });
        } else {
          await focusOrOpenMailTab(mail);
        }
        await addLog(`Step 4: will poll verification codes directly from the currently logged-in ${mail.label}.`, 'info');
      } else {
        await addLog(`Step 4: opening ${mail.label}...`);
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
      const signupTabId = await getTabId('openai-auth');

      if (!signupTabId) {
        throw new Error('Auth page tab is closed, cannot continue step 4. Please run step 1 or step 2 first to reopen the auth page and retry.');
      }

      await chrome.tabs.update(signupTabId, { active: true });
      throwIfStopped();
      if (typeof waitForTabStableComplete === 'function') {
        await addLog('Step 4: waiting for signup verification code page to finish loading before continuing...', 'info');
        await waitForTabStableComplete(signupTabId, {
          timeoutMs: 45000,
          retryDelayMs: 300,
          stableMs: 800,
          initialDelayMs: 300,
        });
      }
      throwIfStopped();
      await addLog('Step 4: confirming signup verification code page is ready, recovering from password page timeout if needed...');

      const prepareRequest = {
        type: 'PREPARE_SIGNUP_VERIFICATION',
        step: 4,
        source: 'background',
        payload: {
          password: state.password || state.customPassword || '',
          prepareSource: 'step4_execute',
          prepareLogLabel: 'Step 4 execution',
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
            ? await sendToContentScript('openai-auth', prepareRequest, {
              responseTimeoutMs: prepareResponseTimeoutMs,
            })
            : await sendToContentScriptResilient('openai-auth', prepareRequest, {
              timeoutMs: Math.max(1000, prepareTimeoutMs - (Date.now() - prepareStartAt)),
              responseTimeoutMs: prepareResponseTimeoutMs,
              retryDelayMs: 700,
              logMessage: 'Step 4: auth page is switching, waiting for page to be ready again before continuing detection...',
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

          const recoverResult = await sendToContentScriptResilient('openai-auth', {
            type: 'RECOVER_AUTH_RETRY_PAGE',
            step: 4,
            source: 'background',
            payload: {
              flow: 'signup',
              step: 4,
              timeoutMs: Math.min(12000, remainingMs),
              maxClickAttempts: 2,
              logLabel: 'Step 4: detected signup auth retry page, clicking "Retry" to recover',
            },
          }, {
            timeoutMs: Math.min(12000, remainingMs),
            responseTimeoutMs: Math.min(12000, remainingMs),
            retryDelayMs: 700,
            logMessage: 'Step 4: auth page is switching, waiting for page to be ready again before continuing detection...',
          });

          if (recoverResult?.error) {
            throw new Error(recoverResult.error);
          }
        }
      }

      if (!prepareResult) {
        throw new Error('Step 4: timed out waiting for signup verification code page to be ready. Please refresh the auth page and retry.');
      }

      if (prepareResult && prepareResult.error) {
        throw new Error(prepareResult.error);
      }
      if (prepareResult?.alreadyVerified) {
        await completeNodeFromBackground('fetch-signup-code', prepareResult?.skipProfileStep ? { skipProfileStep: true } : {});
        return;
      }

      if (isPhoneSignupState(state)) {
        const phoneResult = await executeSignupPhoneCodeStep(state, signupTabId);
        if (phoneResult?.emailVerificationRequired || phoneResult?.emailVerificationPage) {
          await addLog('Step 4: phone verification code passed, OpenAI requires email verification next. Switching to email verification code polling.', 'info');
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
