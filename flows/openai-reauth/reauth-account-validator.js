(function attachOpenAiReauthAccountValidator(root, factory) {
  root.MultiPageOpenAiReauthAccountValidator = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createOpenAiReauthAccountValidatorModule() {
  const SUPPORTED_MAIL_PROVIDERS = Object.freeze([
    '2925',
    'hotmail-api',
    'icloud',
    'luckmail-api',
    'cloudmail',
    'yyds-mail',
    'cloudflare-temp-email',
  ]);

  const MAIL_PROVIDER_OPTIONS = Object.freeze([
    Object.freeze({ value: '2925', label: '2925' }),
    Object.freeze({ value: 'hotmail-api', label: 'Hotmail (API)' }),
    Object.freeze({ value: 'icloud', label: 'iCloud' }),
    Object.freeze({ value: 'luckmail-api', label: 'LuckMail (API)' }),
    Object.freeze({ value: 'cloudmail', label: 'Cloud Mail' }),
    Object.freeze({ value: 'yyds-mail', label: 'YYDS Mail' }),
    Object.freeze({ value: 'cloudflare-temp-email', label: 'Cloudflare Temp Email' }),
  ]);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanString(value) {
    return String(value ?? '').trim();
  }

  function extractAccountEmail(account) {
    const credentials = isPlainObject(account?.credentials) ? account.credentials : {};
    return cleanString(credentials.email)
      || cleanString(account?.email)
      || cleanString(account?.name);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function parseAccountsFromJson(rawText) {
    const trimmed = cleanString(rawText);
    if (!trimmed) {
      return { ok: false, error: '请粘贴账号 JSON（单账号对象或 sub2api 导出整文件）。' };
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return { ok: false, error: `JSON 解析失败：${error.message}` };
    }

    let accounts = null;
    if (Array.isArray(parsed?.accounts)) {
      accounts = parsed.accounts;
    } else if (Array.isArray(parsed)) {
      accounts = parsed;
    } else if (isPlainObject(parsed)) {
      accounts = [parsed];
    } else {
      return { ok: false, error: 'JSON 必须是单账号对象、accounts 数组，或含 accounts 字段的对象。' };
    }

    if (!accounts.length) {
      return { ok: false, error: 'accounts 列表为空。' };
    }

    const normalized = [];
    for (let index = 0; index < accounts.length; index += 1) {
      const account = accounts[index];
      if (!isPlainObject(account)) {
        return { ok: false, error: `accounts[${index}] 不是对象。` };
      }
      const email = extractAccountEmail(account);
      if (!email) {
        return { ok: false, error: `accounts[${index}] 缺少 email（credentials.email / email / name）。` };
      }
      if (!isValidEmail(email)) {
        return { ok: false, error: `accounts[${index}] 的 email 格式无效：${email}` };
      }
      normalized.push({ index, email, account });
    }

    return {
      ok: true,
      accounts: normalized,
    };
  }

  function buildResolvedAccount(account, mailProvider) {
    const normalizedProvider = cleanString(mailProvider);
    if (!normalizedProvider) {
      throw new Error('未提供 mailProvider，无法注入到账号对象。');
    }
    return {
      ...account,
      mailProvider: normalizedProvider,
    };
  }

  return {
    SUPPORTED_MAIL_PROVIDERS,
    MAIL_PROVIDER_OPTIONS,
    parseAccountsFromJson,
    buildResolvedAccount,
    extractAccountEmail,
    isValidEmail,
  };
});
