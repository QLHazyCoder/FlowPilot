(function attachBackgroundStep7(root, factory) {
  root.MultiPageBackgroundStep7 = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundStep7Module() {
  function createStep7Executor(deps = {}) {
    const {
      addLog,
      completeStepFromBackground,
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
      phoneVerificationHelpers = null,
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

      const mentionsSecret = /管理密钥|Admin Secret|X-Admin-Key|CPA Key/i.test(message);
      if (!mentionsSecret) {
        return false;
      }

      return /缺少|未配置|请输入|无效|错误|失败|401|认证失败|未授权|unauthorized|invalid/i.test(message);
    }

    function normalizeStep7IdentifierType(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === 'phone' || normalized === 'email' ? normalized : '';
    }

    function normalizeStep7SignupMethod(value = '') {
      return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
    }

    function canUseConfiguredPhoneSignup(state = {}) {
      return normalizeStep7SignupMethod(state?.signupMethod) === 'phone'
        && Boolean(state?.phoneVerificationEnabled)
        && !Boolean(state?.plusModeEnabled)
        && !Boolean(state?.contributionMode);
    }

    function resolveStep7LoginIdentifierType(state = {}, fallbackType = '') {
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

    async function completeStep7AddPhoneHandoff(state = {}, err, completionStep) {
      if (!state?.phoneVerificationEnabled) {
        throw new Error(
          `步骤 ${completionStep}：登录提交后页面进入手机号页面，必须先启用接码/phone verification 后才能继续。URL: ${extractAddPhoneUrl(err)}`
        );
      }
      if (typeof phoneVerificationHelpers?.completePhoneVerificationFlow !== 'function') {
        throw new Error(`步骤 ${completionStep}：手机号验证流程不可用，接码模块尚未初始化。`);
      }
      if (typeof getTabId !== 'function') {
        throw new Error(`步骤 ${completionStep}：无法定位认证页面标签页，不能继续手机号验证。`);
      }

      const signupTabId = await getTabId('signup-page');
      if (!Number.isInteger(signupTabId)) {
        throw new Error(`步骤 ${completionStep}：认证页面标签页已关闭，无法继续手机号验证。`);
      }

      const pageState = {
        addPhonePage: true,
        phoneVerificationPage: false,
        state: 'add_phone_page',
        url: extractAddPhoneUrl(err),
      };
      await phoneVerificationHelpers.completePhoneVerificationFlow(signupTabId, pageState, {
        step: completionStep,
        visibleStep: completionStep,
      });
      await completeStepFromBackground(completionStep, {
        loginVerificationRequestedAt: null,
        skipLoginVerificationStep: true,
        directOAuthConsentPage: true,
        phoneVerification: true,
        loginPhoneVerification: true,
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
        throw new Error('缺少登录账号：请先完成步骤 2，或在侧栏“注册邮箱/注册手机号”中手动填写账号后再执行当前步骤。');
      }

      let attempt = 0;
      let lastError = null;

      while (attempt < STEP6_MAX_ATTEMPTS) {
        throwIfStopped();
        attempt += 1;
        try {
          const currentState = attempt === 1 ? state : await getState();
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
              actionLabel: 'OAuth 登录并进入验证码页',
              oauthUrl,
            })
            : 180000;

          if (attempt === 1) {
            await addLog('正在打开最新 OAuth 链接并登录...', 'info', {
              step: completionStep,
              stepKey: 'oauth-login',
            });
          } else {
            await addLog(`上一轮失败后，正在进行第 ${attempt} 次尝试（最多 ${STEP6_MAX_ATTEMPTS} 次）...`, 'warn', {
              step: completionStep,
              stepKey: 'oauth-login',
            });
          }

          await reuseOrCreateTab('signup-page', oauthUrl, { forceNew: true });

          const result = await sendToContentScriptResilient(
            'signup-page',
            {
              type: 'EXECUTE_STEP',
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
              logMessage: '认证页正在切换，等待页面重新就绪后继续登录...',
              logStep: completionStep,
              logStepKey: 'oauth-login',
            }
          );

          if (result?.error) {
            throw new Error(result.error);
          }

          if (isStep6SuccessResult(result)) {
            const completionPayload = {
              loginVerificationRequestedAt: result.loginVerificationRequestedAt || null,
            };
            if (Object.prototype.hasOwnProperty.call(result || {}, 'skipLoginVerificationStep')) {
              completionPayload.skipLoginVerificationStep = Boolean(result.skipLoginVerificationStep);
            }
            if (Object.prototype.hasOwnProperty.call(result || {}, 'directOAuthConsentPage')) {
              completionPayload.directOAuthConsentPage = Boolean(result.directOAuthConsentPage);
            }

            await completeStepFromBackground(completionStep, completionPayload);
            return;
          }

          if (isStep6RecoverableResult(result)) {
            const reasonMessage = result.message
              || `当前停留在${getLoginAuthStateLabel(result.state)}，准备重新执行步骤 ${completionStep}。`;
            throw new Error(reasonMessage);
          }

          throw new Error(`步骤 ${completionStep}：认证页未返回可识别的登录结果。`);
        } catch (err) {
          throwIfStopped(err);
          if (isAddPhoneAuthFailure(err)) {
            const latestAddPhoneState = typeof getState === 'function'
              ? await getState().catch(() => state)
              : state;
            await completeStep7AddPhoneHandoff(
              { ...(state || {}), ...(latestAddPhoneState || {}) },
              err,
              completionStep
            );
            return;
          }
          if (isManagementSecretConfigError(err)) {
            await addLog(
              `检测到来源后台管理密钥缺失或错误，不再重试，当前流程停止。原因：${getErrorMessage(err)}`,
              'error',
              { step: completionStep, stepKey: 'oauth-login' }
            );
            throw err;
          }
          lastError = err;
          if (attempt >= STEP6_MAX_ATTEMPTS) {
            break;
          }

          await addLog(`第 ${attempt} 次尝试失败，原因：${getErrorMessage(err)}；准备重试...`, 'warn', {
            step: completionStep,
            stepKey: 'oauth-login',
          });
        }
      }

      throw new Error(`步骤 ${completionStep}：判断失败后已重试 ${STEP6_MAX_ATTEMPTS - 1} 次，仍未成功。最后原因：${getErrorMessage(lastError)}`);
    }

    return { executeStep7 };
  }

  return { createStep7Executor };
});
