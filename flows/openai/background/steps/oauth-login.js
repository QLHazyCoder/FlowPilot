(function attachBackgroundStep7(root, factory) {
  root.MultiPageBackgroundStep7 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep7Module() {
  function createStep7Executor(deps = {}) {
    const {
      addLog,
      completeNodeFromBackground,
      getErrorMessage,
      getLoginAuthStateLabel,
      getOAuthFlowStepTimeoutMs,
      getState,
      isAddPhoneAuthFailure = (error) => {
        const message = String(typeof error === 'string' ? error : error?.message || '');
        if (/\u624b\u673a\u53f7\u8f93\u5165\u6a21\u5f0f|phone\s+entry/i.test(message)) {
          return false;
        }
        return /https:\/\/auth\.openai\.com\/add-phone(?:[/?#]|$)|\badd-phone\b|\u6dfb\u52a0\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u8fdb\u5165\u624b\u673a\u53f7\u9875\u9762|\u624b\u673a\u53f7\u9875|\u624b\u673a\u53f7\u9875\u9762|phone\s+number|telephone/i.test(message);
      },
      isStep6RecoverableResult,
      isStep6SuccessResult,
      getTabId,
      refreshOAuthUrlBeforeStep6,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      startOAuthFlowTimeoutWindow,
      STEP6_MAX_ATTEMPTS,
      throwIfStopped,
    } = deps;

    function isManagementSecretConfigError(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '').trim();
      if (!message) {
        return false;
      }

      const mentionsSecret = /admin key|Admin Secret|X-Admin-Key|CPA Key/i.test(message);
      if (!mentionsSecret) {
        return false;
      }

      return /missing|not configured|please enter|invalid|error|failed|401|authentication failed|unauthorized/i.test(message);
    }

    function normalizeStep7IdentifierType(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === 'phone' || normalized === 'email' ? normalized : '';
    }

    function normalizeStep7SignupMethod(value = '') {
      return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
    }

    function isStep7BoundEmailReloginContext(state = {}) {
      const nodeId = String(
        state?.nodeId
        || state?.stepKey
        || state?.nodeDefinition?.key
        || state?.stepDefinition?.key
        || ''
      ).trim();
      const phase = String(state?.authLoginPhase || '').trim();
      return nodeId === 'relogin-bound-email' || phase === 'bound-email-relogin';
    }

    function resolveForcedStep7IdentifierType(state = {}) {
      const forcedIdentifierType = normalizeStep7IdentifierType(state?.forceLoginIdentifierType);
      if (forcedIdentifierType === 'phone') {
        return 'phone';
      }
      if (isStep7BoundEmailReloginContext(state)) {
        if (forcedIdentifierType === 'email' || Boolean(state?.forceEmailLogin)) {
          return 'email';
        }
      }
      return '';
    }

    function shouldForceStep7EmailLogin(state = {}) {
      return resolveForcedStep7IdentifierType(state) === 'email';
    }

    function isPhoneSignupMethodForStep7(state = {}) {
      return normalizeStep7SignupMethod(state?.signupMethod) === 'phone'
        || normalizeStep7SignupMethod(state?.resolvedSignupMethod) === 'phone';
    }

    function canUseConfiguredPhoneSignup(state = {}) {
      return isPhoneSignupMethodForStep7(state)
        && Boolean(state?.phoneVerificationEnabled)
        && !Boolean(state?.plusModeEnabled)
        && !Boolean(state?.accountContributionEnabled);
    }

    function hasStep7PhoneSignupIdentity(state = {}) {
      return Boolean(
        String(state?.signupPhoneNumber || '').trim()
        || String(state?.signupPhoneCompletedActivation?.phoneNumber || '').trim()
        || String(state?.signupPhoneActivation?.phoneNumber || '').trim()
        || (
          normalizeStep7IdentifierType(state?.accountIdentifierType) === 'phone'
          && String(state?.accountIdentifier || '').trim()
        )
      );
    }

    function shouldPreferStep7PhoneSignupIdentity(state = {}) {
      return canUseConfiguredPhoneSignup(state)
        && hasStep7PhoneSignupIdentity(state);
    }

    function resolveStep7LoginIdentifierType(state = {}, fallbackType = '') {
      const forcedIdentifierType = resolveForcedStep7IdentifierType(state);
      if (forcedIdentifierType) {
        return forcedIdentifierType;
      }

      if (shouldPreferStep7PhoneSignupIdentity(state)) {
        return 'phone';
      }

      const explicitIdentifierType = normalizeStep7IdentifierType(state?.accountIdentifierType);
      if (explicitIdentifierType) {
        return explicitIdentifierType;
      }

      const frozenSignupMethod = normalizeStep7IdentifierType(state?.resolvedSignupMethod);
      if (frozenSignupMethod) {
        return frozenSignupMethod;
      }

      if (canUseConfiguredPhoneSignup(state)) {
        return 'phone';
      }

      return normalizeStep7IdentifierType(fallbackType) || 'email';
    }

    function extractAddPhoneUrl(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      const match = message.match(/https:\/\/auth\.openai\.com\/add-phone(?:[^\s]*)?/i);
      return match ? match[0] : 'https://auth.openai.com/add-phone';
    }

    function getStep7ResultState(result = {}) {
      return String(result?.state || '').trim();
    }

    function isStep7OauthConsentResult(result = {}) {
      return Boolean(result?.directOAuthConsentPage)
        || getStep7ResultState(result) === 'oauth_consent_page';
    }

    function isStep7AddEmailResult(result = {}) {
      return Boolean(result?.addEmailPage) || getStep7ResultState(result) === 'add_email_page';
    }

    function isStep7AddPhoneResult(result = {}) {
      return Boolean(result?.addPhonePage) || getStep7ResultState(result) === 'add_phone_page';
    }

    function isStep7PhoneVerificationResult(result = {}) {
      return Boolean(result?.phoneVerificationPage) || getStep7ResultState(result) === 'phone_verification_page';
    }

    function isStep7PlainVerificationResult(result = {}) {
      return getStep7ResultState(result) === 'verification_page' && !isStep7PhoneVerificationResult(result);
    }

    function buildStep7CompletionPayload(result = {}, currentState = {}, currentIdentifierType = '', currentPhoneNumber = '') {
      const phoneSignupMode = currentIdentifierType === 'phone';
      const payload = {
        loginVerificationRequestedAt: result.loginVerificationRequestedAt || null,
      };

      if (currentIdentifierType === 'phone') {
        payload.accountIdentifierType = 'phone';
        payload.accountIdentifier = currentPhoneNumber;
        payload.signupPhoneNumber = currentPhoneNumber;
        payload.signupPhoneCompletedActivation = currentState?.signupPhoneCompletedActivation || null;
        payload.signupPhoneActivation = currentState?.signupPhoneActivation || null;
      }

      if (isStep7OauthConsentResult(result)) {
        payload.skipLoginVerificationStep = true;
        payload.directOAuthConsentPage = true;
        return payload;
      }

      if (phoneSignupMode) {
        if (isStep7AddPhoneResult(result)) {
          throw new Error(`Step ${completionStepForState(currentState)}: Phone-signup OAuth login should not enter the add-phone page. URL: ${result?.url || ''}`.trim());
        }
        if (isStep7AddEmailResult(result)) {
          payload.skipLoginVerificationStep = true;
          payload.addEmailPage = true;
          return payload;
        }
        if (isStep7PhoneVerificationResult(result)) {
          return payload;
        }
        if (isStep7PlainVerificationResult(result)) {
          throw new Error(`Step ${completionStepForState(currentState)}: Phone-signup OAuth login entered the regular email login verification page. This flow will not fall back to email verification. URL: ${result?.url || ''}`.trim());
        }
        throw new Error(`Step ${completionStepForState(currentState)}: Phone-signup OAuth login entered a disallowed page: ${getLoginAuthStateLabel(result.state)}。URL: ${result?.url || ''}`.trim());
      }

      if (isStep7AddEmailResult(result)) {
        throw new Error(`Step ${completionStepForState(currentState)}: Email-signup OAuth login should not enter the add-email page. URL: ${result?.url || ''}`.trim());
      }
      if (isStep7AddPhoneResult(result) || isStep7PhoneVerificationResult(result)) {
        payload.skipLoginVerificationStep = true;
        payload.addPhonePage = isStep7AddPhoneResult(result);
        payload.phoneVerificationPage = isStep7PhoneVerificationResult(result);
        return payload;
      }
      if (isStep7PlainVerificationResult(result)) {
        return payload;
      }

      throw new Error(`Step ${completionStepForState(currentState)}: Email-signup OAuth login entered a disallowed page: ${getLoginAuthStateLabel(result.state)}。URL: ${result?.url || ''}`.trim());
    }

    function completionStepForState(state = {}) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      return visibleStep > 0 ? visibleStep : 7;
    }

    async function completeStep7PostLoginPhoneHandoff(state = {}, err, completionStep) {
      if (normalizeStep7SignupMethod(state?.resolvedSignupMethod || state?.signupMethod) === 'phone') {
        throw new Error(
          `Step ${completionStep}: Phone-signup OAuth login entered the add-phone page. This flow does not allow adding a phone number in phone-signup mode. URL: ${extractAddPhoneUrl(err)}`
        );
      }
      await completeNodeFromBackground(state?.nodeId || 'oauth-login', {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        addPhonePage: true,
        directOAuthConsentPage: false,
      });
    }

    async function executeStep7(state) {
      const visibleStep = Math.floor(Number(state?.visibleStep) || 0);
      const completionStep = visibleStep > 0 ? visibleStep : 7;
      const resolvedIdentifierType = resolveStep7LoginIdentifierType(state);
      const phoneNumber = resolvedIdentifierType === 'phone'
        ? String(
          state?.signupPhoneNumber
          || (normalizeStep7IdentifierType(state?.accountIdentifierType) === 'phone' ? state?.accountIdentifier : '')
          || state?.signupPhoneCompletedActivation?.phoneNumber
          || state?.signupPhoneActivation?.phoneNumber
          || ''
        ).trim()
        : '';
      const email = resolvedIdentifierType === 'email'
        ? String(
          state?.email
          || (normalizeStep7IdentifierType(state?.accountIdentifierType) === 'email' ? state?.accountIdentifier : '')
          || ''
        ).trim()
        : '';
      if (
        (resolvedIdentifierType === 'phone' && !phoneNumber)
        || (resolvedIdentifierType !== 'phone' && !email)
      ) {
        throw new Error('Missing login account: complete Step 2 first, or manually fill in the account in the side panel under "Signup Email/Signup Phone Number" before running this step.');
      }

      const forceEmailLoginForThisRun = shouldForceStep7EmailLogin(state);

      let attempt = 0;
      let lastError = null;

      while (attempt < STEP6_MAX_ATTEMPTS) {
        throwIfStopped();
        attempt += 1;
        try {
          const rawCurrentState = {
            ...(attempt === 1 ? state : await getState()),
            ...(resolvedIdentifierType === 'phone' ? {
              forceLoginIdentifierType: 'phone',
              forceEmailLogin: false,
              accountIdentifierType: 'phone',
              accountIdentifier: phoneNumber,
              signupPhoneNumber: phoneNumber,
            } : {}),
          };
          const currentState = forceEmailLoginForThisRun
            ? {
              ...rawCurrentState,
              forceLoginIdentifierType: 'email',
              forceEmailLogin: true,
              signupMethod: 'email',
              resolvedSignupMethod: 'email',
              accountIdentifierType: 'email',
              accountIdentifier: email,
              email,
            }
            : rawCurrentState;
          const password = currentState.password || currentState.customPassword || '';
          const currentIdentifierType = resolveStep7LoginIdentifierType(currentState, resolvedIdentifierType);
          const currentPhoneNumber = currentIdentifierType === 'phone'
            ? String(
              currentState?.signupPhoneNumber
              || (normalizeStep7IdentifierType(currentState?.accountIdentifierType) === 'phone' ? currentState?.accountIdentifier : '')
              || currentState?.signupPhoneCompletedActivation?.phoneNumber
              || currentState?.signupPhoneActivation?.phoneNumber
              || phoneNumber
            ).trim()
            : '';
          const currentEmail = currentIdentifierType === 'email'
            ? String(
              currentState?.email
              || (normalizeStep7IdentifierType(currentState?.accountIdentifierType) === 'email' ? currentState?.accountIdentifier : '')
              || email
            ).trim()
            : '';
          const accountIdentifier = currentIdentifierType === 'phone'
            ? currentPhoneNumber
            : currentEmail;
          const oauthUrl = await refreshOAuthUrlBeforeStep6(currentState);
          if (typeof startOAuthFlowTimeoutWindow === 'function') {
            await startOAuthFlowTimeoutWindow({ step: completionStep, oauthUrl });
          }
          const loginTimeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
            ? await getOAuthFlowStepTimeoutMs(180000, {
              step: completionStep,
              actionLabel: 'OAuth login and enter the verification page',
              oauthUrl,
            })
            : 180000;

          if (attempt === 1) {
            await addLog('Opening the latest OAuth link and logging in...', 'info', {
              step: completionStep,
              stepKey: 'oauth-login',
            });
          } else {
            await addLog(`Previous round failed. Starting attempt ${attempt} (max ${STEP6_MAX_ATTEMPTS})...`, 'warn', {
              step: completionStep,
              stepKey: 'oauth-login',
            });
          }

          await reuseOrCreateTab('openai-auth', oauthUrl, { forceNew: true });

          const result = await sendToContentScriptResilient(
            'openai-auth',
            {
              type: 'EXECUTE_NODE',
              nodeId: state?.nodeId || 'oauth-login',
              step: 7,
              source: 'background',
              payload: {
                email: currentEmail,
                phoneNumber: currentPhoneNumber,
                countryId: currentState?.signupPhoneCompletedActivation?.countryId
                  ?? currentState?.signupPhoneActivation?.countryId
                  ?? null,
                countryLabel: String(
                  currentState?.signupPhoneCompletedActivation?.countryLabel
                  || currentState?.signupPhoneActivation?.countryLabel
                  || ''
                ).trim(),
                accountIdentifier,
                loginIdentifierType: currentIdentifierType,
                password,
                visibleStep: completionStep,
              },
            },
            {
              timeoutMs: loginTimeoutMs,
              responseTimeoutMs: loginTimeoutMs,
              retryDelayMs: 700,
              logMessage: 'Auth page is switching. Waiting for the page to become ready again before continuing login...',
              logStep: completionStep,
              logStepKey: 'oauth-login',
            }
          );

          if (result?.error) {
            throw new Error(result.error);
          }

          if (isStep6SuccessResult(result)) {
            const completionPayload = buildStep7CompletionPayload(
              result,
              { ...(currentState || {}), visibleStep: completionStep },
              currentIdentifierType,
              currentPhoneNumber
            );

            await completeNodeFromBackground(state?.nodeId || 'oauth-login', completionPayload);
            return;
          }

          if (isStep6RecoverableResult(result)) {
            const reasonMessage = result.message
              || `Currently staying on ${getLoginAuthStateLabel(result.state)}. Preparing to rerun Step ${completionStep}.`;
            throw new Error(reasonMessage);
          }

          throw new Error(`Step ${completionStep}: Auth page did not return a recognizable login result.`);
        } catch (err) {
          throwIfStopped(err);
          if (isAddPhoneAuthFailure(err)) {
            const latestAddPhoneState = typeof getState === 'function'
              ? await getState().catch(() => state)
              : state;
            await completeStep7PostLoginPhoneHandoff(
              { ...(state || {}), ...(latestAddPhoneState || {}) },
              err,
              completionStep
            );
            return;
          }
          if (isManagementSecretConfigError(err)) {
            await addLog(
              `Detected that the source backend admin key is missing or invalid. No more retries. The current flow will stop. Reason: ${getErrorMessage(err)}`,
              'error',
              { step: completionStep, stepKey: 'oauth-login' }
            );
            throw err;
          }
          lastError = err;
          if (attempt >= STEP6_MAX_ATTEMPTS) {
            break;
          }

          await addLog(`Attempt ${attempt} failed. Reason: ${getErrorMessage(err)}. Preparing to retry...`, 'warn', {
            step: completionStep,
            stepKey: 'oauth-login',
          });
        }
      }

      throw new Error(`Step ${completionStep}: After a failed state judgment, retried ${STEP6_MAX_ATTEMPTS - 1} times and still did not succeed. Final reason: ${getErrorMessage(lastError)}`);
    }

    return { executeStep7 };
  }

  return { createStep7Executor };
});
