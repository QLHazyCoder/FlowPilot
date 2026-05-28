(function attachOpenAiReauthFetchCodeStep(root, factory) {
  root.MultiPageOpenAiReauthFetchCodeStep = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFetchCodeStepModule() {
  const NODE_ID = 'fetch-reauth-code';
  const VISIBLE_STEP = 3;
  const STEP_KEY = NODE_ID;
  const FILL_CODE_TIMEOUT_MS = 60000;
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function createFetchReauthCodeExecutor(deps = {}) {
    const {
      addLog = async () => {},
      completeNodeFromBackground,
      pollFlowVerificationCode,
      sendToContentScriptResilient,
      throwIfStopped = () => {},
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('fetch-reauth-code executor 缺少 completeNodeFromBackground。');
    }
    if (typeof pollFlowVerificationCode !== 'function') {
      throw new Error('fetch-reauth-code executor 缺少 pollFlowVerificationCode。');
    }
    if (typeof sendToContentScriptResilient !== 'function') {
      throw new Error('fetch-reauth-code executor 缺少 sendToContentScriptResilient。');
    }

    function logStep(message, level = 'info') {
      return addLog(message, level, { step: VISIBLE_STEP, stepKey: STEP_KEY });
    }

    function resolveFilterAfterTimestamp(state = {}) {
      const requestedAt = Math.max(
        0,
        Number(state?.loginVerificationRequestedAt) || Number(state?.reauthStartedAt) || Date.now()
      );
      const provider = String(state?.mailProvider || '').trim().toLowerCase();
      if (provider === '2925') {
        return Math.max(0, requestedAt - MAIL_2925_FILTER_LOOKBACK_MS);
      }
      return requestedAt;
    }

    async function executeFetchReauthCode(state = {}) {
      const nodeId = String(state?.nodeId || NODE_ID).trim();
      const email = String(state?.reauthEmail || state?.email || '').trim();
      if (!email) {
        throw new Error('缺少邮箱地址，请先执行步骤 1。');
      }

      if (state?.skipReauthVerificationStep) {
        await logStep('OAuth 授权页未要求验证码，跳过本步骤。', 'ok');
        await completeNodeFromBackground(nodeId, { skipReauthVerificationStep: true });
        return;
      }

      try {
        throwIfStopped();
        await logStep(`正在轮询邮箱 ${email} 的 OAuth 验证码...`);

        const codeResult = await pollFlowVerificationCode({
          actionLabel: 'OAuth 重新授权验证码',
          flowId: 'openai-reauth',
          logStep: VISIBLE_STEP,
          logStepKey: STEP_KEY,
          missingCapabilityMessage: '当前重新授权步骤缺少邮件轮询能力，无法继续执行。',
          nodeId: NODE_ID,
          notFoundMessage: `步骤 ${VISIBLE_STEP}：邮箱轮询结束，但未获取到 OAuth 验证码。`,
          state: {
            ...state,
            activeFlowId: 'openai-reauth',
            flowId: 'openai-reauth',
            visibleStep: VISIBLE_STEP,
          },
          step: VISIBLE_STEP,
          filterAfterTimestamp: resolveFilterAfterTimestamp(state),
        });

        const code = String(codeResult?.code || '').trim();
        if (!code) {
          throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
        }

        await logStep(`已收到验证码 ${code}，正在填回 OAuth 授权页...`);

        throwIfStopped();
        const fillResult = await sendToContentScriptResilient(
          'openai-auth',
          {
            type: 'FILL_CODE',
            step: VISIBLE_STEP,
            source: 'background',
            payload: { code, visibleStep: VISIBLE_STEP },
          },
          {
            timeoutMs: FILL_CODE_TIMEOUT_MS,
            responseTimeoutMs: FILL_CODE_TIMEOUT_MS,
            retryDelayMs: 700,
            logMessage: '认证页正在切换，等待页面重新就绪后继续填写验证码...',
            logStep: VISIBLE_STEP,
            logStepKey: STEP_KEY,
          }
        );

        if (fillResult?.error) {
          throw new Error(fillResult.error);
        }

        await logStep('验证码已填回，等待 OAuth 服务端跳转 localhost 回调。', 'ok');
        await completeNodeFromBackground(nodeId, { reauthVerificationCode: code });
      } catch (error) {
        const message = getErrorMessage(error);
        await logStep(`步骤 3 失败：${message}`, 'error');
        throw error;
      }
    }

    return { executeFetchReauthCode };
  }

  return {
    NODE_ID,
    VISIBLE_STEP,
    createFetchReauthCodeExecutor,
  };
});
