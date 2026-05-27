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
        label: '2925 Mail',
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
        logMessage: errorMessage || '2925 login failed; paused auto-run via manual-stop logic.',
      });
      return true;
    }

    function isMail2925LimitReachedError(error) {
      const message = getErrorMessage(error);
      return message.startsWith(MAIL2925_LIMIT_ERROR_PREFIX)
        || message.includes('子邮箱已达上限')
        || message.includes('已达上限邮箱')
        || message.includes('sub-mailbox limit reached')
        || message.includes('mailbox limit reached');
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
        throw new Error('Corresponding 2925 account not found.');
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
        throw new Error('Corresponding 2925 account not found.');
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
        throw new Error('No available 2925 account. Please add at least one 2925 account with password in the side panel first.');
      }
      if (!account.password) {
        throw new Error(`2925 account ${account.email || account.id} is missing password — cannot auto-login.`);
      }
      if (!isMail2925AccountAvailable(account, now)) {
        const disabledUntil = Number(account.disabledUntil || 0);
        if (disabledUntil > now) {
          throw new Error(`2925 account ${account.email || account.id} is currently in cooldown — will recover after ${new Date(disabledUntil).toLocaleString('zh-CN', { hour12: false })}.`);
        }
        throw new Error(`2925 account ${account.email || account.id} is currently unavailable.`);
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
        `2925: Login submission triggered navigation or reload — waiting for the current tab to recover before re-confirming session. Current URL: ${currentUrl || 'unknown'}`,
        'warn'
      );

      if (typeof waitForTabComplete === 'function') {
        const completedTab = await waitForTabComplete(numericTabId, {
          timeoutMs: MAIL2925_LOGIN_PAGE_RECOVERY_TIMEOUT_MS,
          retryDelayMs: 300,
        });
        await addLog(
          `2925: Login navigation wait ended, current tab URL: ${String(completedTab?.url || '').trim() || 'unknown'}`,
          completedTab?.url ? 'info' : 'warn'
        );
      }

      if (typeof ensureContentScriptReadyOnTab === 'function') {
        await ensureContentScriptReadyOnTab(MAIL2925_SOURCE, numericTabId, {
          inject: MAIL2925_INJECT,
          injectSource: MAIL2925_INJECT_SOURCE,
          timeoutMs: MAIL2925_LOGIN_PAGE_RECOVERY_TIMEOUT_MS,
          retryDelayMs: 800,
          logMessage: 'Step 0: 2925 page is still navigating after login — waiting for mailbox page to be ready again...',
        });
      }

      const recoveredUrl = (await getMail2925TabUrlById(numericTabId)) || await getMail2925CurrentTabUrl();
      await addLog(`2925: After login navigation recovery, current tab URL: ${recoveredUrl || 'unknown'}`, 'info');
    }

    async function ensureMail2925MailboxSession(options = {}) {
      const {
        accountId = null,
        forceRelogin = false,
        actionLabel = 'Ensure 2925 mailbox session',
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
        const stopped = await stopAutoRunForMail2925LoginFailure(`${message} Paused auto-run via manual-stop logic.`);
        if (stopped) {
          throw new Error('Flow stopped by user.');
        }
        throw new Error(message);
      };

      if (forceRelogin) {
        const removedCount = await clearMail2925SessionCookies();
        await addLog(`2925: Cleared ${removedCount} login-related cookies, preparing to login with ${account.email}.`, 'info');
        if (typeof sleepWithStop === 'function') {
          await addLog('2925: Waiting 3 seconds after cookie cleanup before opening login page...', 'info');
          await sleepWithStop(3000);
        }
      }

      throwIfStopped();
      const targetUrl = forceRelogin ? MAIL2925_LOGIN_URL : MAIL2925_URL;
      await addLog(
        forceRelogin
          ? `2925: Preparing to open login page ${MAIL2925_LOGIN_URL} (force relogin)`
          : `2925: Preparing to open mailbox page ${MAIL2925_URL} (auto-login on login page = ${allowLoginWhenOnLoginPage ? 'enabled' : 'disabled'})`,
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
      await addLog(`2925: After opening, current tab URL: ${openedUrl || 'unknown'}`, 'info');

      if (forceRelogin && typeof waitForTabUrlMatch === 'function') {
        const matchedLoginTab = await waitForTabUrlMatch(
          tabId,
          (url) => isMail2925LoginUrl(url),
          { timeoutMs: 15000, retryDelayMs: 300 }
        );
        await addLog(`2925: Wait for login page result: ${matchedLoginTab?.url || 'timeout'}`, matchedLoginTab ? 'info' : 'warn');
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
          logMessage: 'Step 0: 2925 login page content script not ready — waiting for page to stabilize before continuing login...',
        });
      }

      if (!forceRelogin && !isMail2925LoginUrl(openedUrl) && !normalizedExpectedMailboxEmail) {
        await addLog('2925: Current mailbox page did not navigate to login page — reusing existing session.', 'info');
        return buildSuccessPayload();
      }

      if (!forceRelogin && isMail2925LoginUrl(openedUrl) && !allowLoginWhenOnLoginPage) {
        await failMailboxSession(`2925: ${actionLabel} failed — current page has navigated to login page, but 2925 account pool is not enabled, so auto-login will not run.`);
      }

      if (!account && (forceRelogin || allowLoginWhenOnLoginPage)) {
        account = await ensureMail2925AccountForFlow({
          allowAllocate: true,
          preferredAccountId: accountId,
        });
      }

      if (forceRelogin && typeof sleepWithStop === 'function') {
        await addLog('2925: Login page opened — waiting 3 seconds before checking inputs and executing login...', 'info');
        await sleepWithStop(3000);
      }

      let result;
      const sendEnsureSessionRequest = async () => {
        const beforeSendUrl = (await getMail2925TabUrlById(tabId)) || await getMail2925CurrentTabUrl();
        await addLog(`2925: URL before sending ENSURE_MAIL2925_SESSION: ${beforeSendUrl || 'unknown'}`, 'info');
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
            logMessage: 'Step 0: 2925 login page communication anomaly — waiting for page recovery...',
          }
        );
      };
      try {
        result = await sendEnsureSessionRequest();
      } catch (err) {
        if (isRetryableMail2925TransportError(err)) {
          try {
            await recoverMail2925LoginPageAfterTransportError(tabId);
            await addLog('2925: Page recovery complete — re-confirming login state...', 'info');
            result = await sendEnsureSessionRequest();
          } catch (recoveryErr) {
            err = recoveryErr;
          }
        }

        if (!result) {
          const message = `2925: ${actionLabel} failed (${getErrorMessage(err) || 'login result confirmation timed out'}).`;
          const stopped = await stopAutoRunForMail2925LoginFailure(`${message} Paused auto-run via manual-stop logic.`);
          if (stopped) {
            throw new Error('Flow stopped by user.');
          }
          throw err;
        }
      }

      if (result?.error) {
        await failMailboxSession(`2925: ${actionLabel} failed (${result.error}).`);
      }
      if (result?.limitReached) {
        throw new Error(`${MAIL2925_LIMIT_ERROR_PREFIX}${result.limitMessage || 'Sub-mailbox limit reached.'}`);
      }
      const actualMailboxEmail = normalizeMailboxEmail(result?.mailboxEmail || '');
      if (normalizedExpectedMailboxEmail && actualMailboxEmail && actualMailboxEmail !== normalizedExpectedMailboxEmail) {
        if (allowLoginWhenOnLoginPage) {
          await addLog(
            `2925: Current mailbox page shows account ${actualMailboxEmail}, which does not match target account ${normalizedExpectedMailboxEmail}. Preparing to log out current account and log in target account.`,
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
          `2925: ${actionLabel} failed — current mailbox page shows account ${actualMailboxEmail}, which does not match target account ${normalizedExpectedMailboxEmail}, and 2925 account pool is not enabled.`
        );
      }
      if (normalizedExpectedMailboxEmail && !actualMailboxEmail && result?.currentView === 'mailbox') {
        await addLog('2925: Could not detect current mailbox email at top of page — skipped email consistency check.', 'warn');
      }
      if (!result?.loggedIn) {
        await failMailboxSession(`2925: ${actionLabel} failed — did not enter inbox after login.`);
      }

      if (!account) {
        await addLog('2925: Auto-login not triggered — reusing existing logged-in session.', 'info');
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
      await addLog(`2925: Login state confirmed, current URL=${finalUrl || 'unknown'}`, 'ok');

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
        || 'Sub-mailbox limit reached.';
      const state = await getState();
      const currentAccount = getCurrentMail2925Account(state);
      const poolEnabled = Boolean(state?.mail2925UseAccountPool);

      if (!poolEnabled) {
        if (typeof requestStop === 'function') {
          await requestStop({
            logMessage: `Step ${step}: 2925 detected "${reason}", account pool not enabled — paused auto-run via manual-stop logic.`,
          });
        }
        return new Error('Flow stopped by user.');
      }

      if (!currentAccount) {
        if (typeof requestStop === 'function') {
          await requestStop({
            logMessage: `Step ${step}: 2925 detected "${reason}", but no identifiable account is available to switch.`,
          });
        }
        return new Error('Flow stopped by user.');
      }

      const disabledUntil = Date.now() + Math.max(1, Number(MAIL2925_LIMIT_COOLDOWN_MS) || (24 * 60 * 60 * 1000));
      await patchMail2925Account(currentAccount.id, {
        lastLimitAt: Date.now(),
        disabledUntil,
        lastError: reason,
      });
      await addLog(
        `Step ${step}: 2925 account ${currentAccount.email} hit "${reason}", disabled until ${new Date(disabledUntil).toLocaleString('zh-CN', { hour12: false })}.`,
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
            logMessage: `Step ${step}: 2925 account ${currentAccount.email} hit "${reason}", and there is no next account available to switch.`,
          });
        }
        return new Error('Flow stopped by user.');
      }

      await setCurrentMail2925Account(nextAccount.id);
      await ensureMail2925MailboxSession({
        accountId: nextAccount.id,
        forceRelogin: true,
        allowLoginWhenOnLoginPage: true,
        actionLabel: `Step ${step}: Switch 2925 account`,
      });
      await addLog(`Step ${step}: 2925 switched to next account ${nextAccount.email}.`, 'warn');
      return buildMail2925ThreadTerminatedError(
        `Step ${step}: 2925 account ${currentAccount.email} hit "${reason}", switched to ${nextAccount.email}. Current attempt ended, waiting for next retry.`
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
