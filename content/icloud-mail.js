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
          log(`Step ${message.step}: Stopped by user.`, 'warn');
          sendResponse({ stopped: true, error: err.message });
          return;
        }
        log(`Step ${message.step}: iCloud mail polling failed: ${err.message}`, 'warn');
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
    throw new Error('Did not find email detail area after opening mail. Please confirm email content has loaded.');
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

    log(`Step ${step}: Starting iCloud mail polling (max ${maxAttempts} attempts)`);
    await waitForElement('.content-container', 10000);
    await sleep(1500);
    const currentItems = collectThreadItems();
    const sessionBaseline = getOrCreatePollSessionBaseline(pollSessionKey, currentItems);
    const existingSignatures = sessionBaseline.signatures;
    let fallbackCarry = sessionBaseline.fallbackCarry;
    if (sessionBaseline.fromCache) {
      log(`Step ${step}: Reusing current session's old email snapshot (${existingSignatures.size} emails).`);
    } else {
      log(`Step ${step}: Recorded snapshot of current ${existingSignatures.size} old emails`);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      log(`Step ${step}: Polling iCloud mail, attempt ${attempt}/${maxAttempts}`);

      if (attempt > 1) {
        await refreshInbox();
        await sleep(1200);
      }

      const items = collectThreadItems();
      const useFallback = (fallbackCarry + attempt) > FALLBACK_AFTER;

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
          log(`Step ${step}: Skipping excluded verification code: ${code}`, 'info');
          continue;
        }

        const source = useFallback && existingSignatures.has(signature) ? 'fallback-matched email' : 'new email';
        log(`Step ${step}: Found verification code: ${code} (source: ${source})`, 'ok');
        persistPollSessionBaseline(
          pollSessionKey,
          new Set(collectThreadItems().map(buildItemSignature)),
          0
        );
        return {
          ok: true,
          code,
          emailTimestamp: Date.now(),
          preview: (opened?.combinedText || meta.combinedText).slice(0, 160),
        };
      }

      if (attempt === FALLBACK_AFTER + 1) {
        log(`Step ${step}: ${FALLBACK_AFTER} consecutive attempts with no new emails, starting fallback to first matched email`, 'warn');
      }

      if (attempt < maxAttempts) {
        await sleep(intervalMs);
      }
    }

    fallbackCarry += maxAttempts;
    persistPollSessionBaseline(
      pollSessionKey,
      new Set(collectThreadItems().map(buildItemSignature)),
      fallbackCarry
    );

    throw new Error(
      `No new matching email found in iCloud mail after ${Math.round((maxAttempts * intervalMs) / 1000)} seconds. Please manually check the inbox.`
    );
  }
}
