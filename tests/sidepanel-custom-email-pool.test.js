const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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

test('sidepanel html exposes custom email pool generator option and input row', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

  assert.match(html, /option value="custom-pool">自定义邮箱池<\/option>/);
  assert.match(html, /id="row-custom-email-pool"/);
  assert.match(html, /id="input-custom-email-pool"/);
  assert.match(html, /id="input-custom-email-pool-import"/);
  assert.match(html, /id="custom-email-pool-list"/);
  assert.match(html, /id="btn-custom-email-pool-bulk-used"/);
  assert.match(html, /id="row-custom-mail-provider-pool"/);
  assert.match(html, /id="input-custom-mail-provider-pool"/);
});

test('sidepanel locks run count to custom email pool size', () => {
  const bundle = [
    extractFunction('isCustomMailProvider'),
    extractFunction('normalizeCustomEmailPoolEntries'),
    extractFunction('getSelectedEmailGenerator'),
    extractFunction('usesGeneratedAliasMailProvider'),
    extractFunction('usesCustomEmailPoolGenerator'),
    extractFunction('getCustomMailProviderPoolSize'),
    extractFunction('usesCustomMailProviderPool'),
    extractFunction('getLockedRunCountFromEmailPool'),
    extractFunction('getCustomEmailPoolSize'),
    extractFunction('getRunCountValue'),
  ].join('\n');

  const api = new Function(`
const GMAIL_PROVIDER = 'gmail';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const selectMailProvider = { value: 'gmail' };
const selectEmailGenerator = { value: 'custom-pool' };
const inputCustomEmailPool = { value: 'first@example.com\\nsecond@example.com' };
const inputRunCount = { value: '99' };

function isLuckmailProvider() {
  return false;
}

function isManagedAliasProvider() {
  return false;
}

function getSelectedMail2925Mode() {
  return 'provide';
}

function isManagedAliasProvider(provider) {
  return String(provider || '').trim().toLowerCase() === GMAIL_PROVIDER;
}

${bundle}

return {
  getSelectedEmailGenerator,
  usesGeneratedAliasMailProvider,
  usesCustomEmailPoolGenerator,
  getCustomEmailPoolSize,
  getRunCountValue,
};
`)();

  assert.equal(api.getSelectedEmailGenerator(), 'custom-pool');
  assert.equal(api.usesGeneratedAliasMailProvider('gmail', 'provide', 'gmail-alias'), true);
  assert.equal(api.usesGeneratedAliasMailProvider('gmail', 'provide', 'custom-pool'), false);
  assert.equal(api.usesCustomEmailPoolGenerator(), true);
  assert.equal(api.getCustomEmailPoolSize(), 2);
  assert.equal(api.getRunCountValue(), 2);
});

test('sidepanel locks run count to custom mail provider pool size', () => {
  const bundle = [
    extractFunction('isCustomMailProvider'),
    extractFunction('normalizeCustomEmailPoolEntries'),
    extractFunction('getSelectedEmailGenerator'),
    extractFunction('usesGeneratedAliasMailProvider'),
    extractFunction('usesCustomEmailPoolGenerator'),
    extractFunction('getCustomMailProviderPoolSize'),
    extractFunction('usesCustomMailProviderPool'),
    extractFunction('getLockedRunCountFromEmailPool'),
    extractFunction('getCustomEmailPoolSize'),
    extractFunction('getRunCountValue'),
  ].join('\n');

  const api = new Function(`
const GMAIL_PROVIDER = 'gmail';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const selectMailProvider = { value: 'custom' };
const selectEmailGenerator = { value: 'duck' };
const inputCustomMailProviderPool = { value: 'first@example.com\\nsecond@example.com\\nthird@example.com' };
const inputCustomEmailPool = { value: '' };
const inputRunCount = { value: '99' };

function isLuckmailProvider() {
  return false;
}

function isManagedAliasProvider() {
  return false;
}

function getSelectedMail2925Mode() {
  return 'provide';
}

function isManagedAliasProvider(provider) {
  return String(provider || '').trim().toLowerCase() === GMAIL_PROVIDER;
}

${bundle}

return {
  usesCustomMailProviderPool,
  getCustomMailProviderPoolSize,
  getLockedRunCountFromEmailPool,
  getRunCountValue,
};
`)();

  assert.equal(api.usesCustomMailProviderPool(), true);
  assert.equal(api.getCustomMailProviderPoolSize(), 3);
  assert.equal(api.getLockedRunCountFromEmailPool(), 3);
  assert.equal(api.getRunCountValue(), 3);
});

test('sidepanel queues custom email pool refresh when the pool row is visible', () => {
  const source = extractFunction('updateMailProviderUI');

  assert.match(
    source,
    /if \(useCustomEmailPool\) \{\s*syncRunCountFromCustomEmailPool\(\);\s*if \(typeof queueCustomEmailPoolRefresh === 'function'\) \{\s*queueCustomEmailPoolRefresh\(\);\s*\}\s*\}/
  );
});

test('sidepanel syncs custom mail provider pool from background data updates', () => {
  assert.match(
    source,
    /message\.payload\.customMailProviderPool !== undefined[\s\S]*inputCustomMailProviderPool\.value = normalizeCustomEmailPoolEntries\(message\.payload\.customMailProviderPool\)\.join\('\\n'\)/
  );
});

test('sidepanel syncs current registration email from background data updates', () => {
  assert.match(
    source,
    /message\.payload\.email !== undefined && inputEmail[\s\S]*inputEmail\.value = message\.payload\.email \|\| ''/
  );
});

test('sidepanel custom verification dialog exposes add-phone action for step 8', async () => {
  const bundle = [
    extractFunction('getCustomVerificationPromptCopy'),
    extractFunction('openCustomVerificationConfirmDialog'),
  ].join('\n');

  const api = new Function(`
let openActionModalPayload = null;

async function openActionModal(options) {
  openActionModalPayload = options;
  return options.buildResult('add_phone');
}

async function openConfirmModal() {
  throw new Error('step 8 should use action modal');
}

${bundle}

return {
  getCustomVerificationPromptCopy,
  openCustomVerificationConfirmDialog,
  getOpenActionModalPayload: () => openActionModalPayload,
};
`)();

  const prompt = api.getCustomVerificationPromptCopy(8);
  assert.equal(prompt.phoneActionLabel, '出现手机号验证');

  const result = await api.openCustomVerificationConfirmDialog(8);
  assert.deepEqual(result, {
    confirmed: false,
    addPhoneDetected: true,
  });

  const modalPayload = api.getOpenActionModalPayload();
  assert.equal(modalPayload.actions.length, 3);
  assert.equal(modalPayload.actions[1].id, 'add_phone');
  assert.equal(modalPayload.actions[1].label, '出现手机号验证');
});

test('sidepanel custom verification dialog exposes add-phone action for Plus login code step', async () => {
  const bundle = [
    extractFunction('getCustomVerificationPromptCopy'),
    extractFunction('openCustomVerificationConfirmDialog'),
  ].join('\n');

  const api = new Function(`
let openActionModalPayload = null;

async function openActionModal(options) {
  openActionModalPayload = options;
  return options.buildResult('add_phone');
}

async function openConfirmModal() {
  throw new Error('Plus login code step should use action modal');
}

${bundle}

return {
  getCustomVerificationPromptCopy,
  openCustomVerificationConfirmDialog,
  getOpenActionModalPayload: () => openActionModalPayload,
};
`)();

  const prompt = api.getCustomVerificationPromptCopy(11);
  assert.equal(prompt.phoneActionLabel, '出现手机号验证');

  const result = await api.openCustomVerificationConfirmDialog(11);
  assert.deepEqual(result, {
    confirmed: false,
    addPhoneDetected: true,
  });

  const modalPayload = api.getOpenActionModalPayload();
  assert.equal(modalPayload.actions[1].id, 'add_phone');
});
