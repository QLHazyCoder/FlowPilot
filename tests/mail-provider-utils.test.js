const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HOTMAIL_PROVIDER,
  inferMailProvider,
  YYDS_MAIL_PROVIDER,
  getIcloudForwardMailConfig,
  getIcloudForwardMailProviderOptions,
  getMailProviderConfig,
  normalizeIcloudForwardMailProvider,
  normalizeIcloudTargetMailboxType,
  normalizeMailProvider,
  withResolvedMailProvider,
} = require('../mail-provider-utils.js');

test('normalizeMailProvider accepts 126 and falls back to 163', () => {
  assert.equal(normalizeMailProvider('126'), '126');
  assert.equal(normalizeMailProvider('163-vip'), '163-vip');
  assert.equal(normalizeMailProvider(YYDS_MAIL_PROVIDER), YYDS_MAIL_PROVIDER);
  assert.equal(normalizeMailProvider('unknown-provider'), '163');
});

test('getMailProviderConfig returns the shared NetEase source for 126 mail', () => {
  assert.deepEqual(
    getMailProviderConfig({ mailProvider: '126' }),
    {
      source: 'mail-163',
      url: 'https://mail.126.com/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D',
      label: '126 邮箱',
    }
  );
});

test('getMailProviderConfig preserves the hotmail provider sentinel', () => {
  assert.deepEqual(
    getMailProviderConfig({ mailProvider: HOTMAIL_PROVIDER }),
    {
      provider: HOTMAIL_PROVIDER,
      label: 'Hotmail（微软 Graph）',
    }
  );
});

test('getMailProviderConfig preserves the YYDS Mail provider sentinel', () => {
  assert.deepEqual(
    getMailProviderConfig({ mailProvider: YYDS_MAIL_PROVIDER }),
    {
      provider: YYDS_MAIL_PROVIDER,
      label: 'YYDS Mail',
    }
  );
});

test('mail provider utils infers effective provider from mail config shape', () => {
  assert.equal(
    inferMailProvider({ source: 'yahoo-mail', url: 'https://mail.yahoo.com/n/inbox/all' }, {}),
    'yahoo'
  );
  assert.equal(
    inferMailProvider({ label: 'Cloudflare Temp Email' }, {}),
    'cloudflare-temp-email'
  );
  assert.equal(
    inferMailProvider({}, { mailProvider: ' YAHOO ' }),
    'yahoo'
  );
  assert.deepEqual(
    withResolvedMailProvider({ source: 'yahoo-mail' }, {}),
    { source: 'yahoo-mail', provider: 'yahoo' }
  );
});

test('iCloud forward mailbox helpers normalize and expose supported providers', () => {
  assert.equal(normalizeIcloudTargetMailboxType('forward-mailbox'), 'forward-mailbox');
  assert.equal(normalizeIcloudTargetMailboxType('unknown'), 'icloud-inbox');
  assert.equal(normalizeIcloudForwardMailProvider('GMAIL'), 'gmail');
  assert.equal(normalizeIcloudForwardMailProvider('unknown'), 'qq');
  assert.deepEqual(
    getIcloudForwardMailProviderOptions().map((option) => option.value),
    ['qq', '163', '163-vip', '126', 'gmail']
  );
});

test('getIcloudForwardMailConfig reuses shared mailbox provider configs', () => {
  assert.deepEqual(getIcloudForwardMailConfig('126'), {
    source: 'mail-163',
    url: 'https://mail.126.com/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D',
    label: '126 邮箱',
  });
  assert.deepEqual(getIcloudForwardMailConfig('gmail'), {
    source: 'gmail-mail',
    url: 'https://mail.google.com/mail/u/0/#inbox',
    label: 'Gmail 邮箱',
    inject: ['content/activation-utils.js', 'content/utils.js', 'content/gmail-mail.js'],
    injectSource: 'gmail-mail',
  });
});
