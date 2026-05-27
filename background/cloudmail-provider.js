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
        throw new Error('Cloud Mail service URL is empty or invalid.');
      }
      if (requireCredentials && (!config.adminEmail || !config.adminPassword)) {
        throw new Error('Cloud Mail admin email or password missing.');
      }
      if (requireToken && !config.token) {
        throw new Error('Cloud Mail has no auth token. Please generate a token first.');
      }
      if (requireDomain && !config.domain) {
        throw new Error('Cloud Mail domain is empty or invalid.');
      }
      return config;
    }

    async function requestCloudMailJson(config, path, options = {}) {
      if (!fetchImpl) {
        throw new Error('Cloud Mail: fetch not supported in current environment.');
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
          ? `Cloud Mail request timed out (>${Math.round(timeoutMs / 1000)} seconds)`
          : `Cloud Mail request failed: ${err.message}`;
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
        throw new Error(`Cloud Mail request failed: ${payloadError || text || `HTTP ${response.status}`}`);
      }
      if (parsed && typeof parsed === 'object' && 'code' in parsed && Number(parsed.code) !== 200) {
        throw new Error(`Cloud Mail business error: ${parsed.message || parsed.msg || `code=${parsed.code}`}`);
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
        throw new Error('Cloud Mail did not return a usable token.');
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

    async function fetchCloudMailAddress(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const { config } = await ensureCloudMailToken(latestState);
      const ensuredConfig = ensureCloudMailConfig({ ...latestState, cloudMailToken: config.token }, {
        requireToken: true,
        requireDomain: true,
      });
      const requestedLocal = String(options.localPart || options.name || '').trim().toLowerCase()
        || generateCloudMailAliasLocalPart();
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
      await addLog(`Cloud Mail: Generated ${address}`, 'ok');
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
          const receivedAt = message?.receivedDateTime || 'unknown time';
          const sender = message?.from?.emailAddress?.address || 'unknown sender';
          const subject = message?.subject || '(no subject)';
          const preview = String(message?.bodyPreview || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          const address = message?.address || 'unknown address';
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
        throw new Error('Cloud Mail polling missing target email address. Please fill in registration email or "Receive Mail" mailbox.');
      }
      if (registrationEmail && registrationEmail !== targetEmail) {
        await addLog(`Step ${step}: Polling Cloud Mail receive mailbox (${targetEmail}), registration email is ${registrationEmail}...`, 'info');
      } else {
        await addLog(`Step ${step}: Polling Cloud Mail messages (${targetEmail})...`, 'info');
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
              const fallbackLabel = matchResult.usedTimeFallback ? 'relaxed match + time fallback' : 'relaxed match';
              await addLog(`Step ${step}: Strict rules did not match, using ${fallbackLabel} and matched Cloud Mail verification code.`, 'warn');
            }
            return {
              ok: true,
              code: match.code,
              emailTimestamp: match.receivedAt || Date.now(),
              mailId: match.message?.id || '',
            };
          }
          lastError = new Error(`Step ${step}: No matching verification code found yet in Cloud Mail (${attempt}/${maxAttempts}).`);
          await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
          const sample = summarizeCloudMailMessagesForLog(messages);
          if (sample) {
            await addLog(`Step ${step}: Recent mail sample: ${sample}`, 'info');
          }
        } catch (err) {
          lastError = err;
          await addLog(`Step ${step}: Cloud Mail polling failed: ${err.message}`, 'warn');
        }
        if (attempt < maxAttempts) {
          await sleepWithStop(intervalMs);
        }
      }
      throw lastError || new Error(`Step ${step}: No new matching verification code found in Cloud Mail.`);
    }

    return {
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
