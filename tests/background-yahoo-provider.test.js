const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const backgroundSource = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map((marker) => backgroundSource.indexOf(marker)).find((index) => index >= 0);
  if (start < 0) throw new Error(`missing function ${name}`);

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < backgroundSource.length; i += 1) {
    const ch = backgroundSource[i];
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < backgroundSource.length; end += 1) {
    const ch = backgroundSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return backgroundSource.slice(start, end);
}

test('normalizeMailProvider keeps yahoo provider', () => {
  const bundle = extractFunction('normalizeMailProvider');
  const api = new Function(`
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const YAHOO_PROVIDER = 'yahoo';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const CLOUD_MAIL_PROVIDER = 'cloudmail';
const YYDS_MAIL_PROVIDER = 'yyds-mail';
const PERSISTED_SETTING_DEFAULTS = { mailProvider: '163' };
${bundle}
return { normalizeMailProvider };
`)();

  assert.equal(api.normalizeMailProvider('yahoo'), 'yahoo');
  assert.equal(api.normalizeMailProvider('YAHOO'), 'yahoo');
});

test('normalizeEmailGenerator keeps yahoo generator', () => {
  const bundle = extractFunction('normalizeEmailGenerator');
  const api = new Function(`
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const YYDS_MAIL_GENERATOR = 'yyds-mail';
const CLOUDFLARE_TEMP_EMAIL_GENERATOR = 'cloudflare-temp-email';
const YAHOO_GENERATOR = 'yahoo';
${bundle}
return { normalizeEmailGenerator };
`)();

  assert.equal(api.normalizeEmailGenerator('yahoo'), 'yahoo');
  assert.equal(api.normalizeEmailGenerator('YAHOO'), 'yahoo');
});

test('getMailConfig returns yahoo mail config with full injection stack', () => {
  const bundle = extractFunction('getMailConfig');
  const api = new Function(`
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const YAHOO_PROVIDER = 'yahoo';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const YYDS_MAIL_PROVIDER = 'yyds-mail';
function normalizeInbucketOrigin(v = '') { return String(v || '').trim(); }
${bundle}
return { getMailConfig };
`)();

  assert.deepEqual(api.getMailConfig({ mailProvider: 'yahoo' }), {
    provider: 'yahoo',
    source: 'yahoo-mail',
    url: 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX',
    label: 'Yahoo 邮箱',
    navigateOnReuse: true,
    inject: ['content/activation-utils.js', 'shared/source-registry.js', 'content/utils.js', 'content/yahoo-mail.js'],
    injectSource: 'yahoo-mail',
  });
});

test('background exposes yahoo mail login through managed source tab opening', () => {
  assert.match(backgroundSource, /async function openMailProviderLogin\(payload = \{\}\)/);
  assert.match(backgroundSource, /const mail = getMailConfig\(\{\s*\.\.\.state,\s*mailProvider: provider,/);
  assert.match(backgroundSource, /await reuseOrCreateTab\(mail\.source, targetUrl, \{/);
  assert.match(backgroundSource, /injectSource: mail\.injectSource/);
  assert.match(backgroundSource, /chrome\.tabs\.update\(tabId, \{ active: true \}\)/);
  assert.match(backgroundSource, /type: 'YAHOO_LOGIN_WITH_CREDENTIALS'/);
  assert.match(backgroundSource, /email: yahooMailEmail,/);
  assert.match(backgroundSource, /password: yahooMailPassword,/);
});

test('background persists yahoo mailbox credentials', () => {
  assert.match(backgroundSource, /yahooMailEmail: '',/);
  assert.match(backgroundSource, /yahooMailPassword: '',/);
  assert.match(backgroundSource, /case 'yahooMailEmail':\s*return String\(value \|\| ''\)\.trim\(\);/);
  assert.match(backgroundSource, /case 'yahooMailPassword':\s*return String\(value \|\| ''\);/);
});

test('auto run persists the generated yahoo email before executing signup step 2', () => {
  const ensureIndex = backgroundSource.indexOf('const readyEmail = await ensureAutoEmailReady(targetRun, totalRuns, attemptRuns);');
  const persistIndex = backgroundSource.indexOf('await setEmailState(normalizedReadyEmail);', ensureIndex);
  const executeIndex = backgroundSource.indexOf("await executeNodeAndWait('submit-signup-email'", ensureIndex);

  assert.notEqual(ensureIndex, -1);
  assert.notEqual(persistIndex, -1);
  assert.notEqual(executeIndex, -1);
  assert.equal(persistIndex < executeIndex, true);
});

test('signup email resolver refreshes latest state before deciding whether to generate yahoo again', () => {
  const bundle = extractFunction('resolveSignupEmailForFlow');

  assert.match(bundle, /latestState\s*=\s*await getState\(\)/);
  assert.match(bundle, /\.\.\.\(state \|\| \{\}\),\s*\.\.\.\(latestState \|\| \{\}\),/);
  assert.match(bundle, /signupFlowHelpers\.resolveSignupEmailForFlow/);
});

test('generated-email helper creates yahoo temporary alias through content script', async () => {
  const source = fs.readFileSync('background/generated-email-helpers.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageGeneratedEmailHelpers;`)(globalScope);
  const calls = [];
  let savedEmail = '';
  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => '',
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    CUSTOM_EMAIL_POOL_GENERATOR: 'custom-pool',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email/settings/autofill',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => '',
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({}),
    getCustomEmailPoolEmail: () => '',
    getRegistrationEmailBaseline: () => '',
    getState: async () => ({ emailGenerator: 'yahoo', emailPrefix: 'pref' }),
    ensureMail2925AccountForFlow: async () => ({}),
    joinCloudflareTempEmailUrl: (_base, path) => path,
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase() || 'duck',
    isGeneratedAliasProvider: () => false,
    persistRegistrationEmailState: async () => {
      throw new Error('Yahoo should persist through setEmailState like the codex baseline');
    },
    reuseOrCreateTab: async (...args) => calls.push(['reuseOrCreateTab', ...args]),
    sendToContentScript: async (...args) => {
      calls.push(['sendToContentScript', ...args]);
      return { email: 'pref-test@yahoo.com' };
    },
    setEmailState: async (email) => {
      savedEmail = email;
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({ emailGenerator: 'yahoo', emailPrefix: 'pref' }, {});

  assert.equal(email, 'pref-test@yahoo.com');
  assert.equal(calls[0][1], 'yahoo-mail');
  assert.equal(calls[0][2], 'https://mail.yahoo.com/n/settings/2');
  assert.deepEqual(calls[1][2].payload, { prefix: 'pref' });
  assert.equal(calls[1][2].type, 'YAHOO_CREATE_TEMP_ALIAS');
  assert.equal(savedEmail, 'pref-test@yahoo.com');
});

test('generated-email helper retries yahoo alias creation after foreground-required errors', async () => {
  const source = fs.readFileSync('background/generated-email-helpers.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageGeneratedEmailHelpers;`)(globalScope);
  const calls = [];
  let sendCount = 0;
  let savedEmail = '';
  const helpers = api.createGeneratedEmailHelpers({
    addLog: async (...args) => calls.push(['addLog', ...args]),
    buildGeneratedAliasEmail: () => '',
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    CUSTOM_EMAIL_POOL_GENERATOR: 'custom-pool',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email/settings/autofill',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => '',
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({}),
    getCustomEmailPoolEmail: () => '',
    getRegistrationEmailBaseline: () => '',
    getState: async () => ({ emailGenerator: 'yahoo', emailPrefix: 'pref' }),
    ensureMail2925AccountForFlow: async () => ({}),
    joinCloudflareTempEmailUrl: (_base, path) => path,
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase() || 'duck',
    isGeneratedAliasProvider: () => false,
    persistRegistrationEmailState: async () => {
      throw new Error('Yahoo should persist through setEmailState like the codex baseline');
    },
    reuseOrCreateTab: async (...args) => calls.push(['reuseOrCreateTab', ...args]),
    sendToContentScript: async (...args) => {
      calls.push(['sendToContentScript', ...args]);
      sendCount += 1;
      return sendCount === 1
        ? { error: '创建 Yahoo 临时邮箱失败：点击“添加”后未出现创建面板。' }
        : { email: 'pref-test@yahoo.com' };
    },
    setEmailState: async (email) => {
      savedEmail = email;
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({ emailGenerator: 'yahoo', emailPrefix: 'pref' }, {});

  assert.equal(email, 'pref-test@yahoo.com');
  assert.equal(calls.filter(([name]) => name === 'reuseOrCreateTab').length, 2);
  assert.equal(calls.filter(([name]) => name === 'sendToContentScript').length, 2);
  assert.equal(calls.some(([name, message]) => name === 'addLog' && /自动切换到 Yahoo 设置页后重试/.test(String(message))), true);
  assert.equal(savedEmail, 'pref-test@yahoo.com');
});
