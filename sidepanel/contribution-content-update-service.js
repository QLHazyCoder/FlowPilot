(() => {
  const PORTAL_BASE_URL = 'https://flowpilot.qlhazycoder.top';
  const CONTENT_SUMMARY_API_URL = `${PORTAL_BASE_URL}/api/content-summary`;
  const CACHE_KEY_PREFIX = 'multipage-contribution-content-summary-v2';
  const FETCH_TIMEOUT_MS = 6000;

  function normalizeScopeId(value = '', fallback = '') {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || fallback;
  }

  function normalizeScope(options = {}) {
    const flowId = normalizeScopeId(options.flowId || options.flow || options.activeFlowId, 'openai');
    const targetFallback = flowId === 'kiro' ? 'kiro-rs' : 'cpa';
    const targetId = normalizeScopeId(options.targetId || options.target || options.activeTargetId, targetFallback);
    return { flowId, targetId };
  }

  function getCacheKey(scope = normalizeScope()) {
    return `${CACHE_KEY_PREFIX}:${scope.flowId}:${scope.targetId}`;
  }

  function buildSummaryApiUrl(scope = normalizeScope()) {
    const url = new URL(CONTENT_SUMMARY_API_URL);
    url.searchParams.set('flow', scope.flowId);
    url.searchParams.set('target', scope.targetId);
    return url.toString();
  }

  function sanitizeItem(item = {}) {
    return {
      slug: String(item?.slug || '').trim(),
      title: String(item?.title || '').trim(),
      text: String(item?.text || '').trim(),
      isEnabled: Boolean(item?.is_enabled ?? item?.isEnabled),
      hasContent: Boolean(item?.has_content ?? item?.hasContent),
      isVisible: Boolean(item?.is_visible ?? item?.isVisible),
      updatedAt: String(item?.updated_at ?? item?.updatedAt ?? '').trim(),
      updatedAtDisplay: String(item?.updated_at_display ?? item?.updatedAtDisplay ?? '').trim(),
      flowId: normalizeScopeId(item?.flow_id ?? item?.flowId, ''),
      targetId: normalizeScopeId(item?.target_id ?? item?.targetId, ''),
      scope: String(item?.scope || '').trim(),
    };
  }

  function buildSnapshot(payload = {}, scope = normalizeScope()) {
    const items = Array.isArray(payload?.items)
      ? payload.items.map(sanitizeItem).filter((item) => item.slug)
      : [];
    const responseScope = normalizeScope({
      flowId: payload?.flow_id || payload?.flowId || scope.flowId,
      targetId: payload?.target_id || payload?.targetId || scope.targetId,
    });
    const promptVersion = String(payload?.prompt_version || '').trim();
    const latestUpdatedAt = String(payload?.latest_updated_at || '').trim();
    const latestUpdatedAtDisplay = String(payload?.latest_updated_at_display || '').trim();
    const hasVisibleUpdates = Boolean(payload?.has_visible_updates) && Boolean(promptVersion);

    return {
      status: hasVisibleUpdates ? 'update-available' : 'idle',
      promptVersion,
      hasVisibleUpdates,
      latestUpdatedAt,
      latestUpdatedAtDisplay,
      items,
      flowId: responseScope.flowId,
      targetId: responseScope.targetId,
      portalUrl: PORTAL_BASE_URL,
      apiUrl: buildSummaryApiUrl(responseScope),
      checkedAt: Date.now(),
    };
  }

  function readCache(scope = normalizeScope()) {
    try {
      const raw = localStorage.getItem(getCacheKey(scope));
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      const snapshot = buildSnapshot({
        items: parsed.items,
        prompt_version: parsed.promptVersion,
        has_visible_updates: parsed.hasVisibleUpdates,
        latest_updated_at: parsed.latestUpdatedAt,
        latest_updated_at_display: parsed.latestUpdatedAtDisplay,
        flow_id: parsed.flowId,
        target_id: parsed.targetId,
      }, scope);
      if (!Number.isFinite(parsed.checkedAt)) {
        return snapshot;
      }
      snapshot.checkedAt = parsed.checkedAt;
      return snapshot;
    } catch (error) {
      return null;
    }
  }

  function writeCache(snapshot, scope = normalizeScope(snapshot)) {
    try {
      localStorage.setItem(getCacheKey(scope), JSON.stringify(snapshot));
    } catch (error) {
      // Ignore cache write failures.
    }
  }

  async function fetchContentSummary(options = {}) {
    const scope = normalizeScope(options);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(buildSummaryApiUrl(scope), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Content summary request failed: ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || payload.ok !== true) {
        throw new Error('Content summary response format error');
      }

      const snapshot = buildSnapshot(payload, scope);
      writeCache(snapshot, scope);
      return snapshot;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Content summary request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getContentUpdateSnapshot(options = {}) {
    const scope = normalizeScope(options);
    try {
      return await fetchContentSummary(scope);
    } catch (error) {
      const cached = readCache(scope);
      if (cached) {
        return {
          ...cached,
          fromCache: true,
          errorMessage: error?.message || 'Failed to fetch content summary',
        };
      }

      return {
        status: 'error',
        promptVersion: '',
        hasVisibleUpdates: false,
        latestUpdatedAt: '',
        latestUpdatedAtDisplay: '',
        items: [],
        flowId: scope.flowId,
        targetId: scope.targetId,
        portalUrl: PORTAL_BASE_URL,
        apiUrl: buildSummaryApiUrl(scope),
        checkedAt: Date.now(),
        errorMessage: error?.message || 'Failed to fetch content summary',
      };
    }
  }

  window.SidepanelContributionContentService = {
    buildSummaryApiUrl,
    getContentUpdateSnapshot,
    portalUrl: PORTAL_BASE_URL,
    apiUrl: CONTENT_SUMMARY_API_URL,
  };
})();
