(function attachOpenAiReauthPrepareStep(root, factory) {
  root.MultiPageOpenAiReauthPrepareStep = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createPrepareStepModule() {
  const NODE_ID = 'prepare-reauth';
  const VISIBLE_STEP = 1;
  const STEP_KEY = NODE_ID;

  function cleanString(value = '') {
    return String(value ?? '').trim();
  }

  function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? '未知错误');
  }

  function createPrepareReauthExecutor(deps = {}) {
    const {
      addLog = async () => {},
      chrome: chromeApi = (typeof globalThis !== 'undefined' ? globalThis.chrome : null),
      clearOpenAiAuthCookies,
      completeNodeFromBackground,
      generatePkcePair,
      generateState,
      buildAuthorizeUrl,
      reuseOrCreateTab,
      registerTab,
      setState,
    } = deps;

    if (typeof completeNodeFromBackground !== 'function') {
      throw new Error('prepare-reauth executor 缺少 completeNodeFromBackground。');
    }
    if (typeof clearOpenAiAuthCookies !== 'function') {
      throw new Error('prepare-reauth executor 缺少 clearOpenAiAuthCookies。');
    }
    if (typeof generatePkcePair !== 'function' || typeof generateState !== 'function' || typeof buildAuthorizeUrl !== 'function') {
      throw new Error('prepare-reauth executor 缺少 oauth-client 依赖。');
    }
    if (typeof reuseOrCreateTab !== 'function') {
      throw new Error('prepare-reauth executor 缺少 reuseOrCreateTab。');
    }
    if (typeof setState !== 'function') {
      throw new Error('prepare-reauth executor 缺少 setState。');
    }

    function logStep(message, level = 'info') {
      return addLog(message, level, { step: VISIBLE_STEP, stepKey: STEP_KEY });
    }

    function readReauthInputAccount(state = {}) {
      const account = state?.reauthInputAccount;
      if (!account || typeof account !== 'object') {
        throw new Error('缺少待重新授权的账号 JSON，请在 sidepanel 粘贴账号对象后再启动。');
      }
      const credentials = account.credentials && typeof account.credentials === 'object'
        ? account.credentials
        : {};
      const email = cleanString(credentials.email || account.email || account.name);
      if (!email) {
        throw new Error('账号 JSON 中缺少 email 字段。');
      }
      const mailProvider = cleanString(account.mailProvider || credentials.mailProvider);
      if (!mailProvider) {
        throw new Error('账号 JSON 中缺少 mailProvider 字段（必须显式声明邮箱来源）。');
      }
      return { email, mailProvider };
    }

    async function executePrepareReauth(state = {}) {
      const nodeId = cleanString(state?.nodeId) || NODE_ID;
      try {
        const { email, mailProvider } = readReauthInputAccount(state);

        await logStep(`正在为 ${email} 准备重新授权...`);

        if (chromeApi?.cookies) {
          const result = await clearOpenAiAuthCookies({ chromeApi });
          await logStep(`已清理 ${result.removed}/${result.collected} 个 OpenAI/ChatGPT cookies。`, 'ok');
        } else {
          await logStep('当前环境无 chrome.cookies API，跳过 cookie 清理。', 'warn');
        }

        const pkce = await generatePkcePair();
        const stateToken = generateState();
        const oauthUrl = buildAuthorizeUrl({
          codeChallenge: pkce.codeChallenge,
          state: stateToken,
        });

        await setState({
          reauthEmail: email,
          email,
          reauthMailProvider: mailProvider,
          mailProvider,
          reauthCodeVerifier: pkce.codeVerifier,
          reauthState: stateToken,
          reauthAuthorizeUrl: oauthUrl,
          oauthUrl,
          reauthStartedAt: Date.now(),
          reauthResultAccount: null,
          reauthLastError: '',
        });

        const tabId = await reuseOrCreateTab('openai-auth', oauthUrl, { forceNew: true });
        if (typeof registerTab === 'function' && Number.isInteger(tabId)) {
          await registerTab('openai-auth', tabId);
        }
        await logStep('已打开 OAuth 授权页，准备进入下一步。', 'ok');

        await completeNodeFromBackground(nodeId, {
          reauthEmail: email,
          reauthMailProvider: mailProvider,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        await setState({ reauthLastError: message });
        await logStep(`步骤 1 失败：${message}`, 'error');
        throw error;
      }
    }

    return { executePrepareReauth };
  }

  return {
    NODE_ID,
    VISIBLE_STEP,
    createPrepareReauthExecutor,
  };
});
