// content/mail-163.js — Content script for 163 Mail (steps 4, 7)
// Injected on: mail.163.com
//
// DOM structure:
// Mail item: div[sign="letter"] with aria-label="Your ChatGPT code is 479637 sender: OpenAI ..."
// Sender: .nui-user (e.g., "OpenAI")
// Subject: span.da0 (e.g., "Your ChatGPT code is 479637")
// Delete actions: hover trash icon on the row, or checkbox + toolbar delete button

const MAIL163_PREFIX = '[MultiPage:mail-163]';
const isTopFrame = window === window.top;

console.log(MAIL163_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

// Only operate in the top frame
if (!isTopFrame) {
  console.log(MAIL163_PREFIX, 'Skipping child frame');
} else {

// Track codes we've already seen — persisted in chrome.storage.session to survive script re-injection
let seenCodes = new Set();

async function loadSeenCodes() {
  try {
    const data = await chrome.storage.session.get('seenCodes');
    if (data.seenCodes && Array.isArray(data.seenCodes)) {
      seenCodes = new Set(data.seenCodes);
      console.log(MAIL163_PREFIX, `Loaded ${seenCodes.size} previously seen codes`);
    }
  } catch (err) {
    console.warn(MAIL163_PREFIX, 'Session storage unavailable, using in-memory seen codes:', err?.message || err);
  }
}

// Load previously seen codes on startup
loadSeenCodes();

async function persistSeenCodes() {
  try {
    await chrome.storage.session.set({ seenCodes: [...seenCodes] });
  } catch (err) {
    console.warn(MAIL163_PREFIX, 'Could not persist seen codes, continuing in-memory only:', err?.message || err);
  }
}

// ============================================================
// Message Handler (top frame only)
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'POLL_EMAIL') {
    resetStopState();
    handlePollEmail(message.step, message.payload).then(result => {
      sendResponse(result);
    }).catch(err => {
      if (isStopError(err)) {
      log(`Step ${message.step}: Stopped by user.`, 'warn');
        sendResponse({ stopped: true, error: err.message });
        return;
      }
      log(`Step ${message.step}: Mailbox polling failed: ${err.message}`, 'warn');
      sendResponse({ error: err.message });
    });
    return true;
  }
});

// ============================================================
// Find mail items
// ============================================================

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

function getNetEaseMailLabel(hostname) {
  const currentHostname = String(
    hostname || (typeof location !== 'undefined' ? location.hostname : '') || ''
  ).toLowerCase();

  if (currentHostname === 'mail.126.com' || currentHostname.endsWith('.mail.126.com')) {
    return '126 Mail';
  }
  if (currentHostname === 'webmail.vip.163.com') {
    return '163 VIP Mail';
  }

  return '163 Mail';
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

function isLikelyMailItemNode(node) {
  if (!isVisibleNode(node)) {
    return false;
  }
  if (node.matches?.('div[sign="letter"]')) {
    return true;
  }
  if (node.querySelector?.('.nui-user, span.da0, [sign="trash"], [title="删除邮件"], [class*="subject"], [class*="sender"]')) {
    return true;
  }

  const summaryText = normalizeText(
    node.getAttribute?.('aria-label')
    || node.getAttribute?.('title')
    || node.textContent
  );
  if (!summaryText) {
    return false;
  }

  return /发件人|验证码|verification|code|log-?in/i.test(summaryText);
}

function findMailItems() {
  const selectorGroups = [
    'div[sign="letter"]',
    '[role="option"][aria-label]',
    '[role="listitem"][aria-label]',
    'tr[aria-label]',
    'li[aria-label]',
    'div[aria-label]',
  ];

  for (const selector of selectorGroups) {
    const matches = Array.from(document.querySelectorAll(selector)).filter(isLikelyMailItemNode);
    if (matches.length > 0) {
      return matches;
    }
  }

  return [];
}

function getMailTextBySelectors(item, selectors = []) {
  for (const selector of selectors) {
    const candidates = item.querySelectorAll(selector);
    for (const candidate of candidates) {
      const texts = [
        candidate.getAttribute?.('title'),
        candidate.getAttribute?.('aria-label'),
        candidate.textContent,
      ];
      for (const text of texts) {
        const normalized = normalizeText(text);
        if (normalized) {
          return normalized;
        }
      }
    }
  }
  return '';
}

function getMailSenderText(item) {
  return getMailTextBySelectors(item, [
    '.nui-user',
    '[class*="sender"]',
    '[class*="from"]',
    '[data-sender]',
  ]);
}

function getMailSubjectText(item) {
  return getMailTextBySelectors(item, [
    'span.da0',
    '[class*="subject"]',
    '[data-subject]',
    'strong',
  ]);
}

function getMailRowText(item) {
  const ariaLabel = normalizeText(item.getAttribute('aria-label'));
  const sender = getMailSenderText(item);
  const subject = getMailSubjectText(item);
  const fullText = normalizeText(item.textContent || '');
  return normalizeText([ariaLabel, sender, subject, fullText].filter(Boolean).join(' '));
}

function getMailItemId(item, index = 0) {
  const candidates = [
    item.getAttribute('id'),
    item.getAttribute('data-id'),
    item.dataset?.id,
    item.getAttribute('data-key'),
    item.getAttribute('key'),
  ].filter(Boolean);

  if (candidates.length > 0) {
    return String(candidates[0]);
  }

  return `${index}|${getMailRowText(item).slice(0, 240)}`;
}

function getCurrentMailIds(items = []) {
  const ids = new Set();
  const sourceItems = items.length > 0 ? items : findMailItems();
  sourceItems.forEach((item, index) => {
    ids.add(getMailItemId(item, index));
  });
  return ids;
}

function normalizeMinuteTimestamp(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date.getTime();
}

function parseMail163Timestamp(rawText) {
  const text = normalizeText(rawText);
  if (!text) return null;

  let match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      0,
      0
    ).getTime();
  }

  match = text.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hour, minute] = match;
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(hour),
      Number(minute),
      0,
      0
    ).getTime();
  }

  match = text.match(/昨天\s*(\d{1,2}):(\d{2})/);
  if (match) {
    const [, hour, minute] = match;
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(hour),
      Number(minute),
      0,
      0
    ).getTime();
  }

  match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (match) {
    const [, hour, minute] = match;
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Number(hour),
      Number(minute),
      0,
      0
    ).getTime();
  }

  return null;
}

function isLikelyMailTimestampText(value) {
  const text = normalizeText(value);
  if (!text) {
    return false;
  }
  return /(\d{4}年\d{1,2}月\d{1,2}日\s+\d{1,2}:\d{2})|今天\s*\d{1,2}:\d{2}|昨天\s*\d{1,2}:\d{2}|\b\d{1,2}:\d{2}\b/.test(text);
}

function collectMailTimestampCandidates(item) {
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (value) => {
    const normalized = normalizeText(value);
    if (!normalized || !isLikelyMailTimestampText(normalized) || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  const priorityNodes = item.querySelectorAll('.e00, [title], [aria-label], time, [class*="time"], [class*="date"]');
  priorityNodes.forEach((node) => {
    pushCandidate(node.getAttribute?.('title'));
    pushCandidate(node.getAttribute?.('aria-label'));
    pushCandidate(node.textContent);
  });

  const textNodes = item.querySelectorAll('span, div, td, strong, b');
  textNodes.forEach((node) => {
    const text = normalizeText(node.textContent);
    if (text && text.length <= 24) {
      pushCandidate(text);
    }
  });

  pushCandidate(item.getAttribute('aria-label'));
  pushCandidate(item.getAttribute('title'));
  return candidates;
}

function getMailTimestamp(item) {
  const candidates = collectMailTimestampCandidates(item);
  for (const candidate of candidates) {
    const parsed = parseMail163Timestamp(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function collectOpenedMailTextCandidates() {
  const texts = [];
  const seen = new Set();
  const pushText = (value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    texts.push(normalized);
  };

  const selectors = [
    '.readHtml',
    '[class*="readmail"]',
    '[class*="mailread"]',
    '[class*="mailBody"]',
    '[class*="mailbody"]',
    '[class*="mail-content"]',
    '[class*="mailContent"]',
    '[class*="mail-detail"]',
    '[class*="mailDetail"]',
    '[class*="detail"] [class*="content"]',
    '[class*="read"] [class*="content"]',
    '[role="main"]',
  ];

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      pushText(node.innerText || node.textContent);
    });
  });

  document.querySelectorAll('iframe').forEach((frame) => {
    try {
      pushText(frame.contentDocument?.body?.innerText || frame.contentDocument?.body?.textContent);
    } catch {
      // Ignore cross-frame access errors and keep trying other candidates.
    }
  });

  pushText(document.body?.innerText || document.body?.textContent);
  return texts.sort((a, b) => b.length - a.length);
}

function selectOpenedMailTextCandidate(item, candidates = [], options = {}) {
  const subject = normalizeText(getMailSubjectText(item)).toLowerCase();
  const sender = normalizeText(getMailSenderText(item)).toLowerCase();
  const excludedSet = new Set((options.excludedTexts || []).map((value) => normalizeText(value)));
  const allowExcludedFallback = options.allowExcludedFallback !== false;

  const pickCandidate = (source) => source.find((candidate) => {
    const lower = candidate.toLowerCase();
    if (subject && lower.includes(subject)) {
      return true;
    }
    if (sender && lower.includes(sender)) {
      return true;
    }
    return Boolean(extractVerificationCode(candidate, { codePatterns: options.codePatterns }) && /verification|验证码|log-?in\s+code|enter\s+this\s+code|code/i.test(lower));
  }) || source[0] || '';

  const filteredCandidates = candidates.filter((candidate) => !excludedSet.has(normalizeText(candidate)));
  const preferred = pickCandidate(filteredCandidates);
  if (preferred || !allowExcludedFallback) {
    return preferred;
  }

  return pickCandidate(candidates);
}

function readOpenedMailText(item, options = {}) {
  const candidates = collectOpenedMailTextCandidates();
  return selectOpenedMailTextCandidate(item, candidates, options);
}

async function returnToInbox() {
  const inboxLink = document.querySelector('.nui-tree-item-text[title="收件箱"], [title="收件箱"]');
  if (inboxLink) {
    if (typeof simulateClick === 'function') {
      simulateClick(inboxLink);
    } else {
      inboxLink.click();
    }
  }

  for (let i = 0; i < 20; i += 1) {
    if (findMailItems().length > 0) {
      return true;
    }
    await sleep(250);
  }

  return false;
}

async function openMailAndGetMessageText(item, options = {}) {
  const beforeCandidates = collectOpenedMailTextCandidates();
  const beforeText = selectOpenedMailTextCandidate(item, beforeCandidates, {
    codePatterns: options.codePatterns,
  });
  if (typeof simulateClick === 'function') {
    simulateClick(item);
  } else {
    item.click();
  }

  let openedText = '';
  for (let i = 0; i < 24; i += 1) {
    await sleep(250);
    const candidate = readOpenedMailText(item, {
      codePatterns: options.codePatterns,
      excludedTexts: beforeCandidates,
      allowExcludedFallback: false,
    });
    if (!candidate) {
      continue;
    }
    openedText = candidate;
    if (extractVerificationCode(candidate, { codePatterns: options.codePatterns })) {
      break;
    }
    if (candidate !== beforeText && candidate.length > beforeText.length + 24) {
      break;
    }
  }

  await returnToInbox();
  return openedText;
}

function scheduleEmailCleanup(item, step) {
  setTimeout(() => {
    Promise.resolve(deleteEmail(item, step)).catch(() => {
      // Cleanup is best effort only and must never affect the main verification flow.
    });
  }, 0);
}

// ============================================================
// Email Polling
// ============================================================

async function handlePollEmail(step, payload) {
  const {
    codePatterns = [],
    senderFilters,
    subjectFilters,
    maxAttempts,
    intervalMs,
    excludeCodes = [],
    filterAfterTimestamp = 0,
  } = payload;
  const excludedCodeSet = new Set(excludeCodes.filter(Boolean));
  const filterAfterMinute = normalizeMinuteTimestamp(Number(filterAfterTimestamp) || 0);
  const mailLabel = getNetEaseMailLabel();

  log(`Step ${step}: Starting polling of ${mailLabel} (max ${maxAttempts} attempts)`);
  if (filterAfterMinute) {
    log(`Step ${step}: Only attempting emails from ${new Date(filterAfterMinute).toLocaleString('zh-CN', { hour12: false })} onward.`);
  }

  // Click inbox in sidebar to ensure we're in inbox view
  log(`Step ${step}: Waiting for sidebar to load...`);
  try {
    const inboxLink = await waitForElement('.nui-tree-item-text[title="收件箱"]', 5000);
    inboxLink.click();
    log(`Step ${step}: Clicked inbox`);
  } catch {
    log(`Step ${step}: Inbox entry not found, continuing with subsequent flow...`, 'warn');
  }

  // Wait for mail list to appear
  log(`Step ${step}: Waiting for mail list to load...`);
  let items = [];
  for (let i = 0; i < 20; i++) {
    items = findMailItems();
    if (items.length > 0) break;
    await sleep(500);
  }

  if (items.length === 0) {
    await refreshInbox();
    await sleep(2000);
    items = findMailItems();
  }

  if (items.length === 0) {
    throw new Error(`${mailLabel} list did not finish loading. Please confirm inbox is open.`);
  }

  log(`Step ${step}: Mail list loaded, ${items.length} emails total`);

  // Snapshot existing mail IDs
  const existingMailIds = getCurrentMailIds(items);
  log(`Step ${step}: Recorded snapshot of current ${existingMailIds.size} old emails`);

  const FALLBACK_AFTER = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Step ${step}: Polling ${mailLabel}, attempt ${attempt}/${maxAttempts}`);

    if (attempt > 1) {
      await refreshInbox();
      await sleep(1000);
    }

    const allItems = findMailItems();
    const useFallback = attempt > FALLBACK_AFTER;

    for (let index = 0; index < allItems.length; index++) {
      const item = allItems[index];
      const id = getMailItemId(item, index);
      const mailTimestamp = getMailTimestamp(item);
      const mailMinute = normalizeMinuteTimestamp(mailTimestamp || 0);
      const passesTimeFilter = !filterAfterMinute || (mailMinute && mailMinute >= filterAfterMinute);

      if (!passesTimeFilter) {
        continue;
      }

      if (!useFallback && existingMailIds.has(id)) {
        continue;
      }

      const sender = getMailSenderText(item).toLowerCase();
      const subject = getMailSubjectText(item);
      const rowText = getMailRowText(item);
      const ariaLabel = normalizeText(item.getAttribute('aria-label')).toLowerCase();
      const combinedText = normalizeText([subject, ariaLabel, rowText].filter(Boolean).join(' '));

      if (!mailTimestamp) {
        log(`Step ${step}: Email ${id.slice(0, 60)} did not yield a timestamp, skipped text matching phase after time window check.`, 'info');
      }

      const senderMatch = senderFilters.some((filter) => {
        const normalizedFilter = String(filter || '').toLowerCase();
        return normalizedFilter && (sender.includes(normalizedFilter) || ariaLabel.includes(normalizedFilter) || rowText.toLowerCase().includes(normalizedFilter));
      });
      const subjectMatch = subjectFilters.some((filter) => {
        const normalizedFilter = String(filter || '').toLowerCase();
        return normalizedFilter && (subject.toLowerCase().includes(normalizedFilter) || ariaLabel.includes(normalizedFilter) || rowText.toLowerCase().includes(normalizedFilter));
      });

      if (senderMatch || subjectMatch) {
        let code = extractVerificationCode(combinedText, { codePatterns });
        let codeSource = 'mail list';

        if (!code) {
          const openedText = await openMailAndGetMessageText(item, { codePatterns });
          code = extractVerificationCode(openedText, { codePatterns });
          if (code) {
            codeSource = 'mail body';
          }
        }

        if (code && excludedCodeSet.has(code)) {
          log(`Step ${step}: Skipping excluded verification code: ${code}`, 'info');
        } else if (code && !seenCodes.has(code)) {
          seenCodes.add(code);
          persistSeenCodes();
          const source = useFallback && existingMailIds.has(id) ? `fallback-matched ${codeSource}` : `new email ${codeSource}`;
          const timeLabel = mailTimestamp ? `, time: ${new Date(mailTimestamp).toLocaleString('zh-CN', { hour12: false })}` : '';
          log(`Step ${step}: Found verification code: ${code} (source: ${source}${timeLabel}, subject: ${subject.slice(0, 40)})`, 'ok');

          // Trigger cleanup only as a best-effort side effect.
          scheduleEmailCleanup(item, step);

          return { ok: true, code, emailTimestamp: Date.now(), mailId: id };
        } else if (code && seenCodes.has(code)) {
          log(`Step ${step}: Skipping already processed verification code: ${code}`, 'info');
        }
      }
    }

    if (attempt === FALLBACK_AFTER + 1) {
      log(`Step ${step}: ${FALLBACK_AFTER} consecutive attempts with no new emails, starting fallback to first matched email`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  throw new Error(
    `No new matching email found in ${mailLabel} after ${(maxAttempts * intervalMs / 1000).toFixed(0)} seconds. ` +
    'Please manually check the inbox.'
  );
}

// ============================================================
// Delete Email via Hover Trash / Toolbar Fallback
// ============================================================

async function deleteEmail(item, step) {
  try {
    log(`Step ${step}: Deleting email...`);

    // Strategy 1: Click the trash icon inside the mail item
    // Each mail item has: <b class="nui-ico nui-ico-delete" title="删除邮件" sign="trash">
    // These icons appear on hover, so we trigger mouseover first
    item.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(300);

    const trashIcon = item.querySelector('[sign="trash"], .nui-ico-delete, [title="删除邮件"]');
    if (trashIcon) {
      trashIcon.click();
      log(`Step ${step}: Clicked delete icon`, 'ok');
      await sleep(1500);

      // Check if item disappeared (confirm deletion)
      const stillExists = document.getElementById(item.id);
      if (!stillExists || stillExists.style.display === 'none') {
        log(`Step ${step}: Email deleted successfully`);
      } else {
        log(`Step ${step}: Email may not be deleted, still visible in list`, 'warn');
      }
      return;
    }

    // Strategy 2: Select checkbox then click toolbar delete button
    log(`Step ${step}: Delete icon not found, trying checkbox + toolbar delete...`);
    const checkbox = item.querySelector('[sign="checkbox"], .nui-chk');
    if (checkbox) {
      checkbox.click();
      await sleep(300);

      // Click toolbar delete button
      const toolbarBtns = document.querySelectorAll('.nui-btn .nui-btn-text');
      for (const btn of toolbarBtns) {
        if (btn.textContent.replace(/\s/g, '').includes('删除')) {
          btn.closest('.nui-btn').click();
          log(`Step ${step}: Clicked toolbar delete`, 'ok');
          await sleep(1500);
          return;
        }
      }
    }

    log(`Step ${step}: Unable to delete email (delete button not found)`, 'warn');
  } catch (err) {
    log(`Step ${step}: Failed to delete email: ${err.message}`, 'warn');
  }
}

// ============================================================
// Inbox Refresh
// ============================================================

async function refreshInbox() {
  // Try toolbar "Refresh" button
  const toolbarBtns = document.querySelectorAll('.nui-btn .nui-btn-text');
  for (const btn of toolbarBtns) {
    if (btn.textContent.replace(/\s/g, '') === '刷新') {
      btn.closest('.nui-btn').click();
      console.log(MAIL163_PREFIX, 'Clicked "刷新" button');
      await sleep(800);
      return;
    }
  }

  // Fallback: click sidebar "Receive Mail"
  const shouXinBtns = document.querySelectorAll('.ra0');
  for (const btn of shouXinBtns) {
    if (btn.textContent.replace(/\s/g, '').includes('收信')) {
      btn.click();
      console.log(MAIL163_PREFIX, 'Clicked "收信" button');
      await sleep(800);
      return;
    }
  }

  console.log(MAIL163_PREFIX, 'Could not find refresh button');
}

// ============================================================
// Verification Code Extraction
// ============================================================

function extractVerificationCode(text, options = {}) {
  const matchedByRule = extractCodeByRulePatterns(text, options?.codePatterns);
  if (matchedByRule) {
    return matchedByRule;
  }
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

} // end of isTopFrame else block
