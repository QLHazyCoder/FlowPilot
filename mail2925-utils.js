(function mail2925UtilsModule(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    return;
  }

  root.Mail2925Utils = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createMail2925Utils() {
  const MAIL2925_LIMIT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

  function normalizeTimestamp(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  function normalizeMail2925Account(account = {}) {
    return {
      id: String(account.id || crypto.randomUUID()),
      email: String(account.email || '').trim().toLowerCase(),
      password: String(account.password || ''),
      enabled: account.enabled !== undefined ? Boolean(account.enabled) : true,
      lastUsedAt: normalizeTimestamp(account.lastUsedAt),
      lastLoginAt: normalizeTimestamp(account.lastLoginAt),
      lastLimitAt: normalizeTimestamp(account.lastLimitAt),
      disabledUntil: normalizeTimestamp(account.disabledUntil),
      lastError: String(account.lastError || '').trim(),
    };
  }

  function normalizeMail2925Accounts(accounts) {
    if (!Array.isArray(accounts)) return [];

    const deduped = new Map();
    for (const account of accounts) {
      const normalized = normalizeMail2925Account(account);
      if (!normalized.email) continue;
      deduped.set(normalized.id, normalized);
    }
    return [...deduped.values()];
  }

  function findMail2925Account(accounts, accountId) {
    return normalizeMail2925Accounts(accounts).find((account) => account.id === accountId) || null;
  }

  function isMail2925AccountCoolingDown(account, now = Date.now()) {
    return normalizeTimestamp(account?.disabledUntil) > normalizeTimestamp(now);
  }

  function isMail2925AccountAvailable(account, now = Date.now()) {
    return Boolean(account)
      && Boolean(account.email)
      && Boolean(account.password)
      && account.enabled !== false
      && !isMail2925AccountCoolingDown(account, now);
  }

  function getMail2925AccountStatus(account, now = Date.now()) {
    if (!account) return 'missing';
    if (account.enabled === false) return 'disabled';
    if (isMail2925AccountCoolingDown(account, now)) return 'cooldown';
    if (!account.password) return 'pending';
    if (account.lastError) return 'error';
    return 'ready';
  }

  function filterMail2925AccountsByStatus(accounts, mode = 'all', now = Date.now()) {
    const list = normalizeMail2925Accounts(accounts);
    switch (String(mode || 'all').trim()) {
      case 'available':
        return list.filter((account) => isMail2925AccountAvailable(account, now));
      case 'cooldown':
        return list.filter((account) => isMail2925AccountCoolingDown(account, now));
      case 'disabled':
        return list.filter((account) => account.enabled === false);
      default:
        return list;
    }
  }

  function pickMail2925AccountForRun(accounts, options = {}) {
    const now = normalizeTimestamp(options.now) || Date.now();
    const excludeIds = new Set((options.excludeIds || []).filter(Boolean));
    const candidates = normalizeMail2925Accounts(accounts)
      .filter((account) => isMail2925AccountAvailable(account, now));
    if (!candidates.length) return null;

    const filtered = candidates.filter((account) => !excludeIds.has(account.id));
    const pool = filtered.length ? filtered : candidates;

    return pool
      .slice()
      .sort((left, right) => {
        const leftUsedAt = normalizeTimestamp(left.lastUsedAt);
        const rightUsedAt = normalizeTimestamp(right.lastUsedAt);
        if (leftUsedAt !== rightUsedAt) {
          return leftUsedAt - rightUsedAt;
        }
        return String(left.email || '').localeCompare(String(right.email || ''));
      })[0] || null;
  }

  function getMail2925BulkActionLabel(mode = 'all', count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const prefix = mode === 'cooldown' ? 'Clear Cooldown' : 'Delete All';
    const suffix = normalizedCount > 0 ? ` (${normalizedCount})` : '';
    return `${prefix}${suffix}`;
  }

  function getMail2925ListToggleLabel(expanded, count = 0) {
    const normalizedCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const suffix = normalizedCount > 0 ? ` (${normalizedCount})` : '';
    return `${expanded ? 'Collapse List' : 'Expand List'}${suffix}`;
  }

  function upsertMail2925AccountInList(accounts, nextAccount) {
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

  function parseMail2925ImportText(rawText) {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return lines
      .filter((line, index) => !(index === 0 && /^邮箱----密码$/i.test(line)))
      .map((line) => line.split('----').map((part) => part.trim()))
      .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
      .map(([email, password]) => ({
        email,
        password,
      }));
  }

  return {
    MAIL2925_LIMIT_COOLDOWN_MS,
    filterMail2925AccountsByStatus,
    findMail2925Account,
    getMail2925AccountStatus,
    getMail2925BulkActionLabel,
    getMail2925ListToggleLabel,
    isMail2925AccountAvailable,
    isMail2925AccountCoolingDown,
    normalizeMail2925Account,
    normalizeMail2925Accounts,
    normalizeTimestamp,
    parseMail2925ImportText,
    pickMail2925AccountForRun,
    upsertMail2925AccountInList,
  };
});
