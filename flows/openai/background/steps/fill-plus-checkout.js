(function attachBackgroundPlusCheckoutBilling(root, factory) {
  root.MultiPageBackgroundPlusCheckoutBilling = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusCheckoutBillingModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/plus-checkout.js'];
  const PLUS_CHECKOUT_URL_PATTERN = /^https:\/\/chatgpt\.com\/checkout(?:\/|$)/i;
  const PLUS_CHECKOUT_FRAME_READY_DELAY_MS = 500;
  const PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS = 5;
  const PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS = 10000;
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const PLUS_PAYMENT_METHOD_AUTO = 'plus-auto';
  const DEFAULT_AUTO_BASE_URL = 'https://auto.1iiu.com';
  const AUTO_ORDER_PATH = '/api/v1/orders';
  const AUTO_JOB_LOGS_PATH = '/api/v1/jobs';
  const AUTO_POLL_INTERVAL_MS = 3000;
  const AUTO_REQUEST_TIMEOUT_MS = 30000;
  const AUTO_DEFAULT_TIMEOUT_SECONDS = 900;
  // 失败 error_key → 友好中文提示（对接文档 §五）。
  const AUTO_ERROR_KEY_MESSAGES = Object.freeze({
    err_no_trial: '该账号无免费试用资格（可能已开过 Plus），请更换新号。',
    err_at_invalid: 'access token 无效或已过期，请重新获取。',
    err_already_plus: '该账号已是 Plus，无需重复开通。',
    err_blocked: '该账号被风控拦截，请更换账号重试。',
    err_network: '网络/代理临时故障，请稍后重试。',
    err_timeout: '处理超时，请稍后重试。',
    err_busy: '服务繁忙（上游额度耗尽或维护），请稍后重试。',
    err_generic: '开通失败。',
  });
  const GPC_PORTAL_URL = 'https://gpc.qlhazycoder.top/';
  const GPC_PAGE_POLL_INTERVAL_MS = 3000;
  const GPC_PAGE_DEFAULT_TIMEOUT_SECONDS = 900;
  const GPC_PAGE_MAX_START_ATTEMPTS = 10;
  const PAYMENT_METHOD_CONFIGS = {
    [PLUS_PAYMENT_METHOD_PAYPAL]: {
      id: PLUS_PAYMENT_METHOD_PAYPAL,
      label: 'PayPal',
      selectMessageType: 'PLUS_CHECKOUT_SELECT_PAYPAL',
      redirectPattern: /paypal\./i,
    },
  };
  const MEIGUODIZHI_ADDRESS_ENDPOINT = 'https://www.meiguodizhi.com/api/v1/dz';
  const MEIGUODIZHI_COUNTRY_CONFIG = {
    AR: { path: '/ar-address', city: 'Buenos Aires', aliases: ['ar', 'argentina', '阿根廷'] },
    AU: { path: '/au-address', city: 'Sydney', aliases: ['au', 'aus', 'australia', '澳大利亚'] },
    CA: { path: '/ca-address', city: 'Toronto', aliases: ['ca', 'canada', '加拿大'] },
    CN: { path: '/cn-address', city: 'Shanghai', aliases: ['cn', 'china', '中国'] },
    DE: { path: '/de-address', city: 'Berlin', aliases: ['de', 'deu', 'germany', 'deutschland', '德国'] },
    ES: { path: '/es-address', city: 'Madrid', aliases: ['es', 'esp', 'spain', '西班牙'] },
    FR: { path: '/fr-address', city: 'Paris', aliases: ['fr', 'fra', 'france', '法国'] },
    GB: { path: '/uk-address', city: 'London', aliases: ['gb', 'uk', 'united kingdom', 'britain', 'england', '英国'] },
    HK: { path: '/hk-address', city: 'Hong Kong', aliases: ['hk', 'hong kong', '香港'] },
    ID: { path: '/id-address', city: 'Jakarta', aliases: ['id', 'indonesia', '印度尼西亚', '印尼'] },
    IT: { path: '/it-address', city: 'Rome', aliases: ['it', 'ita', 'italy', '意大利'] },
    JP: { path: '/jp-address', city: 'Tokyo', aliases: ['jp', 'jpn', 'japan', '日本', '日本国'] },
    KR: { path: '/kr-address', city: 'Seoul', aliases: ['kr', 'kor', 'korea', 'south korea', '韩国'] },
    MY: { path: '/my-address', city: 'Kuala Lumpur', aliases: ['my', 'malaysia', '马来西亚'] },
    NL: { path: '/nl-address', city: 'Amsterdam', aliases: ['nl', 'netherlands', 'holland', '荷兰'] },
    PH: { path: '/ph-address', city: 'Manila', aliases: ['ph', 'philippines', '菲律宾'] },
    RU: { path: '/ru-address', city: 'Moscow', aliases: ['ru', 'russia', '俄罗斯'] },
    SG: { path: '/sg-address', city: 'Singapore', aliases: ['sg', 'singapore', '新加坡'] },
    TH: { path: '/th-address', city: 'Bangkok', aliases: ['th', 'thailand', '泰国'] },
    TR: { path: '/tr-address', city: 'Istanbul', aliases: ['tr', 'turkey', 'turkiye', '土耳其'] },
    TW: { path: '/tw-address', city: 'Taipei', aliases: ['tw', 'taiwan', '台湾'] },
    US: { path: '/', city: 'New York', aliases: ['us', 'usa', 'united states', 'united states of america', 'america', '美国'] },
    VN: { path: '/vn-address', city: 'Ho Chi Minh City', aliases: ['vn', 'vietnam', '越南'] },
  };

  function createPlusCheckoutBillingExecutor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      broadcastDataUpdate,
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTabUntilStopped,
      fetch: fetchImpl = null,
      generateRandomName,
      getAddressSeedForCountry,
      getState,
      getTabId,
      isTabAlive,
      markCurrentRegistrationAccountUsed,
      queryTabsInAutomationWindow = null,
      setState,
      sleepWithStop,
      waitForTabCompleteUntilStopped,
      probeIpProxyExit = null,
      throwIfStopped = () => {},
    } = deps;

    function addLog(message, level = 'info', options = {}) {
      return rawAddLog(message, level, {
        step: 7,
        stepKey: 'plus-checkout-billing',
        ...(options && typeof options === 'object' ? options : {}),
      });
    }

    function isPlusCheckoutUrl(url = '') {
      return PLUS_CHECKOUT_URL_PATTERN.test(String(url || ''));
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

    function normalizeText(value = '') {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function isGpcHelperCheckout(state = {}) {
      return normalizePlusPaymentMethod(state?.plusPaymentMethod) === PLUS_PAYMENT_METHOD_GPC_HELPER
        || normalizeText(state?.plusCheckoutSource) === PLUS_PAYMENT_METHOD_GPC_HELPER;
    }

    function isAutoCheckout(state = {}) {
      return normalizePlusPaymentMethod(state?.plusPaymentMethod) === PLUS_PAYMENT_METHOD_AUTO
        || normalizeText(state?.plusCheckoutSource) === PLUS_PAYMENT_METHOD_AUTO;
    }

    function compactCountryText(value = '') {
      return normalizeText(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    }

    function normalizePlusPaymentMethod(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GpcUtils?.normalizePlusPaymentMethod) {
        return rootScope.GpcUtils.normalizePlusPaymentMethod(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return PLUS_PAYMENT_METHOD_GPC_HELPER;
      }
      if (normalized === PLUS_PAYMENT_METHOD_AUTO || normalized === 'pix' || normalized === 'pix_plus' || normalized === 'pixplus') {
        return PLUS_PAYMENT_METHOD_AUTO;
      }
      return PLUS_PAYMENT_METHOD_PAYPAL;
    }

    function getPaymentMethodConfig(method = PLUS_PAYMENT_METHOD_PAYPAL) {
      return PAYMENT_METHOD_CONFIGS[normalizePlusPaymentMethod(method)] || PAYMENT_METHOD_CONFIGS[PLUS_PAYMENT_METHOD_PAYPAL];
    }

    function getGpcPageTimeoutMs(state = {}) {
      const seconds = Math.max(1, Math.min(1800, Number(state?.gpcPageTimeoutSeconds) || GPC_PAGE_DEFAULT_TIMEOUT_SECONDS));
      return seconds * 1000;
    }

    async function getAliveGpcPortalTabId(tabId) {
      const normalizedTabId = Number(tabId) || 0;
      if (!normalizedTabId) {
        return null;
      }
      if (!chrome?.tabs?.get) {
        return normalizedTabId;
      }
      const tab = await chrome.tabs.get(normalizedTabId).catch(() => null);
      return tab && isGpcPortalUrl(tab.url || '') ? normalizedTabId : null;
    }

    async function getCurrentGpcPortalTabId() {
      const queryTabs = typeof queryTabsInAutomationWindow === 'function'
        ? queryTabsInAutomationWindow
        : (chrome?.tabs?.query ? (queryInfo) => chrome.tabs.query(queryInfo) : null);
      if (typeof queryTabs !== 'function') {
        return null;
      }
      const activeTabs = await queryTabs({ active: true, currentWindow: true }).catch(() => []);
      const activeGpcTab = (Array.isArray(activeTabs) ? activeTabs : [])
        .find((tab) => Number.isInteger(tab?.id) && isGpcPortalUrl(tab.url || ''));
      if (activeGpcTab) {
        return activeGpcTab.id;
      }
      const tabs = await queryTabs({}).catch(() => []);
      const gpcTab = (Array.isArray(tabs) ? tabs : [])
        .find((tab) => Number.isInteger(tab?.id) && isGpcPortalUrl(tab.url || ''));
      return gpcTab?.id || null;
    }

    async function getGpcPortalTabId(state = {}) {
      const registeredTabId = typeof getTabId === 'function'
        ? await Promise.resolve(getTabId(PLUS_CHECKOUT_SOURCE)).catch(() => null)
        : null;
      if (registeredTabId) {
        const aliveRegisteredTabId = await getAliveGpcPortalTabId(registeredTabId);
        if (aliveRegisteredTabId) {
          return aliveRegisteredTabId;
        }
      }
      const storedTabId = await getAliveGpcPortalTabId(Number(state.plusCheckoutTabId) || 0);
      if (storedTabId) {
        return storedTabId;
      }
      const currentTabId = await getCurrentGpcPortalTabId();
      if (currentTabId) {
        await addLog('步骤 7：检测到当前已在 GPC 页面，直接接管当前标签页。', 'info');
        return currentTabId;
      }
      throw new Error('步骤 7：未找到 GPC 页面。请先执行步骤 6 打开并准备 GPC 页面。');
    }

    async function inspectGpcPortalPage(tabId) {
      if (!chrome?.scripting?.executeScript) {
        throw new Error('步骤 7：当前运行环境不支持脚本注入，无法读取 GPC 页面。');
      }
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
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const startButton = buttons.find((button) => /开始\s*Plus\s*充值|任务进行中/.test(textOf(button)))
            || buttons.find((button) => /开始|任务/.test(textOf(button)));
          const modeButtons = Array.from(document.querySelectorAll('button, [role="button"], .design-mode-card, .mode-card, [class*="mode"]'));
          const cardModeButton = modeButtons.find((element) => /卡密充值/.test(textOf(element)));
          const freeModeButton = modeButtons.find((element) => /免费充值/.test(textOf(element)));
          const bodyText = String(document.body?.innerText || document.documentElement?.innerText || '').replace(/\r/g, '');
          const rawTextOf = (element) => String(element?.innerText || element?.textContent || element?.value || '');
          const logNodes = Array.from(document.querySelectorAll('[class*="log"], [id*="log"], .design-log, .logs, pre, code'));
          const logText = logNodes.map(rawTextOf).map((text) => text.trim()).filter(Boolean).join('\n') || bodyText;
          const extractLastLogLine = (rawText = '') => {
            const normalizeLogLine = (line = '') => String(line || '').replace(/\s+/g, ' ').trim();
            const ignoredLinePattern = /^(?:GPC Plus 充值|系统全自动出号|限量\d+份|自助购买卡密通道|实时进度|免费池|付费池|模式：|任务：|未开始|导出|充值模式|填写卡密|Access Token|开始 Plus 充值|停止当前任务|页面已就绪)$/i;
            const timestampEntries = String(rawText || '')
              .replace(/\r/g, '')
              .match(/\[\d{2}:\d{2}:\d{2}\][\s\S]*?(?=\s*\[\d{2}:\d{2}:\d{2}\]|$)/g);
            const entries = (timestampEntries && timestampEntries.length ? timestampEntries : String(rawText || '').split(/\n+/))
              .map(normalizeLogLine)
              .filter(Boolean)
              .filter((line) => !ignoredLinePattern.test(line));
            return entries[entries.length - 1] || '';
          };
          const lastLogLine = extractLastLogLine(logText) || extractLastLogLine(bodyText);
          const cardInputs = Array.from(document.querySelectorAll('input.card-key-seg, input[placeholder*="XXXXXXXX"], input[maxlength="8"]'))
            .filter(isVisible);
          const sessionTextarea = document.querySelector('textarea.design-session-input') || document.querySelector('textarea');
          const isCardModeActive = Boolean(cardModeButton && hasActiveMarker(cardModeButton))
            || (cardInputs.length > 0 && !(freeModeButton && hasActiveMarker(freeModeButton)));
          return {
            url: location.href,
            readyState: document.readyState,
            bodyText,
            logText,
            lastLogLine,
            hasSubscriptionDone: /订阅完成/.test(logText) || /订阅完成/.test(bodyText),
            noTrial: /该账户没有试用资格|该账号没有试用资格|没有试用资格|不具备\s*(?:Plus\s*)?试用资格|更换有试用资格的账号\s*Token/.test(logText) || /该账户没有试用资格|该账号没有试用资格|没有试用资格|不具备\s*(?:Plus\s*)?试用资格|更换有试用资格的账号\s*Token/.test(bodyText),
            startButtonText: textOf(startButton),
            startButtonDisabled: Boolean(startButton?.disabled || startButton?.getAttribute?.('aria-disabled') === 'true'),
            hasStartButton: Boolean(startButton),
            cardKeyValue: cardInputs.map((input) => String(input.value || '')).join('-'),
            sessionLength: String(sessionTextarea?.value || '').length,
            hasCardMode: Boolean(cardModeButton),
            hasFreeMode: Boolean(freeModeButton),
            isCardModeActive,
            activeModeText: textOf(isCardModeActive ? cardModeButton : freeModeButton),
          };
        },
      });
      return results?.[0]?.result || {};
    }

    function getGpcLastLogSummary(pageState = {}) {
      const rawText = String(pageState.lastLogLine || pageState.logText || pageState.bodyText || '');
      const timestampEntries = rawText
        .replace(/\r/g, '')
        .match(/\[\d{2}:\d{2}:\d{2}\][\s\S]*?(?=\s*\[\d{2}:\d{2}:\d{2}\]|$)/g);
      const entries = (timestampEntries && timestampEntries.length ? timestampEntries : rawText.split(/\n+/))
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const line = entries[entries.length - 1] || '';
      if (!line) {
        return '';
      }
      return line.length > 180 ? `${line.slice(0, 180)}...` : line;
    }

    function formatGpcLastLogSuffix(pageState = {}) {
      const summary = getGpcLastLogSummary(pageState);
      return summary ? ` 最近日志：${summary}` : '';
    }

    function hasGpcNoTrialFailure(pageState = {}) {
      if (pageState.noTrial) {
        return true;
      }
      const text = normalizeText([
        pageState.lastLogLine,
        pageState.logText,
        pageState.bodyText,
      ].filter(Boolean).join(' '));
      return /(?:该|此|当前)?账[户号].{0,16}(?:没有|无|不具备).{0,12}(?:Plus\s*)?试用资格|(?:没有|无|不具备).{0,12}(?:Plus\s*)?试用资格|更换有试用资格的账号\s*Token/.test(text);
    }

    function hasGpcRecoverableExecutionFailure(pageState = {}) {
      const text = normalizeText([
        pageState.lastLogLine,
        pageState.logText,
        pageState.bodyText,
      ].filter(Boolean).join(' '));
      const hasExecutionError = /任务失败：执行错误|ERROR\s*任务失败：执行错误|WARN\s*\[\d+\/\d+\]\s*执行错误/.test(text);
      if (!hasExecutionError) {
        return false;
      }
      return /Checkout\s*订单创建成功|解析\s*Midtrans\s*Token|Midtrans\s*Token/i.test(text);
    }

    async function ensureGpcCardMode(tabId) {
      if (!chrome?.scripting?.executeScript) {
        throw new Error('步骤 7：当前运行环境不支持脚本注入，无法切换 GPC 卡密充值模式。');
      }
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
          const cardInputs = Array.from(document.querySelectorAll('input.card-key-seg, input[placeholder*="XXXXXXXX"], input[maxlength="8"]'))
            .filter(isVisible);
          const isCardModeActive = Boolean(cardModeButton && hasActiveMarker(cardModeButton))
            || (cardInputs.length > 0 && !(freeModeButton && hasActiveMarker(freeModeButton)));
          if (!cardModeButton) {
            return {
              ok: false,
              reason: 'missing-card-mode',
              activeModeText: textOf(freeModeButton),
            };
          }
          if (isCardModeActive) {
            return {
              ok: true,
              clicked: false,
              isCardModeActive: true,
              activeModeText: textOf(cardModeButton),
            };
          }
          clickElement(cardModeButton);
          return {
            ok: true,
            clicked: true,
            isCardModeActive: false,
            activeModeText: textOf(cardModeButton),
          };
        },
      });
      return results?.[0]?.result || {};
    }

    async function clickGpcStartButton(tabId) {
      if (!chrome?.scripting?.executeScript) {
        throw new Error('步骤 7：当前运行环境不支持脚本注入，无法启动 GPC 页面流程。');
      }
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
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(isVisible);
          const button = buttons.find((candidate) => /开始\s*Plus\s*充值/.test(textOf(candidate)));
          if (!button) {
            return {
              clicked: false,
              reason: 'missing',
              buttonText: textOf(button),
            };
          }
          if (button.disabled || button.getAttribute?.('aria-disabled') === 'true') {
            return {
              clicked: false,
              reason: 'disabled',
              buttonText: textOf(button),
            };
          }
          button.scrollIntoView?.({ block: 'center', inline: 'center' });
          button.click?.();
          return {
            clicked: true,
            buttonText: textOf(button),
          };
        },
      });
      return results?.[0]?.result || {};
    }

    function getAutoTimeoutMs(state = {}) {
      const seconds = Math.floor(Number(state?.autoTimeoutSeconds));
      const normalized = Number.isFinite(seconds) && seconds > 0
        ? Math.min(3600, Math.max(30, seconds))
        : AUTO_DEFAULT_TIMEOUT_SECONDS;
      return normalized * 1000;
    }

    async function fetchAutoJson(url) {
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('等待 Plus 自动充值完成：当前运行环境不支持 fetch，无法查询 Plus 自动充值状态。');
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), AUTO_REQUEST_TIMEOUT_MS) : null;
      try {
        const separator = url.includes('?') ? '&' : '?';
        const response = await fetcher(`${url}${separator}t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          ...(controller ? { signal: controller.signal } : {}),
        });
        const text = await response.text().catch(() => '');
        let payload = text;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = text;
        }
        return { response, payload };
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    function fetchAutoJobLogs(baseUrl, jobId) {
      return fetchAutoJson(`${baseUrl}${AUTO_JOB_LOGS_PATH}/${encodeURIComponent(jobId)}/logs`);
    }

    function fetchAutoOrder(baseUrl, orderId) {
      return fetchAutoJson(`${baseUrl}${AUTO_ORDER_PATH}/${encodeURIComponent(orderId)}`);
    }

    async function resolveAutoOrderId(state = {}) {
      const direct = String(state?.autoOrderId || '').trim();
      if (direct) {
        return direct;
      }
      const latestState = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
      return String(latestState?.autoOrderId || '').trim();
    }

    async function resolveAutoJobId(state = {}) {
      const direct = String(state?.autoJobId || '').trim();
      if (direct) {
        return direct;
      }
      const latestState = typeof getState === 'function' ? await getState().catch(() => ({})) : {};
      return String(latestState?.autoJobId || '').trim();
    }

    function describeAutoFailure(payload = {}) {
      const errorKey = String(payload?.error_key || payload?.errorKey || '').trim();
      const errorText = String(payload?.error || '').trim();
      const mapped = AUTO_ERROR_KEY_MESSAGES[errorKey];
      if (mapped) {
        return errorKey === 'err_generic' && errorText ? `${mapped}${errorText}` : mapped;
      }
      return errorText || errorKey || '未知错误';
    }

    async function completeAutoBilling(orderState, payload = {}) {
      const email = String(payload?.email || '').trim();
      await setState({
        plusCheckoutSource: PLUS_PAYMENT_METHOD_AUTO,
        autoOrderState: orderState,
        autoPaymentStatus: String(payload?.payment_status || payload?.paymentStatus || '').trim(),
      });
      await addLog(`等待 Plus 自动充值完成：开通成功${email ? `（${email}）` : ''}，准备继续下一步。`, 'ok');
      await completeNodeFromBackground('plus-checkout-billing', {
        plusCheckoutSource: PLUS_PAYMENT_METHOD_AUTO,
        autoOrderState: orderState,
        autoPaymentStatus: String(payload?.payment_status || payload?.paymentStatus || '').trim(),
      });
    }

    async function pollAutoOrderFallback(baseUrl, orderId) {
      // job 过期（404）后按 order_id 查持久终态。
      const { response, payload } = await fetchAutoOrder(baseUrl, orderId);
      if (!response?.ok) {
        const detail = String(payload?.error || payload?.message || `HTTP ${response?.status || 0}`).trim();
        throw new Error(`等待 Plus 自动充值完成：查询订单终态失败：${detail}`);
      }
      const orderState = String(payload?.state || '').trim().toLowerCase();
      if (orderState === 'done') {
        await completeAutoBilling(orderState, payload);
        return true;
      }
      if (orderState === 'failed') {
        throw new Error(`等待 Plus 自动充值完成：充值失败：${describeAutoFailure(payload)}`);
      }
      return false;
    }

    async function executeAutoBilling(state = {}) {
      const orderId = await resolveAutoOrderId(state);
      if (!orderId) {
        throw new Error('等待 Plus 自动充值完成：缺少 Plus 自动充值订单号，请先执行「发起 Plus 自动充值」。');
      }
      const jobId = await resolveAutoJobId(state);
      // Plus 自动充值接口地址固定使用内置端点，不接受用户自定义。
      const baseUrl = DEFAULT_AUTO_BASE_URL;
      const deadline = Date.now() + getAutoTimeoutMs(state);
      await addLog(
        `等待 Plus 自动充值完成：正在轮询开通进度（order_id=${orderId}${jobId ? `, job_id=${jobId}` : ''}）...`,
        'info'
      );

      let renderedLogCount = 0;
      let lastState = '';
      while (Date.now() <= deadline) {
        throwIfStopped();

        // 无 job_id 时直接走 order 终态兜底轮询。
        if (!jobId) {
          if (await pollAutoOrderFallback(baseUrl, orderId)) {
            return;
          }
          await sleepWithStop(AUTO_POLL_INTERVAL_MS);
          continue;
        }

        const { response, payload } = await fetchAutoJobLogs(baseUrl, jobId);
        if (response?.status === 404) {
          // job 已过期，转为 order 终态兜底。
          if (await pollAutoOrderFallback(baseUrl, orderId)) {
            return;
          }
          await sleepWithStop(AUTO_POLL_INTERVAL_MS);
          continue;
        }
        if (!response?.ok) {
          const detail = String(payload?.error || payload?.message || `HTTP ${response?.status || 0}`).trim();
          throw new Error(`等待 Plus 自动充值完成：查询进度失败：${detail}`);
        }

        // 增量渲染进度日志（每次返回完整列表，只输出新增的部分）。
        const logs = Array.isArray(payload?.logs) ? payload.logs : [];
        for (let index = renderedLogCount; index < logs.length; index += 1) {
          const entry = logs[index] || {};
          const msg = String(entry.msg || entry.key || '').trim();
          if (msg) {
            await addLog(`等待 Plus 自动充值完成：${msg}`, 'info');
          }
        }
        renderedLogCount = Math.max(renderedLogCount, logs.length);

        const orderState = String(payload?.state || '').trim().toLowerCase();
        if (orderState !== lastState) {
          lastState = orderState;
          await setState({
            plusCheckoutSource: PLUS_PAYMENT_METHOD_AUTO,
            autoOrderState: orderState,
          });
        }
        if (orderState === 'done') {
          await completeAutoBilling(orderState, payload);
          return;
        }
        if (orderState === 'failed') {
          throw new Error(`等待 Plus 自动充值完成：充值失败：${describeAutoFailure(payload)}`);
        }
        await sleepWithStop(AUTO_POLL_INTERVAL_MS);
      }

      throw new Error(`等待 Plus 自动充值完成：轮询超时，未在限定时间内完成（最后状态：${lastState || '未知'}）。`);
    }

    async function executeGpcHelperBilling(state = {}) {
      const tabId = await getGpcPortalTabId(state);
      if (chrome?.tabs?.update) {
        await chrome.tabs.update(tabId, { active: true }).catch(() => {});
      }
      await addLog('步骤 7：正在等待 GPC 页面加载完成...', 'info');
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(800);

      const deadline = Date.now() + getGpcPageTimeoutMs(state);
      let startAttempts = 0;
      let hasClickedStart = false;
      let pendingGpcLogs = [];

      const collectPendingGpcLog = (message, level = 'info', key = '') => {
        const normalizedMessage = String(message || '').trim();
        const normalizedKey = String(key || normalizedMessage).trim();
        if (!normalizedMessage || !normalizedKey) {
          return;
        }
        const existingEntry = pendingGpcLogs.find((entry) => entry.key === normalizedKey);
        if (existingEntry) {
          existingEntry.count += 1;
          return;
        }
        pendingGpcLogs.push({
          key: normalizedKey,
          message: normalizedMessage,
          level,
          count: 1,
        });
      };

      const flushPendingStatusLog = async () => {
        if (!pendingGpcLogs.length) {
          return;
        }
        const entries = pendingGpcLogs;
        pendingGpcLogs = [];
        for (const entry of entries) {
          const countSuffix = entry.count > 1 ? ` ×${entry.count}` : '';
          await addLog(`${entry.message}${countSuffix}`, entry.level);
        }
      };

      const collectStatusLog = async (pageState, currentButtonText) => {
        const statusLabel = `${currentButtonText || '未识别按钮'}${pageState.hasSubscriptionDone ? ' / 订阅完成' : ''}`;
        const statusKey = statusLabel || '未识别按钮';
        const statusLevel = pageState.hasSubscriptionDone ? 'ok' : 'info';
        collectPendingGpcLog(`步骤 7：GPC 页面状态：${statusLabel}`, statusLevel, `status:${statusKey}`);
      };

      while (Date.now() <= deadline) {
        throwIfStopped();
        const pageState = await inspectGpcPortalPage(tabId);
        pageState.noTrial = hasGpcNoTrialFailure(pageState);
        const buttonText = normalizeText(pageState.startButtonText);
        await collectStatusLog(pageState, buttonText);

        if (pageState.noTrial) {
          await flushPendingStatusLog();
          throw new Error(`PLUS_CHECKOUT_NON_FREE_TRIAL::步骤 7：该账户没有试用资格，当前轮 GPC 充值失败。${formatGpcLastLogSuffix(pageState)}`);
        }

        if (hasGpcRecoverableExecutionFailure(pageState)) {
          await flushPendingStatusLog();
          throw new Error(`GPC_PAGE_FLOW_ENDED::步骤 7：GPC 页面任务执行错误，准备重新回到步骤 6 创建新 Checkout。${formatGpcLastLogSuffix(pageState)}`);
        }

        if (pageState.hasSubscriptionDone && /开始\s*Plus\s*充值/.test(buttonText)) {
          await flushPendingStatusLog();
          await setState({
            plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
            gpcPageStatus: 'completed',
            gpcPageStatusText: '订阅完成',
          });
          await addLog('步骤 7：GPC 页面显示订阅完成，准备继续下一步。', 'ok');
          await completeNodeFromBackground('plus-checkout-billing', {
            plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
          });
          return;
        }

        if (/任务进行中/.test(buttonText)) {
          await sleepWithStop(GPC_PAGE_POLL_INTERVAL_MS);
          continue;
        }

        if (!pageState.isCardModeActive) {
          let modeResult = null;
          for (let attempt = 1; attempt <= 8; attempt += 1) {
            modeResult = await ensureGpcCardMode(tabId);
            if (!modeResult.ok) {
              await flushPendingStatusLog();
              throw new Error('GPC_PAGE_FLOW_ENDED::步骤 7：未找到 GPC“卡密充值”模式入口，无法启动 Plus 充值。');
            }
            if (modeResult.isCardModeActive) {
              break;
            }
            if (attempt === 1 && modeResult.clicked) {
              collectPendingGpcLog(
                '步骤 7：已切换到 GPC 卡密充值模式，等待页面完成渲染。',
                'info',
                'mode-switch'
              );
            }
            await sleepWithStop(modeResult.clicked ? 800 : 500);
          }
          if (!modeResult?.isCardModeActive) {
            await flushPendingStatusLog();
            throw new Error('GPC_PAGE_FLOW_ENDED::步骤 7：GPC 页面切换到卡密充值模式超时，无法启动 Plus 充值。');
          }
          collectPendingGpcLog(
            '步骤 7：GPC 卡密充值模式已就绪，准备启动。',
            'info',
            'mode-ready'
          );
          continue;
        }

        if (/开始\s*Plus\s*充值/.test(buttonText) && !pageState.startButtonDisabled) {
          await flushPendingStatusLog();
          if (startAttempts >= GPC_PAGE_MAX_START_ATTEMPTS) {
            throw new Error(`GPC_PAGE_FLOW_ENDED::步骤 7：GPC 页面已尝试启动 ${startAttempts} 次仍未显示订阅完成。${formatGpcLastLogSuffix(pageState)}`);
          }
          if (hasClickedStart && !pageState.hasSubscriptionDone) {
            await addLog(`步骤 7：GPC 页面回到开始状态但未显示订阅完成，准备再次启动。${formatGpcLastLogSuffix(pageState)}`, 'warn');
          } else {
            await addLog('步骤 7：正在点击“开始 Plus 充值”。', 'info');
          }
          const clickResult = await clickGpcStartButton(tabId);
          if (!clickResult.clicked) {
            await addLog(`步骤 7：暂时无法点击开始按钮（${clickResult.reason || '未知原因'}），继续等待。${formatGpcLastLogSuffix(pageState)}`, 'warn');
            await sleepWithStop(GPC_PAGE_POLL_INTERVAL_MS);
            continue;
          }
          startAttempts += 1;
          hasClickedStart = true;
          await setState({
            plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
            gpcPageStatus: 'running',
            gpcPageStatusText: `页面启动第 ${startAttempts} 次`,
          });
          await sleepWithStop(GPC_PAGE_POLL_INTERVAL_MS);
          continue;
        }

        await sleepWithStop(GPC_PAGE_POLL_INTERVAL_MS);
      }

      await flushPendingStatusLog();
      const finalPageState = await inspectGpcPortalPage(tabId).catch(() => ({}));
      throw new Error(`GPC_PAGE_FLOW_ENDED::步骤 7：GPC 页面等待超时，未检测到订阅完成。${formatGpcLastLogSuffix(finalPageState)}`);
    }

    function resolveMeiguodizhiCountryCode(value = '') {
      const normalized = normalizeText(value);
      const upper = normalized.toUpperCase();
      if (MEIGUODIZHI_COUNTRY_CONFIG[upper]) {
        return upper;
      }
      const compact = compactCountryText(normalized);
      const match = Object.entries(MEIGUODIZHI_COUNTRY_CONFIG).find(([code, config]) => (
        compact === code.toLowerCase()
        || (config.aliases || []).some((alias) => {
          const compactAlias = compactCountryText(alias);
          return compact === compactAlias || (compactAlias.length >= 4 && compact.includes(compactAlias));
        })
      ));
      return match?.[0] || '';
    }

    function hasCompleteAddressFallback(seed) {
      const fallback = seed?.fallback || {};
      return Boolean(
        normalizeText(fallback.address1)
        && normalizeText(fallback.city)
        && normalizeText(fallback.postalCode)
      );
    }

    function normalizePostalCodeForCountry(countryCode, rawPostalCode = '', fallbackPostalCode = '') {
      const normalizedCountry = resolveMeiguodizhiCountryCode(countryCode) || normalizeText(countryCode).toUpperCase();
      const postalCode = normalizeText(rawPostalCode);
      const fallback = normalizeText(fallbackPostalCode);
      if (normalizedCountry !== 'KR') {
        return postalCode;
      }
      if (/^\d{5}$/.test(postalCode)) {
        return postalCode;
      }
      if (/^\d{5}$/.test(fallback)) {
        return fallback;
      }
      return '04524';
    }

    function buildDirectAddressSeed(countryCode, apiAddress, fallbackSeed) {
      const address1 = normalizeText(apiAddress?.Trans_Address || apiAddress?.Address);
      const city = normalizeText(apiAddress?.City);
      const region = normalizeText(apiAddress?.State_Full || apiAddress?.State);
      const postalCode = normalizePostalCodeForCountry(
        countryCode,
        apiAddress?.Zip_Code,
        fallbackSeed?.fallback?.postalCode
      );
      if (!address1 || !city || !postalCode) {
        return null;
      }
      return {
        ...(fallbackSeed || {}),
        countryCode,
        query: [address1, city].filter(Boolean).join(', '),
        source: 'meiguodizhi',
        skipAutocomplete: true,
        fallback: {
          ...(fallbackSeed?.fallback || {}),
          address1,
          city,
          region,
          postalCode,
        },
      };
    }

    async function fetchMeiguodizhiAddressSeed(countryCode, fallbackSeed) {
      if (typeof fetchImpl !== 'function') {
        return null;
      }
      const countryConfig = MEIGUODIZHI_COUNTRY_CONFIG[countryCode];
      if (!countryConfig?.path) {
        return null;
      }
      const path = countryConfig.path;
      const city = normalizeText(fallbackSeed?.fallback?.city || fallbackSeed?.query || countryConfig.city);
      const response = await fetchImpl(MEIGUODIZHI_ADDRESS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city,
          path,
          method: 'refresh',
        }),
      });
      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status || 0}`);
      }
      const data = await response.json();
      if (data?.status !== 'ok') {
        throw new Error(data?.message || data?.status || '未知响应');
      }
      return buildDirectAddressSeed(countryCode, data.address || {}, fallbackSeed);
    }

    function getLocalAddressSeed(countryCode) {
      if (typeof getAddressSeedForCountry !== 'function') {
        return null;
      }
      const seed = getAddressSeedForCountry(countryCode, {
        fallbackCountry: 'DE',
      });
      return seed?.countryCode === countryCode ? seed : null;
    }

    function buildMeiguodizhiLookupSeed(countryCode) {
      const config = MEIGUODIZHI_COUNTRY_CONFIG[countryCode];
      if (!config) {
        return null;
      }
      return {
        countryCode,
        query: config.city,
        fallback: {
          address1: '',
          city: config.city,
          region: '',
          postalCode: '',
        },
      };
    }

    function resolveBillingAddressCountry(state = {}, countryOverride = '', paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const normalizedPaymentMethod = normalizePlusPaymentMethod(paymentMethod || state?.plusPaymentMethod);
      const checkoutCountry = resolveMeiguodizhiCountryCode(countryOverride);
      const savedCheckoutCountry = resolveMeiguodizhiCountryCode(state.plusCheckoutCountry);
      const exitCountry = resolveMeiguodizhiCountryCode(
        state.ipProxyAppliedExitRegion
        || state.ipProxyExitRegion
        || ''
      );

      const countryCode = checkoutCountry || savedCheckoutCountry || exitCountry || 'DE';
      return {
        countryCode,
        requestedCountry: normalizeText(countryOverride)
          || normalizeText(state.plusCheckoutCountry)
          || exitCountry
          || 'DE',
        source: checkoutCountry ? 'checkout_page' : (savedCheckoutCountry ? 'checkout_state' : (exitCountry ? 'proxy_exit' : 'paypal_fallback')),
      };
    }

    async function resolveBillingAddressSeed(state = {}, countryOverride = '', options = {}) {
      const paymentMethod = normalizePlusPaymentMethod(options.paymentMethod || state?.plusPaymentMethod);
      const countryResolution = resolveBillingAddressCountry(state, countryOverride, paymentMethod);
      const countryCode = countryResolution.countryCode;
      const requestedCountry = countryResolution.requestedCountry;
      const localSeed = getLocalAddressSeed(countryCode);
      const lookupSeed = localSeed || buildMeiguodizhiLookupSeed(countryCode);
      if (!lookupSeed) {
        throw new Error(`步骤 7：无法识别账单国家或地区：${requestedCountry || '空'}`);
      }
      try {
        const remoteSeed = await fetchMeiguodizhiAddressSeed(countryCode, lookupSeed);
        if (hasCompleteAddressFallback(remoteSeed)) {
          await addLog(
            `步骤 7：已从 meiguodizhi 接口获取账单地址（${remoteSeed.fallback.city} / ${remoteSeed.fallback.postalCode}），将跳过 Google 地址推荐。`,
            'info'
          );
          return remoteSeed;
        }
        await addLog('步骤 7：meiguodizhi 接口返回的地址字段不完整，回退到本地地址种子。', 'warn');
      } catch (error) {
        await addLog(`步骤 7：meiguodizhi 地址接口不可用，回退到本地地址种子：${error?.message || String(error || '')}`, 'warn');
      }

      if (hasCompleteAddressFallback(localSeed)) {
        return localSeed;
      }
      throw new Error(`步骤 7：${requestedCountry} 的 meiguodizhi 地址不可用，且没有本地兜底地址。`);
    }

    async function getAlivePlusCheckoutTabId(tabId) {
      if (!Number.isInteger(tabId) || tabId <= 0) {
        return null;
      }
      if (!chrome?.tabs?.get) {
        return tabId;
      }
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      return tab && isPlusCheckoutUrl(tab.url) ? tabId : null;
    }

    async function getCurrentPlusCheckoutTabId() {
      if (!chrome?.tabs?.query) {
        return null;
      }

      const queryTabs = typeof queryTabsInAutomationWindow === 'function'
        ? queryTabsInAutomationWindow
        : (queryInfo) => chrome.tabs.query(queryInfo);
      const activeTabs = await queryTabs({ active: true, currentWindow: true }).catch(() => []);
      const activeCheckoutTab = activeTabs.find((tab) => Number.isInteger(tab?.id) && isPlusCheckoutUrl(tab.url));
      if (activeCheckoutTab) {
        return activeCheckoutTab.id;
      }

      const checkoutTabs = await queryTabs({ url: 'https://chatgpt.com/checkout/*' }).catch(() => []);
      const checkoutTab = checkoutTabs.find((tab) => Number.isInteger(tab?.id) && isPlusCheckoutUrl(tab.url));
      return checkoutTab?.id || null;
    }

    async function getCheckoutFrames(tabId) {
      if (!chrome?.webNavigation?.getAllFrames) {
        return [{ frameId: 0, url: '' }];
      }
      const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => null);
      if (!Array.isArray(frames) || !frames.length) {
        return [{ frameId: 0, url: '' }];
      }
      return frames
        .filter((frame) => Number.isInteger(frame?.frameId))
        .sort((left, right) => Number(left.frameId) - Number(right.frameId));
    }

    async function pingCheckoutFrame(tabId, frameId) {
      try {
        const pong = await chrome.tabs.sendMessage(tabId, {
          type: 'PING',
          source: 'background',
          payload: {},
        }, {
          frameId: Number.isInteger(frameId) ? frameId : 0,
        });
        return Boolean(pong?.ok && (!pong.source || pong.source === PLUS_CHECKOUT_SOURCE));
      } catch {
        return false;
      }
    }

    async function ensurePlusCheckoutFrameReady(tabId, frameId) {
      if (await pingCheckoutFrame(tabId, frameId)) {
        return true;
      }
      if (!chrome?.scripting?.executeScript) {
        return false;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: (injectedSource) => {
            window.__MULTIPAGE_SOURCE = injectedSource;
          },
          args: [PLUS_CHECKOUT_SOURCE],
        });
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          files: PLUS_CHECKOUT_INJECT_FILES,
        });
      } catch {
        // If the frame was already injected or navigated mid-injection, ping once more below.
      }

      await sleepWithStop(PLUS_CHECKOUT_FRAME_READY_DELAY_MS);
      return await pingCheckoutFrame(tabId, frameId);
    }

    async function ensurePlusCheckoutFramesReady(tabId, frames) {
      const checkedFrames = [];
      for (const frame of frames) {
        const ready = await ensurePlusCheckoutFrameReady(tabId, frame.frameId);
        checkedFrames.push({ ...frame, ready });
      }
      return checkedFrames;
    }

    async function sendFrameMessage(tabId, frameId, message) {
      return chrome.tabs.sendMessage(tabId, message, {
        frameId: Number.isInteger(frameId) ? frameId : 0,
      });
    }

    async function waitForPaymentRedirectAfterSubmit(tabId, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const paymentConfig = getPaymentMethodConfig(paymentMethod);
      const startedAt = Date.now();
      while (Date.now() - startedAt < PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
          throw new Error(`步骤 7：checkout 标签页已关闭，无法继续等待 ${paymentConfig.label} 跳转。`);
        }
        const url = String(tab.url || '');
        if (paymentConfig.redirectPattern.test(url) && !isPlusCheckoutUrl(url)) {
          await waitForTabCompleteUntilStopped(tabId);
          await sleepWithStop(1000);
          return true;
        }
        if (url && !isPlusCheckoutUrl(url)) {
          await addLog(`步骤 7：点击订阅后页面跳转到非 ${paymentConfig.label} 识别地址：${url}`, 'warn');
          return false;
        }
        await sleepWithStop(500);
      }
      return false;
    }

    async function waitForPayPalRedirectAfterSubmit(tabId) {
      return waitForPaymentRedirectAfterSubmit(tabId, PLUS_PAYMENT_METHOD_PAYPAL);
    }

    async function inspectCheckoutFrame(tabId, frame) {
      try {
        const result = await sendFrameMessage(tabId, frame.frameId, {
          type: 'PLUS_CHECKOUT_GET_STATE',
          source: 'background',
          payload: {},
        });
        if (result?.error) {
          return { frame, error: result.error };
        }
        return { frame: { ...frame, ready: true }, result: result || {} };
      } catch (error) {
        const readyError = frame.ready === false ? 'content-script-not-ready' : '';
        const message = error?.message || String(error || '');
        return { frame, error: readyError ? `${readyError}: ${message}` : message };
      }
    }

    function isPaymentFrameUrl(url = '') {
      return /elements-inner-payment|componentName=payment/i.test(String(url || ''));
    }

    function isAddressFrameUrl(url = '') {
      return /elements-inner-address|componentName=address/i.test(String(url || ''));
    }

    function isAutocompleteFrameUrl(url = '') {
      return /elements-inner-autocompl/i.test(String(url || ''));
    }

    function buildFrameSummary(inspections) {
      return inspections
        .map((item) => {
          const flags = [];
          if (item.result?.hasPayPal) flags.push('paypal');

          if (item.result?.billingFieldsVisible) flags.push('billing');
          if (item.result?.hasSubscribeButton) flags.push('subscribe');
          if (!flags.length && item.error) flags.push(item.error);
          if (!flags.length) flags.push('no-match');
          return `${item.frame.frameId}:${item.frame.url || 'about:blank'}:${flags.join(',')}`;
        })
        .slice(0, 8)
        .join(' | ');
    }

    async function inspectCheckoutFrames(tabId, frames) {
      const inspections = [];
      for (const frame of frames) {
        const inspection = await inspectCheckoutFrame(tabId, frame);
        inspections.push(inspection);
      }
      return inspections;
    }

    function pickPaymentFrame(inspections, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      return inspections.find((item) => item.result?.hasPayPal || item.result?.paypalCandidates?.length)
        || inspections.find((item) => isPaymentFrameUrl(item.frame.url))
        || null;
    }

    function pickBillingFrame(inspections) {
      return inspections.find((item) => item.result?.billingFieldsVisible)
        || inspections.find((item) => isAddressFrameUrl(item.frame.url))
        || null;
    }

    function pickSubscribeFrame(inspections) {
      return inspections.find((item) => item.result?.hasSubscribeButton)
        || inspections.find((item) => item.frame.frameId === 0)
        || null;
    }

    function findCheckoutAmountInspection(inspections = []) {
      return inspections.find((item) => item.result?.checkoutAmountSummary?.hasTodayDue)
        || null;
    }

    async function inspectCheckoutAmountSummary(tabId) {
      const frames = await getReadyCheckoutFrames(tabId);
      const inspections = await inspectCheckoutFrames(tabId, frames);
      const amountInspection = findCheckoutAmountInspection(inspections);
      return amountInspection?.result?.checkoutAmountSummary || null;
    }

    async function ensureFreeTrialAmount(tabId, state = {}, options = {}) {
      const phaseLabel = String(options.phaseLabel || '').trim() || '提交前';
      const amountSummary = await inspectCheckoutAmountSummary(tabId);
      if (!amountSummary?.hasTodayDue) {
        await addLog(`步骤 7：${phaseLabel}未能识别 checkout 的“今日应付金额”，为避免误判将继续执行。`, 'warn');
        return;
      }

      if (amountSummary.isZero) {
        await addLog(`步骤 7：${phaseLabel}已确认今日应付金额为 ${amountSummary.rawAmount || '0'}，继续执行。`, 'ok');
        return;
      }

      const amountLabel = amountSummary.rawAmount || (
        Number.isFinite(Number(amountSummary.amount)) ? String(amountSummary.amount) : '未知金额'
      );
      await addLog(`步骤 7：${phaseLabel}检测到今日应付金额不是 0（${amountLabel}），说明当前账号没有免费试用资格，将跳过支付提交。`, 'warn');
      if (typeof markCurrentRegistrationAccountUsed === 'function') {
        await markCurrentRegistrationAccountUsed(state, {
          reason: 'plus-checkout-non-free-trial',
          logPrefix: 'Plus Checkout：当前账号没有免费试用资格',
        });
      }
      throw new Error(`PLUS_CHECKOUT_NON_FREE_TRIAL::步骤 7：今日应付金额不是 0（${amountLabel}），当前账号没有免费试用资格，已跳过支付提交。`);
    }

    async function getReadyCheckoutFrames(tabId) {
      return ensurePlusCheckoutFramesReady(tabId, await getCheckoutFrames(tabId));
    }

    async function resolveOptionalFrameByUrl(tabId, predicate) {
      const frames = await getCheckoutFrames(tabId);
      const frame = frames.find((item) => predicate(item.url));
      if (!frame) {
        return null;
      }
      const ready = await ensurePlusCheckoutFrameReady(tabId, frame.frameId);
      return {
        frame,
        ready,
      };
    }

    async function resolvePaymentFrame(tabId, frames, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const inspections = await inspectCheckoutFrames(tabId, frames);
      const picked = pickPaymentFrame(inspections, paymentMethod);
      if (picked) {
        return {
          frameId: picked.frame.frameId,
          frameUrl: picked.frame.url || '',
          ready: picked.frame.ready !== false,
          inspections,
        };
      }

      return {
        frameId: null,
        frameUrl: '',
        inspections,
      };
    }

    async function waitForBillingFrame(tabId) {
      while (true) {
        const frames = await getReadyCheckoutFrames(tabId);
        const inspections = await inspectCheckoutFrames(tabId, frames);
        const picked = pickBillingFrame(inspections);
        if (picked) {
          return {
            frameId: picked.frame.frameId,
            frameUrl: picked.frame.url || '',
            countryText: picked.result?.countryText || '',
            ready: picked.frame.ready !== false,
            inspections,
          };
        }
        await sleepWithStop(250);
      }
    }

    async function waitForSubscribeFrame(tabId, candidateFrames) {
      const frames = candidateFrames.length ? candidateFrames : [{ frameId: 0, url: '' }];
      while (true) {
        const readyFrames = await ensurePlusCheckoutFramesReady(tabId, frames);
        const inspections = await inspectCheckoutFrames(tabId, readyFrames);
        const picked = pickSubscribeFrame(inspections);
        if (picked) {
          return picked.frame;
        }
        await sleepWithStop(250);
      }
    }

    async function getCheckoutTabId(state = {}) {
      const registeredTabId = await getTabId(PLUS_CHECKOUT_SOURCE);
      if (registeredTabId && await isTabAlive(PLUS_CHECKOUT_SOURCE)) {
        const aliveRegisteredTabId = await getAlivePlusCheckoutTabId(registeredTabId);
        if (aliveRegisteredTabId) {
          return aliveRegisteredTabId;
        }
      }
      const storedTabId = Number(state.plusCheckoutTabId) || 0;
      if (storedTabId) {
        const aliveStoredTabId = await getAlivePlusCheckoutTabId(storedTabId);
        if (aliveStoredTabId) {
          return aliveStoredTabId;
        }
      }
      const currentCheckoutTabId = await getCurrentPlusCheckoutTabId();
      if (currentCheckoutTabId) {
        await addLog('步骤 7：检测到当前已在 Plus Checkout 页面，直接接管当前标签页。', 'info');
        return currentCheckoutTabId;
      }
      throw new Error('步骤 7：未找到 Plus Checkout 标签页。请先打开 Plus Checkout 页面，或完成步骤 6。');
    }

    async function executePlusCheckoutBilling(state = {}) {
      if (isGpcHelperCheckout(state)) {
        await executeGpcHelperBilling(state);
        return;
      }
      if (isAutoCheckout(state)) {
        await executeAutoBilling(state);
        return;
      }
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      const paymentConfig = getPaymentMethodConfig(paymentMethod);
      const tabId = await getCheckoutTabId(state);
      await addLog('步骤 7：正在等待 Plus Checkout 页面加载完成...', 'info');
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);

      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: '步骤 7：Checkout 页面仍在加载，等待账单填写脚本就绪...',
      });
      const readyFrames = await getReadyCheckoutFrames(tabId);
      await ensureFreeTrialAmount(tabId, state, {
        phaseLabel: 'Checkout 页面加载后',
      });
      const paymentFrame = await resolvePaymentFrame(tabId, readyFrames, paymentMethod);
      if (paymentFrame.frameId === null) {
        const frameSummary = buildFrameSummary(paymentFrame.inspections);
        throw new Error(`步骤 7：未在主页面或 iframe 中发现 ${paymentConfig.label} DOM，无法自动切换付款方式。frame 摘要：${frameSummary}`);
      }
      if (!paymentFrame.ready) {
        throw new Error(`步骤 7：已定位到 ${paymentConfig.label} 所在 iframe（frameId=${paymentFrame.frameId}），但账单脚本无法注入该 iframe。请提供该 iframe 的控制台结构或截图。`);
      }

      if (paymentFrame.frameId !== 0) {
        await addLog(`步骤 7：${paymentConfig.label} 位于 checkout iframe（frameId=${paymentFrame.frameId}），将改为在该 frame 内操作。`, 'info');
      }

      const randomName = generateRandomName();
      const fullName = [randomName.firstName, randomName.lastName].filter(Boolean).join(' ');

      await addLog(`步骤 7：正在切换 ${paymentConfig.label} 付款方式...`, 'info');
      const paymentResult = await sendFrameMessage(tabId, paymentFrame.frameId, {
        type: paymentConfig.selectMessageType,
        source: 'background',
        payload: { paymentMethod },
      });
      if (paymentResult?.error) {
        throw new Error(paymentResult.error);
      }

      const billingFrame = await waitForBillingFrame(tabId);
      if (!billingFrame.ready) {
        throw new Error(`步骤 7：已定位到账单地址 iframe（frameId=${billingFrame.frameId}），但账单脚本无法注入该 iframe。请提供该 iframe 的控制台结构或截图。`);
      }
      if (billingFrame.frameId !== paymentFrame.frameId) {
        await addLog(`步骤 7：账单地址位于 checkout iframe（frameId=${billingFrame.frameId}），将改为在该 frame 内填写。`, 'info');
      }

      const addressSeed = await resolveBillingAddressSeed(state, billingFrame.countryText, { paymentMethod });
      if (!addressSeed) {
        throw new Error('步骤 7：未找到可用的本地账单地址种子。');
      }

      await addLog(`步骤 7：正在填写账单地址（${addressSeed.countryCode} / ${addressSeed.query}）...`, 'info');
      const autocompleteFrame = await resolveOptionalFrameByUrl(tabId, isAutocompleteFrameUrl);
      let result = null;
      if (!addressSeed.skipAutocomplete && autocompleteFrame?.frame && autocompleteFrame.frame.frameId !== billingFrame.frameId) {
        if (!autocompleteFrame.ready) {
          throw new Error('步骤 7：发现 Google 地址推荐 iframe，但无法注入账单脚本。请提供该 iframe 的控制台结构。');
        }
        await addLog(`步骤 7：Google 地址推荐位于独立 iframe（frameId=${autocompleteFrame.frame.frameId}），将拆分输入与选择动作。`, 'info');

        const queryResult = await sendFrameMessage(tabId, billingFrame.frameId, {
          type: 'PLUS_CHECKOUT_FILL_ADDRESS_QUERY',
          source: 'background',
          payload: {
            fullName,
            addressSeed,
          },
        });
        if (queryResult?.error) {
          throw new Error(queryResult.error);
        }

        const suggestionResult = await sendFrameMessage(tabId, autocompleteFrame.frame.frameId, {
          type: 'PLUS_CHECKOUT_SELECT_ADDRESS_SUGGESTION',
          source: 'background',
          payload: {
            addressSeed,
          },
        });
        const suggestionError = suggestionResult?.error || '';
        if (suggestionError) {
          await addLog(`步骤 7：Google 地址推荐不可用，将改用本地地址字段兜底：${suggestionError}`, 'warn');
        }

        const structuredResult = await sendFrameMessage(tabId, billingFrame.frameId, {
          type: 'PLUS_CHECKOUT_ENSURE_BILLING_ADDRESS',
          source: 'background',
          payload: {
            addressSeed,
            overwriteStructuredAddress: Boolean(suggestionError),
          },
        });
        if (structuredResult?.error) {
          throw new Error(structuredResult.error);
        }

        result = {
          ...structuredResult,
          selectedAddressText: suggestionError ? '' : (suggestionResult?.selectedAddressText || ''),
        };
      } else {
        result = await sendFrameMessage(tabId, billingFrame.frameId, {
          type: 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS',
          source: 'background',
          payload: {
            fullName,
            addressSeed,
          },
        });

        if (result?.error) {
          throw new Error(result.error);
        }
      }

      await setState({
        plusCheckoutTabId: tabId,
        plusBillingCountryText: result?.countryText || '',
        plusBillingAddress: result?.structuredAddress || null,
      });
      await ensureFreeTrialAmount(tabId, state, {
        phaseLabel: '提交订阅前',
      });

      let redirectedToPayment = false;
      let lastSubmitError = '';
      for (let attempt = 1; attempt <= PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS; attempt += 1) {
        await addLog(
          attempt === 1
            ? '步骤 7：账单地址已填写完成，等待 3 秒让 checkout 完成校验...'
            : `步骤 7：准备第 ${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS} 次重新检测订阅按钮...`,
          attempt === 1 ? 'info' : 'warn'
        );
        await sleepWithStop(3000);
        await addLog('步骤 7：正在定位订阅按钮...', 'info');
        const subscribeFrame = await waitForSubscribeFrame(tabId, [
          { frameId: 0, url: '' },
          { frameId: paymentFrame.frameId, url: paymentFrame.frameUrl || '' },
          { frameId: billingFrame.frameId, url: billingFrame.frameUrl || '' },
        ]);
        const subscribeResult = await sendFrameMessage(tabId, subscribeFrame.frameId, {
          type: 'PLUS_CHECKOUT_CLICK_SUBSCRIBE',
          source: 'background',
          payload: {
            beforeClickDelayMs: attempt === 1 ? 700 : 1200,
            paymentMethod,
          },
        });
        if (subscribeResult?.error) {
          lastSubmitError = subscribeResult.error;
          await addLog(`步骤 7：点击订阅失败（${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS}）：${lastSubmitError}`, 'warn');
          continue;
        }

        const subscribeClicked = subscribeResult?.clicked !== false;
        const subscribeButtonText = String(subscribeResult?.subscribeButtonText || '').trim();
        const subscribeButtonStatus = String(subscribeResult?.subscribeButtonStatus || '').trim();
        if (subscribeClicked) {
          await addLog(`步骤 7：已点击订阅按钮，正在等待跳转到 ${paymentConfig.label}（${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS}）...`, 'info');
        } else {
          const buttonStateLabel = subscribeButtonText || subscribeButtonStatus || 'unknown';
          await addLog(`步骤 7：订阅按钮当前为「${buttonStateLabel}」，本轮未点击，正在等待页面是否跳转到 ${paymentConfig.label}（${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS}）...`, 'warn');
        }
        redirectedToPayment = await waitForPaymentRedirectAfterSubmit(tabId, paymentMethod);
        if (redirectedToPayment) {
          break;
        }
        lastSubmitError = subscribeClicked
          ? `点击订阅后 ${Math.round(PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS / 1000)} 秒内未跳转到 ${paymentConfig.label}`
          : `订阅按钮当前为「${subscribeButtonText || subscribeButtonStatus || 'unknown'}」，${Math.round(PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS / 1000)} 秒内未跳转到 ${paymentConfig.label}`;
        await addLog(`步骤 7：${lastSubmitError}，将重新检测订阅按钮。`, 'warn');
      }

      if (!redirectedToPayment) {
        throw new Error(`步骤 7：多次检测订阅按钮后仍未跳转到 ${paymentConfig.label}。${lastSubmitError}`);
      }

      await completeNodeFromBackground('plus-checkout-billing', {
        plusBillingCountryText: result?.countryText || '',
      });
    }

    return {
      executePlusCheckoutBilling,
    };
  }

  return {
    createPlusCheckoutBillingExecutor,
  };
});
