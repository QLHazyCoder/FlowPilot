  (function attachSidepanelContributionMode(globalScope) {
    const ACTIVE_STATUSES = new Set(['started', 'waiting', 'processing']);
    const FINAL_STATUSES = new Set(['auto_approved', 'auto_rejected', 'expired', 'error']);
    const DEFAULT_COPY = 'The current account will be used to support project maintenance. The extension will automatically request the contribution login URL and continuously track the authorization status. If a callback URL is detected, it will be submitted automatically and continue to wait for server confirmation.';
    const CONTRIBUTION_SOURCE_CPA = 'cpa';
    const CONTRIBUTION_SOURCE_SUB2API = 'sub2api';
    const CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME = 'codex pool';

  function createContributionModeManager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
    } = context;

    const contributionPortalUrl = constants.contributionPortalUrl || 'https://flowpilot.qlhazycoder.top';
    const contributionUploadUrl = constants.contributionUploadUrl || 'https://flowpilot.qlhazycoder.top/upload';
    const pollIntervalMs = Math.max(1500, Math.floor(Number(constants.pollIntervalMs) || 2500));

    const hiddenRows = [
      dom.rowVpsUrl,
      dom.rowVpsPassword,
      dom.rowLocalCpaStep9Mode,
      dom.rowSub2ApiUrl,
      dom.rowSub2ApiEmail,
      dom.rowSub2ApiPassword,
      dom.rowSub2ApiGroup,
      dom.rowSub2ApiDefaultProxy,
      dom.rowCodex2ApiUrl,
      dom.rowCodex2ApiAdminKey,
      dom.rowCustomPassword,
      dom.rowAccountRunHistoryHelperBaseUrl,
    ].filter(Boolean);

    let actionInFlight = false;
    let pollInFlight = false;
    let pollTimer = null;

    function getLatestState() {
      return state.getLatestState?.() || {};
    }

    function normalizeString(value = '') {
      return String(value || '').trim();
    }

    function normalizeStatus(value = '') {
      const normalized = normalizeString(value).toLowerCase();
      if (ACTIVE_STATUSES.has(normalized) || FINAL_STATUSES.has(normalized)) {
        return normalized;
      }
      return '';
    }

    function normalizeCallbackStatus(value = '') {
      const normalized = normalizeString(value).toLowerCase();
      switch (normalized) {
        case 'waiting':
        case 'captured':
        case 'submitting':
        case 'submitted':
        case 'failed':
        case 'idle':
          return normalized;
        default:
          return '';
      }
    }

    function normalizeContributionSource(value = '') {
      const normalized = normalizeString(value).toLowerCase();
      return normalized === CONTRIBUTION_SOURCE_SUB2API
        ? CONTRIBUTION_SOURCE_SUB2API
        : CONTRIBUTION_SOURCE_CPA;
    }

    function getContributionSource(currentState = getLatestState()) {
      return normalizeContributionSource(currentState.contributionSource || getActiveTargetId(currentState));
    }

    function getContributionSourceLabel(currentState = getLatestState()) {
      if (getActiveFlowId(currentState) !== 'openai') {
        const rootScope = typeof window !== 'undefined' ? window : globalThis;
        const registry = rootScope.MultiPageContributionRegistry || {};
        const adapter = typeof registry.getAdapterDefinition === 'function'
          ? registry.getAdapterDefinition(currentState.contributionAdapterId || '', { flowId: getActiveFlowId(currentState) })
          : null;
        return normalizeString(adapter?.label) || 'Account Contribution';
      }
      return getContributionSource(currentState) === CONTRIBUTION_SOURCE_SUB2API ? 'SUB2API' : 'CPA';
    }

    function getActiveFlowId(currentState = getLatestState()) {
      const selectedFlowId = typeof helpers.getSelectedFlowId === 'function'
        ? normalizeString(helpers.getSelectedFlowId(currentState)).toLowerCase()
        : '';
      return selectedFlowId || normalizeString(currentState.activeFlowId || currentState.flowId).toLowerCase() || 'openai';
    }

    function getActiveTargetId(currentState = getLatestState()) {
      const activeFlowId = getActiveFlowId(currentState);
      const selectedTargetId = typeof helpers.getSelectedTargetId === 'function'
        ? normalizeString(helpers.getSelectedTargetId(activeFlowId, currentState)).toLowerCase()
        : '';
      if (selectedTargetId) {
        return selectedTargetId;
      }
      return normalizeString(currentState.targetId).toLowerCase()
        || (activeFlowId === 'kiro' ? 'kiro-rs' : 'cpa');
    }

    function applySelectedFlowToState(nextState = {}, flowId = 'openai', targetId = '') {
      const selectedFlowId = normalizeString(flowId).toLowerCase() || 'openai';
      const selectedTargetId = normalizeString(targetId).toLowerCase();
      const baseState = nextState && typeof nextState === 'object' ? nextState : {};
      if (selectedFlowId === 'openai') {
        return {
          ...baseState,
          activeFlowId: selectedFlowId,
          flowId: selectedFlowId,
          targetId: selectedTargetId || normalizeString(baseState.targetId).toLowerCase() || 'cpa',
        };
      }
      return {
        ...baseState,
        activeFlowId: selectedFlowId,
        flowId: selectedFlowId,
        targetId: selectedTargetId || normalizeString(baseState.targetId).toLowerCase() || 'kiro-rs',
      };
    }

    function getContributionTutorialEntry(currentState = getLatestState()) {
      const rootScope = typeof window !== 'undefined' ? window : globalThis;
      const registry = rootScope.MultiPageContributionRegistry || {};
      const activeFlowId = getActiveFlowId(currentState);
      if (typeof registry.getContributionTutorialEntry === 'function') {
        return registry.getContributionTutorialEntry(activeFlowId, {
          adapterId: currentState.contributionAdapterId,
          portalBaseUrl: contributionPortalUrl,
          targetId: getActiveTargetId(currentState),
        });
      }
      return {
        flowId: activeFlowId,
        targetId: getActiveTargetId(currentState),
        contributionAdapterId: normalizeString(currentState.contributionAdapterId),
        portalUrl: normalizeString(contributionPortalUrl),
      };
    }

    function getContributionEntryAdapterId(currentState = getLatestState()) {
      return normalizeString(getContributionTutorialEntry(currentState)?.contributionAdapterId);
    }

    function isContributionModeAvailable(currentState = getLatestState()) {
      const rootScope = typeof window !== 'undefined' ? window : globalThis;
      const registry = rootScope.MultiPageFlowCapabilities?.createFlowCapabilityRegistry?.({
        defaultFlowId: 'openai',
      }) || null;
      if (registry?.resolveSidepanelCapabilities) {
        return Boolean(registry.resolveSidepanelCapabilities({
          activeFlowId: getActiveFlowId(currentState),
          targetId: getActiveTargetId(currentState),
          state: currentState,
        })?.canShowContributionMode);
      }
      return Boolean(currentState?.supportsAccountContribution || getActiveFlowId(currentState) === 'openai');
    }

    function isContributionModeEnabled(currentState = getLatestState()) {
      return isContributionModeAvailable(currentState) && Boolean(currentState.accountContributionEnabled);
    }

    function hasActiveContributionSession(currentState = getLatestState()) {
      const status = normalizeStatus(currentState.contributionStatus);
      return Boolean(normalizeString(currentState.contributionSessionId) && status && !FINAL_STATUSES.has(status));
    }

    function isModeSwitchBlocked() {
      return Boolean(helpers.isModeSwitchBlocked?.(getLatestState()));
    }

    function setContributionHidden(element, hidden) {
      element?.classList.toggle('is-contribution-hidden', hidden);
    }

    function syncContributionRows(enabled) {
      hiddenRows.forEach((row) => {
        setContributionHidden(row, enabled);
      });
    }

    function syncContributionButton(enabled, blocked, available = true) {
      if (!dom.btnContributionMode) {
        return;
      }

      dom.btnContributionMode.classList.toggle('is-active', enabled);
      dom.btnContributionMode.setAttribute('aria-pressed', String(enabled));
      if (!available) {
        dom.btnContributionMode.disabled = true;
        dom.btnContributionMode.title = 'Current flow does not support contribution mode';
        return;
      }
      dom.btnContributionMode.disabled = actionInFlight;
      dom.btnContributionMode.title = enabled
        ? 'Open current flow tutorial; currently in contribution mode'
        : (blocked ? 'Open current flow tutorial; cannot enter contribution mode while current flow is running' : 'Open current flow tutorial and enter contribution mode');
    }

    function stopPolling() {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    }

    function schedulePolling(delayMs = pollIntervalMs) {
      stopPolling();
      if (!isContributionModeEnabled() || !hasActiveContributionSession()) {
        return;
      }

      pollTimer = setTimeout(() => {
        pollOnce({ silentError: true }).catch(() => {});
      }, delayMs);
    }

    function ensurePolling() {
      if (!isContributionModeEnabled() || !hasActiveContributionSession()) {
        stopPolling();
        return;
      }

      if (!pollTimer && !pollInFlight) {
        schedulePolling(1200);
      }
    }

    function getOauthStatusText(currentState = getLatestState()) {
      if (getActiveFlowId(currentState) !== 'openai') {
        const flowRuntime = getCurrentFlowContributionRuntime(currentState);
        const status = normalizeString(flowRuntime.status).toLowerCase();
        if (status === 'submitting') {
          return 'Submitting account artifact';
        }
        if (status === 'submitted') {
          return 'Account artifact submitted';
        }
        if (status === 'skipped') {
          return 'Account artifact not ready';
        }
        if (status === 'error') {
          return 'Failed to submit account artifact';
        }
        return isContributionModeEnabled(currentState) ? 'Waiting for account artifact' : 'Contribution mode not enabled';
      }
      const status = normalizeStatus(currentState.contributionStatus);
      const hasAuthUrl = Boolean(normalizeString(currentState.contributionAuthUrl));
      if (!normalizeString(currentState.contributionSessionId) || !hasAuthUrl) {
        return 'Login URL not generated';
      }
      if (status === 'waiting') {
        return 'Waiting for callback submission';
      }
      if (status === 'processing' || status === 'auto_approved' || status === 'auto_rejected') {
        return status === 'processing' ? 'Callback submitted' : 'Authorization ended';
      }
      if (status === 'expired' || status === 'error') {
        return 'Authorization failed';
      }
      if (Number(currentState.contributionAuthOpenedAt) > 0) {
        return 'Authorization page opened';
      }
      return 'Login URL generated';
    }

    function getCallbackStatusText(currentState = getLatestState()) {
      if (getActiveFlowId(currentState) !== 'openai') {
        const flowRuntime = getCurrentFlowContributionRuntime(currentState);
        return normalizeString(flowRuntime.lastMessage || flowRuntime.error) || 'Will auto-submit once account artifact is ready';
      }
      const status = normalizeCallbackStatus(currentState.contributionCallbackStatus);
      switch (status) {
        case 'captured':
          return 'Callback URL captured';
        case 'submitting':
          return 'Submitting callback';
        case 'submitted':
          return 'Callback submitted';
        case 'failed':
          return 'Callback submission failed';
        case 'waiting':
        case 'idle':
        default:
          return normalizeString(currentState.contributionCallbackUrl)
            ? 'Callback URL captured'
            : 'Waiting for callback';
      }
    }

    function getSummaryText(currentState = getLatestState()) {
      const statusMessage = normalizeString(currentState.contributionStatusMessage);
      if (statusMessage) {
        return statusMessage;
      }
      if (getActiveFlowId(currentState) !== 'openai') {
        return 'The current account will be used to support project maintenance. The extension will collect and submit account artifacts according to the current flow contribution adapter; the submission process does not depend on OpenAI OAuth configuration.';
      }
      if (getContributionSource(currentState) === CONTRIBUTION_SOURCE_SUB2API) {
        const groupName = normalizeString(currentState.contributionTargetGroupName) || CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME;
        return `The current account will be used to support project maintenance. Contributions will be completed via SUB2API and written to the ${groupName} group; if a callback URL is detected, the extension will auto-submit and wait for server confirmation.`;
      }
      return DEFAULT_COPY;
    }

    function getCurrentFlowContributionRuntime(currentState = getLatestState()) {
      const runtime = currentState?.flowContributionRuntime;
      if (!runtime || typeof runtime !== 'object') {
        return {};
      }
      const flowRuntime = runtime[getActiveFlowId(currentState)];
      return flowRuntime && typeof flowRuntime === 'object' ? flowRuntime : {};
    }

    function getContributionPortalPageUrl() {
      return normalizeString(getContributionTutorialEntry()?.portalUrl || contributionPortalUrl);
    }

    function getContributionUploadPageUrl() {
      return normalizeString(contributionUploadUrl || contributionPortalUrl);
    }

    function openContributionPortalPage() {
      const targetUrl = getContributionPortalPageUrl();
      if (!targetUrl) {
        return;
      }
      helpers.openExternalUrl?.(targetUrl);
    }

    function openContributionUploadPage() {
      const targetUrl = getContributionUploadPageUrl();
      if (!targetUrl) {
        return;
      }
      helpers.openExternalUrl?.(targetUrl);
    }

    async function syncContributionProfile(partial = {}) {
      const nickname = normalizeString(partial.nickname);
      const qq = normalizeString(partial.qq);
      if (qq && !/^\d{1,20}$/.test(qq)) {
        throw new Error('QQ must contain only digits and cannot exceed 20 characters.');
      }
      helpers.applySettingsState?.({
        ...getLatestState(),
        contributionNickname: nickname,
        contributionQq: qq,
      });
    }

    async function requestContributionMode(enabled) {
      const selectedFlowId = getActiveFlowId();
      const selectedTargetId = getActiveTargetId();
      if (typeof helpers.persistCurrentSettingsForAction === 'function') {
        await helpers.persistCurrentSettingsForAction();
      }
      const response = await runtime.sendMessage({
        type: 'SET_ACCOUNT_CONTRIBUTION_MODE',
        source: 'sidepanel',
        payload: {
          enabled: Boolean(enabled),
          flowId: selectedFlowId,
          adapterId: getContributionEntryAdapterId(),
        },
      });

      if (response?.error) {
        throw new Error(response.error);
      }
      if (!response?.state) {
        throw new Error('No latest state returned after contribution mode toggle.');
      }

      const nextState = applySelectedFlowToState(response.state, selectedFlowId, selectedTargetId);
      helpers.applySettingsState?.(nextState);
      helpers.updateStatusDisplay?.(nextState);
      render();
    }

    async function pollOnce(options = {}) {
      if (pollInFlight || !isContributionModeEnabled() || !hasActiveContributionSession()) {
        if (!hasActiveContributionSession()) {
          stopPolling();
        }
        return;
      }

      pollInFlight = true;
      try {
        const response = await runtime.sendMessage({
          type: 'POLL_FLOW_CONTRIBUTION_STATUS',
          source: 'sidepanel',
          payload: {
            reason: options.reason || 'sidepanel_poll',
          },
        });

        if (response?.error) {
          throw new Error(response.error);
        }
        if (response?.state) {
          helpers.applySettingsState?.(response.state);
          helpers.updateStatusDisplay?.(response.state);
        }
      } finally {
        pollInFlight = false;
        render();
        if (hasActiveContributionSession()) {
          schedulePolling();
        } else {
          stopPolling();
        }
      }
    }

    async function startAccountContributionFlow() {
      if (typeof helpers.startContributionAutoRun !== 'function') {
        throw new Error('Contribution mode has not yet integrated the main auto-run start capability.');
      }

      const profile = helpers.getContributionProfile?.() || {};
      const qq = normalizeString(profile.qq);
      if (qq && !/^\d{1,20}$/.test(qq)) {
        throw new Error('QQ must contain only digits and cannot exceed 20 characters.');
      }
      await syncContributionProfile(profile);
      const started = await helpers.startContributionAutoRun();
      if (!started) {
        return;
      }

      helpers.showToast?.('Contribution auto-run started.', 'info', 1800);
      render();
    }

    async function enterContributionMode() {
      await requestContributionMode(true);
      helpers.showToast?.('Entered contribution mode.', 'success', 1800);
    }

    async function exitContributionMode() {
      stopPolling();
      await requestContributionMode(false);
      helpers.showToast?.('Exited contribution mode.', 'info', 1800);
    }

    function render() {
      const currentState = getLatestState();
      const available = isContributionModeAvailable(currentState);
      const enabled = isContributionModeEnabled(currentState);
      const activeFlowId = getActiveFlowId(currentState);
      const blocked = available ? isModeSwitchBlocked() : false;
      const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
      const sourceLabel = available ? getContributionSourceLabel(currentState) : '';

      if (enabled && activeFlowId === 'openai' && dom.selectPanelMode) {
        dom.selectPanelMode.value = getContributionSource(currentState);
      }

      helpers.updatePanelModeUI?.();
      helpers.updateAccountRunHistorySettingsUI?.();

      if (dom.accountContributionPanel) {
        dom.accountContributionPanel.hidden = !available || !enabled;
      }
      if (dom.accountContributionText) {
        dom.accountContributionText.textContent = getSummaryText(currentState);
      }
      if (dom.accountContributionBadge) {
        dom.accountContributionBadge.textContent = enabled ? sourceLabel : '';
      }
      if (dom.inputContributionNickname && activeElement !== dom.inputContributionNickname) {
        const nextNickname = normalizeString(currentState.contributionNickname);
        if (nextNickname || !normalizeString(dom.inputContributionNickname.value)) {
          dom.inputContributionNickname.value = nextNickname;
        }
      }
      if (dom.inputContributionQq && activeElement !== dom.inputContributionQq) {
        const nextQq = normalizeString(currentState.contributionQq);
        if (nextQq || !normalizeString(dom.inputContributionQq.value)) {
          dom.inputContributionQq.value = nextQq;
        }
      }
      if (dom.contributionOauthStatus) {
        dom.contributionOauthStatus.textContent = getOauthStatusText(currentState);
      }
      if (dom.contributionPrimaryStatusLabel) {
        dom.contributionPrimaryStatusLabel.textContent = activeFlowId === 'openai' ? 'OAUTH' : 'Account Artifact';
      }
      if (dom.contributionCallbackStatus) {
        dom.contributionCallbackStatus.textContent = getCallbackStatusText(currentState);
      }
      if (dom.contributionSecondaryStatusLabel) {
        dom.contributionSecondaryStatusLabel.textContent = activeFlowId === 'openai' ? 'Callback' : 'Submit';
      }
      if (dom.accountContributionSummary) {
        dom.accountContributionSummary.textContent = getSummaryText(currentState);
      }

      syncContributionRows(enabled && activeFlowId === 'openai');
      syncContributionButton(enabled, blocked, available);

      if (dom.selectPanelMode) {
        dom.selectPanelMode.disabled = activeFlowId === 'openai' && available && enabled;
      }

      if (dom.btnStartContribution) {
        dom.btnStartContribution.disabled = !available || actionInFlight || blocked;
      }

      if (dom.btnOpenContributionUpload) {
        dom.btnOpenContributionUpload.hidden = !available;
        dom.btnOpenContributionUpload.disabled = !available;
        dom.btnOpenContributionUpload.textContent = 'Already have an auth file? Go to upload';
      }

      if (dom.btnExitContributionMode) {
        dom.btnExitContributionMode.disabled = !available || actionInFlight || blocked;
        dom.btnExitContributionMode.title = blocked ? 'Cannot exit contribution mode while current flow is running' : 'Exit contribution mode';
      }

      if (dom.btnOpenAccountRecords) {
        dom.btnOpenAccountRecords.disabled = enabled;
      }

      if (available && enabled) {
        helpers.closeConfigMenu?.();
        helpers.closeAccountRecordsPanel?.();
        ensurePolling();
      } else {
        stopPolling();
      }

      helpers.updateConfigMenuControls?.();
    }

    function bindEvents() {
      dom.btnContributionMode?.addEventListener('click', async () => {
        if (actionInFlight) {
          return;
        }
        actionInFlight = true;
        try {
          openContributionPortalPage();
        } catch (error) {
          helpers.showToast?.(`Failed to open portal page: ${error.message}`, 'error');
        }
        render();
        try {
          if (isContributionModeEnabled()) {
            helpers.showToast?.('Opened current flow tutorial.', 'info', 1800);
          } else if (isModeSwitchBlocked()) {
            helpers.showToast?.('Opened current flow tutorial; cannot enter contribution mode while current flow is running.', 'warning', 2200);
          } else {
            await enterContributionMode();
          }
        } catch (error) {
          helpers.showToast?.(error.message, 'error');
        } finally {
          actionInFlight = false;
          render();
        }
      });

      dom.btnStartContribution?.addEventListener('click', async () => {
        if (actionInFlight) {
          return;
        }
        actionInFlight = true;
        render();
        try {
          await startAccountContributionFlow();
        } catch (error) {
          helpers.showToast?.(error.message, 'error');
        } finally {
          actionInFlight = false;
          render();
        }
      });

      dom.inputContributionNickname?.addEventListener('change', async () => {
        try {
          await syncContributionProfile({
            nickname: dom.inputContributionNickname?.value,
            qq: dom.inputContributionQq?.value,
          });
        } catch (error) {
          helpers.showToast?.(error.message, 'error');
        } finally {
          render();
        }
      });

      dom.inputContributionQq?.addEventListener('change', async () => {
        try {
          await syncContributionProfile({
            nickname: dom.inputContributionNickname?.value,
            qq: dom.inputContributionQq?.value,
          });
        } catch (error) {
          helpers.showToast?.(error.message, 'error');
        } finally {
          render();
        }
      });

      dom.btnOpenContributionUpload?.addEventListener('click', () => {
        try {
          openContributionUploadPage();
        } catch (error) {
          helpers.showToast?.(`Failed to open upload page: ${error.message}`, 'error');
        }
      });

      dom.btnExitContributionMode?.addEventListener('click', async () => {
        if (actionInFlight) {
          return;
        }
        actionInFlight = true;
        render();
        try {
          await exitContributionMode();
        } catch (error) {
          helpers.showToast?.(error.message, 'error');
        } finally {
          actionInFlight = false;
          render();
        }
      });
    }

    return {
      bindEvents,
      pollOnce,
      render,
      stopPolling,
    };
  }

  globalScope.SidepanelContributionMode = {
    createContributionModeManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
