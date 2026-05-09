const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  getIcloudForwardMailConfig,
  normalizeIcloudForwardMailProvider,
  normalizeIcloudTargetMailboxType,
} = require('../mail-provider-utils.js');

const source = fs.readFileSync('background.js', 'utf8');

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

function createGetMailConfigApi() {
  const bundle = extractFunction('getMailConfig');
  return new Function('shared', `
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const getSharedIcloudForwardMailConfig = shared.getIcloudForwardMailConfig;
const normalizeIcloudTargetMailboxType = shared.normalizeIcloudTargetMailboxType;
const normalizeIcloudForwardMailProvider = shared.normalizeIcloudForwardMailProvider;
function normalizeIcloudHost(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'icloud.com' || normalized === 'icloud.com.cn' ? normalized : '';
}
function normalizeInbucketOrigin(value) { return String(value || '').trim(); }
function getConfiguredIcloudHostPreference(state) {
  const normalized = String(state?.icloudHostPreference || '').trim().toLowerCase();
  return normalized === 'icloud.com' || normalized === 'icloud.com.cn' ? normalized : '';
}
function getIcloudLoginUrlForHost(host) {
  return host === 'icloud.com.cn' ? 'https://www.icloud.com.cn/' : 'https://www.icloud.com/';
}
function getIcloudMailUrlForHost(host) {
  return host === 'icloud.com.cn' ? 'https://www.icloud.com.cn/mail/' : 'https://www.icloud.com/mail/';
}
${bundle}
return { getMailConfig };
`)({
    getIcloudForwardMailConfig,
    normalizeIcloudForwardMailProvider,
    normalizeIcloudTargetMailboxType,
  });
}

test('normalizeMailProvider keeps icloud provider', () => {
  const bundle = extractFunction('normalizeMailProvider');
  const api = new Function(`
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const PERSISTED_SETTING_DEFAULTS = { mailProvider: '163' };
${bundle}
return { normalizeMailProvider };
`)();

  assert.equal(api.normalizeMailProvider('icloud'), 'icloud');
  assert.equal(api.normalizeMailProvider('ICLOUD'), 'icloud');
});

test('getMailConfig returns icloud mail tab config with host preference', () => {
  const api = createGetMailConfigApi();

  assert.deepEqual(api.getMailConfig({
    mailProvider: 'icloud',
    icloudHostPreference: 'icloud.com',
  }), {
    source: 'icloud-mail',
    url: 'https://www.icloud.com/mail/',
    label: 'iCloud 邮箱',
    navigateOnReuse: true,
  });
});

test('getMailConfig reuses preferred icloud host when preference is auto', () => {
  const api = createGetMailConfigApi();

  assert.deepEqual(api.getMailConfig({
    mailProvider: 'icloud',
    icloudHostPreference: 'auto',
    preferredIcloudHost: 'icloud.com',
  }), {
    source: 'icloud-mail',
    url: 'https://www.icloud.com/mail/',
    label: 'iCloud 邮箱',
    navigateOnReuse: true,
  });
});

test('getMailConfig keeps provider metadata for 2925 mailboxes', () => {
  const api = createGetMailConfigApi();

  assert.deepEqual(api.getMailConfig({
    mailProvider: '2925',
  }), {
    provider: '2925',
    source: 'mail-2925',
    url: 'https://2925.com/#/mailList',
    label: '2925 邮箱',
    inject: ['content/utils.js', 'content/operation-delay.js', 'content/mail-2925.js'],
    injectSource: 'mail-2925',
  });
});

test('getMailConfig uses icloud inbox config when host is com.cn and target mailbox is icloud inbox', () => {
  const api = createGetMailConfigApi();

  assert.deepEqual(api.getMailConfig({
    mailProvider: 'icloud',
    icloudHostPreference: 'icloud.com.cn',
    icloudTargetMailboxType: 'icloud-inbox',
    icloudForwardMailProvider: 'gmail',
  }), {
    source: 'icloud-mail',
    url: 'https://www.icloud.com.cn/mail/',
    label: 'iCloud 邮箱',
    navigateOnReuse: true,
  });
});

test('getMailConfig uses forward mailbox config when target mailbox type is forward', () => {
  const api = createGetMailConfigApi();

  assert.deepEqual(api.getMailConfig({
    mailProvider: 'icloud',
    icloudHostPreference: 'icloud.com.cn',
    icloudTargetMailboxType: 'forward-mailbox',
    icloudForwardMailProvider: 'gmail',
  }), {
    source: 'gmail-mail',
    url: 'https://mail.google.com/mail/u/0/#inbox',
    label: 'iCloud 转发（Gmail 邮箱）',
    inject: ['content/activation-utils.js', 'content/utils.js', 'content/gmail-mail.js'],
    injectSource: 'gmail-mail',
    icloudForwarding: true,
  });
});
