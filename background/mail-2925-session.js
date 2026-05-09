(function attachBackgroundMail2925Session(root, factory) {
  root.MultiPageBackgroundMail2925Session = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundMail2925SessionModule() {
  function createMail2925SessionManager(deps = {}) {
    const {
      addLog,
      broadcastDataUpdate,
      chrome,
      ensureContentScriptReadyOnTab,
      findMail2925Account,
      getMail2925AccountStatus,
      getState,
      isAutoRunLockedState,
      isMail2925AccountAvailable,
      MAIL2925_LIMIT_COOLDOWN_MS,
      normalizeMail2925Account,
      normalizeMail2925Accounts,
      pickMail2925AccountForRun,
      requestStop,
      reuseOrCreateTab,
      sendToContentScriptResilient,
      sendToMailContentScriptResilient,
      setPersistentSettings,
      setState,
      sleepWithStop,
      throwIfStopped,
      upsertMail2925AccountInList,
      waitForTabComplete,
      waitForTabUrlMatch,
    } = deps;

    const MAIL2925_SOURCE = 'mail-2925';
    const MAIL2925_URL = 'https://2925.com/#/mailList';
    const MAIL2925_LOGIN_URL = 'https://2925.com/login/';
    const MAIL2925_INJECT = ['content/utils.js', 'content/operation-delay.js', 'content/mail-2925.js'];
    const MAIL2925_INJECT_SOURCE = 'mail-2925';
    const MAIL2925_COOKIE_DOMAINS = [
      '2925.com',
      'www.2925.com',
    ];
    const MAIL2925_COOKIE_ORIGINS = [
      'https://2925.com',
      'https://www.2925.com',
    ];
    const MAIL2925_LIMIT_ERROR_PREFIX = 'MAIL2925_LIMIT_REACHED::';
    const MAIL2925_THREAD_TERMINATED_ERROR_PREFIX = 'MAIL2925_THREAD_TERMINATED::';
    const MAIL2925_LOGIN_MESSAGE_RETRY_WINDOW_MS = 15000;
    const MAIL2925_LOGIN_RESPONSE_TIMEOUT_MS = 120000;
    const MAIL2925_LOGIN_PAGE_RECOVERY_TIMEOUT_MS = 120000;

    function getMail2925MailConfig() {
      return {
        provider: '2925',
        source: MAIL2925_SOURCE,
        url: MAIL2925_URL,
        label: '2925 邮箱',
        inject: MAIL2925_INJECT,
        injectSource: MAIL2925_INJECT_SOURCE,
      };
    }

    function getErrorMessage(error) {
      return String(typeof error === 'string' ? error : error?.message || '');
    }

    function buildMail2925ThreadTerminatedError(message) {
      return new Error(`${MAIL2925_THREAD_TERMINATED_ERROR_PREFIX}${String(message || '').trim()}`);
    }

    async function stopAutoRunForMail2925LoginFailure(errorMessage = '') {
      if (typeof requestStop !== 'function') {
        return false;
      }

      const state = await getState();
      const autoRunning = typeof isAutoRunLockedState === 'function'
        ? isAutoRunLockedState(state)
        : Boolean(state?.autoRunning);
      if (!autoRunning) {
        return false;
      }

      await requestStop({
        logMessage: errorMessage || '2925 登录失败，已按手动停止逻辑暂停自动流程。',
      });
      return true;
    }

    function isMail2925LimitReachedError(error) {
      const message = getErrorMessage(error);
      return message.startsWith(MAIL2925_LIMIT_ERROR_PREFIX)
        || message.includes('子邮箱已达上限')
        || message.includes('已达上限邮箱');
    }

    function isMail2925ThreadTerminatedError(error) {
      return getErrorMessage(error).startsWith(MAIL2925_THREAD_TERMINATED_ERROR_PREFIX);
    }

    function isRetryableMail2925TransportError(error) {
      const message = getErrorMessage(error).toLowerCase();
      return message.includes('receiving end does not exist')
        || message.includes('message port closed')
        || message.includes('content script on')
        || message.includes('did not respond');
    }

    async function syncMail2925Accounts(accounts) {
      const normalized = normalizeMail2925Accounts(accounts);
      await setPersistentSettings({ mail2925Accounts: normalized });
      await setState({ mail2925Accounts: normalized });
      broadcastDataUpdate({ mail2925Accounts: normalized });
      return normalized;
    }

    async function upsertMail2925Account(input = {}) {
      const state = await getState();
      const accounts = normalizeMail2925Accounts(state.mail2925Accounts);
      const normalizedEmail = String(input?.email || '').trim().toLowerCase();
      const existing = input?.id
        ? findMail2925Account(accounts, input.id)
        : accounts.find((account) => account.email === normalizedEmail) || null;
      const credentialsChanged = !existing
        || (input?.email !== undefined && normalizedEmail !== existing.email)
        || (input?.password !== undefined && String(input.password || '') !== existing.password);
      const normalized = normalizeMail2925Account({
        ...(existing || {}),
        ...(credentialsChanged ? { lastError: '' } : {}),
        ...input,
        id: input?.id || existing?.id || crypto.randomUUID(),
      });

      const nextAccounts = existing
        ? accounts.map((account) => (account.id === normalized.id ? normalized : account))
        : [...accounts, normalized];

      await syncMail2925Accounts(nextAccounts);
      return normalized;
    }

    function getCurrentMail2925Account(state = {}) {
      return findMail2925Account(state.mail2925Accounts, state.currentMail2925AccountId) || null;
    }

    async function getMail2925CurrentTabUrl() {
      try {
        const state = await getState();
        const tabId = Number(state?.tabRegistry?.[MAIL2925_SOURCE]?.tabId || 0);
        if (!Number.isInteger(tabId) || tabId <= 0 || typeof chrome.tabs?.get !== 'function') {
          return '';
        }
        const tab = await chrome.tabs.get(tabId);
        return String(tab?.url || '').trim();
      } catch {
        return '';
      }
    }

    async function getMail2925TabUrlById(tabId) {
      try {
        if (!Number.isInteger(Number(tabId)) || Number(tabId) <= 0 || typeof chrome.tabs?.get !== 'function') {
          return '';
        }
        const tab = await chrome.tabs.get(Number(tabId));
        return String(tab?.url || '').trim();
      } catch {
        return '';
      }
    }

    function isMail2925LoginUrl(rawUrl = '') {
      try {
        const parsed = new URL(String(rawUrl || ''));
        return (parsed.hostname === '2925.com' || parsed.hostname === 'www.2925.com')
          && /^\/login\/?$/.test(parsed.pathname);
      } catch {
        return false;
      }
    }

    function normalizeMailboxEmail(value = '') {
      return String(value || '').trim().toLowerCase();
    }

    async function setCurrentMail2925Account(accountId, options = {}) {
      const { logMessage = '', updateLastUsedAt = false } = options;
      const state = await getState();
      const accounts = normalizeMail2925Accounts(state.mail2925Accounts);
      const account = findMail2925Account(accounts, accountId);
      if (!account) {
        throw new Error('未找到对应的 2925 账号。');
      }

      let nextAccount = account;
      if (updateLastUsedAt) {
        nextAccount = normalizeMail2925Account({
          ...account,
          lastUsedAt: Date.now(),
        });
        await syncMail2925Accounts(accounts.map((item) => (item.id === account.id ? nextAccount : item)));
      }

      await setPersistentSettings({ currentMail2925AccountId: nextAccount.id });
      await setState({ currentMail2925AccountId: nextAccount.id });
      broadcastDataUpdate({ currentMail2925AccountId: nextAccount.id });
      if (logMessage) {
        await addLog(logMessage, 'ok');
      }
      return nextAccount;
    }

    async function patchMail2925Account(accountId, updates = {}) {
      const state = await getState();
      const accounts = normalizeMail2925Accounts(state.mail2925Accounts);
      const account = findMail2925Account(accounts, accountId);
      if (!account) {
        throw new Error('未找到对应的 2925 账号。');
      }

      const nextAccount = normalizeMail2925Account({
        ...account,
        ...updates,
        id: account.id,
      });
      await syncMail2925Accounts(accounts.map((item) => (item.id === account.id ? nextAccount : item)));

      if (state.currentMail2925AccountId === account.id && nextAccount.enabled === false) {
        await setPersistentSettings({ currentMail2925AccountId: '' });
        await setState({ currentMail2925AccountId: null });
        broadcastDataUpdate({ currentMail2925AccountId: null });
      }

      return nextAccount;
    }

    async function deleteMail2925Account(accountId) {
      const state = await getState();
      const accounts = normalizeMail2925Accounts(state.mail2925Accounts);
      const nextAccounts = accounts.filter((account) => account.id !== accountId);
      await syncMail2925Accounts(nextAccounts);

      if (state.currentMail2925AccountId === accountId) {
        await setPersistentSettings({ currentMail2925AccountId: '' });
        await setState({ currentMail2925AccountId: null });
        broadcastDataUpdate({ currentMail2925AccountId: null });
      }
    }

    async function deleteMail2925Accounts(mode = 'all') {
      const state = await getState();
      const accounts = normalizeMail2925Accounts(state.mail2925Accounts);
      const nextAccounts = mode === 'all'
        ? []
        : accounts.filter((account) => getMail2925AccountStatus(account) !== String(mode || '').trim());
      const deletedCount = Math.max(0, accounts.length - nextAccounts.length);
      await syncMail2925Accounts(nextAccounts);

      if (state.currentMail2925AccountId && !findMail2925Account(nextAccounts, state.currentMail2925AccountId)) {
        await setPersistentSettings({ currentMail2925AccountId: '' });
        await setState({ currentMail2925AccountId: null });
        broadcastDataUpdate({ currentMail2925AccountId: null });
      }

      return {
        deletedCount,
        remainingCount: nextAccounts.length,
      };
    }

    async function ensureMail2925AccountForFlow(options = {}) {
      const {
        allowAllocate = true,
        preferredAccountId = null,
        excludeIds = [],
        markUsed = false,
      } = options;
      const state = await getState();
      const accounts = normalizeMail2925Accounts(state.mail2925Accounts);
      const now = Date.now();

      let account = null;
      if (preferredAccountId) {
        account = findMail2925Account(accounts, preferredAccountId);
      }
      if (!account && state.currentMail2925AccountId) {
        account = findMail2925Account(accounts, state.currentMail2925AccountId);
      }
      if ((!account || !isMail2925AccountAvailable(account, now)) && allowAllocate) {
        account = pickMail2925AccountForRun(accounts, {
          excludeIds,
          now,
        });
      }

      if (!account) {
        throw new Error('没有可用的 2925 账号。请先在侧边栏添加至少一个带密码的 2925 账号。');
      }
      if (!account.password) {
        throw new Error(`2925 账号 ${account.email || account.id} 缺少密码，无法自动登录。`);
      }
      if (!isMail2925AccountAvailable(account, now)) {
        const disabledUntil = Number(account.disabledUntil || 0);
        if (disabledUntil > now) {
          throw new Error(`2925 账号 ${account.email || account.id} 当前处于冷却期，将在 ${new Date(disabledUntil).toLocaleString('zh-CN', { hour12: false })} 后恢复。`);
        }
        throw new Error(`2925 账号 ${account.email || account.id} 当前不可用。`);
      }

      return setCurrentMail2925Account(account.id, { updateLastUsedAt: markUsed });
    }

    function normalizeCookieDomainForMatch(domain) {
      return String(domain || '').trim().replace(/^\.+/, '').toLowerCase();
    }

    function shouldClearMail2925Cookie(cookie) {
      const domain = normalizeCookieDomainForMatch(cookie?.domain);
      if (!domain) return false;
      return MAIL2925_COOKIE_DOMAINS.some((target) => (
        domain === target || domain.endsWith(`.${target}`)
      ));
    }

    function buildCookieRemovalUrl(cookie) {
      const host = normalizeCookieDomainForMatch(cookie?.domain);
      const path = String(cookie?.path || '/').startsWith('/')
        ? String(cookie?.path || '/')
        : `/${String(cookie?.path || '')}`;
      return `https://${host}${path}`;
    }

    async function collectMail2925Cookies() {
      if (!chrome.cookies?.getAll) {
        return [];
      }

      const stores = chrome.cookies.getAllCookieStores
        ? await chrome.cookies.getAllCookieStores()
        : [{ id: undefined }];
      const cookies = [];
      const seen = new Set();

      for (const store of stores) {
        const storeId = store?.id;
        const batch = await chrome.cookies.getAll(storeId ? { storeId } : {});
        for (const cookie of batch || []) {
          if (!shouldClearMail2925Cookie(cookie)) continue;
          const key = [
            cookie.storeId || storeId || '',
            cookie.domain || '',
            cookie.path || '',
            cookie.name || '',
            cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : '',
          ].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          cookies.push(cookie);
        }
      }

      return cookies;
    }

    async function removeMail2925Cookie(cookie) {
      const details = {
        url: buildCookieRemovalUrl(cookie),
        name: cookie.name,
      };

      if (cookie.storeId) {
        details.storeId = cookie.storeId;
      }
      if (cookie.partitionKey) {
        details.partitionKey = cookie.partitionKey;
      }

      try {
        return Boolean(await chrome.cookies.remove(details));
      } catch {
        return false;
      }
    }

    async function clearMail2925SessionCookies() {
      if (!chrome.cookies?.getAll || !chrome.cookies?.remove) {
        return 0;
      }

      const cookies = await collectMail2925Cookies();
      let removedCount = 0;
      for (const cookie of cookies) {
        throwIfStopped();
        if (await removeMail2925Cookie(cookie)) {
          removedCount += 1;
        }
      }

      if (chrome.browsingData?.removeCookies) {
        try {
          await chrome.browsingData.removeCookies({
            since: 0,
            origins: MAIL2925_COOKIE_ORIGINS,
          });
        } catch (_) {
          // Best effort cleanup only.
        }
      }

      return removedCount;
    }

    async function recoverMail2925LoginPageAfterTransportError(tabId) {
      const numericTabId = Number(tabId);
      if (!Number.isInteger(numericTabId) || numericTabId <= 0) {
        return;
      }

      const currentUrl = (await getMail2925TabUrlById(numericTabId)) || await getMail2925CurrentTabUrl();
      await addLog(
        `2925：登录提交后页面发生跳转或重载，正在等待当前标签页恢复后继续确认登录态。当前地址：${currentUrl || 'unknown'}`,
        'warn'
      );

      if (typeof waitForTabComplete === 'function') {
        const completedTab = await waitForTabComplete(numericTabId, {
          timeoutMs: MAIL2925_LOGIN_PAGE_RECOVERY_TIMEOUT_MS,
          retryDelayMs: 300,
        });
        await addLog(
          `2925：登录跳转等待结束，当前标签地址：${String(completedTab?.url || '').trim() || 'unknown'}`,
          completedTab?.url ? 'info' : 'warn'
        );
      }

      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(MAIL2925_SOURCE, numericTabId, {
          inject: MAIL2925_INJECT,
          injectSource: MAIL2925_INJECT_SOURCE,
          timeoutMs: MAIL2925_LOGIN_PAGE_RECOVERY_TIMEOUT_MS,
          retryDelayMs: 800,
          logMessage: '步骤 0：2925 登录后页面仍在跳转，正在等待邮箱页重新就绪...',
        });
      }

      const recoveredUrl = (await getMail2925TabUrlById(numericTabId)) || await getMail2925CurrentTabUrl();
      await addLog(`2925：登录跳转恢复后当前标签地址：${recoveredUrl || 'unknown'}`, 'info');
    }

    async function ensureMail2925MailboxSession(options = {}) {
      const {
        accountId = null,
        forceRelogin = false,
        actionLabel = '确保 2925 邮箱登录态',
        allowLoginWhenOnLoginPage = true,
        expectedMailboxEmail = '',
      } = options;

      const normalizedExpectedMailboxEmail = normalizeMailboxEmail(expectedMailboxEmail);

      let account = null;
      if (forceRelogin || (allowLoginWhenOnLoginPage && normalizedExpectedMailboxEmail)) {
        account = await ensureMail2925AccountForFlow({
          allowAllocate: true,
          preferredAccountId: accountId,
        });
      }

      const sendLoginMessage = typeof sendToContentScriptResilient === 'function'
        ? sendToContentScriptResilient
        : async (source, message, runtimeOptions = {}) => sendToMailContentScriptResilient(
          getMail2925MailConfig(),
          message,
          {
            timeoutMs: runtimeOptions.timeoutMs,
            responseTimeoutMs: runtimeOptions.responseTimeoutMs,
            maxRecoveryAttempts: 0,
          }
        );

      const buildSuccessPayload = () => ({
        account,
        mail: getMail2925MailConfig(),
        result: {
          loggedIn: true,
          currentView: 'mailbox',
          usedExistingSession: true,
        },
      });

      const failMailboxSession = async (message) => {
        const stopped = await stopAutoRunForMail2925LoginFailure(`${message}已按手动停止逻辑暂停自动流程。`);
        if (stopped) {
          throw new Error('流程已被用户停止。');
        }
        throw new Error(message);
      };

      if (forceRelogin) {
        const removedCount = await clearMail2925SessionCookies();
        await addLog(`2925：已清理 ${removedCount} 个登录相关 cookie，准备使用 ${account.email} 重新登录。`, 'info');
        if (typeof sleepWithStop === 'function') {
          await addLog('2925：清理 cookie 后等待 3 秒，再打开登录页...', 'info');
          await sleepWithStop(3000);
        }
      }

      throwIfStopped();
      const targetUrl = forceRelogin ? MAIL2925_LOGIN_URL : MAIL2925_URL;
      await addLog(
        forceRelogin
          ? `2925：准备打开登录页 ${MAIL2925_LOGIN_URL}（强制重登录）`
          : `2925：准备打开邮箱页 ${MAIL2925_URL}（登录页自动登录=${allowLoginWhenOnLoginPage ? '开启' : '关闭'}）`,
        'info'
      );
      const tabId = await reuseOrCreateTab(MAIL2925_SOURCE, targetUrl, {
        inject: MAIL2925_INJECT,
        injectSource: MAIL2925_INJECT_SOURCE,
      });

      let openedUrl = await getMail2925TabUrlById(tabId);
      if (!openedUrl) {
        openedUrl = await getMail2925CurrentTabUrl();
      }
      await addLog(`2925：打开页后当前标签地址：${openedUrl || 'unknown'}`, 'info');

      if (forceRelogin && typeof waitForTabUrlMatch === 'function') {
        const matchedLoginTab = await waitForTabUrlMatch(
          tabId,
          (url) => isMail2925LoginUrl(url),
          { timeoutMs: 15000, retryDelayMs: 300 }
        );
        await addLog(`2925：等待最终落到登录页结果：${matchedLoginTab?.url || '超时'}`, matchedLoginTab ? 'info' : 'warn');
        if (matchedLoginTab?.url) {
          openedUrl = String(matchedLoginTab.url || '').trim();
        }
      }

      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(MAIL2925_SOURCE, tabId, {
          inject: MAIL2925_INJECT,
          injectSource: MAIL2925_INJECT_SOURCE,
          timeoutMs: 20000,
          retryDelayMs: 800,
          logMessage: '步骤 0：2925 登录页内容脚本未就绪，正在等待页面稳定后继续登录...',
        });
      }

      if (!forceRelogin && !isMail2925LoginUrl(openedUrl) && !normalizedExpectedMailboxEmail) {
        await addLog('2925：当前邮箱页未跳转到登录页，将直接复用已登录会话。', 'info');
        return buildSuccessPayload();
      }

      if (!forceRelogin && isMail2925LoginUrl(openedUrl) && !allowLoginWhenOnLoginPage) {
        await failMailboxSession(`2925：${actionLabel}失败，当前页面已跳转到登录页，且当前未启用 2925 账号池，不执行自动登录。`);
      }

      if (!account && (forceRelogin || allowLoginWhenOnLoginPage)) {
        account = await ensureMail2925AccountForFlow({
          allowAllocate: true,
          preferredAccountId: accountId,
        });
      }

      if (forceRelogin && typeof sleepWithStop === 'function') {
        await addLog('2925：登录页已打开，等待 3 秒后开始检查输入框并执行登录...', 'info');
        await sleepWithStop(3000);
      }

      let result;
      const sendEnsureSessionRequest = async () => {
        const beforeSendUrl = (await getMail2925TabUrlById(tabId)) || await getMail2925CurrentTabUrl();
        await addLog(`2925：发送 ENSURE_MAIL2925_SESSION 前当前地址：${beforeSendUrl || 'unknown'}`, 'info');
        return sendLoginMessage(
          MAIL2925_SOURCE,
          {
            type: 'ENSURE_MAIL2925_SESSION',
            step: 0,
            source: 'background',
            payload: {
              email: account?.email || '',
              password: account?.password || '',
              forceLogin: forceRelogin,
              allowLoginWhenOnLoginPage,
            },
          },
          {
            timeoutMs: MAIL2925_LOGIN_MESSAGE_RETRY_WINDOW_MS,
            retryDelayMs: 800,
            responseTimeoutMs: MAIL2925_LOGIN_RESPONSE_TIMEOUT_MS,
            logMessage: '步骤 0：2925 登录页通信异常，正在等待页面恢复...',
          }
        );
      };
      try {
        result = await sendEnsureSessionRequest();
      } catch (err) {
        if (isRetryableMail2925TransportError(err)) {
          try {
            await recoverMail2925LoginPageAfterTransportError(tabId);
            await addLog('2925：页面恢复完成，正在重新确认登录态...', 'info');
            result = await sendEnsureSessionRequest();
          } catch (recoveryErr) {
            err = recoveryErr;
          }
        }

        if (!result) {
          const message = `2925：${actionLabel}失败（${getErrorMessage(err) || '登录结果确认超时'}）。`;
          const stopped = await stopAutoRunForMail2925LoginFailure(`${message}已按手动停止逻辑暂停自动流程。`);
          if (stopped) {
            throw new Error('流程已被用户停止。');
          }
          throw err;
        }
      }

      if (result?.error) {
        await failMailboxSession(`2925：${actionLabel}失败（${result.error}）。`);
      }
      if (result?.limitReached) {
        throw new Error(`${MAIL2925_LIMIT_ERROR_PREFIX}${result.limitMessage || '子邮箱已达上限邮箱'}`);
      }
      const actualMailboxEmail = normalizeMailboxEmail(result?.mailboxEmail || '');
      if (normalizedExpectedMailboxEmail && actualMailboxEmail && actualMailboxEmail !== normalizedExpectedMailboxEmail) {
        if (allowLoginWhenOnLoginPage) {
          await addLog(
            `2925：当前邮箱页显示账号 ${actualMailboxEmail}，与目标账号 ${normalizedExpectedMailboxEmail} 不一致，准备登出当前账号并登录目标账号。`,
            'warn'
          );
          return ensureMail2925MailboxSession({
            accountId: account?.id || accountId || null,
            forceRelogin: true,
            allowLoginWhenOnLoginPage: true,
            expectedMailboxEmail: normalizedExpectedMailboxEmail,
            actionLabel,
          });
        }
        await failMailboxSession(
          `2925：${actionLabel}失败，当前邮箱页显示账号 ${actualMailboxEmail}，与目标账号 ${normalizedExpectedMailboxEmail} 不一致，且当前未启用 2925 账号池。`
        );
      }
      if (normalizedExpectedMailboxEmail && !actualMailboxEmail && result?.currentView === 'mailbox') {
        await addLog('2925：未能识别当前邮箱页顶部邮箱地址，已跳过邮箱一致性校验。', 'warn');
      }
      if (!result?.loggedIn) {
        await failMailboxSession(`2925：${actionLabel}失败，登录后仍未进入收件箱。`);
      }

      if (!account) {
        await addLog('2925：未触发自动登录，继续复用当前已登录会话。', 'info');
        return {
          account: null,
          mail: getMail2925MailConfig(),
          result: {
            ...result,
            usedExistingSession: true,
          },
        };
      }

      await patchMail2925Account(account.id, {
        lastLoginAt: Date.now(),
        lastError: '',
      });
      await setState({ currentMail2925AccountId: account.id });
      broadcastDataUpdate({ currentMail2925AccountId: account.id });

      const finalUrl = (await getMail2925TabUrlById(tabId)) || await getMail2925CurrentTabUrl();
      await addLog(`2925：登录态确认成功，当前地址=${finalUrl || 'unknown'}`, 'ok');

      return {
        account: await ensureMail2925AccountForFlow({
          allowAllocate: false,
          preferredAccountId: account.id,
        }),
        mail: getMail2925MailConfig(),
        result,
      };
    }

    async function handleMail2925LimitReachedError(step, error) {
      const reason = getErrorMessage(error).replace(MAIL2925_LIMIT_ERROR_PREFIX, '').trim()
        || '子邮箱已达上限邮箱';
      const state = await getState();
      const currentAccount = getCurrentMail2925Account(state);
      const poolEnabled = Boolean(state?.mail2925UseAccountPool);

      if (!poolEnabled) {
        if (typeof requestStop === 'function') {
          await requestStop({
            logMessage: `步骤 ${step}：2925 检测到“${reason}”，当前未启用账号池，已按手动停止逻辑暂停自动流程。`,
          });
        }
        return new Error('流程已被用户停止。');
      }

      if (!currentAccount) {
        if (typeof requestStop === 'function') {
          await requestStop({
            logMessage: `步骤 ${step}：2925 检测到“${reason}”，但当前没有可识别的账号可供切换。`,
          });
        }
        return new Error('流程已被用户停止。');
      }

      const disabledUntil = Date.now() + Math.max(1, Number(MAIL2925_LIMIT_COOLDOWN_MS) || (24 * 60 * 60 * 1000));
      await patchMail2925Account(currentAccount.id, {
        lastLimitAt: Date.now(),
        disabledUntil,
        lastError: reason,
      });
      await addLog(
        `步骤 ${step}：2925 账号 ${currentAccount.email} 命中“${reason}”，已禁用到 ${new Date(disabledUntil).toLocaleString('zh-CN', { hour12: false })}。`,
        'warn'
      );

      const nextState = await getState();
      const nextAccounts = normalizeMail2925Accounts(nextState.mail2925Accounts);
      const nextAccount = pickMail2925AccountForRun(nextAccounts, {
        excludeIds: [currentAccount.id],
      });

      if (!nextAccount) {
        await setPersistentSettings({ currentMail2925AccountId: '' });
        await setState({ currentMail2925AccountId: null });
        broadcastDataUpdate({ currentMail2925AccountId: null });
        if (typeof requestStop === 'function') {
          await requestStop({
            logMessage: `步骤 ${step}：2925 账号 ${currentAccount.email} 命中“${reason}”，但当前没有可切换的下一个账号。`,
          });
        }
        return new Error('流程已被用户停止。');
      }

      await setCurrentMail2925Account(nextAccount.id);
      await ensureMail2925MailboxSession({
        accountId: nextAccount.id,
        forceRelogin: true,
        allowLoginWhenOnLoginPage: true,
        actionLabel: `步骤 ${step}：切换 2925 账号`,
      });
      await addLog(`步骤 ${step}：2925 已切换到下一个账号 ${nextAccount.email}。`, 'warn');
      return buildMail2925ThreadTerminatedError(
        `步骤 ${step}：2925 账号 ${currentAccount.email} 命中“${reason}”，已切换到 ${nextAccount.email}，当前尝试结束，等待下一轮重试。`
      );
    }

    return {
      MAIL2925_LIMIT_ERROR_PREFIX,
      MAIL2925_THREAD_TERMINATED_ERROR_PREFIX,
      clearMail2925SessionCookies,
      deleteMail2925Account,
      deleteMail2925Accounts,
      ensureMail2925AccountForFlow,
      ensureMail2925MailboxSession,
      getCurrentMail2925Account,
      getMail2925MailConfig,
      handleMail2925LimitReachedError,
      isMail2925LimitReachedError,
      isMail2925ThreadTerminatedError,
      patchMail2925Account,
      setCurrentMail2925Account,
      syncMail2925Accounts,
      upsertMail2925Account,
    };
  }

  return {
    createMail2925SessionManager,
  };
});
