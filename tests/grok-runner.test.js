const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGrokRunner() {
  const scope = { console };
  scope.self = scope;
  scope.globalThis = scope;
  vm.runInNewContext(fs.readFileSync('flows/grok/background/register-runner.js', 'utf8'), scope);
  return scope.MultiPageBackgroundGrokRegisterRunner;
}

function loadGrokState() {
  const scope = {};
  scope.self = scope;
  scope.globalThis = scope;
  vm.runInNewContext(fs.readFileSync('flows/grok/background/state.js', 'utf8'), scope);
  return scope.MultiPageBackgroundGrokState;
}

test('Grok runner accumulates SSO cookies without logging values', async () => {
  const api = loadGrokRunner();
  const logs = [];
  const state = {
    grokRegisterTabId: 12,
    grokSsoCookies: ['existing-sso'],
  };
  const completed = [];
  const runner = api.createGrokRegisterRunner({
    addLog: async (message, level, nodeId) => logs.push({ message, level, nodeId }),
    chrome: {
      cookies: {
        get: async ({ url, name }) => (url === 'https://x.ai/' && name === 'sso'
          ? { value: 'new-sso' }
          : null),
      },
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async (nodeId, patch) => completed.push({ nodeId, patch }),
    getState: async () => state,
    getTabId: async () => state.grokRegisterTabId,
    registerTab: async () => {},
    setState: async (patch) => Object.assign(state, patch),
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokExtractSsoCookie({ nodeId: 'grok-extract-sso-cookie' });

  assert.equal(state.grokSsoCookie, 'new-sso');
  assert.deepEqual([...state.grokSsoCookies], ['existing-sso', 'new-sso']);
  assert.deepEqual([...completed[0].patch.grokSsoCookies], ['existing-sso', 'new-sso']);
  assert.equal(logs.some((entry) => String(entry.message).includes('new-sso')), false);
});

test('Grok runner keeps duplicate SSO cookies unique', async () => {
  const api = loadGrokRunner();
  const state = {
    grokRegisterTabId: 12,
    grokSsoCookies: ['same-sso'],
  };
  const runner = api.createGrokRegisterRunner({
    addLog: async () => {},
    chrome: {
      cookies: {
        get: async () => ({ value: 'same-sso' }),
      },
      tabs: {
        get: async (tabId) => ({ id: tabId }),
        update: async () => {},
      },
    },
    completeNodeFromBackground: async () => {},
    getState: async () => state,
    getTabId: async () => state.grokRegisterTabId,
    registerTab: async () => {},
    setState: async (patch) => Object.assign(state, patch),
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
    waitForTabStableComplete: async () => {},
  });

  await runner.executeGrokExtractSsoCookie({ nodeId: 'grok-extract-sso-cookie' });

  assert.equal(state.grokSsoCookie, 'same-sso');
  assert.deepEqual([...state.grokSsoCookies], ['same-sso']);
});

test('Grok state helper preserves only Grok SSO keys across fresh attempts', () => {
  const api = loadGrokState();

  const keepState = api.buildFreshKeepState({
    grokSsoCookie: ' primary ',
    grokSsoCookies: ['primary', '', ' secondary ', 'secondary'],
    openAiAccessToken: 'must-not-preserve',
    email: 'user@example.com',
  });

  assert.deepEqual(JSON.parse(JSON.stringify(keepState)), {
    grokSsoCookie: 'primary',
    grokSsoCookies: ['primary', 'secondary'],
  });
});

test('background fresh attempt delegates Grok SSO preservation to Grok state helper', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /flows\/grok\/background\/state\.js/);
  assert.match(source, /const grokStateHelpers = self\.MultiPageBackgroundGrokState \|\| null;/);
  assert.match(source, /grokStateHelpers\?\.buildFreshKeepState/);
  assert.doesNotMatch(source, /sourceState\.grokSsoCookies\s*\)/);
  assert.doesNotMatch(source, /openAiAccessToken|openaiAccessToken|accessToken.*fresh/i);
});
