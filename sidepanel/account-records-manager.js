(function attachSidepanelAccountRecordsManager(globalScope) {
  function createAccountRecordsManager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
    } = context;

    const displayTimeZone = constants.displayTimeZone || 'Asia/Shanghai';
    const pageSize = Math.max(1, Math.floor(Number(constants.pageSize) || 10));

    const FILTER_CONFIG = {
      all: {
        label: 'Total',
        className: '',
        matches: () => true,
        metaLabel: 'All',
      },
      success: {
        label: 'OK',
        className: 'is-success',
        matches: (record) => getRecordDisplayStatus(record) === 'success',
        metaLabel: 'Success',
      },
      running: {
        label: 'Running',
        className: 'is-running',
        matches: (record) => getRecordDisplayStatus(record) === 'running',
        metaLabel: 'Running',
      },
      failed: {
        label: 'Failed',
        className: 'is-failed',
        matches: (record) => getRecordDisplayStatus(record) === 'failed',
        metaLabel: 'Failed',
      },
      stopped: {
        label: 'Stop',
        className: 'is-stopped',
        matches: (record) => getRecordDisplayStatus(record) === 'stopped',
        metaLabel: 'Stopped',
      },
      retry: {
        label: 'Retry',
        className: 'is-retry',
        matches: (record) => normalizeRetryCount(record.retryCount) > 0,
        metaLabel: 'Retry',
      },
    };

    let currentPage = 1;
    let activeFilter = 'all';
    let selectionMode = false;
    let eventsBound = false;
    const selectedRecordIds = new Set();

    function escapeHtml(value) {
      if (typeof helpers.escapeHtml === 'function') {
        return helpers.escapeHtml(String(value || ''));
      }
      return String(value || '');
    }

    function normalizeTimestamp(value) {
      const timestamp = Date.parse(String(value || ''));
      return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function normalizeRetryCount(value) {
      const count = Math.floor(Number(value) || 0);
      return count > 0 ? count : 0;
    }

    function buildRecordId(record = {}) {
      const rawRecordId = String(record.recordId || '').trim();
      if (rawRecordId) {
        return rawRecordId.toLowerCase();
      }
      const rawIdentifierType = String(record.accountIdentifierType || '').trim().toLowerCase();
      const hasPhoneOnlyIdentifier = !record.email && (
        record.phoneNumber
        || record.phone
        || record.number
        || (record.accountIdentifier && !/@/.test(String(record.accountIdentifier || '')))
      );
      const identifierType = rawIdentifierType === 'phone'
        || (!rawIdentifierType && hasPhoneOnlyIdentifier)
        ? 'phone'
        : 'email';
      const identifier = String(
        record.accountIdentifier
        || (identifierType === 'phone' ? (record.phoneNumber || record.phone || record.number || '') : (record.email || ''))
        || ''
      ).trim();
      if (!identifier) {
        return '';
      }
      return identifierType === 'phone'
        ? `phone:${identifier.toLowerCase()}`
        : identifier.toLowerCase();
    }

    function getRecordDisplayStatus(record = {}) {
      return String(record.displayStatus || record.finalStatus || '').trim().toLowerCase();
    }

    function isAutoRunRecordDisplayRunning(currentState = {}) {
      const phase = String(currentState.autoRunPhase || '').trim().toLowerCase();
      return Boolean(currentState.autoRunning)
        && ['running', 'waiting_step', 'waiting_email', 'retrying'].includes(phase);
    }

    function buildCurrentAccountRecordId(currentState = {}) {
      const accountIdentifierType = String(currentState.accountIdentifierType || '').trim().toLowerCase();
      const email = String(currentState.email || '').trim();
      const phoneNumber = String(
        currentState.signupPhoneNumber
        || currentState.phoneNumber
        || currentState.phone
        || ''
      ).trim();
      const accountIdentifier = String(
        currentState.accountIdentifier
        || (accountIdentifierType === 'phone' ? phoneNumber : email)
        || ''
      ).trim();
      return buildRecordId({
        accountIdentifierType,
        accountIdentifier,
        email,
        phoneNumber,
      });
    }

    function applyRunningDisplayState(record = {}, currentState = {}) {
      if (!isAutoRunRecordDisplayRunning(currentState)) {
        return record;
      }
      if (getRecordDisplayStatus(record) === 'success') {
        return record;
      }

      const currentRecordId = buildCurrentAccountRecordId(currentState);
      if (!currentRecordId || buildRecordId(record) !== currentRecordId) {
        return record;
      }

      return {
        ...record,
        displayStatus: 'running',
        displaySummary: 'Running',
      };
    }

    function getRecordIdentifierType(record = {}) {
      const rawType = String(record.accountIdentifierType || '').trim().toLowerCase();
      if (rawType === 'phone') {
        return 'phone';
      }
      if (rawType === 'email') {
        return 'email';
      }
      if (!record.email && (record.phoneNumber || record.phone || record.number)) {
        return 'phone';
      }
      if (!record.email && record.accountIdentifier && !/@/.test(String(record.accountIdentifier || ''))) {
        return 'phone';
      }
      return 'email';
    }

    function getRecordEmail(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      return String(
        record.email
        || (identifierType === 'email' ? record.accountIdentifier : '')
        || ''
      ).trim();
    }

    function getRecordPhoneNumber(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      return String(
        record.phoneNumber
        || record.phone
        || record.number
        || (identifierType === 'phone' ? record.accountIdentifier : '')
        || ''
      ).trim();
    }

    function getRecordPrimaryIdentifier(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      const email = getRecordEmail(record);
      const phoneNumber = getRecordPhoneNumber(record);
      return identifierType === 'phone'
        ? (phoneNumber || String(record.accountIdentifier || '').trim() || email)
        : (email || String(record.accountIdentifier || '').trim() || phoneNumber);
    }

    function getRecordSecondaryIdentifier(record = {}) {
      const identifierType = getRecordIdentifierType(record);
      const email = getRecordEmail(record);
      const phoneNumber = getRecordPhoneNumber(record);
      if (identifierType === 'phone' && email) {
        return `Email ${email}`;
      }
      if (identifierType !== 'phone' && phoneNumber) {
        return `Bound Phone ${phoneNumber}`;
      }
      return '';
    }

    function getRecordTitle(record = {}) {
      const primaryIdentifier = getRecordPrimaryIdentifier(record) || '(empty account)';
      const secondaryIdentifier = getRecordSecondaryIdentifier(record);
      return secondaryIdentifier
        ? `${primaryIdentifier} / ${secondaryIdentifier}`
        : primaryIdentifier;
    }

    function getAccountRunRecords(currentState = state.getLatestState()) {
      return (Array.isArray(currentState?.accountRunHistory) ? currentState.accountRunHistory : [])
        .filter((item) => item && typeof item === 'object')
        .slice()
        .sort((left, right) => normalizeTimestamp(right.finishedAt) - normalizeTimestamp(left.finishedAt))
        .map((record) => applyRunningDisplayState(record, currentState));
    }

    function summarizeAccountRunHistory(records = []) {
      return records.reduce((summary, record) => {
        const retryCount = normalizeRetryCount(record.retryCount);
        const status = getRecordDisplayStatus(record);
        summary.total += 1;
        if (status === 'success') {
          summary.success += 1;
        } else if (status === 'running') {
          summary.running += 1;
        } else if (status === 'failed') {
          summary.failed += 1;
        } else if (status === 'stopped') {
          summary.stopped += 1;
        }
        if (retryCount > 0) {
          summary.retryRecordCount += 1;
        }
        summary.retryTotal += retryCount;
        return summary;
      }, {
        total: 0,
        success: 0,
        running: 0,
        failed: 0,
        stopped: 0,
        retryRecordCount: 0,
        retryTotal: 0,
      });
    }

    function formatAccountRecordTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '--:--';
      }

      const now = new Date();
      const sameYear = date.getFullYear() === now.getFullYear();
      const sameDay = date.toDateString() === now.toDateString();

      if (sameDay) {
        return date.toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          timeZone: displayTimeZone,
        });
      }

      return date.toLocaleString('zh-CN', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        ...(sameYear ? {} : { year: '2-digit' }),
        timeZone: displayTimeZone,
      }).replace(/\//g, '-');
    }

    function getStatusMeta(record = {}) {
      const status = getRecordDisplayStatus(record);
      if (status === 'success') {
        return { kind: 'success', label: 'Success' };
      }
      if (status === 'running') {
        return { kind: 'running', label: 'Running' };
      }
      if (status === 'stopped') {
        return { kind: 'stopped', label: 'Stopped' };
      }
      return { kind: 'failed', label: 'Failed' };
    }

    function getRecordSummaryText(record = {}) {
      const status = getRecordDisplayStatus(record);
      if (record.displaySummary) {
        return String(record.displaySummary || '').trim();
      }
      if (status === 'success') {
        return 'Flow completed';
      }
      if (status === 'running') {
        return 'Running';
      }

      return String(record.failureDetail || record.reason || '').trim()
        || String(record.failureLabel || '').trim()
        || 'Flow failed';
    }

    function getRecordTooltipText(record = {}, summaryText = '') {
      const recordTitle = getRecordTitle(record);
      const status = getRecordDisplayStatus(record);
      const detail = String(record.displaySummary || record.failureDetail || record.reason || '').trim();
      if (status === 'success' || status === 'running' || !detail || detail === recordTitle) {
        return recordTitle;
      }
      return `${recordTitle}\n${detail}`;
    }

    function getFilterConfig(filterKey = activeFilter) {
      return FILTER_CONFIG[filterKey] || FILTER_CONFIG.all;
    }

    function getFilteredRecords(records = []) {
      const filterConfig = getFilterConfig(activeFilter);
      return records.filter((record) => filterConfig.matches(record));
    }

    function pruneSelectedRecordIds(records = []) {
      const availableIds = new Set(records.map((record) => buildRecordId(record)).filter(Boolean));
      for (const recordId of Array.from(selectedRecordIds)) {
        if (!availableIds.has(recordId)) {
          selectedRecordIds.delete(recordId);
        }
      }
    }

    function setNodeHidden(node, hidden) {
      if (node) {
        node.hidden = Boolean(hidden);
      }
    }

    function setNodeDisabled(node, disabled) {
      if (node) {
        node.disabled = Boolean(disabled);
      }
    }

    function toggleNodeClass(node, className, enabled) {
      if (!node || !className) {
        return;
      }
      if (node.classList && typeof node.classList.toggle === 'function') {
        node.classList.toggle(className, Boolean(enabled));
      }
    }

    function setNodeText(node, value) {
      if (node) {
        node.textContent = String(value || '');
      }
    }

    function setNodeAttr(node, name, value) {
      if (!node || !name) {
        return;
      }
      if (typeof node.setAttribute === 'function') {
        node.setAttribute(name, String(value));
        return;
      }
      node[name] = value;
    }

    function getDatasetValue(node, attrName) {
      if (!node || !attrName) {
        return '';
      }

      if (typeof node.getAttribute === 'function') {
        return String(node.getAttribute(attrName) || '');
      }

      const dataKey = attrName
        .replace(/^data-/, '')
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      return String(node.dataset?.[dataKey] || '');
    }

    function findClosest(target, selector) {
      if (!target || typeof target.closest !== 'function') {
        return null;
      }
      try {
        return target.closest(selector);
      } catch {
        return null;
      }
    }

    function createStatChip(filterKey, value) {
      const filterConfig = getFilterConfig(filterKey);
      const classNames = [
        'account-records-stat',
        filterConfig.className,
        activeFilter === filterKey ? 'is-active' : '',
      ].filter(Boolean).join(' ');

      return `
        <button
          type="button"
          class="${classNames}"
          data-account-record-filter="${escapeHtml(filterKey)}"
          aria-pressed="${activeFilter === filterKey ? 'true' : 'false'}"
        >
          <strong>${escapeHtml(String(value))}</strong>${escapeHtml(filterConfig.label)}
        </button>
      `;
    }

    function updateHeader(allRecords, filteredRecords) {
      if (!dom.accountRecordsMeta) {
        return;
      }

      if (!allRecords.length) {
        dom.accountRecordsMeta.textContent = 'No account records';
        return;
      }

      const latestTime = formatAccountRecordTime(allRecords[0]?.finishedAt);
      let metaText = `Total ${allRecords.length}, last updated at ${latestTime}`;

      if (activeFilter !== 'all') {
        metaText = `Total ${allRecords.length}, current filter ${getFilterConfig(activeFilter).metaLabel} ${filteredRecords.length}, last updated at ${latestTime}`;
      }

      if (selectionMode) {
        metaText += `, selected ${selectedRecordIds.size}`;
      }

      dom.accountRecordsMeta.textContent = metaText;
    }

    function updateStats(allRecords) {
      if (!dom.accountRecordsStats) {
        return;
      }

      const summary = summarizeAccountRunHistory(allRecords);
      dom.accountRecordsStats.innerHTML = [
        createStatChip('all', summary.total),
        createStatChip('running', summary.running),
        createStatChip('success', summary.success),
        createStatChip('failed', summary.failed),
        createStatChip('stopped', summary.stopped),
        createStatChip('retry', summary.retryTotal),
      ].join('');
    }

    function updateToolbarState(allRecords) {
      const totalRecords = allRecords.length;
      setNodeDisabled(dom.btnClearAccountRecords, totalRecords === 0);
      setNodeDisabled(dom.btnToggleAccountRecordsSelection, totalRecords === 0);
      setNodeHidden(dom.btnClearAccountRecords, selectionMode);
      toggleNodeClass(dom.btnToggleAccountRecordsSelection, 'is-active', selectionMode);
      setNodeAttr(dom.btnToggleAccountRecordsSelection, 'aria-pressed', selectionMode ? 'true' : 'false');
      setNodeText(dom.btnToggleAccountRecordsSelection, selectionMode ? 'Cancel Multi-select' : 'Multi-select');

      const selectedCount = selectedRecordIds.size;
      setNodeHidden(dom.btnDeleteSelectedAccountRecords, !selectionMode);
      setNodeDisabled(dom.btnDeleteSelectedAccountRecords, selectedCount === 0);
      setNodeText(
        dom.btnDeleteSelectedAccountRecords,
        selectedCount > 0 ? `Delete Selected(${selectedCount})` : 'Delete Selected'
      );
    }

    function updatePagination(totalRecords) {
      const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / pageSize) : 0;
      if (totalPages === 0) {
        currentPage = 1;
      } else if (currentPage > totalPages) {
        currentPage = totalPages;
      } else if (currentPage < 1) {
        currentPage = 1;
      }

      setNodeText(dom.accountRecordsPageLabel, totalPages > 0 ? `${currentPage} / ${totalPages}` : '0 / 0');
      setNodeDisabled(dom.btnAccountRecordsPrev, totalPages <= 1 || currentPage <= 1);
      setNodeDisabled(dom.btnAccountRecordsNext, totalPages <= 1 || currentPage >= totalPages);

      return totalPages;
    }

    function renderEmptyState(allRecords) {
      if (!dom.accountRecordsList) {
        return;
      }

      const message = allRecords.length
        ? `No records under current filter "${getFilterConfig(activeFilter).metaLabel}"`
        : 'No account records';
      dom.accountRecordsList.innerHTML = `<div class="account-records-empty">${escapeHtml(message)}</div>`;
    }

    function renderRecordList(allRecords, filteredRecords) {
      if (!dom.accountRecordsList) {
        return;
      }

      const totalPages = updatePagination(filteredRecords.length);
      if (!filteredRecords.length) {
        renderEmptyState(allRecords);
        return;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const visibleRecords = filteredRecords.slice(startIndex, startIndex + pageSize);

      dom.accountRecordsList.innerHTML = visibleRecords.map((record) => {
        const recordId = buildRecordId(record);
        const primaryIdentifier = getRecordPrimaryIdentifier(record) || '(empty account)';
        const secondaryIdentifier = getRecordSecondaryIdentifier(record);
        const statusMeta = getStatusMeta(record);
        const summaryText = getRecordSummaryText(record);
        const recordTitle = getRecordTooltipText(record, summaryText);
        const retryCount = normalizeRetryCount(record.retryCount);
        const isSelected = selectedRecordIds.has(recordId);
        const itemClassNames = [
          'account-record-item',
          `is-${statusMeta.kind}`,
          selectionMode ? 'is-selectable' : '',
          isSelected ? 'is-selected' : '',
        ].filter(Boolean).join(' ');
        const selectionMarkup = selectionMode
          ? `
              <label class="account-record-item-check" data-account-record-toggle="${escapeHtml(recordId)}">
                <input
                  type="checkbox"
                  data-account-record-checkbox="${escapeHtml(recordId)}"
                  ${isSelected ? 'checked' : ''}
                />
              </label>
            `
          : '';

        return `
          <div
            class="${itemClassNames}"
            data-account-record-id="${escapeHtml(recordId)}"
            title="${escapeHtml(recordTitle)}"
          >
            <div class="account-record-item-top">
              <div class="account-record-item-email-row">
                ${selectionMarkup}
                <div class="account-record-item-identity">
                  <div class="account-record-item-email mono">${escapeHtml(primaryIdentifier)}</div>
                  ${secondaryIdentifier ? `<div class="account-record-item-secondary mono">${escapeHtml(secondaryIdentifier)}</div>` : ''}
                </div>
              </div>
              <div class="account-record-item-side">
                <span class="account-record-item-status">${escapeHtml(statusMeta.label)}</span>
                <span class="account-record-item-time mono">${escapeHtml(formatAccountRecordTime(record.finishedAt))}</span>
              </div>
            </div>
            <div class="account-record-item-bottom">
              <div class="account-record-item-summary">${escapeHtml(summaryText)}</div>
              <span class="account-record-item-retry mono">Retry ${escapeHtml(String(retryCount))}</span>
            </div>
          </div>
        `;
      }).join('');

      if (totalPages <= 1) {
        setNodeText(dom.accountRecordsPageLabel, '1 / 1');
      }
    }

    function render(currentState = state.getLatestState()) {
      const allRecords = getAccountRunRecords(currentState);
      pruneSelectedRecordIds(allRecords);

      if (!allRecords.length) {
        selectionMode = false;
      }

      const filteredRecords = getFilteredRecords(allRecords);
      updateHeader(allRecords, filteredRecords);
      updateStats(allRecords);
      updateToolbarState(allRecords);
      renderRecordList(allRecords, filteredRecords);
    }

    function openPanel() {
      setNodeHidden(dom.accountRecordsOverlay, false);
      render();
    }

    function closePanel() {
      setNodeHidden(dom.accountRecordsOverlay, true);
    }

    function resetSelection() {
      selectedRecordIds.clear();
    }

    function setSelectionMode(nextValue) {
      const nextSelectionMode = Boolean(nextValue);
      if (!nextSelectionMode) {
        resetSelection();
      }
      selectionMode = nextSelectionMode;
      currentPage = 1;
      render();
    }

    function toggleSelectionMode() {
      setSelectionMode(!selectionMode);
    }

    function toggleRecordSelection(recordId, forceSelected = null) {
      const normalizedRecordId = String(recordId || '').trim().toLowerCase();
      if (!selectionMode || !normalizedRecordId) {
        return;
      }

      const shouldSelect = forceSelected === null
        ? !selectedRecordIds.has(normalizedRecordId)
        : Boolean(forceSelected);

      if (shouldSelect) {
        selectedRecordIds.add(normalizedRecordId);
      } else {
        selectedRecordIds.delete(normalizedRecordId);
      }
    }

    async function clearRecords() {
      const records = getAccountRunRecords();
      if (!records.length) {
        helpers.showToast?.('No account records to clear.', 'warn', 1800);
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: 'Clear Account Records',
        message: 'Are you sure you want to clear all current account records? This will also clear panel records and local sync snapshots.',
        confirmLabel: 'Confirm Clear',
        confirmVariant: 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'CLEAR_ACCOUNT_RUN_HISTORY',
        source: 'sidepanel',
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      activeFilter = 'all';
      currentPage = 1;
      selectionMode = false;
      resetSelection();
      state.syncLatestState({ accountRunHistory: [] });
      helpers.showToast?.(`Cleared ${Math.max(0, Number(response?.clearedCount) || 0)} account records.`, 'success', 2200);
    }

    async function deleteSelectedRecords() {
      const recordIds = Array.from(selectedRecordIds).filter(Boolean);
      if (!recordIds.length) {
        helpers.showToast?.('Please select account records to delete first.', 'warn', 1800);
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: 'Delete Selected Records',
        message: `Are you sure you want to delete ${recordIds.length} selected account records? This will sync update the local helper snapshot.`,
        confirmLabel: 'Confirm Delete',
        confirmVariant: 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'DELETE_ACCOUNT_RUN_HISTORY_RECORDS',
        source: 'sidepanel',
        payload: {
          recordIds,
        },
      });
      if (response?.error) {
        throw new Error(response.error);
      }

      const existingRecords = getAccountRunRecords();
      const selectedIds = new Set(recordIds);
      const nextRecords = existingRecords.filter((record) => !selectedIds.has(buildRecordId(record)));

      resetSelection();
      state.syncLatestState({ accountRunHistory: nextRecords });
      helpers.showToast?.(`Deleted ${Math.max(0, Number(response?.deletedCount) || 0)} account records.`, 'success', 2200);
    }

    function handleStatsClick(event) {
      const filterNode = findClosest(event?.target, '[data-account-record-filter]');
      if (!filterNode) {
        return;
      }

      const nextFilter = getDatasetValue(filterNode, 'data-account-record-filter');
      if (!FILTER_CONFIG[nextFilter]) {
        return;
      }

      activeFilter = activeFilter === nextFilter && nextFilter !== 'all'
        ? 'all'
        : nextFilter;
      currentPage = 1;
      render();
    }

    function handleRecordListClick(event) {
      if (!selectionMode) {
        return;
      }

      const toggleNode = findClosest(event?.target, '[data-account-record-toggle]');
      if (toggleNode) {
        const recordId = getDatasetValue(toggleNode, 'data-account-record-toggle');
        const explicitChecked = typeof event?.target?.checked === 'boolean' ? event.target.checked : null;
        toggleRecordSelection(recordId, explicitChecked);
        render();
        return;
      }

      const recordNode = findClosest(event?.target, '[data-account-record-id]');
      if (!recordNode) {
        return;
      }

      toggleRecordSelection(getDatasetValue(recordNode, 'data-account-record-id'));
      render();
    }

    function bindEvents() {
      if (eventsBound) {
        return;
      }
      eventsBound = true;

      dom.btnOpenAccountRecords?.addEventListener('click', () => {
        openPanel();
      });
      dom.btnCloseAccountRecords?.addEventListener('click', () => {
        closePanel();
      });
      dom.accountRecordsOverlay?.addEventListener('click', (event) => {
        if (event.target === dom.accountRecordsOverlay) {
          closePanel();
        }
      });
      dom.accountRecordsStats?.addEventListener('click', (event) => {
        handleStatsClick(event);
      });
      dom.accountRecordsList?.addEventListener('click', (event) => {
        handleRecordListClick(event);
      });
      dom.btnAccountRecordsPrev?.addEventListener('click', () => {
        if (currentPage <= 1) {
          return;
        }
        currentPage -= 1;
        render();
      });
      dom.btnAccountRecordsNext?.addEventListener('click', () => {
        currentPage += 1;
        render();
      });
      dom.btnToggleAccountRecordsSelection?.addEventListener('click', () => {
        toggleSelectionMode();
      });
      dom.btnDeleteSelectedAccountRecords?.addEventListener('click', async () => {
        try {
          await deleteSelectedRecords();
        } catch (error) {
          helpers.showToast?.(`Failed to delete account records: ${error.message}`, 'error');
        }
      });
      dom.btnClearAccountRecords?.addEventListener('click', async () => {
        try {
          await clearRecords();
        } catch (error) {
          helpers.showToast?.(`Failed to clear account records: ${error.message}`, 'error');
        }
      });
    }

    function reset() {
      currentPage = 1;
      activeFilter = 'all';
      selectionMode = false;
      resetSelection();
      closePanel();
      render();
    }

    return {
      bindEvents,
      clearRecords,
      closePanel,
      deleteSelectedRecords,
      openPanel,
      render,
      reset,
      setSelectionMode,
      summarizeAccountRunHistory,
      toggleSelectionMode,
    };
  }

  globalScope.SidepanelAccountRecordsManager = {
    createAccountRecordsManager,
  };
})(typeof window !== 'undefined' ? window : globalThis);
