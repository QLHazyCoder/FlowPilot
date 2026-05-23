(function cloudMailProviderModule(root, factory) {
  root.MultiPageBackgroundCloudMailProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createCloudMailProviderModule() {
  function createCloudMailProvider(deps = {}) {
    const {
      addLog = async () => {},
      buildCloudMailHeaders,
      CLOUD_MAIL_DEFAULT_PAGE_SIZE = 20,
      CLOUD_MAIL_GENERATOR = 'cloudmail',
      CLOUD_MAIL_PROVIDER = 'cloudmail',
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getCloudMailTokenFromResponse,
      getState = async () => ({}),
      joinCloudMailUrl,
      normalizeCloudMailAddress,
      normalizeCloudMailBaseUrl,
      normalizeCloudMailDomain,
      normalizeCloudMailDomains,
      normalizeCloudMailMailApiMessages,
      persistRegistrationEmailState = null,
      pickVerificationMessageWithTimeFallback,
      setEmailState = async () => {},
      setPersistentSettings = async () => {},
      sleepWithStop = async () => {},
      throwIfStopped = () => {},
    } = deps;

    async function persistResolvedEmailState(state = null, email, options = {}) {
      if (typeof persistRegistrationEmailState === 'function') {
        await persistRegistrationEmailState(state, email, options);
        return;
      }
      await setEmailState(email, options);
    }

    function getCloudMailConfig(state = {}) {
      return {
        baseUrl: normalizeCloudMailBaseUrl(state.cloudMailBaseUrl),
        adminEmail: String(state.cloudMailAdminEmail || '').trim(),
        adminPassword: String(state.cloudMailAdminPassword || ''),
        token: String(state.cloudMailToken || '').trim(),
        receiveMailbox: normalizeCloudMailReceiveMailbox(state.cloudMailReceiveMailbox),
        domain: normalizeCloudMailDomain(state.cloudMailDomain),
        domains: normalizeCloudMailDomains(state.cloudMailDomains),
      };
    }

    function normalizeCloudMailReceiveMailbox(value = '') {
      const normalized = normalizeCloudMailAddress(value);
      if (!normalized) return '';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
    }

    function resolveCloudMailPollTargetEmail(state = {}, pollPayload = {}, config = getCloudMailConfig(state)) {
      const configuredReceiveMailbox = normalizeCloudMailReceiveMailbox(config.receiveMailbox);
      const mailProvider = String(state?.mailProvider || '').trim().toLowerCase();
      const emailGenerator = String(state?.emailGenerator || '').trim().toLowerCase();
      const shouldPreferConfiguredReceiveMailbox = mailProvider === CLOUD_MAIL_PROVIDER
        && emailGenerator !== CLOUD_MAIL_GENERATOR;
      if (shouldPreferConfiguredReceiveMailbox && configuredReceiveMailbox) {
        return configuredReceiveMailbox;
      }

      const requestedTarget = normalizeCloudMailReceiveMailbox(pollPayload.targetEmail);
      if (requestedTarget) {
        return requestedTarget;
      }

      return normalizeCloudMailReceiveMailbox(state.email);
    }

    function ensureCloudMailConfig(state, options = {}) {
      const { requireToken = false, requireCredentials = false, requireDomain = false } = options;
      const config = getCloudMailConfig(state);
      if (!config.baseUrl) {
        throw new Error('Cloud Mail 服务地址为空或格式无效。');
      }
      if (requireCredentials && (!config.adminEmail || !config.adminPassword)) {
        throw new Error('Cloud Mail 缺少管理员邮箱或密码。');
      }
      if (requireToken && !config.token) {
        throw new Error('Cloud Mail 尚未获取到身份令牌，请先生成 Token。');
      }
      if (requireDomain && !config.domain) {
        throw new Error('Cloud Mail 域名为空或格式无效。');
      }
      return config;
    }

    async function requestCloudMailJson(config, path, options = {}) {
      if (!fetchImpl) {
        throw new Error('Cloud Mail 当前运行环境不支持 fetch。');
      }
      const {
        method = 'POST',
        payload,
        timeoutMs = 20000,
        requireToken = true,
      } = options;
      const url = joinCloudMailUrl(config.baseUrl, path);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
      let response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: buildCloudMailHeaders(config, {
            json: payload !== undefined,
            token: requireToken ? undefined : '',
          }),
          body: payload !== undefined ? JSON.stringify(payload) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        const errorMessage = err?.name === 'AbortError'
          ? `Cloud Mail 请求超时（>${Math.round(timeoutMs / 1000)} 秒）`
          : `Cloud Mail 请求失败：${err.message}`;
        throw new Error(errorMessage);
      } finally {
        clearTimeout(timeoutId);
      }
      const text = await response.text();
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = text;
      }
      if (!response.ok) {
        const payloadError = typeof parsed === 'object' && parsed
          ? (parsed.message || parsed.error || parsed.msg)
          : '';
        throw new Error(`Cloud Mail 请求失败：${payloadError || text || `HTTP ${response.status}`}`);
      }
      if (parsed && typeof parsed === 'object' && 'code' in parsed && Number(parsed.code) !== 200) {
        throw new Error(`Cloud Mail 业务错误：${parsed.message || parsed.msg || `code=${parsed.code}`}`);
      }
      return parsed;
    }

    async function ensureCloudMailToken(state, options = {}) {
      const { forceRefresh = false } = options;
      const latestState = state || await getState();
      const config = ensureCloudMailConfig(latestState, { requireCredentials: true });
      if (!forceRefresh && config.token) {
        return { config, token: config.token };
      }
      const loginConfig = { ...config, token: '' };
      const result = await requestCloudMailJson(loginConfig, '/api/public/genToken', {
        method: 'POST',
        payload: { email: config.adminEmail, password: config.adminPassword },
        requireToken: false,
      });
      const token = getCloudMailTokenFromResponse(result);
      if (!token) {
        throw new Error('Cloud Mail 未返回可用 Token。');
      }
      await setPersistentSettings({ cloudMailToken: token });
      return { config: { ...config, token }, token };
    }

    function generateCloudMailAliasLocalPart() {
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      const digits = '0123456789';
      const chars = [];
      for (let i = 0; i < 6; i++) chars.push(letters[Math.floor(Math.random() * letters.length)]);
      for (let i = 0; i < 4; i++) chars.push(digits[Math.floor(Math.random() * digits.length)]);
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    }

    const ENGLISH_NAME_PREFIXES = [
      'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph',
      'thomas', 'charles', 'mary', 'patricia', 'jennifer', 'linda', 'elizabeth',
      'barbara', 'susan', 'jessica', 'sarah', 'karen', 'daniel', 'matthew',
      'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kevin',
      'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan',
      'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin',
      'scott', 'brandon', 'benjamin', 'samuel', 'gregory', 'alexander', 'patrick',
      'frank', 'raymond', 'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'henry',
      'douglas', 'peter', 'adam', 'zachary', 'nathan', 'walter', 'harold', 'kyle',
      'carl', 'arthur', 'gerald', 'roger', 'alice', 'emma', 'olivia', 'sophia',
      'isabella', 'mia', 'amelia', 'harper', 'evelyn', 'abigail', 'emily', 'ella',
      'scarlett', 'grace', 'chloe', 'victoria', 'riley', 'aria', 'lily', 'nora',
    ];

    function pickRandomEnglishNamePrefix() {
      return ENGLISH_NAME_PREFIXES[Math.floor(Math.random() * ENGLISH_NAME_PREFIXES.length)] || 'james';
    }

    function formatCloudMailDateTimeDigits(date = new Date()) {
      const current = new Date(date);
      if (Number.isNaN(current.getTime())) {
        return '';
      }
      const year = String(current.getFullYear());
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const hour = String(current.getHours()).padStart(2, '0');
      const minute = String(current.getMinutes()).padStart(2, '0');
      const second = String(current.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}${hour}${minute}${second}`;
    }

    function buildCloudMailNameDateTimeLocalPart(date = new Date()) {
      const normalizedName = pickRandomEnglishNamePrefix();
      const dateTimeDigits = formatCloudMailDateTimeDigits(date);
      if (!dateTimeDigits) {
        return '';
      }
      return `${normalizedName}${dateTimeDigits}`;
    }

    async function fetchCloudMailAddress(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const { config } = await ensureCloudMailToken(latestState);
      const ensuredConfig = ensureCloudMailConfig({ ...latestState, cloudMailToken: config.token }, {
        requireToken: true,
        requireDomain: true,
      });
      const explicitLocalPart = String(options.localPart || '').trim().toLowerCase();
      const legacyNameLocalPart = String(options.name || '').trim().toLowerCase();
      const nameDateTimeLocalPart = buildCloudMailNameDateTimeLocalPart(options.date);
      const requestedLocal = explicitLocalPart || legacyNameLocalPart || nameDateTimeLocalPart || generateCloudMailAliasLocalPart();
      const address = `${requestedLocal}@${ensuredConfig.domain}`.toLowerCase();
      const payload = { list: [{ email: address }] };
      try {
        await requestCloudMailJson(ensuredConfig, '/api/public/addUser', { method: 'POST', payload });
      } catch (err) {
        if (/token|unauthor|401/i.test(String(err?.message || ''))) {
          const refreshed = await ensureCloudMailToken(latestState, { forceRefresh: true });
          await requestCloudMailJson(refreshed.config, '/api/public/addUser', { method: 'POST', payload });
        } else {
          throw err;
        }
      }
      await persistResolvedEmailState(latestState, address, {
        source: 'generated:cloudmail',
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`Cloud Mail：已生成 ${address}`, 'ok');
      return address;
    }

    function summarizeCloudMailMessagesForLog(messages) {
      return (messages || [])
        .slice()
        .sort((left, right) => {
          const leftTime = Date.parse(left.receivedDateTime || '') || 0;
          const rightTime = Date.parse(right.receivedDateTime || '') || 0;
          return rightTime - leftTime;
        })
        .slice(0, 3)
        .map((message) => {
          const receivedAt = message?.receivedDateTime || '未知时间';
          const sender = message?.from?.emailAddress?.address || '未知发件人';
          const subject = message?.subject || '（无主题）';
          const preview = String(message?.bodyPreview || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          const address = message?.address || '未知地址';
          return `[${address}] ${receivedAt} | ${sender} | ${subject} | ${preview}`;
        })
        .join(' || ');
    }

    async function listCloudMailMessages(state, options = {}) {
      const latestState = state || await getState();
      const { config } = await ensureCloudMailToken(latestState);
      const address = normalizeCloudMailAddress(options.address);
      const pageSize = Number(options.limit) || CLOUD_MAIL_DEFAULT_PAGE_SIZE;
      const pageNum = Number(options.page) || 1;
      const request = async (currentConfig) => requestCloudMailJson(currentConfig, '/api/public/emailList', {
        method: 'POST',
        payload: {
          toEmail: address || undefined,
          type: 0,
          isDel: 0,
          timeSort: 'desc',
          num: pageNum,
          size: pageSize,
        },
      });
      let payload;
      try {
        payload = await request(config);
      } catch (err) {
        if (/token|unauthor|401/i.test(String(err?.message || ''))) {
          const refreshed = await ensureCloudMailToken(latestState, { forceRefresh: true });
          payload = await request(refreshed.config);
        } else {
          throw err;
        }
      }
      const messages = normalizeCloudMailMailApiMessages(payload).filter((message) => {
        if (!address) return true;
        return !message.address || normalizeCloudMailAddress(message.address) === address;
      });
      return { config, messages };
    }

    async function pollCloudMailVerificationCode(step, state, pollPayload = {}) {
      const latestState = state || await getState();
      const config = ensureCloudMailConfig(latestState, { requireCredentials: true });
      const targetEmail = resolveCloudMailPollTargetEmail(latestState, pollPayload, config);
      const registrationEmail = normalizeCloudMailReceiveMailbox(latestState.email);
      if (!targetEmail) {
        throw new Error('Cloud Mail 轮询前缺少目标邮箱地址，请先填写注册邮箱或"邮件接收"邮箱。');
      }
      if (registrationEmail && registrationEmail !== targetEmail) {
        await addLog(`步骤 ${step}：正在轮询 Cloud Mail 收件邮箱（${targetEmail}），注册邮箱为 ${registrationEmail}...`, 'info');
      } else {
        await addLog(`步骤 ${step}：正在轮询 Cloud Mail 邮件（${targetEmail}）...`, 'info');
      }
      const maxAttempts = Number(pollPayload.maxAttempts) || 5;
      const intervalMs = Number(pollPayload.intervalMs) || 3000;
      let lastError = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        throwIfStopped();
        try {
          const { messages } = await listCloudMailMessages(latestState, {
            address: targetEmail,
            limit: pollPayload.limit || CLOUD_MAIL_DEFAULT_PAGE_SIZE,
            page: pollPayload.page || 1,
          });
          const matchResult = pickVerificationMessageWithTimeFallback(messages, {
            afterTimestamp: pollPayload.filterAfterTimestamp || 0,
            senderFilters: pollPayload.senderFilters || [],
            subjectFilters: pollPayload.subjectFilters || [],
            excludeCodes: pollPayload.excludeCodes || [],
          });
          const match = matchResult.match;
          if (match?.code) {
            if (matchResult.usedRelaxedFilters) {
              const fallbackLabel = matchResult.usedTimeFallback ? '宽松匹配 + 时间回退' : '宽松匹配';
              await addLog(`步骤 ${step}：严格规则未命中，已改用 ${fallbackLabel} 并命中 Cloud Mail 验证码。`, 'warn');
            }
            return {
              ok: true,
              code: match.code,
              emailTimestamp: match.receivedAt || Date.now(),
              mailId: match.message?.id || '',
            };
          }
          lastError = new Error(`步骤 ${step}：暂未在 Cloud Mail 中找到匹配验证码（${attempt}/${maxAttempts}）。`);
          await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
          const sample = summarizeCloudMailMessagesForLog(messages);
          if (sample) {
            await addLog(`步骤 ${step}：最近邮件样本：${sample}`, 'info');
          }
        } catch (err) {
          lastError = err;
          await addLog(`步骤 ${step}：Cloud Mail 轮询失败：${err.message}`, 'warn');
        }
        if (attempt < maxAttempts) {
          await sleepWithStop(intervalMs);
        }
      }
      throw lastError || new Error(`步骤 ${step}：未在 Cloud Mail 中找到新的匹配验证码。`);
    }

    return {
      buildCloudMailNameDateTimeLocalPart,
      ensureCloudMailConfig,
      ensureCloudMailToken,
      fetchCloudMailAddress,
      getCloudMailConfig,
      listCloudMailMessages,
      normalizeCloudMailReceiveMailbox,
      pollCloudMailVerificationCode,
      requestCloudMailJson,
      resolveCloudMailPollTargetEmail,
    };
  }

  return {
    createCloudMailProvider,
  };
});
