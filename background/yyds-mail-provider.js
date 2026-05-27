(function yydsMailProviderModule(root, factory) {
  root.MultiPageBackgroundYydsMailProvider = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createYydsMailProviderModule() {
  function createYydsMailProvider(deps = {}) {
    const {
      addLog = async () => {},
      buildYydsMailHeaders,
      DEFAULT_YYDS_MAIL_BASE_URL = 'https://maliapi.215.im/v1',
      fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
      getState = async () => ({}),
      joinYydsMailUrl,
      normalizeYydsMailAddress,
      normalizeYydsMailApiKey,
      normalizeYydsMailBaseUrl,
      normalizeYydsMailCurrentInbox,
      normalizeYydsMailInbox,
      normalizeYydsMailMessageDetail,
      normalizeYydsMailMessages,
      persistRegistrationEmailState = null,
      pickVerificationMessageWithTimeFallback,
      setEmailState = async () => {},
      setState = async () => {},
      sleepWithStop = async () => {},
      throwIfStopped = () => {},
      YYDS_MAIL_PROVIDER = 'yyds-mail',
    } = deps;

    async function persistResolvedEmailState(state = null, email, options = {}) {
      if (typeof persistRegistrationEmailState === 'function') {
        await persistRegistrationEmailState(state, email, options);
        return;
      }
      await setEmailState(email, options);
    }

    function getYydsMailConfig(state = {}) {
      return {
        apiKey: normalizeYydsMailApiKey(state.yydsMailApiKey),
        baseUrl: normalizeYydsMailBaseUrl(state.yydsMailBaseUrl || DEFAULT_YYDS_MAIL_BASE_URL),
        currentInbox: normalizeYydsMailCurrentInbox(state.currentYydsMailInbox),
      };
    }

    function ensureYydsMailConfig(state = {}, options = {}) {
      const { requireApiKey = false, requireInbox = false } = options;
      const config = getYydsMailConfig(state);
      if (!config.baseUrl) {
        throw new Error('YYDS Mail API base URL is empty or invalid.');
      }
      if (requireApiKey && !config.apiKey) {
        throw new Error('YYDS Mail API key is empty. Please fill it in the side panel first.');
      }
      if (requireInbox && (!config.currentInbox?.address || !config.currentInbox?.token)) {
        throw new Error('YYDS Mail has no available mailbox right now. Please request one first.');
      }
      return config;
    }

    async function requestYydsMailJson(config, path, options = {}) {
      if (!fetchImpl) {
        throw new Error('YYDS Mail is not supported in this runtime (no fetch).');
      }
      const {
        method = 'GET',
        payload,
        params,
        timeoutMs = 20000,
        auth = 'temp',
      } = options;
      const url = joinYydsMailUrl(config.baseUrl, path, params);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
      let response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: buildYydsMailHeaders(config, {
            apiKey: auth === 'apiKey' ? config.apiKey : '',
            tempToken: auth === 'temp' ? config.currentInbox?.token : '',
            includeConfigApiKey: auth === 'apiKey',
            json: payload !== undefined,
          }),
          body: payload !== undefined ? JSON.stringify(payload || {}) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        const errorMessage = err?.name === 'AbortError'
          ? `YYDS Mail request timed out (>${Math.round(timeoutMs / 1000)} seconds)`
          : `YYDS Mail request failed: ${err.message}`;
        throw new Error(errorMessage);
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      let parsed = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = text;
      }

      if (!response.ok) {
        const payloadError = parsed && typeof parsed === 'object'
          ? (parsed.error || parsed.message || parsed.msg || parsed.errorCode)
          : '';
        throw new Error(`YYDS Mail request failed: ${payloadError || text || `HTTP ${response.status}`}`);
      }

      if (parsed && typeof parsed === 'object' && parsed.success === false) {
        throw new Error(`YYDS Mail business error: ${parsed.error || parsed.message || parsed.errorCode || 'unknown_error'}`);
      }

      if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'data')) {
        return parsed.data;
      }
      return parsed;
    }

    function generateYydsMailLocalPart() {
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      const digits = '0123456789';
      const chars = [];
      for (let i = 0; i < 6; i += 1) chars.push(letters[Math.floor(Math.random() * letters.length)]);
      for (let i = 0; i < 4; i += 1) chars.push(digits[Math.floor(Math.random() * digits.length)]);
      for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    }

    async function fetchYydsMailAddress(state, options = {}) {
      throwIfStopped();
      const latestState = state || await getState();
      const config = ensureYydsMailConfig(latestState, { requireApiKey: true });
      const localPart = String(options.localPart || options.name || '').trim().toLowerCase()
        || generateYydsMailLocalPart();
      const data = await requestYydsMailJson(config, '/accounts', {
        method: 'POST',
        auth: 'apiKey',
        payload: { localPart },
      });
      const inbox = normalizeYydsMailInbox(data);
      if (!inbox.address || !inbox.token) {
        throw new Error('YYDS Mail mailbox creation succeeded but did not return a usable address/token.');
      }

      await setState({ currentYydsMailInbox: inbox });
      await persistResolvedEmailState(latestState, inbox.address, {
        source: `generated:${YYDS_MAIL_PROVIDER}`,
        preserveAccountIdentity: Boolean(options?.preserveAccountIdentity),
      });
      await addLog(`YYDS Mail: Created mailbox ${inbox.address}`, 'ok');
      return inbox.address;
    }

    function resolveYydsMailInbox(state = {}) {
      const config = getYydsMailConfig(state);
      if (config.currentInbox?.address && config.currentInbox?.token) {
        return config.currentInbox;
      }
      return null;
    }

    function resolveYydsMailPollTargetEmail(state = {}, pollPayload = {}) {
      return normalizeYydsMailAddress(pollPayload.targetEmail)
        || resolveYydsMailInbox(state)?.address
        || normalizeYydsMailAddress(state.email);
    }

    async function listYydsMailMessages(state, options = {}) {
      const latestState = state || await getState();
      const inbox = resolveYydsMailInbox(latestState);
      const config = {
        ...ensureYydsMailConfig(latestState, { requireInbox: true }),
        currentInbox: inbox,
      };
      const address = normalizeYydsMailAddress(options.address) || inbox.address;
      const payload = await requestYydsMailJson(config, '/messages', {
        method: 'GET',
        auth: 'temp',
        params: {
          address,
          limit: Number(options.limit) || 20,
        },
      });
      return {
        config,
        messages: normalizeYydsMailMessages(payload),
      };
    }

    async function getYydsMailMessageDetail(state, messageId, options = {}) {
      const latestState = state || await getState();
      const inbox = resolveYydsMailInbox(latestState);
      const config = {
        ...ensureYydsMailConfig(latestState, { requireInbox: true }),
        currentInbox: inbox,
      };
      const address = normalizeYydsMailAddress(options.address) || inbox.address;
      const payload = await requestYydsMailJson(config, `/messages/${encodeURIComponent(messageId)}`, {
        method: 'GET',
        auth: 'temp',
        params: { address },
      });
      return normalizeYydsMailMessageDetail(payload);
    }

    function summarizeYydsMailMessagesForLog(messages) {
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
          return `${receivedAt} | ${sender} | ${subject} | ${preview}`;
        })
        .join(' || ');
    }

    async function hydrateYydsMailMessageDetails(state, messages, address) {
      const details = [];
      for (const message of (messages || []).slice(0, 8)) {
        throwIfStopped();
        if (!message?.id) {
          details.push(message);
          continue;
        }
        try {
          details.push(await getYydsMailMessageDetail(state, message.id, { address }));
        } catch (err) {
          await addLog(`YYDS Mail: Failed to read message detail ${message.id}: ${err.message}`, 'warn');
          details.push(message);
        }
      }
      return details.filter(Boolean);
    }

    async function pollYydsMailVerificationCode(step, state, pollPayload = {}) {
      const latestState = state || await getState();
      const targetEmail = resolveYydsMailPollTargetEmail(latestState, pollPayload);
      if (!targetEmail) {
        throw new Error('YYDS Mail is missing a target email address before polling. Please request a mailbox first.');
      }

      await addLog(`Step ${step}: Polling YYDS Mail messages (${targetEmail})...`, 'info');
      const maxAttempts = Number(pollPayload.maxAttempts) || 5;
      const intervalMs = Number(pollPayload.intervalMs) || 3000;
      let lastError = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        throwIfStopped();
        try {
          const { messages } = await listYydsMailMessages(latestState, {
            address: targetEmail,
            limit: pollPayload.limit || 20,
          });
          const detailedMessages = await hydrateYydsMailMessageDetails(latestState, messages, targetEmail);
          const matchResult = pickVerificationMessageWithTimeFallback(detailedMessages, {
            afterTimestamp: pollPayload.filterAfterTimestamp || 0,
            senderFilters: pollPayload.senderFilters || [],
            subjectFilters: pollPayload.subjectFilters || [],
            requiredKeywords: pollPayload.requiredKeywords || [],
            codePatterns: pollPayload.codePatterns || [],
            excludeCodes: pollPayload.excludeCodes || [],
          });
          const match = matchResult.match;
          if (match?.code) {
            if (matchResult.usedRelaxedFilters) {
              const fallbackLabel = matchResult.usedTimeFallback ? 'relaxed match + time fallback' : 'relaxed match';
              await addLog(`Step ${step}: Strict rules did not match; switched to ${fallbackLabel} and matched a YYDS Mail verification code.`, 'warn');
            }
            return {
              ok: true,
              code: match.code,
              emailTimestamp: match.receivedAt || Date.now(),
              mailId: match.message?.id || '',
            };
          }

          lastError = new Error(`Step ${step}: No matching verification code found in YYDS Mail yet (${attempt}/${maxAttempts}).`);
          await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
          const sample = summarizeYydsMailMessagesForLog(detailedMessages.length ? detailedMessages : messages);
          if (sample) {
            await addLog(`Step ${step}: Recent message sample: ${sample}`, 'info');
          }
        } catch (err) {
          lastError = err;
          await addLog(`Step ${step}: YYDS Mail polling failed: ${err.message}`, 'warn');
        }
        if (attempt < maxAttempts) {
          await sleepWithStop(intervalMs);
        }
      }

      throw lastError || new Error(`Step ${step}: No new matching verification code found in YYDS Mail.`);
    }

    async function clearYydsMailRuntimeState(options = {}) {
      await setState({
        currentYydsMailInbox: null,
        ...(options.clearEmail ? { email: null } : {}),
      });
    }

    return {
      clearYydsMailRuntimeState,
      ensureYydsMailConfig,
      fetchYydsMailAddress,
      getYydsMailConfig,
      getYydsMailMessageDetail,
      listYydsMailMessages,
      pollYydsMailVerificationCode,
      requestYydsMailJson,
      resolveYydsMailPollTargetEmail,
    };
  }

  return {
    createYydsMailProvider,
  };
});
