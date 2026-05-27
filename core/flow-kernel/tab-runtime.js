(function attachBackgroundTabRuntime(root, factory) {
  root.MultiPageBackgroundTabRuntime = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundTabRuntimeModule() {
  function createTabRuntime(deps = {}) {
    const {
      addLog,
      chrome,
      getSourceLabel,
      getState,
      isLocalhostOAuthCallbackUrl,
      isRetryableContentScriptTransportError,
      LOG_PREFIX,
      matchesSourceUrlFamily,
      sourceRegistry = null,
      setState,
      sleepWithStop,
      STOP_ERROR_MESSAGE,
      throwIfStopped,
    } = deps;

    const pendingCommands = new Map();

    function resolveCanonicalSource(source) {
      if (sourceRegistry?.resolveCanonicalSource) {
        return sourceRegistry.resolveCanonicalSource(source);
      }
      return String(source || '').trim();
    }

    function getSourceKeys(source) {
      if (sourceRegistry?.getSourceKeys) {
        const registryKeys = sourceRegistry.getSourceKeys(source);
        if (Array.isArray(registryKeys) && registryKeys.length) {
          return registryKeys;
        }
      }
      const normalized = String(source || '').trim();
      return normalized ? [normalized] : [];
    }

    function getSourceCommandKey(source) {
      const keys = getSourceKeys(source);
      return keys[0] || String(source || '').trim();
    }

    function sourcesMatch(leftSource, rightSource) {
      const left = resolveCanonicalSource(leftSource);
      const right = resolveCanonicalSource(rightSource);
      return Boolean(left && right && left === right);
    }

    function getSourceMapValue(record, source) {
      const map = record && typeof record === 'object' ? record : {};
      for (const key of getSourceKeys(source)) {
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          return map[key];
        }
      }
      return undefined;
    }

    function setSourceMapValue(record, source, value) {
      const nextRecord = { ...(record || {}) };
      const keys = getSourceKeys(source);
      const canonicalKey = keys[0] || String(source || '').trim();
      for (const key of keys.slice(1)) {
        delete nextRecord[key];
      }
      if (canonicalKey) {
        nextRecord[canonicalKey] = value;
      }
      return nextRecord;
    }

    function getCleanupOwnerSource(cleanupScope) {
      if (sourceRegistry?.getCleanupOwnerSource) {
        return sourceRegistry.getCleanupOwnerSource(cleanupScope);
      }
      return cleanupScope === 'oauth-localhost-callback' ? 'openai-auth' : '';
    }

    function normalizeAutomationWindowId(value) {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
    }

    function buildAutomationWindowUnavailableError(error) {
      const suffix = error?.message ? ` Reason: ${error.message}` : '';
      return new Error(`The automation task window is no longer available. Please reopen the side panel in the target Chrome window and start the task again.${suffix}`);
    }

    async function getAutomationWindowId(options = {}) {
      const directWindowId = normalizeAutomationWindowId(
        options.automationWindowId ?? options.windowId ?? null
      );
      if (directWindowId !== null) {
        return directWindowId;
      }

      const state = await getState();
      return normalizeAutomationWindowId(state?.automationWindowId);
    }

    async function withAutomationWindowScope(queryInfo = {}, options = {}) {
      const windowId = await getAutomationWindowId(options);
      if (windowId === null) {
        return { ...(queryInfo || {}) };
      }
      const scoped = {
        ...(queryInfo || {}),
        windowId,
      };
      delete scoped.currentWindow;
      return scoped;
    }

    async function queryTabsInAutomationWindow(queryInfo = {}, options = {}) {
      const scopedQuery = await withAutomationWindowScope(queryInfo, options);
      try {
        return await chrome.tabs.query(scopedQuery);
      } catch (error) {
        if (Object.prototype.hasOwnProperty.call(scopedQuery, 'windowId')) {
          throw buildAutomationWindowUnavailableError(error);
        }
        throw error;
      }
    }

    async function createAutomationTab(createProperties = {}, options = {}) {
      const windowId = await getAutomationWindowId(options);
      const properties = {
        ...(createProperties || {}),
        ...(windowId !== null ? { windowId } : {}),
      };

      try {
        return await chrome.tabs.create(properties);
      } catch (error) {
        if (windowId !== null) {
          throw buildAutomationWindowUnavailableError(error);
        }
        throw error;
      }
    }

    async function isTabInAutomationWindow(tabOrId, options = {}) {
      const windowId = await getAutomationWindowId(options);
      if (windowId === null) {
        return true;
      }

      let tab = tabOrId;
      if (Number.isInteger(tabOrId)) {
        if (typeof chrome?.tabs?.get !== 'function') {
          return true;
        }
        tab = await chrome.tabs.get(tabOrId).catch(() => null);
      }

      const tabWindowId = normalizeAutomationWindowId(tab?.windowId);
      return tabWindowId === null || tabWindowId === windowId;
    }

    async function sleepOrStop(ms) {
      if (typeof sleepWithStop === 'function') {
        await sleepWithStop(ms);
        return;
      }

      const start = Date.now();
      while (Date.now() - start < ms) {
        throwIfStopped();
        await new Promise((resolve) => setTimeout(resolve, Math.min(100, ms - (Date.now() - start))));
      }
    }

    function waitForTabUpdateComplete(tabId, timeoutMs = 30000) {
      return new Promise((resolve, reject) => {
        let settled = false;
        let stopTimer = null;

        const cleanup = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearTimeout(stopTimer);
          chrome.tabs.onUpdated.removeListener(listener);
        };

        const resolveSafely = () => {
          cleanup();
          resolve();
        };

        const rejectSafely = (error) => {
          cleanup();
          reject(error);
        };

        const listener = (updatedTabId, info) => {
          if (updatedTabId === tabId && info.status === 'complete') {
            resolveSafely();
          }
        };

        const timer = setTimeout(resolveSafely, timeoutMs);
        chrome.tabs.onUpdated.addListener(listener);

        const pollStop = () => {
          if (settled) return;
          try {
            throwIfStopped();
          } catch (error) {
            rejectSafely(error);
            return;
          }
          stopTimer = setTimeout(pollStop, 100);
        };

        pollStop();
      });
    }

    async function getTabRegistry() {
      const state = await getState();
      return state.tabRegistry || {};
    }

    async function registerTab(source, tabId) {
      let registry = await getTabRegistry();
      let windowId = null;
      if (chrome?.tabs?.get && Number.isInteger(tabId)) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (tab && !(await isTabInAutomationWindow(tab))) {
          console.log(LOG_PREFIX, `Ignored tab registration outside automation window: ${source} -> ${tabId}`);
          return;
        }
        windowId = normalizeAutomationWindowId(tab?.windowId);
      }
      registry = setSourceMapValue(registry, source, {
        tabId,
        ready: true,
        ...(windowId !== null ? { windowId } : {}),
      });
      await setState({ tabRegistry: registry });
      console.log(LOG_PREFIX, `Tab registered: ${source} -> ${tabId}`);
    }

    async function isTabAlive(source) {
      let registry = await getTabRegistry();
      const entry = getSourceMapValue(registry, source);
      if (!entry) return false;
      try {
        const tab = await chrome.tabs.get(entry.tabId);
        if (!(await isTabInAutomationWindow(tab))) {
          registry = setSourceMapValue(registry, source, null);
          await setState({ tabRegistry: registry });
          return false;
        }
        return true;
      } catch {
        registry = setSourceMapValue(registry, source, null);
        await setState({ tabRegistry: registry });
        return false;
      }
    }

    async function getTabId(source) {
      let registry = await getTabRegistry();
      const tabId = getSourceMapValue(registry, source)?.tabId || null;
      if (!Number.isInteger(tabId)) {
        return null;
      }
      if (!(await isTabInAutomationWindow(tabId))) {
        registry = setSourceMapValue(registry, source, null);
        await setState({ tabRegistry: registry });
        return null;
      }
      return tabId;
    }

    async function rememberSourceLastUrl(source, url) {
      if (!source || !url) return;
      const state = await getState();
      const sourceLastUrls = setSourceMapValue(state.sourceLastUrls, source, url);
      await setState({ sourceLastUrls });
    }

    async function closeConflictingTabsForSource(source, currentUrl, options = {}) {
      const { excludeTabIds = [], preserveActiveTab = false } = options;
      const excluded = new Set(excludeTabIds.filter((id) => Number.isInteger(id)));
      const state = await getState();
      const lastUrl = getSourceMapValue(state.sourceLastUrls, source);
      const referenceUrls = [currentUrl, lastUrl].filter(Boolean);

      if (!referenceUrls.length) return;

      const tabs = await queryTabsInAutomationWindow({});
      const activeTabId = preserveActiveTab
        ? tabs.find((tab) => Boolean(tab?.active) && Number.isInteger(tab?.id))?.id || null
        : null;
      const matchedIds = tabs
        .filter((tab) => Number.isInteger(tab.id) && !excluded.has(tab.id))
        .filter((tab) => !(preserveActiveTab && activeTabId !== null && tab.id === activeTabId))
        .filter((tab) => referenceUrls.some((refUrl) => matchesSourceUrlFamily(source, tab.url, refUrl)))
        .map((tab) => tab.id);

      if (!matchedIds.length) return;

      await chrome.tabs.remove(matchedIds).catch(() => { });

      let registry = await getTabRegistry();
      const sourceEntry = getSourceMapValue(registry, source);
      if (sourceEntry?.tabId && matchedIds.includes(sourceEntry.tabId)) {
        registry = setSourceMapValue(registry, source, null);
        await setState({ tabRegistry: registry });
      }

      await addLog(`Closed ${matchedIds.length} stale ${getSourceLabel(source)} tabs.`, 'info');
    }

    function isLocalhostOAuthCallbackTabMatch(callbackUrl, candidateUrl) {
      if (!isLocalhostOAuthCallbackUrl(callbackUrl) || !isLocalhostOAuthCallbackUrl(candidateUrl)) {
        return false;
      }

      const callback = new URL(callbackUrl);
      const candidate = new URL(candidateUrl);
      return callback.origin === candidate.origin
        && callback.pathname === candidate.pathname
        && callback.searchParams.get('code') === candidate.searchParams.get('code')
        && callback.searchParams.get('state') === candidate.searchParams.get('state');
    }

    async function closeLocalhostCallbackTabs(callbackUrl, options = {}) {
      if (!isLocalhostOAuthCallbackUrl(callbackUrl)) return 0;

      const { excludeTabIds = [], ownerSource = getCleanupOwnerSource('oauth-localhost-callback') } = options;
      const excluded = new Set(excludeTabIds.filter((id) => Number.isInteger(id)));
      const tabs = await queryTabsInAutomationWindow({});
      const matchedIds = tabs
        .filter((tab) => Number.isInteger(tab.id) && !excluded.has(tab.id))
        .filter((tab) => isLocalhostOAuthCallbackTabMatch(callbackUrl, tab.url))
        .map((tab) => tab.id);

      if (!matchedIds.length) return 0;

      await chrome.tabs.remove(matchedIds).catch(() => { });

      let registry = await getTabRegistry();
      const ownerEntry = getSourceMapValue(registry, ownerSource);
      if (ownerEntry?.tabId && matchedIds.includes(ownerEntry.tabId)) {
        registry = setSourceMapValue(registry, ownerSource, null);
        await setState({ tabRegistry: registry });
      }

      await addLog(`Closed ${matchedIds.length} localhost residual tabs matching the current OAuth callback.`, 'info');
      return matchedIds.length;
    }

    function buildLocalhostCleanupPrefix(rawUrl) {
      if (!isLocalhostOAuthCallbackUrl(rawUrl)) return '';
      const parsed = new URL(rawUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (!segments.length) return parsed.origin;
      return `${parsed.origin}/${segments[0]}`;
    }

    async function closeTabsByUrlPrefix(prefix, options = {}) {
      if (!prefix) return 0;

      const { excludeTabIds = [], excludeUrls = [], excludeLocalhostCallbacks = false } = options;
      const excluded = new Set(excludeTabIds.filter((id) => Number.isInteger(id)));
      const excludedUrls = new Set((Array.isArray(excludeUrls) ? excludeUrls : []).filter(Boolean));
      const tabs = await queryTabsInAutomationWindow({});
      const matchedIds = tabs
        .filter((tab) => Number.isInteger(tab.id) && !excluded.has(tab.id))
        .filter((tab) => typeof tab.url === 'string' && !excludedUrls.has(tab.url))
        .filter((tab) => !(excludeLocalhostCallbacks && isLocalhostOAuthCallbackUrl(tab.url)))
        .filter((tab) => typeof tab.url === 'string' && tab.url.startsWith(prefix))
        .filter((tab) => !isLocalhostOAuthCallbackUrl(tab.url))
        .map((tab) => tab.id);

      if (!matchedIds.length) return 0;

      await chrome.tabs.remove(matchedIds).catch(() => { });
      await addLog(`Closed ${matchedIds.length} localhost residual tabs matching ${prefix}.`, 'info');
      return matchedIds.length;
    }

    async function pingContentScriptOnTab(tabId) {
      if (!Number.isInteger(tabId)) return null;
      try {
        return await chrome.tabs.sendMessage(tabId, {
          type: 'PING',
          source: 'background',
          payload: {},
        });
      } catch {
        return null;
      }
    }

    async function waitForTabUrlFamily(source, tabId, referenceUrl, options = {}) {
      const { timeoutMs = 15000, retryDelayMs = 400 } = options;
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (matchesSourceUrlFamily(source, tab.url, referenceUrl)) {
            return tab;
          }
        } catch {
          return null;
        }
        await sleepOrStop(retryDelayMs);
      }
      return null;
    }

    async function waitForTabUrlMatch(tabId, matcher, options = {}) {
      const { timeoutMs = 15000, retryDelayMs = 400 } = options;
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (matcher(tab.url || '', tab)) {
            return tab;
          }
        } catch {
          return null;
        }
        await sleepOrStop(retryDelayMs);
      }
      return null;
    }

    async function waitForTabComplete(tabId, options = {}) {
      const { timeoutMs = 15000, retryDelayMs = 300 } = options;
      const start = Date.now();

      while (Date.now() - start < timeoutMs) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab?.status === 'complete') {
            return tab;
          }
        } catch {
          return null;
        }
        await sleepOrStop(retryDelayMs);
      }

      try {
        return await chrome.tabs.get(tabId);
      } catch {
        return null;
      }
    }

    async function waitForTabStableComplete(tabId, options = {}) {
      const {
        timeoutMs = 30000,
        retryDelayMs = 300,
        stableMs = 1000,
        initialDelayMs = 0,
      } = options;
      const start = Date.now();
      let lastUrl = '';
      let lastStatus = '';
      let stableStartedAt = 0;
      let lastTab = null;

      if (initialDelayMs > 0) {
        await sleepOrStop(initialDelayMs);
      }

      while (Date.now() - start < timeoutMs) {
        throwIfStopped();
        try {
          lastTab = await chrome.tabs.get(tabId);
        } catch {
          return null;
        }

        const currentUrl = String(lastTab?.url || '');
        const currentStatus = String(lastTab?.status || '');
        if (currentStatus === 'complete') {
          if (currentUrl !== lastUrl || currentStatus !== lastStatus || !stableStartedAt) {
            stableStartedAt = Date.now();
          }
          if (Date.now() - stableStartedAt >= stableMs) {
            return lastTab;
          }
        } else {
          stableStartedAt = 0;
        }

        lastUrl = currentUrl;
        lastStatus = currentStatus;
        await sleepOrStop(retryDelayMs);
      }

      return lastTab;
    }

    async function ensureContentScriptReadyOnTab(source, tabId, options = {}) {
      const {
        inject = null,
        injectSource = null,
        timeoutMs = 30000,
        retryDelayMs = 700,
        logMessage = '',
        logStep = null,
        logStepKey = '',
      } = options;

      const start = Date.now();
      let lastError = null;
      let logged = false;
      let attempt = 0;

      console.log(
        LOG_PREFIX,
        `[ensureContentScriptReadyOnTab] start ${source} tab=${tabId}, timeout=${timeoutMs}ms, inject=${Array.isArray(inject) ? inject.join(',') : 'none'}`
      );

      while (Date.now() - start < timeoutMs) {
        attempt += 1;
        const pong = await pingContentScriptOnTab(tabId);
        if (pong?.ok && (!pong.source || sourcesMatch(pong.source, source))) {
          console.log(LOG_PREFIX, `[ensureContentScriptReadyOnTab] ready ${source} tab=${tabId} on attempt ${attempt} after ${Date.now() - start}ms`);
          await registerTab(source, tabId);
          return;
        }

        if (!inject || !inject.length) {
          throw new Error(`${getSourceLabel(source)} content script is not ready and no injectable files were provided.`);
        }

        let registry = await getTabRegistry();
        const sourceEntry = getSourceMapValue(registry, source);
        if (sourceEntry) {
          registry = setSourceMapValue(registry, source, {
            ...sourceEntry,
            ready: false,
          });
          await setState({ tabRegistry: registry });
        }

        try {
          if (injectSource) {
            await chrome.scripting.executeScript({
              target: { tabId },
              func: (injectedSource) => {
                window.__MULTIPAGE_SOURCE = injectedSource;
              },
              args: [injectSource],
            });
          }

          await chrome.scripting.executeScript({
            target: { tabId },
            files: inject,
          });
        } catch (err) {
          lastError = err;
          console.warn(LOG_PREFIX, `[ensureContentScriptReadyOnTab] inject attempt ${attempt} failed for ${source} tab=${tabId}: ${err?.message || err}`);
        }

        const pongAfterInject = await pingContentScriptOnTab(tabId);
        if (pongAfterInject?.ok && (!pongAfterInject.source || sourcesMatch(pongAfterInject.source, source))) {
          console.log(LOG_PREFIX, `[ensureContentScriptReadyOnTab] ready after inject ${source} tab=${tabId} on attempt ${attempt} after ${Date.now() - start}ms`);
          await registerTab(source, tabId);
          return;
        }

        if (logMessage && !logged) {
          console.warn(LOG_PREFIX, `[ensureContentScriptReadyOnTab] ${source} tab=${tabId} still not ready after ${Date.now() - start}ms`);
          await addLog(logMessage, 'warn', {
            step: logStep,
            stepKey: logStepKey,
          });
          logged = true;
        }

        await sleepOrStop(retryDelayMs);
      }

      throw lastError || new Error(`${getSourceLabel(source)} content script did not become ready in time.`);
    }

    function getContentScriptResponseTimeoutMs(message) {
      if (!message || typeof message !== 'object') return 30000;
      if (message.type === 'EXECUTE_NODE' && String(message.nodeId || message.payload?.nodeId || '').trim() === 'fill-profile') return 150000;
      if (message.type === 'EXECUTE_NODE' && String(message.nodeId || message.payload?.nodeId || '').trim() === 'wait-registration-success') return 75000;
      if (message.type === 'POLL_EMAIL') {
        const maxAttempts = Math.max(1, Number(message.payload?.maxAttempts) || 1);
        const intervalMs = Math.max(0, Number(message.payload?.intervalMs) || 0);
        return Math.max(45000, maxAttempts * intervalMs + 25000);
      }
      if (message.type === 'FILL_CODE') return Number(message.step) === 7 ? 45000 : 30000;
      if (message.type === 'PREPARE_SIGNUP_VERIFICATION') return 45000;
      return 30000;
    }

    function resolveResponseTimeoutMs(message, requestedResponseTimeoutMs, remainingTimeoutMs = null) {
      const fallbackTimeoutMs = getContentScriptResponseTimeoutMs(message);
      const requestedTimeoutMs = Number.isFinite(Number(requestedResponseTimeoutMs))
        ? Math.max(1, Math.floor(Number(requestedResponseTimeoutMs)))
        : fallbackTimeoutMs;
      if (!Number.isFinite(Number(remainingTimeoutMs))) {
        return requestedTimeoutMs;
      }
      return Math.max(1, Math.min(requestedTimeoutMs, Math.floor(Number(remainingTimeoutMs))));
    }

    function buildRetryableTransportTimeoutError(source, error) {
      const rawMessage = error?.message || String(error || '');
      if (isRetryableContentScriptTransportError(error)) {
        return new Error(
          `${getSourceLabel(source)} page just navigated or reloaded and the content script has not re-attached; the extension auto-retried but it still has not recovered. Please retry the current step.`
        );
      }
      return new Error(rawMessage || `${getSourceLabel(source)} page communication failed.`);
    }

    function getMessageDebugLabel(source, message, tabId = null) {
      const parts = [source || 'unknown', message?.type || 'UNKNOWN'];
      if (Number.isInteger(message?.step)) parts.push(`step=${message.step}`);
      if (Number.isInteger(tabId)) parts.push(`tab=${tabId}`);
      return parts.join(' ');
    }

    function summarizeMessageResultForDebug(result) {
      if (result === undefined) return 'undefined';
      if (result === null) return 'null';
      if (typeof result !== 'object') return JSON.stringify(result);
      const summary = {};
      for (const key of ['ok', 'error', 'stopped', 'source', 'step']) {
        if (key in result) summary[key] = result[key];
      }
      if (result.payload && typeof result.payload === 'object') {
        summary.payloadKeys = Object.keys(result.payload);
      }
      return JSON.stringify(summary);
    }

    function sendTabMessageWithTimeout(tabId, source, message, responseTimeoutMs = getContentScriptResponseTimeoutMs(message)) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const startedAt = Date.now();
        const debugLabel = getMessageDebugLabel(source, message, tabId);

        console.log(LOG_PREFIX, `[sendTabMessageWithTimeout] dispatch ${debugLabel}, timeout=${responseTimeoutMs}ms`);

        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          const seconds = Math.ceil(responseTimeoutMs / 1000);
          console.warn(LOG_PREFIX, `[sendTabMessageWithTimeout] timeout ${debugLabel} after ${Date.now() - startedAt}ms`);
          reject(new Error(`${getSourceLabel(source)} content script did not respond within ${seconds}s. Please refresh the page and retry.`));
        }, responseTimeoutMs);

        chrome.tabs.sendMessage(tabId, message)
          .then((value) => {
            const elapsed = Date.now() - startedAt;
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            console.log(LOG_PREFIX, `[sendTabMessageWithTimeout] response ${debugLabel} after ${elapsed}ms: ${summarizeMessageResultForDebug(value)}`);
            resolve(value);
          })
          .catch((error) => {
            const elapsed = Date.now() - startedAt;
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            console.warn(LOG_PREFIX, `[sendTabMessageWithTimeout] rejection ${debugLabel} after ${elapsed}ms: ${error?.message || error}`);
            reject(error);
          });
      });
    }

    function queueCommand(source, message, timeout = 15000) {
      return new Promise((resolve, reject) => {
        const commandKey = getSourceCommandKey(source);
        const timer = setTimeout(() => {
          pendingCommands.delete(commandKey);
          reject(new Error(`${getSourceLabel(source)} content script did not respond within ${timeout / 1000}s. Please refresh the page and retry.`));
        }, timeout);
        pendingCommands.set(commandKey, {
          message,
          resolve,
          reject,
          source,
          timer,
          responseTimeoutMs: timeout,
        });
        console.log(LOG_PREFIX, `Command queued for ${source} (waiting for ready)`);
      });
    }

    function flushCommand(source, tabId) {
      const pending = pendingCommands.get(getSourceCommandKey(source));
      if (pending) {
        clearTimeout(pending.timer);
        pendingCommands.delete(getSourceCommandKey(source));
        sendTabMessageWithTimeout(
          tabId,
          pending.source || source,
          pending.message,
          pending.responseTimeoutMs
        ).then(pending.resolve).catch(pending.reject);
        console.log(LOG_PREFIX, `Flushed queued command to ${source} (tab ${tabId})`);
      }
    }

    function cancelPendingCommands(reason = STOP_ERROR_MESSAGE) {
      for (const [source, pending] of pendingCommands.entries()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(reason));
        pendingCommands.delete(source);
        console.log(LOG_PREFIX, `Cancelled queued command for ${source}`);
      }
    }

    async function reuseOrCreateTab(source, url, options = {}) {
      if (options.forceNew) {
        const tab = await createAutomationTab({ url, active: true }, options);
        await closeConflictingTabsForSource(source, url, {
          excludeTabIds: [tab.id],
          preserveActiveTab: false,
        });

        if (options.inject) {
          await waitForTabUpdateComplete(tab.id);
          if (options.injectSource) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (injectedSource) => {
                window.__MULTIPAGE_SOURCE = injectedSource;
              },
              args: [options.injectSource],
            });
          }
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: options.inject,
          });
        }

        await rememberSourceLastUrl(source, url);
        return tab.id;
      }

      const alive = await isTabAlive(source);
      if (alive) {
        const tabId = await getTabId(source);
        await closeConflictingTabsForSource(source, url, {
          excludeTabIds: [tabId],
          preserveActiveTab: false,
        });
        const currentTab = await chrome.tabs.get(tabId);
        const sameUrl = currentTab.url === url;
        const shouldReloadOnReuse = sameUrl && options.reloadIfSameUrl;

        let registry = await getTabRegistry();
        const sourceEntry = getSourceMapValue(registry, source);
        if (sameUrl) {
          await chrome.tabs.update(tabId, { active: true });
          if (shouldReloadOnReuse) {
            if (sourceEntry) {
              registry = setSourceMapValue(registry, source, {
                ...sourceEntry,
                ready: false,
              });
            }
            await setState({ tabRegistry: registry });
            await chrome.tabs.reload(tabId);
            await waitForTabUpdateComplete(tabId);
          }

          if (options.inject) {
            if (sourceEntry) {
              registry = setSourceMapValue(registry, source, {
                ...sourceEntry,
                ready: false,
              });
            }
            await setState({ tabRegistry: registry });
            if (options.injectSource) {
              await chrome.scripting.executeScript({
                target: { tabId },
                func: (injectedSource) => {
                  window.__MULTIPAGE_SOURCE = injectedSource;
                },
                args: [options.injectSource],
              });
            }
            await chrome.scripting.executeScript({
              target: { tabId },
              files: options.inject,
            });
            await sleepOrStop(500);
          }

          await rememberSourceLastUrl(source, url);
          return tabId;
        }

        if (sourceEntry) {
          registry = setSourceMapValue(registry, source, {
            ...sourceEntry,
            ready: false,
          });
        }
        await setState({ tabRegistry: registry });
        await chrome.tabs.update(tabId, { url, active: true });

        await waitForTabUpdateComplete(tabId);

        if (options.inject) {
          if (options.injectSource) {
            await chrome.scripting.executeScript({
              target: { tabId },
              func: (injectedSource) => {
                window.__MULTIPAGE_SOURCE = injectedSource;
              },
              args: [options.injectSource],
            });
          }
          await chrome.scripting.executeScript({
            target: { tabId },
            files: options.inject,
          });
        }

        await sleepOrStop(500);
        await rememberSourceLastUrl(source, url);
        return tabId;
      }

      const tab = await createAutomationTab({ url, active: true }, options);
      await closeConflictingTabsForSource(source, url, {
        excludeTabIds: [tab.id],
        preserveActiveTab: false,
      });

      if (options.inject) {
        await waitForTabUpdateComplete(tab.id);
        if (options.injectSource) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (injectedSource) => {
              window.__MULTIPAGE_SOURCE = injectedSource;
            },
            args: [options.injectSource],
          });
        }
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: options.inject,
        });
      }

      await rememberSourceLastUrl(source, url);
      return tab.id;
    }

    async function sendToContentScript(source, message, options = {}) {
      throwIfStopped();
      const { responseTimeoutMs = getContentScriptResponseTimeoutMs(message) } = options;
      const registry = await getTabRegistry();
      const entry = getSourceMapValue(registry, source);

      if (!entry || !entry.ready) {
        throwIfStopped();
        return queueCommand(source, message, responseTimeoutMs);
      }

      const alive = await isTabAlive(source);
      throwIfStopped();
      if (!alive) {
        return queueCommand(source, message, responseTimeoutMs);
      }

      throwIfStopped();
      return sendTabMessageWithTimeout(entry.tabId, source, message, responseTimeoutMs);
    }

    async function sendToContentScriptResilient(source, message, options = {}) {
      const {
        timeoutMs = 30000,
        retryDelayMs = 600,
        logMessage = '',
        logStep = null,
        logStepKey = '',
        onRetryableError = null,
        responseTimeoutMs,
      } = options;
      const start = Date.now();
      let lastError = null;
      let logged = false;
      let attempt = 0;

      while (Date.now() - start < timeoutMs) {
        throwIfStopped();
        attempt += 1;
        const remainingTimeoutMs = Math.max(1, timeoutMs - (Date.now() - start));
        const effectiveResponseTimeoutMs = resolveResponseTimeoutMs(
          message,
          responseTimeoutMs,
          remainingTimeoutMs
        );

        try {
          return await sendToContentScript(
            source,
            message,
            { responseTimeoutMs: effectiveResponseTimeoutMs }
          );
        } catch (err) {
          const retryable = isRetryableContentScriptTransportError(err);
          if (!retryable) {
            throw err;
          }

          lastError = err;
          if (logMessage && !logged) {
            await addLog(logMessage, 'warn', {
              step: logStep,
              stepKey: logStepKey,
            });
            logged = true;
          }

          if (typeof onRetryableError === 'function') {
            await onRetryableError(err, {
              attempt,
              elapsedMs: Date.now() - start,
              remainingTimeoutMs: Math.max(0, timeoutMs - (Date.now() - start)),
              source,
              message,
            });
          }

          await sleepOrStop(retryDelayMs);
        }
      }

      if (lastError && isRetryableContentScriptTransportError(lastError)) {
        throw buildRetryableTransportTimeoutError(source, lastError);
      }
      throw lastError || new Error(`Timed out waiting for ${getSourceLabel(source)} to become ready again.`);
    }

    async function sendToMailContentScriptResilient(mail, message, options = {}) {
      const {
        timeoutMs = 45000,
        maxRecoveryAttempts = 2,
        logStep = null,
        logStepKey = '',
        responseTimeoutMs,
      } = options;
      const start = Date.now();
      let lastError = null;
      let recoveries = 0;
      let logged = false;

      while (Date.now() - start < timeoutMs) {
        throwIfStopped();
        const remainingTimeoutMs = Math.max(1, timeoutMs - (Date.now() - start));
        const effectiveResponseTimeoutMs = resolveResponseTimeoutMs(
          message,
          responseTimeoutMs,
          remainingTimeoutMs
        );

        try {
          return await sendToContentScript(
            mail.source,
            message,
            { responseTimeoutMs: effectiveResponseTimeoutMs }
          );
        } catch (err) {
          if (!isRetryableContentScriptTransportError(err)) {
            throw err;
          }

          lastError = err;
          if (!logged) {
            await addLog(`${mail.label} page communication failed; trying to bring the mailbox page back to ready state...`, 'warn', {
              step: logStep,
              stepKey: logStepKey,
            });
            logged = true;
          }

          if (recoveries >= maxRecoveryAttempts) {
            break;
          }

          recoveries += 1;
          await reuseOrCreateTab(mail.source, mail.url, {
            inject: mail.inject,
            injectSource: mail.injectSource,
            reloadIfSameUrl: true,
          });
          await sleepOrStop(800);
        }
      }

      throw lastError || new Error(`${mail.label} page failed to become ready again.`);
    }

    return {
      buildLocalhostCleanupPrefix,
      cancelPendingCommands,
      closeConflictingTabsForSource,
      closeLocalhostCallbackTabs,
      closeTabsByUrlPrefix,
      createAutomationTab,
      ensureContentScriptReadyOnTab,
      flushCommand,
      getAutomationWindowId,
      getContentScriptResponseTimeoutMs,
      getMessageDebugLabel,
      getTabId,
      getTabRegistry,
      isLocalhostOAuthCallbackTabMatch,
      isTabAlive,
      isTabInAutomationWindow,
      pingContentScriptOnTab,
      queueCommand,
      queryTabsInAutomationWindow,
      registerTab,
      rememberSourceLastUrl,
      resolveResponseTimeoutMs,
      reuseOrCreateTab,
      sendTabMessageWithTimeout,
      sendToContentScript,
      sendToContentScriptResilient,
      sendToMailContentScriptResilient,
      summarizeMessageResultForDebug,
      waitForTabComplete,
      waitForTabStableComplete,
      waitForTabUrlFamily,
      waitForTabUrlMatch,
    };
  }

  return {
    createTabRuntime,
  };
});
