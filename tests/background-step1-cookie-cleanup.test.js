const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadStep1Module() {
  const source = fs.readFileSync('flows/openai/background/steps/open-chatgpt.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundStep1;`)(globalScope);
}

test('step 1 cookie cleanup queries target domains and skips browsingData sweep when direct removals succeed', async () => {
  const api = loadStep1Module();
  const events = {
    getAllCalls: [],
    removedCookies: [],
    browsingDataCalls: [],
    openedSteps: [],
    completedNodes: [],
  };

  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async (query) => {
        events.getAllCalls.push(query);
        if (query?.domain === 'chatgpt.com') {
          return [
            { domain: '.chatgpt.com', path: '/', name: 'session', storeId: 'store-a' },
          ];
        }
        if (query?.domain === 'openai.com') {
          return [
            {
              domain: '.openai.com',
              path: '/',
              name: 'shared',
              storeId: 'store-a',
              partitionKey: { topLevelSite: 'https://chatgpt.com' },
            },
          ];
        }
        return [];
      },
      remove: async (details) => {
        events.removedCookies.push(details);
        return details;
      },
    },
    browsingData: {
      removeCookies: async (details) => {
        events.browsingDataCalls.push(details);
      },
    },
  };

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: chromeApi,
    openSignupEntryTab: async (step) => {
      events.openedSteps.push(step);
      return 101;
    },
    waitForTabStableComplete: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/' }),
    completeNodeFromBackground: async (nodeId) => {
      events.completedNodes.push(nodeId);
    },
  });

  await executor.executeStep1();

  assert.ok(events.getAllCalls.length > 0, 'should query cookies at least once');
  assert.ok(events.getAllCalls.every((entry) => typeof entry?.domain === 'string' && entry.domain.length > 0));
  assert.deepStrictEqual(events.removedCookies, [
    {
      url: 'https://chatgpt.com/',
      name: 'session',
      storeId: 'store-a',
    },
    {
      url: 'https://openai.com/',
      name: 'shared',
      storeId: 'store-a',
      partitionKey: { topLevelSite: 'https://chatgpt.com' },
    },
  ]);
  assert.deepStrictEqual(events.browsingDataCalls, []);
  assert.deepStrictEqual(events.openedSteps, [1]);
  assert.deepStrictEqual(events.completedNodes, ['open-chatgpt']);
});

test('step 1 cookie cleanup skips browsingData sweep when no direct cookie is removed', async () => {
  const api = loadStep1Module();
  const events = {
    removedCookies: 0,
    browsingDataCalls: [],
  };

  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async () => [],
      remove: async () => {
        events.removedCookies += 1;
        return null;
      },
    },
    browsingData: {
      removeCookies: async (details) => {
        events.browsingDataCalls.push(details);
      },
    },
  };

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: chromeApi,
    openSignupEntryTab: async () => 202,
    waitForTabStableComplete: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/' }),
    completeNodeFromBackground: async () => {},
  });

  await executor.executeStep1();

  assert.equal(events.removedCookies, 0);
  assert.equal(events.browsingDataCalls.length, 0);
});

test('step 1 retries after auth login landing and re-clears cookies before reopening chatgpt home', async () => {
  const api = loadStep1Module();
  const events = {
    logs: [],
    getAllCalls: [],
    removedCookies: [],
    openCalls: 0,
    completedNodes: [],
    stableWaits: [],
  };

  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async (query) => {
        events.getAllCalls.push(query);
        return [
          { domain: '.chatgpt.com', path: '/', name: `session-${events.getAllCalls.length}`, storeId: 'store-a' },
        ];
      },
      remove: async (details) => {
        events.removedCookies.push(details);
        return details;
      },
    },
    tabs: {
      get: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/' }),
    },
  };

  const landingUrls = [
    'https://chatgpt.com/auth/login',
    'https://chatgpt.com/',
  ];
  const executor = api.createStep1Executor({
    addLog: async (message, level = 'info') => {
      events.logs.push({ message, level });
    },
    chrome: chromeApi,
    openSignupEntryTab: async () => {
      events.openCalls += 1;
      return 300 + events.openCalls;
    },
    waitForTabStableComplete: async (tabId) => {
      events.stableWaits.push(tabId);
      return { id: tabId, url: landingUrls[Math.min(events.stableWaits.length - 1, landingUrls.length - 1)] };
    },
    completeNodeFromBackground: async (nodeId) => {
      events.completedNodes.push(nodeId);
    },
  });

  await executor.executeStep1();

  assert.equal(events.openCalls, 2);
  assert.equal(events.stableWaits.length, 2);
  assert.ok(events.getAllCalls.length >= 12);
  assert.ok(events.removedCookies.length >= 2);
  assert.equal(events.completedNodes.length, 1);
  assert.equal(
    events.logs.some((entry) => /最终 URL 异常/.test(entry.message) && /https:\/\/chatgpt\.com\/auth\/login/.test(entry.message)),
    true
  );
});

test('step 1 fails after repeated auth login landings', async () => {
  const api = loadStep1Module();
  let openCalls = 0;
  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async () => [{ domain: '.chatgpt.com', path: '/', name: 'session', storeId: 'store-a' }],
      remove: async (details) => details,
    },
    tabs: {
      get: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/auth/login' }),
    },
  };

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: chromeApi,
    openSignupEntryTab: async () => {
      openCalls += 1;
      return 400 + openCalls;
    },
    waitForTabStableComplete: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/auth/login' }),
    completeNodeFromBackground: async () => {},
  });

  await assert.rejects(
    () => executor.executeStep1(),
    /最终 URL 异常：https:\/\/chatgpt\.com\/auth\/login，预期为 https:\/\/chatgpt\.com\//
  );

  assert.equal(openCalls, 3);
});

test('step 1 completes on the expected root url without probing the signup button state', async () => {
  const api = loadStep1Module();
  let openCalls = 0;
  const chromeApi = {
    cookies: {
      getAllCookieStores: async () => [{ id: 'store-a' }],
      getAll: async () => [{ domain: '.chatgpt.com', path: '/', name: 'session', storeId: 'store-a' }],
      remove: async (details) => details,
    },
  };

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: chromeApi,
    openSignupEntryTab: async () => {
      openCalls += 1;
      return 500 + openCalls;
    },
    waitForTabStableComplete: async (tabId) => ({ id: tabId, url: 'https://chatgpt.com/' }),
    completeNodeFromBackground: async () => {},
  });

  await executor.executeStep1();

  assert.equal(openCalls, 1);
});

test('step 1 retries when the tab does not land on the expected root url', async () => {
  const api = loadStep1Module();
  let openCalls = 0;
  const urls = [
    'https://chatgpt.com/auth/login',
    'https://chatgpt.com/somewhere-else',
    'https://chatgpt.com/',
  ];

  const executor = api.createStep1Executor({
    addLog: async () => {},
    chrome: {
      cookies: {
        getAllCookieStores: async () => [{ id: 'store-a' }],
        getAll: async () => [],
        remove: async () => null,
      },
    },
    openSignupEntryTab: async () => {
      openCalls += 1;
      return 600 + openCalls;
    },
    waitForTabStableComplete: async () => ({ url: urls[openCalls - 1], status: 'complete' }),
    completeNodeFromBackground: async () => {},
  });

  await executor.executeStep1();

  assert.equal(openCalls, 3);
});
