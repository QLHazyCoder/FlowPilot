const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  normalizeIcloudForwardMailProvider,
  normalizeIcloudTargetMailboxType,
} = require('../mail-provider-utils');

const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

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

function createRow(initialDisplay = 'none') {
  return {
    style: { display: initialDisplay },
  };
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) {
          values.delete(name);
          return false;
        }
        values.add(name);
        return true;
      }
      if (force) {
        values.add(name);
        return true;
      }
      values.delete(name);
      return false;
    },
    contains(name) {
      return values.has(name);
    },
  };
}

test('sidepanel html places cloudflare temp email controls in a standalone section', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  assert.match(html, /id="cloudflare-temp-email-section"/);
  assert.match(html, /id="btn-cloudflare-temp-email-usage-guide"/);
  assert.match(html, /id="btn-cloudflare-temp-email-github"/);
  assert.match(html, /btn-cloudflare-temp-email-github"[^>]*>部署</);
  assert.match(html, /id="row-temp-email-lookup-mode"/);
  assert.match(html, /data-temp-email-lookup-mode="receive-mailbox"/);
  assert.match(html, /data-temp-email-lookup-mode="registration-email"/);
  assert.match(html, /id="row-temp-email-subdomain-mode"/);
  assert.match(html, /data-temp-email-subdomain-mode="none"/);
  assert.match(html, /data-temp-email-subdomain-mode="random"/);
  assert.match(html, /data-temp-email-subdomain-mode="fixed"/);
  assert.match(html, /id="input-temp-email-use-random-subdomain"/);
  assert.match(html, /id="input-temp-email-use-fixed-subdomain"/);
  assert.match(html, /id="row-temp-email-fixed-subdomain-prefix"/);
  assert.match(html, /id="input-temp-email-subdomain-prefix"/);
  assert.match(html, /id="temp-email-subdomain-prefix-feedback"/);
  assert.match(html, /id="temp-email-effective-domain-preview"/);
  assert.match(html, /id="label-temp-email-domain"/);
  assert.match(html, /id="btn-temp-email-domain-mode"[^>]*>更新</);
  assert.doesNotMatch(html, /id="row-temp-email-random-subdomain-toggle"/);
  assert.doesNotMatch(html, /id="row-temp-email-fixed-subdomain-toggle"/);
  assert.doesNotMatch(html, /id="row-temp-email-random-subdomain-domain"/);
});

test('sidepanel modal message preserves line breaks and supports inline links', () => {
  const css = fs.readFileSync('sidepanel/sidepanel.css', 'utf8');
  assert.match(css, /\.modal-message\s*\{[\s\S]*white-space:\s*pre-line;/);
  assert.match(css, /\.modal-message a,\s*[\s\S]*\.modal-alert a/);
});

test('openCloudflareTempEmailUsageGuidePage opens the official portal home page', () => {
  const bundle = extractFunction('openCloudflareTempEmailUsageGuidePage');

  const api = new Function(`
const openedUrls = [];
function getPortalUrl() { return 'https://flowpilot.qlhazycoder.top'; }
function openExternalUrl(url) { openedUrls.push(url); }
${bundle}
return {
  openedUrls,
  openCloudflareTempEmailUsageGuidePage,
};
  `)();

  api.openCloudflareTempEmailUsageGuidePage();
  assert.deepEqual(api.openedUrls, ['https://flowpilot.qlhazycoder.top']);
});

test('openCloudflareTempEmailUsageGuidePage skips opening when the official portal URL is empty', () => {
  const bundle = extractFunction('openCloudflareTempEmailUsageGuidePage');

  const api = new Function(`
const openedUrls = [];
function getPortalUrl() { return ''; }
function openExternalUrl(url) { openedUrls.push(url); }
${bundle}
return {
  openedUrls,
  openCloudflareTempEmailUsageGuidePage,
};
  `)();

  api.openCloudflareTempEmailUsageGuidePage();
  assert.deepEqual(api.openedUrls, []);
});

test('openCloudflareTempEmailRepositoryPage opens the extension author repository', () => {
  const bundle = extractFunction('openCloudflareTempEmailRepositoryPage');

  const api = new Function(`
const calls = [];
const CLOUDFLARE_TEMP_EMAIL_REPOSITORY_URL = 'https://github.com/QLHazyCoder/cloudflare_temp_email';
function openExternalUrl(url) { calls.push(url); }
${bundle}
return {
  calls,
  openCloudflareTempEmailRepositoryPage,
};
  `)();

  api.openCloudflareTempEmailRepositoryPage();
  assert.deepEqual(api.calls, ['https://github.com/QLHazyCoder/cloudflare_temp_email']);
});

test('applyCloudflareTempEmailSettingsState restores the random subdomain toggle and temp domain list', () => {
  const bundle = extractFunction('applyCloudflareTempEmailSettingsState');

  const api = new Function(`
const inputTempEmailBaseUrl = { value: '' };
const inputTempEmailAdminAuth = { value: '' };
const inputTempEmailCustomAuth = { value: '' };
const inputTempEmailReceiveMailbox = { value: '' };
const inputTempEmailUseRandomSubdomain = { checked: false };
const inputTempEmailUseFixedSubdomain = { checked: false };
const inputTempEmailSubdomainPrefix = { value: '' };
const CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_NONE = 'none';
const CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_RANDOM = 'random';
const CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_FIXED = 'fixed';
function setCloudflareTempEmailSubdomainMode(mode) {
  inputTempEmailUseFixedSubdomain.checked = mode === CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_FIXED;
  inputTempEmailUseRandomSubdomain.checked = mode === CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_RANDOM;
}
const calls = {
  domainOptions: [],
  domainEditMode: [],
  lookupModes: [],
};
function renderCloudflareTempEmailDomainOptions(value) { calls.domainOptions.push(value); }
function setCloudflareTempEmailDomainEditMode(editing, options) { calls.domainEditMode.push({ editing, options }); }
function setCloudflareTempEmailLookupMode(value) { calls.lookupModes.push(value); }
function normalizeCloudflareTempEmailSubdomainPrefixValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) ? normalized : '';
}
${bundle}
return {
  applyCloudflareTempEmailSettingsState,
  calls,
  inputTempEmailBaseUrl,
  inputTempEmailAdminAuth,
  inputTempEmailCustomAuth,
  inputTempEmailReceiveMailbox,
  inputTempEmailUseRandomSubdomain,
  inputTempEmailUseFixedSubdomain,
  inputTempEmailSubdomainPrefix,
};
  `)();

  api.applyCloudflareTempEmailSettingsState({
    cloudflareTempEmailBaseUrl: 'https://temp.example.com',
    cloudflareTempEmailAdminAuth: 'admin-secret',
    cloudflareTempEmailCustomAuth: 'custom-secret',
    cloudflareTempEmailLookupMode: 'registration-email',
    cloudflareTempEmailReceiveMailbox: 'relay@example.com',
    cloudflareTempEmailUseRandomSubdomain: true,
    cloudflareTempEmailUseFixedSubdomain: true,
    cloudflareTempEmailSubdomainPrefix: 'Team',
    cloudflareTempEmailDomain: 'mail.example.com',
  });

  assert.equal(api.inputTempEmailBaseUrl.value, 'https://temp.example.com');
  assert.equal(api.inputTempEmailAdminAuth.value, 'admin-secret');
  assert.equal(api.inputTempEmailCustomAuth.value, 'custom-secret');
  assert.equal(api.inputTempEmailReceiveMailbox.value, 'relay@example.com');
  assert.equal(api.inputTempEmailUseRandomSubdomain.checked, false);
  assert.equal(api.inputTempEmailUseFixedSubdomain.checked, true);
  assert.equal(api.inputTempEmailSubdomainPrefix.value, 'team');
  assert.deepEqual(api.calls.lookupModes, ['registration-email']);
  assert.deepEqual(api.calls.domainOptions, ['mail.example.com']);
  assert.deepEqual(api.calls.domainEditMode, [{ editing: false, options: { clearInput: true } }]);
});

test('setCloudflareTempEmailDomainEditMode keeps the selector visible and the button in update mode', () => {
  const bundle = extractFunction('setCloudflareTempEmailDomainEditMode');

  const api = new Function(`
let cloudflareTempEmailDomainEditMode = true;
const tempEmailDomainPicker = {
  visibility: [],
  setVisible(value) {
    this.visibility.push(value);
  },
};
const inputTempEmailDomain = { value: 'old.example.com', style: { display: '' } };
const btnTempEmailDomainMode = { textContent: '' };
${bundle}
return {
  setCloudflareTempEmailDomainEditMode,
  tempEmailDomainPicker,
  inputTempEmailDomain,
  btnTempEmailDomainMode,
  getMode() {
    return cloudflareTempEmailDomainEditMode;
  },
};
  `)();

  api.setCloudflareTempEmailDomainEditMode(true, { clearInput: true });

  assert.equal(api.getMode(), false);
  assert.deepEqual(api.tempEmailDomainPicker.visibility, [true]);
  assert.equal(api.inputTempEmailDomain.style.display, 'none');
  assert.equal(api.inputTempEmailDomain.value, '');
  assert.equal(api.btnTempEmailDomainMode.textContent, '更新');
});

test('syncCloudflareTempEmailDomainsFromService merges domains from open settings and preserves the current selection', async () => {
  const bundle = [
    extractFunction('joinCloudflareTempEmailSettingsUrl'),
    extractFunction('buildCloudflareTempEmailSyncHeaders'),
    extractFunction('requestCloudflareTempEmailSyncPayload'),
    extractFunction('mergeCloudflareTempEmailDomains'),
    extractFunction('fetchCloudflareTempEmailAvailableDomains'),
    extractFunction('syncCloudflareTempEmailDomainsFromService'),
  ].join('\n');

  const api = new Function(`
const fetchCalls = [];
const saveCalls = [];
const toastCalls = [];
const btnTempEmailDomainMode = { textContent: '更新', disabled: false };
const inputTempEmailBaseUrl = { value: 'https://temp.example.com' };
const inputTempEmailCustomAuth = { value: 'custom-secret' };
const inputTempEmailAdminAuth = { value: 'admin-secret' };
const selectTempEmailDomain = { value: 'old.example.com' };
function normalizeCloudflareTempEmailBaseUrlValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^[a-zA-Z][a-zA-Z\\d+\\-.]*:\\/\\//.test(raw) ? raw : \`https://\${raw}\`;
  const parsed = new URL(candidate);
  parsed.hash = '';
  parsed.search = '';
  const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\\/+$/, '');
  return \`\${parsed.origin}\${pathname}\`;
}
function normalizeCloudflareTempEmailDomainValue(value = '') {
  let normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  normalized = normalized.replace(/^@+/, '');
  normalized = normalized.replace(/^https?:\\/\\//, '');
  normalized = normalized.replace(/\\/.*$/, '');
  return /^[a-z0-9.-]+\\.[a-z]{2,}$/i.test(normalized) ? normalized : '';
}
function normalizeCloudflareTempEmailDomains(values = []) {
  const seen = new Set();
  const domains = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeCloudflareTempEmailDomainValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push(normalized);
  }
  return domains;
}
async function fetch(url, options = {}) {
  fetchCalls.push({ url, options });
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        domains: ['new.example.com', 'old.example.com'],
      });
    },
  };
}
function getCloudflareTempEmailDomainsFromState() {
  return {
    domains: ['old.example.com', 'local-only.example.com'],
    activeDomain: 'old.example.com',
  };
}
async function saveCloudflareTempEmailDomainSettings(domains, activeDomain, options) {
  saveCalls.push({ domains, activeDomain, options });
}
function showToast(message, type, duration) {
  toastCalls.push({ message, type, duration });
}
${bundle}
return {
  syncCloudflareTempEmailDomainsFromService,
  fetchCalls,
  saveCalls,
  toastCalls,
  btnTempEmailDomainMode,
};
  `)();

  const result = await api.syncCloudflareTempEmailDomainsFromService();

  assert.equal(result.source, 'open_api/settings');
  assert.deepEqual(api.fetchCalls.map((item) => item.url), ['https://temp.example.com/open_api/settings']);
  assert.deepEqual(api.saveCalls, [{
    domains: ['new.example.com', 'old.example.com', 'local-only.example.com'],
    activeDomain: 'old.example.com',
    options: { silent: true },
  }]);
  assert.match(api.toastCalls[0].message, /新增 1 个/);
  assert.equal(api.toastCalls[0].type, 'success');
  assert.equal(api.btnTempEmailDomainMode.disabled, false);
  assert.equal(api.btnTempEmailDomainMode.textContent, '更新');
});

test('fetchCloudflareTempEmailAvailableDomains falls back to admin worker configs when open settings has no domains', async () => {
  const bundle = [
    extractFunction('joinCloudflareTempEmailSettingsUrl'),
    extractFunction('buildCloudflareTempEmailSyncHeaders'),
    extractFunction('requestCloudflareTempEmailSyncPayload'),
    extractFunction('fetchCloudflareTempEmailAvailableDomains'),
  ].join('\n');

  const api = new Function(`
const fetchCalls = [];
const inputTempEmailCustomAuth = { value: 'custom-secret' };
const inputTempEmailAdminAuth = { value: 'admin-secret' };
function normalizeCloudflareTempEmailBaseUrlValue(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^[a-zA-Z][a-zA-Z\\d+\\-.]*:\\/\\//.test(raw) ? raw : \`https://\${raw}\`;
  const parsed = new URL(candidate);
  parsed.hash = '';
  parsed.search = '';
  const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\\/+$/, '');
  return \`\${parsed.origin}\${pathname}\`;
}
function normalizeCloudflareTempEmailDomainValue(value = '') {
  let normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  normalized = normalized.replace(/^@+/, '');
  normalized = normalized.replace(/^https?:\\/\\//, '');
  normalized = normalized.replace(/\\/.*$/, '');
  return /^[a-z0-9.-]+\\.[a-z]{2,}$/i.test(normalized) ? normalized : '';
}
function normalizeCloudflareTempEmailDomains(values = []) {
  const seen = new Set();
  const domains = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeCloudflareTempEmailDomainValue(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    domains.push(normalized);
  }
  return domains;
}
async function fetch(url, options = {}) {
  fetchCalls.push({ url, options });
  if (url.endsWith('/open_api/settings')) {
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ domains: [] });
      },
    };
  }
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ DOMAINS: ['admin.example.com'] });
    },
  };
}
${bundle}
return {
  fetchCloudflareTempEmailAvailableDomains,
  fetchCalls,
};
  `)();

  const result = await api.fetchCloudflareTempEmailAvailableDomains('https://temp.example.com');

  assert.equal(result.source, 'admin/worker/configs');
  assert.deepEqual(result.domains, ['admin.example.com']);
  assert.deepEqual(api.fetchCalls.map((item) => item.url), [
    'https://temp.example.com/open_api/settings',
    'https://temp.example.com/admin/worker/configs',
  ]);
  assert.equal(api.fetchCalls[1].options.headers['x-admin-auth'], 'admin-secret');
});

test('updateMailProviderUI keeps the temp domain selector visible and updates the hint when random subdomain is enabled', () => {
  const bundle = extractFunction('updateMailProviderUI');

  const api = new Function('normalizeIcloudTargetMailboxType', 'normalizeIcloudForwardMailProvider', `
let latestState = {
  cloudflareTempEmailDomains: ['mail.example.com'],
};
let cloudflareTempEmailDomainEditMode = false;
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_LOOKUP_MODE_REGISTRATION_EMAIL = 'registration-email';
const rowMail2925Mode = ${JSON.stringify(createRow('none'))};
const rowMail2925PoolSettings = ${JSON.stringify(createRow('none'))};
const rowEmailPrefix = ${JSON.stringify(createRow('none'))};
const rowInbucketHost = ${JSON.stringify(createRow('none'))};
const rowInbucketMailbox = ${JSON.stringify(createRow('none'))};
const rowEmailGenerator = ${JSON.stringify(createRow(''))};
const rowCfDomain = ${JSON.stringify(createRow('none'))};
const rowTempEmailBaseUrl = ${JSON.stringify(createRow('none'))};
const rowTempEmailAdminAuth = ${JSON.stringify(createRow('none'))};
const rowTempEmailCustomAuth = ${JSON.stringify(createRow('none'))};
const rowTempEmailLookupMode = ${JSON.stringify(createRow('none'))};
const rowTempEmailReceiveMailbox = ${JSON.stringify(createRow('none'))};
const rowTempEmailSubdomainMode = ${JSON.stringify(createRow('none'))};
function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) {
          values.delete(name);
          return false;
        }
        values.add(name);
        return true;
      }
      if (force) {
        values.add(name);
        return true;
      }
      values.delete(name);
      return false;
    },
    contains(name) {
      return values.has(name);
    },
  };
}
const tempEmailSubdomainModeButtons = [
  {
    dataset: { tempEmailSubdomainMode: 'none' },
    attributes: {},
    classList: createClassList(['is-active']),
    setAttribute(name, value) { this.attributes[name] = String(value); },
  },
  {
    dataset: { tempEmailSubdomainMode: 'random' },
    attributes: {},
    classList: createClassList(),
    setAttribute(name, value) { this.attributes[name] = String(value); },
  },
  {
    dataset: { tempEmailSubdomainMode: 'fixed' },
    attributes: {},
    classList: createClassList(),
    setAttribute(name, value) { this.attributes[name] = String(value); },
  },
];
const tempEmailSubdomainModeCaption = { textContent: '' };
const rowTempEmailFixedSubdomainPrefix = ${JSON.stringify(createRow('none'))};
const rowTempEmailDomain = ${JSON.stringify(createRow('none'))};
const labelTempEmailDomain = { textContent: '' };
const cloudflareTempEmailSection = ${JSON.stringify(createRow('none'))};
const hotmailSection = ${JSON.stringify(createRow('none'))};
const mail2925Section = ${JSON.stringify(createRow('none'))};
const luckmailSection = ${JSON.stringify(createRow('none'))};
const icloudSection = ${JSON.stringify(createRow('none'))};
const labelEmailPrefix = { textContent: '' };
const inputEmailPrefix = { placeholder: '', style: { display: '' }, readOnly: false };
const labelMail2925UseAccountPool = ${JSON.stringify(createRow('none'))};
const selectMail2925PoolAccount = { style: { display: 'none' }, disabled: false };
const btnFetchEmail = { hidden: false, disabled: false, textContent: '' };
const btnMailLogin = { disabled: false, textContent: '', title: '' };
const inputEmail = { readOnly: false, placeholder: '', value: '' };
const autoHintText = { textContent: '' };
const rowHotmailServiceMode = ${JSON.stringify(createRow('none'))};
const rowHotmailRemoteBaseUrl = ${JSON.stringify(createRow('none'))};
const rowHotmailLocalBaseUrl = ${JSON.stringify(createRow('none'))};
const inputMail2925UseAccountPool = { checked: false };
const selectMailProvider = { value: '163' };
const selectEmailGenerator = { value: 'cloudflare-temp-email', disabled: false };
const selectTempEmailDomain = { value: 'mail.example.com' };
const inputTempEmailUseRandomSubdomain = { checked: false };
const inputTempEmailUseFixedSubdomain = { checked: false };
const inputTempEmailSubdomainPrefix = {
  value: 'team',
  attributes: {},
  classList: createClassList(),
  setAttribute(name, value) { this.attributes[name] = String(value); },
};
const tempEmailSubdomainPrefixFeedback = { textContent: '', classList: createClassList() };
const tempEmailEffectiveDomainPreview = { textContent: '' };
const CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_NONE = 'none';
const CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_RANDOM = 'random';
const CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE_FIXED = 'fixed';
const DEFAULT_CLOUDFLARE_TEMP_EMAIL_SUBDOMAIN_MODE = 'none';
const calls = {
  tempDomainEditMode: [],
};
function isLuckmailProvider() { return false; }
function isCustomMailProvider() { return false; }
function isIcloudMailProvider() { return false; }
function usesGeneratedAliasMailProvider() { return false; }
function getSelectedMail2925Mode() { return 'provide'; }
let selectedCloudflareTempEmailLookupMode = 'receive-mailbox';
function getSelectedCloudflareTempEmailLookupMode() { return selectedCloudflareTempEmailLookupMode; }
function normalizeCloudflareTempEmailSubdomainMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['random', 'fixed'].includes(normalized) ? normalized : 'none';
}
function syncCloudflareTempEmailSubdomainModeButtons(mode) {
  const resolvedMode = normalizeCloudflareTempEmailSubdomainMode(mode);
  tempEmailSubdomainModeButtons.forEach((button) => {
    const active = button.dataset.tempEmailSubdomainMode === resolvedMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function getSelectedCloudflareTempEmailSubdomainMode() {
  if (inputTempEmailUseFixedSubdomain.checked) return 'fixed';
  if (inputTempEmailUseRandomSubdomain.checked) return 'random';
  return 'none';
}
function getCloudflareTempEmailSubdomainPrefixValidation(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return { raw, normalized: '', valid: false, message: '请填写子域前缀' };
  const normalized = normalizeCloudflareTempEmailSubdomainPrefixValue(raw);
  return normalized
    ? { raw, normalized, valid: true, message: '' }
    : { raw, normalized: '', valid: false, message: '仅支持 1-63 位字母、数字或中划线，且不能以中划线开头或结尾' };
}
function getManagedAliasProviderUiCopy() { return null; }
function getCurrentRegistrationEmailUiCopy() {
  return {
    buttonLabel: '生成 Temp',
    placeholder: '点击生成 Cloudflare Temp Email，或手动粘贴邮箱',
    label: 'Cloudflare Temp Email',
  };
}
function updateMailLoginButtonState() {}
function getSelectedHotmailServiceMode() { return 'local'; }
function getCloudflareDomainsFromState() { return { domains: [], activeDomain: '' }; }
function setCloudflareDomainEditMode() {}
function getCloudflareTempEmailDomainsFromState() { return { domains: ['mail.example.com'], activeDomain: 'mail.example.com' }; }
function normalizeCloudflareTempEmailDomainValue(value = '') { return String(value || '').trim().toLowerCase(); }
function normalizeCloudflareTempEmailSubdomainPrefixValue(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) ? normalized : '';
}
function buildCloudflareTempEmailEffectiveDomainValue(domain = '', subdomainPrefix = '', options = {}) {
  const normalizedDomain = normalizeCloudflareTempEmailDomainValue(domain);
  const normalizedPrefix = normalizeCloudflareTempEmailSubdomainPrefixValue(subdomainPrefix);
  if (options.requirePrefix && !normalizedPrefix) return '';
  return normalizedPrefix ? \`\${normalizedPrefix}.\${normalizedDomain}\` : normalizedDomain;
}
function setCloudflareTempEmailDomainEditMode(editing) { calls.tempDomainEditMode.push(editing); }
function queueIcloudAliasRefresh() {}
function hideIcloudLoginHelp() {}
function syncMail2925PoolAccountOptions() {}
function getMail2925Accounts() { return []; }
function renderHotmailAccounts() {}
function renderMail2925Accounts() {}
function renderLuckmailPurchases() {}
function getSelectedEmailGenerator() { return String(selectEmailGenerator.value || '').trim().toLowerCase(); }
function isAutoRunLockedPhase() { return false; }
${bundle}
return {
  updateMailProviderUI,
  cloudflareTempEmailSection,
  rowTempEmailLookupMode,
  rowTempEmailReceiveMailbox,
  rowTempEmailSubdomainMode,
  rowTempEmailFixedSubdomainPrefix,
  rowTempEmailDomain,
  labelTempEmailDomain,
  inputTempEmailUseRandomSubdomain,
  inputTempEmailUseFixedSubdomain,
  inputTempEmailSubdomainPrefix,
  tempEmailSubdomainModeCaption,
  tempEmailSubdomainPrefixFeedback,
  tempEmailEffectiveDomainPreview,
  btnFetchEmail,
  selectMailProvider,
  selectEmailGenerator,
  setLookupMode(value) {
    selectedCloudflareTempEmailLookupMode = value;
  },
  autoHintText,
  calls,
};
  `)(normalizeIcloudTargetMailboxType, normalizeIcloudForwardMailProvider);

  api.updateMailProviderUI();
  assert.equal(api.cloudflareTempEmailSection.style.display, '');
  assert.equal(api.rowTempEmailSubdomainMode.style.display, '');
  assert.equal(api.rowTempEmailFixedSubdomainPrefix.style.display, 'none');
  assert.equal(api.rowTempEmailDomain.style.display, '');
  assert.equal(api.labelTempEmailDomain.textContent, 'Temp 域名');

  api.selectMailProvider.value = 'cloudflare-temp-email';
  api.selectEmailGenerator.value = 'duck';
  api.setLookupMode('receive-mailbox');
  api.updateMailProviderUI();
  assert.equal(api.rowTempEmailLookupMode.style.display, '');
  assert.equal(api.rowTempEmailReceiveMailbox.style.display, '');

  api.setLookupMode('registration-email');
  api.updateMailProviderUI();
  assert.equal(api.rowTempEmailLookupMode.style.display, '');
  assert.equal(api.rowTempEmailReceiveMailbox.style.display, 'none');

  api.selectMailProvider.value = '163';
  api.selectEmailGenerator.value = 'cloudflare-temp-email';
  api.inputTempEmailUseRandomSubdomain.checked = true;
  api.updateMailProviderUI();
  assert.equal(api.cloudflareTempEmailSection.style.display, '');
  assert.equal(api.rowTempEmailDomain.style.display, '');
  assert.match(api.autoHintText.textContent, /RANDOM_SUBDOMAIN_DOMAINS/);
  assert.match(api.autoHintText.textContent, /Email Routing\/MX/);
  assert.match(api.tempEmailSubdomainModeCaption.textContent, /随机子域/);

  api.inputTempEmailUseRandomSubdomain.checked = false;
  api.inputTempEmailUseFixedSubdomain.checked = true;
  api.inputTempEmailSubdomainPrefix.value = 'team';
  api.updateMailProviderUI();
  assert.equal(api.rowTempEmailFixedSubdomainPrefix.style.display, '');
  assert.equal(api.labelTempEmailDomain.textContent, '基础域名');
  assert.equal(api.tempEmailEffectiveDomainPreview.textContent, '最终域名：team.mail.example.com');
  assert.equal(api.tempEmailSubdomainPrefixFeedback.textContent, '');
  assert.equal(api.inputTempEmailSubdomainPrefix.attributes['aria-invalid'], 'false');
  assert.equal(api.btnFetchEmail.disabled, false);
  assert.match(api.autoHintText.textContent, /team\.mail\.example\.com/);
  assert.match(api.autoHintText.textContent, /ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH/);
  assert.match(api.autoHintText.textContent, /Email Routing\/MX/);

  api.inputTempEmailSubdomainPrefix.value = '';
  api.updateMailProviderUI();
  assert.equal(api.btnFetchEmail.disabled, true);
  assert.equal(api.tempEmailEffectiveDomainPreview.textContent, '');
  assert.equal(api.tempEmailSubdomainPrefixFeedback.textContent, '请填写子域前缀');
  assert.equal(api.tempEmailSubdomainPrefixFeedback.classList.contains('is-error'), true);
  assert.equal(api.inputTempEmailSubdomainPrefix.attributes['aria-invalid'], 'true');
  assert.match(api.autoHintText.textContent, /请填写子域前缀/);
});
