(function attachBackgroundAccountRunHistory(root, factory) {
  root.MultiPageBackgroundAccountRunHistory = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundAccountRunHistoryModule() {
  function createAccountRunHistoryHelpers(deps = {}) {
    const {
      ACCOUNT_RUN_HISTORY_STORAGE_KEY = 'accountRunHistory',
      addLog,
      buildLocalHelperEndpoint,
      chrome,
      getErrorMessage,
      getNodeIdByStepForState = null,
      getNodeTitleForState = null,
      getState,
      normalizeAccountRunHistoryHelperBaseUrl,
    } = deps;

    function normalizeTimestamp(value) {
      const timestamp = Date.parse(String(value || ''));
      return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function normalizeRetryCount(value) {
      const count = Math.floor(Number(value) || 0);
      return count > 0 ? count : 0;
    }

    function normalizeFinalStatus(status = '') {
      const normalized = String(status || '').trim().toLowerCase();
      if (!normalized) {
        return '';
      }
      if (normalized === 'success') {
        return 'success';
      }
      if (normalized === 'running' || /_running$/.test(normalized) || /^node:[^:]+:running$/.test(normalized)) {
        return 'running';
      }
      if (normalized === 'failed' || /_failed$/.test(normalized) || /^node:[^:]+:failed$/.test(normalized)) {
        return 'failed';
      }
      if (normalized === 'stopped' || /_stopped$/.test(normalized) || /^node:[^:]+:stopped$/.test(normalized)) {
        return 'stopped';
      }
      return '';
    }

    function normalizeNodeId(value = '') {
      return String(value || '').trim();
    }

    function extractRecordNodeFromStatus(status = '') {
      const match = String(status || '').trim().match(/^node:([^:]+):(?:running|failed|stopped)$/i);
      return match ? normalizeNodeId(match[1]) : '';
    }

    function extractRecordStepFromStatus(status = '') {
      const normalizedStatus = String(status || '').trim().toLowerCase();
      const statusMatch = normalizedStatus.match(/^step(\d+)_(?:failed|stopped)$/);
      if (statusMatch) {
        const step = Number(statusMatch[1]);
        return Number.isInteger(step) && step > 0 ? step : null;
      }

      return null;
    }

    function extractRecordStepFromDetailPrefix(detail = '') {
      const text = String(detail || '').trim();
      const detailMatch = text.match(/^(?:Step\s+(\d+)|步骤\s*(\d+))\s*(?::|：|失败|停止|已|\b)/i);
      if (!detailMatch) {
        return null;
      }

      const step = Number(detailMatch[1] || detailMatch[2]);
      return Number.isInteger(step) && step > 0 ? step : null;
    }

    function extractAnyRecordStepFromDetail(detail = '') {
      const text = String(detail || '').trim();
      const detailMatch = text.match(/(?:Step\s+(\d+)|步骤\s*(\d+))/i);
      if (!detailMatch) {
        return null;
      }

      const step = Number(detailMatch[1] || detailMatch[2]);
      return Number.isInteger(step) && step > 0 ? step : null;
    }

    function extractRecordStep(status = '', detail = '') {
      return extractRecordStepFromStatus(status) || extractRecordStepFromDetailPrefix(detail);
    }

    function parseFailureLabelStep(label = '') {
      const match = String(label || '').trim().match(/^步骤\s*(\d+)\s*(?:失败|停止)$/);
      if (!match) {
        return null;
      }
      const step = Number(match[1]);
      return Number.isInteger(step) && step > 0 ? step : null;
    }

    function parseFailureLabelNode(label = '') {
      const match = String(label || '').trim().match(/^节点\s*([A-Za-z0-9_.:-]+)\s*(?:失败|停止)$/);
      return match ? normalizeNodeId(match[1]) : '';
    }

    function shouldIgnorePersistedFailedStepCandidate(candidate, failureDetail = '') {
      if (!Number.isInteger(candidate) || candidate <= 0) {
        return true;
      }

      const text = String(failureDetail || '').trim();
      if (!text) {
        return false;
      }

      const leadingStep = extractRecordStepFromDetailPrefix(text);
      if (Number.isInteger(leadingStep) && leadingStep > 0) {
        return leadingStep !== candidate;
      }

      const incidentalStep = extractAnyRecordStepFromDetail(text);
      return incidentalStep === candidate;
    }

    function resolveNormalizedFailedStep(record = {}, failureDetail = '') {
      const explicitStatusStep = extractRecordStepFromStatus(record.finalStatus || record.status || '');
      if (Number.isInteger(explicitStatusStep) && explicitStatusStep > 0) {
        return explicitStatusStep;
      }

      const detailStep = extractRecordStepFromDetailPrefix(failureDetail);
      if (Number.isInteger(detailStep) && detailStep > 0) {
        return detailStep;
      }

      const failedStepCandidate = Number(record.failedStep);
      if (Number.isInteger(failedStepCandidate)
        && failedStepCandidate > 0
        && !shouldIgnorePersistedFailedStepCandidate(failedStepCandidate, failureDetail)) {
        return failedStepCandidate;
      }

      return null;
    }

    function resolveNormalizedFailedNodeId(record = {}, status = '', failedStep = null) {
      const explicitNodeId = normalizeNodeId(record.failedNodeId || record.failedNode || record.nodeId);
      if (explicitNodeId) {
        return explicitNodeId;
      }
      const statusNodeId = extractRecordNodeFromStatus(status || record.finalStatus || record.status || '');
      if (statusNodeId) {
        return statusNodeId;
      }
      if (Number.isInteger(failedStep) && failedStep > 0 && typeof getNodeIdByStepForState === 'function') {
        return normalizeNodeId(getNodeIdByStepForState(failedStep, record));
      }
      return '';
    }

    function resolveFailureLabel(finalStatus, rawFailureLabel = '', computedFailureLabel = '', failedNodeId = '', failedStep = null) {
      const rawLabel = String(rawFailureLabel || '').trim();
      if (finalStatus === 'stopped') {
        return computedFailureLabel;
      }
      if (finalStatus !== 'failed') {
        return rawLabel || computedFailureLabel;
      }

      const rawNodeId = parseFailureLabelNode(rawLabel);
      if (rawNodeId) {
        return rawNodeId === failedNodeId ? rawLabel : computedFailureLabel;
      }

      const rawStep = parseFailureLabelStep(rawLabel);
      if (Number.isInteger(rawStep) && rawStep > 0) {
        return rawStep === failedStep ? rawLabel : computedFailureLabel;
      }

      return rawLabel || computedFailureLabel;
    }

    function isPhoneVerificationFailure(detail = '') {
      const text = String(detail || '').trim();
      if (!text) {
        return false;
      }

      return /add[_\s-]?phone/i.test(text)
        || /手机号(?:验证|页面|页)|手机(?:号)?页面|出现手机号验证/.test(text)
        || /进入了手机号页面/.test(text);
    }

    function getNodeDisplayName(nodeId, state = {}) {
      const normalizedNodeId = normalizeNodeId(nodeId);
      if (!normalizedNodeId) {
        return '';
      }
      if (typeof getNodeTitleForState === 'function') {
        const title = String(getNodeTitleForState(normalizedNodeId, state) || '').trim();
        if (title) {
          return title;
        }
      }
      return normalizedNodeId;
    }

    function buildFailureLabel(finalStatus, failedNodeId = '', failedStep = null, failureDetail = '', state = {}) {
      if (finalStatus === 'success') {
        return 'Flow completed';
      }
      if (finalStatus === 'running') {
        return 'Running';
      }
      if (finalStatus === 'stopped') {
        if (failedNodeId) {
          return `Node ${getNodeDisplayName(failedNodeId, state)} stopped`;
        }
        if (Number.isInteger(failedStep) && failedStep > 0) {
          return `Step ${failedStep} stopped`;
        }
        return 'Flow stopped';
      }
      if (finalStatus !== 'failed') {
        return 'None';
      }
      if (isPhoneVerificationFailure(failureDetail)) {
        return 'Phone verification required';
      }
      if (failedNodeId) {
        return `Node ${getNodeDisplayName(failedNodeId, state)} failed`;
      }
      if (Number.isInteger(failedStep) && failedStep > 0) {
        return `Step ${failedStep} failed`;
      }
      return 'Flow failed';
    }

    function normalizeAccountIdentifierType(value = '') {
      return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
    }

    function normalizeAccountIdentifierValue(value = '', identifierType = 'email') {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) {
        return '';
      }
      return normalizeAccountIdentifierType(identifierType) === 'phone'
        ? normalizedValue
        : normalizedValue.toLowerCase();
    }

    function getActivationPhoneNumber(activation = null) {
      if (!activation || typeof activation !== 'object' || Array.isArray(activation)) {
        return '';
      }
      return String(
        activation.phoneNumber
        ?? activation.number
        ?? activation.phone
        ?? ''
      ).trim();
    }

    function resolveStatePhoneNumber(state = {}) {
      const identifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
      const accountIdentifierPhone = identifierType === 'phone'
        ? String(state?.accountIdentifier || '').trim()
        : '';

      return String(
        state?.phoneNumber
        || state?.signupPhoneNumber
        || accountIdentifierPhone
        || getActivationPhoneNumber(state?.signupPhoneCompletedActivation)
        || getActivationPhoneNumber(state?.signupPhoneActivation)
        || getActivationPhoneNumber(state?.currentPhoneActivation)
        || ''
      ).trim();
    }

    function normalizePhoneRecordKey(value = '') {
      const rawValue = String(value || '').trim();
      const digits = rawValue.replace(/\D+/g, '');
      return digits || rawValue.toLowerCase();
    }

    function resolveRecordIdentity(record = {}) {
      const rawEmail = String(record.email || '').trim().toLowerCase();
      const rawPhoneNumber = String(record.phoneNumber ?? record.phone ?? record.number ?? '').trim();
      const rawIdentifierType = String(record.accountIdentifierType || '').trim().toLowerCase();
      const inferredIdentifierType = rawIdentifierType === 'phone'
        ? 'phone'
        : (rawIdentifierType === 'email'
          ? 'email'
          : ((!rawEmail && rawPhoneNumber) ? 'phone' : 'email'));
      const rawAccountIdentifier = String(
        record.accountIdentifier
        || (inferredIdentifierType === 'phone' ? rawPhoneNumber : rawEmail)
        || ''
      ).trim();
      const accountIdentifierType = rawAccountIdentifier
        ? normalizeAccountIdentifierType(inferredIdentifierType)
        : (rawEmail ? 'email' : (rawPhoneNumber ? 'phone' : ''));
      const accountIdentifier = normalizeAccountIdentifierValue(
        rawAccountIdentifier || (accountIdentifierType === 'phone' ? rawPhoneNumber : rawEmail),
        accountIdentifierType || inferredIdentifierType
      );
      const email = rawEmail || (accountIdentifierType === 'email' ? accountIdentifier : '');
      const phoneNumber = rawPhoneNumber || (accountIdentifierType === 'phone' ? accountIdentifier : '');

      return {
        email,
        phoneNumber,
        accountIdentifierType,
        accountIdentifier,
      };
    }

    function buildRecordId(identifier = '', identifierType = 'email') {
      const normalizedIdentifierType = normalizeAccountIdentifierType(identifierType);
      const normalizedIdentifier = normalizeAccountIdentifierValue(identifier, normalizedIdentifierType);
      if (!normalizedIdentifier) {
        return '';
      }
      if (normalizedIdentifierType === 'phone' && /^phone:/i.test(normalizedIdentifier)) {
        return normalizedIdentifier.toLowerCase();
      }
      return normalizedIdentifierType === 'phone'
        ? `phone:${normalizedIdentifier.toLowerCase()}`
        : normalizedIdentifier;
    }

    function normalizeSource(value = '') {
      return String(value || '').trim().toLowerCase() === 'auto' ? 'auto' : 'manual';
    }

    function normalizeAutoRunContext(context) {
      if (!context || typeof context !== 'object') {
        return null;
      }

      const currentRun = Math.max(0, Math.floor(Number(context.currentRun) || 0));
      const totalRuns = Math.max(0, Math.floor(Number(context.totalRuns) || 0));
      const attemptRun = Math.max(0, Math.floor(Number(context.attemptRun) || 0));

      if (!currentRun && !totalRuns && !attemptRun) {
        return null;
      }

      return {
        currentRun,
        totalRuns,
        attemptRun,
      };
    }

    function buildAutoRunContextFromState(state = {}) {
      return normalizeAutoRunContext({
        currentRun: state.autoRunCurrentRun,
        totalRuns: state.autoRunTotalRuns,
        attemptRun: state.autoRunAttemptRun,
      });
    }

    function getRetryCountFromState(state = {}) {
      if (!Boolean(state.autoRunning)) {
        return 0;
      }

      const attemptRun = Math.max(0, Math.floor(Number(state.autoRunAttemptRun) || 0));
      return attemptRun > 1 ? attemptRun - 1 : 0;
    }

    function normalizeAccountRunHistoryRecord(record) {
      if (!record || typeof record !== 'object') {
        return null;
      }

      const identity = resolveRecordIdentity(record);
      const email = identity.email;
      const phoneNumber = identity.phoneNumber;
      const accountIdentifierType = identity.accountIdentifierType;
      const accountIdentifier = identity.accountIdentifier;
      const password = String(record.password ?? '').trim();
      const finalStatus = normalizeFinalStatus(record.finalStatus || record.status || '');

      if (!accountIdentifier || !finalStatus) {
        return null;
      }

      const finishedAt = String(record.finishedAt || record.recordedAt || '').trim();
      const failureDetail = finalStatus === 'failed' || finalStatus === 'stopped'
        ? String(record.failureDetail || record.reason || '').trim()
        : '';
      const failedStep = finalStatus === 'failed' || finalStatus === 'stopped'
        ? resolveNormalizedFailedStep(record, failureDetail)
        : null;
      const failedNodeId = finalStatus === 'failed' || finalStatus === 'stopped'
        ? resolveNormalizedFailedNodeId(record, record.finalStatus || record.status || '', failedStep)
        : '';
      const autoRunContext = normalizeAutoRunContext(record.autoRunContext);
      const retryCount = normalizeRetryCount(
        record.retryCount !== undefined
          ? record.retryCount
          : ((autoRunContext?.attemptRun || 0) > 1 ? autoRunContext.attemptRun - 1 : 0)
      );
      const source = normalizeSource(record.source || (autoRunContext ? 'auto' : 'manual'));
      const computedFailureLabel = buildFailureLabel(finalStatus, failedNodeId, failedStep, failureDetail, record);
      const rawFailureLabel = String(record.failureLabel || '').trim();
      const flowId = String(record.flowId || record.activeFlowId || '').trim();
      const runId = String(record.runId || record.activeRunId || '').trim();

      return {
        recordId: String(record.recordId || '').trim() || buildRecordId(accountIdentifier, accountIdentifierType),
        flowId,
        runId,
        accountIdentifierType,
        accountIdentifier,
        email,
        phoneNumber,
        password,
        finalStatus,
        finishedAt,
        retryCount,
        failureLabel: resolveFailureLabel(finalStatus, rawFailureLabel, computedFailureLabel, failedNodeId, failedStep),
        failureDetail,
        failedNodeId,
        failedStep: Number.isInteger(failedStep) && failedStep > 0 ? failedStep : null,
        source,
        autoRunContext: source === 'auto' ? autoRunContext : null,
        plusModeEnabled: Boolean(record.plusModeEnabled),
        accountContributionEnabled: Boolean(record.accountContributionEnabled),
      };
    }

    function normalizeAccountRunHistory(records) {
      if (!Array.isArray(records)) {
        return [];
      }

      return records
        .map((item) => normalizeAccountRunHistoryRecord(item))
        .filter(Boolean)
        .sort((left, right) => normalizeTimestamp(right.finishedAt) - normalizeTimestamp(left.finishedAt));
    }

    async function getPersistedAccountRunHistory() {
      try {
        const stored = await chrome.storage.local.get(ACCOUNT_RUN_HISTORY_STORAGE_KEY);
        return normalizeAccountRunHistory(stored[ACCOUNT_RUN_HISTORY_STORAGE_KEY]);
      } catch (err) {
        console.warn('[MultiPage:account-run-history] Failed to read account run history:', err?.message || err);
        return [];
      }
    }

    async function setPersistedAccountRunHistory(records) {
      const normalizedHistory = normalizeAccountRunHistory(records);
      await chrome.storage.local.set({
        [ACCOUNT_RUN_HISTORY_STORAGE_KEY]: normalizedHistory,
      });
      return normalizedHistory;
    }

    function buildAccountRunHistoryRecord(state = {}, status = '', reason = '') {
      const identity = resolveRecordIdentity({
        accountIdentifierType: state.accountIdentifierType,
        accountIdentifier: state.accountIdentifier,
        email: state.email,
        phoneNumber: resolveStatePhoneNumber(state),
      });
      const email = identity.email;
      const phoneNumber = identity.phoneNumber;
      const accountIdentifierType = identity.accountIdentifierType;
      const accountIdentifier = identity.accountIdentifier;
      const password = String(state.password || state.customPassword || '').trim();
      const finalStatus = normalizeFinalStatus(status);

      if (!accountIdentifier || !finalStatus) {
        return null;
      }

      const failureDetail = finalStatus === 'failed' || finalStatus === 'stopped' ? String(reason || '').trim() : '';
      const failedStep = finalStatus === 'failed' || finalStatus === 'stopped'
        ? extractRecordStep(status, failureDetail)
        : null;
      const statusNodeId = finalStatus === 'failed' || finalStatus === 'stopped'
        ? extractRecordNodeFromStatus(status)
        : '';
      const stateNodeId = finalStatus === 'failed' || finalStatus === 'stopped'
        ? normalizeNodeId(state.currentNodeId)
        : '';
      const failedNodeIdFromStep = !statusNodeId
        && !stateNodeId
        && Number.isInteger(failedStep)
        && failedStep > 0
        && typeof getNodeIdByStepForState === 'function'
        ? normalizeNodeId(getNodeIdByStepForState(failedStep, state))
        : '';
      const failedNodeId = statusNodeId || stateNodeId || failedNodeIdFromStep;
      const source = Boolean(state.autoRunning) ? 'auto' : 'manual';
      const autoRunContext = source === 'auto' ? buildAutoRunContextFromState(state) : null;
      const retryCount = source === 'auto' ? getRetryCountFromState(state) : 0;
      const finishedAt = new Date().toISOString();
      const flowId = String(state.flowId || state.activeFlowId || '').trim();
      const runId = String(state.runId || state.activeRunId || '').trim();

      return {
        recordId: buildRecordId(accountIdentifier, accountIdentifierType),
        flowId,
        runId,
        accountIdentifierType,
        accountIdentifier,
        email,
        phoneNumber,
        password,
        finalStatus,
        finishedAt,
        retryCount,
        failureLabel: buildFailureLabel(finalStatus, failedNodeId, failedStep, failureDetail, state),
        failureDetail,
        failedNodeId,
        failedStep: statusNodeId ? null : (Number.isInteger(failedStep) && failedStep > 0 ? failedStep : null),
        source,
        autoRunContext,
        plusModeEnabled: Boolean(state.plusModeEnabled),
        accountContributionEnabled: Boolean(state.accountContributionEnabled),
      };
    }

    function upsertAccountRunHistoryRecord(history, record) {
      const normalizedHistory = normalizeAccountRunHistory(history);
      if (!record) {
        return normalizedHistory;
      }

      const recordId = String(record.recordId || '').trim();
      const emailKey = String(record.email || '').trim().toLowerCase();
      const phoneKey = normalizePhoneRecordKey(record.phoneNumber);
      const identifierKey = buildRecordId(
        record.accountIdentifier || record.email || record.phoneNumber,
        record.accountIdentifierType || (phoneKey && !emailKey ? 'phone' : 'email')
      );
      const nextHistory = normalizedHistory.filter((item) => {
        const itemRecordId = String(item.recordId || '').trim();
        const itemEmailKey = String(item.email || '').trim().toLowerCase();
        const itemPhoneKey = normalizePhoneRecordKey(item.phoneNumber);
        const itemIdentifierKey = buildRecordId(
          item.accountIdentifier || item.email || item.phoneNumber,
          item.accountIdentifierType || (itemPhoneKey && !itemEmailKey ? 'phone' : 'email')
        );
        return itemRecordId !== recordId
          && itemIdentifierKey !== identifierKey
          && (!emailKey || itemEmailKey !== emailKey)
          && (!phoneKey || itemPhoneKey !== phoneKey);
      });

      nextHistory.unshift(record);
      return normalizeAccountRunHistory(nextHistory);
    }

    function deleteAccountRunHistoryEntries(history, recordIds = []) {
      const normalizedHistory = normalizeAccountRunHistory(history);
      const normalizedIds = Array.isArray(recordIds)
        ? recordIds
          .map((value) => String(value || '').trim().toLowerCase())
          .filter(Boolean)
        : [];

      if (!normalizedIds.length) {
        return {
          deletedCount: 0,
          nextHistory: normalizedHistory,
        };
      }

      const selectedIds = new Set(normalizedIds);
      const nextHistory = normalizedHistory.filter((record) => !selectedIds.has(buildRecordId(
        record.recordId || record.accountIdentifier || record.email || record.phoneNumber,
        String(record.recordId || '').startsWith('phone:') || String(record.accountIdentifierType || '').trim().toLowerCase() === 'phone'
          ? 'phone'
          : 'email'
      )));

      return {
        deletedCount: normalizedHistory.length - nextHistory.length,
        nextHistory: normalizeAccountRunHistory(nextHistory),
      };
    }

    async function appendAccountRunHistoryRecord(status, stateOverride = null, reason = '') {
      const state = stateOverride || await getState();
      const record = buildAccountRunHistoryRecord(state, status, reason);
      if (!record) {
        return null;
      }

      const history = await getPersistedAccountRunHistory();
      const nextHistory = upsertAccountRunHistoryRecord(history, record);
      await setPersistedAccountRunHistory(nextHistory);
      return record;
    }

    function summarizeAccountRunHistory(records = []) {
      return normalizeAccountRunHistory(records).reduce((summary, record) => {
        summary.total += 1;
        if (record.finalStatus === 'success') {
          summary.success += 1;
        } else if (record.finalStatus === 'running') {
          summary.running += 1;
        } else if (record.finalStatus === 'failed') {
          summary.failed += 1;
        } else if (record.finalStatus === 'stopped') {
          summary.stopped += 1;
        }
        summary.retryTotal += normalizeRetryCount(record.retryCount);
        return summary;
      }, {
        total: 0,
        success: 0,
        running: 0,
        failed: 0,
        stopped: 0,
        retryTotal: 0,
      });
    }

    function buildAccountRunHistorySnapshotPayload(records = []) {
      const normalizedHistory = normalizeAccountRunHistory(records);
      return {
        generatedAt: new Date().toISOString(),
        summary: summarizeAccountRunHistory(normalizedHistory),
        records: normalizedHistory,
      };
    }

    function shouldSyncAccountRunHistorySnapshot(state = {}) {
      if (Boolean(state.accountContributionEnabled)) {
        return false;
      }

      const helperBaseUrl = normalizeAccountRunHistoryHelperBaseUrl(state.accountRunHistoryHelperBaseUrl);
      return Boolean(helperBaseUrl);
    }

    function shouldAppendAccountRunTextFile(state = {}) {
      return shouldSyncAccountRunHistorySnapshot(state);
    }

    async function syncAccountRunHistorySnapshot(records, stateOverride = null) {
      const state = stateOverride || await getState();
      if (!shouldSyncAccountRunHistorySnapshot(state)) {
        return '';
      }

      const helperBaseUrl = normalizeAccountRunHistoryHelperBaseUrl(state.accountRunHistoryHelperBaseUrl);
      let response;
      try {
        response = await fetch(buildLocalHelperEndpoint(helperBaseUrl, '/sync-account-run-records'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(buildAccountRunHistorySnapshotPayload(records)),
        });
      } catch (err) {
        return '';
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (err) {
        throw new Error(`Account run snapshot sync failed: local helper returned unparseable response (${getErrorMessage(err)})`);
      }

      if (!response.ok || payload?.ok === false) {
        throw new Error(`Account run snapshot sync failed: ${payload?.error || `HTTP ${response.status}`}`);
      }

      return payload?.filePath || '';
    }

    async function appendAccountRunRecord(status, stateOverride = null, reason = '') {
      const state = stateOverride || await getState();
      const record = await appendAccountRunHistoryRecord(status, state, reason);
      if (!record) {
        return null;
      }

      try {
        const history = await getPersistedAccountRunHistory();
        const filePath = await syncAccountRunHistorySnapshot(history, state);
        if (filePath) {
          await addLog(`Account run snapshot synced locally: ${filePath}`, 'info');
        }
      } catch (err) {
        await addLog(getErrorMessage(err), 'warn');
      }

      return record;
    }

    async function clearAccountRunHistory(stateOverride = null) {
      const state = stateOverride || await getState();
      const history = await getPersistedAccountRunHistory();
      await setPersistedAccountRunHistory([]);

      try {
        const filePath = await syncAccountRunHistorySnapshot([], state);
        if (filePath) {
          await addLog(`Account run snapshot synced locally: ${filePath}`, 'info');
        }
      } catch (err) {
        await addLog(getErrorMessage(err), 'warn');
      }

      return {
        clearedCount: history.length,
      };
    }

    async function deleteAccountRunHistoryRecords(recordIds = [], stateOverride = null) {
      const state = stateOverride || await getState();
      const history = await getPersistedAccountRunHistory();
      const { deletedCount, nextHistory } = deleteAccountRunHistoryEntries(history, recordIds);

      if (!deletedCount) {
        return {
          deletedCount: 0,
          remainingCount: history.length,
        };
      }

      await setPersistedAccountRunHistory(nextHistory);

      try {
        const filePath = await syncAccountRunHistorySnapshot(nextHistory, state);
        if (filePath) {
          await addLog(`Account run snapshot synced locally: ${filePath}`, 'info');
        }
      } catch (err) {
        await addLog(getErrorMessage(err), 'warn');
      }

      return {
        deletedCount,
        remainingCount: nextHistory.length,
      };
    }

    return {
      appendAccountRunRecord,
      appendAccountRunHistoryRecord,
      buildAccountRunHistoryRecord,
      buildAccountRunHistorySnapshotPayload,
      clearAccountRunHistory,
      deleteAccountRunHistoryRecords,
      getPersistedAccountRunHistory,
      normalizeAccountRunHistory,
      normalizeAccountRunHistoryRecord,
      normalizeFinalStatus,
      setPersistedAccountRunHistory,
      shouldAppendAccountRunTextFile,
      shouldSyncAccountRunHistorySnapshot,
      summarizeAccountRunHistory,
      syncAccountRunHistorySnapshot,
    };
  }

  return {
    createAccountRunHistoryHelpers,
  };
});
