// content/mail-2925.js - Content script for 2925 Mail (steps 4, 8)
// Injected dynamically on: 2925.com

const MAIL2925_PREFIX = '[MultiPage:mail-2925]';
const isTopFrame = window === window.top;

console.log(MAIL2925_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

if (!isTopFrame) {
  console.log(MAIL2925_PREFIX, 'Skipping child frame');
} else {

let seenCodes = new Set();
let seenCodeSessionKey = '';
let seenCodesReadyPromise = null;

async function loadSeenCodes() {
  try {
    const data = await chrome.storage.session.get(['seen2925CodeState', 'seen2925Codes']);
    const state = data?.seen2925CodeState || null;
    if (state && typeof state === 'object') {
      seenCodeSessionKey = String(state.sessionKey || '');
      if (Array.isArray(state.codes)) {
        seenCodes = new Set(state.codes);
      }
      console.log(MAIL2925_PREFIX, `Loaded ${seenCodes.size} seen codes for session ${seenCodeSessionKey || 'default'}`);
      return;
    }

    if (data.seen2925Codes && Array.isArray(data.seen2925Codes)) {
      seenCodes = new Set(data.seen2925Codes);
      console.log(MAIL2925_PREFIX, `Loaded ${seenCodes.size} previously seen codes`);
    }
  } catch (err) {
    console.warn(MAIL2925_PREFIX, 'Session storage unavailable, using in-memory seen codes:', err?.message || err);
  }
}

seenCodesReadyPromise = loadSeenCodes();

async function persistSeenCodes() {
  try {
    await chrome.storage.session.set({
      seen2925Codes: [...seenCodes],
      seen2925CodeState: {
        sessionKey: seenCodeSessionKey,
        codes: [...seenCodes],
      },
    });
  } catch (err) {
    console.warn(MAIL2925_PREFIX, 'Could not persist seen codes, continuing in-memory only:', err?.message || err);
  }
}

function buildSeenCodeSessionKey(step, payload = {}) {
  const explicitSessionKey = String(payload?.sessionKey || '').trim();
  if (explicitSessionKey) {
    return explicitSessionKey;
  }
  const timestamp = Number(payload?.filterAfterTimestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return `${step}:${timestamp}`;
  }
  return `${step}:default`;
}

async function ensureSeenCodesSession(step, payload = {}) {
  if (seenCodesReadyPromise) {
    await seenCodesReadyPromise;
    seenCodesReadyPromise = null;
  }

  const nextSessionKey = buildSeenCodeSessionKey(step, payload);
  if (seenCodeSessionKey === nextSessionKey) {
    return;
  }

  seenCodeSessionKey = nextSessionKey;
  seenCodes = new Set();
  await persistSeenCodes();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENSURE_MAIL2925_SESSION') {
    resetStopState();
    ensureMail2925Session(message.payload).then((result) => {
      sendResponse(result);
    }).catch((err) => {
      sendResponse({ error: err?.message || String(err || '2925 登录失败') });
    });
    return true;
  }

  if (message.type === 'POLL_EMAIL') {
    resetStopState();
    handlePollEmail(message.step, message.payload).then((result) => {
      sendResponse(result);
    }).catch((err) => {
      if (isStopError(err)) {
        log(`步骤 ${message.step}：已被用户停止。`, 'warn');
        sendResponse({ stopped: true, error: err.message });
        return;
      }

      log(`步骤 ${message.step}：邮箱轮询失败：${err.message}`, 'warn');
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'DELETE_ALL_EMAILS') {
    Promise.resolve(deleteAllMailboxEmails(message.step)).then((deleted) => {
      sendResponse({ ok: true, deleted });
    }).catch((err) => {
      sendResponse({ ok: false, error: err?.message || String(err || '删除邮件失败') });
    });
    return true;
  }

  return false;
});

const MAIL_ITEM_SELECTORS = [
  '.mail-item',
  '.letter-item',
  '[class*="mailItem"]',
  '[class*="mail-item"]',
  '[class*="MailItem"]',
  '.el-table__row',
  'tr[class*="mail"]',
  '[class*="listItem"]',
  '[class*="list-item"]',
  'li[class*="mail"]',
];
const MAIL_ITEM_SELECTOR_GROUP = MAIL_ITEM_SELECTORS.join(', ');
const MAIL_REFRESH_SELECTORS = [
  '[class*="refresh"]',
  '[title*="刷新"]',
  '[aria-label*="刷新"]',
  '[class*="Refresh"]',
];
const MAIL_INBOX_SELECTORS = [
  'a[href*="mailList"]',
  '[class*="inbox"]',
  '[class*="Inbox"]',
  '[title*="收件箱"]',
];
const MAIL_DELETE_SELECTORS = [
  '[class*="delete"]',
  '[title*="删除"]',
  '[aria-label*="删除"]',
  '[class*="Delete"]',
];
const MAIL_SELECT_ALL_SELECTORS = [
  'input[type="checkbox"]',
  '[role="checkbox"]',
  '.el-checkbox__input',
  '.el-checkbox',
  'label[class*="checkbox"]',
  '[class*="checkbox"]',
];
const MAIL_ACTION_CANDIDATE_SELECTORS = 'button, [role="button"], a, label, span, div';
const MAIL2925_LIMIT_ERROR_PREFIX = 'MAIL2925_LIMIT_REACHED::';
const MAIL2925_LOGIN_INPUT_SELECTORS = [
  'input[type="email"]',
  'input[name*="mail"]',
  'input[id*="mail"]',
  'input[name*="user"]',
  'input[id*="user"]',
  'input[placeholder*="邮箱"]',
  'input[placeholder*="账号"]',
  'input[placeholder*="用户名"]',
  'input[type="text"]',
];
const MAIL2925_PASSWORD_INPUT_SELECTORS = [
  'input[type="password"]',
];
const MAIL2925_LOGIN_BUTTON_SELECTORS = [
  'button[type="submit"]',
  '.ivu-btn-primary',
  '.el-button--primary',
  '[class*="login"]',
  '[class*="Login"]',
];
const MAIL2925_LOGIN_BUTTON_PATTERNS = [
  /登录/i,
  /login/i,
  /立即登录/i,
  /submit/i,
];
const MAIL2925_AGREEMENT_PATTERNS = [
  /我已阅读并同意/,
  /服务协议/,
  /隐私政策/,
];
const MAIL2925_REMEMBER_LOGIN_PATTERNS = [
  /30天内免登录/,
  /免登录/,
  /记住登录/,
  /保持登录/,
];

function normalizeNodeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildMail2925LimitError(message = '') {
  const normalized = normalizeNodeText(message || '子邮箱已达上限邮箱') || '子邮箱已达上限邮箱';
  return new Error(`${MAIL2925_LIMIT_ERROR_PREFIX}${normalized}`);
}

function getPageTextSample(limit = 4000) {
  return normalizeNodeText(document.body?.innerText || document.body?.textContent || '').slice(0, limit);
}

function detectMail2925LimitMessage() {
  const text = getPageTextSample();
  if (!text) {
    return '';
  }

  const match = text.match(/子邮箱.{0,12}已达上限|已达上限邮箱|子邮箱上限|邮箱已达上限/);
  return match ? match[0] : '';
}

function throwIfMail2925LimitReached() {
  const limitMessage = detectMail2925LimitMessage();
  if (limitMessage) {
    throw buildMail2925LimitError(limitMessage);
  }
}

function isVisibleNode(node) {
  if (!node) return false;
  if (node.hidden) return false;

  const style = typeof window.getComputedStyle === 'function'
    ? window.getComputedStyle(node)
    : null;
  if (style && (style.display === 'none' || style.visibility === 'hidden')) {
    return false;
  }

  const rect = typeof node.getBoundingClientRect === 'function'
    ? node.getBoundingClientRect()
    : null;
  if (rect && rect.width <= 0 && rect.height <= 0) {
    return false;
  }

  return true;
}

function isMailItemNode(node) {
  return Boolean(node?.closest?.(MAIL_ITEM_SELECTOR_GROUP));
}

function resolveActionTarget(node) {
  return node?.closest?.('button, [role="button"], a, label, .el-checkbox, .el-checkbox__input') || node || null;
}

function findMailItems() {
  for (const selector of MAIL_ITEM_SELECTORS) {
    const items = document.querySelectorAll(selector);
    if (items.length > 0) {
      return Array.from(items);
    }
  }
  return [];
}

function findActionBySelectors(selectors = []) {
  for (const selector of selectors) {
    const candidates = document.querySelectorAll(selector);
    for (const candidate of candidates) {
      const target = resolveActionTarget(candidate);
      if (!isVisibleNode(target) || isMailItemNode(target)) {
        continue;
      }
      return target;
    }
  }
  return null;
}

function findVisibleInputBySelectors(selectors = []) {
  for (const selector of selectors) {
    const candidates = document.querySelectorAll(selector);
    for (const candidate of candidates) {
      if (!isVisibleNode(candidate) || candidate.disabled || candidate.readOnly) {
        continue;
      }
      return candidate;
    }
  }
  return null;
}

function findToolbarActionButton(patterns = [], selectors = []) {
  const directMatch = findActionBySelectors(selectors);
  if (directMatch) {
    return directMatch;
  }

  const candidates = document.querySelectorAll(MAIL_ACTION_CANDIDATE_SELECTORS);
  for (const candidate of candidates) {
    const target = resolveActionTarget(candidate);
    if (!isVisibleNode(target) || isMailItemNode(target)) {
      continue;
    }

    const text = normalizeNodeText(target.innerText || target.textContent || '');
    const label = normalizeNodeText(target.getAttribute?.('aria-label') || target.getAttribute?.('title') || '');
    if (patterns.some((pattern) => pattern.test(text) || pattern.test(label))) {
      return target;
    }
  }

  return null;
}

function findLoginButton() {
  const directMatch = findActionBySelectors(MAIL2925_LOGIN_BUTTON_SELECTORS);
  if (directMatch) {
    return directMatch;
  }

  const candidates = document.querySelectorAll(MAIL_ACTION_CANDIDATE_SELECTORS);
  for (const candidate of candidates) {
    const target = resolveActionTarget(candidate);
    if (!isVisibleNode(target) || isMailItemNode(target)) {
      continue;
    }

    const text = normalizeNodeText(target.innerText || target.textContent || '');
    const label = normalizeNodeText(target.getAttribute?.('aria-label') || target.getAttribute?.('title') || '');
    if (MAIL2925_LOGIN_BUTTON_PATTERNS.some((pattern) => pattern.test(text) || pattern.test(label))) {
      return target;
    }
  }

  return null;
}

function findRefreshButton() {
  return findToolbarActionButton([
    /刷新/i,
    /refresh/i,
  ], MAIL_REFRESH_SELECTORS);
}

function findInboxLink() {
  return findActionBySelectors(MAIL_INBOX_SELECTORS);
}

function findDeleteButton() {
  return findToolbarActionButton([
    /删除/i,
    /delete/i,
  ], MAIL_DELETE_SELECTORS);
}

function findSelectAllControl() {
  return findActionBySelectors(MAIL_SELECT_ALL_SELECTORS);
}

function findMail2925LoginEmailInput() {
  const candidates = Array.from(document.querySelectorAll(MAIL2925_LOGIN_INPUT_SELECTORS.join(', ')));
  for (const candidate of candidates) {
    if (!isVisibleNode(candidate) || candidate.disabled || candidate.readOnly) {
      continue;
    }
    if (candidate.type === 'password') {
      continue;
    }
    const identifier = normalizeNodeText([
      candidate.name,
      candidate.id,
      candidate.placeholder,
      candidate.getAttribute?.('aria-label'),
      candidate.getAttribute?.('autocomplete'),
    ].join(' ')).toLowerCase();
    if (/邮箱|账号|用户|mail|user|login/.test(identifier) || candidate.type === 'email') {
      return candidate;
    }
  }
  return null;
}

function findMail2925LoginPasswordInput() {
  return findVisibleInputBySelectors(MAIL2925_PASSWORD_INPUT_SELECTORS);
}

function findAgreementContainer() {
  const candidates = document.querySelectorAll('label, div, span, p, form');
  for (const candidate of candidates) {
    if (!isVisibleNode(candidate)) {
      continue;
    }
    const text = normalizeNodeText(candidate.innerText || candidate.textContent || '');
    if (!text) {
      continue;
    }
    if (MAIL2925_AGREEMENT_PATTERNS.every((pattern) => pattern.test(text) || /我已阅读并同意/.test(text))) {
      return candidate;
    }
    if (/我已阅读并同意/.test(text) && (/服务协议/.test(text) || /隐私政策/.test(text))) {
      return candidate;
    }
  }
  return null;
}

function isAgreementText(text = '') {
  const normalizedText = normalizeNodeText(text);
  if (!normalizedText || MAIL2925_REMEMBER_LOGIN_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return false;
  }

  return /我已阅读并同意/.test(normalizedText)
    || (/服务协议/.test(normalizedText) && /隐私政策/.test(normalizedText));
}

function getCheckboxContextText(target) {
  if (!target) {
    return '';
  }

  const textParts = [];
  const candidates = [
    target,
    target.closest?.('label'),
    target.parentElement,
    target.parentElement?.parentElement,
    target.nextElementSibling,
    target.previousElementSibling,
    target.closest?.('label, div, span, p, li, form'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const text = normalizeNodeText(candidate.innerText || candidate.textContent || '');
    if (text) {
      textParts.push(text);
    }
  }

  return normalizeNodeText(textParts.join(' '));
}

function findAgreementCheckbox() {
  const genericCheckboxes = document.querySelectorAll('input[type="checkbox"], [role="checkbox"], .ivu-checkbox, .el-checkbox');
  for (const checkbox of genericCheckboxes) {
    const target = resolveActionTarget(checkbox);
    if (!isVisibleNode(target)) {
      continue;
    }

    const contextText = getCheckboxContextText(target);
    if (MAIL2925_REMEMBER_LOGIN_PATTERNS.some((pattern) => pattern.test(contextText))) {
      continue;
    }
    if (isAgreementText(contextText)) {
      return target;
    }
  }

  const agreementContainer = findAgreementContainer();
  if (agreementContainer) {
    const checkbox = agreementContainer.querySelector('input[type="checkbox"], [role="checkbox"], .ivu-checkbox, .el-checkbox');
    if (checkbox) {
      const target = resolveActionTarget(checkbox);
      const contextText = getCheckboxContextText(target);
      if (!MAIL2925_REMEMBER_LOGIN_PATTERNS.some((pattern) => pattern.test(contextText))) {
        return target;
      }
    }
    const nearbyCheckbox = agreementContainer.parentElement?.querySelector?.('input[type="checkbox"], [role="checkbox"], .ivu-checkbox, .el-checkbox');
    if (nearbyCheckbox) {
      const target = resolveActionTarget(nearbyCheckbox);
      const contextText = getCheckboxContextText(target);
      if (!MAIL2925_REMEMBER_LOGIN_PATTERNS.some((pattern) => pattern.test(contextText))) {
        return target;
      }
    }
  }

  return null;
}

async function ensureAgreementChecked() {
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"], .ivu-checkbox, .el-checkbox'))
    .map((checkbox) => resolveActionTarget(checkbox))
    .filter((target, index, list) => target && isVisibleNode(target) && list.indexOf(target) === index);

  if (!checkboxes.length) {
    return false;
  }

  let changed = false;
  for (const checkbox of checkboxes) {
    if (isCheckboxChecked(checkbox)) {
      continue;
    }
    await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'click', label: 'mail2925-agreement-checkbox' }, async () => {
      simulateClick(checkbox);
    });
    changed = true;
    await sleep(120);
  }

  return changed || checkboxes.every((checkbox) => isCheckboxChecked(checkbox));
}

function detectMail2925ViewState() {
  const limitMessage = detectMail2925LimitMessage();
  if (limitMessage) {
    return { view: 'limit', limitMessage };
  }

  const mailboxEmail = getMail2925DisplayedMailboxEmail();
  if (findMailItems().length > 0 || mailboxEmail) {
    return { view: 'mailbox', limitMessage: '', mailboxEmail };
  }

  if (findMail2925LoginPasswordInput() && findMail2925LoginEmailInput()) {
    return { view: 'login', limitMessage: '' };
  }

  const pageText = getPageTextSample();
  if (/欢迎使用邮箱|登录|login/i.test(pageText) && /密码|password/i.test(pageText)) {
    return { view: 'login', limitMessage: '' };
  }

  return { view: 'unknown', limitMessage: '' };
}

function getMail2925DisplayedMailboxEmail() {
  const directSelectors = [
    '.right-header',
    '[class~="right-header"]',
    '[class*="right-header"]',
    '[class*="user"] [class*="mail"]',
    '[class*="user"] [class*="email"]',
    '[class*="account"] [class*="mail"]',
    '[class*="account"] [class*="email"]',
    '[class*="header"] [class*="mail"]',
    '[class*="header"] [class*="email"]',
  ];

  for (const selector of directSelectors) {
    const candidates = document.querySelectorAll(selector);
    for (const candidate of candidates) {
      if (!isVisibleNode(candidate) || isMailItemNode(candidate)) {
        continue;
      }
      const email = extractEmails(candidate.textContent || candidate.innerText || '')
        .find((value) => /@2925\.com$/i.test(String(value || '').trim())) || '';
      if (email) {
        return email;
      }
    }
  }

  const topCandidates = Array.from(document.querySelectorAll('body *'))
    .filter((node) => {
      if (!isVisibleNode(node) || isMailItemNode(node)) {
        return false;
      }
      const rect = typeof node.getBoundingClientRect === 'function'
        ? node.getBoundingClientRect()
        : null;
      if (!rect) return false;
      return rect.top >= 0 && rect.top <= Math.max(window.innerHeight * 0.35, 280);
    })
    .map((node) => {
      const email = extractEmails(node.textContent || node.innerText || '')
        .find((value) => /@2925\.com$/i.test(String(value || '').trim())) || '';
      return { node, email };
    })
    .filter((entry) => entry.email);

  if (!topCandidates.length) {
    return '';
  }

  topCandidates.sort((left, right) => {
    const leftRect = left.node.getBoundingClientRect();
    const rightRect = right.node.getBoundingClientRect();
    if (leftRect.top !== rightRect.top) {
      return leftRect.top - rightRect.top;
    }
    return leftRect.left - rightRect.left;
  });

  return topCandidates[0]?.email || '';
}

function isCheckboxChecked(node) {
  const checkbox = node?.matches?.('input[type="checkbox"], [role="checkbox"]')
    ? node
    : node?.querySelector?.('input[type="checkbox"], [role="checkbox"]');
  if (checkbox?.checked === true) {
    return true;
  }
  if (String(checkbox?.getAttribute?.('aria-checked') || '').toLowerCase() === 'true') {
    return true;
  }
  return Boolean(
    node?.classList?.contains('is-checked')
    || node?.classList?.contains('checked')
  );
}

function getMailItemText(item) {
  if (!item) return '';
  const contentCell = item.querySelector('td.content, .content, .mail-content');
  const titleEl = item.querySelector('.mail-content-title');
  const textEl = item.querySelector('.mail-content-text');
  return [
    titleEl?.getAttribute('title') || '',
    titleEl?.textContent || '',
    textEl?.textContent || '',
    contentCell?.textContent || '',
    item.textContent || '',
  ].join(' ');
}

function getMailItemTimeText(item) {
  const timeEl = item?.querySelector('.date-time-text, [class*="date-time"], [class*="time"], td.time');
  return normalizeNodeText(timeEl?.textContent || '');
}

function normalizeMailIdentityPart(value) {
  return normalizeNodeText(value).toLowerCase();
}

function getMailItemId(item, index = 0) {
  const candidates = [
    item?.getAttribute?.('data-id'),
    item?.dataset?.id,
    item?.getAttribute?.('data-mail-id'),
    item?.dataset?.mailId,
    item?.getAttribute?.('data-key'),
    item?.getAttribute?.('key'),
  ].filter(Boolean);

  if (candidates.length > 0) {
    return String(candidates[0]);
  }

  return [
    index,
    normalizeMailIdentityPart(getMailItemTimeText(item)),
    normalizeMailIdentityPart(getMailItemText(item)).slice(0, 240),
  ].join('|');
}

function getCurrentMailIds(items = []) {
  const ids = new Set();
  items.forEach((item, index) => {
    ids.add(getMailItemId(item, index));
  });
  return ids;
}

function matchesMailFilters(text, senderFilters, subjectFilters) {
  const lower = String(text || '').toLowerCase();
  const senderMatch = senderFilters.some((filter) => lower.includes(String(filter || '').toLowerCase()));
  const subjectMatch = subjectFilters.some((filter) => lower.includes(String(filter || '').toLowerCase()));
  return senderMatch || subjectMatch;
}

function extractStrictChatGPTVerificationCode(text) {
  const normalized = String(text || '');
  const patterns = [
    /your\s+(?:temporary\s+)?chatgpt\s+(?:(?:log-?in|login)\s+)?code\s+is[\s\S]{0,80}?(\d{6})/i,
    /(?:chatgpt\s+log-?in\s+code|suspicious\s+log-?in)[\s\S]{0,200}?enter\s+this\s+code[\s\S]{0,80}?(\d{6})/i,
    /enter\s+this\s+code[\s\S]{0,80}?(\d{6})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function isLikelyCompactTimeValue(value = '') {
  const text = String(value || '');
  if (!/^\d{6}$/.test(text)) return false;

  const hours = Number(text.slice(0, 2));
  const minutes = Number(text.slice(2, 4));
  const seconds = Number(text.slice(4, 6));
  return hours >= 0 && hours <= 23
    && minutes >= 0 && minutes <= 59
    && seconds >= 0 && seconds <= 59;
}

function isLikelyHeaderTimestampCode(text, index, value) {
  const source = String(text || '');
  const candidate = String(value || '');
  if (!candidate) return false;

  const before = source.slice(Math.max(0, index - 80), index);
  const after = source.slice(index + candidate.length, index + candidate.length + 40);
  const context = `${before}${candidate}${after}`.replace(/\s+/g, ' ');
  const beforeCompact = before.replace(/\s+/g, ' ');
  const timeLike = isLikelyCompactTimeValue(candidate);

  if (
    timeLike
    && /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*$/.test(beforeCompact)
  ) {
    return true;
  }

  if (
    timeLike
    && /(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?|\d{6})/.test(context)
  ) {
    return true;
  }

  return /(?:time|date|sent|received|received\s+at|sent\s+at|\u65f6\s*\u95f4|\u65e5\s*\u671f)[\s:\uFF1A-]*$/i.test(beforeCompact)
    && (timeLike || /^20\d{4}$/.test(candidate));
}

function findSafeStandaloneSixDigitCode(text) {
  const normalized = String(text || '');
  const pattern = /\b(\d{6})\b/g;
  let match = null;

  while ((match = pattern.exec(normalized)) !== null) {
    const candidate = match[1];
    if (!isLikelyHeaderTimestampCode(normalized, match.index, candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractVerificationCode(text, strictChatGPTCodeOnly = false) {
  const strictCode = extractStrictChatGPTVerificationCode(text);
  if (strictChatGPTCodeOnly) {
    return strictCode;
  }
  if (strictCode) return strictCode;

  const normalized = String(text || '');

  const matchCn = normalized.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/);
  if (matchCn) return matchCn[1];

  const matchOpenAiLogin = normalized.match(/(?:chatgpt\s+log-?in\s+code|enter\s+this\s+code)[^0-9]{0,24}(\d{6})/i);
  if (matchOpenAiLogin) return matchOpenAiLogin[1];

  const matchChatGPT = normalized.match(/your\s+chatgpt\s+code\s+is\s+(\d{6})/i);
  if (matchChatGPT) return matchChatGPT[1];

  const matchEn = normalized.match(/code[:\s]+is[:\s]+(\d{6})|code[:\s]+(\d{6})/i);
  if (matchEn) return matchEn[1] || matchEn[2];

  return findSafeStandaloneSixDigitCode(normalized);
}

function extractEmails(text = '') {
  const matches = String(text || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  return [...new Set(matches.map((item) => item.toLowerCase()))];
}

function extractForwardedTargetEmails(text = '') {
  const normalizedText = String(text || '').toLowerCase();
  const matches = normalizedText.match(/bounce\+[a-z0-9._%+-]*-([a-z0-9._%+-]+)=([a-z0-9.-]+\.[a-z]{2,})@(?:tm\d*\.openai\.com|em\d+\.tm\.openai\.com)/gi) || [];
  const decoded = matches
    .map((candidate) => {
      const match = String(candidate || '').match(/bounce\+[a-z0-9._%+-]*-([a-z0-9._%+-]+)=([a-z0-9.-]+\.[a-z]{2,})@/i);
      if (!match) {
        return '';
      }
      return `${match[1].toLowerCase()}@${match[2].toLowerCase()}`;
    })
    .filter(Boolean);
  return [...new Set(decoded)];
}

function emailMatchesTarget(candidate, targetEmail) {
  const normalizedCandidate = String(candidate || '').trim().toLowerCase();
  const normalizedTarget = String(targetEmail || '').trim().toLowerCase();
  if (!normalizedCandidate || !normalizedTarget) {
    return false;
  }

  return normalizedCandidate === normalizedTarget;
}

function getTargetEmailMatchState(text, targetEmail) {
  const normalizedTarget = String(targetEmail || '').trim().toLowerCase();
  if (!normalizedTarget) {
    return { matches: true, hasExplicitEmail: false };
  }

  const normalizedText = String(text || '').toLowerCase();
  if (normalizedText.includes(normalizedTarget)) {
    return { matches: true, hasExplicitEmail: true };
  }

  const extractedEmails = extractEmails(normalizedText);
  const forwardedTargetEmails = extractForwardedTargetEmails(normalizedText);
  if (!extractedEmails.length) {
    return forwardedTargetEmails.length
      ? {
        matches: forwardedTargetEmails.some((candidate) => emailMatchesTarget(candidate, normalizedTarget)),
        hasExplicitEmail: true,
      }
      : { matches: true, hasExplicitEmail: false };
  }

  const targetDomain = normalizedTarget.includes('@')
    ? normalizedTarget.split('@').pop()
    : '';
  const comparableEmails = [...new Set(
    (targetDomain
      ? [...extractedEmails, ...forwardedTargetEmails].filter((candidate) => String(candidate || '').trim().toLowerCase().endsWith(`@${targetDomain}`))
      : [...extractedEmails, ...forwardedTargetEmails])
  )];
  if (!comparableEmails.length) {
    return { matches: true, hasExplicitEmail: false };
  }

  return {
    matches: comparableEmails.some((candidate) => emailMatchesTarget(candidate, normalizedTarget)),
    hasExplicitEmail: true,
  };
}

function normalizeMinuteTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime();
}

function parseMailItemTimestamp(item) {
  const timeText = getMailItemTimeText(item);
  if (!timeText) return null;

  const now = new Date();
  const date = new Date(now);
  let match = null;

  if (/刚刚/.test(timeText)) {
    return now.getTime();
  }

  match = timeText.match(/(\d+)\s*分钟前/);
  if (match) {
    return now.getTime() - Number(match[1]) * 60 * 1000;
  }

  match = timeText.match(/(\d+)\s*秒前/);
  if (match) {
    return now.getTime() - Number(match[1]) * 1000;
  }

  match = timeText.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date.getTime();
  }

  match = timeText.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (match) {
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date.getTime();
  }

  match = timeText.match(/昨天\s*(\d{1,2}):(\d{2})/);
  if (match) {
    date.setDate(date.getDate() - 1);
    date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return date.getTime();
  }

  match = timeText.match(/(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{2})/);
  if (match) {
    date.setMonth(Number(match[1]) - 1, Number(match[2]));
    date.setHours(Number(match[3]), Number(match[4]), 0, 0);
    return date.getTime();
  }

  match = timeText.match(/(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?/);
  if (match) {
    date.setMonth(Number(match[1]) - 1, Number(match[2]));
    if (match[3] && match[4]) {
      date.setHours(Number(match[3]), Number(match[4]), 0, 0);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    return date.getTime();
  }

  match = timeText.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{2})/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      0,
      0
    ).getTime();
  }

  return null;
}

async function sleepRandom(minMs, maxMs = minMs) {
  const duration = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await sleep(duration);
}

async function returnToInbox() {
  if (findMailItems().length > 0) {
    return true;
  }

  const inboxLink = findInboxLink();
  if (!inboxLink) {
    return false;
  }

  simulateClick(inboxLink);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(250);
    if (findMailItems().length > 0) {
      return true;
    }
  }

  return false;
}

async function openMailAndGetMessageText(item) {
  simulateClick(item);
  try {
    await sleepRandom(1200, 2200);
    return document.body?.textContent || '';
  } finally {
    await returnToInbox();
  }
}

async function deleteCurrentMailboxEmail(step) {
  try {
    const deleteButton = findDeleteButton();
    if (!deleteButton) {
      return false;
    }

    simulateClick(deleteButton);
    await sleepRandom(200, 500);
    return true;
  } catch (err) {
    console.warn(MAIL2925_PREFIX, `Step ${step}: delete-current cleanup failed:`, err?.message || err);
    return false;
  }
}

async function openMailAndDeleteAfterRead(item, step) {
  simulateClick(item);
  try {
    await sleepRandom(1200, 2200);
    return document.body?.textContent || '';
  } finally {
    await deleteCurrentMailboxEmail(step);
    await returnToInbox();
  }
}

async function deleteAllMailboxEmails(step) {
  try {
    await returnToInbox();
    const initialItems = findMailItems();
    if (initialItems.length === 0) {
      return true;
    }

    const selectAllControl = findSelectAllControl();
    if (!selectAllControl) {
      return false;
    }

    if (!isCheckboxChecked(selectAllControl)) {
      simulateClick(selectAllControl);
      await sleepRandom(200, 500);
    }

    const deleteButton = findDeleteButton();
    if (!deleteButton) {
      return false;
    }

    simulateClick(deleteButton);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(250);
      if (findMailItems().length === 0) {
        return true;
      }
    }

    await sleepRandom(200, 500);
    return findMailItems().length === 0;
  } catch (err) {
    console.warn(MAIL2925_PREFIX, `Step ${step}: delete-all cleanup failed:`, err?.message || err);
    return false;
  }
}

async function refreshInbox() {
  if (typeof throwIfMail2925LimitReached === 'function') {
    throwIfMail2925LimitReached();
  }
  const refreshBtn = findRefreshButton();
  if (refreshBtn) {
    simulateClick(refreshBtn);
    await sleepRandom(700, 1200);
    return;
  }

  const inboxLink = findInboxLink();
  if (inboxLink) {
    simulateClick(inboxLink);
    await sleepRandom(700, 1200);
  }
}

async function waitForMail2925View(targetView, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    throwIfStopped();
    const currentState = detectMail2925ViewState();
    if (currentState.view === 'limit') {
      throw buildMail2925LimitError(currentState.limitMessage);
    }
    if (currentState.view === targetView) {
      return currentState;
    }
    await sleep(500);
  }
  return detectMail2925ViewState();
}

async function performOperationWithDelay(metadata, operation) {
  const gate = window.CodexOperationDelay?.performOperationWithDelay;
  return typeof gate === 'function' ? gate(metadata, operation) : operation();
}

async function ensureMail2925Session(payload = {}) {
  const email = String(payload?.email || '').trim();
  const password = String(payload?.password || '');
  const forceLogin = Boolean(payload?.forceLogin);
  const allowLoginWhenOnLoginPage = payload?.allowLoginWhenOnLoginPage !== false;
  log(`步骤 0：2925 登录态检查开始，当前地址 ${location.href}，forceLogin=${forceLogin ? 'true' : 'false'}`, 'info');

  for (let attempt = 0; attempt < 10; attempt += 1) {
    throwIfStopped();
    const currentState = detectMail2925ViewState();
    log(`步骤 0：2925 登录页状态探测，第 ${attempt + 1}/10 次，状态=${currentState.view}，地址=${location.href}`, 'info');
    if (currentState.view === 'limit') {
      return {
        ok: false,
        loggedIn: false,
        currentView: 'limit',
        limitReached: true,
        limitMessage: currentState.limitMessage,
      };
    }
    if (currentState.view === 'mailbox' && !forceLogin) {
      return {
        ok: true,
        loggedIn: true,
        currentView: 'mailbox',
        mailboxEmail: currentState.mailboxEmail || '',
      };
    }
    if (currentState.view === 'login') {
      if (!forceLogin && !allowLoginWhenOnLoginPage) {
        return {
          ok: false,
          loggedIn: false,
          currentView: 'login',
          requiresLogin: true,
          mailboxEmail: '',
        };
      }
      break;
    }
    await sleep(500);
  }

  const loginState = detectMail2925ViewState();
  log(`步骤 0：2925 准备执行登录，当前状态=${loginState.view}，地址=${location.href}`, 'info');
  if (loginState.view === 'mailbox') {
    return {
      ok: true,
      loggedIn: true,
      currentView: 'mailbox',
      mailboxEmail: loginState.mailboxEmail || '',
    };
  }
  if (loginState.view === 'limit') {
    return {
      ok: false,
      loggedIn: false,
      currentView: 'limit',
      limitReached: true,
      limitMessage: loginState.limitMessage,
    };
  }
  if (!forceLogin && !allowLoginWhenOnLoginPage && loginState.view === 'login') {
    return {
      ok: false,
      loggedIn: false,
      currentView: 'login',
      requiresLogin: true,
      mailboxEmail: '',
    };
  }

  const emailInput = findMail2925LoginEmailInput();
  const passwordInput = findMail2925LoginPasswordInput();
  const loginButton = findLoginButton();
  if (!emailInput || !passwordInput || !loginButton) {
    throw new Error('2925：未识别到可用的登录表单，请确认当前页面处于 2925 登录页。');
  }
  if (!email || !password) {
    throw new Error('2925：当前账号缺少邮箱或密码，无法自动登录。');
  }

  await ensureAgreementChecked();
  await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'fill', label: 'mail2925-login-email' }, async () => {
    fillInput(emailInput, email);
  });
  await sleep(150);
  await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'fill', label: 'mail2925-login-password' }, async () => {
    fillInput(passwordInput, password);
  });
  await sleep(200);
  await sleep(1000);
  log(`步骤 0：2925 已定位到登录表单，准备点击“登录”，当前地址 ${location.href}`, 'info');
  await performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'submit', label: 'mail2925-login-submit' }, async () => {
    simulateClick(loginButton);
  });
  log(`步骤 0：2925 已点击“登录”，点击后地址 ${location.href}`, 'info');

  const finalState = await waitForMail2925View('mailbox', 40000);
  log(`步骤 0：2925 登录等待结束，状态=${finalState.view}，地址=${location.href}`, 'info');
  if (finalState.view !== 'mailbox') {
    throw new Error('2925：提交账号密码后未进入收件箱。');
  }

  return {
    ok: true,
    loggedIn: true,
    currentView: 'mailbox',
    usedCredentials: true,
    mailboxEmail: finalState.mailboxEmail || getMail2925DisplayedMailboxEmail() || '',
  };
}

async function handlePollEmail(step, payload) {
  await ensureSeenCodesSession(step, payload);
  const {
    senderFilters,
    subjectFilters,
    maxAttempts,
    intervalMs,
    filterAfterTimestamp = 0,
    excludeCodes = [],
    strictChatGPTCodeOnly = false,
    targetEmail = '',
    mail2925MatchTargetEmail = false,
  } = payload || {};
  const excludedCodeSet = new Set(excludeCodes.filter(Boolean));
  const filterAfterMinute = normalizeMinuteTimestamp(Number(filterAfterTimestamp) || 0);
  if (typeof throwIfMail2925LimitReached === 'function') {
    throwIfMail2925LimitReached();
  }

  log(`步骤 ${step}：开始轮询 2925 邮箱（最多 ${maxAttempts} 次）`);

  let initialItems = [];
  let initialLoadUsedRefresh = false;

  for (let i = 0; i < 20; i += 1) {
    initialItems = findMailItems();
    if (initialItems.length > 0) {
      break;
    }
    await sleep(500);
  }

  if (initialItems.length === 0) {
    initialLoadUsedRefresh = true;
    await returnToInbox();
    await refreshInbox();
    await sleep(2000);
    if (typeof throwIfMail2925LimitReached === 'function') {
      throwIfMail2925LimitReached();
    }
    initialItems = findMailItems();
  }

  if (initialItems.length === 0) {
    throw new Error('2925 邮箱列表未加载完成，请确认当前已打开收件箱。');
  }

  log(`步骤 ${step}：邮件列表已加载，共 ${initialItems.length} 封邮件`);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (typeof throwIfMail2925LimitReached === 'function') {
      throwIfMail2925LimitReached();
    }
    log(`步骤 ${step}：正在轮询 2925 邮箱，第 ${attempt}/${maxAttempts} 次`);

    if (attempt > 1 || !initialLoadUsedRefresh) {
      await returnToInbox();
      await refreshInbox();
      await sleepRandom(900, 1500);
    }

    const items = findMailItems();
    if (items.length > 0) {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const itemTimestamp = parseMailItemTimestamp(item);
        const itemMinute = normalizeMinuteTimestamp(itemTimestamp || 0);

        if (filterAfterMinute && (!itemMinute || itemMinute < filterAfterMinute)) {
          continue;
        }

        const previewText = getMailItemText(item);
        if (!matchesMailFilters(previewText, senderFilters, subjectFilters)) {
          continue;
        }
        const previewTargetState = mail2925MatchTargetEmail
          ? getTargetEmailMatchState(previewText, targetEmail)
          : { matches: true, hasExplicitEmail: false };
        if (mail2925MatchTargetEmail && previewTargetState.hasExplicitEmail && !previewTargetState.matches) {
          continue;
        }

        const previewCode = extractVerificationCode(previewText, strictChatGPTCodeOnly);
        const openedText = await openMailAndDeleteAfterRead(item, step);
        const openedTargetState = mail2925MatchTargetEmail
          ? getTargetEmailMatchState(openedText, targetEmail)
          : { matches: true, hasExplicitEmail: false };
        if (mail2925MatchTargetEmail && openedTargetState.hasExplicitEmail && !openedTargetState.matches) {
          continue;
        }
        const bodyCode = extractVerificationCode(openedText, strictChatGPTCodeOnly);
        const candidateCode = bodyCode || previewCode;

        if (!candidateCode) {
          continue;
        }

        if (excludedCodeSet.has(candidateCode)) {
          log(`步骤 ${step}：跳过排除的验证码：${candidateCode}`, 'info');
          continue;
        }
        if (seenCodes.has(candidateCode)) {
          log(`步骤 ${step}：跳过已处理过的验证码：${candidateCode}`, 'info');
          continue;
        }

        seenCodes.add(candidateCode);
        persistSeenCodes();
        const source = bodyCode ? '邮件正文' : '邮件预览';
        const timeLabel = itemTimestamp ? `，时间：${new Date(itemTimestamp).toLocaleString('zh-CN', { hour12: false })}` : '';
        log(`步骤 ${step}：已找到验证码：${candidateCode}（来源：${source}${timeLabel}）`, 'ok');
        return { ok: true, code: candidateCode, emailTimestamp: Date.now() };
      }
    }

    if (attempt < maxAttempts) {
      await sleepRandom(intervalMs, intervalMs + 1200);
    }
  }

  throw new Error(
    `${(maxAttempts * intervalMs / 1000).toFixed(0)} 秒后仍未在 2925 邮箱中找到新的匹配邮件。请手动检查收件箱。`
  );
}

}
