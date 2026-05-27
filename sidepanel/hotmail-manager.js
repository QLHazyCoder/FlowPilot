(function attachSidepanelHotmailManager(globalScope) {
  function createHotmailManager(context = {}) {
    const {
      state,
      dom,
      helpers,
      runtime,
      constants = {},
      hotmailUtils = {},
    } = context;

    const expandedStorageKey = constants.expandedStorageKey || 'multipage-hotmail-list-expanded';
    const displayTimeZone = constants.displayTimeZone || 'Asia/Shanghai';
    const copyIcon = constants.copyIcon || '';
    const createAccountPoolFormController = globalScope.SidepanelAccountPoolUi?.createAccountPoolFormController;

    let actionInFlight = false;
    let listExpanded = false;
    let searchTerm = '';
    let filterMode = 'all';

    function getHotmailAccountsByUsage(mode = 'all', currentState = state.getLatestState()) {
      const accounts = helpers.getHotmailAccounts(currentState);
      if (typeof hotmailUtils.filterHotmailAccountsByUsage === 'function') {
        return hotmailUtils.filterHotmailAccountsByUsage(accounts, mode);
      }
      if (mode === 'used') {
        return accounts.filter((account) => Boolean(account?.used));
      }
      return accounts.slice();
    }

    function getHotmailBulkActionText(mode, count) {
      if (typeof hotmailUtils.getHotmailBulkActionLabel === 'function') {
        return hotmailUtils.getHotmailBulkActionLabel(mode, count);
      }
      const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
      const prefix = mode === 'used' ? 'Clear Used' : 'Delete All';
      const suffix = normalizedCount > 0 ? `(${normalizedCount})` : '';
      return `${prefix}${suffix}`;
    }

    function getHotmailListToggleText(expanded, count) {
      if (typeof hotmailUtils.getHotmailListToggleLabel === 'function') {
        return hotmailUtils.getHotmailListToggleLabel(expanded, count);
      }
      const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
      const suffix = normalizedCount > 0 ? `(${normalizedCount})` : '';
      return `${expanded ? 'Collapse List' : 'Expand List'}${suffix}`;
    }

    function updateHotmailListViewport() {
      const count = helpers.getHotmailAccounts().length;
      const usedCount = getHotmailAccountsByUsage('used').length;
      if (dom.btnClearUsedHotmailAccounts) {
        dom.btnClearUsedHotmailAccounts.textContent = getHotmailBulkActionText('used', usedCount);
        dom.btnClearUsedHotmailAccounts.disabled = usedCount === 0;
      }
      if (dom.btnDeleteAllHotmailAccounts) {
        dom.btnDeleteAllHotmailAccounts.textContent = getHotmailBulkActionText('all', count);
        dom.btnDeleteAllHotmailAccounts.disabled = count === 0;
      }
      if (dom.btnToggleHotmailList) {
        dom.btnToggleHotmailList.textContent = getHotmailListToggleText(listExpanded, count);
        dom.btnToggleHotmailList.setAttribute('aria-expanded', String(listExpanded));
        dom.btnToggleHotmailList.disabled = count === 0;
      }
      if (dom.hotmailListShell) {
        dom.hotmailListShell.classList.toggle('is-expanded', listExpanded);
        dom.hotmailListShell.classList.toggle('is-collapsed', !listExpanded);
      }
    }

    function setHotmailListExpanded(expanded, options = {}) {
      const { persist = true } = options;
      listExpanded = Boolean(expanded);
      updateHotmailListViewport();
      if (persist) {
        localStorage.setItem(expandedStorageKey, listExpanded ? '1' : '0');
      }
    }

    function initHotmailListExpandedState() {
      const saved = localStorage.getItem(expandedStorageKey);
      setHotmailListExpanded(saved === '1', { persist: false });
    }

    function shouldClearCurrentHotmailSelectionLocally(account) {
      if (typeof hotmailUtils.shouldClearHotmailCurrentSelection === 'function') {
        return hotmailUtils.shouldClearHotmailCurrentSelection(account);
      }
      return Boolean(account) && account.used === true;
    }

    function upsertHotmailAccountListLocally(accounts, nextAccount) {
      if (typeof hotmailUtils.upsertHotmailAccountInList === 'function') {
        return hotmailUtils.upsertHotmailAccountInList(accounts, nextAccount);
      }

      const list = Array.isArray(accounts) ? accounts.slice() : [];
      if (!nextAccount?.id) return list;

      const existingIndex = list.findIndex((account) => account?.id === nextAccount.id);
      if (existingIndex === -1) {
        list.push(nextAccount);
        return list;
      }

      list[existingIndex] = nextAccount;
      return list;
    }

    function refreshHotmailSelectionUI() {
      renderHotmailAccounts();
      if (dom.selectMailProvider.value === 'hotmail-api') {
        dom.inputEmail.value = helpers.getCurrentHotmailEmail();
      }
    }

    function applyHotmailAccountMutation(account, options = {}) {
      if (!account?.id) return;
      const { preserveCurrentSelection = false } = options;

      const latestState = state.getLatestState();
      const nextState = {
        hotmailAccounts: upsertHotmailAccountListLocally(helpers.getHotmailAccounts(), account),
      };

      if (!preserveCurrentSelection
        && latestState?.currentHotmailAccountId === account.id
        && shouldClearCurrentHotmailSelectionLocally(account)) {
        nextState.currentHotmailAccountId = null;
        if (dom.selectMailProvider.value === 'hotmail-api') {
          nextState.email = null;
        }
      }

      state.syncLatestState(nextState);
      refreshHotmailSelectionUI();
    }

    function formatDateTime(timestamp) {
      const value = Number(timestamp);
      if (!Number.isFinite(value) || value <= 0) {
        return 'Not used';
      }
      return new Date(value).toLocaleString('zh-CN', {
        hour12: false,
        timeZone: displayTimeZone,
      });
    }

    function getHotmailAvailabilityLabel(account) {
      if (account.used) return 'Used';
      return 'Available';
    }

    function getHotmailStatusLabel(account) {
      if (account.used) return 'Used';

      switch (account.status) {
        case 'authorized':
          return 'OK';
        case 'error':
          return 'Error';
        default:
          return 'Pending';
      }
    }

    function getHotmailStatusClass(account) {
      if (account.used) return 'status-used';
      return `status-${account.status || 'pending'}`;
    }

    function normalizeSearchText(value = '') {
      return String(value || '').trim().toLowerCase();
    }

    function getFilteredHotmailAccounts(accounts, currentId = '') {
      const normalizedSearchTerm = normalizeSearchText(searchTerm);
      return accounts.filter((account) => {
        const isCurrent = Boolean(currentId) && account.id === currentId;
        const matchesFilter = (() => {
          switch (filterMode) {
            case 'current': return isCurrent;
            case 'available': return !account.used;
            case 'used': return Boolean(account.used);
            case 'error': return account.status === 'error';
            default: return true;
          }
        })();

        if (!matchesFilter) return false;
        if (!normalizedSearchTerm) return true;

        const haystack = [
          account.email,
          account.status,
          getHotmailAvailabilityLabel(account),
          getHotmailStatusLabel(account),
          isCurrent ? 'current' : '',
        ].join(' ').toLowerCase();

        return haystack.includes(normalizedSearchTerm);
      });
    }

    function clearHotmailForm() {
      dom.inputHotmailEmail.value = '';
      dom.inputHotmailClientId.value = '';
      dom.inputHotmailPassword.value = '';
      dom.inputHotmailRefreshToken.value = '';
    }

    const formController = typeof createAccountPoolFormController === 'function'
      ? createAccountPoolFormController({
        formShell: dom.hotmailFormShell,
        toggleButton: dom.btnToggleHotmailForm,
        hiddenLabel: 'Add Account',
        visibleLabel: 'Cancel Add',
        onClear: () => {
          clearHotmailForm();
        },
        onFocus: () => {
          dom.inputHotmailEmail?.focus?.();
        },
      })
      : {
        isVisible: () => false,
        setVisible() {},
        sync() {},
      };

    function renderHotmailAccounts() {
      if (!dom.hotmailAccountsList) return;
      const latestState = state.getLatestState();
      const accounts = helpers.getHotmailAccounts();
      const currentId = latestState?.currentHotmailAccountId || '';

      if (!accounts.length) {
        dom.hotmailAccountsList.innerHTML = '<div class="hotmail-empty">No Hotmail accounts yet. Add one before verifying.</div>';
        updateHotmailListViewport();
        return;
      }

      const visibleAccounts = getFilteredHotmailAccounts(accounts, currentId);
      if (!visibleAccounts.length) {
        dom.hotmailAccountsList.innerHTML = '<div class="hotmail-empty">No Hotmail accounts match the current filter.</div>';
        updateHotmailListViewport();
        return;
      }

      dom.hotmailAccountsList.innerHTML = visibleAccounts.map((account) => `
        <div class="hotmail-account-item${account.id === currentId ? ' is-current' : ''}">
          <div class="hotmail-account-top">
            <div class="hotmail-account-title-row">
              <div class="hotmail-account-email">${helpers.escapeHtml(account.email || '(unnamed account)')}</div>
              <button
                class="hotmail-copy-btn"
                type="button"
                data-account-action="copy-email"
                data-account-id="${helpers.escapeHtml(account.id)}"
                title="Copy email"
                aria-label="Copy email ${helpers.escapeHtml(account.email || '')}"
              >${copyIcon}</button>
            </div>
            <span class="hotmail-status-chip ${helpers.escapeHtml(getHotmailStatusClass(account))}">${helpers.escapeHtml(getHotmailStatusLabel(account))}</span>
          </div>
          <div class="hotmail-account-meta">
            <span>Client ID: ${helpers.escapeHtml(account.clientId ? `${account.clientId.slice(0, 10)}...` : 'Not filled')}</span>
            <span>Refresh Token: ${account.refreshToken ? 'Saved' : 'Not saved'}</span>
            <span>Allocation Status: ${helpers.escapeHtml(getHotmailAvailabilityLabel(account))}</span>
            <span>Last Verified: ${helpers.escapeHtml(formatDateTime(account.lastAuthAt))}</span>
            <span>Last Used: ${helpers.escapeHtml(formatDateTime(account.lastUsedAt))}</span>
          </div>
          ${account.lastError ? `<div class="hotmail-account-error">${helpers.escapeHtml(account.lastError)}</div>` : ''}
          <div class="hotmail-account-actions">
            <button class="btn btn-outline btn-sm" type="button" data-account-action="select" data-account-id="${helpers.escapeHtml(account.id)}">Use this account</button>
            <button class="btn btn-outline btn-sm" type="button" data-account-action="toggle-used" data-account-id="${helpers.escapeHtml(account.id)}">${account.used ? 'Mark Unused' : 'Mark Used'}</button>
            <button class="btn btn-primary btn-sm" type="button" data-account-action="verify" data-account-id="${helpers.escapeHtml(account.id)}">Verify</button>
            <button class="btn btn-outline btn-sm" type="button" data-account-action="test" data-account-id="${helpers.escapeHtml(account.id)}">Copy latest code</button>
            <button class="btn btn-ghost btn-sm" type="button" data-account-action="delete" data-account-id="${helpers.escapeHtml(account.id)}">Delete</button>
          </div>
        </div>
      `).join('');
      updateHotmailListViewport();
    }

    async function deleteHotmailAccountsByMode(mode) {
      const isUsedMode = mode === 'used';
      const targetAccounts = getHotmailAccountsByUsage(isUsedMode ? 'used' : 'all');
      if (!targetAccounts.length) {
        helpers.showToast(isUsedMode ? 'No used accounts to clear.' : 'No Hotmail accounts to delete.', 'warn');
        return;
      }

      const confirmed = await helpers.openConfirmModal({
        title: isUsedMode ? 'Clear Used Accounts' : 'Delete All Accounts',
        message: isUsedMode
          ? `Are you sure you want to delete the ${targetAccounts.length} currently used Hotmail accounts?`
          : `Are you sure you want to delete all ${targetAccounts.length} Hotmail accounts?`,
        confirmLabel: isUsedMode ? 'Confirm Clear Used' : 'Confirm Delete All',
        confirmVariant: isUsedMode ? 'btn-outline' : 'btn-danger',
      });
      if (!confirmed) {
        return;
      }

      const response = await runtime.sendMessage({
        type: 'DELETE_HOTMAIL_ACCOUNTS',
        source: 'sidepanel',
        payload: { mode: isUsedMode ? 'used' : 'all' },
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      const latestState = state.getLatestState();
      const targetIds = new Set(targetAccounts.map((account) => account.id));
      const nextAccounts = isUsedMode
        ? helpers.getHotmailAccounts().filter((account) => !targetIds.has(account.id))
        : [];
      const nextState = { hotmailAccounts: nextAccounts };
      if (latestState?.currentHotmailAccountId && targetIds.has(latestState.currentHotmailAccountId)) {
        nextState.currentHotmailAccountId = null;
        if (dom.selectMailProvider.value === 'hotmail-api') {
          nextState.email = null;
        }
      }
      state.syncLatestState(nextState);
      refreshHotmailSelectionUI();

      helpers.showToast(
        isUsedMode
          ? `Cleared ${response.deletedCount || 0} used Hotmail accounts`
          : `Deleted all ${response.deletedCount || 0} Hotmail accounts`,
        'success',
        2200
      );
    }

    async function handleAddHotmailAccount() {
      if (actionInFlight) return;

      const email = dom.inputHotmailEmail.value.trim();
      const clientId = dom.inputHotmailClientId.value.trim();
      const refreshToken = dom.inputHotmailRefreshToken.value.trim();
      if (!email) {
        helpers.showToast('Please fill in the Hotmail email first.', 'warn');
        return;
      }
      if (!clientId) {
        helpers.showToast('Please fill in the Microsoft app client ID first.', 'warn');
        return;
      }
      if (!refreshToken) {
        helpers.showToast('Please fill in the refresh token first.', 'warn');
        return;
      }

      actionInFlight = true;
      dom.btnAddHotmailAccount.disabled = true;

      try {
        const response = await runtime.sendMessage({
          type: 'UPSERT_HOTMAIL_ACCOUNT',
          source: 'sidepanel',
          payload: {
            email,
            clientId,
            password: dom.inputHotmailPassword.value,
            refreshToken,
          },
        });

        if (response?.error) {
          throw new Error(response.error);
        }

        helpers.showToast(`Saved Hotmail account ${email}`, 'success', 1800);
        formController.setVisible(false, { clearForm: true });
      } catch (err) {
        helpers.showToast(`Failed to save Hotmail account: ${err.message}`, 'error');
      } finally {
        actionInFlight = false;
        dom.btnAddHotmailAccount.disabled = false;
      }
    }

    async function handleImportHotmailAccounts() {
      if (actionInFlight) return;
      if (typeof hotmailUtils.parseHotmailImportText !== 'function') {
        helpers.showToast('Import parser not loaded, please refresh the extension and retry.', 'error');
        return;
      }

      const rawText = dom.inputHotmailImport.value.trim();
      if (!rawText) {
        helpers.showToast('Please paste the account import content first.', 'warn');
        return;
      }

      const parsedAccounts = hotmailUtils.parseHotmailImportText(rawText);
      if (!parsedAccounts.length) {
        helpers.showToast('No valid accounts parsed. Please check format: account----password----ID----Token.', 'error');
        return;
      }

      actionInFlight = true;
      dom.btnImportHotmailAccounts.disabled = true;

      try {
        for (const account of parsedAccounts) {
          const response = await runtime.sendMessage({
            type: 'UPSERT_HOTMAIL_ACCOUNT',
            source: 'sidepanel',
            payload: account,
          });
          if (response?.error) {
            throw new Error(response.error);
          }
        }

        dom.inputHotmailImport.value = '';
        helpers.showToast(`Imported ${parsedAccounts.length} Hotmail accounts`, 'success', 2200);
      } catch (err) {
        helpers.showToast(`Bulk import failed: ${err.message}`, 'error');
      } finally {
        actionInFlight = false;
        dom.btnImportHotmailAccounts.disabled = false;
      }
    }

    async function handleAccountListClick(event) {
      const actionButton = event.target.closest('[data-account-action]');
      if (!actionButton || actionInFlight) {
        return;
      }

      const accountId = actionButton.dataset.accountId;
      const action = actionButton.dataset.accountAction;
      if (!accountId || !action) {
        return;
      }

      const targetAccount = helpers.getHotmailAccounts().find((account) => account.id === accountId) || null;

      actionInFlight = true;
      actionButton.disabled = true;

      try {
        if (action === 'copy-email') {
          if (!targetAccount?.email) throw new Error('No email address found to copy.');
          await helpers.copyTextToClipboard(targetAccount.email);
          helpers.showToast(`Copied ${targetAccount.email}`, 'success', 1800);
        } else if (action === 'select') {
          const response = await runtime.sendMessage({
            type: 'SELECT_HOTMAIL_ACCOUNT',
            source: 'sidepanel',
            payload: { accountId },
          });
          if (response?.error) throw new Error(response.error);
          state.syncLatestState({ currentHotmailAccountId: response.account.id });
          applyHotmailAccountMutation(response.account, { preserveCurrentSelection: true });
          helpers.showToast(`Switched current Hotmail account to ${response.account.email}`, 'success', 1800);
        } else if (action === 'toggle-used') {
          if (!targetAccount) throw new Error('Target Hotmail account not found.');
          const response = await runtime.sendMessage({
            type: 'PATCH_HOTMAIL_ACCOUNT',
            source: 'sidepanel',
            payload: {
              accountId,
              updates: { used: !targetAccount.used },
            },
          });
          if (response?.error) throw new Error(response.error);
          applyHotmailAccountMutation(response.account);
          helpers.showToast(`Account ${response.account.email} ${response.account.used ? 'marked as used' : 'restored as unused'}`, 'success', 2200);
        } else if (action === 'verify') {
          const response = await runtime.sendMessage({
            type: 'VERIFY_HOTMAIL_ACCOUNT',
            source: 'sidepanel',
            payload: { accountId },
          });
          if (response?.error) throw new Error(response.error);
          applyHotmailAccountMutation(response.account, { preserveCurrentSelection: true });
          helpers.showToast(`Account ${response.account.email} verified`, 'success', 2200);
        } else if (action === 'test') {
          const response = await runtime.sendMessage({
            type: 'TEST_HOTMAIL_ACCOUNT',
            source: 'sidepanel',
            payload: { accountId },
          });
          if (response?.error) throw new Error(response.error);
          applyHotmailAccountMutation(response.account, { preserveCurrentSelection: true });
          if (response.latestCode) {
            await helpers.copyTextToClipboard(response.latestCode);
            const mailbox = response.latestMailbox ? `(${response.latestMailbox})` : '';
            helpers.showToast(`Copied latest code ${response.latestCode}${mailbox}`, 'success', 2600);
          } else if (response.latestSubject) {
            const mailbox = response.latestMailbox ? `(${response.latestMailbox})` : '';
            helpers.showToast(`Latest email${mailbox} has no code: ${response.latestSubject}`, 'warn', 3200);
          } else {
            helpers.showToast('No latest email available to read.', 'warn', 2600);
          }
        } else if (action === 'delete') {
          const confirmed = await helpers.openConfirmModal({
            title: 'Delete Account',
            message: 'Are you sure you want to delete this Hotmail account? The corresponding token will also be removed.',
            confirmLabel: 'Confirm Delete',
            confirmVariant: 'btn-danger',
          });
          if (!confirmed) {
            return;
          }
          const response = await runtime.sendMessage({
            type: 'DELETE_HOTMAIL_ACCOUNT',
            source: 'sidepanel',
            payload: { accountId },
          });
          if (response?.error) throw new Error(response.error);
          helpers.showToast('Hotmail account deleted', 'success', 1800);
        }
      } catch (err) {
        helpers.showToast(err.message, 'error');
      } finally {
        actionInFlight = false;
        actionButton.disabled = false;
      }
    }

    function bindHotmailEvents() {
      dom.btnToggleHotmailList?.addEventListener('click', () => {
        setHotmailListExpanded(!listExpanded);
      });

      dom.btnToggleHotmailForm?.addEventListener('click', () => {
        if (formController.isVisible()) {
          formController.setVisible(false, { clearForm: true });
          return;
        }
        formController.setVisible(true, { focusField: true });
      });

      dom.btnHotmailUsageGuide?.addEventListener('click', async () => {
        await helpers.openConfirmModal({
          title: 'Usage Guide',
          message: 'API mode directly calls the Microsoft email interface to fetch mail; local helper mode still uses the local service. Both modes share the same Hotmail account pool and import format.',
          confirmLabel: 'OK',
          confirmVariant: 'btn-primary',
        });
      });

      dom.btnClearUsedHotmailAccounts?.addEventListener('click', async () => {
        if (actionInFlight) return;
        actionInFlight = true;
        dom.btnClearUsedHotmailAccounts.disabled = true;
        try {
          await deleteHotmailAccountsByMode('used');
        } catch (err) {
          helpers.showToast(err.message, 'error');
        } finally {
          actionInFlight = false;
          updateHotmailListViewport();
        }
      });

      dom.btnDeleteAllHotmailAccounts?.addEventListener('click', async () => {
        if (actionInFlight) return;
        actionInFlight = true;
        dom.btnDeleteAllHotmailAccounts.disabled = true;
        try {
          await deleteHotmailAccountsByMode('all');
        } catch (err) {
          helpers.showToast(err.message, 'error');
        } finally {
          actionInFlight = false;
          updateHotmailListViewport();
        }
      });

      dom.btnAddHotmailAccount?.addEventListener('click', handleAddHotmailAccount);
      dom.btnImportHotmailAccounts?.addEventListener('click', handleImportHotmailAccounts);
      dom.inputHotmailSearch?.addEventListener('input', (event) => {
        searchTerm = normalizeSearchText(event.target.value);
        renderHotmailAccounts();
      });
      dom.selectHotmailFilter?.addEventListener('change', (event) => {
        filterMode = String(event.target.value || 'all');
        renderHotmailAccounts();
      });
      dom.hotmailAccountsList?.addEventListener('click', handleAccountListClick);
      formController.sync();
    }

    return {
      bindHotmailEvents,
      initHotmailListExpandedState,
      renderHotmailAccounts,
    };
  }

  globalScope.SidepanelHotmailManager = {
    createHotmailManager,
  };
})(window);
