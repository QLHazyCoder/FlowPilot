(function attachBackgroundPayPalAccountStore(root, factory) {
  root.MultiPageBackgroundPayPalAccountStore = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPayPalAccountStoreModule() {
  function createPayPalAccountStore(deps = {}) {
    const {
      broadcastDataUpdate,
      findPayPalAccount,
      getState,
      normalizePayPalAccount,
      normalizePayPalAccounts,
      setPersistentSettings,
      setState,
      upsertPayPalAccountInList,
    } = deps;

    async function syncSelectedPayPalAccountState(account = null) {
      const updates = account
        ? {
          currentPayPalAccountId: account.id,
          paypalEmail: String(account.email || '').trim(),
          paypalPassword: String(account.password || ''),
        }
        : {
          currentPayPalAccountId: '',
          paypalEmail: '',
          paypalPassword: '',
        };

      await setPersistentSettings(updates);
      await setState({
        currentPayPalAccountId: updates.currentPayPalAccountId || null,
        paypalEmail: updates.paypalEmail,
        paypalPassword: updates.paypalPassword,
      });
      broadcastDataUpdate({
        currentPayPalAccountId: updates.currentPayPalAccountId || null,
        paypalEmail: updates.paypalEmail,
        paypalPassword: updates.paypalPassword,
      });
    }

    async function syncPayPalAccounts(accounts) {
      const normalized = normalizePayPalAccounts(accounts);
      await setPersistentSettings({ paypalAccounts: normalized });
      await setState({ paypalAccounts: normalized });
      broadcastDataUpdate({ paypalAccounts: normalized });

      const state = await getState();
      if (state.currentPayPalAccountId && !findPayPalAccount(normalized, state.currentPayPalAccountId)) {
        await syncSelectedPayPalAccountState(null);
      }
      return normalized;
    }

    function getCurrentPayPalAccount(state = {}) {
      return findPayPalAccount(state.paypalAccounts, state.currentPayPalAccountId) || null;
    }

    async function upsertPayPalAccount(input = {}) {
      const state = await getState();
      const accounts = normalizePayPalAccounts(state.paypalAccounts);
      const normalizedEmail = String(input?.email || '').trim().toLowerCase();
      const existing = input?.id
        ? findPayPalAccount(accounts, input.id)
        : accounts.find((account) => account.email === normalizedEmail) || null;
      const normalized = normalizePayPalAccount({
        ...(existing || {}),
        ...input,
        id: input?.id || existing?.id || crypto.randomUUID(),
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      });

      const nextAccounts = typeof upsertPayPalAccountInList === 'function'
        ? upsertPayPalAccountInList(accounts, normalized)
        : accounts.concat(normalized);

      await syncPayPalAccounts(nextAccounts);

      if (state.currentPayPalAccountId === normalized.id) {
        await syncSelectedPayPalAccountState(normalized);
      }

      return normalized;
    }

    async function setCurrentPayPalAccount(accountId) {
      const state = await getState();
      const accounts = normalizePayPalAccounts(state.paypalAccounts);
      const account = findPayPalAccount(accounts, accountId);
      if (!account) {
        throw new Error('Corresponding PayPal account not found.');
      }

      await syncSelectedPayPalAccountState(account);
      return account;
    }

    return {
      getCurrentPayPalAccount,
      setCurrentPayPalAccount,
      syncPayPalAccounts,
      upsertPayPalAccount,
    };
  }

  return {
    createPayPalAccountStore,
  };
});
