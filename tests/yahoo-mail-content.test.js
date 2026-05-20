const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/yahoo-mail.js', 'utf8');

function loadYahooMailHelpers() {
  class FakeHTMLElement {
    constructor(attrs = {}, options = {}) {
      this._attrs = { ...attrs };
      this.dataset = { ...(options.dataset || {}) };
      this._query = options.query || {};
      this._queryAll = options.queryAll || [];
      this.innerText = options.innerText || '';
      this.textContent = options.textContent || this.innerText;
      this._rect = options.rect || { width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20 };
    }

    getAttribute(name) {
      return this._attrs[name] ?? null;
    }

    querySelector(selector) {
      return this._query[selector] || null;
    }

    matches(selector) {
      const testId = this.getAttribute('data-test-id') || '';
      if (selector === '[data-test-id="message-list-item"]') {
        return testId === 'message-list-item';
      }
      if (selector === '[data-test-id*="message-list-item"]') {
        return testId.includes('message-list-item');
      }
      return false;
    }

    querySelectorAll() {
      return this._queryAll;
    }

    getBoundingClientRect() {
      return this._rect;
    }
  }

  class FakeHTMLInputElement extends FakeHTMLElement {}
  class FakeHTMLTextAreaElement extends FakeHTMLElement {}
  class FakeSVGElement extends FakeHTMLElement {}
  class FakeMouseEvent {}
  class FakeInputEvent {}

  const documentObject = {
    body: { innerText: '', textContent: '' },
    querySelector: () => null,
    querySelectorAll: () => [],
    elementFromPoint: () => null,
    documentElement: { clientWidth: 1920, clientHeight: 1080 },
  };

  const helpers = new Function(
    'chrome', 'console', 'location', 'document', 'window', 'history', 'URL', 'log',
    'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'SVGElement',
    'MouseEvent', 'InputEvent', 'getComputedStyle',
    `${source}; return { isYahooInboxPage, normalizeYahooFingerprintText, buildYahooTopMessageFingerprint, evaluateYahooTopMessageFreshness, extractVerificationCode, extractVerificationCodeWithPatterns, getRowText, getYahooRowFullText, extractSixDigitCodeFromLatestRow, getTopRowInlineCode, findTopMessageRow, isLikelyYahooMessageRow, findYahooMessageOpenTarget, getYahooMessageOpenClickPoint, isKiroYahooTopMessagePayload, handleKiroYahooTopMessageFastPath };`
  )(
    { runtime: { onMessage: { addListener: () => {} } } },
    { log: () => {} },
    { href: 'https://mail.yahoo.com/n/inbox/all', origin: 'https://mail.yahoo.com' },
    documentObject,
    { innerWidth: 1920, innerHeight: 1080 },
    { length: 1, back: () => {} },
    URL,
    () => {},
    FakeHTMLElement,
    FakeHTMLInputElement,
    FakeHTMLTextAreaElement,
    FakeSVGElement,
    FakeMouseEvent,
    FakeInputEvent,
    () => ({ display: 'block', visibility: 'visible' })
  );

  return {
    ...helpers,
    FakeHTMLElement,
    documentObject,
  };
}

test('yahoo mail content exposes dedicated top-message and alias commands', () => {
  assert.match(source, /YAHOO_CHECK_TOP_MESSAGE/);
  assert.match(source, /YAHOO_OPEN_TOP_MESSAGE/);
  assert.match(source, /YAHOO_READ_CURRENT_MESSAGE_CODE/);
  assert.match(source, /YAHOO_CREATE_TEMP_ALIAS/);
  assert.match(source, /YAHOO_LEGACY_POLLING_DISABLED/);
});

test('yahoo mail content signals background when inbox or settings must be reopened', () => {
  assert.match(source, /YAHOO_INBOX_REOPEN_REQUIRED::/);
  assert.match(source, /YAHOO_SETTINGS_REOPEN_REQUIRED::/);
  assert.doesNotMatch(source, /location\.href\s*=\s*YAHOO_INBOX_URL/);
  assert.doesNotMatch(source, /location\.href\s*=\s*YAHOO_SETTINGS_URL/);
});

test('yahoo inbox detection accepts standard inbox urls with query strings', () => {
  const { isYahooInboxPage } = loadYahooMailHelpers();
  assert.equal(isYahooInboxPage('https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX'), true);
  assert.equal(isYahooInboxPage('https://mail.yahoo.com/n/inbox/all?accountIds=abc'), true);
  assert.equal(isYahooInboxPage('https://mail.yahoo.com/n/settings/2'), false);
});

test('yahoo fingerprint ignores volatile relative-time text changes on the same top mail', () => {
  const { FakeHTMLElement, buildYahooTopMessageFingerprint } = loadYahooMailHelpers();
  const row = new FakeHTMLElement(
    { 'data-id': 'msg-1', 'data-test-id': 'row-1' },
    {
      query: {
        'a[href]': { getAttribute: () => '/d/msg-1' },
        'time, [datetime]': { getAttribute: () => '2026-04-26T01:23:45Z' },
      },
    }
  );

  const fp1 = buildYahooTopMessageFingerprint(row, 'OpenAI verification code 123456 1 minute ago', { code: '123456' }, 0);
  const fp2 = buildYahooTopMessageFingerprint(row, 'OpenAI verification code 123456 2 minutes ago', { code: '123456' }, 0);
  const fp3 = buildYahooTopMessageFingerprint(row, 'OpenAI verification code 123456 昨天 下午 3:21', { code: '123456' }, 0);

  assert.equal(fp1, fp2);
  assert.equal(fp2, fp3);
});

test('yahoo freshness rejects same top mail when only relative-time text changes', () => {
  const { FakeHTMLElement, buildYahooTopMessageFingerprint, evaluateYahooTopMessageFreshness } = loadYahooMailHelpers();
  const row = new FakeHTMLElement(
    { 'data-id': 'msg-1', 'data-test-id': 'row-1' },
    {
      query: {
        'a[href]': { getAttribute: () => '/d/msg-1' },
        'time, [datetime]': { getAttribute: () => '2026-04-26T01:23:45Z' },
      },
    }
  );

  const previousTopMessageFingerprint = buildYahooTopMessageFingerprint(
    row,
    'OpenAI verification code 123456 1 minute ago',
    { code: '123456' },
    0
  );

  const freshness = evaluateYahooTopMessageFreshness(
    row,
    'OpenAI verification code 123456 2 minutes ago',
    { code: '123456' },
    1000,
    {
      previousTopMessageFingerprint,
      previousAcceptedEmailTimestamp: 0,
      requestedAt: 999999,
      yahooTopRowOnly: true,
    },
    true
  );

  assert.equal(freshness.fingerprintChanged, false);
  assert.equal(freshness.freshnessMatched, false);
});

test('yahoo freshness does not treat missing previous fingerprint as a fingerprint change', () => {
  const { FakeHTMLElement, evaluateYahooTopMessageFreshness } = loadYahooMailHelpers();
  const row = new FakeHTMLElement({ 'data-id': 'msg-3', 'data-test-id': 'row-3' });

  const freshness = evaluateYahooTopMessageFreshness(
    row,
    'AWS Builder ID verification code 777888',
    { code: '777888' },
    0,
    {
      previousTopMessageFingerprint: '',
      previousAcceptedEmailTimestamp: 0,
      requestedAt: 0,
      yahooTopRowOnly: true,
    },
    true
  );

  assert.equal(freshness.fingerprintChanged, false);
  assert.equal(freshness.freshnessMatched, false);
});

test('yahoo top row detection ignores offscreen virtual rows and accepts Kiro AWS sender', () => {
  const { FakeHTMLElement, findTopMessageRow, isLikelyYahooMessageRow } = loadYahooMailHelpers();
  const offscreenOldRow = new FakeHTMLElement({}, {
    innerText: 'ChatGPT 你的临时验证码 294070 6:42 PM',
    rect: { width: 1000, height: 44, top: -180, left: 0, right: 1000, bottom: -136 },
  });
  const topKiroRow = new FakeHTMLElement({}, {
    innerText: 'no-reply@signin.aws 验证您的 AWS 构建者 ID 电子邮件地址 11:20 PM',
    rect: { width: 1000, height: 44, top: 72, left: 0, right: 1000, bottom: 116 },
  });
  const nextRow = new FakeHTMLElement({}, {
    innerText: 'Amazon Web Services Response Required: Your Kiro Account 11:10 PM',
    rect: { width: 1000, height: 44, top: 116, left: 0, right: 1000, bottom: 160 },
  });

  assert.equal(isLikelyYahooMessageRow(offscreenOldRow), false);
  assert.equal(isLikelyYahooMessageRow(topKiroRow), true);
  assert.equal(findTopMessageRow([offscreenOldRow, nextRow, topKiroRow]), topKiroRow);
});

test('yahoo row text extraction reads full hidden AWS snippet code before opening detail', () => {
  const {
    FakeHTMLElement,
    getYahooRowFullText,
    extractSixDigitCodeFromLatestRow,
    getTopRowInlineCode,
  } = loadYahooMailHelpers();
  const snippet = new FakeHTMLElement({ id: 'email-snippet-2494' }, {
    innerText: '',
    textContent: '验证您的 AWS 构建者 ID 电子邮件地址 您好！ 请输入以下验证码。验证码： 762101 此验证码将在发送后 30 分钟过期。',
  });
  const subjectSnippet = new FakeHTMLElement({ id: 'email-subject-snippet-2494' }, {
    innerText: '',
    textContent: '验证您的 AWS 构建者 ID 电子邮件地址·验证您的 AWS 构建者 ID 电子邮件地址 您好！ 感谢您开始使用 AWS 构建者 ID！ AWS 构建者 ID 是...',
  });
  const row = new FakeHTMLElement({}, {
    innerText: 'no-reply@signin.aws 验证您的 AWS 构建者 ID 电子邮件地址 11:47 PM',
    textContent: 'no-reply@signin.aws 验证您的 AWS 构建者 ID 电子邮件地址 验证码： 762101 11:47 PM',
    queryAll: [subjectSnippet, snippet],
  });

  const fullText = getYahooRowFullText(row);

  assert.match(fullText, /验证码： 762101/);
  assert.equal(extractSixDigitCodeFromLatestRow(row).code, '762101');
  assert.equal(getTopRowInlineCode(row).code, '762101');
});

test('yahoo kiro top-message fast path extracts AWS code from visible row snippet', () => {
  const {
    FakeHTMLElement,
    documentObject,
    isKiroYahooTopMessagePayload,
    handleKiroYahooTopMessageFastPath,
  } = loadYahooMailHelpers();
  const snippet = new FakeHTMLElement({ id: 'email-snippet-2494' }, {
    textContent: '验证您的 AWS 构建者 ID 电子邮件地址 您好！ 请输入以下验证码。验证码： 762101 此验证码将在发送后 30 分钟过期。',
  });
  const row = new FakeHTMLElement({ 'data-test-id': 'message-list-item' }, {
    innerText: 'no-reply@signin.aws 验证您的 AWS 构建者 ID 电子邮件地址 11:47 PM',
    textContent: 'no-reply@signin.aws 验证您的 AWS 构建者 ID 电子邮件地址 验证码： 762101 11:47 PM',
    rect: { width: 1000, height: 44, top: 80, left: 0, right: 1000, bottom: 124 },
    queryAll: [snippet],
  });
  documentObject.querySelectorAll = () => [row];

  const payload = {
    flowId: 'kiro',
    yahooTopRowOnly: true,
    requestedAt: Date.now(),
    yahooFreshnessSkewMs: 180000,
    senderFilters: ['no-reply@signin.aws'],
    subjectFilters: ['aws'],
    codePatterns: [
      { source: '(?:verification\\s*code|验证码|Your code is|code is)[：:\\s]*(\\d{6})', flags: 'gi' },
    ],
  };
  const result = handleKiroYahooTopMessageFastPath(4, payload);

  assert.equal(isKiroYahooTopMessagePayload(payload), true);
  assert.equal(result.code, '762101');
  assert.equal(result.preview.includes('验证码： 762101'), true);
});

test('yahoo content script creates disposable aliases without pre-cleaning old aliases', () => {
  assert.doesNotMatch(source, /const deletedAliases = await deleteAllOldAliases\(\);/);
  assert.match(source, /跳过旧一次性邮箱清理，直接创建新邮箱/);
  assert.match(source, /const remainingAliases = collectAliasItems\(\)/);
  assert.match(source, /deletedAliases:\s*\[\]/);
});

test('yahoo alias creation uses disposable count instead of scanning for new alias text', () => {
  assert.match(source, /function getDisposableAliasUsageCount\(/);
  assert.match(source, /function inferYahooAliasFromExistingAliases\(/);
  assert.match(source, /等待一次性邮箱数量增加/);
  assert.match(source, /afterUsage\?\.used > beforeUsage\.used/);
  assert.doesNotMatch(source, /等待新别名出现在页面中/);
  assert.doesNotMatch(source, /attempt < 15 && !createdAlias/);
});

test('yahoo top-message flow opens matching mail details when the row preview has no code', () => {
  assert.match(source, /async function openTopRowAndReadVerificationCode\(/);
  assert.match(source, /顶部目标邮件行未直接露出验证码，正在点进邮件详情读取正文/);
  assert.match(source, /rowCode = await openTopRowAndReadVerificationCode\(topRow, rowText, payload\)/);
  assert.match(source, /message-detail-required/);
  assert.match(source, /顶部目标邮件需要打开详情读取正文/);
  assert.match(source, /async function handleOpenTopMessage\(step, payload = \{\}\)/);
  assert.match(source, /async function handleReadCurrentMessageCode\(step, payload = \{\}\)/);
});

test('yahoo message open click target prefers subject area and avoids left controls', () => {
  const { FakeHTMLElement, findYahooMessageOpenTarget, getYahooMessageOpenClickPoint } = loadYahooMailHelpers();
  const subject = new FakeHTMLElement({ 'data-test-id': 'message-list-item-subject' }, {
    innerText: '验证您的 AWS 构建者 ID 电子邮件地址',
    rect: { width: 650, height: 24, top: 80, left: 310, right: 960, bottom: 104 },
  });
  const row = new FakeHTMLElement({}, {
    innerText: 'no-reply@signin.aws 验证您的 AWS 构建者 ID 电子邮件地址 11:27 PM',
    rect: { width: 1120, height: 44, top: 68, left: 0, right: 1120, bottom: 112 },
    query: {
      '[data-test-id="message-list-item"]': null,
      '[data-test-id*="message-list-item"]': subject,
    },
  });

  const target = findYahooMessageOpenTarget(row);
  const point = getYahooMessageOpenClickPoint(row, target);

  assert.equal(target, subject);
  assert.equal(point.x > 430, true);
  assert.equal(point.y >= 86 && point.y <= 98, true);
});

test('yahoo verification extraction supports runtime Kiro code patterns', () => {
  const { extractVerificationCodeWithPatterns } = loadYahooMailHelpers();
  const code = extractVerificationCodeWithPatterns('Response Required: Your Kiro Account\nYour code is 847392', {
    codePatterns: [
      { source: '(?:verification\\s*code|验证码|Your code is|code is)[：:\\s]*(\\d{6})', flags: 'gi' },
    ],
  });

  assert.equal(code, '847392');
});

test('yahoo content script diagnoses missing add button and alias limit separately', () => {
  assert.match(source, /function buildYahooAliasCreateDiagnostics\(/);
  assert.match(source, /新建一次性电子邮件地址/);
  assert.match(source, /新增一次性电子邮件地址/);
  assert.match(source, /Yahoo 页面提示已达到一次性邮箱\/别名上限/);
  assert.match(source, /当前已按要求不自动清理旧别名/);
});

test('yahoo content script can fill login credentials from sidepanel card', () => {
  assert.match(source, /YAHOO_LOGIN_WITH_CREDENTIALS/);
  assert.match(source, /function findYahooLoginEmailInput\(\)/);
  assert.match(source, /function findYahooLoginPasswordInput\(\)/);
  assert.match(source, /async function handleYahooLoginWithCredentials\(payload = \{\}\)/);
});
