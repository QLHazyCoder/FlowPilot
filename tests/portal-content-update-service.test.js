const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/portal-content-update-service.js', 'utf8');

function createPortalContentService(options = {}) {
  const cache = new Map();
  const windowObject = {};
  let fetchCalls = 0;
  const fetchUrls = [];

  const localStorage = {
    getItem(key) {
      return cache.has(key) ? cache.get(key) : null;
    },
    setItem(key, value) {
      cache.set(key, String(value));
    },
    removeItem(key) {
      cache.delete(key);
    },
  };

  if (options.cachedSnapshot) {
    cache.set(
      options.cacheKey || 'multipage-portal-content-summary-v2:openai:cpa',
      JSON.stringify(options.cachedSnapshot)
    );
  }

  const fetchImpl = options.fetchImpl || (async () => ({
    ok: true,
    async json() {
      return {
        ok: true,
        items: [],
        prompt_version: '',
        has_visible_updates: false,
        latest_updated_at: '',
        latest_updated_at_display: '',
      };
    },
  }));

  const wrappedFetch = async (...args) => {
    fetchCalls += 1;
    fetchUrls.push(String(args[0] || ''));
    return fetchImpl(...args);
  };

  const api = new Function(
    'window',
    'localStorage',
    'fetch',
    'AbortController',
    'setTimeout',
    'clearTimeout',
    `${source}; return window.SidepanelPortalContentService;`
  )(
    windowObject,
    localStorage,
    wrappedFetch,
    AbortController,
    setTimeout,
    clearTimeout
  );

  return {
    api,
    getFetchCalls() {
      return fetchCalls;
    },
    getFetchUrls() {
      return fetchUrls.slice();
    },
  };
}

test('getContentUpdateSnapshot returns a prompt version for visible portal content updates', async () => {
  const { api, getFetchUrls } = createPortalContentService({
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          ok: true,
          prompt_version: 'auto_run_notice:2026-04-21T12:05:00Z',
          has_visible_updates: true,
          latest_updated_at: '2026-04-21T12:05:00Z',
          latest_updated_at_display: '2026-04-21 20:05',
          items: [
            {
              slug: 'auto_run_notice',
              title: '自动提示',
              text: '公告和使用教程更新了，可点上方“使用教程”查看。',
              is_enabled: true,
              has_content: true,
              is_visible: true,
              updated_at: '2026-04-21T12:05:00Z',
              updated_at_display: '2026-04-21 20:05',
            },
          ],
        };
      },
    }),
  });

  const snapshot = await api.getContentUpdateSnapshot({ flowId: 'kiro', targetId: 'kiro-rs' });

  assert.equal(snapshot.status, 'update-available');
  assert.equal(snapshot.promptVersion, 'auto_run_notice:2026-04-21T12:05:00Z');
  assert.equal(snapshot.flowId, 'kiro');
  assert.equal(snapshot.targetId, 'kiro-rs');
  assert.equal(getFetchUrls()[0], 'https://flowpilot.qlhazycoder.top/api/content-summary?flow=kiro&target=kiro-rs');
  assert.equal(snapshot.hasVisibleUpdates, true);
  assert.equal(snapshot.latestUpdatedAt, '2026-04-21T12:05:00Z');
  assert.equal(snapshot.items.length, 1);
  assert.deepEqual(
    snapshot.items.map((item) => [item.slug, item.isVisible, item.text]),
    [['auto_run_notice', true, '公告和使用教程更新了，可点上方“使用教程”查看。']]
  );
});

test('getContentUpdateSnapshot falls back to cached snapshot when the live request fails', async () => {
  const cachedSnapshot = {
    status: 'update-available',
    promptVersion: 'announcement:2026-04-20T00:00:00Z',
    hasVisibleUpdates: true,
    latestUpdatedAt: '2026-04-20T00:00:00Z',
    latestUpdatedAtDisplay: '2026-04-20 08:00',
    items: [
      {
        slug: 'announcement',
        title: '站点公告',
        isEnabled: true,
        hasContent: true,
        isVisible: true,
        updatedAt: '2026-04-20T00:00:00Z',
        updatedAtDisplay: '2026-04-20 08:00',
      },
    ],
    portalUrl: 'https://flowpilot.qlhazycoder.top',
    apiUrl: 'https://flowpilot.qlhazycoder.top/api/content-summary?flow=openai&target=cpa',
    checkedAt: Date.now() - 1000,
  };

  const { api, getFetchCalls } = createPortalContentService({
    cachedSnapshot,
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });

  const snapshot = await api.getContentUpdateSnapshot();

  assert.equal(getFetchCalls(), 1);
  assert.equal(snapshot.fromCache, true);
  assert.equal(snapshot.promptVersion, cachedSnapshot.promptVersion);
  assert.equal(snapshot.errorMessage, 'offline');
  assert.equal(snapshot.items[0].slug, 'announcement');
});

test('getContentUpdateSnapshot keeps flow caches isolated', async () => {
  const cachedSnapshot = {
    status: 'update-available',
    promptVersion: 'flow:kiro|target:kiro-rs|auto_run_notice:2026-04-22T00:00:00Z',
    hasVisibleUpdates: true,
    latestUpdatedAt: '2026-04-22T00:00:00Z',
    latestUpdatedAtDisplay: '2026-04-22 08:00',
    flowId: 'kiro',
    targetId: 'kiro-rs',
    items: [{ slug: 'auto_run_notice', isVisible: true, text: 'Kiro 提示' }],
    checkedAt: Date.now() - 1000,
  };

  const { api } = createPortalContentService({
    cachedSnapshot,
    cacheKey: 'multipage-portal-content-summary-v2:kiro:kiro-rs',
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });

  const openAiSnapshot = await api.getContentUpdateSnapshot({ flowId: 'openai', targetId: 'cpa' });
  const kiroSnapshot = await api.getContentUpdateSnapshot({ flowId: 'kiro', targetId: 'kiro-rs' });

  assert.equal(openAiSnapshot.status, 'error');
  assert.equal(openAiSnapshot.fromCache, undefined);
  assert.equal(openAiSnapshot.flowId, 'openai');
  assert.equal(kiroSnapshot.fromCache, true);
  assert.equal(kiroSnapshot.flowId, 'kiro');
  assert.equal(kiroSnapshot.promptVersion, cachedSnapshot.promptVersion);
});
