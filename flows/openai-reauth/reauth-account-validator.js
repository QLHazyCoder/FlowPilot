(function attachOpenAiReauthAccountValidator(root, factory) {
  root.MultiPageOpenAiReauthAccountValidator = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createOpenAiReauthAccountValidatorModule() {
  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function cleanString(value) {
    return String(value ?? '').trim();
  }

  function validateReauthAccountJson(rawText) {
    const trimmed = cleanString(rawText);
    if (!trimmed) {
      return { ok: false, error: '请粘贴 account 对象 JSON。' };
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return { ok: false, error: `JSON 解析失败：${error.message}` };
    }

    if (!isPlainObject(parsed)) {
      return { ok: false, error: 'JSON 必须是对象（不是数组或基本类型）。' };
    }

    const credentialsObject = isPlainObject(parsed.credentials) ? parsed.credentials : {};
    const email = cleanString(credentialsObject.email)
      || cleanString(parsed.email)
      || cleanString(parsed.name);
    if (!email) {
      return { ok: false, error: 'JSON 缺少 email：请检查 credentials.email / email / name 任一字段。' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: `识别到的 email 不是合法地址：${email}` };
    }

    const mailProvider = cleanString(parsed.mailProvider);
    if (!mailProvider) {
      return {
        ok: false,
        error: '缺少顶层 mailProvider 字段（必须显式声明邮箱来源，如 "2925" / "hotmail-api" / "icloud" / "luckmail-api" / "cloudmail" / "yyds-mail" / "cloudflare-temp-email"）。',
      };
    }

    return {
      ok: true,
      email,
      mailProvider,
      account: parsed,
    };
  }

  return { validateReauthAccountJson };
});
