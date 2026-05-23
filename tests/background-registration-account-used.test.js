const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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

test('markCurrentRegistrationAccountUsed uses fresh state when checkout passes stale state', async () => {
  const bundle = extractFunction('markCurrentRegistrationAccountUsed');
  const factory = new Function(`
const patchCalls = [];
const logs = [];
async function getState() {
  return {
    mailProvider: 'hotmail',
    currentHotmailAccountId: 'hot-1',
    email: 'fresh@example.com',
  };
}
function isHotmailProvider(state) {
  return String(state.mailProvider || '').toLowerCase() === 'hotmail';
}
function isLuckmailProvider() {
  return false;
}
function getCurrentLuckmailPurchase() {
  return null;
}
async function patchHotmailAccount(id, updates) {
  patchCalls.push({ id, updates });
}
async function setLuckmailPurchaseUsedState() {}
async function clearLuckmailRuntimeState() {}
async function patchMail2925Account() {}
async function finalizeIcloudAliasAfterSuccessfulFlow() {
  return { handled: false };
}
async function markCurrentCustomEmailPoolEntryUsed() {
  return { updated: false };
}
async function addLog(message, level) {
  logs.push({ message, level });
}

${bundle}

return { markCurrentRegistrationAccountUsed, patchCalls, logs };
`);
  const api = factory();

  const result = await api.markCurrentRegistrationAccountUsed({ email: 'stale@example.com' }, {
    logPrefix: 'Plus Checkout：当前账号没有免费试用资格',
  });

  assert.equal(result.updated, true);
  assert.equal(api.patchCalls.length, 1);
  assert.equal(api.patchCalls[0].id, 'hot-1');
  assert.equal(api.patchCalls[0].updates.used, true);
  assert.equal(api.logs.some((entry) => /Hotmail 账号已标记为已用/.test(entry.message)), true);
});

test('markCurrentRegistrationAccountUsed removes successful custom mail provider pool email', async () => {
  const bundle = extractFunction('markCurrentRegistrationAccountUsed');
  const factory = new Function(`
const removedCalls = [];
const logs = [];
async function getState() {
  return {
    mailProvider: 'custom',
    email: 'first@example.com',
    customMailProviderPool: ['first@example.com', 'second@example.com'],
  };
}
function isHotmailProvider() {
  return false;
}
function isLuckmailProvider() {
  return false;
}
function getCurrentLuckmailPurchase() {
  return null;
}
async function patchHotmailAccount() {}
async function setLuckmailPurchaseUsedState() {}
async function clearLuckmailRuntimeState() {}
async function patchMail2925Account() {}
async function finalizeIcloudAliasAfterSuccessfulFlow() {
  return { handled: false };
}
async function markCurrentCustomEmailPoolEntryUsed() {
  return { updated: false };
}
async function removeCurrentCustomMailProviderPoolEmail(state, options) {
  removedCalls.push({ state, options });
  return { updated: true, customMailProviderPool: ['second@example.com'] };
}
async function addLog(message, level) {
  logs.push({ message, level });
}

${bundle}

return { markCurrentRegistrationAccountUsed, removedCalls, logs };
`);
  const api = factory();

  const result = await api.markCurrentRegistrationAccountUsed({ email: 'stale@example.com' }, {
    logPrefix: '流程完成',
    level: 'ok',
  });

  assert.equal(result.updated, true);
  assert.equal(api.removedCalls.length, 1);
  assert.equal(api.removedCalls[0].state.email, 'first@example.com');
  assert.deepEqual(api.removedCalls[0].state.customMailProviderPool, ['first@example.com', 'second@example.com']);
  assert.equal(api.removedCalls[0].options.logPrefix, '流程完成：自定义邮箱号池');
  assert.equal(api.removedCalls[0].options.level, 'ok');
});
