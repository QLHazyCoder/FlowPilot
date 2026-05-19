const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/icloud-mail.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('readOpenedMailBody falls back to thread detail pane and extracts verification code', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
    extractFunction('getOpenedMailBodyRoot'),
    extractFunction('readOpenedMailBody'),
  ].join('\n');

  const api = new Function(`
const detailPane = {
  innerText: '此邮件包含远程内容。 你的 ChatGPT 代码为 731091 输入此临时验证码以继续：731091',
  textContent: '此邮件包含远程内容。 你的 ChatGPT 代码为 731091 输入此临时验证码以继续：731091',
};
const document = {
  querySelector(selector) {
    if (selector.includes('.pane.thread-detail-pane')) {
      return detailPane;
    }
    return null;
  },
};
${bundle}
return { readOpenedMailBody, extractVerificationCode };
`)();

  const bodyText = api.readOpenedMailBody();
  assert.match(bodyText, /731091/);
  assert.equal(api.extractVerificationCode(bodyText), '731091');
});

test('extractVerificationCode matches the new suspicious log-in mail body', () => {
  const bundle = [
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { extractVerificationCode };
`)();

  const bodyText = 'ChatGPT Log-in Code\nWe noticed a suspicious log-in on your account. If that was you, enter this code:\n\n982219';
  assert.equal(api.extractVerificationCode(bodyText), '982219');
});

test('extractVerificationCode supports runtime mail rule patterns', () => {
  const bundle = [
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
  ].join('\n');

  const api = new Function(`
${bundle}
return { extractVerificationCode };
`)();

  const bodyText = 'Mailbox notice\nUse verification pin A-445566 to continue.';
  assert.equal(
    api.extractVerificationCode(bodyText, {
      codePatterns: [{ source: 'pin\\s+A-(\\d{6})', flags: 'i' }],
    }),
    '445566'
  );
});

test('readOpenedMailBody ignores conversation list rows when no detail pane is open', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getOpenedMailBodyRoot'),
    extractFunction('readOpenedMailBody'),
  ].join('\n');

  const api = new Function(`
const document = {
  querySelector(selector) {
    if (selector === '.mail-message-defaults, .pane.thread-detail-pane') {
      return null;
    }
    throw new Error('unexpected selector: ' + selector);
  },
};
${bundle}
return { readOpenedMailBody };
`)();

  assert.equal(api.readOpenedMailBody(), '');
});

test('isThreadItemSelected follows the selected thread-list-item instead of the content container itself', () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('buildItemSignature'),
    extractFunction('getThreadListItemRoot'),
    extractFunction('isThreadItemSelected'),
  ].join('\n');

  const selectedRoot = {
    getAttribute(name) {
      return name === 'aria-selected' ? 'true' : '';
    },
    className: 'thread-list-item ic-z3c00x',
  };
  const selectedItem = {
    closest() {
      return selectedRoot;
    },
    getAttribute() {
      return '';
    },
    querySelector(selector) {
      const map = {
        '.thread-participants': { textContent: 'OpenAI' },
        '.thread-subject': { textContent: '你的 ChatGPT 代码为 731091' },
        '.thread-preview': { textContent: '输入此临时验证码以继续：731091' },
        '.thread-timestamp': { textContent: '下午1:35' },
      };
      return map[selector] || null;
    },
  };
  const staleRoot = {
    getAttribute() {
      return '';
    },
    className: 'thread-list-item ic-z3c00x',
  };
  const staleItem = {
    closest() {
      return staleRoot;
    },
    getAttribute() {
      return '';
    },
    querySelector(selector) {
      const map = {
        '.thread-participants': { textContent: 'JetBrains Sales' },
        '.thread-subject': { textContent: '旧邮件' },
        '.thread-preview': { textContent: '旧摘要' },
        '.thread-timestamp': { textContent: '2026/3/4' },
      };
      return map[selector] || null;
    },
  };

  const api = new Function(`
let threadItems = [];
function collectThreadItems() {
  return threadItems;
}
${bundle}
return {
  buildItemSignature,
  isThreadItemSelected,
  setThreadItems(next) {
    threadItems = next;
  },
};
`)();

  api.setThreadItems([selectedItem, staleItem]);
  assert.equal(api.isThreadItemSelected(staleItem, api.buildItemSignature(selectedItem)), true);
  assert.equal(api.isThreadItemSelected(staleItem, api.buildItemSignature(staleItem)), false);
});

test('icloud poll session baseline is reused across calls and enables fallback after carry-over attempts', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('buildItemSignature'),
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
    extractFunction('getElementAccessibleText'),
    extractFunction('resolveIcloudInboxCategoryId'),
    extractFunction('getIcloudInboxCategoryLabel'),
    extractFunction('resolveIcloudInboxControlText'),
    extractFunction('isIcloudInboxControlLabel'),
    extractFunction('isIcloudSelectedMailboxControl'),
    extractFunction('findIcloudInboxControl'),
    extractFunction('openIcloudInboxIfAvailable'),
    extractFunction('getIcloudInboxCategoryControls'),
    extractFunction('isIcloudInboxCategorySelected'),
    extractFunction('switchIcloudInboxCategory'),
    extractFunction('visitIcloudInboxCategories'),
    extractFunction('collectThreadSignaturesAcrossInboxCategories'),
    extractFunction('normalizePollSessionKey'),
    extractFunction('getOrCreatePollSessionBaseline'),
    extractFunction('persistPollSessionBaseline'),
    extractFunction('handlePollEmail'),
  ].join('\n');

  const api = new Function(`
const ICLOUD_POLL_SESSION_CACHE = new Map();
function log() {}
function throwIfStopped() {}
async function sleep() {}
async function waitForElement() { return true; }
async function refreshInbox() { return true; }
function isVisibleElement() { return true; }
function normalizeThreadEntry(entry) {
  return {
    signature: String(entry.signature || ''),
    sender: String(entry.sender || ''),
    subject: String(entry.subject || ''),
    preview: String(entry.preview || ''),
    timestamp: String(entry.timestamp || ''),
    ariaLabel: String(entry.ariaLabel || ''),
  };
}
let currentThreadData = [];
function setThreadData(next) {
  currentThreadData = Array.isArray(next) ? next.map(normalizeThreadEntry) : [];
}
function collectThreadItems() {
  return currentThreadData.map((entry) => ({
    getAttribute(name) {
      if (name === 'aria-label') return entry.ariaLabel || entry.signature;
      return '';
    },
    querySelector(selector) {
      if (selector === '.thread-participants') return { textContent: entry.sender };
      if (selector === '.thread-subject') return { textContent: entry.subject };
      if (selector === '.thread-preview') return { textContent: entry.preview };
      if (selector === '.thread-timestamp') return { textContent: entry.timestamp };
      return null;
    },
  }));
}
async function openMailItemAndRead(item) {
  const meta = getThreadItemMetadata(item);
  return {
    sender: meta.sender,
    recipients: '',
    timestamp: meta.timestamp,
    bodyText: meta.preview,
    combinedText: meta.combinedText,
  };
}
${bundle}
return {
  handlePollEmail,
  setThreadData,
};
`)();

  api.setThreadData([
    { signature: 'old-1', sender: 'OpenAI', subject: '旧邮件', preview: 'no code', timestamp: '10:00', ariaLabel: 'old-1' },
  ]);

  await assert.rejects(
    () => api.handlePollEmail(8, {
      senderFilters: ['openai'],
      subjectFilters: ['code'],
      maxAttempts: 1,
      intervalMs: 10,
      excludeCodes: [],
      sessionKey: 's-1',
    }),
    /仍未在 iCloud 邮箱中找到新的匹配邮件/
  );

  api.setThreadData([
    { signature: 'old-1', sender: 'OpenAI', subject: '旧邮件', preview: 'no code', timestamp: '10:00', ariaLabel: 'old-1' },
    { signature: 'old-2', sender: 'OpenAI', subject: '旧邮件2', preview: 'no code', timestamp: '10:01', ariaLabel: 'old-2' },
    { signature: 'old-3', sender: 'OpenAI', subject: '旧邮件3', preview: 'no code', timestamp: '10:02', ariaLabel: 'old-3' },
    { signature: 'old-4', sender: 'OpenAI', subject: '旧邮件4', preview: 'no code', timestamp: '10:03', ariaLabel: 'old-4' },
    { signature: 'old-code', sender: 'OpenAI', subject: 'ChatGPT Log-in Code', preview: 'enter this code 556677', timestamp: '10:04', ariaLabel: 'old-code' },
  ]);

  const result = await api.handlePollEmail(8, {
    senderFilters: ['openai'],
    subjectFilters: ['code', 'login'],
    maxAttempts: 1,
    intervalMs: 10,
    excludeCodes: [],
    sessionKey: 's-1',
  });

  assert.equal(result.code, '556677');
});

test('icloud step8 polling finds a visible first-row code immediately', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('buildItemSignature'),
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
    extractFunction('getElementAccessibleText'),
    extractFunction('resolveIcloudInboxCategoryId'),
    extractFunction('getIcloudInboxCategoryLabel'),
    extractFunction('resolveIcloudInboxControlText'),
    extractFunction('isIcloudInboxControlLabel'),
    extractFunction('isIcloudSelectedMailboxControl'),
    extractFunction('findIcloudInboxControl'),
    extractFunction('openIcloudInboxIfAvailable'),
    extractFunction('getIcloudInboxCategoryControls'),
    extractFunction('isIcloudInboxCategorySelected'),
    extractFunction('switchIcloudInboxCategory'),
    extractFunction('visitIcloudInboxCategories'),
    extractFunction('collectThreadSignaturesAcrossInboxCategories'),
    extractFunction('normalizePollSessionKey'),
    extractFunction('getOrCreatePollSessionBaseline'),
    extractFunction('persistPollSessionBaseline'),
    extractFunction('handlePollEmail'),
  ].join('\n');

  const api = new Function(`
const ICLOUD_POLL_SESSION_CACHE = new Map();
function log() {}
function throwIfStopped() {}
async function sleep() {}
async function waitForElement() { return true; }
async function refreshInbox() { return true; }
function isVisibleElement() { return true; }
const currentThreadData = [
  {
    signature: 'visible-code',
    sender: 'noreply@tm.openai.com',
    subject: '你的 OpenAI 代码为 576773',
    preview: '输入此临时验证码以继续：576773',
    timestamp: '21:05',
    ariaLabel: 'visible-code',
  },
  {
    signature: 'older-code',
    sender: 'noreply@tm.openai.com',
    subject: '你的 OpenAI 代码为 697852',
    preview: '输入此临时验证码以继续：697852',
    timestamp: '21:04',
    ariaLabel: 'older-code',
  },
];
function collectThreadItems() {
  return currentThreadData.map((entry) => ({
    getAttribute(name) {
      if (name === 'aria-label') return entry.ariaLabel || entry.signature;
      return '';
    },
    querySelector(selector) {
      if (selector === '.thread-participants') return { textContent: entry.sender };
      if (selector === '.thread-subject') return { textContent: entry.subject };
      if (selector === '.thread-preview') return { textContent: entry.preview };
      if (selector === '.thread-timestamp') return { textContent: entry.timestamp };
      return null;
    },
  }));
}
async function openMailItemAndRead(item) {
  const meta = getThreadItemMetadata(item);
  return {
    sender: meta.sender,
    recipients: '',
    timestamp: meta.timestamp,
    bodyText: meta.preview,
    combinedText: meta.combinedText,
  };
}
${bundle}
return { handlePollEmail };
`)();

  const result = await api.handlePollEmail(8, {
    senderFilters: ['openai', 'noreply', 'chatgpt'],
    subjectFilters: ['code', '验证码', 'login'],
    maxAttempts: 1,
    intervalMs: 10,
    excludeCodes: [],
    sessionKey: '8:visible-first',
  });

  assert.equal(result.code, '576773');
});

test('icloud step8 visible first-row code still respects excluded codes', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('buildItemSignature'),
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
    extractFunction('getElementAccessibleText'),
    extractFunction('resolveIcloudInboxCategoryId'),
    extractFunction('getIcloudInboxCategoryLabel'),
    extractFunction('resolveIcloudInboxControlText'),
    extractFunction('isIcloudInboxControlLabel'),
    extractFunction('isIcloudSelectedMailboxControl'),
    extractFunction('findIcloudInboxControl'),
    extractFunction('openIcloudInboxIfAvailable'),
    extractFunction('getIcloudInboxCategoryControls'),
    extractFunction('isIcloudInboxCategorySelected'),
    extractFunction('switchIcloudInboxCategory'),
    extractFunction('visitIcloudInboxCategories'),
    extractFunction('collectThreadSignaturesAcrossInboxCategories'),
    extractFunction('normalizePollSessionKey'),
    extractFunction('getOrCreatePollSessionBaseline'),
    extractFunction('persistPollSessionBaseline'),
    extractFunction('handlePollEmail'),
  ].join('\n');

  const api = new Function(`
const ICLOUD_POLL_SESSION_CACHE = new Map();
function log() {}
function throwIfStopped() {}
async function sleep() {}
async function waitForElement() { return true; }
async function refreshInbox() { return true; }
function isVisibleElement() { return true; }
const currentThreadData = [
  {
    signature: 'visible-code',
    sender: 'noreply@tm.openai.com',
    subject: '你的 OpenAI 代码为 576773',
    preview: '输入此临时验证码以继续：576773',
    timestamp: '21:05',
    ariaLabel: 'visible-code',
  },
];
function collectThreadItems() {
  return currentThreadData.map((entry) => ({
    getAttribute(name) {
      if (name === 'aria-label') return entry.ariaLabel || entry.signature;
      return '';
    },
    querySelector(selector) {
      if (selector === '.thread-participants') return { textContent: entry.sender };
      if (selector === '.thread-subject') return { textContent: entry.subject };
      if (selector === '.thread-preview') return { textContent: entry.preview };
      if (selector === '.thread-timestamp') return { textContent: entry.timestamp };
      return null;
    },
  }));
}
async function openMailItemAndRead(item) {
  const meta = getThreadItemMetadata(item);
  return {
    sender: meta.sender,
    recipients: '',
    timestamp: meta.timestamp,
    bodyText: meta.preview,
    combinedText: meta.combinedText,
  };
}
${bundle}
return { handlePollEmail };
`)();

  await assert.rejects(
    () => api.handlePollEmail(8, {
      senderFilters: ['openai', 'noreply', 'chatgpt'],
      subjectFilters: ['code', '验证码', 'login'],
      maxAttempts: 1,
      intervalMs: 10,
      excludeCodes: ['576773'],
      sessionKey: '8:excluded-visible-first',
    }),
    /仍未在 iCloud 邮箱中找到新的匹配邮件/
  );
});

test('icloud polling scans updates category when primary has no new verification code', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getElementAccessibleText'),
    extractFunction('resolveIcloudInboxCategoryId'),
    extractFunction('getIcloudInboxCategoryLabel'),
    extractFunction('resolveIcloudInboxControlText'),
    extractFunction('isIcloudInboxControlLabel'),
    extractFunction('isIcloudSelectedMailboxControl'),
    extractFunction('findIcloudInboxControl'),
    extractFunction('openIcloudInboxIfAvailable'),
    extractFunction('getIcloudInboxCategoryControls'),
    extractFunction('isIcloudInboxCategorySelected'),
    extractFunction('switchIcloudInboxCategory'),
    extractFunction('visitIcloudInboxCategories'),
    extractFunction('getThreadItemMetadata'),
    extractFunction('buildItemSignature'),
    extractFunction('collectThreadSignaturesAcrossInboxCategories'),
    extractFunction('normalizeRulePatternList'),
    extractFunction('extractCodeByRulePatterns'),
    extractFunction('extractVerificationCode'),
    extractFunction('normalizePollSessionKey'),
    extractFunction('getOrCreatePollSessionBaseline'),
    extractFunction('persistPollSessionBaseline'),
    extractFunction('handlePollEmail'),
  ].join('\n');

  const api = new Function(`
const ICLOUD_POLL_SESSION_CACHE = new Map();
const ICLOUD_INBOX_CATEGORY_DEFINITIONS = Object.freeze([
  { id: 'primary', label: '主要', patterns: [/^主要(?:\\s*\\d+)?$/i, /^primary(?:\\s+\\d+)?$/i] },
  { id: 'updates', label: '更新', patterns: [/^更新(?:\\s*\\d+)?$/i, /^updates?(?:\\s+\\d+)?$/i] },
]);
let activeCategory = 'primary';
const controls = [
  {
    id: 'primary',
    innerText: '主要',
    textContent: '主要',
    className: '',
    getAttribute(name) {
      if (name === 'aria-selected') return activeCategory === 'primary' ? 'true' : 'false';
      return '';
    },
  },
  {
    id: 'updates',
    innerText: '更新',
    textContent: '更新',
    className: '',
    getAttribute(name) {
      if (name === 'aria-selected') return activeCategory === 'updates' ? 'true' : 'false';
      return '';
    },
  },
];
const threadsByCategory = {
  primary: [
    { signature: 'primary-old', sender: 'OpenAI', subject: '旧邮件', preview: 'no code', timestamp: '10:00', ariaLabel: 'primary-old' },
  ],
  updates: [],
};
function log() {}
function throwIfStopped() {}
async function sleep() {}
async function waitForElement() { return true; }
async function refreshInbox() { return true; }
function isVisibleElement() { return true; }
function simulateClick(node) {
  activeCategory = node.id;
}
const document = {
  querySelectorAll(selector) {
    if (selector === 'button, [role="tab"], [role="button"], a') {
      return controls;
    }
    return [];
  },
};
function setUpdatesThreadData(next) {
  threadsByCategory.updates = next;
}
function collectThreadItems() {
  return threadsByCategory[activeCategory].map((entry) => ({
    getAttribute(name) {
      if (name === 'aria-label') return entry.ariaLabel || entry.signature;
      return '';
    },
    querySelector(selector) {
      if (selector === '.thread-participants') return { textContent: entry.sender };
      if (selector === '.thread-subject') return { textContent: entry.subject };
      if (selector === '.thread-preview') return { textContent: entry.preview };
      if (selector === '.thread-timestamp') return { textContent: entry.timestamp };
      return null;
    },
  }));
}
async function openMailItemAndRead(item) {
  const meta = getThreadItemMetadata(item);
  return {
    sender: meta.sender,
    recipients: '',
    timestamp: meta.timestamp,
    bodyText: meta.preview,
    combinedText: meta.combinedText,
  };
}
${bundle}
return {
  handlePollEmail,
  setUpdatesThreadData,
};
`)();

  await assert.rejects(
    () => api.handlePollEmail(8, {
      senderFilters: ['openai'],
      subjectFilters: ['code', 'login', '验证码'],
      maxAttempts: 1,
      intervalMs: 10,
      excludeCodes: [],
      sessionKey: 'icloud-categories',
    }),
    /仍未在 iCloud 邮箱中找到新的匹配邮件/
  );

  api.setUpdatesThreadData([
    {
      signature: 'updates-code',
      sender: 'noreply@tm.openai.com',
      subject: 'ChatGPT Log-in Code',
      preview: 'enter this code 774411',
      timestamp: '10:01',
      ariaLabel: 'updates-code',
    },
  ]);

  const result = await api.handlePollEmail(8, {
    senderFilters: ['openai', 'noreply'],
    subjectFilters: ['code', 'login', '验证码'],
    maxAttempts: 1,
    intervalMs: 10,
    excludeCodes: [],
    sessionKey: 'icloud-categories',
  });

  assert.equal(result.code, '774411');
});

test('icloud refresh opens inbox before refreshing current mail list', async () => {
  const bundle = [
    extractFunction('normalizeText'),
    extractFunction('getElementAccessibleText'),
    extractFunction('resolveIcloudInboxCategoryId'),
    extractFunction('resolveIcloudInboxControlText'),
    extractFunction('isIcloudInboxControlLabel'),
    extractFunction('isIcloudSelectedMailboxControl'),
    extractFunction('findIcloudInboxControl'),
    extractFunction('openIcloudInboxIfAvailable'),
    extractFunction('refreshInbox'),
  ].join('\n');

  const api = new Function(`
const ICLOUD_INBOX_CATEGORY_DEFINITIONS = Object.freeze([
  { id: 'primary', label: '主要', patterns: [/^主要(?:\\s*\\d+)?$/i, /^primary(?:\\s+\\d+)?$/i] },
  { id: 'updates', label: '更新', patterns: [/^更新(?:\\s*\\d+)?$/i, /^updates?(?:\\s+\\d+)?$/i] },
]);
const clicks = [];
function isVisibleElement() { return true; }
async function sleep() {}
function simulateClick(node) {
  clicks.push(node.id);
}
const inbox = {
  id: 'inbox',
  innerText: '收件箱',
  textContent: '收件箱',
  className: '',
  getAttribute(name) {
    if (name === 'aria-selected') return 'false';
    return '';
  },
};
const refresh = {
  id: 'refresh',
  innerText: '刷新',
  textContent: '刷新',
  className: '',
  getAttribute() {
    return '';
  },
};
const primary = {
  id: 'primary',
  innerText: '主要',
  textContent: '主要',
  className: '',
  getAttribute() {
    return '';
  },
};
const document = {
  querySelectorAll(selector) {
    if (selector === 'button, [role="button"], [role="treeitem"], [role="option"], a') {
      return [primary, inbox, refresh];
    }
    if (selector === 'button, [role="button"], a') {
      return [primary, inbox, refresh];
    }
    return [];
  },
};
${bundle}
return {
  refreshInbox,
  clicks,
};
`)();

  await api.refreshInbox();
  assert.deepEqual(api.clicks, ['inbox', 'refresh']);
});
