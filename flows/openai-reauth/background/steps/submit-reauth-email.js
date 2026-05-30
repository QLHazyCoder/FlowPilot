(function attachOpenAiReauthSubmitEmailStep(root, factory) {
  root.MultiPageOpenAiReauthSubmitEmailStep = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createSubmitEmailStepModule() {
  const NODE_ID = 'submit-reauth-email';
  const VISIBLE_STEP = 2;
  const STEP_KEY = NODE_ID;
  const SUBMIT_EMAIL_TIMEOUT_MS = 90000;

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function createSubmitReauthEmailExecutor(deps = {}) {
    const {
      addLog = async () => {},
      completeNodeFromBackground,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      throwIfStopped = () => {},
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('submit-reauth-email executor 缺少 completeNodeFromBackground。');
    }
    if (typeof sendToContentScriptResilient !== 'function') {
      throw new Error('submit-reauth-email executor 缺少 sendToContentScriptResilient。');
    }
    if (typeof reuseOrCreateTab !== 'function') {
      throw new Error('submit-reauth-email executor 缺少 reuseOrCreateTab。');
    }

    function logStep(message, level = 'info') {
      return addLog(message, level, { step: VISIBLE_STEP, stepKey: STEP_KEY });
    }

    async function executeSubmitReauthEmail(state = {}) {
      const nodeId = String(state?.nodeId || NODE_ID).trim();
      const email = String(state?.reauthEmail || state?.email || '').trim();
      const oauthUrl = String(state?.reauthAuthorizeUrl || state?.oauthUrl || '').trim();
      if (!email) {
        throw new Error('缺少邮箱地址，请先执行步骤 1。');
      }
      if (!oauthUrl) {
        throw new Error('缺少 OAuth 授权 URL，请先执行步骤 1。');
      }

      try {
        throwIfStopped();
        await logStep(`正在向 OAuth 授权页提交邮箱 ${email}...`);

        await reuseOrCreateTab('openai-auth', oauthUrl);

        const result = await sendToContentScriptResilient(
          'openai-auth',
          {
            type: 'EXECUTE_NODE',
            nodeId: 'oauth-login',
            step: VISIBLE_STEP,
            source: 'background',
            payload: {
              email,
              accountIdentifier: email,
              loginIdentifierType: 'email',
              password: '',
              visibleStep: VISIBLE_STEP,
            },
          },
          {
            timeoutMs: SUBMIT_EMAIL_TIMEOUT_MS,
            responseTimeoutMs: SUBMIT_EMAIL_TIMEOUT_MS,
            retryDelayMs: 700,
            logMessage: '认证页正在切换，等待页面重新就绪后继续提交邮箱...',
            logStep: VISIBLE_STEP,
            logStepKey: STEP_KEY,
          }
        );

        if (result?.error) {
          throw new Error(result.error);
        }

        if (result?.directOAuthConsentPage || result?.skipLoginVerificationStep) {
          await logStep('OAuth 授权页未要求验证码，直接进入回调阶段。', 'ok');
          await completeNodeFromBackground(nodeId, {
            skipReauthVerificationStep: true,
            loginVerificationRequestedAt: result?.loginVerificationRequestedAt || null,
          });
          return;
        }

        await logStep('已提交邮箱，等待邮箱验证码到达。', 'ok');
        await completeNodeFromBackground(nodeId, {
          loginVerificationRequestedAt: result?.loginVerificationRequestedAt || Date.now(),
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await logStep(`步骤 2 失败：${message}`, 'error');
        throw error;
      }
    }

    return { executeSubmitReauthEmail };
  }

  return {
    NODE_ID,
    VISIBLE_STEP,
    createSubmitReauthEmailExecutor,
  };
});
