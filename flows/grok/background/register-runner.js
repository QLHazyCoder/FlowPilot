(function attachBackgroundGrokRegisterRunner(root, factory) {
  root.MultiPageBackgroundGrokRegisterRunner = factory(root);
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundGrokRegisterRunnerModule(root) {
  const GROK_SIGNUP_URL = 'https://accounts.x.ai/sign-up?redirect=grok-com';
  const GROK_REGISTER_PAGE_SOURCE_ID = 'grok-register-page';
  const GROK_REGISTER_INJECT_FILES = ['flows/openai/index.js', 'flows/kiro/index.js', 'flows/grok/index.js', 'flows/index.js', 'core/flow-kernel/flow-registry.js', 'core/flow-kernel/source-registry.js', 'content/utils.js', 'flows/grok/content/register-page.js'];
  const DEFAULT_GROK_PAGE_TIMEOUT_MS = 90 * 1000;
  const DEFAULT_GROK_MAIL_POLL_INTERVAL_MS = 5000;
  const GROK_POST_PROFILE_CF_WAIT_MS = 20 * 1000;
  const GROK_PRE_SSO_EXTRACT_WAIT_MS = 10 * 1000;
  const GROK_COOKIE_CLEAR_DOMAINS = Object.freeze([
    'x.ai',
    '.x.ai',
    'accounts.x.ai',
    '.accounts.x.ai',
    'grok.com',
    '.grok.com',
  ]);

  function cleanString(value = '') {
    return String(value || '').trim();
  }

  function getErrorMessage(error) {
    return cleanString(error?.message || error) || '未知错误';
  }

  function createGeneratedPassword() {
    const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*';
    let output = '';
    for (let index = 0; index < 18; index += 1) {
      output += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `${output}aA1!`;
  }

  function createGrokRegisterRunner(deps = {}) {
    const {
      addLog,
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTab,
      generatePassword,
      generateRandomName,
      getMailConfig,
      getState,
      getTabId,
      HOTMAIL_PROVIDER = 'hotmail-api',
      isTabAlive,
      LUCKMAIL_PROVIDER = 'luckmail-api',
      CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email',
      CLOUD_MAIL_PROVIDER = 'cloudmail',
      YYDS_MAIL_PROVIDER = 'yyds-mail',
      MAIL_2925_VERIFICATION_INTERVAL_MS = 15000,
      MAIL_2925_VERIFICATION_MAX_ATTEMPTS = 12,
      pollCloudflareTempEmailVerificationCode = null,
      pollCloudMailVerificationCode = null,
      pollHotmailVerificationCode = null,
      pollLuckmailVerificationCode = null,
      pollYydsMailVerificationCode = null,
      ensureMail2925MailboxSession = null,
      ensureIcloudMailSession = null,
      registerTab,
      resolveSignupEmailForFlow = null,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      sendToMailContentScriptResilient = null,
      setPasswordState,
      setState,
      sleepWithStop,
      throwIfStopped,
      waitForTabStableComplete,
      GROK_REGISTER_INJECT_FILES: injectedGrokRegisterFiles = GROK_REGISTER_INJECT_FILES,
      markCurrentRegistrationAccountUsed = null,
    } = deps;

    async function log(message, level = 'info', nodeId = '') {
      if (typeof addLog === 'function') {
        await addLog(message, level, nodeId || undefined);
      }
    }

    async function getExecutionState(state = {}) {
      const suppliedState = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
      if (typeof getState !== 'function') {
        return suppliedState;
      }
      const latestState = await getState();
      return {
        ...suppliedState,
        ...(latestState && typeof latestState === 'object' && !Array.isArray(latestState) ? latestState : {}),
        ...(suppliedState.nodeId ? { nodeId: suppliedState.nodeId } : {}),
      };
    }

    async function persistState(patch = {}) {
      if (typeof setState === 'function') {
        await setState(patch);
      }
      return patch;
    }

    async function completeNode(nodeId, patch = {}) {
      await persistState(patch);
      if (typeof completeNodeFromBackground === 'function') {
        await completeNodeFromBackground(nodeId, patch);
      }
      return patch;
    }

    async function activateTab(tabId) {
      if (chrome?.tabs?.update && Number.isInteger(tabId)) {
        await chrome.tabs.update(tabId, { active: true });
      }
    }

    async function isUsableTabId(tabId) {
      if (!Number.isInteger(tabId)) {
        return false;
      }
      if (chrome?.tabs?.get) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        return Boolean(tab?.id === tabId);
      }
      return true;
    }

    async function ensureGrokRegisterTab(state = {}, options = {}) {
      const existingTabId = Number(state?.grokRegisterTabId || state?.tabRegistry?.[GROK_REGISTER_PAGE_SOURCE_ID]?.tabId || 0);
      if (existingTabId && await isUsableTabId(existingTabId)) {
        if (typeof registerTab === 'function') await registerTab(GROK_REGISTER_PAGE_SOURCE_ID, existingTabId);
        return existingTabId;
      }
      const tabId = typeof getTabId === 'function' ? await getTabId(GROK_REGISTER_PAGE_SOURCE_ID) : null;
      if (Number.isInteger(tabId) && await isUsableTabId(tabId)) {
        if (typeof registerTab === 'function') await registerTab(GROK_REGISTER_PAGE_SOURCE_ID, tabId);
        return tabId;
      }
      if (!options.openIfMissing) {
        throw new Error(options.missingMessage || '缺少 x.ai 注册页，请先执行打开注册页步骤。');
      }
      const openedTabId = await reuseOrCreateTab(GROK_REGISTER_PAGE_SOURCE_ID, GROK_SIGNUP_URL, {
        inject: injectedGrokRegisterFiles,
        injectSource: GROK_REGISTER_PAGE_SOURCE_ID,
      });
      if (!Number.isInteger(openedTabId)) {
        throw new Error('无法打开 x.ai 注册页。');
      }
      if (typeof registerTab === 'function') await registerTab(GROK_REGISTER_PAGE_SOURCE_ID, openedTabId);
      return openedTabId;
    }

    async function ensureContentReady(tabId, options = {}) {
      if (typeof waitForTabStableComplete === 'function') {
        await waitForTabStableComplete(tabId, {
          timeoutMs: options.timeoutMs || DEFAULT_GROK_PAGE_TIMEOUT_MS,
          retryDelayMs: 300,
          stableMs: Number(options.stableMs) || 1200,
          initialDelayMs: Number(options.initialDelayMs) || 120,
        });
      }
      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(GROK_REGISTER_PAGE_SOURCE_ID, tabId, {
          inject: injectedGrokRegisterFiles,
          injectSource: GROK_REGISTER_PAGE_SOURCE_ID,
          timeoutMs: options.timeoutMs || DEFAULT_GROK_PAGE_TIMEOUT_MS,
          retryDelayMs: 700,
          logMessage: options.logMessage || 'Grok 注册页内容脚本未就绪，正在注入...',
        });
      }
    }

    async function sendGrokCommand(nodeId, command, payload = {}, options = {}) {
      if (typeof sendToContentScriptResilient !== 'function') {
        throw new Error('Grok 注册页通信能力不可用。');
      }
      return sendToContentScriptResilient(GROK_REGISTER_PAGE_SOURCE_ID, {
        type: 'EXECUTE_NODE',
        nodeId,
        step: options.step || 0,
        source: 'background',
        command,
        payload,
      }, {
        timeoutMs: options.timeoutMs || 45000,
        retryDelayMs: 700,
        logMessage: options.logMessage || '',
      });
    }

    async function removeGrokCookie(cookie = {}) {
      if (!chrome?.cookies?.remove || !cookie?.name) {
        return false;
      }
      const domain = String(cookie.domain || '').replace(/^\./, '');
      const protocol = cookie.secure ? 'https:' : 'http:';
      const path = String(cookie.path || '/');
      const details = {
        url: `${protocol}//${domain}${path.startsWith('/') ? path : `/${path}`}`,
        name: cookie.name,
      };
      if (cookie.storeId) {
        details.storeId = cookie.storeId;
      }
      if (cookie.partitionKey) {
        details.partitionKey = cookie.partitionKey;
      }
      try {
        const removed = await chrome.cookies.remove(details);
        return Boolean(removed);
      } catch (error) {
        console.warn('[MultiPage:grok-register] remove cookie failed', {
          domain: cookie.domain,
          name: cookie.name,
          message: getErrorMessage(error),
        });
        return false;
      }
    }

    async function clearGrokCookiesBeforeStep1() {
      if (!chrome?.cookies?.getAll || !chrome?.cookies?.remove) {
        await log('步骤 1：当前浏览器不支持 cookies API，跳过 Grok Cookie 清理。', 'warn', 'grok-open-signup-page');
        return;
      }
      let removedCount = 0;
      for (const domain of GROK_COOKIE_CLEAR_DOMAINS) {
        const cookies = await chrome.cookies.getAll({ domain }).catch((error) => {
          console.warn('[MultiPage:grok-register] list cookies failed', {
            domain,
            message: getErrorMessage(error),
          });
          return [];
        });
        for (const cookie of cookies || []) {
          if (await removeGrokCookie(cookie)) {
            removedCount += 1;
          }
        }
      }
      await log(`步骤 1：已清理 Grok/x.ai Cookie ${removedCount} 个。`, removedCount ? 'ok' : 'info', 'grok-open-signup-page');
    }

    function resolveProfile(currentState = {}) {
      const firstFromState = cleanString(currentState.grokFirstName);
      const lastFromState = cleanString(currentState.grokLastName);
      if (firstFromState && lastFromState) {
        return { firstName: firstFromState, lastName: lastFromState };
      }
      const generated = typeof generateRandomName === 'function' ? generateRandomName() : null;
      const fullName = cleanString(generated?.fullName || generated?.name || 'Alex Morgan');
      const parts = fullName.split(/\s+/).filter(Boolean);
      return {
        firstName: firstFromState || cleanString(generated?.firstName || parts[0] || 'Alex'),
        lastName: lastFromState || cleanString(generated?.lastName || parts.slice(1).join(' ') || 'Morgan'),
      };
    }

    function resolvePassword(currentState = {}) {
      return cleanString(currentState.grokPassword || currentState.customPassword || currentState.password)
        || (typeof generatePassword === 'function' ? generatePassword() : createGeneratedPassword());
    }

    function buildGrokVerificationPollPayload(step, state = {}, mail = {}) {
      const targetEmail = cleanString(state.grokEmail || state.email).toLowerCase();
      const requestedAt = Math.max(0, Number(state.grokVerificationRequestedAt) || Date.now() - 10 * 60 * 1000);
      const isMail2925Provider = String(mail?.provider || '').trim().toLowerCase() === '2925';
      const normalizedProvider = String(mail?.provider || '').trim().toLowerCase();
      return {
        flowId: 'grok',
        step,
        targetEmail,
        targetEmailHints: targetEmail ? [targetEmail] : [],
        filterAfterTimestamp: isMail2925Provider ? Math.max(0, requestedAt - 10 * 60 * 1000) : requestedAt,
        senderFilters: ['x.ai', 'xai', 'grok'],
        subjectFilters: ['xai', 'x.ai', 'grok', 'verification', 'confirmation', 'code', '验证码', '确认码'],
        requiredKeywords: ['xai', 'x.ai', 'grok', 'verification', 'confirmation', 'code', '验证码', '确认码'],
        codePatterns: [
          { source: '\\b([A-Z0-9]{3}-[A-Z0-9]{3})\\b', flags: 'gi' },
          { source: '(?:verification\\s*code|confirmation\\s*code|code\\s*is)[：:\\s]*(\\d{6})', flags: 'gi' },
          { source: '(?:验证码|代码|确认码)[：:\\s为]+(\\d{6})', flags: 'gi' },
          { source: '(?<!#)\\b(\\d{6})\\b', flags: 'g' },
        ],
        mail2925MatchTargetEmail: isMail2925Provider
          && String(state?.mail2925Mode || '').trim().toLowerCase() === 'receive',
        maxAttempts: normalizedProvider === String(LUCKMAIL_PROVIDER || '').trim().toLowerCase()
          ? 3
          : (isMail2925Provider ? MAIL_2925_VERIFICATION_MAX_ATTEMPTS : 5),
        intervalMs: normalizedProvider === String(LUCKMAIL_PROVIDER || '').trim().toLowerCase()
          ? 15000
          : (isMail2925Provider ? MAIL_2925_VERIFICATION_INTERVAL_MS : DEFAULT_GROK_MAIL_POLL_INTERVAL_MS),
      };
    }

    function getMailPollingResponseTimeoutMs(payload = {}) {
      const maxAttempts = Math.max(1, Math.floor(Number(payload?.maxAttempts) || 1));
      const intervalMs = Math.max(1, Number(payload?.intervalMs) || DEFAULT_GROK_MAIL_POLL_INTERVAL_MS);
      return Math.max(45000, maxAttempts * intervalMs + 25000);
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
      if (!mail?.source) {
        return;
      }
      const alive = typeof isTabAlive === 'function' ? await isTabAlive(mail.source) : false;
      if (alive) {
        if (mail.navigateOnReuse) {
          await reuseOrCreateTab(mail.source, mail.url, {
            inject: mail.inject,
            injectSource: mail.injectSource,
          });
          return;
        }
        const tabId = typeof getTabId === 'function' ? await getTabId(mail.source) : null;
        if (Number.isInteger(tabId)) {
          await activateTab(tabId);
        }
        return;
      }
      await reuseOrCreateTab(mail.source, mail.url, {
        inject: mail.inject,
        injectSource: mail.injectSource,
      });
    }

    async function pollGrokVerificationCode(step, state = {}, nodeId = '') {
      if (typeof getMailConfig !== 'function') {
        throw new Error('Grok 验证码步骤缺少公共邮箱配置能力，无法继续执行。');
      }
      const mail = getMailConfig(state);
      if (mail?.error) {
        throw new Error(mail.error);
      }
      const pollPayload = buildGrokVerificationPollPayload(step, state, mail);

      if (mail.source === 'icloud-mail' && typeof ensureIcloudMailSession === 'function') {
        await log(`步骤 ${step}：正在确认 ${mail.label || 'iCloud 邮箱'} 登录状态...`, 'info', nodeId);
        await ensureIcloudMailSession({
          state,
          step,
          actionLabel: `步骤 ${step}：确认 iCloud 邮箱登录状态`,
        });
      }

      throwIfStopped();
      if (mail.provider === HOTMAIL_PROVIDER) {
        await log(`步骤 ${step}：正在通过 ${mail.label || 'Hotmail'} 轮询验证码...`, 'info', nodeId);
        return pollHotmailVerificationCode(step, state, pollPayload);
      }
      if (mail.provider === LUCKMAIL_PROVIDER) {
        await log(`步骤 ${step}：正在通过 ${mail.label || 'LuckMail'} 轮询验证码...`, 'info', nodeId);
        return pollLuckmailVerificationCode(step, state, pollPayload);
      }
      if (mail.provider === CLOUDFLARE_TEMP_EMAIL_PROVIDER) {
        await log(`步骤 ${step}：正在通过 ${mail.label || 'Cloudflare Temp Email'} 轮询验证码...`, 'info', nodeId);
        return pollCloudflareTempEmailVerificationCode(step, state, pollPayload);
      }
      if (mail.provider === CLOUD_MAIL_PROVIDER) {
        await log(`步骤 ${step}：正在通过 ${mail.label || 'Cloud Mail'} 轮询验证码...`, 'info', nodeId);
        return pollCloudMailVerificationCode(step, state, pollPayload);
      }
      if (mail.provider === YYDS_MAIL_PROVIDER) {
        await log(`步骤 ${step}：正在通过 ${mail.label || 'YYDS Mail'} 轮询验证码...`, 'info', nodeId);
        return pollYydsMailVerificationCode(step, state, pollPayload);
      }

      if (mail.provider === '2925' && typeof ensureMail2925MailboxSession === 'function') {
        await log(`步骤 ${step}：正在确认 ${mail.label || '2925 邮箱'} 登录状态...`, 'info', nodeId);
        await ensureMail2925MailboxSession({
          accountId: state.currentMail2925AccountId || null,
          forceRelogin: false,
          allowLoginWhenOnLoginPage: Boolean(state?.mail2925UseAccountPool),
          expectedMailboxEmail: getExpectedMail2925MailboxEmail(state),
          actionLabel: `步骤 ${step}：确认 2925 邮箱登录状态`,
        });
      } else {
        await log(`步骤 ${step}：正在打开 ${mail.label || '邮箱'}...`, 'info', nodeId);
        await focusOrOpenMailTab(mail);
      }

      if (typeof sendToMailContentScriptResilient !== 'function') {
        throw new Error('Grok 验证码步骤缺少邮箱内容脚本通信能力，无法继续执行。');
      }
      const responseTimeoutMs = getMailPollingResponseTimeoutMs(pollPayload);
      const result = await sendToMailContentScriptResilient(mail, {
        type: 'POLL_EMAIL',
        step,
        source: 'background',
        payload: pollPayload,
      }, {
        timeoutMs: responseTimeoutMs,
        responseTimeoutMs,
        maxRecoveryAttempts: 2,
        logStep: step,
        logStepKey: 'grok-submit-verification-code',
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      if (!result?.code) {
        throw new Error(`步骤 ${step}：邮箱轮询结束，但未获取到 xAI 验证码。`);
      }
      return {
        ...result,
        code: String(result.code || '').replace(/[^A-Za-z0-9]/g, '').trim(),
        rawCode: result.code,
      };
    }

    async function executeGrokOpenSignupPage(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-open-signup-page';
      const currentState = await getExecutionState(state);
      try {
        await clearGrokCookiesBeforeStep1();
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: true });
        await activateTab(tabId);
        await persistState({ grokRegisterTabId: tabId, grokSignupUrl: GROK_SIGNUP_URL });
        await ensureContentReady(tabId);
        const result = await sendGrokCommand(nodeId, 'grok-open-signup-page', {}, {
          step: 1,
          timeoutMs: DEFAULT_GROK_PAGE_TIMEOUT_MS,
          logMessage: '步骤 1：正在打开 x.ai 邮箱注册入口...',
        });
        if (result?.error) throw new Error(result.error);
        await log('步骤 1：已打开 x.ai 邮箱注册页。', 'ok', nodeId);
        await completeNode(nodeId, {
          grokRegisterTabId: tabId,
          grokSignupUrl: result?.url || GROK_SIGNUP_URL,
          grokPageState: result?.state || 'email_signup_ready',
        });
      } catch (error) {
        await log(`步骤 1：${getErrorMessage(error)}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokSubmitEmail(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-submit-email';
      const currentState = await getExecutionState(state);
      try {
        if (typeof resolveSignupEmailForFlow !== 'function') {
          throw new Error('Grok 邮箱步骤缺少公共邮箱解析能力，无法继续执行。');
        }
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const resolvedEmail = await resolveSignupEmailForFlow(currentState, {
          preserveAccountIdentity: true,
        });
        await persistState({
          grokEmail: resolvedEmail,
        });
        const result = await sendGrokCommand(nodeId, 'grok-submit-email', { email: resolvedEmail }, {
          step: 2,
          logMessage: '步骤 2：正在提交 x.ai 注册邮箱...',
        });
        if (result?.error) throw new Error(result.error);
        await log(`步骤 2：已提交 Grok 注册邮箱 ${resolvedEmail}。`, 'ok', nodeId);
        await completeNode(nodeId, {
          grokEmail: resolvedEmail,
          grokVerificationRequestedAt: Date.now(),
          email: resolvedEmail,
          accountIdentifierType: 'email',
          accountIdentifier: resolvedEmail,
        });
      } catch (error) {
        await log(`步骤 2：${getErrorMessage(error)}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokSubmitVerificationCode(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-submit-verification-code';
      const currentState = await getExecutionState(state);
      try {
        const pollResult = await pollGrokVerificationCode(3, currentState, nodeId);
        if (!pollResult?.code) throw new Error('轮询邮箱结束，但未获取到 xAI 验证码。');
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const result = await sendGrokCommand(nodeId, 'grok-submit-verification-code', { code: pollResult.code }, {
          step: 3,
          logMessage: '步骤 3：正在填写 xAI 邮箱验证码...',
        });
        if (result?.error) throw new Error(result.error);
        await log(`步骤 3：已提交 xAI 邮箱验证码，当前页面状态：${result?.state || 'unknown'}。`, 'ok', nodeId);
        await completeNode(nodeId, {
          grokVerificationCode: pollResult.code,
          grokVerificationMessageId: pollResult.messageId || '',
          grokPageState: result?.state || '',
          grokPostVerificationUrl: result?.url || '',
        });
      } catch (error) {
        await log(`步骤 3：${getErrorMessage(error)}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokSubmitProfile(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-submit-profile';
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        const profile = resolveProfile(currentState);
        const password = resolvePassword(currentState);
        await persistState({
          grokFirstName: profile.firstName,
          grokLastName: profile.lastName,
          grokPassword: password,
        });
        if (typeof setPasswordState === 'function') {
          await setPasswordState(password);
        }
        await activateTab(tabId);
        await ensureContentReady(tabId);
        const result = await sendGrokCommand(nodeId, 'grok-submit-profile', {
          firstName: profile.firstName,
          lastName: profile.lastName,
          password,
        }, {
          step: 4,
          logMessage: '步骤 4：正在填写 x.ai 注册资料...',
        });
        if (result?.error) throw new Error(result.error);
        await log(`步骤 4：已提交 Grok 注册资料，等待 ${Math.floor(GROK_POST_PROFILE_CF_WAIT_MS / 1000)} 秒完成注册验证...`, 'info', nodeId);
        if (typeof sleepWithStop === 'function') {
          await sleepWithStop(GROK_POST_PROFILE_CF_WAIT_MS);
        } else {
          await new Promise((resolve) => setTimeout(resolve, GROK_POST_PROFILE_CF_WAIT_MS));
        }
        await ensureContentReady(tabId, { timeoutMs: DEFAULT_GROK_PAGE_TIMEOUT_MS });
        await log('步骤 4：已提交 Grok 注册资料并完成等待。', 'ok', nodeId);
        await completeNode(nodeId, {
          grokFirstName: profile.firstName,
          grokLastName: profile.lastName,
          grokPassword: password,
        });
      } catch (error) {
        await log(`步骤 4：${getErrorMessage(error)}`, 'error', nodeId);
        throw error;
      }
    }

    async function executeGrokExtractSsoCookie(state = {}) {
      const nodeId = cleanString(state?.nodeId) || 'grok-extract-sso-cookie';
      const currentState = await getExecutionState(state);
      try {
        const tabId = await ensureGrokRegisterTab(currentState, { openIfMissing: false });
        await activateTab(tabId);
        await log(`步骤 5：等待 ${Math.floor(GROK_PRE_SSO_EXTRACT_WAIT_MS / 1000)} 秒后提取 Grok SSO...`, 'info', nodeId);
        if (typeof sleepWithStop === 'function') {
          await sleepWithStop(GROK_PRE_SSO_EXTRACT_WAIT_MS);
        } else {
          await new Promise((resolve) => setTimeout(resolve, GROK_PRE_SSO_EXTRACT_WAIT_MS));
        }
        let ssoCookie = '';
        if (chrome?.cookies?.get) {
          const cookie = await chrome.cookies.get({ url: 'https://x.ai/', name: 'sso' })
            || await chrome.cookies.get({ url: 'https://grok.com/', name: 'sso' })
            || await chrome.cookies.get({ url: 'https://accounts.x.ai/', name: 'sso' });
          ssoCookie = cleanString(cookie?.value);
        }
        if (!ssoCookie) {
          await ensureContentReady(tabId);
          const result = await sendGrokCommand(nodeId, 'grok-extract-sso-cookie', {}, {
            step: 5,
            logMessage: '步骤 5：正在从注册页读取 sso Cookie...',
          });
          if (result?.error) throw new Error(result.error);
          ssoCookie = cleanString(result?.ssoCookie);
        }
        if (!ssoCookie) throw new Error('未找到 x.ai/grok sso Cookie。');
        const latestState = typeof getState === 'function' ? await getState() : currentState;
        const existingSsoCookies = Array.isArray(latestState?.grokSsoCookies)
          ? latestState.grokSsoCookies
            .map((entry) => cleanString(entry))
            .filter(Boolean)
          : [];
        const nextSsoCookies = existingSsoCookies.includes(ssoCookie)
          ? existingSsoCookies
          : [...existingSsoCookies, ssoCookie];
        await log('步骤 5：已提取 Grok SSO Cookie。', 'ok', nodeId);
        const completionPatch = {
          grokSsoCookie: ssoCookie,
          grokSsoCookies: nextSsoCookies,
          grokCompletedAt: Date.now(),
        };
        if (typeof markCurrentRegistrationAccountUsed === 'function') {
          await markCurrentRegistrationAccountUsed({
            ...currentState,
            ...completionPatch,
          }, {
            logPrefix: 'Grok 注册成功',
            level: 'ok',
          });
        }
        await completeNode(nodeId, completionPatch);
      } catch (error) {
        await log(`步骤 5：${getErrorMessage(error)}`, 'error', nodeId);
        throw error;
      }
    }

    return {
      executeGrokOpenSignupPage,
      executeGrokSubmitEmail,
      executeGrokSubmitVerificationCode,
      executeGrokSubmitProfile,
      executeGrokExtractSsoCookie,
    };
  }

  return {
    GROK_SIGNUP_URL,
    GROK_REGISTER_PAGE_SOURCE_ID,
    GROK_REGISTER_INJECT_FILES,
    DEFAULT_GROK_MAIL_POLL_INTERVAL_MS,
    GROK_POST_PROFILE_CF_WAIT_MS,
    GROK_PRE_SSO_EXTRACT_WAIT_MS,
    GROK_COOKIE_CLEAR_DOMAINS,
    createGrokRegisterRunner,
  };
});
