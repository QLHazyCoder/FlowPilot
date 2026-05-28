(function attachOpenAiReauthCaptureCallbackStep(root, factory) {
  root.MultiPageOpenAiReauthCaptureCallbackStep = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createCaptureCallbackStepModule() {
  const NODE_ID = 'capture-reauth-callback';
  const VISIBLE_STEP = 4;
  const STEP_KEY = NODE_ID;
  const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
  const CALLBACK_CHECK_INTERVAL_MS = 1000;

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function createCaptureReauthCallbackExecutor(deps = {}) {
    const {
      addLog = async () => {},
      chrome: chromeApi = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      completeNodeFromBackground,
      exchangeAuthorizationCode,
      parseCallbackUrl,
      buildUpdatedAccount,
      fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
      setState,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 completeNodeFromBackground。');
    }
    if (typeof exchangeAuthorizationCode !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 exchangeAuthorizationCode。');
    }
    if (typeof parseCallbackUrl !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 parseCallbackUrl。');
    }
    if (typeof buildUpdatedAccount !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 buildUpdatedAccount。');
    }
    if (typeof setState !== 'function') {
      throw new Error('capture-reauth-callback executor 缺少 setState。');
    }
    if (!chromeApi?.webNavigation || !chromeApi?.tabs) {
      throw new Error('capture-reauth-callback executor 需要 chrome.webNavigation / chrome.tabs。');
    }

    function logStep(message, level = 'info') {
      return addLog(message, level, { step: VISIBLE_STEP, stepKey: STEP_KEY });
    }

    function executeCaptureReauthCallback(state = {}) {
      const nodeId = String(state?.nodeId || NODE_ID).trim();
      const expectedState = String(state?.reauthState || '').trim();
      const codeVerifier = String(state?.reauthCodeVerifier || '').trim();
      const originalAccount = state?.reauthInputAccount;

      return new Promise((resolve, reject) => {
        if (!expectedState) {
          reject(new Error('缺少 OAuth state，请先执行步骤 1。'));
          return;
        }
        if (!codeVerifier) {
          reject(new Error('缺少 PKCE code_verifier，请先执行步骤 1。'));
          return;
        }
        if (!originalAccount || typeof originalAccount !== 'object') {
          reject(new Error('缺少待重新授权的账号 JSON。'));
          return;
        }

        let resolved = false;
        const startedAt = Date.now();
        let timeoutTimer = null;
        let onBeforeNavigate = null;
        let onCommitted = null;
        let onTabUpdated = null;

        function cleanup() {
          if (timeoutTimer) {
            clearTimeout(timeoutTimer);
            timeoutTimer = null;
          }
          if (onBeforeNavigate) {
            chromeApi.webNavigation.onBeforeNavigate.removeListener?.(onBeforeNavigate);
            onBeforeNavigate = null;
          }
          if (onCommitted) {
            chromeApi.webNavigation.onCommitted.removeListener?.(onCommitted);
            onCommitted = null;
          }
          if (onTabUpdated) {
            chromeApi.tabs.onUpdated.removeListener?.(onTabUpdated);
            onTabUpdated = null;
          }
        }

        function rejectStep(error) {
          if (resolved) return;
          resolved = true;
          cleanup();
          reject(error);
        }

        async function finalize(parsed) {
          if (resolved || !parsed) return;
          if (parsed.error) {
            rejectStep(new Error(`OAuth 回调错误：${parsed.error}`));
            return;
          }
          const code = String(parsed.code || '').trim();
          if (!code) return;

          resolved = true;
          cleanup();

          try {
            await logStep(`已捕获 localhost 回调，正在向 OAuth 服务端换取新 Token...`);
            const tokens = await exchangeAuthorizationCode({
              code,
              codeVerifier,
              fetchImpl,
            });
            const updatedAccount = buildUpdatedAccount(originalAccount, tokens);
            await setState({
              reauthResultAccount: updatedAccount,
              reauthCodeVerifier: '',
              reauthState: '',
              reauthLastError: '',
            });
            await logStep('Token 换取成功，新 access_token / refresh_token / id_token 已写入会话状态。', 'ok');
            await completeNodeFromBackground(nodeId, { reauthResultAccount: updatedAccount });
            resolve();
          } catch (error) {
            const message = getErrorMessage(error);
            await setState({ reauthLastError: message }).catch(() => {});
            await logStep(`步骤 4 失败：${message}`, 'error');
            reject(error);
          }
        }

        function handleNavigation(details = {}) {
          const url = String(details?.url || '').trim();
          if (!url) return;
          const parsed = parseCallbackUrl(url, expectedState);
          if (parsed) {
            finalize(parsed);
            const tabId = Number(details?.tabId);
            if (Number.isInteger(tabId) && chromeApi.tabs?.remove) {
              chromeApi.tabs.remove(tabId).catch(() => {});
            }
          }
        }

        function handleTabUpdated(_tabId, _changeInfo, tab) {
          const url = String(tab?.url || _changeInfo?.url || '').trim();
          if (!url) return;
          const parsed = parseCallbackUrl(url, expectedState);
          if (parsed) {
            finalize(parsed);
            const tabIdToClose = Number(_tabId);
            if (Number.isInteger(tabIdToClose) && chromeApi.tabs?.remove) {
              chromeApi.tabs.remove(tabIdToClose).catch(() => {});
            }
          }
        }

        onBeforeNavigate = handleNavigation;
        onCommitted = handleNavigation;
        onTabUpdated = handleTabUpdated;
        chromeApi.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
        chromeApi.webNavigation.onCommitted.addListener(onCommitted);
        chromeApi.tabs.onUpdated.addListener(onTabUpdated);

        function checkTimeout() {
          if (resolved) return;
          if (Date.now() - startedAt >= CALLBACK_TIMEOUT_MS) {
            rejectStep(new Error(`${Math.round(CALLBACK_TIMEOUT_MS / 1000)} 秒内未捕获到 localhost 回调，OAuth 同意点击可能被拦截。`));
            return;
          }
          timeoutTimer = setTimeout(checkTimeout, CALLBACK_CHECK_INTERVAL_MS);
        }
        timeoutTimer = setTimeout(checkTimeout, CALLBACK_CHECK_INTERVAL_MS);

        logStep('正在监听 localhost:1455 回调...').catch(() => {});
      });
    }

    return { executeCaptureReauthCallback };
  }

  return {
    NODE_ID,
    VISIBLE_STEP,
    createCaptureReauthCallbackExecutor,
  };
});
