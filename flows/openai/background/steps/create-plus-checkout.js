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
  const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const LOCAL_CHECKOUT_PROXY_HEALTH_URL = 'http://127.0.0.1:21988/health';
  const LOCAL_CHECKOUT_PROXY_URL = 'socks5://127.0.0.1:21987';
  const LOCAL_CHECKOUT_PROXY_SETTINGS_SCOPE = 'regular';
  const LOCAL_CHECKOUT_PROXY_TIMEOUT_MS = 1200;
  const LOCAL_CHECKOUT_PROXY_SETTLE_MS = 350;
  const DEFAULT_GPC_HELPER_API_URL = 'https://gpc.qlhazycoder.top';
  const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
  const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
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
      if (rootScope.GoPayUtils?.normalizePlusPaymentMethod) {
        return rootScope.GoPayUtils.normalizePlusPaymentMethod(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED || normalized === 'paypal_direct' || normalized === 'paypal-direct') {
        return PLUS_PAYMENT_METHOD_PAYPAL_HOSTED;
      }
      if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return PLUS_PAYMENT_METHOD_GPC_HELPER;
      }
      return normalized === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_PAYMENT_METHOD_GOPAY : PLUS_PAYMENT_METHOD_PAYPAL;
    }

    function getCheckoutModeLabel(state = {}) {
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return 'GPC 订阅页';
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
        return 'PayPal 无卡直绑';
      }
      return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? 'GoPay 订阅页' : 'Plus Checkout';
    }

    function getPlusPaymentMethodLabel(method = PLUS_PAYMENT_METHOD_PAYPAL) {
      const paymentMethod = normalizePlusPaymentMethod(method);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return 'GPC';
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_PAYPAL_HOSTED) {
        return 'PayPal 无卡直绑';
      }
      return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? 'GoPay' : 'PayPal';
    }

    async function openFreshChatGptTabForCheckoutCreate() {
      const tab = typeof createAutomationTab === 'function'
        ? await createAutomationTab({ url: PLUS_CHECKOUT_ENTRY_URL, active: true })
        : await chrome.tabs.create({ url: PLUS_CHECKOUT_ENTRY_URL, active: true });
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

    function normalizeHelperCountryCode(countryCode = '86') {
      const digits = String(countryCode || '').replace(/\D/g, '');
      return digits || '86';
    }

    function normalizeHelperPhoneNumber(phone = '', countryCode = '86') {
      const cleaned = String(phone || '').replace(/\D/g, '');
      const countryDigits = normalizeHelperCountryCode(countryCode);
      if (countryDigits && cleaned.startsWith(countryDigits) && cleaned.length > countryDigits.length) {
        return cleaned.slice(countryDigits.length);
      }
      return cleaned;
    }

    function normalizeGpcHelperPhoneMode(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcHelperPhoneMode) {
        return rootScope.GoPayUtils.normalizeGpcHelperPhoneMode(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === GPC_HELPER_PHONE_MODE_AUTO || normalized === 'builtin'
        ? GPC_HELPER_PHONE_MODE_AUTO
        : GPC_HELPER_PHONE_MODE_MANUAL;
    }

    function normalizeGpcOtpChannel(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcOtpChannel) {
        return rootScope.GoPayUtils.normalizeGpcOtpChannel(value);
      }
      return String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
    }

    function resolveGpcHelperApiKey(state = {}) {
      const apiKey = String(
        state?.gopayHelperApiKey
        || state?.gpcApiKey
        || state?.apiKey
        || ''
      ).trim();
      if (!apiKey) {
        throw new Error('创建 GPC 订单失败：缺少 API Key。');
      }
      return apiKey;
    }

    function normalizeGpcHelperBaseUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcHelperBaseUrl) {
        return rootScope.GoPayUtils.normalizeGpcHelperBaseUrl(apiUrl);
      }
      let normalized = String(apiUrl || DEFAULT_GPC_HELPER_API_URL).trim().replace(/\/+$/g, '');
      normalized = normalized.replace(/\/api\/checkout\/start$/i, '');
      normalized = normalized.replace(/\/api\/gopay\/(?:otp|pin)$/i, '');
      normalized = normalized.replace(/\/api\/gp\/tasks(?:\/[^/?#]+)?(?:\/(?:otp|pin|stop))?(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/gp\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/redeem-api-key(?:\?.*)?$/i, '');
      return normalized || DEFAULT_GPC_HELPER_API_URL;
    }

    function buildGpcHelperApiUrl(apiUrl = '', path = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcHelperApiUrl) {
        return rootScope.GoPayUtils.buildGpcHelperApiUrl(apiUrl, path);
      }
      const baseUrl = normalizeGpcHelperBaseUrl(apiUrl);
      if (!baseUrl) {
        return '';
      }
      const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
      return `${baseUrl}${normalizedPath}`;
    }

    function buildGpcTaskCreateUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcTaskCreateUrl) {
        return rootScope.GoPayUtils.buildGpcTaskCreateUrl(apiUrl);
      }
      return buildGpcHelperApiUrl(apiUrl, '/api/gp/tasks');
    }

    function buildGpcBalanceUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcApiKeyBalanceUrl) {
        return rootScope.GoPayUtils.buildGpcApiKeyBalanceUrl(apiUrl);
      }
      if (rootScope.GoPayUtils?.buildGpcCardBalanceUrl) {
        return rootScope.GoPayUtils.buildGpcCardBalanceUrl(apiUrl);
      }
      return buildGpcHelperApiUrl(apiUrl, '/api/gp/balance');
    }

    function unwrapGpcResponse(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.unwrapGpcResponse) {
        return rootScope.GoPayUtils.unwrapGpcResponse(payload);
      }
      if (payload && typeof payload === 'object' && !Array.isArray(payload)
        && Object.prototype.hasOwnProperty.call(payload, 'data')
        && (Object.prototype.hasOwnProperty.call(payload, 'code') || Object.prototype.hasOwnProperty.call(payload, 'message'))) {
        return payload.data ?? {};
      }
      return payload;
    }

    function isGpcUnifiedResponseOk(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.isGpcUnifiedResponseOk) {
        return rootScope.GoPayUtils.isGpcUnifiedResponseOk(payload);
      }
      if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'code')) {
        return true;
      }
      const code = Number(payload.code);
      return Number.isFinite(code) ? code >= 200 && code < 300 : String(payload.code || '').trim() === '200';
    }

    function getGpcResponseErrorDetail(payload = {}, status = 0) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.extractGpcResponseErrorDetail) {
        return rootScope.GoPayUtils.extractGpcResponseErrorDetail(payload, status);
      }
      return payload?.data?.detail || payload?.detail || payload?.message || payload?.error || `HTTP ${status || 0}`;
    }

    function getGpcRemainingUses(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.getGpcBalanceRemainingUses) {
        return rootScope.GoPayUtils.getGpcBalanceRemainingUses(payload);
      }
      const data = unwrapGpcResponse(payload);
      const numeric = Number(data?.remaining_uses ?? data?.remainingUses ?? data?.balance ?? data?.remaining);
      return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : null;
    }

    function normalizeGpcAutoModePermissionValue(value) {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
      }
      const normalized = String(value ?? '').trim().toLowerCase();
      if (!normalized) {
        return null;
      }
      if (['true', '1', 'yes', 'y', 'on', 'enabled', 'enable'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off', 'disabled', 'disable'].includes(normalized)) {
        return false;
      }
      return null;
    }

    function getGpcAutoModePermission(payload = {}) {
      const data = unwrapGpcResponse(payload);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return null;
      }
      return normalizeGpcAutoModePermissionValue(
        data.auto_mode_enabled
        ?? data.autoModeEnabled
        ?? data.auto_enabled
        ?? data.autoEnabled
      );
    }

    function isGpcAutoModePermissionDenied(payload = {}) {
      return getGpcAutoModePermission(payload) === false;
    }

    async function assertGpcApiKeyReadyForCreate(state = {}, phoneMode = GPC_HELPER_PHONE_MODE_MANUAL, apiKey = '') {
      const apiUrl = buildGpcBalanceUrl(state?.gopayHelperApiUrl);
      if (!apiUrl) {
        throw new Error('创建 GPC 订单失败：缺少 API 地址。');
      }
      const { response, data } = await fetchJsonWithTimeout(apiUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-Key': apiKey,
        },
      }, 30000);
      if (!response?.ok || !isGpcUnifiedResponseOk(data)) {
        const detail = getGpcResponseErrorDetail(data, response?.status || 0);
        throw new Error(`创建 GPC 订单失败：API Key 校验失败：${detail}`);
      }
      const balanceData = unwrapGpcResponse(data);
      const remainingUses = getGpcRemainingUses(balanceData);
      const status = String(balanceData?.status || balanceData?.card_status || balanceData?.cardStatus || '').trim().toLowerCase();
      if (status && status !== 'active') {
        throw new Error(`创建 GPC 订单失败：API Key 状态不可用（${status}）。`);
      }
      if (remainingUses !== null && remainingUses <= 0) {
        throw new Error('创建 GPC 订单失败：API Key 剩余次数不足。');
      }
      if (phoneMode === GPC_HELPER_PHONE_MODE_AUTO && isGpcAutoModePermissionDenied(balanceData)) {
        throw new Error('创建 GPC 订单失败：当前 GPC API Key 未开通自动模式。');
      }
    }

    async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('当前运行环境不支持 fetch，无法调用 GPC API。');
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const effectiveTimeoutMs = Math.max(1000, Number(timeoutMs) || 30000);
      let didTimeout = false;
      let timer = null;
      const buildTimeoutError = () => new Error(`GPC API 请求超时（>${Math.round(effectiveTimeoutMs / 1000)} 秒）：${url}`);
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

    async function readAccessTokenFromChatGptSessionTab(tabId) {
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);
      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 6：正在等待 ChatGPT 页面完成加载，再继续获取 accessToken...',
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
      return String(sessionResult?.accessToken || sessionResult?.session?.accessToken || '').trim();
    }

    async function generateGpcCheckoutFromApi(accessToken = '', state = {}) {
      const token = String(accessToken || '').trim();
      if (!token) {
        throw new Error('创建 GPC 订单失败：缺少 accessToken。');
      }
      const apiUrl = buildGpcTaskCreateUrl(state?.gopayHelperApiUrl);
      if (!apiUrl) {
        throw new Error('创建 GPC 订单失败：缺少 API 地址。');
      }
      const phoneMode = normalizeGpcHelperPhoneMode(state?.gopayHelperPhoneMode || state?.phoneMode);
      const isAutoMode = phoneMode === GPC_HELPER_PHONE_MODE_AUTO;
      const phoneNumber = String(state?.gopayHelperPhoneNumber || '').trim();
      const countryCode = normalizeHelperCountryCode(state?.gopayHelperCountryCode || '86');
      const pin = String(state?.gopayHelperPin || '').trim();
      const apiKey = resolveGpcHelperApiKey(state);
      if (!isAutoMode && !phoneNumber) {
        throw new Error('创建 GPC 订单失败：手动模式缺少手机号。');
      }
      if (!isAutoMode && !pin) {
        throw new Error('创建 GPC 订单失败：手动模式缺少 PIN。');
      }

      throwIfStopped();
      await assertGpcApiKeyReadyForCreate(state, phoneMode, apiKey);
      throwIfStopped();
      const payload = {
        access_token: token,
        phone_mode: phoneMode,
      };
      if (!isAutoMode) {
        payload.country_code = countryCode;
        payload.phone_number = normalizeHelperPhoneNumber(phoneNumber, countryCode);
        payload.otp_channel = normalizeGpcOtpChannel(state?.gopayHelperOtpChannel);
      }

      const orderCreatedAt = Date.now();
      const { response, data } = await fetchJsonWithTimeout(apiUrl, {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      }, 30000);

      const taskData = unwrapGpcResponse(data);
      const taskId = String(taskData?.task_id || taskData?.taskId || '').trim();

      if (!response?.ok || !isGpcUnifiedResponseOk(data) || !taskId) {
        const detail = getGpcResponseErrorDetail(data, response?.status || 0);
        throw new Error(`创建 GPC 订单失败：${detail}`);
      }

      return {
        taskId,
        taskStatus: String(taskData?.status || '').trim(),
        statusText: String(taskData?.status_text || taskData?.statusText || '').trim(),
        remoteStage: String(taskData?.remote_stage || taskData?.remoteStage || '').trim(),
        orderCreatedAt,
        responsePayload: taskData && typeof taskData === 'object' && !Array.isArray(taskData) ? taskData : null,
        phoneMode: normalizeGpcHelperPhoneMode(taskData?.phone_mode || taskData?.phoneMode || phoneMode),
        country: 'ID',
        currency: 'IDR',
        checkoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
      };
    }

    async function executeGpcCheckoutCreate(state = {}) {
      let accessToken = String(state?.contributionAccessToken || state?.accessToken || state?.chatgptAccessToken || '').trim();
      if (!accessToken) {
        await addLog('步骤 6：正在获取 accessToken...', 'info');
        const tokenTabId = await openFreshChatGptTabForCheckoutCreate();
        try {
          accessToken = await readAccessTokenFromChatGptSessionTab(tokenTabId);
        } finally {
          if (chrome?.tabs?.remove && Number.isInteger(tokenTabId)) {
            await chrome.tabs.remove(tokenTabId).catch(() => {});
          }
        }
      }
      if (!accessToken) {
        throw new Error('步骤 6：GPC 模式获取 accessToken 失败。');
      }

      await addLog('步骤 6：正在调用 GPC 接口创建订单...', 'info');
      const result = await generateGpcCheckoutFromApi(accessToken, state);
      await setState({
        plusCheckoutTabId: null,
        plusCheckoutUrl: '',
        plusCheckoutCountry: result.country || 'ID',
        plusCheckoutCurrency: result.currency || 'IDR',
        plusCheckoutSource: result.checkoutSource,
        gopayHelperTaskId: result.taskId,
        gopayHelperTaskStatus: result.taskStatus,
        gopayHelperStatusText: result.statusText,
        gopayHelperRemoteStage: result.remoteStage,
        gopayHelperTaskPayload: result.responsePayload,
        gopayHelperTaskProgressSignature: '',
        gopayHelperTaskProgressAt: 0,
        gopayHelperTaskProgressTaskId: result.taskId,
        gopayHelperReferenceId: '',
        gopayHelperGoPayGuid: '',
        gopayHelperRedirectUrl: '',
        gopayHelperNextAction: '',
        gopayHelperFlowId: '',
        gopayHelperChallengeId: '',
        gopayHelperStartPayload: null,
        gopayHelperOrderCreatedAt: result.orderCreatedAt || Date.now(),
      });
      await addLog(`步骤 6：GPC ${result.phoneMode === GPC_HELPER_PHONE_MODE_AUTO ? '自动' : '手动'}模式任务已创建（task_id: ${result.taskId}），准备继续下一步。`, 'info');
      await completeNodeFromBackground('plus-checkout-create', {
        plusCheckoutCountry: result.country || 'ID',
        plusCheckoutCurrency: result.currency || 'IDR',
        plusCheckoutSource: result.checkoutSource,
      });
    }

    async function executePlusCheckoutCreate(state = {}) {
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        await executeGpcCheckoutCreate(state);
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
