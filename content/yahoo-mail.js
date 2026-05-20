const YAHOO_MAIL_PREFIX = '[MultiPage:yahoo-mail]';
const YAHOO_INBOX_URL = 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX';
const YAHOO_SETTINGS_URL = 'https://mail.yahoo.com/n/settings/2';
const YAHOO_ROW_SCAN_LIMIT = 80;
console.log(YAHOO_MAIL_PREFIX, 'Content script loaded on', location.href);

// 监听后台发来的邮件轮询和临时别名创建请求。
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'POLL_EMAIL') {
    if (Number(message.step) === 4 || Number(message.step) === 8) {
      const error = `YAHOO_LEGACY_POLLING_DISABLED::步骤 ${message.step} 已禁用旧版 POLL_EMAIL 轮询，只允许 YAHOO_CHECK_TOP_MESSAGE 专用顶部邮件检查。`;
      log(`Yahoo：${error}`, 'warn');
      sendResponse({ error });
      return true;
    }

    resetStopState();
    handlePollEmail(message.step, message.payload || {}).then(sendResponse).catch((err) => {
      if (isStopError(err)) {
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'YAHOO_CHECK_TOP_MESSAGE') {
    resetStopState();
    handleCheckTopMessage(message.step, message.payload || {}).then(sendResponse).catch((err) => {
      if (isStopError(err)) {
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'YAHOO_READ_CURRENT_MESSAGE_CODE') {
    resetStopState();
    handleReadCurrentMessageCode(message.step, message.payload || {}).then(sendResponse).catch((err) => {
      if (isStopError(err)) {
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'YAHOO_OPEN_TOP_MESSAGE') {
    resetStopState();
    handleOpenTopMessage(message.step, message.payload || {}).then(sendResponse).catch((err) => {
      if (isStopError(err)) {
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'YAHOO_CREATE_TEMP_ALIAS') {
    resetStopState();
    handleCreateYahooTempAlias(message.payload || {}).then(sendResponse).catch((err) => {
      if (isStopError(err)) {
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'YAHOO_LOGIN_WITH_CREDENTIALS') {
    resetStopState();
    handleYahooLoginWithCredentials(message.payload || {}).then(sendResponse).catch((err) => {
      if (isStopError(err)) {
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      sendResponse({ error: err.message });
    });
    return true;
  }
});

// 规范化文本，压缩连续空白并去掉首尾空格。
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

// 规范化文本后统一转成小写，方便做模糊匹配。
function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

function joinUniqueTextParts(parts = []) {
  const seen = new Set();
  return normalizeText(parts
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    })
    .join(' '));
}

// 从邮件或页面文本中提取 6 位验证码。
function extractVerificationCode(text) {
  const source = String(text || '');
  const matchCn = source.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/i);
  if (matchCn) return matchCn[1];
  const matchEn = source.match(/(?:your\s+chatgpt\s+code\s+is|verification\s+code|code(?:\s+is)?)[^0-9]{0,16}(\d{6})/i);
  if (matchEn) return matchEn[1];
  const matchPlain = source.match(/\b(\d{6})\b/);
  return matchPlain ? matchPlain[1] : null;
}

function extractVerificationCodeWithPatterns(text, payload = {}) {
  const source = String(text || '');
  const patterns = Array.isArray(payload?.codePatterns) ? payload.codePatterns : [];

  for (const pattern of patterns) {
    try {
      const regex = pattern instanceof RegExp
        ? pattern
        : new RegExp(String(pattern?.source || pattern || ''), String(pattern?.flags || 'i'));
      const match = source.match(regex);
      const code = match?.[1] || match?.[0];
      const normalizedCode = String(code || '').match(/\b(\d{6})\b/)?.[1] || '';
      if (normalizedCode) return normalizedCode;
    } catch {}
  }

  return extractVerificationCode(source);
}

// 判断节点是否真实可见且占据页面空间。
function isVisibleElement(node) {
  if (!(node instanceof HTMLElement)) return false;
  const style = getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isElementInViewport(node) {
  if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
  const rect = node.getBoundingClientRect();
  const viewportWidth = Number(window.innerWidth) || document.documentElement?.clientWidth || 0;
  const viewportHeight = Number(window.innerHeight) || document.documentElement?.clientHeight || 0;
  if (!viewportWidth || !viewportHeight) return true;
  return rect.bottom > 0
    && rect.right > 0
    && rect.top < viewportHeight
    && rect.left < viewportWidth;
}

// 根据当前 URL 和页面文案判断是否像 Yahoo 未登录状态。
function looksLikeYahooLoggedOut() {
  const url = String(location.href || '').trim();

  if (/login\.yahoo\.com/i.test(url)) {
    return true;
  }

  if (/\/account\//i.test(url) && !/mail\.yahoo\.com/i.test(url)) {
    return true;
  }

  if (isYahooInboxPage(url) || isYahooSettingsPage(url)) {
    return false;
  }

  const mailboxIndicators = [
    '[data-test-id="message-list"]',
    '[data-test-id="virtual-list"]',
    '[role="main"]',
    'main',
    'a[href*="/n/inbox"]',
    'a[href*="/d/folders"]',
    'a[href*="/b/folders"]',
    'a[href*="/n/settings"]',
  ];

  if (mailboxIndicators.some((selector) => document.querySelector(selector))) {
    return false;
  }

  const bodyText = normalizeLowerText(document.body?.innerText || '');
  return /sign in to yahoo mail|yahoo mail sign in|登录 yahoo|登入 yahoo/.test(bodyText);
}

// 校验当前是否已登录 Yahoo Mail，不满足时直接抛错。
function ensureYahooLoggedIn(actionLabel = 'Yahoo 邮箱操作') {
  const url = String(location.href || '').trim();
  const hasMessageList = Boolean(document.querySelector('[data-test-id="message-list"]'));
  const hasMain = Boolean(document.querySelector('main'));

  if (looksLikeYahooLoggedOut()) {
    const bodySample = normalizeLowerText(document.body?.innerText || '').slice(0, 200);
    log(`Yahoo：登录态检测失败 url=${url} hasMessageList=${hasMessageList} hasMain=${hasMain} bodySample=${bodySample}`, 'warn');
    throw new Error(`${actionLabel}失败：当前未登录 Yahoo Mail，请先手动登录后重试。`);
  }

  log(`Yahoo：登录态检测通过 url=${url} hasMessageList=${hasMessageList} hasMain=${hasMain}`, 'info');
}

function isYahooLoginPage(url = location.href) {
  try {
    const parsed = new URL(String(url || ''), location.origin);
    return /(^|\.)login\.yahoo\.com$/i.test(parsed.hostname || '')
      || /(^|\.)guce\.yahoo\.com$/i.test(parsed.hostname || '');
  } catch {
    return /login\.yahoo\.com|guce\.yahoo\.com/i.test(String(url || ''));
  }
}

function findYahooLoginEmailInput() {
  return Array.from(document.querySelectorAll([
    'input#login-username',
    'input[name="username"]',
    'input[name="login"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
  ].join(','))).find((node) => node instanceof HTMLInputElement && isVisibleElement(node)) || null;
}

function findYahooLoginPasswordInput() {
  return Array.from(document.querySelectorAll([
    'input#login-passwd',
    'input[name="password"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
  ].join(','))).find((node) => node instanceof HTMLInputElement && isVisibleElement(node)) || null;
}

function findYahooLoginSubmitButton() {
  const selectors = [
    'button#login-signin',
    'input#login-signin',
    'button[name="signin"]',
    'input[name="signin"]',
    'button[type="submit"]',
    'input[type="submit"]',
  ];
  return Array.from(document.querySelectorAll(selectors.join(',')))
    .find((node) => node instanceof HTMLElement && isVisibleElement(node) && !node.disabled) || null;
}

async function waitForYahooLoginPasswordInput(timeout = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    throwIfStopped();
    const input = findYahooLoginPasswordInput();
    if (input) return input;
    await sleep(250);
  }
  return findYahooLoginPasswordInput();
}

async function clickYahooLoginButton(label) {
  const button = findYahooLoginSubmitButton();
  if (!button) {
    const activeInput = document.activeElement;
    if (activeInput instanceof HTMLElement) {
      activeInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
      activeInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
      return true;
    }
    return false;
  }
  try {
    button.scrollIntoView?.({ block: 'center', inline: 'center' });
  } catch {}
  await sleep(120);
  const rect = button.getBoundingClientRect();
  const x = Math.round(rect.left + Math.max(4, Math.min(rect.width / 2, rect.width - 4)));
  const y = Math.round(rect.top + Math.max(4, Math.min(rect.height / 2, rect.height - 4)));
  dispatchClickSequence(button, x, y);
  log(`Yahoo：已点击${label}`, 'info');
  return true;
}

async function handleYahooLoginWithCredentials(payload = {}) {
  if (!isYahooLoginPage()) {
    return { ok: true, skipped: true, reason: 'not_yahoo_login_page', url: location.href };
  }

  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  if (!email || !password) {
    return { ok: true, skipped: true, reason: 'missing_credentials' };
  }

  let passwordInput = findYahooLoginPasswordInput();
  if (!passwordInput) {
    const emailInput = findYahooLoginEmailInput();
    if (!emailInput) {
      throw new Error('Yahoo 登录页未找到邮箱输入框。');
    }
    fillInput(emailInput, email);
    log(`Yahoo：已填写登录邮箱 ${email}，准备进入密码页。`, 'info');
    await sleep(180);
    await clickYahooLoginButton('Yahoo 登录下一步按钮');
    passwordInput = await waitForYahooLoginPasswordInput();
  }

  if (!passwordInput) {
    throw new Error('Yahoo 登录页未进入密码输入步骤。');
  }

  fillInput(passwordInput, password);
  log('Yahoo：已填写登录密码，准备提交。', 'info');
  await sleep(180);
  await clickYahooLoginButton('Yahoo 登录提交按钮');
  return { ok: true, submitted: true };
}

// 判断指定地址是否属于 Yahoo 收件箱页面。
function isYahooInboxPage(url = location.href) {
  const value = String(url || '').trim();

  try {
    const parsed = new URL(value, location.origin);
    const isYahooMailHost = /(^|\.)mail\.yahoo\.com$/i.test(parsed.hostname);
    const isInboxPath = /^\/(?:n|d|b)\/(?:inbox|folders(?:\/\d+)?)/i.test(parsed.pathname || '');
    if (isYahooMailHost && isInboxPath) {
      return true;
    }
  } catch {}

  if (/\/(?:n|d|b)\/(?:inbox|folders(?:\/\d+)?)(?:[/?#].*)?$/i.test(value)) {
    return true;
  }

  if (document.querySelector('[data-test-id="message-list"], [data-test-id="virtual-list"]')) {
    return true;
  }

  return false;
}

// 根据页面文本判断是否像 Yahoo 设置页 DOM。
function looksLikeYahooSettingsDom(root = document) {
  const text = normalizeLowerText(root?.body?.innerText || root?.body?.textContent || root?.innerText || root?.textContent || '');
  return /一次性电子邮件地址|disposable email addresses|disposable email address|disposable address/.test(text)
    || /mailboxes|邮箱列表|auto-forwarding|自动转发/.test(text);
}

// 判断指定地址或 DOM 是否属于 Yahoo 设置页。
function isYahooSettingsPage(url = location.href) {
  const value = String(url || '').trim();
  if (/https:\/\/mail\.yahoo\.com\/(?:n|d|b)\/settings(?:\/2)?(?:[/?#].*)?$/i.test(value)) {
    return true;
  }
  if (/\/(?:n|d|b)\/settings(?:\/2)?(?:[/?#].*)?$/i.test(value)) {
    return true;
  }
  if (/\/settings(?:\/2)?(?:[/?#].*)?$/i.test(value)) {
    return true;
  }
  return looksLikeYahooSettingsDom(document);
}

// 规范化 Yahoo URL，去掉 hash 便于比较。
function normalizeComparableYahooUrl(url) {
  try {
    const value = new URL(String(url || ''), location.origin);
    value.hash = '';
    return value.toString();
  } catch {
    return String(url || '').trim();
  }
}

// 查找当前页面可用的 Yahoo“收件箱”入口，优先复用站内导航而不是直接要求后台重开。
function findYahooInboxLink() {
  const directSelectors = [
    'a[data-test-folder-name="Inbox"]',
    'a[href*="/n/inbox"]',
    'a[href*="/d/folders"]',
    'a[href*="/b/folders"]',
    'button[aria-label*="Inbox"]',
    'button[aria-label*="收件箱"]',
    '[role="button"][aria-label*="Inbox"]',
    '[role="button"][aria-label*="收件箱"]',
  ];

  for (const selector of directSelectors) {
    const matched = Array.from(document.querySelectorAll(selector)).find((node) => isVisibleElement(node));
    if (matched) {
      return matched;
    }
  }

  return Array.from(document.querySelectorAll('a[href], button, [role="button"]')).find((node) => {
    if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
    const href = String(node.getAttribute?.('href') || '').trim();
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return /\/n\/inbox/i.test(href) || /^(inbox|收件箱)$/.test(text) || /收件箱|inbox/.test(text);
  }) || null;
}

// 等待 Yahoo 收件箱列表真正可见，避免只是 URL 改了但列表尚未 ready。
async function waitForYahooInboxReady(timeout = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    throwIfStopped();
    if (isYahooInboxPage(location.href) && isYahooInboxListVisible()) {
      return true;
    }
    await sleep(250);
  }
  return isYahooInboxPage(location.href) && isYahooInboxListVisible();
}

// 确保当前处在 Yahoo 收件箱页；优先在当前页内自愈跳转到收件箱，失败后再交由后台重开。
async function ensureOnYahooInbox() {
  ensureYahooLoggedIn('读取 Yahoo 邮件');
  const currentUrl = normalizeComparableYahooUrl(location.href);
  const targetUrl = normalizeComparableYahooUrl(YAHOO_INBOX_URL);

  if (isYahooInboxPage(currentUrl) && isYahooInboxListVisible()) {
    return;
  }

  log(`Yahoo：当前未处于可读取的收件箱列表，先尝试在当前页内切回收件箱 current=${currentUrl} target=${targetUrl}`, 'warn');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    throwIfStopped();

    const inboxLink = findYahooInboxLink();
    if (inboxLink) {
      const rect = inboxLink.getBoundingClientRect();
      const clickX = Math.round(rect.left + Math.max(6, Math.min(rect.width / 2, Math.max(rect.width - 6, 6))));
      const clickY = Math.round(rect.top + Math.max(6, Math.min(rect.height / 2, Math.max(rect.height - 6, 6))));
      log(`Yahoo：第 ${attempt} 次尝试点击站内”收件箱”入口回到 inbox tag=${inboxLink.tagName || 'unknown'} pos=${clickX},${clickY}`, 'info');
      try {
        dispatchHoverSequence(inboxLink, clickX, clickY);
        await sleep(120);
        dispatchClickSequence(inboxLink, clickX, clickY);
        if (typeof inboxLink.click === 'function') inboxLink.click();
      } catch (err) {
        log(`Yahoo：收件箱链接点击失败 attempt=${attempt} error=${err?.message || String(err)}`, 'warn');
      }
      await sleep(1200);
      if (await waitForYahooInboxReady(5000)) {
        log(`Yahoo：已在当前页内成功切回收件箱，第 ${attempt} 次尝试完成`, 'ok');
        return;
      }
    }

    if (isYahooInboxPage(location.href)) {
      const refreshed = await refreshYahooInboxList(attempt);
      await sleep(1000);
      if (refreshed && await waitForYahooInboxReady(4000)) {
        log(`Yahoo：当前已位于收件箱 URL，经过第 ${attempt} 次页内刷新后列表已可读`, 'ok');
        return;
      }
    }
  }

  log(`Yahoo：当前不在目标收件箱页，且页内自愈失败，交由后台重开标签页 current=${normalizeComparableYahooUrl(location.href)} target=${targetUrl}`, 'warn');
  throw new Error(`YAHOO_INBOX_REOPEN_REQUIRED::${YAHOO_INBOX_URL}`);
}

// 确保当前处在 Yahoo 设置页，不在则尝试从站内入口切过去。
async function ensureOnYahooSettings() {
  ensureYahooLoggedIn('创建 Yahoo 临时邮箱');
  if (isYahooSettingsPage(location.href)) {
    log(`Yahoo：已位于设置页 href=${location.href}`, 'info');
    return;
  }

  log(`Yahoo：当前不在设置页，尝试使用站内入口切换 href=${location.href}`, 'warn');

  const settingsLink = Array.from(document.querySelectorAll('a[href], button, [role="button"]')).find((node) => {
    const href = node.getAttribute?.('href') || '';
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return /\/settings(?:\/2)?(?:[/?#].*)?$/i.test(href)
      || /settings/.test(text);
  });

  if (settingsLink) {
    try {
      settingsLink.click?.();
    } catch (err) {
      log(`Yahoo：设置链接点击失败 error=${err?.message || String(err)}`, 'warn');
    }
    await sleep(1200);
    if (isYahooSettingsPage(location.href)) {
      log(`Yahoo：点击设置入口后已进入设置页 href=${location.href}`, 'info');
      return;
    }
  }

  throw new Error(`YAHOO_SETTINGS_REOPEN_REQUIRED::${YAHOO_SETTINGS_URL}`);
}

// 等待给定选择器中任意一个在页面上变得可见。
async function waitForAnySelector(selectors, timeout = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    throwIfStopped();
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node && isVisibleElement(node)) {
        return node;
      }
    }
    await sleep(200);
  }
  throw new Error(`等待 Yahoo 页面元素超时：${selectors.join(' | ')}`);
}

// 判断节点是否像 Yahoo 收件箱中的邮件行。
function isLikelyYahooMessageRow(node) {
  if (!(node instanceof HTMLElement) || !isElementInViewport(node)) return false;
  const text = getYahooRowFullText(node);
  if (!text || text.length < 12) return false;

  const className = String(node.className || '');
  if (/\bH_A\b/.test(className) && /\bhd_n\b/.test(className) && /\bp_a\b/.test(className) && /\bL_0\b/.test(className) && /\bR_0\b/.test(className)) {
    return true;
  }

  const hasCheckbox = Boolean(node.querySelector('input[type="checkbox"], [role="checkbox"], [data-test-id="checkbox"]'));
  const hasTime = Boolean(node.querySelector('time, [datetime]')) || /\b\d{1,2}:\d{2}\s?(?:am|pm)\b/i.test(text) || /\b\d{1,2}:\d{2}\b/.test(text);
  const hasMailKeyword = /openai|no-?reply@|signin\.aws|amazon\s+web\s+services|aws|构建者|chatgpt|verification|verify|验证码|安全码|临时/i.test(text) || /@/.test(text) || /\b\d{6}\b/.test(text);
  const hasSender = /OpenAI|ChatGPT|no-?reply|signin\.aws|Amazon Web Services/i.test(text);

  return hasMailKeyword && (hasCheckbox || hasTime || hasSender);
}

function getYahooMessageQueryRoots() {
  const roots = [
    document.querySelector('[data-test-id="message-list"]'),
    document.querySelector('[data-test-id="virtual-list"]'),
    document.querySelector('#mail-app-component'),
    document.querySelector('main [role="list"]'),
    document.querySelector('main ul'),
    document.querySelector('main ol'),
    document.querySelector('main'),
    document,
  ];
  return roots.filter((root, index, array) => root && array.indexOf(root) === index);
}

function collectLimitedNodes(root, selector, limit = YAHOO_ROW_SCAN_LIMIT) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return [];
  }
  const nodes = [];
  for (const node of root.querySelectorAll(selector)) {
    nodes.push(node);
    if (nodes.length >= limit) {
      break;
    }
  }
  return nodes;
}

// 收集并排序当前页面上的 Yahoo 邮件行。
function getMessageRows() {
  const roots = getYahooMessageQueryRoots();
  const exactRows = roots.flatMap((root) => collectLimitedNodes(root, 'li.H_A.hd_n.p_a.L_0.R_0'))
    .filter((node) => isLikelyYahooMessageRow(node))
    .filter((node, index, arr) => arr.indexOf(node) === index)
    .sort((left, right) => {
      const leftTop = parseFloat(String(left.style?.top || '').replace('px', ''));
      const rightTop = parseFloat(String(right.style?.top || '').replace('px', ''));
      const safeLeftTop = Number.isFinite(leftTop) ? leftTop : left.getBoundingClientRect().top;
      const safeRightTop = Number.isFinite(rightTop) ? rightTop : right.getBoundingClientRect().top;
      if (Math.abs(safeLeftTop - safeRightTop) > 1) return safeLeftTop - safeRightTop;
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.left - rightRect.left;
    });
  if (exactRows.length) return exactRows;

  const selectors = [
    '[data-test-id="message-list-item"]',
    '[data-test-id*="message-list-item"]',
    '[data-test-id="message-list"] [role="row"]',
    '[data-test-id="message-list"] li',
    '[data-test-id="message-list"] > div',
    '[data-test-id="virtual-list"] [role="row"]',
    '[data-test-id="virtual-list"] li',
    'div[role="row"]',
    'ul[role="list"] li',
    'main li',
    'table tr',
  ];

  for (const selector of selectors) {
    const rows = roots.flatMap((root) => collectLimitedNodes(root, selector))
      .filter((node) => isLikelyYahooMessageRow(node))
      .filter((node, index, arr) => arr.indexOf(node) === index)
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        if (Math.abs(leftRect.top - rightRect.top) > 4) return leftRect.top - rightRect.top;
        return leftRect.left - rightRect.left;
      });
    if (rows.length) {
      return rows;
    }
  }

  return [];
}

function isKiroYahooTopMessagePayload(payload = {}) {
  if (String(payload?.flowId || '').trim().toLowerCase() === 'kiro') {
    return true;
  }
  const filters = [
    ...(Array.isArray(payload?.senderFilters) ? payload.senderFilters : []),
    ...(Array.isArray(payload?.subjectFilters) ? payload.subjectFilters : []),
    ...(Array.isArray(payload?.requiredKeywords) ? payload.requiredKeywords : []),
  ].map(normalizeLowerText).join(' ');
  return /signin\.aws|aws builder id|构建者|kiro/.test(filters);
}

function getFastVisibleYahooMessageRows(limit = 12) {
  const selectors = [
    'li[data-test-id="message-list-item"]',
    '[data-test-id="message-list"] li[data-test-id="message-list-item"]',
    '[data-test-id="virtual-list"] li[data-test-id="message-list-item"]',
    'li.H_A.hd_n.p_a.L_0.R_0',
  ];
  const rows = [];
  for (const selector of selectors) {
    for (const row of document.querySelectorAll(selector)) {
      if (!(row instanceof HTMLElement)) continue;
      if (!isElementInViewport(row)) continue;
      if (rows.includes(row)) continue;
      rows.push(row);
      if (rows.length >= limit) break;
    }
    if (rows.length >= limit) break;
  }
  return rows.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    if (Math.abs(leftRect.top - rightRect.top) > 4) return leftRect.top - rightRect.top;
    return leftRect.left - rightRect.left;
  });
}

function rowLooksLikeKiroAwsMessage(text = '') {
  const lower = normalizeLowerText(text);
  return /no-?reply@signin\.aws|signin\.aws|amazon web services|aws/.test(lower)
    && /构建者|builder id|verification|验证码|code/.test(lower);
}

function buildYahooNoCodeTopRowResult(row, rowText, reason, topRowTimestamp = 0) {
  return {
    ok: false,
    code: null,
    reason,
    preview: rowText.slice(0, 200),
    emailTimestamp: topRowTimestamp || Date.now(),
    topMessageFingerprint: buildYahooTopMessageFingerprint(row, rowText, null, topRowTimestamp || Date.now()),
  };
}

function handleKiroYahooTopMessageFastPath(step, payload = {}) {
  const rows = getFastVisibleYahooMessageRows(12);
  log(`Yahoo：Kiro 快速顶部邮件扫描 rows=${rows.length}`, 'warn');
  if (!rows.length) {
    return {
      ok: false,
      code: null,
      reason: 'Kiro 快速扫描未找到可见 Yahoo 邮件行',
      preview: '',
      emailTimestamp: Date.now(),
      topMessageFingerprint: '',
    };
  }

  const topRow = rows[0];
  const rowText = getYahooRowFullText(topRow);
  const topRowTimestamp = getRowTimestamp(topRow) || Date.now();
  if (!rowText) {
    return buildYahooNoCodeTopRowResult(topRow, '', 'Kiro 快速扫描顶部邮件没有可读取文本', topRowTimestamp);
  }

  const filterMatched = rowMatchesFilters(rowText, payload) || rowLooksLikeKiroAwsMessage(rowText);
  if (!filterMatched) {
    return buildYahooNoCodeTopRowResult(topRow, rowText, 'Kiro 快速扫描顶部邮件未命中 AWS/Kiro 过滤条件', topRowTimestamp);
  }

  const code = extractVerificationCodeWithPatterns(rowText, payload);
  if (!code) {
    return buildYahooNoCodeTopRowResult(topRow, rowText, 'Kiro 快速扫描顶部 AWS/Kiro 邮件中未提取到验证码', topRowTimestamp);
  }

  const rowCode = { code, text: rowText, source: 'fast-row-snippet' };
  const freshness = evaluateYahooTopMessageFreshness(topRow, rowText, rowCode, topRowTimestamp, payload, true);
  if (!freshness.freshnessMatched) {
    log(`Yahoo：Kiro 快速扫描验证码 ${code} 缺少新鲜度证据：${freshness.freshnessReason}`, 'warn');
    return {
      ok: false,
      code: null,
      reason: `顶部验证码存在，但缺少本轮新邮件证据：${freshness.freshnessReason}`,
      preview: rowText.slice(0, 200),
      emailTimestamp: topRowTimestamp,
      topMessageFingerprint: freshness.topMessageFingerprint,
    };
  }

  log(`Yahoo：Kiro 快速扫描已从顶部邮件行提取验证码 ${code} preview=${rowText.slice(0, 180)}`, 'warn');
  return {
    ok: true,
    code,
    emailTimestamp: topRowTimestamp,
    preview: rowText.slice(0, 200),
    topMessageFingerprint: freshness.topMessageFingerprint,
    freshnessMatched: freshness.freshnessMatched,
    freshnessReason: freshness.freshnessReason,
  };
}

// 取出最靠前或时间最靠上的候选邮件行。
function getLatestYahooCodeRow() {
  const rows = getMessageRows();
  if (!rows.length) return null;

  return findTopMessageRow(rows);
}

// 判断当前是否已经展示了收件箱列表。
function isYahooInboxListVisible() {
  const listRoot = document.querySelector('[data-test-id="message-list"], [data-test-id="virtual-list"], main [role="list"], main ul, main ol, #mail-app-component');
  if (listRoot && isVisibleElement(listRoot)) {
    return true;
  }
  return getYahooMessageQueryRoots().some((root) => collectLimitedNodes(root, 'li.H_A.hd_n.p_a.L_0.R_0, [data-test-id="message-list-item"], [data-test-id*="message-list-item"], [data-test-id="message-list"] [role="row"], [data-test-id="virtual-list"] [role="row"], div[role="row"], table tr', 8)
    .some((node) => isLikelyYahooMessageRow(node)));
}

// 尝试通过刷新按钮或收件箱入口拉取最新邮件列表。
async function refreshYahooInboxList(attempt) {
  try {
    const refreshBtnCandidates = Array.from(document.querySelectorAll('button, [role="button"], span, div')).filter((node) => {
      if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
      const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
      return /refresh|check for new|new mail|更新|刷新|检查新邮件/.test(text);
    });

    const refreshBtn = refreshBtnCandidates[0]
      || document.querySelector('button[data-test-id="icon-btn-refresh"]')
      || document.querySelector('button[aria-label*="Refresh"], button[title*="Refresh"], button[aria-label*="刷新"], button[title*="刷新"]');

    if (refreshBtn instanceof HTMLElement && isVisibleElement(refreshBtn)) {
      log(`Yahoo：尝试点击刷新按钮拉取新邮件（第 ${attempt} 次）...`, 'info');
      simulateClick(refreshBtn);
      await sleep(1000);
      if (isYahooInboxListVisible()) return true;
    }

    const inboxLinks = Array.from(document.querySelectorAll('a[data-test-folder-name="Inbox"], a[href*="/n/inbox"], a[href*="/d/folders"], a[href*="/b/folders"], button[aria-label*="Inbox"], button[aria-label*="收件箱"]'))
      .filter((node) => node instanceof HTMLElement && isVisibleElement(node));
    const inboxBtn = inboxLinks[0] || null;

    if (inboxBtn) {
      const rect = inboxBtn.getBoundingClientRect();
      const clickX = Math.round(rect.left + Math.min(Math.max(rect.width / 2, 5), Math.max(rect.width - 5, 5)));
      const clickY = Math.round(rect.top + Math.min(Math.max(rect.height / 2, 5), Math.max(rect.height - 5, 5)));
      log(`Yahoo：尝试点击收件箱按钮刷新列表（第 ${attempt} 次）...`, 'info');
      dispatchHoverSequence(inboxBtn, clickX, clickY);
      await sleep(120);
      dispatchClickSequence(inboxBtn, clickX, clickY);
      try {
        if (typeof inboxBtn.click === 'function') inboxBtn.click();
      } catch (err) {
        log(`Yahoo：收件箱按钮点击失败 error=${err?.message || String(err)}`, 'warn');
      }
      await sleep(1000);
      if (isYahooInboxListVisible()) return true;
    }
  } catch (error) {
    log(`Yahoo：尝试刷新收件箱时发生异常忽略：${error?.message || error}`, 'warn');
  }

  return isYahooInboxListVisible();
}

// 直接从邮件行文本里提取 6 位数字验证码。
function extractSixDigitCodeFromLatestRow(row) {
  if (!(row instanceof HTMLElement)) return null;

  const text = getYahooRowFullText(row);

  const match = text.match(/\b(\d{6})\b/);
  if (!match) return null;

  return {
    code: match[1],
    text,
    source: 'row-text',
  };
}

function getYahooRowFullText(row) {
  if (!(row instanceof HTMLElement)) return '';
  const explicitTextNodes = Array.from(row.querySelectorAll([
    '[id^="email-sender-"]',
    '[id^="email-subject-snippet-"]',
    '[id^="email-subject-"]',
    '[id^="email-snippet-"]',
    '[id^="email-date-"]',
    '[title]',
  ].join(','))).map((node) => [
    node.getAttribute?.('aria-label'),
    node.getAttribute?.('title'),
    node.innerText,
    node.textContent,
  ].filter(Boolean).join(' '));

  return joinUniqueTextParts([
    row.getAttribute('aria-label'),
    row.getAttribute('title'),
    row.innerText,
    row.textContent,
    ...explicitTextNodes,
  ]);
}

// 获取邮件行的可读文本。
function getRowText(row) {
  return getYahooRowFullText(row);
}

// 找出列表中最靠上的可见邮件行。
function findTopMessageRow(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row instanceof HTMLElement && isElementInViewport(row))
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      if (Math.abs(leftRect.top - rightRect.top) > 4) return leftRect.top - rightRect.top;
      return leftRect.left - rightRect.left;
    })[0] || null;
}

// 尝试把 Yahoo 邮件时间文本解析成时间戳。
function parseYahooMailboxTimestampCandidate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const relativeCnMatch = text.match(/(\d{1,3})\s*(秒|分钟|分|小时|天)前/);
  if (relativeCnMatch) {
    const amount = Number(relativeCnMatch[1]);
    const unit = relativeCnMatch[2] || '';
    const unitMs = /秒/.test(unit)
      ? 1000
      : (/分|分钟/.test(unit)
        ? 60 * 1000
        : (/小时/.test(unit)
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000));
    return Date.now() - (amount * unitMs);
  }

  const relativeEnMatch = text.match(/(\d{1,3})\s*(second|sec|minute|min|hour|hr|day)s?\s*ago/i);
  if (relativeEnMatch) {
    const amount = Number(relativeEnMatch[1]);
    const unit = normalizeLowerText(relativeEnMatch[2] || '');
    const unitMs = /second|sec/.test(unit)
      ? 1000
      : (/minute|min/.test(unit)
        ? 60 * 1000
        : (/hour|hr/.test(unit)
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000));
    return Date.now() - (amount * unitMs);
  }

  if (/^(just now|刚刚|刚才)$/i.test(text)) {
    return Date.now();
  }

  const directParsed = Date.parse(text);
  if (Number.isFinite(directParsed)) {
    return directParsed;
  }

  const localizedDateTimeMatch = text.match(/(\d{1,2})月(\d{1,2})日(?:\s*(上午|下午))?\s*(\d{1,2}):(\d{2})/);
  if (localizedDateTimeMatch) {
    const now = new Date();
    let hour = Number(localizedDateTimeMatch[4]);
    const minute = Number(localizedDateTimeMatch[5]);
    const meridiem = localizedDateTimeMatch[3] || '';
    if (meridiem === '下午' && hour < 12) hour += 12;
    if (meridiem === '上午' && hour === 12) hour = 0;
    const parsed = new Date(now.getFullYear(), Number(localizedDateTimeMatch[1]) - 1, Number(localizedDateTimeMatch[2]), hour, minute, 0, 0).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const timeMatch = text.match(/(?:(今天|today|昨天|yesterday)\s*)?(?:(上午|下午)\s*)?(\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
  if (timeMatch) {
    let hour = Number(timeMatch[3]);
    const minute = Number(timeMatch[4]);
    const dayToken = normalizeLowerText(timeMatch[1] || '');
    const meridiemCn = timeMatch[2] || '';
    const meridiemEn = normalizeLowerText(timeMatch[5] || '');
    if ((meridiemCn === '下午' || meridiemEn === 'pm') && hour < 12) hour += 12;
    if ((meridiemCn === '上午' || meridiemEn === 'am') && hour === 12) hour = 0;
    const now = new Date();
    if (dayToken === '昨天' || dayToken === 'yesterday') {
      now.setDate(now.getDate() - 1);
    }
    now.setHours(hour, minute, 0, 0);
    return now.getTime();
  }

  return null;
}

// 从邮件行的多个时间候选字段里提取时间戳。
function getRowTimestamp(row) {
  const timeNode = row.querySelector('time, [datetime], [title]');
  const candidates = [
    timeNode?.getAttribute?.('datetime'),
    timeNode?.getAttribute?.('title'),
    timeNode?.textContent,
    row.getAttribute?.('aria-label'),
    row.innerText,
    row.textContent,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseYahooMailboxTimestampCandidate(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

// 判断邮件文本是否命中发件人或主题过滤条件。
function rowMatchesFilters(text, payload) {
  const lower = normalizeLowerText(text);
  const senderFilters = (payload.senderFilters || []).map(normalizeLowerText).filter(Boolean);
  const subjectFilters = (payload.subjectFilters || []).map(normalizeLowerText).filter(Boolean);
  const senderMatch = senderFilters.length === 0 ? true : senderFilters.some((item) => lower.includes(item));
  const subjectMatch = subjectFilters.length === 0 ? true : subjectFilters.some((item) => lower.includes(item));
  return senderMatch || subjectMatch;
}

// 预编译正则表达式以提升性能
const YAHOO_FINGERPRINT_PATTERNS = [
  /\b\d{1,3}\s*(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)\s+ago\b/gi,
  /\b(?:just now|today|yesterday)\b/gi,
  /\d{1,3}\s*(?:秒|分钟|分|小时|天)前/g,
  /(?:今天|昨天)\s*/g,
  /(?:上午|下午)?\s*\d{1,2}:\d{2}(?:\s*(?:am|pm))?/gi,
  /\s+/g
];

function normalizeYahooFingerprintText(value) {
  let text = normalizeText(String(value || ''));

  // 使用预编译的正则表达式批量替换
  for (const pattern of YAHOO_FINGERPRINT_PATTERNS) {
    text = text.replace(pattern, ' ');
  }

  return text.trim().slice(0, 240);
}

function buildYahooTopMessageFingerprint(row, rowText, rowCode, rowTimestamp) {
  if (!(row instanceof HTMLElement)) {
    return '';
  }

  const normalizedRowText = normalizeYahooFingerprintText(rowText);
  const identityParts = [
    row.getAttribute('data-id'),
    row.getAttribute('data-test-id'),
    row.getAttribute('id'),
    row.dataset?.testid,
    row.dataset?.id,
    row.querySelector('a[href]')?.getAttribute('href'),
    row.querySelector('time, [datetime]')?.getAttribute('datetime'),
    rowCode?.code || '',
    normalizedRowText,
  ].map((item) => normalizeText(item)).filter(Boolean);

  return identityParts.join(' | ');
}

function evaluateYahooTopMessageFreshness(row, rowText, rowCode, rowTimestamp, payload = {}, filterMatched = false) {
  const topMessageFingerprint = buildYahooTopMessageFingerprint(row, rowText, rowCode, rowTimestamp);
  const previousTopMessageFingerprint = normalizeText(payload.previousTopMessageFingerprint || '');
  const previousAcceptedEmailTimestamp = Math.max(0, Number(payload.previousAcceptedEmailTimestamp || 0) || 0);
  const requestedAt = Math.max(0, Number(payload.requestedAt || 0) || 0);
  const freshnessSkewMs = Math.max(60000, Number(payload.yahooFreshnessSkewMs || 180000) || 180000);
  const topRowCodeFallbackMatched = Boolean(payload.yahooTopRowOnly && rowCode?.code);

  const fingerprintChanged = Boolean(previousTopMessageFingerprint)
    && Boolean(topMessageFingerprint)
    && topMessageFingerprint !== previousTopMessageFingerprint;
  const timestampNotOlderThanRequest = requestedAt > 0
    && rowTimestamp > 0
    && rowTimestamp >= requestedAt - freshnessSkewMs;
  const timestampAdvancedBeyondPreviousSuccess = previousAcceptedEmailTimestamp > 0
    && rowTimestamp > 0
    && rowTimestamp > previousAcceptedEmailTimestamp;
  const bootstrapFallbackAllowed = !previousTopMessageFingerprint
    && previousAcceptedEmailTimestamp <= 0
    && requestedAt > 0
    && Boolean(payload.yahooTopRowOnly)
    && Boolean(rowCode?.code)
    && (Boolean(filterMatched) || topRowCodeFallbackMatched);

  let freshnessMatched = false;
  let freshnessReason = '未获得本轮新邮件证据';

  if (timestampNotOlderThanRequest) {
    freshnessMatched = true;
    freshnessReason = `邮件时间接近本轮重发时间 (${rowTimestamp} >= ${requestedAt} - ${freshnessSkewMs})`;
  } else if (timestampAdvancedBeyondPreviousSuccess) {
    freshnessMatched = true;
    freshnessReason = `邮件时间晚于上次已接受邮件 (${rowTimestamp} > ${previousAcceptedEmailTimestamp})`;
  } else if (fingerprintChanged) {
    freshnessMatched = true;
    freshnessReason = '顶部邮件指纹相较上一轮观察已发生变化';
  } else if (bootstrapFallbackAllowed) {
    freshnessMatched = true;
    freshnessReason = '缺少历史基线，当前顶部验证码邮件按首次候选放行';
  }

  return {
    topMessageFingerprint,
    freshnessMatched,
    freshnessReason,
    previousTopMessageFingerprint,
    previousAcceptedEmailTimestamp,
    requestedAt,
    freshnessSkewMs,
    topRowCodeFallbackMatched,
    fingerprintChanged,
    timestampNotOlderThanRequest,
    timestampAdvancedBeyondPreviousSuccess,
    bootstrapFallbackAllowed,
  };
}

function findYahooMessageOpenTarget(row) {
  if (!(row instanceof HTMLElement)) return null;
  const selectors = [
    '[data-test-id="message-list-item"]',
    '[data-test-id*="message-list-item"]',
    '[data-test-id*="subject"]',
    '[data-test-id*="snippet"]',
    'a[href*="/d/"]',
    '[role="link"]',
  ];
  for (const selector of selectors) {
    const target = row.matches?.(selector) ? row : row.querySelector(selector);
    if (target instanceof HTMLElement && isElementInViewport(target)) {
      return target;
    }
  }
  return row;
}

function getYahooMessageOpenClickPoint(row, target = null) {
  const rowRect = row?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
  const targetRect = target?.getBoundingClientRect?.() || rowRect;
  const usableRect = targetRect.width > 40 && targetRect.height > 8 ? targetRect : rowRect;
  const relativeSafeX = Math.max(140, Math.min(usableRect.width * 0.42, usableRect.width - 80));
  const x = Math.round(usableRect.left + Math.max(8, relativeSafeX));
  const y = Math.round(usableRect.top + Math.max(6, Math.min(usableRect.height / 2, usableRect.height - 6)));
  return { x, y };
}

function dispatchYahooMessageOpenSequence(target, x, y) {
  const hit = document.elementFromPoint?.(x, y);
  const clickTarget = hit?.closest?.('[data-test-id*="message-list-item"], [role="link"], a, span, div')
    || hit
    || target;
  const finalTarget = clickTarget instanceof HTMLElement ? clickTarget : target;

  dispatchHoverSequence(finalTarget, x, y);
  dispatchClickSequence(finalTarget, x, y);
  try {
    finalTarget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  } catch {}
  try {
    finalTarget.focus?.();
    finalTarget.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
    finalTarget.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter' }));
  } catch {}
  try { if (typeof finalTarget.click === 'function') finalTarget.click(); } catch {}
}

async function waitForYahooMessageDetailText(rowText = '', payload = {}, timeoutMs = 6500) {
  const startedAt = Date.now();
  let latestText = '';
  while (Date.now() - startedAt < timeoutMs) {
    throwIfStopped();
    latestText = normalizeText(document.body?.innerText || document.body?.textContent || '');
    const combinedText = normalizeText([rowText, latestText].filter(Boolean).join(' '));
    if (extractVerificationCodeWithPatterns(combinedText, payload)) {
      return latestText;
    }
    await sleep(350);
  }
  return latestText;
}

async function clickYahooMessageOpenTarget(target, row, label = 'primary') {
  const { x: clickX, y: clickY } = getYahooMessageOpenClickPoint(row, target);
  log(`Yahoo：尝试打开顶部邮件详情 click=${label} target=${target?.tagName || 'unknown'} point=${clickX},${clickY}`, 'info');
  dispatchYahooMessageOpenSequence(target, clickX, clickY);
  await sleep(120);
}

function scheduleYahooMessageOpenTarget(target, row, label = 'scheduled') {
  if (!(target instanceof HTMLElement)) return false;
  const { x: clickX, y: clickY } = getYahooMessageOpenClickPoint(row, target);
  log(`Yahoo：准备异步打开顶部邮件详情 click=${label} target=${target?.tagName || 'unknown'} point=${clickX},${clickY}`, 'info');
  setTimeout(() => {
    try {
      dispatchYahooMessageOpenSequence(target, clickX, clickY);
    } catch (error) {
      log(`Yahoo：异步打开顶部邮件详情失败 error=${error?.message || String(error)}`, 'warn');
    }
  }, 30);
  return true;
}

// 点击邮件行并读取正文文本。
async function openRowAndReadText(row, rowText = '', payload = {}) {
  const link = findYahooMessageOpenTarget(row);
  if (!(link instanceof HTMLElement)) {
    return normalizeText(document.body?.innerText || document.body?.textContent || '');
  }

  await clickYahooMessageOpenTarget(link, row, 'subject');
  let detailText = await waitForYahooMessageDetailText(rowText, payload, 3000);
  if (extractVerificationCodeWithPatterns(normalizeText([rowText, detailText].join(' ')), payload)) {
    return detailText;
  }

  if (isYahooInboxListVisible()) {
    log('Yahoo：第一次点击后仍停留在收件箱列表，改用邮件行安全区域重试打开详情。', 'warn');
    await clickYahooMessageOpenTarget(row, row, 'row-safe-area');
  }

  detailText = await waitForYahooMessageDetailText(rowText, payload, 6500);
  return detailText;
}

async function openTopRowAndReadVerificationCode(row, rowText, payload = {}) {
  log('Yahoo：顶部目标邮件行未直接露出验证码，正在点进邮件详情读取正文。', 'warn');
  if (payload?.deferDetailReadAfterOpen !== false) {
    return {
      code: null,
      text: rowText,
      source: 'message-detail-required',
      needsOpenDetails: true,
      needsDetailRead: true,
    };
  }

  const detailText = await openRowAndReadText(row, rowText, payload);
  const combinedText = normalizeText([rowText, detailText].filter(Boolean).join(' '));
  const code = extractVerificationCodeWithPatterns(combinedText, payload);
  if (!code) {
    log(`Yahoo：邮件详情正文仍未提取到验证码 preview=${combinedText.slice(0, 240)}`, 'warn');
    return null;
  }

  log(`Yahoo：已从邮件详情正文提取验证码 ${code}`, 'warn');
  return {
    code,
    text: combinedText,
    source: 'message-detail',
  };
}

async function handleReadCurrentMessageCode(step, payload = {}) {
  ensureYahooLoggedIn('读取 Yahoo 邮件正文');
  const text = await waitForYahooMessageDetailText('', payload, 12000);
  const code = extractVerificationCodeWithPatterns(text, payload);
  if (!code) {
    log(`Yahoo：步骤 ${step} 当前邮件详情页未提取到验证码 preview=${text.slice(0, 240)}`, 'warn');
    return {
      ok: false,
      code: null,
      reason: '当前邮件详情页未提取到验证码',
      preview: text.slice(0, 200),
      emailTimestamp: Date.now(),
    };
  }

  log(`Yahoo：步骤 ${step} 已从当前邮件详情页提取验证码 ${code}`, 'warn');
  return {
    ok: true,
    code,
    emailTimestamp: Date.now(),
    preview: text.slice(0, 200),
    freshnessMatched: true,
    freshnessReason: '已打开顶部邮件详情并读取正文',
  };
}

async function handleOpenTopMessage(step, payload = {}) {
  await ensureOnYahooInbox();
  const rows = getMessageRows();
  const topRow = getLatestYahooCodeRow() || findTopMessageRow(rows);
  if (!topRow) {
    return {
      ok: false,
      detailOpened: false,
      reason: '未找到可打开的 Yahoo 顶部邮件行',
    };
  }
  const rowText = getRowText(topRow);
  const filterMatched = rowMatchesFilters(rowText, payload);
  if (!filterMatched && !payload?.forceOpenTopMessage) {
    return {
      ok: false,
      detailOpened: false,
      reason: '顶部邮件未命中过滤条件，未打开详情',
      preview: rowText.slice(0, 200),
    };
  }
  const target = findYahooMessageOpenTarget(topRow);
  const scheduled = scheduleYahooMessageOpenTarget(target, topRow, 'open-command');
  return {
    ok: scheduled,
    detailOpened: scheduled,
    preview: rowText.slice(0, 200),
    emailTimestamp: getRowTimestamp(topRow) || Date.now(),
    topMessageFingerprint: buildYahooTopMessageFingerprint(topRow, rowText, null, getRowTimestamp(topRow) || Date.now()),
  };
}

// 从邮件行中的 lq_x 结构里提取验证码。
function getLatestLqxCodeFromRow(row) {
  if (!(row instanceof HTMLElement)) return null;
  const nodes = Array.from(row.querySelectorAll('.lq_x')).filter((node) => isVisibleElement(node));
  if (!nodes.length) return null;

  const latestNode = nodes.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    if (Math.abs(leftRect.top - rightRect.top) > 6) return leftRect.top - rightRect.top;
    return leftRect.left - rightRect.left;
  })[0] || null;

  if (!latestNode) return null;

  const text = normalizeText(latestNode.innerText || latestNode.textContent || latestNode.getAttribute?.('aria-label') || '');
  const code = extractVerificationCode(text);
  return code ? { code, text, source: 'lq_x' } : null;
}

// 从邮件行内的可见文本片段里提取验证码。
function getTopRowInlineCode(row) {
  if (!(row instanceof HTMLElement)) return null;

  const fullText = getYahooRowFullText(row);
  const fullTextCode = extractVerificationCode(fullText);
  if (fullTextCode) {
    return { code: fullTextCode, text: fullText, source: 'full-row-text' };
  }

  const candidates = Array.from(row.querySelectorAll('span, div, a')).filter((node) => {
    if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
    const text = normalizeText(node.innerText || node.textContent || node.getAttribute?.('aria-label') || '');
    return /\b\d{6}\b/.test(text) || /verification|验证码|临时验证码|code|继续/.test(text);
  }).map((node) => {
    const text = normalizeText(node.innerText || node.textContent || node.getAttribute?.('aria-label') || '');
    const code = extractVerificationCode(text);
    const rect = node.getBoundingClientRect();
    const score = (code ? 100 : 0)
      + (/verification|验证码|临时验证码|code/.test(text) ? 20 : 0)
      + (/openai|noreply@|chatgpt/.test(text) ? 5 : 0)
      - Math.round(rect.left / 100)
      - Math.round(rect.top / 50);
    return { node, text, code, score, rect };
  }).filter((item) => item.code);

  if (!candidates.length) return null;

  const best = candidates.sort((left, right) => right.score - left.score || left.rect.top - right.rect.top || left.rect.left - right.rect.left)[0];
  return best ? { code: best.code, text: best.text, source: 'inline-row' } : null;
}

// 从邮件详情页尽量返回到收件箱列表视图。
async function returnToYahooInboxListFromMessageView() {
  if (isYahooInboxListVisible()) {
    return true;
  }

  const backCandidates = [
    'button[aria-label^="Back to"]',
    'button[title^="Back to"]',
    'button[aria-label*="返回"]',
    'button[title*="返回"]',
    'a[aria-label*="Inbox"]',
    'a[title*="Inbox"]',
    'a[href*="/n/inbox"]',
    'a[href*="/d/folders"]',
    'a[href*="/b/folders"]',
    'button[aria-label*="Inbox"]',
    'button[aria-label*="收件箱"]',
  ];

  for (const selector of backCandidates) {
    const btn = document.querySelector(selector);
    if (!(btn instanceof HTMLElement) || !isVisibleElement(btn)) continue;
    log(`Yahoo：尝试返回收件箱 selector=${selector}`, 'info');
    simulateClick(btn);
    await sleep(1500);
    if (isYahooInboxListVisible()) {
      return true;
    }
  }

  if (history.length > 1) {
    try {
      log('Yahoo：未找到明确返回按钮，尝试 history.back() 返回收件箱', 'warn');
      history.back();
      await sleep(2000);
      if (isYahooInboxListVisible()) {
        return true;
      }
    } catch (err) {
      log(`Yahoo：history.back() 失败 error=${err?.message || String(err)}`, 'warn');
    }
  }

  return false;
}

// 在两次轮询之间做一次软等待，并记录原因。
async function addSoftInboxPollDelay(intervalMs, attempt, maxAttempts, reason = '') {
  const seconds = Math.max(1, Math.round(intervalMs / 1000));
  log(`Yahoo：第 ${attempt}/${maxAttempts} 次检查未命中验证码，等待 ${seconds} 秒后再次读取当前收件箱。${reason ? `原因：${reason}` : ''}`, 'info');
  await sleep(intervalMs);
}

// 刷新收件箱前先保证还停留在正确页面。
async function refreshInbox(attempt) {
  ensureYahooLoggedIn('刷新 Yahoo 邮箱');
  const currentUrl = normalizeComparableYahooUrl(location.href);

  if (!isYahooInboxPage(currentUrl)) {
    log(`Yahoo：当前页不属于 all 收件箱路径，要求后台先回到 ${YAHOO_INBOX_URL} 再刷新。href=${location.href}`, 'warn');
    throw new Error(`YAHOO_INBOX_REOPEN_REQUIRED::${YAHOO_INBOX_URL}`);
  }

  if (!isYahooInboxListVisible()) {
    const returned = await returnToYahooInboxListFromMessageView();
    if (!returned) {
      log(`Yahoo：当前不在可刷新的收件箱列表视图，要求后台先回到 ${YAHOO_INBOX_URL} 再刷新。href=${location.href}`, 'warn');
      throw new Error(`YAHOO_INBOX_REOPEN_REQUIRED::${YAHOO_INBOX_URL}`);
    }
  }

  await refreshYahooInboxList(attempt);
  await sleep(800);
}

async function handleCheckTopMessage(step, payload) {
  log(`Yahoo：handleCheckTopMessage start step=${step} href=${location.href} excludedCodes=${(payload.excludeCodes || []).join(',') || '(none)'}`, 'warn');
  if (isKiroYahooTopMessagePayload(payload)) {
    return handleKiroYahooTopMessageFastPath(step, payload);
  }
  return handlePollEmail(step, {
    ...payload,
    yahooTopRowOnly: true,
    keepRefreshingUntilCode: false,
    maxAttempts: 1,
  });
}

// 轮询 Yahoo 收件箱，并只读取最顶部那封邮件中的验证码。
async function handlePollEmail(step, payload) {
  await ensureOnYahooInbox();
  await waitForAnySelector([
    '[data-test-id="message-list"]',
    'main',
  ], 15000);
  ensureYahooLoggedIn('读取 Yahoo 邮件');

  const excludedCodeSet = new Set((payload.excludeCodes || []).map((item) => String(item || '').trim()).filter(Boolean));
  log(`Yahoo：handlePollEmail start step=${step} href=${location.href} yahooTopRowOnly=${Boolean(payload.yahooTopRowOnly)} excludedCodes=${[...excludedCodeSet].join(',') || '(none)'}`, 'warn');
  const rows = getMessageRows();
  log(`Yahoo：当前可见邮件行数量 rows=${rows.length}`, 'info');
  const topRow = getLatestYahooCodeRow() || findTopMessageRow(rows);

  if (!topRow) {
    log(`Yahoo：步骤 ${step} 未找到可见的收件箱顶部邮件行。`, 'warn');
    return {
      ok: false,
      code: null,
      reason: '未找到收件箱顶部邮件行',
      preview: '',
      emailTimestamp: Date.now(),
    };
  }

  const rowText = getRowText(topRow);
  const topRowTimestamp = getRowTimestamp(topRow) || Date.now();
  log(`Yahoo：顶部邮件摘要=${rowText.slice(0, 200) || '(empty)'} timestamp=${topRowTimestamp}`, 'warn');
  if (!rowText) {
    log(`Yahoo：步骤 ${step} 的顶部邮件行没有可读取文本。`, 'warn');
    return {
      ok: false,
      code: null,
      reason: '收件箱顶部邮件没有可读取文本',
      preview: '',
      emailTimestamp: getRowTimestamp(topRow) || Date.now(),
      topMessageFingerprint: '',
    };
  }

  let rowCode = getLatestLqxCodeFromRow(topRow)
    || getTopRowInlineCode(topRow)
    || extractSixDigitCodeFromLatestRow(topRow);
  const filterMatched = rowMatchesFilters(rowText, payload);
  const topRowCodeFallbackMatched = Boolean(payload.yahooTopRowOnly && rowCode?.code);

  if (!filterMatched && !topRowCodeFallbackMatched) {
    log(`Yahoo：步骤 ${step} 的顶部邮件既未命中过滤条件，也未直接提取到验证码。`, 'warn');
    return {
      ok: false,
      code: null,
      reason: '当前收件箱顶部邮件既未命中过滤条件，也未直接提取到验证码',
      preview: rowText.slice(0, 200),
      emailTimestamp: getRowTimestamp(topRow) || Date.now(),
      topMessageFingerprint: buildYahooTopMessageFingerprint(topRow, rowText, null, topRowTimestamp),
    };
  }

  if (!rowCode?.code) {
    if (filterMatched) {
      rowCode = await openTopRowAndReadVerificationCode(topRow, rowText, payload);
    }
  }

  if (!rowCode?.code) {
    log(`Yahoo：步骤 ${step} 的顶部目标邮件中还没有读到 6 位验证码。`, 'warn');
    if (rowCode?.needsDetailRead) {
      return {
        ok: false,
        code: null,
        needsOpenDetails: Boolean(rowCode?.needsOpenDetails),
        needsDetailRead: true,
        reason: '顶部目标邮件需要打开详情读取正文',
        preview: rowText.slice(0, 200),
        emailTimestamp: getRowTimestamp(topRow) || Date.now(),
        topMessageFingerprint: buildYahooTopMessageFingerprint(topRow, rowText, null, topRowTimestamp),
      };
    }
    return {
      ok: false,
      code: null,
      reason: '收件箱顶部目标邮件中未提取到验证码',
      preview: rowText.slice(0, 200),
      emailTimestamp: getRowTimestamp(topRow) || Date.now(),
      topMessageFingerprint: buildYahooTopMessageFingerprint(topRow, rowText, null, topRowTimestamp),
    };
  }

  if (!filterMatched && topRowCodeFallbackMatched) {
    log(`Yahoo：步骤 ${step} 的顶部邮件未命中过滤条件，但已在顶部行直接提取到验证码 ${rowCode.code}，按顶部验证码兜底候选继续判定。`, 'warn');
  }

  const freshness = evaluateYahooTopMessageFreshness(topRow, rowText, rowCode, topRowTimestamp, payload, filterMatched);
  if (!freshness.freshnessMatched) {
    log(`Yahoo：步骤 ${step} 的顶部验证码 ${rowCode.code} 缺少本轮新鲜度证据。reason=${freshness.freshnessReason} fingerprintChanged=${freshness.fingerprintChanged} previousTopFingerprint=${freshness.previousTopMessageFingerprint || '(none)'} requestedAt=${freshness.requestedAt} previousAcceptedEmailTimestamp=${freshness.previousAcceptedEmailTimestamp}`, 'warn');
    return {
      ok: false,
      code: null,
      reason: `顶部验证码存在，但缺少本轮新邮件证据：${freshness.freshnessReason}`,
      preview: rowCode.text ? rowCode.text.slice(0, 200) : rowText.slice(0, 200),
      emailTimestamp: getRowTimestamp(topRow) || Date.now(),
      topMessageFingerprint: freshness.topMessageFingerprint,
    };
  }

  if (excludedCodeSet.has(rowCode.code)) {
    log(`Yahoo：步骤 ${step} 的顶部验证码 ${rowCode.code} 已被排除。`, 'warn');
    return {
      ok: false,
      code: null,
      reason: `收件箱顶部验证码 ${rowCode.code} 已被排除`,
      preview: rowCode.text ? rowCode.text.slice(0, 200) : rowText.slice(0, 200),
      emailTimestamp: getRowTimestamp(topRow) || Date.now(),
      topMessageFingerprint: freshness.topMessageFingerprint,
    };
  }

  const emailTimestamp = getRowTimestamp(topRow) || Date.now();
  log(`Yahoo：已从收件箱顶部邮件命中验证码 code=${rowCode.code} timestamp=${new Date(emailTimestamp).toISOString()} freshness=${freshness.freshnessReason} preview=${String(rowCode.text || rowText).slice(0, 180)}`, 'warn');
  return {
    ok: true,
    code: rowCode.code,
    emailTimestamp,
    preview: (rowCode.text || rowText).slice(0, 200),
    topMessageFingerprint: freshness.topMessageFingerprint,
    freshnessMatched: freshness.freshnessMatched,
    freshnessReason: freshness.freshnessReason,
  };
}

// 给一次性邮箱设置区域打分，帮助定位正确的卡片容器。
function scoreDisposableAliasSection(node) {
  if (!(node instanceof HTMLElement)) return -Infinity;
  const text = normalizeLowerText(node.innerText || node.textContent || '');
  if (!/一次性电子邮件地址|disposable email addresses|disposable email address|disposable address/.test(text)) {
    return -Infinity;
  }

  const rect = node.getBoundingClientRect();
  if (rect.width < 260 || rect.height < 80) return -Infinity;

  let score = 0;
  if (/protect your privacy|最多\s*3\s*个免费|during your free trial|protect your real email address|alias email addresses/.test(text)) score += 8;
  if (/添加|add/.test(text)) score += 3;
  if (/@yahoo\.com/.test(text)) score += 3;
  if (/mailbox list|邮箱列表/.test(text)) score -= 8;
  if (/send-only email address|仅发送电子邮件地址/.test(text)) score -= 8;
  if (/auto-forwarding|自动转发/.test(text)) score -= 5;
  if (/mailboxes/.test(text)) score -= 6;
  score -= (rect.width * rect.height) / 200000;
  return score;
}

// 找到 Yahoo 一次性邮箱设置区域的主容器。
function findDisposableAliasSection() {
  const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span')).find((node) => {
    const text = normalizeLowerText(node.innerText || node.textContent || '');
    return node instanceof HTMLElement && /一次性电子邮件地址|disposable email addresses|disposable email address|disposable address/.test(text);
  });

  const candidates = [];
  if (heading) {
    let current = heading.parentElement;
    while (current && current !== document.body) {
      candidates.push(current);
      current = current.parentElement;
    }
  }

  candidates.push(...Array.from(document.querySelectorAll('section, div, main, article')));

  return candidates
    .filter((node, index, arr) => node instanceof HTMLElement && arr.indexOf(node) === index)
    .map((node) => ({ node, score: scoreDisposableAliasSection(node) }))
    .filter((item) => Number.isFinite(item.score) && item.score > -Infinity)
    .sort((left, right) => right.score - left.score)[0]?.node || null;
}

async function focusDisposableAliasSection() {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      window.scrollTo({ left: 0, behavior: 'instant' });
      document.scrollingElement?.scrollTo?.({ left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, window.scrollY || 0);
    }

    const section = findDisposableAliasSection();
    const heading = findYahooDisposableSectionHeading();
    const target = heading || section;

    if (target instanceof HTMLElement) {
      try {
        target.scrollIntoView?.({ block: 'center', inline: 'center' });
      } catch {}
      await sleep(500);
      const refreshedSection = findDisposableAliasSection();
      const addButton = findYahooDisposableAddButton();
      if (addButton) {
        log(`Yahoo：已定位 Disposable email addresses 区域并找到 Add 按钮（attempt=${attempt}）`, 'info');
        return { section: refreshedSection || section, addButton };
      }
      log(`Yahoo：已滚动到 Disposable email addresses 区域，但暂未找到 Add 按钮（attempt=${attempt}）`, 'warn');
    }

    try {
      window.scrollBy({ top: attempt % 2 ? 420 : -240, left: -1200, behavior: 'instant' });
    } catch {
      window.scrollBy(-1200, attempt % 2 ? 420 : -240);
    }
    await sleep(450);
  }

  return {
    section: findDisposableAliasSection(),
    addButton: findYahooDisposableAddButton(),
  };
}

// 在祖先链里找最贴近的一次性邮箱卡片。
function findTightAliasCard(node) {
  if (!(node instanceof HTMLElement)) return null;
  const chain = [];
  let current = node;
  while (current && current !== document.body) {
    if (isVisibleElement(current)) {
      const rect = current.getBoundingClientRect();
      const text = normalizeLowerText(current.innerText || current.textContent || '');
      if (rect.width >= 220 && rect.height >= 40 && rect.height <= 120 && /@yahoo\.com/.test(text)) {
        chain.push(current);
      }
    }
    current = current.parentElement;
  }
  return chain.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    const leftScore = Math.abs(leftRect.height - 64) + Math.abs(leftRect.width - 420) / 10;
    const rightScore = Math.abs(rightRect.height - 64) + Math.abs(rightRect.width - 420) / 10;
    return leftScore - rightScore;
  })[0] || node;
}

// 等待一次性邮箱列表稳定后再继续操作。
async function waitForAliasListStable(timeoutMs = 2500) {
  const startedAt = Date.now();
  let lastSignature = '';
  let stableRounds = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const aliases = collectAliasItems().map((node) => extractAliasEmailFromItem(node)).filter(Boolean);
    const signature = aliases.join('|');
    if (signature && signature === lastSignature) {
      stableRounds += 1;
      if (stableRounds >= 3) return aliases;
    } else {
      stableRounds = 0;
      lastSignature = signature;
    }
    await sleep(180);
  }
  return collectAliasItems().map((node) => extractAliasEmailFromItem(node)).filter(Boolean);
}

// 收集当前页面可见的一次性邮箱条目。
function collectAliasItems() {
  const section = findDisposableAliasSection();
  const scope = section || document;
  const allEmailTexts = normalizeLowerText(scope.innerText || scope.textContent || '').match(/[a-z0-9._%+-]+@yahoo\.com/g) || [];
  log(`Yahoo：旧邮箱扫描区域命中 ${allEmailTexts.length} 个邮箱文本`, 'info');

  const unique = [];
  const seen = new Set();

  const emailNodes = Array.from(scope.querySelectorAll('*')).filter((node) => {
    if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
    const text = normalizeLowerText((node.innerText || node.textContent || '').replace(/\s+/g, ''));
    if (!/^[a-z0-9._%+-]+@yahoo\.com$/.test(text)) return false;

    let current = node.parentElement;
    while (current && current !== scope) {
      const currentText = normalizeLowerText(current.innerText || current.textContent || '');
      if (/mailbox list|邮箱列表|send-only email address|仅发送电子邮件地址/.test(currentText)
        && !/一次性电子邮件地址|disposable email addresses|disposable email address|disposable address/.test(currentText)) {
        return false;
      }
      current = current.parentElement;
    }
    return true;
  });

  for (const node of emailNodes) {
    const email = extractAliasEmailFromItem(node);
    if (!email || seen.has(email)) continue;
    const card = findTightAliasCard(node);
    seen.add(email);
    unique.push(card || node);
  }

  if (!unique.length) {
    const blockCandidates = Array.from(scope.querySelectorAll('button, [role="button"], li, div, article, section')).filter((node) => {
      if (!isVisibleElement(node)) return false;
      const text = normalizeLowerText(node.innerText || node.textContent || '');
      if (!/@yahoo\.com/.test(text)) return false;
      if (/添加一次性电子邮件地址|add disposable|说明|描述|姓名|关键词|自动转发|移除地址|remove address|编辑|edit|取消|节省|保存|升级|you've reached|达到极限/.test(text)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 220 && rect.height >= 40;
    });

    for (const node of blockCandidates) {
      const email = extractAliasEmailFromItem(node);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      unique.push(node);
    }
  }

  log(`Yahoo：当前检测到 ${unique.length} 个旧一次性邮箱`, 'info');
  return unique;
}

// 按邮箱地址查找对应的一次性邮箱条目。
function findAliasItemByEmail(email = '') {
  const normalizedEmail = normalizeLowerText(email).replace(/\s+/g, '');
  if (!normalizedEmail) return null;
  const section = findDisposableAliasSection();
  const scope = section || document;

  const exactNode = Array.from(scope.querySelectorAll('*')).find((node) => {
    if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
    return normalizeLowerText((node.innerText || node.textContent || '').replace(/\s+/g, '')) === normalizedEmail;
  });
  if (exactNode) {
    return findTightAliasCard(exactNode) || exactNode;
  }

  return collectAliasItems().find((node) => extractAliasEmailFromItem(node) === normalizedEmail) || null;
}

// 从条目文本中抽取一次性邮箱地址。
function extractAliasEmailFromItem(item) {
  const text = normalizeText(item.innerText || item.textContent || '');
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

// 派发一组悬停事件，模拟鼠标移入目标元素。
function dispatchHoverSequence(target, x, y) {
  if (!target) return;
  target.dispatchEvent(new MouseEvent('pointerover', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}

// 派发一组点击事件，尽量模拟真实鼠标点击。
function dispatchClickSequence(target, x, y) {
  if (!target) return false;
  dispatchHoverSequence(target, x, y);
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  if (typeof target.click === 'function') {
    try { target.click(); } catch {}
  }
  return true;
}

// 从编辑面板文本里提取邮箱地址。
function extractEditorPanelEmail(panel) {
  if (!panel) return '';
  const text = normalizeText(panel.innerText || panel.textContent || '');
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

// 定位指定一次性邮箱的编辑面板。
function findAliasEditorPanel(email = '') {
  const normalizedEmail = normalizeLowerText(email).replace(/\s+/g, '');
  const panels = Array.from(document.querySelectorAll('section, div, aside, article')).filter((node) => {
    if (!isVisibleElement(node)) return false;
    const text = normalizeLowerText(node.innerText || node.textContent || '');
    const compactText = text.replace(/\s+/g, '');
    if (!/编辑|edit/.test(text)) return false;
    if (!/移除地址|remove address|姓名|描述|取消|节省|保存/.test(text)) return false;
    if (!normalizedEmail) return true;
    return compactText.includes(normalizedEmail);
  });
  return panels.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return rightRect.left - leftRect.left;
  })[0] || null;
}

// 在悬停后的条目中寻找隐藏的删除按钮。
function findHoveredAliasDeleteButton(item) {
  const itemRect = item.getBoundingClientRect();
  const localCandidates = Array.from(item.querySelectorAll('button, [role="button"], span, div, svg')).map((node) => {
    const host = node instanceof SVGElement ? node.parentElement : node;
    return host;
  }).filter((node) => node && isVisibleElement(node));

  const localMatch = localCandidates.find((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    const rect = node.getBoundingClientRect();
    return rect.left >= itemRect.left + itemRect.width * 0.78
      && rect.right <= itemRect.right + 20
      && rect.width > 0
      && rect.height > 0
      && rect.width <= 44
      && rect.height <= 44
      && (/删除|移除|remove|delete|×|x/.test(text) || rect.width === rect.height);
  });
  if (localMatch) return localMatch;

  const globalCandidates = Array.from(document.querySelectorAll('button, [role="button"], span, div, svg')).map((node) => {
    const host = node instanceof SVGElement ? node.parentElement : node;
    return host;
  }).filter((node) => node && isVisibleElement(node));

  return globalCandidates.find((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    const rect = node.getBoundingClientRect();
    const verticallyAligned = Math.abs((rect.top + rect.height / 2) - (itemRect.top + itemRect.height / 2)) <= Math.max(18, itemRect.height * 0.45);
    return verticallyAligned
      && rect.left >= itemRect.right - 60
      && rect.left <= itemRect.right + 40
      && rect.width > 0
      && rect.height > 0
      && rect.width <= 44
      && rect.height <= 44
      && (/删除|移除|remove|delete|×|x/.test(text) || rect.width === rect.height);
  }) || null;
}

// 在编辑面板内寻找“移除地址”按钮。
function findRemoveAddressButton(panel) {
  const scope = panel || document;
  const textNodes = Array.from(scope.querySelectorAll('button, [role="button"], a, span, div')).filter((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return isVisibleElement(node) && /^(移除地址|remove address|删除地址|remove)$/.test(text);
  });
  if (textNodes.length) {
    return textNodes.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    })[0] || null;
  }

  const fuzzy = Array.from(scope.querySelectorAll('button, [role="button"], a, span, div')).filter((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return isVisibleElement(node) && /移除地址|remove address|删除地址|remove/.test(text) && !/cancel|取消/.test(text);
  });
  return fuzzy.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
  })[0] || null;
}

// 找到节点中心点附近真正可点击的命中目标。
function findClickableTargetAtCenter(node) {
  if (!node || typeof node.getBoundingClientRect !== 'function') {
    return null;
  }
  const rect = node.getBoundingClientRect();
  const points = [
    { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) },
    { x: Math.round(rect.left + rect.width * 0.3), y: Math.round(rect.top + rect.height / 2) },
    { x: Math.round(rect.left + rect.width * 0.7), y: Math.round(rect.top + rect.height / 2) },
  ];

  for (const point of points) {
    const hit = document.elementFromPoint(point.x, point.y);
    const clickable = hit?.closest?.('button, [role="button"], a, span, div') || hit;
    if (clickable && isVisibleElement(clickable)) {
      return { target: clickable, x: point.x, y: point.y };
    }
  }
  return null;
}

// 选择某个一次性邮箱条目并打开其编辑面板。
async function selectAliasItemForEditing(item, email = '') {
  const normalizedEmail = normalizeLowerText(email).replace(/\s+/g, '');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await waitForAliasListStable(1800);
    const freshItem = findAliasItemByEmail(email) || item;
    freshItem.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    await sleep(320);

    const directEmailNode = Array.from(freshItem.querySelectorAll('*')).find((node) => {
      if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
      return normalizeLowerText((node.innerText || node.textContent || '').replace(/\s+/g, '')) === normalizedEmail;
    }) || (normalizeLowerText((freshItem.innerText || freshItem.textContent || '').replace(/\s+/g, '')) === normalizedEmail ? freshItem : null);

    const targetNode = findTightAliasCard(directEmailNode || freshItem) || directEmailNode || freshItem;
    const rect = targetNode.getBoundingClientRect();
    const hoverX = Math.round(rect.left + Math.max(28, Math.min(90, rect.width * 0.18)));
    const hoverY = Math.round(rect.top + rect.height / 2);
    dispatchHoverSequence(targetNode, hoverX, hoverY);
    log(`Yahoo：已悬停旧一次性邮箱 ${email || '(unknown)'} (attempt ${attempt + 1})`, 'info');
    await sleep(550);

    const clickPoints = [
      [Math.round(rect.left + Math.max(36, Math.min(96, rect.width * 0.20))), Math.round(rect.top + rect.height / 2)],
      [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      [Math.round(rect.left + Math.max(48, Math.min(140, rect.width * 0.28))), Math.round(rect.top + rect.height / 2)],
    ];

    for (const [clickX, clickY] of clickPoints) {
      dispatchClickSequence(targetNode, clickX, clickY);
      try { if (typeof targetNode.click === 'function') targetNode.click(); } catch {}
      log(`Yahoo：已点击旧一次性邮箱卡片主体 ${email || '(unknown)'} point=${clickX},${clickY} (attempt ${attempt + 1})`, 'info');

      let lastPanelEmail = '';
      for (let i = 0; i < 10; i += 1) {
        await sleep(220);
        const panel = findAliasEditorPanel(email) || findAliasEditorPanel('');
        if (!panel) continue;
        const panelEmail = extractEditorPanelEmail(panel);
        if (panelEmail && panelEmail !== lastPanelEmail) {
          lastPanelEmail = panelEmail;
          log(`Yahoo：已打开编辑面板，面板邮箱=${panelEmail}`, 'info');
        }
        if (!normalizedEmail || panelEmail.replace(/\s+/g, '') === normalizedEmail) {
          return panel;
        }
      }
    }
  }

  const snippets = Array.from(document.querySelectorAll('section, div, aside, article'))
    .filter((node) => isVisibleElement(node))
    .map((node) => normalizeText(node.innerText || node.textContent || ''))
    .filter((text) => /编辑|edit|移除地址|remove address/.test(text))
    .slice(0, 3)
    .join(' || ');
  log(`Yahoo：编辑面板候选片段=${snippets || '(none)'}`, 'warn');
  return null;
}

// 按文本模式筛选可能的对话框候选项。
function getDialogCandidates(pattern) {
  return Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"], div')).filter((node) => {
    if (!isVisibleElement(node)) return false;
    const text = normalizeLowerText(node.innerText || node.textContent || '');
    if (!pattern.test(text)) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width >= 260
      && rect.height >= 120
      && rect.left >= 0
      && rect.top >= 0
      && rect.left + rect.width <= window.innerWidth + 20
      && rect.top + rect.height <= window.innerHeight + 20
      && (style.position === 'fixed' || style.position === 'absolute');
  }).sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (leftRect.width * leftRect.height) - (rightRect.width * rightRect.height);
  });
}

// 直接按文本模式取第一个匹配到的对话框。
function findDialogByText(pattern) {
  return getDialogCandidates(pattern)[0] || null;
}

// 查找“达到极限”之类的提示弹窗。
function findVisibleDialog() {
  return findDialogByText(/你已经达到极限了|达到极限|limit|upgrade|升级/);
}

function getYahooClickableText(node) {
  if (!node) return '';
  return normalizeLowerText([
    node.getAttribute?.('aria-label') || '',
    node.getAttribute?.('title') || '',
    node.getAttribute?.('data-test-id') || '',
    node.getAttribute?.('data-test') || '',
    node.getAttribute?.('id') || '',
    node.textContent || '',
  ].join(' '));
}

function isLikelyYahooDisposableAddText(text, options = {}) {
  const normalized = normalizeLowerText(text);
  const allowShort = Boolean(options.allowShort);
  if (!normalized) return false;
  if (allowShort && /^(添加|新增|新建|创建|add|new|create|\+)$/.test(normalized)) {
    return true;
  }
  return /(添加|新增|新建|创建).{0,16}(一次性|临时|分身|电子邮件地址|电子邮箱|邮箱|地址)/.test(normalized)
    || /(一次性|临时|分身|电子邮件地址|电子邮箱|邮箱|地址).{0,16}(添加|新增|新建|创建)/.test(normalized)
    || /(add|new|create).{0,24}(disposable|alias|address|email)/.test(normalized)
    || /(disposable|alias).{0,24}(add|new|create)/.test(normalized);
}

function isUsableYahooButtonCandidate(node) {
  if (!(node instanceof HTMLElement) || !isVisibleElement(node)) return false;
  if (node.disabled || node.getAttribute?.('aria-disabled') === 'true') return false;
  const rect = node.getBoundingClientRect();
  return rect.width >= 24 && rect.height >= 20 && rect.width <= 380 && rect.height <= 100;
}

function collectYahooVisibleButtonLabels(root = document, limit = 12) {
  return Array.from(root.querySelectorAll('button, [role="button"], a, span, div'))
    .filter((node) => isUsableYahooButtonCandidate(node))
    .map((node) => getYahooClickableText(node))
    .filter(Boolean)
    .filter((text, index, arr) => arr.indexOf(text) === index)
    .slice(0, limit);
}

function getYahooDialogText(dialog) {
  return normalizeText(dialog?.innerText || dialog?.textContent || '').slice(0, 220);
}

function buildYahooAliasCreateDiagnostics() {
  let aliases = [];
  try {
    aliases = collectAliasItems().map(extractAliasEmailFromItem).filter(Boolean);
  } catch {}

  const section = findDisposableAliasSection();
  const limitDialog = findVisibleDialog();
  const buttonLabels = collectYahooVisibleButtonLabels(section || document, 10);
  const pageText = normalizeText(document.body?.innerText || document.body?.textContent || '').slice(0, 280);
  const limitHint = limitDialog
    ? `检测到 Yahoo 限制弹窗：“${getYahooDialogText(limitDialog)}”。`
    : '';
  const aliasHint = aliases.length >= 3
    ? `当前页面已识别 ${aliases.length} 个旧别名；已按当前配置不自动清理旧别名。`
    : `当前页面已识别 ${aliases.length} 个旧别名。`;
  return [
    `url=${location.href}`,
    `section=${section ? 'yes' : 'no'}`,
    aliasHint,
    limitHint,
    `可见按钮=${buttonLabels.join(' / ') || '(none)'}`,
    `页面片段=${pageText || '(empty)'}`,
  ].filter(Boolean).join('；');
}

// 查找一次性邮箱删除确认弹窗。
function findDeleteConfirmDialog() {
  const candidates = getDialogCandidates(/删除.*@yahoo\.com|这将从您的一次性电子邮件地址列表中删除|remove.*@yahoo\.com|delete.*@yahoo\.com/);
  return candidates.find((node) => {
    const text = normalizeLowerText(node.innerText || node.textContent || '');
    return /取消|cancel/.test(text) && /删除|remove|delete/.test(text);
  }) || candidates[0] || null;
}

// 如果出现“达到极限”提示弹窗就尝试关闭。
async function closeLimitDialogIfPresent() {
  const dialog = findVisibleDialog();
  if (!dialog) {
    return false;
  }

  log('Yahoo：检测到“达到极限”弹窗，正在尝试关闭...', 'warn');

  const closeButton = Array.from(dialog.querySelectorAll('button, [role="button"], span, div')).find((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return isVisibleElement(node) && (/close|关闭|×|x/.test(text));
  });

  if (closeButton) {
    simulateClick(closeButton);
    await sleep(800);
    return true;
  }

  const clickableNodes = Array.from(dialog.querySelectorAll('button, [role="button"], span, div, svg')).filter((node) => {
    const host = node instanceof SVGElement ? node.parentElement : node;
    if (!host || !isVisibleElement(host)) return false;
    const rect = host.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && rect.width <= 40
      && rect.height <= 40
      && rect.top <= dialogRect.top + 60
      && rect.left >= dialogRect.left + dialogRect.width * 0.7;
  });

  const fallbackClose = clickableNodes[0] instanceof SVGElement ? clickableNodes[0].parentElement : clickableNodes[0];
  if (fallbackClose) {
    simulateClick(fallbackClose);
    await sleep(800);
    return true;
  }

  return false;
}

// 在删除确认弹窗中定位确认删除按钮。
function findDeleteConfirmButton(dialog) {
  if (!dialog) return null;

  const exactCandidates = Array.from(dialog.querySelectorAll('button, [role="button"], span, div')).filter((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return isVisibleElement(node) && /^(删除|delete|remove)$/.test(text);
  });
  if (exactCandidates.length) {
    return exactCandidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    })[0] || null;
  }

  const buttonCandidates = Array.from(dialog.querySelectorAll('button, [role="button"]')).filter((node) => {
    if (!isVisibleElement(node)) return false;
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    if (/取消|cancel|关闭|close/.test(text)) return false;
    const rect = node.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    return rect.width >= 60
      && rect.height >= 32
      && rect.top >= dialogRect.top + dialogRect.height * 0.45
      && rect.left >= dialogRect.left + dialogRect.width * 0.45;
  });
  if (buttonCandidates.length) {
    return buttonCandidates.sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      if (Math.abs(rightRect.top - leftRect.top) > 8) return rightRect.top - leftRect.top;
      return rightRect.left - leftRect.left;
    })[0] || null;
  }

  const genericCandidates = Array.from(dialog.querySelectorAll('span, div')).filter((node) => {
    if (!isVisibleElement(node)) return false;
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    if (/取消|cancel|关闭|close/.test(text)) return false;
    const rect = node.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    return rect.width >= 60
      && rect.height >= 24
      && rect.top >= dialogRect.top + dialogRect.height * 0.45
      && rect.left >= dialogRect.left + dialogRect.width * 0.45
      && /删除|delete|remove/.test(text);
  });
  return genericCandidates.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    if (Math.abs(rightRect.top - leftRect.top) > 8) return rightRect.top - leftRect.top;
    return rightRect.left - leftRect.left;
  })[0] || null;
}

// 如果删除确认弹窗出现，就点击确认按钮完成删除。
async function confirmDeleteDialogIfPresent(email = '') {
  const normalizedEmail = normalizeLowerText(email);
  let dialog = null;
  for (let i = 0; i < 20 && !dialog; i += 1) {
    const candidate = findDeleteConfirmDialog();
    const dialogEmail = extractEditorPanelEmail(candidate || null);
    if (candidate && (!normalizedEmail || !dialogEmail || dialogEmail === normalizedEmail)) {
      dialog = candidate;
      break;
    }
    await sleep(200);
  }

  if (!dialog) {
    log(`Yahoo：未检测到 ${email || '(unknown)'} 的删除确认弹窗`, 'warn');
    return false;
  }

  const dialogEmail = extractEditorPanelEmail(dialog || null);
  log(`Yahoo：已检测到 ${email || '(unknown)'} 的删除确认弹窗 dialogEmail=${dialogEmail || '(unknown)'}`, 'info');

  const confirmButton = findDeleteConfirmButton(dialog);
  if (!confirmButton) {
    log(`Yahoo：未找到 ${email || '(unknown)'} 删除确认按钮`, 'warn');
    return false;
  }

  const rect = confirmButton.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  dispatchHoverSequence(confirmButton, x, y);
  await sleep(120);
  dispatchClickSequence(confirmButton, x, y);
  try {
    if (typeof confirmButton.click === 'function') confirmButton.click();
  } catch {}
  log(`Yahoo：已确认删除 ${email || '(unknown)'} target=${confirmButton.tagName || 'unknown'} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`, 'info');
  await sleep(2200);
  return true;
}

// 删除单个一次性邮箱条目，优先走行内删除，失败再走编辑面板。
async function clickDeleteForAliasItem(item) {
  const email = extractAliasEmailFromItem(item);
  log(`Yahoo：准备删除旧一次性邮箱 ${email || '(unknown)'}`, 'info');

  const freshItem = findAliasItemByEmail(email) || item;
  freshItem.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  await sleep(260);

  const hoverTarget = findTightAliasCard(freshItem) || freshItem;
  const hoverRect = hoverTarget.getBoundingClientRect();
  const hoverX = Math.round(hoverRect.left + Math.max(32, Math.min(88, hoverRect.width * 0.18)));
  const hoverY = Math.round(hoverRect.top + hoverRect.height / 2);
  dispatchHoverSequence(hoverTarget, hoverX, hoverY);
  await sleep(520);

  let inlineDelete = findHoveredAliasDeleteButton(hoverTarget) || findHoveredAliasDeleteButton(freshItem);
  if (inlineDelete) {
    const deleteRect = inlineDelete.getBoundingClientRect();
    const deleteX = Math.round(deleteRect.left + deleteRect.width / 2);
    const deleteY = Math.round(deleteRect.top + deleteRect.height / 2);
    const deleteText = normalizeLowerText(inlineDelete.getAttribute?.('aria-label') || inlineDelete.textContent || inlineDelete.title || '') || '(empty)';
    log(`Yahoo：已命中行内删除按钮 text=${deleteText} target=${inlineDelete.tagName || 'unknown'} rect=${Math.round(deleteRect.width)}x${Math.round(deleteRect.height)}`, 'info');
    dispatchHoverSequence(inlineDelete, deleteX, deleteY);
    await sleep(120);
    dispatchClickSequence(inlineDelete, deleteX, deleteY);
    try { if (typeof inlineDelete.click === 'function') inlineDelete.click(); } catch {}
    await sleep(900);

    const confirmedInline = await confirmDeleteDialogIfPresent(email);
    if (confirmedInline) {
      await closeLimitDialogIfPresent();
      return true;
    }
    log(`Yahoo：行内删除按钮点击后未出现 ${email || '(unknown)'} 的确认弹窗，回退编辑面板方案`, 'warn');
  }

  const editorPanel = await selectAliasItemForEditing(freshItem, email);
  if (!editorPanel) {
    log(`Yahoo：未能打开 ${email || '(unknown)'} 的编辑面板`, 'warn');
    return false;
  }
  log(`Yahoo：已打开 ${email || '(unknown)'} 的编辑面板`, 'info');

  const removeButton = findRemoveAddressButton(editorPanel);
  if (!removeButton) {
    log(`Yahoo：未找到 ${email || '(unknown)'} 的“移除地址”按钮`, 'warn');
    return false;
  }

  removeButton.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  await sleep(300);

  const removeTarget = removeButton.closest?.('button, [role="button"], a, div') || removeButton;
  const hit = findClickableTargetAtCenter(removeTarget) || findClickableTargetAtCenter(removeButton);
  const rect = (hit?.target || removeTarget).getBoundingClientRect();
  const x = hit?.x ?? Math.round(rect.left + rect.width / 2);
  const y = hit?.y ?? Math.round(rect.top + rect.height / 2);
  const clickTarget = hit?.target || removeTarget;
  const labelText = normalizeLowerText(removeButton.getAttribute?.('aria-label') || removeButton.textContent || removeButton.title || '') || '(empty)';
  log(`Yahoo：已命中“移除地址”按钮 text=${labelText} target=${clickTarget.tagName || 'unknown'} rect=${Math.round(rect.width)}x${Math.round(rect.height)}`, 'info');

  dispatchHoverSequence(clickTarget, x, y);
  await sleep(180);
  dispatchClickSequence(clickTarget, x, y);
  try {
    if (typeof clickTarget.click === 'function') clickTarget.click();
    else if (typeof removeTarget.click === 'function') removeTarget.click();
  } catch {}

  await sleep(1000);

  const confirmed = await confirmDeleteDialogIfPresent(email);
  if (!confirmed) {
    log(`Yahoo：点击“移除地址”后未出现 ${email || '(unknown)'} 的确认弹窗`, 'warn');
    return false;
  }
  await closeLimitDialogIfPresent();
  return true;
}

// 逐个删除旧的一次性邮箱，直到不再需要清理为止。
async function deleteAllOldAliases() {
  const deleted = [];
  for (let round = 0; round < 10; round += 1) {
    throwIfStopped();
    await waitForAliasListStable(2200);
    const aliases = collectAliasItems();
    log(`Yahoo：当前检测到 ${aliases.length} 个旧一次性邮箱`, 'info');
    if (!aliases.length) {
      break;
    }

    if (aliases.length < 3) {
      log(`Yahoo：当前仅剩 ${aliases.length} 个旧一次性邮箱，未达到上限，跳过后续删除并直接进入创建`, 'warn');
      break;
    }

    const item = aliases[0];
    const email = extractAliasEmailFromItem(item);
    const freshItem = findAliasItemByEmail(email) || item;
    const beforeCount = aliases.length;
    const ok = await clickDeleteForAliasItem(freshItem);
    if (!ok) {
      log(`Yahoo：未能命中 ${email || '(unknown)'} 的删除按钮`, 'warn');
      break;
    }

    let removed = false;
    for (let waitRound = 0; waitRound < 15; waitRound += 1) {
      await sleep(500);
      const currentAliases = collectAliasItems().map(extractAliasEmailFromItem).filter(Boolean);
      if (!currentAliases.includes(email) || currentAliases.length < beforeCount) {
        removed = true;
        log(`Yahoo：旧一次性邮箱已删除 ${email || '(unknown)'}`, 'ok');
        break;
      }
    }

    if (removed && email) {
      deleted.push(email);
    } else {
      log(`Yahoo：等待删除 ${email || '(unknown)'} 生效超时`, 'warn');
      break;
    }
  }
  return deleted;
}

// 生成一个默认的一次性邮箱前缀。
function generateAliasPrefix(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

// 在指定范围内按文本匹配查找可见按钮。
function findYahooButtonByText(patterns = [], root = document) {
  return Array.from(root.querySelectorAll('button, [role="button"], a, span')).find((node) => {
    const text = normalizeLowerText(node.getAttribute?.('aria-label') || node.textContent || node.title || '');
    return patterns.some((pattern) => pattern.test(text)) && isVisibleElement(node);
  }) || null;
}

// 查找 Yahoo 创建一次性邮箱的右侧面板。
function findYahooCreatePanel() {
  const panels = Array.from(document.querySelectorAll('section, div, aside, article, [role="dialog"], dialog')).filter((node) => {
    if (!isVisibleElement(node)) return false;
    const text = normalizeLowerText(node.innerText || node.textContent || '');
    const rect = node.getBoundingClientRect();
    if (rect.width < 260 || rect.height < 180) return false;
    if (rect.left < window.innerWidth * 0.45) return false;
    if (!/添加一次性电子邮件地址|add disposable address|add disposable email address|创建一次性电子邮件地址|create disposable|name your address|choose.*address|keyword|关键词/.test(text)) {
      return false;
    }
    if (!/关键词|keyword|姓名|描述|save|保存|节省|cancel|取消|description|name|address/.test(text)) {
      return false;
    }
    return true;
  });
  return panels.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    if (Math.abs(rightRect.left - leftRect.left) > 20) return rightRect.left - leftRect.left;
    return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
  })[0] || null;
}

// 查找创建面板里的一次性邮箱输入框。
function findYahooAliasInput() {
  const panel = findYahooCreatePanel();
  const scopes = [panel, document].filter(Boolean);

  for (const scope of scopes) {
    const inputs = Array.from(scope.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]'));

    const semanticMatch = inputs.find((node) => {
      const host = node instanceof HTMLElement ? node : null;
      if (!host || !isVisibleElement(host)) return false;
      if (host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement) {
        if (host.disabled || host.readOnly) return false;
      }
      const text = normalizeLowerText([
        host.getAttribute?.('placeholder') || '',
        host.getAttribute?.('aria-label') || '',
        host.getAttribute?.('name') || '',
        host.getAttribute?.('id') || '',
        host.getAttribute?.('data-test-id') || '',
        host.getAttribute?.('data-test') || '',
        host.labels?.[0]?.textContent || '',
        host.parentElement?.innerText || '',
        host.closest('div,section,form,[role="dialog"]')?.innerText || '',
      ].join(' '));
      return /关键词|keyword|alias|address|name your address|create your address|choose.*address/.test(text);
    });
    if (semanticMatch) return semanticMatch;

    const sizedMatch = inputs.find((node) => {
      const host = node instanceof HTMLElement ? node : null;
      if (!host || !isVisibleElement(host)) return false;
      if (host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement) {
        if (host.disabled || host.readOnly) return false;
      }
      const rect = host.getBoundingClientRect();
      const type = normalizeLowerText(host.getAttribute?.('type') || '');
      if (/hidden|checkbox|radio|submit|button/.test(type)) return false;
      return rect.width >= 120 && rect.height >= 24;
    });
    if (sizedMatch) return sizedMatch;
  }

  return null;
}

// 查找一次性邮箱设置区域的标题节点。
function findYahooDisposableSectionHeading() {
  const candidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, div, span')).filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    const text = normalizeLowerText(node.innerText || node.textContent || '');
    return /一次性电子邮件地址|disposable email addresses|disposable email address|disposable address/.test(text)
      && !/@yahoo\.com/.test(text);
  });
  return candidates.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return leftRect.top - rightRect.top;
  })[0] || null;
}

// 查找新增一次性邮箱的“添加”按钮。
function findYahooDisposableAddButton() {
  const buttonSelectors = 'button, [role="button"], a, span, div';
  const section = findDisposableAliasSection();

  if (section) {
    const sectionRect = section.getBoundingClientRect();
    const scoped = Array.from(section.querySelectorAll(buttonSelectors)).filter((node) => {
      if (!isUsableYahooButtonCandidate(node)) return false;
      const text = getYahooClickableText(node);
      if (!isLikelyYahooDisposableAddText(text, { allowShort: true })) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 40
        && rect.height >= 24
        && rect.top >= sectionRect.top - 6
        && rect.top <= sectionRect.top + 90
        && rect.left >= sectionRect.left + sectionRect.width * 0.72;
    });
    if (scoped.length) {
      return scoped.sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return Math.abs(leftRect.top - sectionRect.top) - Math.abs(rightRect.top - sectionRect.top)
          || (rightRect.left - leftRect.left);
      })[0];
    }
  }

  const heading = findYahooDisposableSectionHeading();
  if (heading) {
    const headingRect = heading.getBoundingClientRect();
    const nearHeading = Array.from(document.querySelectorAll(buttonSelectors)).filter((node) => {
      if (!isUsableYahooButtonCandidate(node)) return false;
      const text = getYahooClickableText(node);
      if (!isLikelyYahooDisposableAddText(text, { allowShort: true })) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 40
        && rect.height >= 24
        && Math.abs((rect.top + rect.height / 2) - (headingRect.top + headingRect.height / 2)) <= 28
        && rect.left >= headingRect.left + Math.max(240, headingRect.width * 0.8);
    });
    if (nearHeading.length) {
      return nearHeading.sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return Math.abs(leftRect.top - headingRect.top) - Math.abs(rightRect.top - headingRect.top)
          || (rightRect.left - leftRect.left);
      })[0];
    }
  }

  const globalCandidates = Array.from(document.querySelectorAll(buttonSelectors)).filter((node) => {
    if (!isUsableYahooButtonCandidate(node)) return false;
    const text = getYahooClickableText(node);
    return isLikelyYahooDisposableAddText(text);
  });
  return globalCandidates.sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return rightRect.top - leftRect.top || rightRect.left - leftRect.left;
  })[0] || findYahooButtonByText([
    /new\s+disposable\s+address/i,
    /新建一次性电子邮件地址/i,
    /新建一次性电子邮箱/i,
    /新增一次性电子邮件地址/i,
    /添加一次性电子邮件地址/i,
    /一次性电子邮箱/i,
    /一次性电子邮件地址/i,
    /create/i,
    /new/i,
    /添加/i,
    /创建/i,
  ]);
}

function getDisposableAliasUsageCount() {
  const section = findDisposableAliasSection();
  const text = normalizeLowerText([
    section?.innerText || section?.textContent || '',
    document.body?.innerText || document.body?.textContent || '',
  ].join(' '));
  const match = text.match(/disposable email addresses[^0-9]{0,40}(\d+)\s+of\s+(\d+)/i)
    || text.match(/一次性电子邮件地址[^0-9]{0,40}(\d+)\s*(?:of|\/)\s*(\d+)/i);
  if (!match) return null;
  return {
    used: Number(match[1]),
    limit: Number(match[2]),
  };
}

function inferYahooAliasFromExistingAliases(prefix = '', aliases = []) {
  const normalizedPrefix = normalizeLowerText(prefix).replace(/[^a-z0-9._%+-]/g, '');
  if (!normalizedPrefix) return '';
  const sample = (aliases || []).find((email) => /@yahoo\.com$/i.test(email) && email.includes('-'));
  if (!sample) return '';
  const local = sample.split('@')[0] || '';
  const base = local.slice(0, local.lastIndexOf('-'));
  return base ? `${base}-${normalizedPrefix}@yahoo.com` : '';
}

// 创建 Yahoo 临时邮箱，并返回新生成的地址。
async function handleCreateYahooTempAlias(payload) {
  log('Yahoo：已进入创建临时邮箱流程', 'info');
  await ensureOnYahooSettings();
  await waitForAnySelector(['main', 'form', 'button'], 15000);
  ensureYahooLoggedIn('创建 Yahoo 临时邮箱');

  await closeLimitDialogIfPresent();
  log('Yahoo：跳过旧一次性邮箱清理，直接创建新邮箱', 'info');
  await focusDisposableAliasSection();

  const remainingAliases = collectAliasItems().map(extractAliasEmailFromItem).filter(Boolean);
  const beforeUsage = getDisposableAliasUsageCount();
  if (remainingAliases.length > 0) {
    log(`Yahoo：当前已有 ${remainingAliases.length} 个一次性邮箱，将保留现有邮箱并继续直接创建新邮箱`, 'info');
  }

  const prefix = normalizeLowerText(payload.prefix || '') || generateAliasPrefix(10);
  log(`Yahoo：准备创建新一次性邮箱，关键词=${prefix}`, 'info');

  const addButton = findYahooDisposableAddButton();
  if (!addButton) {
    throw new Error(`创建 Yahoo 临时邮箱失败：未找到“新建一次性电子邮箱/地址”按钮，请确认 Yahoo 设置页已加载到一次性邮箱区域；${buildYahooAliasCreateDiagnostics()}`);
  }

  const addRect = addButton.getBoundingClientRect();
  const addX = Math.round(addRect.left + addRect.width / 2);
  const addY = Math.round(addRect.top + addRect.height / 2);
  log(`Yahoo：已定位“添加”按钮 tag=${addButton.tagName || 'unknown'} rect=${Math.round(addRect.width)}x${Math.round(addRect.height)} pos=${addX},${addY}`, 'info');

  let createPanel = null;
  const clickTargets = [
    addButton.closest?.('button, [role="button"], a, div') || addButton,
    document.elementFromPoint(addX, addY)?.closest?.('button, [role="button"], a, div') || addButton,
  ].filter(Boolean);

  for (const target of clickTargets) {
    dispatchHoverSequence(target, addX, addY);
    await sleep(120);
    dispatchClickSequence(target, addX, addY);
    try { if (typeof target.click === 'function') target.click(); } catch {}
    log(`Yahoo：已点击“添加”按钮 target=${target.tagName || 'unknown'}`, 'info');

    for (let i = 0; i < 8 && !createPanel; i += 1) {
      await sleep(250);
      createPanel = findYahooCreatePanel();
    }
    if (createPanel) break;
  }

  if (!createPanel) {
    const section = findDisposableAliasSection();
    if (section) {
      const sectionRect = section.getBoundingClientRect();
      const fallbackX = Math.round(sectionRect.right - 32);
      const fallbackY = Math.round(sectionRect.top + 34);
      const fallbackTarget = document.elementFromPoint(fallbackX, fallbackY)?.closest?.('button, [role="button"], a, div');
      if (fallbackTarget) {
        dispatchHoverSequence(fallbackTarget, fallbackX, fallbackY);
        await sleep(120);
        dispatchClickSequence(fallbackTarget, fallbackX, fallbackY);
        try { if (typeof fallbackTarget.click === 'function') fallbackTarget.click(); } catch {}
        log(`Yahoo：已执行“添加”按钮兜底点击 target=${fallbackTarget.tagName || 'unknown'} pos=${fallbackX},${fallbackY}`, 'warn');
        for (let i = 0; i < 8 && !createPanel; i += 1) {
          await sleep(250);
          createPanel = findYahooCreatePanel();
        }
      }
    }
  }
  if (!createPanel) {
    throw new Error('创建 Yahoo 临时邮箱失败：点击“添加”后未出现创建面板。');
  }
  log('Yahoo：已识别到右侧创建面板', 'info');

  let input = findYahooAliasInput();
  if (!input) {
    for (let i = 0; i < 20 && !input; i += 1) {
      await sleep(300);
      input = findYahooAliasInput();
    }
  }
  if (!input) {
    const panelText = normalizeText((findYahooCreatePanel()?.innerText || findYahooCreatePanel()?.textContent || '')).slice(0, 500);
    throw new Error(`创建 Yahoo 临时邮箱失败：未找到一次性邮箱输入框。创建面板片段：${panelText || '(empty)'}`);
  }
  fillInput(input, prefix);
  try { input.focus?.(); } catch {}
  if (input instanceof HTMLElement && input.getAttribute('contenteditable') === 'true') {
    input.textContent = prefix;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prefix }));
  }
  log(`Yahoo：已填写关键词输入框 tag=${input.tagName || 'unknown'}`, 'info');
  await sleep(500);

  const saveButton = findYahooButtonByText([
    /save/i,
    /done/i,
    /create/i,
    /add/i,
    /完成/i,
    /保存/i,
    /节省/i,
    /创建/i,
    /添加/i,
  ], findYahooCreatePanel() || document);
  if (!saveButton) {
    throw new Error('创建 Yahoo 临时邮箱失败：未找到保存/创建按钮。');
  }

  simulateClick(saveButton);
  log('Yahoo：已点击”节省/保存”按钮', 'info');
  await sleep(1500);

  // 等待创建面板消失
  for (let i = 0; i < 20; i += 1) {
    const panel = findYahooCreatePanel();
    if (!panel) {
      log('Yahoo：创建面板已关闭', 'info');
      break;
    }
    await sleep(300);
  }

  await sleep(1000);
  const limitDialogAfterSave = findVisibleDialog();
  if (limitDialogAfterSave) {
    const limitText = getYahooDialogText(limitDialogAfterSave);
    await closeLimitDialogIfPresent();
    throw new Error(`创建 Yahoo 临时邮箱失败：Yahoo 页面提示已达到一次性邮箱/别名上限；当前已按要求不自动清理旧别名，所以无法继续创建新别名。弹窗内容=${limitText || '(empty)'}`);
  }

  let afterUsage = null;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    afterUsage = getDisposableAliasUsageCount();
    if (beforeUsage?.used >= 0 && afterUsage?.used > beforeUsage.used) {
      break;
    }
    if (attempt < 10) {
      log(`Yahoo：等待一次性邮箱数量增加（${attempt}/10）...`, 'info');
      await sleep(600);
    }
  }

  if (!(beforeUsage?.used >= 0 && afterUsage?.used > beforeUsage.used)) {
    const beforeText = beforeUsage ? `${beforeUsage.used}/${beforeUsage.limit}` : 'unknown';
    const afterText = afterUsage ? `${afterUsage.used}/${afterUsage.limit}` : 'unknown';
    throw new Error(`创建 Yahoo 临时邮箱失败：保存后一次性邮箱数量未增加（before=${beforeText}, after=${afterText}）。`);
  }

  const createdAlias = inferYahooAliasFromExistingAliases(prefix, remainingAliases);
  if (!createdAlias) {
    throw new Error(`创建 Yahoo 临时邮箱失败：一次性邮箱数量已从 ${beforeUsage.used} 增至 ${afterUsage.used}，但无法从现有别名推断完整邮箱地址。`);
  }

  log(`Yahoo：一次性邮箱数量已从 ${beforeUsage.used} 增至 ${afterUsage.used}，按现有别名格式推断新别名 ${createdAlias}`, 'info');
  return {
    ok: true,
    email: createdAlias,
    deletedAliases: [],
  };
}
