// content/inbucket-mail.js — Content script for Inbucket polling (steps 4, 7)
// Injected dynamically on the configured Inbucket host
//
// Supported page:
// - /m/<mailbox>/

const INBUCKET_PREFIX = '[MultiPage:inbucket-mail]';
const isTopFrame = window === window.top;
const SEEN_MAIL_IDS_KEY = 'seenInbucketMailIds';

console.log(INBUCKET_PREFIX, 'Content script loaded on', location.href, 'frame:', isTopFrame ? 'top' : 'child');

if (!isTopFrame) {
  console.log(INBUCKET_PREFIX, 'Skipping child frame');
} else {

let seenMailIds = new Set();

async function loadSeenMailIds() {
  try {
    const data = await chrome.storage.session.get(SEEN_MAIL_IDS_KEY);
    if (Array.isArray(data[SEEN_MAIL_IDS_KEY])) {
      seenMailIds = new Set(data[SEEN_MAIL_IDS_KEY]);
      console.log(INBUCKET_PREFIX, `Loaded ${seenMailIds.size} previously seen mail ids`);
    }
  } catch (err) {
    console.warn(INBUCKET_PREFIX, 'Session storage unavailable, using in-memory seen mail ids:', err?.message || err);
  }
}

async function persistSeenMailIds() {
  try {
    await chrome.storage.session.set({ [SEEN_MAIL_IDS_KEY]: [...seenMailIds] });
  } catch (err) {
    console.warn(INBUCKET_PREFIX, 'Could not persist seen mail ids, continuing in-memory only:', err?.message || err);
  }
}

loadSeenMailIds();

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

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
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

function matchesKeywordHints(text, keywords = []) {
  const normalizedText = normalizeText(text);
  const normalizedKeywords = Array.isArray(keywords) ? keywords : [];
  return normalizedKeywords.some((keyword) => normalizedText.includes(normalizeText(keyword)));
}

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

function rowMatchesFilters(mail, senderFilters, subjectFilters, targetEmail, options = {}) {
  const sender = normalizeText(mail.sender);
  const subject = normalizeText(mail.subject);
  const mailbox = normalizeText(mail.mailbox);
  const combined = normalizeText(mail.combinedText);
  const targetLocal = normalizeText((targetEmail || '').split('@')[0]);

  const senderMatch = senderFilters.some(f => sender.includes(f.toLowerCase()) || combined.includes(f.toLowerCase()));
  const subjectMatch = subjectFilters.some(f => subject.includes(f.toLowerCase()) || combined.includes(f.toLowerCase()));
  const mailboxMatch = Boolean(targetLocal) && mailbox.includes(targetLocal);
  const forwardedDuck = /duckduckgo|forward(?:ed)?\s*by/i.test(mail.combinedText);
  const code = extractVerificationCode(mail.combinedText, {
    codePatterns: options?.codePatterns,
  });
  const keywordMatch = options?.requiredKeywords?.length
    ? matchesKeywordHints(combined, options.requiredKeywords)
    : /verify|verification|confirm|log-?in|验证码|代码/.test(combined);

  if (mailboxMatch) return { matched: true, mailboxMatch, code };
  if (senderMatch || subjectMatch) return { matched: true, mailboxMatch: false, code };
  if (code && (forwardedDuck || keywordMatch)) return { matched: true, mailboxMatch: false, code };

  return { matched: false, mailboxMatch: false, code };
}

function findMailboxEntries() {
  return document.querySelectorAll('.message-list-entry');
}

function getMailboxEntryId(entry, index = 0) {
  const explicitId = entry.getAttribute('data-id') || entry.dataset?.id || '';
  if (explicitId) return explicitId;

  const subject = entry.querySelector('.subject')?.textContent?.trim() || '';
  const sender = entry.querySelector('.from')?.textContent?.trim() || '';
  const dateText = entry.querySelector('.date')?.textContent?.trim() || '';

  return `mailbox:${index}:${normalizeText(subject)}|${normalizeText(sender)}|${normalizeText(dateText)}`;
}

function parseMailboxEntry(entry, index = 0) {
  const subject = entry.querySelector('.subject')?.textContent?.trim() || '';
  const sender = entry.querySelector('.from')?.textContent?.trim() || '';
  const dateText = entry.querySelector('.date')?.textContent?.trim() || '';
  const combinedText = [subject, sender, dateText].filter(Boolean).join(' ');

  return {
    entry,
    dateText,
    sender,
    mailbox: '',
    subject,
    unread: entry.classList.contains('unseen'),
    combinedText,
    mailId: getMailboxEntryId(entry, index),
  };
}

function getCurrentMailboxIds() {
  const ids = new Set();
  Array.from(findMailboxEntries()).forEach((entry, index) => {
    ids.add(getMailboxEntryId(entry, index));
  });
  return ids;
}

async function refreshMailbox() {
  const refreshButton = document.querySelector('button[alt="Refresh Mailbox"]');
  if (!refreshButton) return;

  simulateClick(refreshButton);
  await sleep(800);
}

async function openMailboxEntry(entry) {
  simulateClick(entry);

  for (let i = 0; i < 20; i++) {
    if (entry.classList.contains('selected') || document.querySelector('.message-header, .message-body, .button-bar')) {
      return;
    }
    await sleep(150);
  }
}

async function deleteCurrentMailboxMessage(step) {
  try {
    const deleteButton = await waitForElement('.button-bar button.danger', 5000);
    simulateClick(deleteButton);
    log(`Step ${step}: Deleted mailbox message`, 'ok');
    await sleep(1200);
  } catch (err) {
    log(`Step ${step}: Failed to delete mailbox message: ${err.message}`, 'warn');
  }
}

async function handleMailboxPollEmail(step, payload) {
  const {
    codePatterns = [],
    requiredKeywords = [],
    senderFilters = [],
    subjectFilters = [],
    maxAttempts = 20,
    intervalMs = 3000,
    excludeCodes = [],
  } = payload || {};
  const excludedCodeSet = new Set(excludeCodes.filter(Boolean));

  log(`Step ${step}: Starting Inbucket mailbox page polling (max ${maxAttempts} attempts)`);

  try {
    await waitForElement('.message-list, .message-list-entry', 15000);
    log(`Step ${step}: Mailbox page loaded`);
  } catch {
    throw new Error('Inbucket mailbox page did not finish loading. Please confirm /m/<mailbox>/ page is open.');
  }

  const existingMailIds = getCurrentMailboxIds();
  log(`Step ${step}: Recorded snapshot of current ${existingMailIds.size} old messages`);

  const FALLBACK_AFTER = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Step ${step}: Polling Inbucket mailbox, attempt ${attempt}/${maxAttempts}`);

    if (attempt > 1) {
      await refreshMailbox();
    }

    const entries = Array.from(findMailboxEntries()).map(parseMailboxEntry);
    const useFallback = attempt > FALLBACK_AFTER;
    const candidates = [];

    for (const mail of entries) {
      if (!mail.unread) continue;
      if (seenMailIds.has(mail.mailId)) continue;
      if (!useFallback && existingMailIds.has(mail.mailId)) continue;

      const match = rowMatchesFilters(mail, senderFilters, subjectFilters, '', {
        codePatterns,
        requiredKeywords,
      });
      if (!match.matched) continue;

      candidates.push({ ...mail, code: match.code });
    }

    for (const mail of candidates) {
      const code = mail.code || extractVerificationCode(mail.combinedText, {
        codePatterns,
      });
      if (!code) continue;
      if (excludedCodeSet.has(code)) {
        log(`Step ${step}: Skipping excluded verification code: ${code}`, 'info');
        continue;
      }

      await openMailboxEntry(mail.entry);
      await deleteCurrentMailboxMessage(step);

      seenMailIds.add(mail.mailId);
      await persistSeenMailIds();

      const source = existingMailIds.has(mail.mailId) ? 'fallback-matched email' : 'new email';
      log(
        `Step ${step}: Found verification code: ${code} (source: ${source}, sender: ${mail.sender || 'unknown'}, subject: ${(mail.subject || '').slice(0, 60)})`,
        'ok'
      );

      return {
        ok: true,
        code,
        emailTimestamp: Date.now(),
        mailId: mail.mailId,
      };
    }

    if (attempt === FALLBACK_AFTER + 1) {
      log(`Step ${step}: No new messages yet, starting fallback to earlier matched emails`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleep(intervalMs);
    }
  }

  throw new Error(
    `No matching verification code email found in Inbucket mailbox after ${(maxAttempts * intervalMs / 1000).toFixed(0)} seconds. ` +
    'Please manually check the mailbox page.'
  );
}

async function handlePollEmail(step, payload) {
  if (!location.pathname.startsWith('/m/')) {
    throw new Error('Current Inbucket only supports the /m/<mailbox>/ mailbox page.');
  }
  return handleMailboxPollEmail(step, payload);
}

} // end of isTopFrame else block
