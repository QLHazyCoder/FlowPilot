(function attachOpenAiReauthFetchCodeStep(root, factory) {
  root.MultiPageOpenAiReauthFetchCodeStep = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createFetchCodeStepModule() {
  const NODE_ID = 'fetch-reauth-code';
  const VISIBLE_STEP = 3;
  const STEP_KEY = NODE_ID;
  const FILL_CODE_TIMEOUT_MS = 60000;
  const MAIL_2925_FILTER_LOOKBACK_MS = 10 * 60 * 1000;
  const DEFAULT_MAX_RESEND_REQUESTS = 3;
  const DEFAULT_RESEND_INTERVAL_MS = 5000;
  const RESEND_REQUEST_TIMEOUT_MS = 45000;
  const RESEND_FAILURE_BACKOFF_MS = 2000;
  // 2925 默认 15 attempts × 15s = 225s 单轮太长，缩到 6 让 resend 能早点介入。
  const MAIL_2925_POLL_MAX_ATTEMPTS = 6;

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function isLikelyStopError(error) {
    const message = String(error?.message || error || '');
    return /已被用户停止|user_stop|operation_aborted|stop signal|stopped by user/i.test(message);
  }

  function createFetchReauthCodeExecutor(deps = {}) {
    const {
      addLog = async () => {},
      completeNodeFromBackground,
      pollFlowVerificationCode,
      sendToContentScriptResilient,
      throwIfStopped = () => {},
      sleepWithStop = null,
      maxResendRequests = DEFAULT_MAX_RESEND_REQUESTS,
      resendIntervalMs = DEFAULT_RESEND_INTERVAL_MS,
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

    async function safeSleep(ms) {
      const duration = Math.max(0, Math.floor(Number(ms) || 0));
      if (duration <= 0) return;
      if (typeof sleepWithStop === 'function') {
        await sleepWithStop(duration);
        return;
      }
      const deadline = Date.now() + duration;
      const tick = Math.min(250, duration);
      while (Date.now() < deadline) {
        throwIfStopped();
        const waitMs = Math.min(tick, deadline - Date.now());
        if (waitMs <= 0) break;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      throwIfStopped();
    }

    function resolveFilterAfterTimestamp(state = {}, fallbackTimestamp = 0) {
      const numericFallback = Number(fallbackTimestamp) || 0;
      const candidates = [
        numericFallback,
        Number(state?.loginVerificationRequestedAt) || 0,
        Number(state?.reauthStartedAt) || 0,
      ];
      const requestedAt = candidates.reduce((max, value) => (value > max ? value : max), 0)
        || Date.now();
      const provider = String(state?.mailProvider || '').trim().toLowerCase();
      if (provider === '2925') {
        return Math.max(0, requestedAt - MAIL_2925_FILTER_LOOKBACK_MS);
      }
      return Math.max(0, requestedAt);
    }

    function buildPollPayloadOverrides(state = {}) {
      const provider = String(state?.mailProvider || '').trim().toLowerCase();
      if (provider === '2925') {
        return { maxAttempts: MAIL_2925_POLL_MAX_ATTEMPTS };
      }
      return {};
    }

    async function requestVerificationCodeResend() {
      const result = await sendToContentScriptResilient(
        'openai-auth',
        {
          type: 'RESEND_VERIFICATION_CODE',
          step: VISIBLE_STEP,
          source: 'background',
          payload: {},
        },
        {
          timeoutMs: RESEND_REQUEST_TIMEOUT_MS,
          responseTimeoutMs: RESEND_REQUEST_TIMEOUT_MS,
          retryDelayMs: 700,
          logMessage: '认证页正在切换，等待页面重新就绪后继续点击「重新发送」...',
          logStep: VISIBLE_STEP,
          logStepKey: STEP_KEY,
        }
      );
      if (result?.error) {
        throw new Error(result.error);
      }
      return Date.now();
    }

    async function pollVerificationCodeOnce(state, filterAfterTimestamp) {
      return pollFlowVerificationCode({
        actionLabel: 'OAuth 重新授权验证码',
        flowId: 'openai-reauth',
        logStep: VISIBLE_STEP,
        logStepKey: STEP_KEY,
        missingCapabilityMessage: '当前重新授权步骤缺少邮件轮询能力，无法继续执行。',
        nodeId: NODE_ID,
        notFoundMessage: `步骤 ${VISIBLE_STEP}：邮箱轮询结束，但未获取到 OAuth 验证码。`,
        payloadOverrides: buildPollPayloadOverrides(state),
        state: {
          ...state,
          activeFlowId: 'openai-reauth',
          flowId: 'openai-reauth',
          visibleStep: VISIBLE_STEP,
        },
        step: VISIBLE_STEP,
        filterAfterTimestamp,
      });
    }

    async function fillCodeIntoAuthPage(code) {
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
      return fillResult || {};
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

      const normalizedMaxResend = Math.max(0, Math.floor(Number(maxResendRequests) || 0));
      const totalRounds = normalizedMaxResend + 1;
      const cooldownMs = Math.max(0, Number(resendIntervalMs) || 0);
      let filterAfterTimestamp = resolveFilterAfterTimestamp(state);
      let lastError = null;
      let usedResendRequests = 0;

      for (let round = 1; round <= totalRounds; round += 1) {
        throwIfStopped();

        if (round > 1) {
          await logStep(
            `未取到验证码，准备点击 OpenAI 「重新发送邮件」（第 ${usedResendRequests + 1}/${normalizedMaxResend} 次）...`,
            'warn'
          );
          try {
            const requestedAt = await requestVerificationCodeResend();
            filterAfterTimestamp = resolveFilterAfterTimestamp(state, requestedAt);
            usedResendRequests += 1;
            await logStep('已请求 OpenAI 重新发送验证码邮件。', 'warn');
          } catch (resendError) {
            if (isLikelyStopError(resendError)) {
              throw resendError;
            }
            await logStep(
              `请求重新发送验证码失败：${getErrorMessage(resendError)}，将继续刷新邮箱后重试。`,
              'warn'
            );
            await safeSleep(RESEND_FAILURE_BACKOFF_MS);
          }
        }

        try {
          await logStep(
            `正在轮询邮箱 ${email} 的 OAuth 验证码...（第 ${round}/${totalRounds} 轮）`
          );
          const codeResult = await pollVerificationCodeOnce(state, filterAfterTimestamp);
          const code = String(codeResult?.code || '').trim();
          if (!code) {
            throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
          }

          await logStep(`已收到验证码 ${code}，正在填回 OAuth 授权页...`);
          throwIfStopped();
          await fillCodeIntoAuthPage(code);
          await logStep('验证码已填回，等待 OAuth 服务端跳转 localhost 回调。', 'ok');
          await completeNodeFromBackground(nodeId, { reauthVerificationCode: code });
          return;
        } catch (error) {
          if (isLikelyStopError(error)) {
            throw error;
          }
          lastError = error;
          await logStep(
            `步骤 ${VISIBLE_STEP} 第 ${round}/${totalRounds} 轮失败：${getErrorMessage(error)}`,
            'warn'
          );
          if (round >= totalRounds) {
            break;
          }
          if (cooldownMs > 0) {
            await logStep(
              `等待 ${Math.ceil(cooldownMs / 1000)} 秒后点击「重新发送」并继续轮询...`,
              'info'
            );
            await safeSleep(cooldownMs);
          }
        }
      }

      const finalMessage = lastError ? getErrorMessage(lastError) : '验证码获取失败。';
      await logStep(
        `步骤 ${VISIBLE_STEP} 已用完 ${totalRounds} 轮轮询，仍未拿到 OAuth 验证码：${finalMessage}`,
        'error'
      );
      throw lastError || new Error(
        `步骤 ${VISIBLE_STEP}：已用完 ${totalRounds} 轮轮询，仍未拿到 OAuth 验证码。`
      );
    }

    return { executeFetchReauthCode };
  }

  return {
    NODE_ID,
    VISIBLE_STEP,
    DEFAULT_MAX_RESEND_REQUESTS,
    DEFAULT_RESEND_INTERVAL_MS,
    MAIL_2925_POLL_MAX_ATTEMPTS,
    createFetchReauthCodeExecutor,
  };
});
