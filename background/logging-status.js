(function attachBackgroundLoggingStatus(root, factory) {
  root.MultiPageBackgroundLoggingStatus = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundLoggingStatusModule() {
  function createLoggingStatus(deps = {}) {
    const {
      chrome,
      DEFAULT_STATE,
      getStepIdByNodeIdForState,
      getState,
      isRecoverableStep9AuthFailure,
      LOG_PREFIX,
      setState,
      sourceRegistry = null,
      STOP_ERROR_MESSAGE,
    } = deps;

    function getSourceLabel(source) {
      if (sourceRegistry?.getSourceLabel) {
        return sourceRegistry.getSourceLabel(source);
      }
      const labels = {
        'openai-auth': 'Auth page',
        'gmail-mail': 'Gmail',
        'sidepanel': 'Side panel',
        'vps-panel': 'CPA panel',
        'sub2api-panel': 'SUB2API panel',
        'codex2api-panel': 'Codex2API panel',
        'qq-mail': 'QQ Mail',
        'mail-163': '163 Mail',
        'mail-2925': '2925 Mail',
        'inbucket-mail': 'Inbucket Mail',
        'duck-mail': 'Duck Mail',
        'hotmail-api': 'Hotmail (API/local helper)',
        'luckmail-api': 'LuckMail (API purchase)',
        'cloudflare-temp-email': 'Cloudflare Temp Email',
        'cloudmail': 'Cloud Mail',
        'plus-checkout': 'Plus Checkout',
        'paypal-flow': 'PayPal authorization page',
        'gopay-flow': 'GoPay authorization page',
        'unknown-source': 'Unknown source',
      };
      return labels[source] || source || 'Unknown source';
    }

    function normalizeLogStep(value) {
      const step = Math.floor(Number(value) || 0);
      return step > 0 ? step : null;
    }

    function buildLogEntry(message, level = 'info', options = {}) {
      const normalizedOptions = options && typeof options === 'object' ? options : {};
      const step = normalizeLogStep(normalizedOptions.step);
      const stepKey = String(normalizedOptions.stepKey || '').trim();
      const nodeId = String(normalizedOptions.nodeId || normalizedOptions.nodeKey || stepKey || '').trim();
      return {
        message: String(message || ''),
        level,
        timestamp: Date.now(),
        step,
        stepKey,
        nodeId,
      };
    }

    async function addLog(message, level = 'info', options = {}) {
      const state = await getState();
      const logs = state.logs || [];
      const entry = buildLogEntry(message, level, options);
      logs.push(entry);
      if (logs.length > 500) logs.splice(0, logs.length - 500);
      await setState({ logs });
      chrome.runtime.sendMessage({ type: 'LOG_ENTRY', payload: entry }).catch(() => { });
    }

    async function setNodeStatus(nodeId, status) {
      const normalizedNodeId = String(nodeId || '').trim();
      if (!normalizedNodeId) {
        throw new Error('setNodeStatus missing nodeId.');
      }
      const state = await getState();
      const nodeStatuses = { ...(state.nodeStatuses || {}) };
      nodeStatuses[normalizedNodeId] = status;
      await setState({
        nodeStatuses,
        currentNodeId: normalizedNodeId,
      });
      chrome.runtime.sendMessage({
        type: 'NODE_STATUS_CHANGED',
        payload: { nodeId: normalizedNodeId, status },
      }).catch(() => { });
    }

    function getErrorMessage(error) {
      return String(typeof error === 'string' ? error : error?.message || '')
        .replace(/^GPC_TASK_ENDED::/i, '')
        .replace(/^AUTO_RUN_STEP_IDLE_RESTART::/i, '');
    }

    function isVerificationMailPollingError(error) {
      const message = getErrorMessage(error);
      return /未在 .*邮箱中找到新的匹配邮件|未在 Hotmail 收件箱中找到新的匹配验证码|邮箱轮询结束，但未获取到验证码|无法获取新的(?:注册|登录)验证码|页面未能重新就绪|页面通信异常|内容脚本\s+\d+(?:\.\d+)?\s*秒内未响应|did not respond in \d+s|405\s+method\s+not\s+allowed|route\s+error.*405|did\s+not\s+provide\s+an?\s+[`'"]?action|post\s+request\s+to\s+["']?\/(?:email|phone)-verification/i.test(message);
    }

    function isAddPhoneAuthFailure(error) {
      const message = getErrorMessage(error);
      if (/\u624b\u673a\u53f7\u8f93\u5165\u6a21\u5f0f|phone\s+entry/i.test(message)) {
        return false;
      }
      return /https:\/\/auth\.openai\.com\/(?:add-phone|phone-verification)(?:[/?#]|$)|\badd-phone\b|phone-verification|\u6dfb\u52a0\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u624b\u673a\u9a8c\u8bc1\u7801\u9875|\u624b\u673a\u9a8c\u8bc1\u9875|\u8fdb\u5165\u624b\u673a\u53f7\u9875\u9762|\u624b\u673a\u53f7\u9875|\u624b\u673a\u53f7\u9875\u9762|phone\s+number|telephone/i.test(message);
    }

    function getLoginAuthStateLabel(state) {
      switch (state) {
        case 'verification_page':
          return 'Login verification code page';
        case 'password_page':
          return 'Password page';
        case 'email_page':
          return 'Email entry page';
        case 'login_timeout_error_page':
          return 'Login timeout error page';
        case 'oauth_consent_page':
          return 'OAuth consent page';
        case 'add_phone_page':
          return 'Phone number page';
        case 'add_email_page':
          return 'Add email page';
        case 'phone_verification_page':
          return 'Phone verification code page';
        default:
          return 'Unknown page';
      }
    }

    function isRestartCurrentAttemptError(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      return /当前邮箱已存在，需要重新开始新一轮|SIGNUP_PHONE_PASSWORD_MISMATCH::/i.test(message);
    }

    function isSignupUserAlreadyExistsFailure(error) {
      const message = getErrorMessage(error);
      return /SIGNUP_USER_ALREADY_EXISTS::|user_already_exists/i.test(message);
    }

    function isKiroProxyFailure(error) {
      const message = getErrorMessage(error);
      return /Kiro\s*(?:注册页|桌面授权页).*(?:CloudFront\s*拒绝请求|AWS\s*请求异常)|(?:当前代理\s*IP|出口区域异常).*(?:切换代理|更换代理)|AWS\s*风控.*(?:切换代理|更换代理)/i.test(message);
    }

    function isStep9RecoverableAuthError(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      return /STEP9_OAUTH_RETRY::/i.test(message)
        || isRecoverableStep9AuthFailure(message);
    }

    function isLegacyStep9RecoverableAuthError(error) {
      const message = String(typeof error === 'string' ? error : error?.message || '');
      return /STEP9_OAUTH_TIMEOUT::|认证失败:\s*(?:Timeout waiting for OAuth callback|timeout of \d+ms exceeded)/i.test(message);
    }

    function isStepDoneStatus(status) {
      return status === 'completed' || status === 'manual_completed' || status === 'skipped';
    }

    function getFirstUnfinishedStep(statuses = {}) {
      const nodeStatuses = statuses && typeof statuses === 'object' ? statuses : {};
      const nodeIds = Object.keys(DEFAULT_STATE.nodeStatuses || {});
      for (const nodeId of nodeIds) {
        if (!isStepDoneStatus(nodeStatuses[nodeId] || 'pending')) {
          return typeof getStepIdByNodeIdForState === 'function'
            ? getStepIdByNodeIdForState(nodeId, {})
            : null;
        }
      }
      return null;
    }

    function hasSavedProgress(statuses = {}) {
      return Object.values({ ...DEFAULT_STATE.nodeStatuses, ...statuses }).some((status) => status !== 'pending');
    }

    function getRunningSteps(statuses = {}) {
      return Object.entries({ ...DEFAULT_STATE.nodeStatuses, ...statuses })
        .filter(([, status]) => status === 'running')
        .map(([nodeId]) => (typeof getStepIdByNodeIdForState === 'function' ? getStepIdByNodeIdForState(nodeId, {}) : null))
        .filter((step) => Number.isInteger(step) && step > 0)
        .sort((a, b) => a - b);
    }

    function getFirstUnfinishedNode(statuses = {}) {
      const nodeIds = Object.keys(DEFAULT_STATE.nodeStatuses || {});
      for (const nodeId of nodeIds) {
        if (!isStepDoneStatus(statuses[nodeId] || 'pending')) {
          return nodeId;
        }
      }
      return '';
    }

    function hasSavedNodeProgress(statuses = {}) {
      return Object.values({ ...DEFAULT_STATE.nodeStatuses, ...statuses }).some((status) => status !== 'pending');
    }

    function getRunningNodes(statuses = {}) {
      return Object.entries({ ...DEFAULT_STATE.nodeStatuses, ...statuses })
        .filter(([, status]) => status === 'running')
        .map(([nodeId]) => nodeId);
    }

    function getAutoRunStatusPayload(phase, payload = {}) {
      return {
        autoRunning: phase === 'running'
          || phase === 'waiting_step'
          || phase === 'waiting_email'
          || phase === 'retrying'
          || phase === 'waiting_interval',
        autoRunPhase: phase,
        autoRunCurrentRun: payload.currentRun ?? 0,
        autoRunTotalRuns: payload.totalRuns ?? 1,
        autoRunAttemptRun: payload.attemptRun ?? 0,
        autoRunSessionId: Math.max(0, Math.floor(Number(payload.sessionId ?? payload.autoRunSessionId) || 0)),
        autoRunCountdownAt: Number.isFinite(Number(payload.countdownAt)) ? Number(payload.countdownAt) : null,
        autoRunCountdownTitle: payload.countdownTitle === undefined ? '' : String(payload.countdownTitle || ''),
        autoRunCountdownNote: payload.countdownNote === undefined ? '' : String(payload.countdownNote || ''),
      };
    }

    return {
      addLog,
      getAutoRunStatusPayload,
      getFirstUnfinishedNode,
      isAddPhoneAuthFailure,
      getErrorMessage,
      getFirstUnfinishedStep,
      getLoginAuthStateLabel,
      getRunningNodes,
      getRunningSteps,
      getSourceLabel,
      hasSavedNodeProgress,
      hasSavedProgress,
      isKiroProxyFailure,
      isLegacyStep9RecoverableAuthError,
      isRestartCurrentAttemptError,
      isSignupUserAlreadyExistsFailure,
      isStep9RecoverableAuthError,
      isStepDoneStatus,
      isVerificationMailPollingError,
      setNodeStatus,
    };
  }

  return {
    createLoggingStatus,
  };
});
