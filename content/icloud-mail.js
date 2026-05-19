const ICLOUD_MAIL_PREFIX = '[MultiPage:icloud-mail]';
const isTopFrame = window === window.top;
const ICLOUD_POLL_SESSION_CACHE = new Map();

console.log(ICLOUD_MAIL_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

function isMailApplicationFrame() {
  if (/\/applications\/mail2\//.test(location.pathname)) {
    return true;
  }
  return Boolean(document.querySelector('.content-container, .mail-message-defaults, .thread-participants'));
}

if (isTopFrame) {
  console.log(ICLOUD_MAIL_PREFIX, 'Top frame detected; waiting for mail iframe.');
}

const shouldHandlePollEmailInCurrentFrame = !isTopFrame || isMailApplicationFrame();
if (shouldHandlePollEmailInCurrentFrame) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'POLL_EMAIL') {
      if (!isMailApplicationFrame()) {
        sendResponse({ ok: false, reason: 'wrong-frame' });
        return;
      }
      resetStopState();
      handlePollEmail(message.step, message.payload).then((result) => {
        sendResponse(result);
      }).catch((err) => {
        if (isStopError(err)) {
          log(`步骤 ${message.step}：已被用户停止。`, 'warn');
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        log(`步骤 ${message.step}：iCloud 邮箱轮询失败：${err.message}`, 'warn');
        sendResponse({ error: err.message });
      });
      return true;
    }
  });

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeRulePatternList(patterns = []) {
    return Array.isArray(patterns) ? patterns : [];
  }

  function extractCodeByRulePatterns(text, patterns = []) {
    const normalizedText = String(text || '');
    for (const pattern of normalizeRulePatternList(patterns)) {
      try {
        const source = String(pattern?.source || '').trim();
        if (!source) {
          continue;
        }
        const flags = String(pattern?.flags || '').replace(/[^dgimsuvy]/g, '');
        const match = normalizedText.match(new RegExp(source, flags));
        if (!match) {
          continue;
        }
        for (let index = 1; index < match.length; index += 1) {
          const candidate = String(match[index] || '').trim();
          if (candidate) {
            return candidate;
          }
        }
        if (String(match[0] || '').trim()) {
          return String(match[0] || '').trim();
        }
      } catch (_) {
        // Ignore invalid runtime rule patterns and continue with other candidates.
      }
    }
    return null;
  }

  function isVisibleElement(node) {
    return Boolean(node instanceof HTMLElement)
      && (Boolean(node.offsetParent) || getComputedStyle(node).position === 'fixed');
  }

  function collectThreadItems() {
    return Array.from(document.querySelectorAll('.content-container')).filter((item) => {
      if (!isVisibleElement(item)) return false;
      return item.querySelector('.thread-participants')
        && item.querySelector('.thread-subject')
        && item.querySelector('.thread-preview');
    });
  }

  const ICLOUD_INBOX_CATEGORY_DEFINITIONS = Object.freeze([
    {
      id: 'primary',
      label: '主要',
      patterns: [/^主要(?:\s*\d+)?$/i, /^primary(?:\s+\d+)?$/i],
    },
    {
      id: 'updates',
      label: '更新',
      patterns: [/^更新(?:\s*\d+)?$/i, /^updates?(?:\s+\d+)?$/i],
    },
  ]);

  function getElementAccessibleText(node) {
    if (!node) return '';
    return normalizeText([
      node.getAttribute?.('aria-label') || '',
      node.getAttribute?.('title') || '',
      node.innerText || node.textContent || '',
    ].filter(Boolean).join(' '));
  }

  function resolveIcloudInboxCategoryId(label = '') {
    const normalized = normalizeText(label)
      .replace(/[，,：:;；()[\]（）]/g, ' ')
      .replace(/\b(?:unread|messages?|mails?)\b/gi, ' ')
      .replace(/(?:未读|封|邮件)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return '';
    return ICLOUD_INBOX_CATEGORY_DEFINITIONS.find((definition) => (
      definition.patterns.some((pattern) => pattern.test(normalized))
    ))?.id || '';
  }

  function getIcloudInboxCategoryControls() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
      return [];
    }
    const controls = [];
    const seenIds = new Set();
    const candidates = Array.from(document.querySelectorAll('button, [role="tab"], [role="button"], a'));
    for (const node of candidates) {
      if (!isVisibleElement(node)) continue;
      const categoryId = resolveIcloudInboxCategoryId(getElementAccessibleText(node));
      if (!categoryId || seenIds.has(categoryId)) continue;
      seenIds.add(categoryId);
      controls.push({ id: categoryId, node, label: getIcloudInboxCategoryLabel(categoryId) });
    }
    return controls;
  }

  function getIcloudInboxCategoryLabel(categoryId = '') {
    return ICLOUD_INBOX_CATEGORY_DEFINITIONS.find((definition) => definition.id === categoryId)?.label || categoryId || '当前分类';
  }

  function resolveIcloudInboxControlText(label = '') {
    return normalizeText(label)
      .replace(/[，,：:;；()[\]（）]/g, ' ')
      .replace(/\b(?:unread|messages?|mails?)\b/gi, ' ')
      .replace(/(?:未读|封|邮件)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isIcloudInboxControlLabel(label = '') {
    const normalized = resolveIcloudInboxControlText(label);
    return /^(?:收件箱|inbox)(?:\s*\d+)?$/i.test(normalized);
  }

  function isIcloudSelectedMailboxControl(node) {
    if (!node) return false;
    if (node.getAttribute?.('aria-selected') === 'true') return true;
    if (node.getAttribute?.('aria-current')) return true;
    const className = String(node.className || '').toLowerCase();
    return /\b(selected|current|active)\b/.test(className);
  }

  function findIcloudInboxControl() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
      return null;
    }
    const candidates = Array.from(document.querySelectorAll('button, [role="button"], [role="treeitem"], [role="option"], a'));
    return candidates.find((node) => (
      isVisibleElement(node)
      && !resolveIcloudInboxCategoryId(getElementAccessibleText(node))
      && isIcloudInboxControlLabel(getElementAccessibleText(node))
    )) || null;
  }

  async function openIcloudInboxIfAvailable(options = {}) {
    const inboxControl = findIcloudInboxControl();
    if (!inboxControl) {
      return false;
    }
    if (!options.force && isIcloudSelectedMailboxControl(inboxControl)) {
      return true;
    }
    simulateClick(inboxControl);
    await sleep(Number(options.waitMs) > 0 ? Number(options.waitMs) : 1000);
    return true;
  }

  function isIcloudInboxCategorySelected(control = {}) {
    const node = control?.node;
    if (!node) return false;
    if (node.getAttribute?.('aria-selected') === 'true') return true;
    if (node.getAttribute?.('aria-pressed') === 'true') return true;
    const className = String(node.className || '').toLowerCase();
    return /\b(selected|current|active)\b/.test(className);
  }

  async function switchIcloudInboxCategory(control = {}) {
    if (!control?.node) return false;
    if (isIcloudInboxCategorySelected(control)) {
      return true;
    }
    simulateClick(control.node);
    await sleep(800);
    return true;
  }

  async function visitIcloudInboxCategories(visitor) {
    const controls = getIcloudInboxCategoryControls();
    if (controls.length <= 1) {
      return visitor({
        id: controls[0]?.id || 'current',
        label: controls[0]?.label || '当前分类',
      });
    }

    const selected = controls.find(isIcloudInboxCategorySelected) || null;
    const orderedControls = [
      ...(selected ? [selected] : []),
      ...controls.filter((control) => control !== selected),
    ];

    for (const control of orderedControls) {
      throwIfStopped();
      await switchIcloudInboxCategory(control);
      const result = await visitor({
        id: control.id,
        label: control.label,
      });
      if (result) {
        return result;
      }
    }
    return null;
  }

  async function collectThreadSignaturesAcrossInboxCategories() {
    const signatures = new Set();
    let categoryCount = 0;
    await visitIcloudInboxCategories(async () => {
      categoryCount += 1;
      collectThreadItems().forEach((item) => {
        signatures.add(buildItemSignature(item));
      });
      return null;
    });
    return { signatures, categoryCount };
  }

  function getThreadItemMetadata(item) {
    const sender = normalizeText(item.querySelector('.thread-participants')?.textContent || '');
    const subject = normalizeText(item.querySelector('.thread-subject')?.textContent || '');
    const preview = normalizeText(item.querySelector('.thread-preview')?.textContent || '');
    const timestamp = normalizeText(item.querySelector('.thread-timestamp')?.textContent || '');
    return {
      sender,
      subject,
      preview,
      timestamp,
      combinedText: normalizeText([sender, subject, preview, timestamp].filter(Boolean).join(' ')),
    };
  }

  function buildItemSignature(item) {
    if (item?.__icloudSignature) {
      return normalizeText(item.__icloudSignature);
    }
    const meta = getThreadItemMetadata(item);
    return normalizeText([
      item.getAttribute('aria-label') || '',
      meta.sender,
      meta.subject,
      meta.preview,
      meta.timestamp,
    ].join('::')).slice(0, 240);
  }

  function extractVerificationCode(text, options = {}) {
    const matchedByRule = extractCodeByRulePatterns(text, options?.codePatterns);
    if (matchedByRule) return matchedByRule;

    const matchCn = text.match(/(?:代码为|验证码[^0-9]*?)[\s：:]*(\d{6})/);
    if (matchCn) return matchCn[1];

    const matchLoginCode = text.match(/(?:log-?in\s+code|enter\s+this\s+code)[^0-9]{0,24}(\d{6})/i);
    if (matchLoginCode) return matchLoginCode[1];

    const matchEn = text.match(/code[:\s]+is[:\s]+(\d{6})|code[:\s]+(\d{6})/i);
    if (matchEn) return matchEn[1] || matchEn[2];

    const match6 = text.match(/\b(\d{6})\b/);
    if (match6) return match6[1];

    return null;
  }

  function readOpenedMailHeader() {
    const headerRoot = document.querySelector('.ic-efwqa7');
    if (!headerRoot) {
      return { sender: '', recipients: '', timestamp: '' };
    }

    const contactValues = Array.from(headerRoot.querySelectorAll('.contact-token .ic-x1z554'))
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);
    const sender = contactValues[0] || '';
    const recipients = contactValues.slice(1).join(' ');
    const timestamp = normalizeText(headerRoot.querySelector('.ic-rffsj8')?.textContent || '');
    return { sender, recipients, timestamp };
  }

  function getOpenedMailBodyRoot() {
    return document.querySelector('.mail-message-defaults, .pane.thread-detail-pane');
  }

  function readOpenedMailBody() {
    const bodyRoot = getOpenedMailBodyRoot();
    return normalizeText(bodyRoot?.innerText || bodyRoot?.textContent || '');
  }

  function getThreadListItemRoot(item) {
    return item?.closest?.('.thread-list-item, [role="treeitem"]') || null;
  }

  function isThreadItemSelected(item, expectedSignature = '') {
    const expected = normalizeText(expectedSignature);
    const candidates = collectThreadItems();
    const matchedItem = expected
      ? candidates.find((candidate) => buildItemSignature(candidate) === expected)
      : item;
    const root = getThreadListItemRoot(matchedItem || item);
    if (!root) {
      return false;
    }
    if (root.getAttribute('aria-selected') === 'true') {
      return true;
    }
    const className = String(root.className || '').toLowerCase();
    return /\b(selected|current|active)\b/.test(className);
  }

  function openedMailMatchesExpectedContent(expectedMeta = {}, header = null, bodyText = '') {
    const expectedSender = normalizeText(expectedMeta.sender || '').toLowerCase();
    const expectedSubject = normalizeText(expectedMeta.subject || '').toLowerCase();
    const combined = normalizeText([
      header?.sender || '',
      header?.recipients || '',
      header?.timestamp || '',
      bodyText || '',
    ].join(' ')).toLowerCase();

    if (expectedSender && combined.includes(expectedSender)) {
      return true;
    }
    if (expectedSubject && combined.includes(expectedSubject)) {
      return true;
    }
    return false;
  }

  async function waitForOpenedMailContent(item, expectedMeta = {}, timeout = 10000) {
    const expectedSignature = buildItemSignature(item);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      throwIfStopped();
      const headerRoot = document.querySelector('.ic-efwqa7');
      const bodyRoot = getOpenedMailBodyRoot();
      const selected = isThreadItemSelected(item, expectedSignature);
      if (selected && (headerRoot || bodyRoot)) {
        const header = readOpenedMailHeader();
        const bodyText = normalizeText(bodyRoot?.innerText || bodyRoot?.textContent || '');
        if (openedMailMatchesExpectedContent(expectedMeta, header, bodyText)) {
          return { headerRoot, bodyRoot };
        }
      }
      await sleep(100);
    }
    throw new Error('打开邮件后未找到详情区域，请确认邮件内容已加载。');
  }

  async function openMailItemAndRead(item) {
    const expectedMeta = getThreadItemMetadata(item);
    simulateClick(item);

    const { bodyRoot } = await waitForOpenedMailContent(item, expectedMeta, 10000);
    await sleep(300);

    const header = readOpenedMailHeader();
    const bodyText = normalizeText(
      bodyRoot?.innerText || bodyRoot?.textContent || readOpenedMailBody()
    );
    return {
      ...header,
      bodyText,
      combinedText: normalizeText([header.sender, header.recipients, header.timestamp, bodyText].filter(Boolean).join(' ')),
    };
  }

  async function refreshInbox() {
    const inboxOpened = await openIcloudInboxIfAvailable({ force: true, waitMs: 700 });
    const refreshPatterns = [/刷新/i, /refresh/i, /重新载入/i];
    const candidates = document.querySelectorAll('button, [role="button"], a');
    for (const node of candidates) {
      const text = normalizeText(node.innerText || node.textContent || '');
      const label = normalizeText(node.getAttribute('aria-label') || node.getAttribute('title') || '');
      if (refreshPatterns.some((pattern) => pattern.test(text) || pattern.test(label))) {
        simulateClick(node);
        await sleep(1000);
        return;
      }
    }

    if (inboxOpened) {
      return;
    }

    const inboxPatterns = [/收件箱/, /inbox/i];
    for (const node of candidates) {
      const text = normalizeText(node.innerText || node.textContent || '');
      const label = normalizeText(node.getAttribute('aria-label') || node.getAttribute('title') || '');
      if (inboxPatterns.some((pattern) => pattern.test(text) || pattern.test(label))) {
        simulateClick(node);
        await sleep(1000);
        return;
      }
    }
  }

  function normalizePollSessionKey(payload = {}) {
    const raw = String(payload?.sessionKey || '').trim();
    if (raw) {
      return raw;
    }
    return '';
  }

  function getOrCreatePollSessionBaseline(sessionKey, currentItems = []) {
    if (!sessionKey) {
      return {
        signatures: new Set(currentItems.map(buildItemSignature)),
        fallbackCarry: 0,
        fromCache: false,
      };
    }

    const cached = ICLOUD_POLL_SESSION_CACHE.get(sessionKey);
    if (cached && cached.signatures instanceof Set) {
      return {
        signatures: new Set(cached.signatures),
        fallbackCarry: Math.max(0, Number(cached.fallbackCarry) || 0),
        fromCache: true,
      };
    }

    return {
      signatures: new Set(currentItems.map(buildItemSignature)),
      fallbackCarry: 0,
      fromCache: false,
    };
  }

  function persistPollSessionBaseline(sessionKey, signatures, fallbackCarry = 0) {
    if (!sessionKey) {
      return;
    }
    ICLOUD_POLL_SESSION_CACHE.set(sessionKey, {
      signatures: new Set(signatures || []),
      fallbackCarry: Math.max(0, Number(fallbackCarry) || 0),
      updatedAt: Date.now(),
    });
    if (ICLOUD_POLL_SESSION_CACHE.size > 12) {
      const oldest = Array.from(ICLOUD_POLL_SESSION_CACHE.entries())
        .sort((left, right) => Number(left?.[1]?.updatedAt || 0) - Number(right?.[1]?.updatedAt || 0))
        .slice(0, ICLOUD_POLL_SESSION_CACHE.size - 12);
      oldest.forEach(([key]) => ICLOUD_POLL_SESSION_CACHE.delete(key));
    }
  }

  async function handlePollEmail(step, payload) {
    const {
      codePatterns = [],
      senderFilters,
      subjectFilters,
      maxAttempts,
      intervalMs,
      excludeCodes = [],
    } = payload;
    const excludedCodeSet = new Set(excludeCodes.filter(Boolean));
    const FALLBACK_AFTER = 3;
    const pollSessionKey = normalizePollSessionKey(payload);
    const normalizedSenderFilters = senderFilters.map((filter) => String(filter || '').toLowerCase()).filter(Boolean);
    const normalizedSubjectFilters = subjectFilters.map((filter) => String(filter || '').toLowerCase()).filter(Boolean);

    log(`步骤 ${step}：开始轮询 iCloud 邮箱（最多 ${maxAttempts} 次）`);
    await waitForElement('.content-container, [role="tab"], .thread-list-item, [role="treeitem"]', 10000);
    await openIcloudInboxIfAvailable();
    await sleep(1500);
    const baselineSnapshot = await collectThreadSignaturesAcrossInboxCategories();
    const currentItems = Array.from(baselineSnapshot.signatures, (signature) => ({ __icloudSignature: signature }));
    const sessionBaseline = getOrCreatePollSessionBaseline(pollSessionKey, currentItems);
    const existingSignatures = sessionBaseline.signatures;
    let fallbackCarry = sessionBaseline.fallbackCarry;
    if (sessionBaseline.fromCache) {
      log(`步骤 ${step}：已复用当前会话旧邮件快照（${existingSignatures.size} 封）。`);
    } else {
      const categoryText = baselineSnapshot.categoryCount > 1 ? `，覆盖 ${baselineSnapshot.categoryCount} 个 iCloud 收件箱分类` : '';
      log(`步骤 ${step}：已记录当前 ${existingSignatures.size} 封旧邮件快照${categoryText}`);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      log(`步骤 ${step}：正在轮询 iCloud 邮箱，第 ${attempt}/${maxAttempts} 次`);

      if (attempt > 1) {
        await refreshInbox();
        await sleep(1200);
      }

      const useFallback = (fallbackCarry + attempt) > FALLBACK_AFTER;

      const found = await visitIcloudInboxCategories(async (category) => {
        const items = collectThreadItems();

        for (const [index, item] of items.entries()) {
          const signature = buildItemSignature(item);
          const allowInitialStep8VisibleCode = Number(step) === 8
            && attempt === 1
            && index === 0
            && !sessionBaseline.fromCache;
          if (!useFallback && existingSignatures.has(signature) && !allowInitialStep8VisibleCode) {
            continue;
          }

          const meta = getThreadItemMetadata(item);
          const lowerSender = meta.sender.toLowerCase();
          const lowerSubject = normalizeText([meta.subject, meta.preview].join(' ')).toLowerCase();
          const senderMatch = normalizedSenderFilters.some((filter) => lowerSender.includes(filter));
          const subjectMatch = normalizedSubjectFilters.some((filter) => lowerSubject.includes(filter));

          if (!senderMatch && !subjectMatch) {
            continue;
          }

          let code = extractVerificationCode(meta.combinedText, { codePatterns });
          let opened = null;

          if (!code) {
            opened = await openMailItemAndRead(item);
            const openedSender = opened.sender.toLowerCase();
            const openedBody = opened.bodyText.toLowerCase();
            const openedSenderMatch = normalizedSenderFilters.some((filter) => openedSender.includes(filter));
            const openedSubjectMatch = normalizedSubjectFilters.some((filter) => openedBody.includes(filter));
            if (!openedSenderMatch && !openedSubjectMatch && !senderMatch && !subjectMatch) {
              continue;
            }
            code = extractVerificationCode(opened.combinedText, { codePatterns });
          }

          if (!code) {
            continue;
          }
          if (excludedCodeSet.has(code)) {
            log(`步骤 ${step}：跳过排除的验证码：${code}`, 'info');
            continue;
          }

          const source = useFallback && existingSignatures.has(signature) ? '回退匹配邮件' : '新邮件';
          const categoryText = category?.id && category.id !== 'current' ? `，分类：${category.label}` : '';
          log(`步骤 ${step}：已找到验证码：${code}（来源：${source}${categoryText}）`, 'ok');
          const latestSnapshot = await collectThreadSignaturesAcrossInboxCategories();
          persistPollSessionBaseline(
            pollSessionKey,
            latestSnapshot.signatures,
            0
          );
          return {
            ok: true,
            code,
            emailTimestamp: Date.now(),
            preview: (opened?.combinedText || meta.combinedText).slice(0, 160),
          };
        }
        return null;
      });

      if (found) {
        return found;
      }

      if (attempt === FALLBACK_AFTER + 1) {
        log(`步骤 ${step}：连续 ${FALLBACK_AFTER} 次未发现新邮件，开始回退到首封匹配邮件`, 'warn');
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    fallbackCarry += maxAttempts;
    const latestSnapshot = await collectThreadSignaturesAcrossInboxCategories();
    persistPollSessionBaseline(
      pollSessionKey,
      latestSnapshot.signatures,
      fallbackCarry
    );

    throw new Error(
      `${Math.round((maxAttempts * intervalMs) / 1000)} 秒后仍未在 iCloud 邮箱中找到新的匹配邮件。请手动检查收件箱。`
    );
  }
}
