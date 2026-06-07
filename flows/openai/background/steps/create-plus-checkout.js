(function attachBackgroundPlusCheckoutCreate(root, factory) {
  root.MultiPageBackgroundPlusCheckoutCreate = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusCheckoutCreateModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PAYPAL_SOURCE = 'paypal-flow';
  const PLUS_CHECKOUT_ENTRY_URL = 'https://chatgpt.com/';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/plus-checkout.js'];
  const PAYPAL_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/paypal-flow.js'];
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_PAYPAL_HOSTED = 'paypal-hosted';

  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const PLUS_PAYMENT_METHOD_AUTO = 'plus-auto';
  const DEFAULT_AUTO_BASE_URL = 'https://auto.1iiu.com';
  const AUTO_REDEEM_PATH = '/api/v1/redeem';
  const AUTO_REQUEST_TIMEOUT_MS = 30000;
  const LOCAL_CHECKOUT_PROXY_HEALTH_URL = 'http://127.0.0.1:21988/health';
  const LOCAL_CHECKOUT_PROXY_URL = 'socks5://127.0.0.1:21987';
  const LOCAL_CHECKOUT_PROXY_SETTINGS_SCOPE = 'regular';
  const LOCAL_CHECKOUT_PROXY_TIMEOUT_MS = 1200;
  const LOCAL_CHECKOUT_PROXY_SETTLE_MS = 350;
  const DEFAULT_GPC_BASE_URL = 'https://gpc.qlhazycoder.top';
  const GPC_PORTAL_URL = 'https://gpc.qlhazycoder.top/';
  const HOSTED_CHECKOUT_ADDRESS_ENDPOINT = 'https://www.meiguodizhi.com/api/v1/dz';
  const HOSTED_CHECKOUT_SUCCESS_URL_PATTERN = /^https:\/\/(?:chatgpt\.com|www\.chatgpt\.com|chat\.openai\.com)\/(?:backend-api\/)?payments\/success(?:[/?#]|$)/i;
  const HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS = 120000;
  const HOSTED_CHECKOUT_PAYPAL_TIMEOUT_MS = 10 * 60 * 1000;
  const HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS = 12;
  const HOSTED_CHECKOUT_VERIFICATION_POLL_INTERVAL_MS = 5000;
  const HOSTED_CHECKOUT_DEFAULT_PHONE = '1234567890';
  const PAYPAL_HOSTED_STAGE_OUTSIDE = 'outside_paypal';
  const PAYPAL_HOSTED_STAGE_LOGIN = 'pay_login';
  const PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT = 'guest_checkout';
  const PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT = 'create_account';
  const PAYPAL_HOSTED_STAGE_SECURITY_CODE = 'security_code';
  const PAYPAL_HOSTED_STAGE_REVIEW = 'review_consent';
  const PAYPAL_HOSTED_STAGE_APPROVAL = 'approval';
  const PAYPAL_HOSTED_STAGE_UNKNOWN = 'unknown';
  const PAYPAL_HOSTED_STEP_OPENAI_CHECKOUT = 'paypal-hosted-openai-checkout';
  const PAYPAL_HOSTED_STEP_EMAIL = 'paypal-hosted-email';
  const PAYPAL_HOSTED_STEP_CARD = 'paypal-hosted-card';
  const PAYPAL_HOSTED_STEP_CREATE_ACCOUNT = 'paypal-hosted-create-account';
  const PAYPAL_HOSTED_STEP_REVIEW = 'paypal-hosted-review';
  const PAYPAL_HOSTED_STEP_META = Object.freeze({
    [PAYPAL_HOSTED_STEP_OPENAI_CHECKOUT]: { step: 6, label: '创建 PayPal 无卡直绑 Checkout' },
    [PAYPAL_HOSTED_STEP_EMAIL]: { step: 7, label: '无卡直绑 PayPal 邮箱页' },
    [PAYPAL_HOSTED_STEP_CARD]: { step: 8, label: '无卡直绑 PayPal 资料页' },
    [PAYPAL_HOSTED_STEP_CREATE_ACCOUNT]: { step: 9, label: '无卡直绑 PayPal 创建确认页' },
    [PAYPAL_HOSTED_STEP_REVIEW]: { step: 10, label: '无卡直绑 PayPal 授权复核页' },
  });

  function createPlusCheckoutCreateExecutor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      chrome,
      completeNodeFromBackground,
      createAutomationTab = null,
      ensureContentScriptReadyOnTabUntilStopped,
      fetch: fetchImpl = null,
      getTabId = null,
      getState = null,
      isTabAlive = null,
      queryTabsInAutomationWindow = null,
      registerTab,
      sendTabMessageUntilStopped,
      setState,
      sleepWithStop,
      waitForTabCompleteUntilStopped,
      waitForTabUrlMatchUntilStopped = null,
      withCheckoutCreationProxy = null,
      throwIfStopped = () => {},
    } = deps;

    function addLog(message, level = 'info', options = {}) {
      return rawAddLog(message, level, {
        step: 6,
        stepKey: 'plus-checkout-create',
        ...(options && typeof options === 'object' ? options : {}),
      });
    }

    function addHostedStepLog(stepKey, message, level = 'info', options = {}) {
      const meta = PAYPAL_HOSTED_STEP_META[stepKey] || {};
      return rawAddLog(message, level, {
        step: meta.step || 6,
        stepKey,
        ...(options && typeof options === 'object' ? options : {}),
      });
    }

    function parseSocks5Endpoint(proxyUrl = '') {
      const text = String(proxyUrl || '').trim();
      if (!text) {
        return null;
      }
      let parsed = null;
      try {
        parsed = new URL(text);
      } catch {
        return null;
      }
      if (String(parsed.protocol || '').replace(/:$/, '').toLowerCase() !== 'socks5') {
        return null;
      }
      const host = String(parsed.hostname || '').replace(/^\[|\]$/g, '').trim();
      const port = Number.parseInt(String(parsed.port || ''), 10);
      if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
        return null;
      }
      return { host, port };
    }

    function buildCheckoutCreationPacScript(endpoint) {
      const proxyHost = String(endpoint?.host || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const port = Number.parseInt(String(endpoint?.port || ''), 10);
      return `
function FindProxyForURL(url, host) {
  host = String(host || '').toLowerCase();
  if (host === 'chatgpt.com' || dnsDomainIs(host, '.chatgpt.com')) {
    return "SOCKS5 ${proxyHost}:${port}";
  }
  return "DIRECT";
}`.trim();
    }

    function callChromeProxySettings(method, details = {}) {
      const proxySettings = chrome?.proxy?.settings;
      if (!proxySettings || typeof proxySettings[method] !== 'function') {
        return Promise.reject(new Error('当前浏览器不支持扩展代理 API'));
      }
      return new Promise((resolve, reject) => {
        proxySettings[method](details, (value) => {
          const lastError = chrome?.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message || String(lastError)));
            return;
          }
          resolve(value);
        });
      });
    }

    function canControlProxySettings(details = {}) {
      const level = String(details?.levelOfControl || '').trim();
      return !level || level === 'controlled_by_this_extension' || level === 'controllable_by_this_extension';
    }

    async function readProxySettingsSnapshot() {
      return callChromeProxySettings('get', { incognito: false });
    }

    async function restoreProxySettingsSnapshot(snapshot = null) {
      const value = snapshot?.value;
      const level = String(snapshot?.levelOfControl || '').trim();
      if (level === 'controlled_by_this_extension' && value && typeof value === 'object') {
        await callChromeProxySettings('set', {
          value,
          scope: LOCAL_CHECKOUT_PROXY_SETTINGS_SCOPE,
        });
        return;
      }
      await callChromeProxySettings('clear', {
        scope: LOCAL_CHECKOUT_PROXY_SETTINGS_SCOPE,
      });
    }

    async function fetchLocalCheckoutProxyHealth() {
      if (typeof fetchImpl !== 'function') {
        return null;
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer = null;
      try {
        timer = controller
          ? setTimeout(() => controller.abort(), LOCAL_CHECKOUT_PROXY_TIMEOUT_MS)
          : null;
        const response = await fetchImpl(`${LOCAL_CHECKOUT_PROXY_HEALTH_URL}?t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json,text/plain,*/*' },
          ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response?.ok) {
          return null;
        }
        const payload = await response.json().catch(() => ({}));
        if (!payload?.ok) {
          return null;
        }
        const endpoint = parseSocks5Endpoint(payload.localProxy || LOCAL_CHECKOUT_PROXY_URL);
        return endpoint ? { endpoint, payload } : null;
      } catch {
        return null;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    async function applyTemporaryCheckoutProxy(endpoint) {
      const pacScript = buildCheckoutCreationPacScript(endpoint);
      await callChromeProxySettings('set', {
        value: {
          mode: 'pac_script',
          pacScript: {
            data: pacScript,
            mandatory: true,
          },
        },
        scope: LOCAL_CHECKOUT_PROXY_SETTINGS_SCOPE,
      });
    }

    async function runWithLocalCheckoutCreationProxy(action) {
      if (typeof withCheckoutCreationProxy === 'function') {
        return withCheckoutCreationProxy({
          healthUrl: LOCAL_CHECKOUT_PROXY_HEALTH_URL,
          localProxyUrl: LOCAL_CHECKOUT_PROXY_URL,
        }, action);
      }
      if (!chrome?.proxy?.settings || typeof fetchImpl !== 'function') {
        return action();
      }

      const health = await fetchLocalCheckoutProxyHealth();
      if (!health?.endpoint) {
        return action();
      }

      let snapshot = null;
      let applied = false;
      let result = null;
      let proxyError = null;
      let restoreFailed = false;
      try {
        try {
          snapshot = await readProxySettingsSnapshot();
        } catch (error) {
          return action();
        }
        if (!canControlProxySettings(snapshot)) {
          return action();
        }
        await applyTemporaryCheckoutProxy(health.endpoint);
        applied = true;
        await sleepWithStop(LOCAL_CHECKOUT_PROXY_SETTLE_MS);
        result = await action();
        if (result?.error && !result?.stopped) {
          proxyError = new Error(result.error);
        }
      } catch (error) {
        if (!applied) {
          return action();
        }
        proxyError = error;
      } finally {
        if (applied) {
          try {
            await restoreProxySettingsSnapshot(snapshot);
            await sleepWithStop(LOCAL_CHECKOUT_PROXY_SETTLE_MS);
          } catch (error) {
            restoreFailed = true;
          }
        }
      }
      if (result && !proxyError) {
        return result;
      }
      if (proxyError) {
        if (restoreFailed) {
          throw proxyError;
        }
        return action();
      }
      return null;
    }

    function normalizePlusPaymentMethod(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GpcUtils?.normalizePlusPaymentMethod) {
        return rootScope.GpcUtils.normalizePlusPaymentMethod(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED || normalized === 'paypal_direct' || normalized === 'paypal-direct') {
        return PLUS_PAYMENT_METHOD_PAYPAL_HOSTED;
      }
      if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return PLUS_PAYMENT_METHOD_GPC_HELPER;
      }
      if (normalized === PLUS_PAYMENT_METHOD_AUTO || normalized === 'pix' || normalized === 'pix_plus' || normalized === 'pixplus') {
        return PLUS_PAYMENT_METHOD_AUTO;
      }
      return PLUS_PAYMENT_METHOD_PAYPAL;
    }

    function getCheckoutModeLabel(state = {}) {
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return 'GPC 订阅页';
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_AUTO) {
        return 'Plus 自动充值';
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
        return 'PayPal 无卡直绑';
      }
      return 'Plus Checkout';
    }

    function getPlusPaymentMethodLabel(method = PLUS_PAYMENT_METHOD_PAYPAL) {
      const paymentMethod = normalizePlusPaymentMethod(method);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return 'GPC';
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_AUTO) {
        return 'Plus 自动充值';
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
        return 'PayPal 无卡直绑';
      }
      return 'PayPal';
    }

    async function openFreshChatGptTabForCheckoutCreate(options = {}) {
      const active = options?.active !== false;
      const tab = typeof createAutomationTab === 'function'
        ? await createAutomationTab({ url: PLUS_CHECKOUT_ENTRY_URL, active })
        : await chrome.tabs.create({ url: PLUS_CHECKOUT_ENTRY_URL, active });
      const tabId = Number(tab?.id);
      if (!Number.isInteger(tabId)) {
        throw new Error('步骤 6：打开 ChatGPT 页面失败，无法创建订阅页。');
      }
      if (typeof registerTab === 'function') {
        await registerTab(PLUS_CHECKOUT_SOURCE, tabId);
      }
      return tabId;
    }

    function isPayPalUrl(url = '') {
      return /paypal\./i.test(String(url || ''));
    }

    function isHostedCheckoutSuccessUrl(url = '') {
      return HOSTED_CHECKOUT_SUCCESS_URL_PATTERN.test(String(url || ''));
    }

    function isHostedOpenAiCheckoutUrl(url = '') {
      return /^https:\/\/(?:pay\.openai\.com|checkout\.stripe\.com)\/c\/pay(?:\/|$)/i.test(String(url || ''));
    }

    function isHostedCheckoutRuntimeUrl(url = '') {
      return isHostedOpenAiCheckoutUrl(url) || isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url);
    }

    function getHostedStepNumber(stepKey = '') {
      return PAYPAL_HOSTED_STEP_META[stepKey]?.step || 6;
    }

    function normalizeHostedPhoneForPayload(phone = '') {
      const digits = String(phone || '').replace(/\D/g, '');
      if (!digits) {
        return HOSTED_CHECKOUT_DEFAULT_PHONE;
      }
      if (digits.length > 10 && digits.startsWith('1')) {
        return digits.slice(-10);
      }
      return digits.length > 10 ? digits.slice(-10) : digits;
    }

    function getHostedProfileFromState(state = {}) {
      const profile = state?.plusHostedCheckoutGuestProfile || state?.hostedCheckoutGuestProfile || null;
      return profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : null;
    }

    async function getLatestHostedState(state = {}) {
      const latestState = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
      return {
        ...(latestState && typeof latestState === 'object' ? latestState : {}),
        ...(state && typeof state === 'object' ? state : {}),
      };
    }

    async function ensureHostedGuestProfile(state = {}) {
      const mergedState = await getLatestHostedState(state);
      const existingProfile = getHostedProfileFromState(mergedState) || {};
      const config = await getHostedCheckoutRuntimeConfig(mergedState);
      const address = existingProfile.address && typeof existingProfile.address === 'object'
        ? existingProfile.address
        : await fetchHostedCheckoutAddress();
      const generatedProfile = buildHostedGuestProfile(address, {
        phone: normalizeHostedPhoneForPayload(config.phone),
      });
      const nextProfile = {
        ...generatedProfile,
        ...existingProfile,
        address,
        phone: normalizeHostedPhoneForPayload(config.phone || existingProfile.phone),
      };
      await setState({
        plusHostedCheckoutGuestProfile: nextProfile,
        plusHostedCheckoutPhoneDigits: nextProfile.phone,
      });
      return {
        profile: nextProfile,
        config,
      };
    }

    async function getTabById(tabId) {
      const normalizedTabId = Number(tabId) || 0;
      if (!normalizedTabId || !chrome?.tabs?.get) {
        return null;
      }
      return chrome.tabs.get(normalizedTabId).catch(() => null);
    }

    async function registerHostedCheckoutTab(tabId, url = '') {
      if (typeof registerTab !== 'function' || !Number.isInteger(Number(tabId))) {
        return;
      }
      await registerTab(isPayPalUrl(url) ? PAYPAL_SOURCE : PLUS_CHECKOUT_SOURCE, Number(tabId));
    }

    async function findOpenHostedCheckoutTabId() {
      const queryTabs = typeof queryTabsInAutomationWindow === 'function'
        ? queryTabsInAutomationWindow
        : (chrome?.tabs?.query ? (queryInfo) => chrome.tabs.query(queryInfo) : null);
      if (typeof queryTabs !== 'function') {
        return 0;
      }
      const tabs = await queryTabs({}).catch(() => []);
      const candidates = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => Number.isInteger(tab?.id) && isHostedCheckoutRuntimeUrl(tab.url || ''));
      if (!candidates.length) {
        return 0;
      }
      const match = candidates.find((tab) => tab.active && tab.currentWindow)
        || candidates.find((tab) => tab.active)
        || candidates[0];
      if (match?.id && chrome?.tabs?.update) {
        await chrome.tabs.update(match.id, { active: true }).catch(() => {});
      }
      await registerHostedCheckoutTab(match.id, match.url || '');
      return match?.id || 0;
    }

    async function resolveHostedCheckoutTabId(state = {}, stepKey = '') {
      const storedTabId = Number(state?.plusCheckoutTabId) || 0;
      const storedTab = await getTabById(storedTabId);
      if (storedTab?.id && isHostedCheckoutRuntimeUrl(storedTab.url || '')) {
        await registerHostedCheckoutTab(storedTab.id, storedTab.url || '');
        return storedTab.id;
      }

      if (typeof getTabId === 'function') {
        const paypalTabId = await Promise.resolve(getTabId(PAYPAL_SOURCE)).catch(() => 0);
        const paypalAlive = typeof isTabAlive !== 'function'
          ? Boolean(paypalTabId)
          : await Promise.resolve(isTabAlive(PAYPAL_SOURCE)).catch(() => false);
        if (paypalTabId && paypalAlive) {
          return paypalTabId;
        }
        const checkoutTabId = await Promise.resolve(getTabId(PLUS_CHECKOUT_SOURCE)).catch(() => 0);
        const checkoutAlive = typeof isTabAlive !== 'function'
          ? Boolean(checkoutTabId)
          : await Promise.resolve(isTabAlive(PLUS_CHECKOUT_SOURCE)).catch(() => false);
        if (checkoutTabId && checkoutAlive) {
          return checkoutTabId;
        }
      }

      const discoveredTabId = await findOpenHostedCheckoutTabId();
      if (discoveredTabId) {
        await addHostedStepLog(stepKey, `步骤 ${getHostedStepNumber(stepKey)}：已从当前浏览器标签中发现 PayPal 无卡直绑页面，正在接管继续执行。`, 'info');
        return discoveredTabId;
      }

      throw new Error(`步骤 ${getHostedStepNumber(stepKey)}：未找到 PayPal 无卡直绑标签页，请先完成创建 checkout 节点。`);
    }

    async function getHostedCurrentUrl(tabId) {
      const tab = await getTabById(tabId);
      return String(tab?.url || '').trim();
    }

    async function updateHostedCheckoutTabState(tabId, payload = {}) {
      const currentUrl = await getHostedCurrentUrl(tabId);
      await setState({
        plusCheckoutTabId: tabId,
        plusCheckoutUrl: currentUrl,
        ...(payload && typeof payload === 'object' ? payload : {}),
      });
      return currentUrl;
    }

    async function completeHostedStep(stepKey, tabId, payload = {}) {
      const currentUrl = await updateHostedCheckoutTabState(tabId, payload);
      await completeNodeFromBackground(stepKey, {
        plusCheckoutUrl: currentUrl,
        ...(payload && typeof payload === 'object' ? payload : {}),
      });
    }

    async function completeHostedStepIfSuccessful(stepKey, tabId, state = {}, options = {}) {
      const currentUrl = await getHostedCurrentUrl(tabId);
      if (!isHostedCheckoutSuccessUrl(currentUrl)) {
        return false;
      }
      const config = await getHostedCheckoutRuntimeConfig(state);
      const shouldWait = Boolean(options.waitBeforeComplete);
      if (shouldWait && config.oauthDelaySeconds > 0) {
        await addHostedStepLog(stepKey, `步骤 ${getHostedStepNumber(stepKey)}：支付成功后等待 ${config.oauthDelaySeconds} 秒，再继续账号接入。`, 'info');
        await sleepWithStop(config.oauthDelaySeconds * 1000);
      }
      await completeHostedStep(stepKey, tabId, {
        plusReturnUrl: currentUrl,
        plusHostedCheckoutCompleted: true,
        plusHostedCheckoutOauthDelaySeconds: config.oauthDelaySeconds,
      });
      return true;
    }

    async function waitForUrlMatch(tabId, matcher, timeoutMs = 30000, retryDelayMs = 500) {
      const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 30000);
      while (Date.now() < deadline) {
        throwIfStopped();
        const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
        if (!tab) {
          return null;
        }
        if (matcher(tab.url || '', tab)) {
          return tab;
        }
        await sleepWithStop(retryDelayMs);
      }
      return null;
    }

    async function getHostedCheckoutRuntimeConfig(state = {}) {
      const latestState = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
      return {
        verificationUrl: String(
          latestState?.hostedCheckoutVerificationUrl
          || state?.hostedCheckoutVerificationUrl
          || ''
        ).trim(),
        phone: String(
          latestState?.hostedCheckoutPhoneNumber
          || state?.hostedCheckoutPhoneNumber
          || HOSTED_CHECKOUT_DEFAULT_PHONE
        ).trim(),
        oauthDelaySeconds: normalizeHostedCheckoutDelaySeconds(
          latestState?.plusHostedCheckoutOauthDelaySeconds
          ?? state?.plusHostedCheckoutOauthDelaySeconds
        ),
      };
    }

    function normalizeHostedCheckoutDelaySeconds(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return 3;
      }
      return Math.min(120, Math.max(0, Math.floor(numeric)));
    }

    async function fetchHostedCheckoutAddress() {
      const { response, data } = await fetchJsonWithTimeout(HOSTED_CHECKOUT_ADDRESS_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: '/', method: 'address' }),
      }, 30000);
      if (!response?.ok) {
        throw new Error(`获取无卡直绑地址失败（HTTP ${response?.status || 0}）。`);
      }
      const address = data?.address || data || {};
      return {
        street: String(address.Address || address.street || '123 Main St').trim(),
        city: String(address.City || address.city || 'New York').trim(),
        state: String(address.State_Full || address.State || address.state || 'New York').trim(),
        zip: String(address.Zip_Code || address.zip || '10001').trim().slice(0, 5) || '10001',
      };
    }

    function buildRandomHostedEmail() {
      const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let localPart = '';
      for (let index = 0; index < 16; index += 1) {
        localPart += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return `${localPart}@gmail.com`;
    }

    function buildRandomHostedPassword() {
      const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^';
      let value = 'Aa1!';
      while (value.length < 14) {
        value += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      return value;
    }

    function buildHostedVisaCard() {
      const digits = [4, 1, 4, 7];
      while (digits.length < 15) {
        digits.push(Math.floor(Math.random() * 10));
      }
      const reversed = digits.slice().reverse();
      let sum = 0;
      for (let index = 0; index < reversed.length; index += 1) {
        let digit = reversed[index];
        if (index % 2 === 0) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      digits.push((10 - (sum % 10)) % 10);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
      const year = (new Date().getFullYear() % 100) + 3;
      return {
        number: digits.join(''),
        expiry: `${month} / ${year}`,
        cvv: String(Math.floor(100 + Math.random() * 900)),
      };
    }

    function buildHostedGuestProfile(address = {}, config = {}) {
      const card = buildHostedVisaCard();
      return {
        email: buildRandomHostedEmail(),
        password: buildRandomHostedPassword(),
        phone: String(config?.phone || HOSTED_CHECKOUT_DEFAULT_PHONE).trim(),
        firstName: 'James',
        lastName: 'Smith',
        cardNumber: card.number,
        cardExpiry: card.expiry,
        cardCvv: card.cvv,
        address,
      };
    }

    function extractHostedVerificationCode(payload = '') {
      const candidates = [payload?.data, payload?.code, payload?.text, payload?.message, payload];
      for (const candidate of candidates) {
        const text = typeof candidate === 'object' ? JSON.stringify(candidate) : String(candidate || '');
        const match = text.match(/\d{6}/);
        if (match) {
          return match[0];
        }
      }
      return '';
    }

    async function fetchHostedVerificationCode(verificationUrl = '') {
      const url = String(verificationUrl || '').trim();
      if (!url) {
        throw new Error('未配置 OpenAI Checkout 验证码接口。');
      }
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('当前运行环境不支持 fetch，无法获取 OpenAI Checkout 验证码。');
      }
      const separator = url.includes('?') ? '&' : '?';
      const response = await fetcher(`${url}${separator}t=${Date.now()}`, {
        method: 'GET',
        headers: { Accept: 'application/json,text/plain,*/*' },
      });
      const text = await response.text().catch(() => '');
      let payload = text;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = text;
      }
      const code = extractHostedVerificationCode(payload);
      if (!code) {
        throw new Error('验证码接口暂未返回有效 6 位验证码。');
      }
      return code;
    }

    async function pollHostedVerificationCode(verificationUrl = '') {
      let lastError = null;
      for (let attempt = 1; attempt <= HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS; attempt += 1) {
        throwIfStopped();
        try {
          const code = await fetchHostedVerificationCode(verificationUrl);
          await addLog(`步骤 6：已获取 OpenAI Checkout 验证码（${attempt}/${HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS}）。`, 'info');
          return code;
        } catch (error) {
          lastError = error;
          await addLog(`步骤 6：OpenAI Checkout 验证码暂不可用（${attempt}/${HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS}）：${error?.message || error}`, 'warn');
          if (attempt < HOSTED_CHECKOUT_VERIFICATION_POLL_ATTEMPTS) {
            await sleepWithStop(HOSTED_CHECKOUT_VERIFICATION_POLL_INTERVAL_MS);
          }
        }
      }
      throw lastError || new Error('OpenAI Checkout 验证码轮询失败。');
    }

    async function runHostedOpenAiCheckout(tabId, profile, config) {
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：正在等待 OpenAI hosted checkout 脚本就绪...',
      });
      const firstResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'RUN_PAYPAL_HOSTED_OPENAI_CHECKOUT_STEP',
        source: 'background',
        payload: { address: profile.address },
      });
      if (firstResult?.error) {
        throw new Error(firstResult.error);
      }

      const deadline = Date.now() + HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS;
      let verificationSubmitted = false;
      while (Date.now() < deadline) {
        throwIfStopped();
        const tab = await chrome?.tabs?.get?.(tabId).catch(() => null);
        if (!tab) {
          throw new Error('步骤 6：无卡直绑 checkout 标签页已关闭。');
        }
        const currentUrl = String(tab.url || '').trim();
        if (isPayPalUrl(currentUrl) || isHostedCheckoutSuccessUrl(currentUrl)) {
          return currentUrl;
        }
        await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
          inject: PLUS_CHECKOUT_INJECT_FILES,
          injectSource: PLUS_CHECKOUT_SOURCE,
        });
        const pageState = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
          type: 'PLUS_CHECKOUT_GET_STATE',
          source: 'background',
          payload: {},
        });
        if (pageState?.error) {
          throw new Error(pageState.error);
        }
        if (pageState?.hostedVerificationVisible && !verificationSubmitted) {
          const verificationCode = await pollHostedVerificationCode(config.verificationUrl);
          const verifyResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
            type: 'RUN_PAYPAL_HOSTED_OPENAI_CHECKOUT_STEP',
            source: 'background',
            payload: { verificationCode },
          });
          if (verifyResult?.error) {
            throw new Error(verifyResult.error);
          }
          verificationSubmitted = true;
        }
        await sleepWithStop(500);
      }
      throw new Error('步骤 6：OpenAI hosted checkout 长时间未跳转到 PayPal 或支付成功页。');
    }

    async function getHostedPayPalState(tabId) {
      await waitForTabCompleteUntilStopped(tabId);
      await ensureContentScriptReadyOnTabUntilStopped(PAYPAL_SOURCE, tabId, {
        inject: PAYPAL_INJECT_FILES,
        injectSource: PAYPAL_SOURCE,
        logMessage: '步骤 6：正在等待 PayPal 无卡直绑页面脚本就绪...',
      });
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_HOSTED_GET_STATE',
        source: 'background',
        payload: {},
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function runHostedPayPalStep(tabId, payload = {}) {
      await waitForTabCompleteUntilStopped(tabId);
      await ensureContentScriptReadyOnTabUntilStopped(PAYPAL_SOURCE, tabId, {
        inject: PAYPAL_INJECT_FILES,
        injectSource: PAYPAL_SOURCE,
        logMessage: '步骤 6：正在等待 PayPal 无卡直绑页面脚本就绪...',
      });
      const result = await sendTabMessageUntilStopped(tabId, PAYPAL_SOURCE, {
        type: 'PAYPAL_RUN_HOSTED_CHECKOUT_STEP',
        source: 'background',
        payload,
      });
      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function submitHostedPayPalSecurityCode(tabId, config = {}, stepKey = PAYPAL_HOSTED_STEP_CREATE_ACCOUNT) {
      const stepNumber = getHostedStepNumber(stepKey);
      const verificationCode = await pollHostedVerificationCode(config.verificationUrl);
      await addHostedStepLog(stepKey, `步骤 ${stepNumber}：已获取 PayPal 手机验证码，正在填写。`, 'info');
      return runHostedPayPalStep(tabId, {
        expectedStage: PAYPAL_HOSTED_STAGE_SECURITY_CODE,
        securityCode: verificationCode,
      });
    }

    function getHostedStageOrder(stage = '') {
      switch (stage) {
        case PAYPAL_HOSTED_STAGE_LOGIN:
          return 1;
        case PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT:
          return 2;
        case PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT:
          return 3;
        case PAYPAL_HOSTED_STAGE_SECURITY_CODE:
          return 3.5;
        case PAYPAL_HOSTED_STAGE_REVIEW:
          return 4;
        case PAYPAL_HOSTED_STAGE_OUTSIDE:
          return 5;
        default:
          return 0;
      }
    }

    function isHostedStageAtOrAfter(stage = '', expectedStage = '') {
      const currentOrder = getHostedStageOrder(stage);
      const expectedOrder = getHostedStageOrder(expectedStage);
      return currentOrder > 0 && expectedOrder > 0 && currentOrder >= expectedOrder;
    }

    async function waitForHostedPayPalStage(tabId, predicate, options = {}) {
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS);
      const intervalMs = Math.max(100, Number(options.intervalMs) || 500);
      const label = String(options.label || 'PayPal 无卡直绑页面').trim();
      const deadline = Date.now() + timeoutMs;
      let lastStage = '';
      while (Date.now() < deadline) {
        throwIfStopped();
        const currentUrl = await getHostedCurrentUrl(tabId);
        if (isHostedCheckoutSuccessUrl(currentUrl)) {
          return {
            successUrl: currentUrl,
            hostedStage: PAYPAL_HOSTED_STAGE_OUTSIDE,
          };
        }
        if (!isPayPalUrl(currentUrl)) {
          await sleepWithStop(intervalMs);
          continue;
        }
        try {
          const pageState = await getHostedPayPalState(tabId);
          lastStage = pageState?.hostedStage || lastStage;
          if (await predicate(pageState)) {
            return pageState;
          }
        } catch (error) {
          lastStage = error?.message || lastStage;
        }
        await sleepWithStop(intervalMs);
      }
      throw new Error(`${label}等待超时${lastStage ? `（最后状态：${lastStage}）` : ''}。`);
    }

    async function waitForHostedUrlAfterAction(tabId, matcher, options = {}) {
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS);
      const intervalMs = Math.max(100, Number(options.intervalMs) || 500);
      const label = String(options.label || 'PayPal 无卡直绑跳转').trim();
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        throwIfStopped();
        const currentTab = await getTabById(tabId);
        const currentUrl = String(currentTab?.url || '').trim();
        if (matcher(currentUrl, currentTab)) {
          await waitForTabCompleteUntilStopped(tabId).catch(() => {});
          return currentUrl;
        }
        await sleepWithStop(intervalMs);
      }
      throw new Error(`${label}等待超时。`);
    }

    async function runHostedPayPalStepAndWaitForStageChange(tabId, payload = {}, previousStage = '', options = {}) {
      const normalizedPreviousStage = String(previousStage || payload.expectedStage || '').trim();
      const label = String(options.label || 'PayPal 无卡直绑页面跳转').trim();
      const predicate = typeof options.predicate === 'function'
        ? options.predicate
        : (stateInfo) => stateInfo?.hostedStage && stateInfo.hostedStage !== normalizedPreviousStage;
      const stageChangePromise = waitForHostedPayPalStage(tabId, predicate, {
        label,
        timeoutMs: options.timeoutMs || HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS,
        intervalMs: options.intervalMs || 500,
      }).then(
        (nextState) => ({ type: 'stage-change', nextState }),
        (error) => ({ type: 'stage-error', error })
      );
      const actionPromise = runHostedPayPalStep(tabId, payload).then(
        (result) => ({ type: 'action', result }),
        (error) => ({ type: 'action-error', error })
      );

      const first = await Promise.race([actionPromise, stageChangePromise]);
      if (first.type === 'stage-change') {
        return {
          result: null,
          nextState: first.nextState,
          completedByStageChange: true,
        };
      }
      if (first.type === 'action-error') {
        throw first.error;
      }
      if (first.type === 'stage-error') {
        throw first.error;
      }

      const stageOutcome = await stageChangePromise;
      if (stageOutcome.type === 'stage-change') {
        return {
          result: first.result,
          nextState: stageOutcome.nextState,
          completedByStageChange: false,
        };
      }
      throw stageOutcome.error;
    }

    function resolveCheckoutTargetUrl(result = {}, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
        return String(
          result?.preferredCheckoutUrl
          || result?.hostedCheckoutUrl
          || result?.checkoutUrl
          || ''
        ).trim();
      }
      return String(result?.checkoutUrl || '').trim();
    }

    async function executeHostedCheckoutCreate(tabId, state = {}, result = {}) {
      const targetCheckoutUrl = resolveCheckoutTargetUrl(result, PLUS_PAYMENT_METHOD_PAYPAL_HOSTED);
      if (!targetCheckoutUrl) {
        throw new Error('步骤 6：PayPal 无卡直绑未返回可用的订阅链接。');
      }

      await addLog('步骤 6：PayPal 无卡直绑链接已创建，正在打开并提交 OpenAI Checkout 页面...', 'ok');
      await chrome.tabs.update(tabId, { url: targetCheckoutUrl, active: true });
      await waitForTabCompleteUntilStopped(tabId);

      const landedTab = await waitForUrlMatch(
        tabId,
        (url) => isHostedOpenAiCheckoutUrl(url) || isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url),
        HOSTED_CHECKOUT_TRANSITION_TIMEOUT_MS,
        500
      );
      const landedUrl = String(landedTab?.url || targetCheckoutUrl || '').trim();
      let completedUrl = landedUrl;

      if (isHostedOpenAiCheckoutUrl(completedUrl)) {
        const { profile, config } = await ensureHostedGuestProfile(state);
        await addLog(`步骤 6：正在提交 OpenAI Checkout，等待跳转到 PayPal 邮箱页（电话使用本地号码 ${profile.phone}）。`, 'info');
        completedUrl = String(await runHostedOpenAiCheckout(tabId, profile, config) || await getHostedCurrentUrl(tabId) || '').trim();
      }

      if (isPayPalUrl(completedUrl)) {
        await waitForTabCompleteUntilStopped(tabId).catch(() => {});
      }

      const isAlreadySuccessful = isHostedCheckoutSuccessUrl(completedUrl);
      await setState({
        plusCheckoutTabId: tabId,
        plusCheckoutUrl: completedUrl,
        plusCheckoutCountry: result.country || 'US',
        plusCheckoutCurrency: result.currency || 'USD',
        plusCheckoutSource: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
        plusReturnUrl: isAlreadySuccessful ? completedUrl : '',
        plusHostedCheckoutCompleted: isAlreadySuccessful,
      });

      await addLog(`步骤 6：PayPal 无卡直绑已提交 OpenAI Checkout（${result.country || 'US'} ${result.currency || 'USD'}），准备进入 PayPal 邮箱页。`, 'info');

      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutCountry: result.country || 'US',
        plusCheckoutCurrency: result.currency || 'USD',
        plusCheckoutSource: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
        plusCheckoutUrl: completedUrl,
        plusReturnUrl: isAlreadySuccessful ? completedUrl : '',
        plusHostedCheckoutCompleted: isAlreadySuccessful,
      });
    }

    async function executePayPalHostedOpenAiCheckout(state = {}) {
      const stepKey = PAYPAL_HOSTED_STEP_OPENAI_CHECKOUT;
      const stepNumber = getHostedStepNumber(stepKey);
      const tabId = await resolveHostedCheckoutTabId(state, stepKey);
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }

      let currentUrl = await getHostedCurrentUrl(tabId);
      if (isPayPalUrl(currentUrl)) {
        await addHostedStepLog(stepKey, `步骤 ${stepNumber}：当前已在 PayPal 页面，OpenAI Checkout 节点直接完成。`, 'info');
        await completeHostedStep(stepKey, tabId, {
          plusCheckoutSource: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
        });
        return;
      }
      if (!isHostedOpenAiCheckoutUrl(currentUrl)) {
        currentUrl = await waitForHostedUrlAfterAction(
          tabId,
          (url) => isHostedOpenAiCheckoutUrl(url) || isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url),
          { label: `步骤 ${stepNumber}：等待 OpenAI hosted checkout 页面` }
        );
      }
      if (isHostedCheckoutSuccessUrl(currentUrl)) {
        await completeHostedStep(stepKey, tabId, {
          plusReturnUrl: currentUrl,
          plusHostedCheckoutCompleted: true,
        });
        return;
      }
      if (isPayPalUrl(currentUrl)) {
        await completeHostedStep(stepKey, tabId, {
          plusCheckoutSource: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
        });
        return;
      }

      const { profile, config } = await ensureHostedGuestProfile(state);
      await addHostedStepLog(stepKey, `步骤 ${stepNumber}：正在选择 PayPal 并提交 OpenAI hosted checkout（电话使用本地号码 ${profile.phone}）。`, 'info');
      const transitionUrl = await runHostedOpenAiCheckout(tabId, profile, config);
      const completedUrl = String(transitionUrl || await getHostedCurrentUrl(tabId) || '').trim();
      await completeHostedStep(stepKey, tabId, {
        plusCheckoutSource: PLUS_PAYMENT_METHOD_PAYPAL_HOSTED,
        plusCheckoutUrl: completedUrl,
        plusReturnUrl: isHostedCheckoutSuccessUrl(completedUrl) ? completedUrl : '',
        plusHostedCheckoutCompleted: isHostedCheckoutSuccessUrl(completedUrl),
      });
    }

    async function executePayPalHostedEmail(state = {}) {
      const stepKey = PAYPAL_HOSTED_STEP_EMAIL;
      const stepNumber = getHostedStepNumber(stepKey);
      const tabId = await resolveHostedCheckoutTabId(state, stepKey);
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }
      const { profile } = await ensureHostedGuestProfile(state);
      await waitForHostedUrlAfterAction(
        tabId,
        (url) => isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url),
        { label: `步骤 ${stepNumber}：等待 PayPal 邮箱页` }
      );
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }

      const pageState = await getHostedPayPalState(tabId);
      if (isHostedStageAtOrAfter(pageState.hostedStage, PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT)
        && pageState.hostedStage !== PAYPAL_HOSTED_STAGE_LOGIN) {
        await addHostedStepLog(stepKey, `步骤 ${stepNumber}：当前 PayPal 已进入后续页面（${pageState.hostedStage}），邮箱节点直接完成。`, 'info');
        await completeHostedStep(stepKey, tabId, {
          plusHostedCheckoutLastStage: pageState.hostedStage,
        });
        return;
      }
      if (pageState.hostedStage !== PAYPAL_HOSTED_STAGE_LOGIN) {
        throw new Error(`步骤 ${stepNumber}：当前不是 PayPal 邮箱页（当前状态：${pageState.hostedStage || PAYPAL_HOSTED_STAGE_UNKNOWN}）。`);
      }

      await addHostedStepLog(stepKey, `步骤 ${stepNumber}：正在填写 PayPal 无卡直绑邮箱。`, 'info');
      const { nextState, completedByStageChange } = await runHostedPayPalStepAndWaitForStageChange(tabId, {
        expectedStage: PAYPAL_HOSTED_STAGE_LOGIN,
        email: profile.email,
      }, PAYPAL_HOSTED_STAGE_LOGIN, { label: `步骤 ${stepNumber}：等待 PayPal 邮箱页跳转` });
      if (completedByStageChange) {
        await addHostedStepLog(stepKey, `步骤 ${stepNumber}：已检测到 PayPal 进入后续页面（${nextState.hostedStage || PAYPAL_HOSTED_STAGE_UNKNOWN}），邮箱节点直接完成。`, 'info');
      }
      await completeHostedStep(stepKey, tabId, {
        plusHostedCheckoutLastStage: nextState.hostedStage || '',
      });
    }

    async function executePayPalHostedCard(state = {}) {
      const stepKey = PAYPAL_HOSTED_STEP_CARD;
      const stepNumber = getHostedStepNumber(stepKey);
      const tabId = await resolveHostedCheckoutTabId(state, stepKey);
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }
      await waitForHostedUrlAfterAction(
        tabId,
        (url) => isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url),
        { label: `步骤 ${stepNumber}：等待 PayPal 资料页` }
      );
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }

      const pageState = await getHostedPayPalState(tabId);
      if (isHostedStageAtOrAfter(pageState.hostedStage, PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT)
        && pageState.hostedStage !== PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT) {
        await addHostedStepLog(stepKey, `步骤 ${stepNumber}：当前 PayPal 已进入后续页面（${pageState.hostedStage}），资料节点直接完成。`, 'info');
        await completeHostedStep(stepKey, tabId, {
          plusHostedCheckoutLastStage: pageState.hostedStage,
        });
        return;
      }
      if (pageState.hostedStage !== PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT) {
        throw new Error(`步骤 ${stepNumber}：当前不是 PayPal 资料页（当前状态：${pageState.hostedStage || PAYPAL_HOSTED_STAGE_UNKNOWN}）。`);
      }

      const { profile } = await ensureHostedGuestProfile(state);
      await addHostedStepLog(stepKey, `步骤 ${stepNumber}：正在填写 PayPal 无卡直绑资料，提交前会复查电话是否为 ${profile.phone}。`, 'info');
      const cardResult = await runHostedPayPalStep(tabId, {
        ...profile,
        expectedStage: PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT,
        phone: profile.phone,
      });
      if (cardResult?.phoneMatched) {
        await addHostedStepLog(
          stepKey,
          `步骤 ${stepNumber}：PayPal 页面电话复查通过（配置 ${cardResult.payloadPhoneDigits}，页面 ${cardResult.renderedPhoneDigits}）。`,
          'info'
        );
      }
      const nextState = await waitForHostedPayPalStage(
        tabId,
        (stateInfo) => stateInfo?.hostedStage && stateInfo.hostedStage !== PAYPAL_HOSTED_STAGE_GUEST_CHECKOUT,
        { label: `步骤 ${stepNumber}：等待 PayPal 资料页跳转` }
      );
      await completeHostedStep(stepKey, tabId, {
        plusHostedCheckoutLastStage: nextState.hostedStage || '',
      });
    }

    async function executePayPalHostedCreateAccount(state = {}) {
      const stepKey = PAYPAL_HOSTED_STEP_CREATE_ACCOUNT;
      const stepNumber = getHostedStepNumber(stepKey);
      const tabId = await resolveHostedCheckoutTabId(state, stepKey);
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }
      await waitForHostedUrlAfterAction(
        tabId,
        (url) => isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url),
        { label: `步骤 ${stepNumber}：等待 PayPal 创建确认页` }
      );
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state)) {
        return;
      }

      const pageState = await getHostedPayPalState(tabId);
      const config = await getHostedCheckoutRuntimeConfig(state);
      if (pageState.hostedStage === PAYPAL_HOSTED_STAGE_SECURITY_CODE) {
        await submitHostedPayPalSecurityCode(tabId, config, stepKey);
        const nextState = await waitForHostedPayPalStage(
          tabId,
          (stateInfo) => stateInfo?.hostedStage && stateInfo.hostedStage !== PAYPAL_HOSTED_STAGE_SECURITY_CODE,
          { label: `步骤 ${stepNumber}：等待 PayPal 验证码提交后跳转` }
        );
        await completeHostedStep(stepKey, tabId, {
          plusHostedCheckoutLastStage: nextState.hostedStage || '',
        });
        return;
      }
      if (isHostedStageAtOrAfter(pageState.hostedStage, PAYPAL_HOSTED_STAGE_REVIEW)
        && pageState.hostedStage !== PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT) {
        await addHostedStepLog(stepKey, `步骤 ${stepNumber}：当前 PayPal 已进入后续页面（${pageState.hostedStage}），创建确认节点直接完成。`, 'info');
        await completeHostedStep(stepKey, tabId, {
          plusHostedCheckoutLastStage: pageState.hostedStage,
        });
        return;
      }
      if (pageState.hostedStage !== PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT) {
        throw new Error(`步骤 ${stepNumber}：当前不是 PayPal 创建确认页（当前状态：${pageState.hostedStage || PAYPAL_HOSTED_STAGE_UNKNOWN}）。`);
      }

      await addHostedStepLog(stepKey, `步骤 ${stepNumber}：正在确认创建 PayPal 账号。`, 'info');
      await runHostedPayPalStep(tabId, {
        expectedStage: PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT,
      });
      const nextState = await waitForHostedPayPalStage(
        tabId,
        async (stateInfo) => {
          if (stateInfo?.hostedStage === PAYPAL_HOSTED_STAGE_SECURITY_CODE) {
            await submitHostedPayPalSecurityCode(tabId, config, stepKey);
            return false;
          }
          return stateInfo?.hostedStage && stateInfo.hostedStage !== PAYPAL_HOSTED_STAGE_CREATE_ACCOUNT;
        },
        { label: `步骤 ${stepNumber}：等待 PayPal 创建确认页跳转` }
      );
      await completeHostedStep(stepKey, tabId, {
        plusHostedCheckoutLastStage: nextState.hostedStage || '',
      });
    }

    async function executePayPalHostedReview(state = {}) {
      const stepKey = PAYPAL_HOSTED_STEP_REVIEW;
      const stepNumber = getHostedStepNumber(stepKey);
      const tabId = await resolveHostedCheckoutTabId(state, stepKey);
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state, { waitBeforeComplete: true })) {
        return;
      }
      await waitForHostedUrlAfterAction(
        tabId,
        (url) => isPayPalUrl(url) || isHostedCheckoutSuccessUrl(url),
        { label: `步骤 ${stepNumber}：等待 PayPal 授权复核页` }
      );
      if (await completeHostedStepIfSuccessful(stepKey, tabId, state, { waitBeforeComplete: true })) {
        return;
      }

      const pageState = await getHostedPayPalState(tabId);
      if (pageState.hostedStage !== PAYPAL_HOSTED_STAGE_REVIEW) {
        throw new Error(`步骤 ${stepNumber}：当前不是 PayPal 授权复核页（当前状态：${pageState.hostedStage || PAYPAL_HOSTED_STAGE_UNKNOWN}）。`);
      }

      await addHostedStepLog(stepKey, `步骤 ${stepNumber}：正在确认 PayPal 授权复核页。`, 'info');
      await runHostedPayPalStep(tabId, {
        expectedStage: PAYPAL_HOSTED_STAGE_REVIEW,
      });
      await waitForHostedUrlAfterAction(
        tabId,
        (url) => isHostedCheckoutSuccessUrl(url),
        { label: `步骤 ${stepNumber}：等待 PayPal 回到 ChatGPT 支付成功页`, timeoutMs: HOSTED_CHECKOUT_PAYPAL_TIMEOUT_MS }
      );
      if (!await completeHostedStepIfSuccessful(stepKey, tabId, state, { waitBeforeComplete: true })) {
        throw new Error(`步骤 ${stepNumber}：PayPal 授权后未检测到 ChatGPT 支付成功页。`);
      }
    }

    function normalizeGpcBaseUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GpcUtils?.normalizeGpcBaseUrl) {
        return rootScope.GpcUtils.normalizeGpcBaseUrl(apiUrl);
      }
      let normalized = String(apiUrl || DEFAULT_GPC_BASE_URL).trim().replace(/\/+$/g, '');
      normalized = normalized.replace(/\/api\/checkout\/start$/i, '');
      normalized = normalized.replace(/\/api\/web\/card\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/balance(?:\?.*)?$/i, '');
      return normalized || DEFAULT_GPC_BASE_URL;
    }

    async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('当前运行环境不支持 fetch，无法调用远端接口。');
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const effectiveTimeoutMs = Math.max(1000, Number(timeoutMs) || 30000);
      let didTimeout = false;
      let timer = null;
      const buildTimeoutError = () => new Error(`远端接口请求超时（>${Math.round(effectiveTimeoutMs / 1000)} 秒）：${url}`);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          didTimeout = true;
          reject(buildTimeoutError());
          if (controller) {
            controller.abort();
          }
        }, effectiveTimeoutMs);
      });
      try {
        const response = await Promise.race([
          fetcher(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }),
          timeoutPromise,
        ]);
        const data = await Promise.race([
          response.json().catch(() => ({})),
          timeoutPromise,
        ]);
        return { response, data };
      } catch (error) {
        if (didTimeout || error?.name === 'AbortError') {
          throw buildTimeoutError();
        }
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function resolveGpcCardKey(state = {}) {
      const cardKey = String(state?.gpcCardKey || '').trim();
      if (!cardKey) {
        throw new Error('步骤 6：GPC 模式缺少卡密，请先在侧边栏填写 GPC 卡密。');
      }
      return cardKey;
    }

    function resolveGpcCardKeySegments(cardKey = '') {
      const text = String(cardKey || '').trim().toUpperCase();
      const compact = text.replace(/\s+/g, '');
      const rawSegments = compact.includes('-') || compact.includes('_')
        ? compact.split(/[-_]+/).filter(Boolean)
        : (compact.replace(/^GPC[-_]?/i, '').match(/.{1,8}/g) || []);
      const withoutPrefix = rawSegments[0] === 'GPC' ? rawSegments.slice(1) : rawSegments;
      const segments = withoutPrefix.slice(0, 3)
        .map((segment) => String(segment || '').replace(/[^A-Z0-9]/g, '').toUpperCase());
      if (segments.length !== 3 || segments.some((segment) => !/^[A-Z0-9]{8}$/.test(segment))) {
        throw new Error('步骤 6：GPC 卡密格式不正确，应为 GPC-XXXXXXXX-XXXXXXXX-XXXXXXXX。');
      }
      return segments;
    }

    function buildGpcPortalUrl(state = {}) {
      const baseUrl = normalizeGpcBaseUrl(state?.gpcBaseUrl || DEFAULT_GPC_BASE_URL)
        .replace(/\/+$/g, '');
      return `${baseUrl || DEFAULT_GPC_BASE_URL}/`;
    }

    function isGpcPortalUrl(url = '') {
      const text = String(url || '').trim();
      if (!text) {
        return false;
      }
      try {
        const parsed = new URL(text);
        return parsed.hostname === 'gpc.qlhazycoder.top';
      } catch {
        return /^https:\/\/gpc\.qlhazycoder\.top(?:\/|$)/i.test(text);
      }
    }

    async function findOpenGpcPortalTabId(portalUrl = GPC_PORTAL_URL) {
      const queryTabs = typeof queryTabsInAutomationWindow === 'function'
        ? queryTabsInAutomationWindow
        : (chrome?.tabs?.query ? (queryInfo) => chrome.tabs.query(queryInfo) : null);
      if (typeof queryTabs !== 'function') {
        return 0;
      }
      const tabs = await queryTabs({}).catch(() => []);
      const candidates = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => Number.isInteger(tab?.id) && isGpcPortalUrl(tab.url || ''));
      if (!candidates.length) {
        return 0;
      }
      const match = candidates.find((tab) => tab.active && tab.currentWindow)
        || candidates.find((tab) => tab.active)
        || candidates[0];
      if (match?.id && chrome?.tabs?.update) {
        await chrome.tabs.update(match.id, { url: portalUrl, active: true }).catch(() => (
          chrome.tabs.update(match.id, { active: true }).catch(() => {})
        ));
      }
      return match?.id || 0;
    }

    async function openOrReuseGpcPortalTab(state = {}) {
      const portalUrl = buildGpcPortalUrl(state);
      const storedTab = await getTabById(Number(state?.plusCheckoutTabId) || 0);
      if (storedTab?.id && isGpcPortalUrl(storedTab.url || '')) {
        if (chrome?.tabs?.update) {
          await chrome.tabs.update(storedTab.id, { url: portalUrl, active: true }).catch(() => (
            chrome.tabs.update(storedTab.id, { active: true }).catch(() => {})
          ));
        }
        if (typeof registerTab === 'function') {
          await registerTab(PLUS_CHECKOUT_SOURCE, storedTab.id);
        }
        return { tabId: storedTab.id, portalUrl };
      }

      const existingTabId = await findOpenGpcPortalTabId(portalUrl);
      if (existingTabId) {
        if (typeof registerTab === 'function') {
          await registerTab(PLUS_CHECKOUT_SOURCE, existingTabId);
        }
        return { tabId: existingTabId, portalUrl };
      }

      const tab = typeof createAutomationTab === 'function'
        ? await createAutomationTab({ url: portalUrl, active: true })
        : await chrome.tabs.create({ url: portalUrl, active: true });
      const tabId = Number(tab?.id);
      if (!Number.isInteger(tabId)) {
        throw new Error('步骤 6：打开 GPC 页面失败。');
      }
      if (typeof registerTab === 'function') {
        await registerTab(PLUS_CHECKOUT_SOURCE, tabId);
      }
      return { tabId, portalUrl };
    }

    async function readSessionFromChatGptSessionTab(tabId) {
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：正在等待 ChatGPT 页面完成加载，再继续获取 session...',
      });

      const sessionResult = await sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'PLUS_CHECKOUT_GET_STATE',
        source: 'background',
        payload: {
          includeSession: true,
          includeAccessToken: true,
        },
      });
      if (sessionResult?.error) {
        throw new Error(sessionResult.error);
      }
      const session = sessionResult?.session && typeof sessionResult.session === 'object'
        ? sessionResult.session
        : null;
      const accessToken = String(sessionResult?.accessToken || session?.accessToken || '').trim();
      if (!session || !accessToken) {
        throw new Error('步骤 6：GPC 模式获取 ChatGPT session 失败。');
      }
      return session;
    }

    async function prepareGpcCardKeyOnPortalPage(tabId, cardSegments = []) {
      if (!chrome?.scripting?.executeScript) {
        throw new Error('步骤 6：当前运行环境不支持脚本注入，无法填写 GPC 页面。');
      }
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(800);

      const ensureCardMode = async () => {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const textOf = (element) => String(element?.innerText || element?.textContent || element?.value || '').replace(/\s+/g, ' ').trim();
            const isVisible = (element) => {
              if (!element) return false;
              const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
              if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) {
                return false;
              }
              const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
              return !rect || rect.width > 0 || rect.height > 0;
            };
            const hasActiveMarker = (element) => {
              if (!element) return false;
              const markerText = [
                element.className,
                element.getAttribute?.('class'),
                element.getAttribute?.('aria-selected'),
                element.getAttribute?.('aria-pressed'),
                element.getAttribute?.('data-state'),
                element.getAttribute?.('data-active'),
              ].join(' ');
              return /\b(active|selected|current|checked|on|true)\b/i.test(markerText);
            };
            const modeSelector = 'button, [role="button"], .design-mode-card, .mode-card, [class*="mode-card"], [class*="recharge-card"], [class*="tab"], [class*="option"]';
            const findModeButton = (label, oppositeLabel) => {
              const directCandidates = Array.from(document.querySelectorAll(modeSelector));
              const allCandidates = directCandidates.length
                ? directCandidates
                : Array.from(document.querySelectorAll('body *'));
              const candidates = allCandidates
                .filter(isVisible)
                .map((element) => ({ element, text: textOf(element) }))
                .filter(({ text }) => text.includes(label) && !text.includes(oppositeLabel) && text.length <= 120)
                .sort((left, right) => left.text.length - right.text.length);
              const target = candidates[0]?.element || null;
              return target?.closest?.(modeSelector) || target;
            };
            const clickElement = (element) => {
              element.scrollIntoView?.({ block: 'center', inline: 'center' });
              element.focus?.();
              const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
              const centerTarget = rect && document.elementFromPoint
                ? document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2))
                : null;
              const target = centerTarget && element.contains?.(centerTarget) ? centerTarget : element;
              const fire = (type, EventCtor) => {
                try {
                  target.dispatchEvent?.(new EventCtor(type, { bubbles: true, cancelable: true, view: window }));
                } catch {
                  target.dispatchEvent?.(new Event(type, { bubbles: true, cancelable: true }));
                }
              };
              const pointerEventCtor = window.PointerEvent || window.MouseEvent || Event;
              const mouseEventCtor = window.MouseEvent || Event;
              fire('pointerdown', pointerEventCtor);
              fire('mousedown', mouseEventCtor);
              fire('pointerup', pointerEventCtor);
              fire('mouseup', mouseEventCtor);
              target.click?.();
            };
            const cardModeButton = findModeButton('卡密充值', '免费充值');
            const freeModeButton = findModeButton('免费充值', '卡密充值');
            const visibleCardInputs = Array.from(document.querySelectorAll('input.card-key-seg, input[placeholder*="XXXXXXXX"], input[maxlength="8"]'))
              .filter(isVisible);
            const isCardModeActive = Boolean(cardModeButton && hasActiveMarker(cardModeButton))
              || (visibleCardInputs.length > 0 && !(freeModeButton && hasActiveMarker(freeModeButton)));
            if (cardModeButton && !isCardModeActive) {
              clickElement(cardModeButton);
              return {
                hasCardMode: true,
                clickedCardMode: true,
                isCardModeActive: false,
                activeModeText: textOf(cardModeButton),
              };
            }
            return {
              hasCardMode: Boolean(cardModeButton),
              clickedCardMode: false,
              isCardModeActive,
              activeModeText: textOf(isCardModeActive ? cardModeButton : freeModeButton),
            };
          },
        });
        return results?.[0]?.result || {};
      };

      let modeResult = null;
      for (let attempt = 1; attempt <= 8; attempt += 1) {
        modeResult = await ensureCardMode();
        if (!modeResult.hasCardMode) {
          throw new Error('步骤 6：未找到 GPC“卡密充值”模式入口。');
        }
        if (modeResult.isCardModeActive) {
          break;
        }
        await sleepWithStop(modeResult.clickedCardMode ? 800 : 500);
      }
      if (!modeResult.hasCardMode) {
        throw new Error('步骤 6：未找到 GPC“卡密充值”模式入口。');
      }
      if (!modeResult.isCardModeActive) {
        throw new Error('步骤 6：GPC 页面切换到卡密充值模式超时。');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (rawCardSegments) => {
          const textOf = (element) => String(element?.innerText || element?.textContent || element?.value || '').replace(/\s+/g, ' ').trim();
          const isVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) {
              return false;
            }
            const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
            return !rect || rect.width > 0 || rect.height > 0;
          };
          const dispatchInput = (element, value) => {
            element.focus?.();
            element.value = value;
            element.dispatchEvent?.(new Event('input', { bubbles: true }));
            element.dispatchEvent?.(new Event('change', { bubbles: true }));
            element.blur?.();
          };
          const hasActiveMarker = (element) => {
            if (!element) return false;
            const markerText = [
              element.className,
              element.getAttribute?.('class'),
              element.getAttribute?.('aria-selected'),
              element.getAttribute?.('aria-pressed'),
              element.getAttribute?.('data-state'),
              element.getAttribute?.('data-active'),
            ].join(' ');
            return /\b(active|selected|current|checked|on|true)\b/i.test(markerText);
          };
          const modeButtons = Array.from(document.querySelectorAll('button, [role="button"], .design-mode-card, .mode-card'));
          const cardModeButton = modeButtons.find((element) => /卡密充值/.test(textOf(element)));
          const freeModeButton = modeButtons.find((element) => /免费充值/.test(textOf(element)));

          const cardSegments = Array.isArray(rawCardSegments)
            ? rawCardSegments.map((segment) => String(segment || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()).slice(0, 3)
            : [];
          const cardInputs = Array.from(document.querySelectorAll('input.card-key-seg, input[placeholder*="XXXXXXXX"], input[maxlength="8"]'))
            .filter(isVisible);
          const isCardModeActive = Boolean(cardModeButton && hasActiveMarker(cardModeButton))
            || (cardInputs.length > 0 && !(freeModeButton && hasActiveMarker(freeModeButton)));
          cardInputs.forEach((input, index) => {
            dispatchInput(input, cardSegments[index] || '');
          });
          let fallbackInput = null;
          if (!cardInputs.length) {
            fallbackInput = Array.from(document.querySelectorAll('input')).find((input) => /卡密|card/i.test([
              input.placeholder,
              input.name,
              input.id,
              input.className,
            ].join(' ')));
            if (fallbackInput) {
              dispatchInput(fallbackInput, `GPC-${cardSegments.join('-')}`);
            }
          }

          const startButton = Array.from(document.querySelectorAll('button, [role="button"]'))
            .find((button) => /开始\s*Plus\s*充值|任务进行中/.test(textOf(button)));
          const filledSegments = cardInputs.map((input) => String(input.value || '').replace(/\s+/g, '').toUpperCase());
          const cardKeyMatches = cardSegments.length === 3
            && cardInputs.length >= 3
            && cardSegments.every((segment, index) => filledSegments[index] === segment);
          return {
            ok: true,
            cardInputCount: cardInputs.length,
            cardFallbackFilled: Boolean(fallbackInput),
            cardSegments: cardSegments.map((segment) => segment ? segment.length : 0),
            cardKeyMatches,
            cardKeyValue: filledSegments.join('-') || String(fallbackInput?.value || ''),
            isCardModeActive,
            startButtonText: textOf(startButton),
            activeModeText: textOf(isCardModeActive ? cardModeButton : freeModeButton),
            url: location.href,
          };
        },
        args: [cardSegments],
      });
      const result = results?.[0]?.result || {};
      if (!result?.ok) {
        throw new Error('步骤 6：GPC 页面准备失败。');
      }
      if (!result.isCardModeActive || (!result.cardInputCount && !result.cardFallbackFilled)) {
        throw new Error('步骤 6：GPC 页面未进入卡密充值模式，无法填写卡密。');
      }
      if (result.cardInputCount >= 3 && !result.cardKeyMatches) {
        throw new Error(`步骤 6：GPC 卡密填写校验失败，当前页面为 ${result.cardKeyValue || '空'}。`);
      }
      return result;
    }

    async function fillGpcSessionOnPortalPage(tabId, sessionJson = '') {
      if (!chrome?.scripting?.executeScript) {
        throw new Error('步骤 6：当前运行环境不支持脚本注入，无法填写 GPC session。');
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (rawSessionJson) => {
          const dispatchInput = (element, value) => {
            element.focus?.();
            element.value = value;
            element.dispatchEvent?.(new Event('input', { bubbles: true }));
            element.dispatchEvent?.(new Event('change', { bubbles: true }));
            element.blur?.();
          };
          const sessionTextarea = Array.from(document.querySelectorAll('textarea')).find((textarea) => /session|accessToken|完整/i.test([
            textarea.placeholder,
            textarea.name,
            textarea.id,
            textarea.className,
          ].join(' '))) || document.querySelector('textarea.design-session-input') || document.querySelector('textarea');
          if (!sessionTextarea) {
            throw new Error('未找到 GPC session 输入框。');
          }
          dispatchInput(sessionTextarea, String(rawSessionJson || ''));
          return {
            ok: true,
            sessionLength: String(sessionTextarea.value || '').length,
          };
        },
        args: [sessionJson],
      });
      const result = results?.[0]?.result || {};
      if (!result?.ok) {
        throw new Error('步骤 6：GPC session 填写失败。');
      }
      return result;
    }

    async function executeGpcCheckoutCreate(state = {}) {
      const cardKey = resolveGpcCardKey(state);
      const cardSegments = resolveGpcCardKeySegments(cardKey);
      await addLog('步骤 6：正在打开 GPC 页面并准备卡密充值模式...', 'info');
      const { tabId, portalUrl } = await openOrReuseGpcPortalTab(state);
      await addLog('步骤 6：正在切换 GPC 卡密充值模式并校验卡密...', 'info');
      const prepared = await prepareGpcCardKeyOnPortalPage(tabId, cardSegments);
      await addLog('步骤 6：正在从 ChatGPT 获取完整 session...', 'info');
      const sessionTabId = await openFreshChatGptTabForCheckoutCreate({ active: false });
      if (chrome?.tabs?.update) {
        await chrome.tabs.update(tabId, { active: true }).catch(() => {});
      }
      let session = null;
      try {
        session = await readSessionFromChatGptSessionTab(sessionTabId);
      } finally {
        if (chrome?.tabs?.remove && Number.isInteger(sessionTabId)) {
          await chrome.tabs.remove(sessionTabId).catch(() => {});
        }
        if (chrome?.tabs?.update) {
          await chrome.tabs.update(tabId, { active: true }).catch(() => {});
        }
      }

      const sessionJson = JSON.stringify(session);
      if (chrome?.tabs?.update) {
        await chrome.tabs.update(tabId, { active: true }).catch(() => {});
      }
      await addLog('步骤 6：GPC 卡密已确认，正在填写 ChatGPT session...', 'info');
      const sessionFilled = await fillGpcSessionOnPortalPage(tabId, sessionJson);
      await setState({
        plusCheckoutTabId: tabId,
        plusCheckoutUrl: portalUrl,
        plusCheckoutCountry: 'US',
        plusCheckoutCurrency: 'USD',
        plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
        gpcPageStatus: 'prepared',
        gpcPageStatusText: '页面已准备',
      });
      await addLog(
        `步骤 6：GPC 页面已准备完成（卡密 ${prepared.cardInputCount || 0} 段，session ${sessionFilled.sessionLength || 0} 字符），准备继续下一步。`,
        'ok'
      );
      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutCountry: 'US',
        plusCheckoutCurrency: 'USD',
        plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
      });
    }

    function resolveAutoCdk(state = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      const cardKey = rootScope.GpcUtils?.normalizeAutoCdk
        ? rootScope.GpcUtils.normalizeAutoCdk(state?.autoCdk)
        : String(state?.autoCdk || '').trim();
      if (!cardKey) {
        throw new Error('步骤 6：Plus 自动充值模式缺少卡密，请先在侧边栏填写 Plus 自动充值卡密。');
      }
      return cardKey;
    }

    async function readSessionForAutoCheckout() {
      const sessionTabId = await openFreshChatGptTabForCheckoutCreate({ active: false });
      try {
        return await readSessionFromChatGptSessionTab(sessionTabId);
      } finally {
        if (chrome?.tabs?.remove && Number.isInteger(sessionTabId)) {
          await chrome.tabs.remove(sessionTabId).catch(() => {});
        }
      }
    }

    async function executeAutoCheckoutCreate(state = {}) {
      const cardKey = resolveAutoCdk(state);
      // Plus 自动充值接口地址固定使用内置端点，不接受用户自定义。
      const redeemUrl = `${DEFAULT_AUTO_BASE_URL}${AUTO_REDEEM_PATH}`;
      await addLog('发起 Plus 自动充值：正在从 ChatGPT 获取完整 session...', 'info');
      const session = await readSessionForAutoCheckout();
      const accessToken = String(session?.accessToken || '').trim();
      if (!session || !accessToken) {
        throw new Error('发起 Plus 自动充值：获取 ChatGPT session 失败。');
      }

      await addLog('发起 Plus 自动充值：正在调用充值接口提交订单（/api/v1/redeem）...', 'info');
      const { response, data } = await fetchJsonWithTimeout(redeemUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cdk: cardKey,
          access_token: JSON.stringify(session),
        }),
      }, AUTO_REQUEST_TIMEOUT_MS);

      if (!response?.ok) {
        const detail = String(data?.error || data?.message || data?.detail || `HTTP ${response?.status || 0}`).trim();
        throw new Error(`发起 Plus 自动充值失败：${detail}`);
      }
      const orderId = String(data?.order_id ?? data?.orderId ?? '').trim();
      if (!orderId) {
        throw new Error(`发起 Plus 自动充值返回不可用响应：${JSON.stringify(data || {})}`);
      }
      const jobId = String(data?.job_id ?? data?.jobId ?? '').trim();
      const orderState = String(data?.state || '').trim();
      const remaining = Number(data?.remaining);

      await setState({
        plusCheckoutSource: PLUS_PAYMENT_METHOD_AUTO,
        plusCheckoutCountry: 'US',
        plusCheckoutCurrency: 'USD',
        autoOrderId: orderId,
        autoJobId: jobId,
        autoOrderState: orderState || 'queued',
        autoPaymentStatus: '',
      });
      // 注意：此处仅代表订单已提交（通常为 queued/排队中），充值尚未完成；
      // 真正的成功判定在下一步「等待 Plus 自动充值完成」轮询订单状态后给出。
      await addLog(
        `发起 Plus 自动充值：订单已提交（order_id=${orderId}${jobId ? `, job_id=${jobId}` : ''}${orderState ? `, 状态=${orderState}` : ''}${Number.isFinite(remaining) ? `, 剩余次数=${remaining}` : ''}）。订单尚未完成，将在下一步轮询充值结果。`,
        'info'
      );
      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutSource: PLUS_PAYMENT_METHOD_AUTO,
        plusCheckoutCountry: 'US',
        plusCheckoutCurrency: 'USD',
        autoOrderId: orderId,
      });
    }

    async function executePlusCheckoutCreate(state = {}) {
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        await executeGpcCheckoutCreate(state);
        return;
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_AUTO) {
        await executeAutoCheckoutCreate(state);
        return;
      }

      const paymentMethodLabel = getPlusPaymentMethodLabel(paymentMethod);
      const checkoutModeLabel = getCheckoutModeLabel(state);
      await addLog(`步骤 6：正在打开新的 ChatGPT 会话，准备创建${checkoutModeLabel}...`, 'info');
      let tabId = 0;
      const createCheckout = async () => {
        tabId = await openFreshChatGptTabForCheckoutCreate();

      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：正在等待 ChatGPT 页面完成加载，再继续创建订阅页...',
      });

        return sendTabMessageUntilStopped(tabId, PLUS_CHECKOUT_SOURCE, {
        type: 'CREATE_PLUS_CHECKOUT',
        source: 'background',
        payload: { paymentMethod },
      });
      };
      const result = paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED
        ? await runWithLocalCheckoutCreationProxy(createCheckout)
        : await createCheckout();

      if (result?.error) {
        throw new Error(result.error);
      }
      const targetCheckoutUrl = resolveCheckoutTargetUrl(result, paymentMethod);
      if (!targetCheckoutUrl) {
        throw new Error(`步骤 6：${checkoutModeLabel}未返回可用的订阅链接。`);
      }

      if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
        await executeHostedCheckoutCreate(tabId, state, result);
        return;
      }

      await addLog(`步骤 6：${checkoutModeLabel}已创建，正在打开订阅页面...`, 'ok');
      await chrome.tabs.update(tabId, { url: targetCheckoutUrl, active: true });
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：正在等待订阅页面完成加载...',
      });

      await setState({
        plusCheckoutTabId: tabId,
        plusCheckoutUrl: targetCheckoutUrl,
        plusCheckoutCountry: result.country || 'DE',
        plusCheckoutCurrency: result.currency || 'EUR',
        plusCheckoutSource: '',
      });

      await addLog(`步骤 6：Plus Checkout 页面已就绪（${paymentMethodLabel} / ${result.country || 'DE'} ${result.currency || 'EUR'}），准备继续下一步。`, 'info');

      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutCountry: result.country || 'DE',
        plusCheckoutCurrency: result.currency || 'EUR',
      });
    }

    return {
      executePlusCheckoutCreate,
      executePayPalHostedOpenAiCheckout,
      executePayPalHostedEmail,
      executePayPalHostedCard,
      executePayPalHostedCreateAccount,
      executePayPalHostedReview,
    };
  }

  return {
    createPlusCheckoutCreateExecutor,
  };
});
