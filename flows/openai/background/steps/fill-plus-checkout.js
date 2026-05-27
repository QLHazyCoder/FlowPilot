(function attachBackgroundPlusCheckoutBilling(root, factory) {
  root.MultiPageBackgroundPlusCheckoutBilling = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPlusCheckoutBillingModule() {
  const PLUS_CHECKOUT_SOURCE = 'plus-checkout';
  const PLUS_CHECKOUT_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'flows/openai/content/plus-checkout.js'];
  const PLUS_CHECKOUT_URL_PATTERN = /^https:\/\/chatgpt\.com\/checkout(?:\/|$)/i;
  const PLUS_CHECKOUT_FRAME_READY_DELAY_MS = 500;
  const PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS = 5;
  const PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS = 10000;
  const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
  const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
  const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
  const DEFAULT_GPC_HELPER_API_URL = 'https://gpc.qlhazycoder.top';
  const GPC_HELPER_PHONE_MODE_AUTO = 'auto';
  const GPC_HELPER_PHONE_MODE_MANUAL = 'manual';
  const GPC_TASK_POLL_INTERVAL_MS = 3000;
  const GPC_TASK_STALE_STATUS_TIMEOUT_MS = 60000;
  const GPC_REMOTE_STAGE_LABELS = {
    auto_otp_wait: 'Waiting for auto OTP',
    checkout_order_start: 'Create order',
    checkout_start: 'Create order',
    completed: 'Top-up complete',
    gopay_validate_pin: 'Validate PIN',
    otp_ready: 'Waiting for PIN',
    otp_submitted_local: 'OTP submitted',
    payment_processing: 'Payment processing',
    pin_submitted_local: 'PIN submitted',
    sms_otp_wait: 'Waiting for SMS OTP',
    whatsapp_otp_wait: 'Waiting for WhatsApp OTP',
  };
  const GPC_WAITING_FOR_LABELS = {
    auto_otp: 'Auto OTP',
    otp: 'OTP',
    pin: 'PIN',
  };
  const PAYMENT_METHOD_CONFIGS = {
    [PLUS_PAYMENT_METHOD_PAYPAL]: {
      id: PLUS_PAYMENT_METHOD_PAYPAL,
      label: 'PayPal',
      selectMessageType: 'PLUS_CHECKOUT_SELECT_PAYPAL',
      redirectPattern: /paypal\./i,
    },
    [PLUS_PAYMENT_METHOD_GOPAY]: {
      id: PLUS_PAYMENT_METHOD_GOPAY,
      label: 'GoPay',
      selectMessageType: 'PLUS_CHECKOUT_SELECT_GOPAY',
      redirectPattern: /gopay|gojek|midtrans|xendit|stripe|checkout/i,
    },
  };
  const MEIGUODIZHI_ADDRESS_ENDPOINT = 'https://www.meiguodizhi.com/api/v1/dz';
  const MEIGUODIZHI_COUNTRY_CONFIG = {
    AR: { path: '/ar-address', city: 'Buenos Aires', aliases: ['ar', 'argentina', '阿根廷'] },
    AU: { path: '/au-address', city: 'Sydney', aliases: ['au', 'aus', 'australia', '澳大利亚'] },
    CA: { path: '/ca-address', city: 'Toronto', aliases: ['ca', 'canada', '加拿大'] },
    CN: { path: '/cn-address', city: 'Shanghai', aliases: ['cn', 'china', '中国'] },
    DE: { path: '/de-address', city: 'Berlin', aliases: ['de', 'deu', 'germany', 'deutschland', '德国'] },
    ES: { path: '/es-address', city: 'Madrid', aliases: ['es', 'esp', 'spain', '西班牙'] },
    FR: { path: '/fr-address', city: 'Paris', aliases: ['fr', 'fra', 'france', '法国'] },
    GB: { path: '/uk-address', city: 'London', aliases: ['gb', 'uk', 'united kingdom', 'britain', 'england', '英国'] },
    HK: { path: '/hk-address', city: 'Hong Kong', aliases: ['hk', 'hong kong', '香港'] },
    ID: { path: '/id-address', city: 'Jakarta', aliases: ['id', 'indonesia', '印度尼西亚', '印尼'] },
    IT: { path: '/it-address', city: 'Rome', aliases: ['it', 'ita', 'italy', '意大利'] },
    JP: { path: '/jp-address', city: 'Tokyo', aliases: ['jp', 'jpn', 'japan', '日本', '日本国'] },
    KR: { path: '/kr-address', city: 'Seoul', aliases: ['kr', 'kor', 'korea', 'south korea', '韩国'] },
    MY: { path: '/my-address', city: 'Kuala Lumpur', aliases: ['my', 'malaysia', '马来西亚'] },
    NL: { path: '/nl-address', city: 'Amsterdam', aliases: ['nl', 'netherlands', 'holland', '荷兰'] },
    PH: { path: '/ph-address', city: 'Manila', aliases: ['ph', 'philippines', '菲律宾'] },
    RU: { path: '/ru-address', city: 'Moscow', aliases: ['ru', 'russia', '俄罗斯'] },
    SG: { path: '/sg-address', city: 'Singapore', aliases: ['sg', 'singapore', '新加坡'] },
    TH: { path: '/th-address', city: 'Bangkok', aliases: ['th', 'thailand', '泰国'] },
    TR: { path: '/tr-address', city: 'Istanbul', aliases: ['tr', 'turkey', 'turkiye', '土耳其'] },
    TW: { path: '/tw-address', city: 'Taipei', aliases: ['tw', 'taiwan', '台湾'] },
    US: { path: '/', city: 'New York', aliases: ['us', 'usa', 'united states', 'united states of america', 'america', '美国'] },
    VN: { path: '/vn-address', city: 'Ho Chi Minh City', aliases: ['vn', 'vietnam', '越南'] },
  };

  function createPlusCheckoutBillingExecutor(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      broadcastDataUpdate,
      chrome,
      completeNodeFromBackground,
      ensureContentScriptReadyOnTabUntilStopped,
      fetch: fetchImpl = null,
      generateRandomName,
      getAddressSeedForCountry,
      getState,
      getTabId,
      isTabAlive,
      markCurrentRegistrationAccountUsed,
      queryTabsInAutomationWindow = null,
      setState,
      sleepWithStop,
      waitForTabCompleteUntilStopped,
      probeIpProxyExit = null,
      throwIfStopped = () => {},
    } = deps;

    function addLog(message, level = 'info', options = {}) {
      return rawAddLog(message, level, {
        step: 7,
        stepKey: 'plus-checkout-billing',
        ...(options && typeof options === 'object' ? options : {}),
      });
    }

    function isPlusCheckoutUrl(url = '') {
      return PLUS_CHECKOUT_URL_PATTERN.test(String(url || ''));
    }

    function normalizeText(value = '') {
      return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function isGpcHelperCheckout(state = {}) {
      return normalizePlusPaymentMethod(state?.plusPaymentMethod) === PLUS_PAYMENT_METHOD_GPC_HELPER
        || (normalizeText(state?.plusCheckoutSource) === PLUS_PAYMENT_METHOD_GPC_HELPER
          && Boolean(state?.gopayHelperTaskId || state?.gopayHelperReferenceId));
    }

    function compactCountryText(value = '') {
      return normalizeText(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
    }

    function normalizePlusPaymentMethod(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizePlusPaymentMethod) {
        return rootScope.GoPayUtils.normalizePlusPaymentMethod(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
        return PLUS_PAYMENT_METHOD_GPC_HELPER;
      }
      return normalized === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_PAYMENT_METHOD_GOPAY : PLUS_PAYMENT_METHOD_PAYPAL;
    }

    function normalizeGpcHelperPhoneMode(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcHelperPhoneMode) {
        return rootScope.GoPayUtils.normalizeGpcHelperPhoneMode(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      return normalized === GPC_HELPER_PHONE_MODE_AUTO || normalized === 'builtin'
        ? GPC_HELPER_PHONE_MODE_AUTO
        : GPC_HELPER_PHONE_MODE_MANUAL;
    }

    function formatGpcRemoteStageLabel(stage = '') {
      const normalized = String(stage || '').trim().toLowerCase();
      if (!normalized) {
        return '';
      }
      return GPC_REMOTE_STAGE_LABELS[normalized] || normalized;
    }

    function formatGpcWaitingForLabel(waitingFor = '') {
      const normalized = String(waitingFor || '').trim().toLowerCase();
      if (!normalized) {
        return '';
      }
      return GPC_WAITING_FOR_LABELS[normalized] || normalized.toUpperCase();
    }

    function formatGpcTaskStatusLog(task = {}) {
      const statusText = String(task?.status_text || task?.statusText || '').trim();
      const status = String(task?.status || '').trim();
      const remoteStage = String(task?.remote_stage || task?.remoteStage || '').trim();
      const stageText = formatGpcRemoteStageLabel(remoteStage);
      const waitingForText = formatGpcWaitingForLabel(task?.api_waiting_for || task?.apiWaitingFor || '');
      const mainText = stageText || statusText || status || 'Processing';
      const parts = [`Step 7: GPC task status: ${mainText}`];
      if (waitingForText && !mainText.includes(waitingForText)) {
        parts.push(`, waiting for ${waitingForText}`);
      }
      return parts.join('');
    }

    function getGpcHelperPhoneMode(state = {}, task = null) {
      return normalizeGpcHelperPhoneMode(
        task?.phone_mode
        || task?.phoneMode
        || state?.gopayHelperPhoneMode
        || state?.phoneMode
      );
    }

    function getPaymentMethodConfig(method = PLUS_PAYMENT_METHOD_PAYPAL) {
      return PAYMENT_METHOD_CONFIGS[normalizePlusPaymentMethod(method)] || PAYMENT_METHOD_CONFIGS[PLUS_PAYMENT_METHOD_PAYPAL];
    }

    function normalizeGpcHelperBaseUrl(apiUrl = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcHelperBaseUrl) {
        return rootScope.GoPayUtils.normalizeGpcHelperBaseUrl(apiUrl);
      }
      let normalized = String(apiUrl || DEFAULT_GPC_HELPER_API_URL).trim().replace(/\/+$/g, '');
      normalized = normalized.replace(/\/api\/checkout\/start$/i, '');
      normalized = normalized.replace(/\/api\/gopay\/(?:otp|pin)$/i, '');
      normalized = normalized.replace(/\/api\/gp\/tasks(?:\/[^/?#]+)?(?:\/(?:otp|pin|stop))?(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/gp\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/balance(?:\?.*)?$/i, '');
      normalized = normalized.replace(/\/api\/card\/redeem-api-key(?:\?.*)?$/i, '');
      return normalized || DEFAULT_GPC_HELPER_API_URL;
    }

    async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
      const fetcher = typeof fetchImpl === 'function'
        ? fetchImpl
        : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (typeof fetcher !== 'function') {
        throw new Error('Current runtime does not support fetch, cannot call GPC API.');
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const effectiveTimeoutMs = Math.max(1000, Number(timeoutMs) || 30000);
      let didTimeout = false;
      let timer = null;
      const buildTimeoutError = () => new Error(`GPC API request timed out (>${Math.round(effectiveTimeoutMs / 1000)} s): ${url}`);
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          didTimeout = true;
          reject(buildTimeoutError());
          if (controller) {
            controller.abort();
          }
        }, effectiveTimeoutMs);
      });
      try {
        const response = await Promise.race([
          fetcher(url, { ...options, ...(controller ? { signal: controller.signal } : {}) }),
          timeoutPromise,
        ]);
        const data = await Promise.race([
          response.json().catch(() => ({})),
          timeoutPromise,
        ]);
        return { response, data };
      } catch (error) {
        if (didTimeout || error?.name === 'AbortError') {
          throw buildTimeoutError();
        }
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function buildGpcOtpPayload(input = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcOtpPayload) {
        return rootScope.GoPayUtils.buildGpcOtpPayload(input);
      }
      const payload = {
        reference_id: String(input.reference_id ?? input.referenceId ?? '').trim(),
        otp: String(input.otp ?? input.code ?? '').trim().replace(/[^\d]/g, ''),
      };
      const gopayGuid = String(input.gopay_guid ?? input.gopayGuid ?? '').trim();
      const redirectUrl = String(input.redirect_url ?? input.redirectUrl ?? '').trim();
      const flowId = String(input.flow_id ?? input.flowId ?? '').trim();
      if (flowId) payload.flow_id = flowId;
      if (gopayGuid) payload.gopay_guid = gopayGuid;
      if (redirectUrl) payload.redirect_url = redirectUrl;
      return payload;
    }

    function buildGpcOtpRetryPayload(input = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcOtpRetryPayload) {
        return rootScope.GoPayUtils.buildGpcOtpRetryPayload(input);
      }
      const basePayload = buildGpcOtpPayload(input);
      return { ...basePayload, code: basePayload.otp };
    }

    function buildGpcPinPayload(input = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcPinPayload) {
        return rootScope.GoPayUtils.buildGpcPinPayload(input);
      }
      const payload = {
        reference_id: String(input.reference_id ?? input.referenceId ?? '').trim(),
        challenge_id: String(input.challenge_id ?? input.challengeId ?? '').trim(),
        gopay_guid: String(input.gopay_guid ?? input.gopayGuid ?? '').trim(),
        pin: String(input.pin ?? '').trim().replace(/[^\d]/g, ''),
      };
      const redirectUrl = String(input.redirect_url ?? input.redirectUrl ?? '').trim();
      const flowId = String(input.flow_id ?? input.flowId ?? '').trim();
      if (flowId) payload.flow_id = flowId;
      if (redirectUrl) payload.redirect_url = redirectUrl;
      return payload;
    }

    function buildGpcPinRetryPayload(input = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcPinRetryPayload) {
        return rootScope.GoPayUtils.buildGpcPinRetryPayload(input);
      }
      const basePayload = buildGpcPinPayload(input);
      return { ...basePayload, challengeId: basePayload.challenge_id };
    }

    function getGpcResponseErrorDetail(payload = {}, status = 0) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.extractGpcResponseErrorDetail) {
        return rootScope.GoPayUtils.extractGpcResponseErrorDetail(payload, status);
      }
      if (payload && typeof payload === 'object') {
        return payload?.data?.detail || payload.detail || payload.message || payload.error || payload.error_description || payload.reason || `HTTP ${status || 0}`;
      }
      return `HTTP ${status || 0}`;
    }

    function unwrapGpcResponse(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.unwrapGpcResponse) {
        return rootScope.GoPayUtils.unwrapGpcResponse(payload);
      }
      if (payload && typeof payload === 'object' && !Array.isArray(payload)
        && Object.prototype.hasOwnProperty.call(payload, 'data')
        && (Object.prototype.hasOwnProperty.call(payload, 'code') || Object.prototype.hasOwnProperty.call(payload, 'message'))) {
        return payload.data ?? {};
      }
      return payload;
    }

    function isGpcUnifiedResponseOk(payload = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.isGpcUnifiedResponseOk) {
        return rootScope.GoPayUtils.isGpcUnifiedResponseOk(payload);
      }
      if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'code')) {
        return true;
      }
      const code = Number(payload.code);
      return Number.isFinite(code) ? code >= 200 && code < 300 : String(payload.code || '').trim() === '200';
    }

    function buildGpcTaskQueryUrl(apiUrl = '', taskId = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcTaskQueryUrl) {
        return rootScope.GoPayUtils.buildGpcTaskQueryUrl(apiUrl, taskId);
      }
      const baseUrl = normalizeGpcHelperBaseUrl(apiUrl);
      return `${baseUrl}/api/gp/tasks/${encodeURIComponent(String(taskId || '').trim())}`;
    }

    function buildGpcTaskActionUrl(apiUrl = '', taskId = '', action = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcTaskActionUrl) {
        return rootScope.GoPayUtils.buildGpcTaskActionUrl(apiUrl, taskId, action);
      }
      const baseUrl = normalizeGpcHelperBaseUrl(apiUrl);
      const normalizedAction = String(action || '').trim().replace(/^\/+|\/+$/g, '');
      return `${baseUrl}/api/gp/tasks/${encodeURIComponent(String(taskId || '').trim())}/${normalizedAction}`;
    }

    function buildGpcTaskOtpPayload(input = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcTaskOtpPayload) {
        return rootScope.GoPayUtils.buildGpcTaskOtpPayload(input);
      }
      return {
        otp: String(input.otp ?? input.code ?? '').trim().replace(/[^\d]/g, ''),
      };
    }

    function buildGpcTaskPinPayload(input = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcTaskPinPayload) {
        return rootScope.GoPayUtils.buildGpcTaskPinPayload(input);
      }
      return {
        pin: String(input.pin ?? '').trim().replace(/[^\d]/g, ''),
      };
    }

    function buildGpcApiKeyHeaders(apiKey = '', extraHeaders = {}) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.buildGpcApiKeyHeaders) {
        return rootScope.GoPayUtils.buildGpcApiKeyHeaders(apiKey, extraHeaders);
      }
      const headers = {
        ...(extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {}),
      };
      const normalizedApiKey = String(apiKey || '').trim();
      if (normalizedApiKey) {
        headers['X-API-Key'] = normalizedApiKey;
      }
      return headers;
    }

    function normalizeGpcTaskData(payload = {}) {
      const data = unwrapGpcResponse(payload);
      const task = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : {};
      task.task_id = String(task.task_id || task.taskId || '').trim();
      task.status = String(task.status || '').trim().toLowerCase();
      task.status_text = String(task.status_text || task.statusText || '').trim();
      task.phone_mode = normalizeGpcHelperPhoneMode(task.phone_mode || task.phoneMode || '');
      task.remote_stage = String(task.remote_stage || task.remoteStage || '').trim().toLowerCase();
      task.api_waiting_for = String(task.api_waiting_for || task.apiWaitingFor || '').trim().toLowerCase();
      task.api_input_deadline_at = String(task.api_input_deadline_at || task.apiInputDeadlineAt || '').trim();
      task.api_input_wait_seconds = Math.max(0, Number(task.api_input_wait_seconds ?? task.apiInputWaitSeconds) || 0);
      task.last_input_error = String(task.last_input_error || task.lastInputError || '').trim();
      task.otp_invalid_count = Math.max(0, Number(task.otp_invalid_count ?? task.otpInvalidCount) || 0);
      task.failure_stage = String(task.failure_stage || task.failureStage || '').trim();
      task.failure_detail = String(task.failure_detail || task.failureDetail || '').trim();
      task.error_message = String(task.error_message || task.errorMessage || '').trim();
      return task;
    }

    async function setGpcTaskState(taskData = {}) {
      const task = normalizeGpcTaskData(taskData);
      const updates = {
        gopayHelperTaskId: task.task_id,
        gopayHelperTaskStatus: task.status,
        gopayHelperStatusText: task.status_text,
        gopayHelperRemoteStage: task.remote_stage,
        gopayHelperApiWaitingFor: task.api_waiting_for,
        gopayHelperApiInputDeadlineAt: task.api_input_deadline_at,
        gopayHelperApiInputWaitSeconds: task.api_input_wait_seconds,
        gopayHelperLastInputError: task.last_input_error,
        gopayHelperOtpInvalidCount: task.otp_invalid_count,
        gopayHelperFailureStage: task.failure_stage,
        gopayHelperFailureDetail: task.failure_detail,
        gopayHelperTaskPayload: task && typeof task === 'object' && !Array.isArray(task) ? task : null,
      };
      await setState(updates);
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(updates);
      }
      return task;
    }

    async function fetchGpcTaskStatus(apiUrl, taskId, apiKey) {
      const requestUrl = buildGpcTaskQueryUrl(apiUrl, taskId);
      const { response, data } = await fetchJsonWithTimeout(requestUrl, {
        method: 'GET',
        headers: buildGpcApiKeyHeaders(apiKey, { Accept: 'application/json' }),
      }, 30000);
      if (!response?.ok || !isGpcUnifiedResponseOk(data)) {
        throw new Error(getGpcResponseErrorDetail(data, response?.status || 0));
      }
      return setGpcTaskState(data);
    }

    async function postGpcTaskAction(apiUrl, taskId, action, payload = {}, apiKey = '', timeoutMs = 30000) {
      const requestUrl = buildGpcTaskActionUrl(apiUrl, taskId, action);
      const { response, data } = await fetchJsonWithTimeout(requestUrl, {
        method: 'POST',
        headers: buildGpcApiKeyHeaders(apiKey, {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      }, timeoutMs);
      if (!response?.ok || !isGpcUnifiedResponseOk(data)) {
        throw new Error(getGpcResponseErrorDetail(data, response?.status || 0));
      }
      return setGpcTaskState(data);
    }

    async function postGpcJsonWithFallback(apiUrl, endpointPath, primaryPayload, fallbackPayload, timeoutMs = 30000) {
      const requestUrl = `${apiUrl}${endpointPath}`;
      const send = (payload) => fetchJsonWithTimeout(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, timeoutMs);
      const firstResponse = await send(primaryPayload);
      if (firstResponse?.response?.ok || !fallbackPayload) {
        return { ...firstResponse, retried: false, payload: primaryPayload };
      }
      const status = Number(firstResponse?.response?.status || 0);
      if (status !== 400 && status !== 422) {
        return { ...firstResponse, retried: false, payload: primaryPayload };
      }
      const firstDetail = getGpcResponseErrorDetail(firstResponse?.data, status);
      await addLog(`Step 7: GPC endpoint returned ${status} (${firstDetail}), retrying with compatible fields.`, 'warn');
      const secondResponse = await send(fallbackPayload);
      return {
        ...secondResponse,
        retried: true,
        payload: fallbackPayload,
        firstError: firstDetail,
        firstStatus: status,
      };
    }

    function getStateInternal() {
      if (typeof getState === 'function') {
        return getState();
      }
      return Promise.resolve({});
    }

    function normalizeLocalSmsHelperBaseUrl(value = '') {
      const fallback = 'http://127.0.0.1:18767';
      const rawValue = String(value || fallback).trim();
      try {
        const parsed = new URL(rawValue);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return fallback;
        }
        const endpointPath = parsed.pathname.replace(/\/+$/g, '') || '/';
        if (['/otp', '/latest-otp', '/health'].includes(endpointPath)) {
          parsed.pathname = '';
          parsed.search = '';
          parsed.hash = '';
        }
        return parsed.toString().replace(/\/$/, '');
      } catch {
        return fallback;
      }
    }

    function normalizeIncomingGpcSmsOtp(payload = {}) {
      const candidates = [
        payload?.otp,
        payload?.code,
        payload?.sms_code,
        payload?.smsCode,
        payload?.verification_code,
        payload?.verificationCode,
      ];
      for (const candidate of candidates) {
        const normalized = String(candidate || '').trim().replace(/[^\d]/g, '');
        if (/^\d{4,8}$/.test(normalized)) {
          return normalized;
        }
      }
      const messageText = String(payload?.message_text || payload?.messageText || payload?.text || '').trim();
      if (messageText) {
        const match = messageText.match(/(?:OTP\s*[:：]?\s*|#)(\d{4,8})\b|\b(\d{6})\b/i);
        if (match) {
          return String(match[1] || match[2] || '').trim();
        }
      }
      return '';
    }

    function normalizeGpcOtpChannel(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGpcOtpChannel) {
        return rootScope.GoPayUtils.normalizeGpcOtpChannel(value);
      }
      return String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
    }

    function normalizeEpochMilliseconds(value = 0) {
      const rawValue = String(value ?? '').trim();
      if (!rawValue) {
        return 0;
      }
      const numeric = Number(rawValue);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.floor(numeric < 100000000000 ? numeric * 1000 : numeric);
      }
      const parsed = Date.parse(rawValue);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function normalizeLocalSmsHelperCountryCode(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.GoPayUtils?.normalizeGoPayCountryCode) {
        return rootScope.GoPayUtils.normalizeGoPayCountryCode(value || '+86');
      }
      const digits = String(value || '+86').replace(/\D/g, '');
      return digits ? `+${digits}` : '+86';
    }

    function normalizeLocalSmsHelperPhoneE164(phone = '', countryCode = '+86') {
      const rawPhone = String(phone || '').trim();
      if (!rawPhone) {
        return '';
      }
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      const normalizedCountryCode = normalizeLocalSmsHelperCountryCode(countryCode);
      const normalizedPhone = rootScope.GoPayUtils?.normalizeGoPayPhone
        ? rootScope.GoPayUtils.normalizeGoPayPhone(rawPhone)
        : rawPhone.replace(/[^\d+]/g, '');
      const phoneDigits = normalizedPhone.replace(/\D/g, '');
      if (!phoneDigits) {
        return '';
      }
      if (normalizedPhone.startsWith('+')) {
        return `+${phoneDigits}`;
      }
      const countryDigits = normalizedCountryCode.replace(/\D/g, '') || '86';
      let nationalNumber = phoneDigits;
      if (countryDigits && nationalNumber.startsWith(countryDigits) && nationalNumber.length > countryDigits.length) {
        nationalNumber = nationalNumber.slice(countryDigits.length);
      }
      return `+${countryDigits}${nationalNumber}`;
    }

    function buildLocalSmsHelperOtpUrl(state = {}, taskId = '', options = {}) {
      const baseUrl = normalizeLocalSmsHelperBaseUrl(state?.gopayHelperLocalSmsHelperUrl);
      const url = new URL(`${baseUrl}/latest-otp`);
      const normalizedTaskId = String(taskId || '').trim();
      const phoneNumber = normalizeLocalSmsHelperPhoneE164(
        state?.gopayHelperPhoneNumber,
        state?.gopayHelperCountryCode || '+86'
      );
      const afterOverrideMs = normalizeEpochMilliseconds(options?.afterMs || options?.after_ms || 0);
      const orderCreatedAt = normalizeEpochMilliseconds(
        state?.gopayHelperOrderCreatedAt
          || state?.gopayHelperTaskPayload?.created_at
          || state?.gopayHelperTaskPayload?.createdAt
          || state?.gopayHelperStartPayload?.order_created_at
          || state?.gopayHelperStartPayload?.orderCreatedAt
          || state?.gopayHelperStartPayload?.created_at
          || state?.gopayHelperStartPayload?.createdAt
      );
      if (normalizedTaskId) {
        url.searchParams.set('task_id', normalizedTaskId);
        url.searchParams.set('reference_id', normalizedTaskId);
      }
      if (phoneNumber) {
        url.searchParams.set('phone', phoneNumber);
      }
      url.searchParams.set('consume', '1');
      const effectiveAfterMs = Math.max(orderCreatedAt, afterOverrideMs);
      if (effectiveAfterMs > 0) {
        url.searchParams.set('after_ms', String(effectiveAfterMs));
      }
      return url.toString();
    }

    async function pollLocalSmsHelperOtp(state = {}, taskId = '', options = {}) {
      const timeoutSeconds = Math.max(1, Math.min(300, Number(options?.timeoutSeconds ?? options?.timeout_seconds ?? state?.gopayHelperLocalSmsTimeoutSeconds) || 90));
      const pollIntervalSeconds = Math.max(1, Math.min(30, Number(state?.gopayHelperLocalSmsPollIntervalSeconds) || 2));
      const singleAttempt = Boolean(options?.singleAttempt || options?.single_attempt);
      const requestTimeoutMs = Math.max(1000, Math.min(8000, Number(options?.requestTimeoutMs ?? options?.request_timeout_ms) || pollIntervalSeconds * 1000));
      const deadline = Date.now() + timeoutSeconds * 1000;
      const requestUrl = buildLocalSmsHelperOtpUrl(state, taskId, options);
      let lastMessage = '';
      while (Date.now() <= deadline) {
        throwIfStopped();
        try {
          const { response, data } = await fetchJsonWithTimeout(requestUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          }, requestTimeoutMs);
          const otp = normalizeIncomingGpcSmsOtp(data || {});
          if (response?.ok && otp) {
            await setState({
              gopayHelperResolvedOtp: otp,
              gopayHelperSmsOtpPayload: data && typeof data === 'object' && !Array.isArray(data) ? data : null,
            });
            if (typeof broadcastDataUpdate === 'function') {
              broadcastDataUpdate({ gopayHelperResolvedOtp: otp });
            }
            return otp;
          }
          lastMessage = String(data?.message || data?.status || '').trim();
        } catch (error) {
          lastMessage = error?.message || String(error || 'Unknown error');
        }
        if (singleAttempt) {
          break;
        }
        await sleepWithStop(pollIntervalSeconds * 1000);
      }
      throw new Error(lastMessage || 'Local SMS Helper timed out waiting for OTP.');
    }

    function buildGpcTaskEndedError(task = {}, fallbackMessage = '') {
      const detail = buildGpcTaskTerminalError(task) || fallbackMessage || 'GPC task ended, please recreate the task.';
      return new Error(`GPC_TASK_ENDED::${detail}`);
    }

    function isGpcTaskInputDeadlineExpired(task = {}) {
      const deadlineMs = normalizeEpochMilliseconds(task?.api_input_deadline_at || task?.apiInputDeadlineAt || '');
      return deadlineMs > 0 && Date.now() > deadlineMs;
    }

    function buildGpcInputDeadlineError(task = {}, label = 'input') {
      const stage = String(task?.remote_stage || '').trim();
      const detail = `${label} submission timed out, please recreate the task.`;
      return new Error(`GPC_TASK_ENDED::${detail}${stage ? ` (${stage})` : ''}`);
    }

    function normalizeSixDigitOtp(value = '') {
      const otp = String(value || '').trim().replace(/[^\d]/g, '');
      return /^\d{6}$/.test(otp) ? otp : '';
    }

    function normalizeSixDigitPin(value = '') {
      const pin = String(value || '').trim().replace(/[^\d]/g, '');
      return /^\d{6}$/.test(pin) ? pin : '';
    }

    function isGpcOtpFormatConflict(error) {
      return /OTP must be 6 digits|OTP必须是\s*6\s*位数字|OTP.*6.*digit|task_conflict/i.test(error?.message || String(error || ''));
    }

    async function requestGpcOtpInput({ title = '', message = '', taskId = '', lastInputError = '', inputDeadlineAt = '' }) {
      const existingState = await getStateInternal();
      const existingRequestId = String(existingState?.plusManualConfirmationRequestId || '').trim();
      if (
        existingState?.plusManualConfirmationPending
        && existingRequestId
        && String(existingState?.plusManualConfirmationMethod || '').trim().toLowerCase() === 'gopay-otp'
        && String(existingState?.gopayHelperOtpReferenceId || '').trim() === String(taskId || '').trim()
      ) {
        return waitForGpcOtpInput(existingRequestId, { inputDeadlineAt });
      }

      const requestId = `otp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        plusManualConfirmationPending: true,
        plusManualConfirmationRequestId: requestId,
        plusManualConfirmationStep: 7,
        plusManualConfirmationMethod: 'gopay-otp',
        plusManualConfirmationTitle: title || 'GPC OTP verification',
        plusManualConfirmationMessage: message || 'Please enter the OTP verification code',
        gopayHelperLastInputError: String(lastInputError || '').trim(),
        gopayHelperApiInputDeadlineAt: String(inputDeadlineAt || '').trim(),
        gopayHelperResolvedOtp: '',
        gopayHelperOtpRequestId: requestId,
        gopayHelperOtpReferenceId: taskId,
      };
      await setState(payload);
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(payload);
      }
      return waitForGpcOtpInput(requestId, { inputDeadlineAt });
    }

    function waitForGpcOtpInput(requestId = '', options = {}) {
      const deadlineMs = normalizeEpochMilliseconds(options?.inputDeadlineAt || options?.input_deadline_at || 0);
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(async () => {
          try {
            throwIfStopped();
            if (deadlineMs > 0 && Date.now() > deadlineMs) {
              clearInterval(checkInterval);
              const clearPayload = {
                plusManualConfirmationPending: false,
                plusManualConfirmationRequestId: '',
                plusManualConfirmationStep: 0,
                plusManualConfirmationMethod: '',
                plusManualConfirmationTitle: '',
                plusManualConfirmationMessage: '',
                gopayHelperResolvedOtp: '',
                gopayHelperOtpRequestId: '',
                gopayHelperOtpReferenceId: '',
              };
              await setState(clearPayload);
              if (typeof broadcastDataUpdate === 'function') {
                broadcastDataUpdate(clearPayload);
              }
              reject(new Error('OTP input timed out'));
              return;
            }
            const currentState = await getStateInternal();
            if (!currentState?.plusManualConfirmationPending || currentState?.plusManualConfirmationRequestId !== requestId) {
              clearInterval(checkInterval);
              const resolvedOtp = String(currentState?.gopayHelperResolvedOtp || '').trim().replace(/[^\d]/g, '');
              if (resolvedOtp) {
                resolve(resolvedOtp);
              } else {
                reject(new Error('OTP input cancelled'));
              }
            }
          } catch (error) {
            clearInterval(checkInterval);
            reject(error);
          }
        }, 500);
      });
    }

    function isGpcTaskManualMode(task = {}, state = {}) {
      return getGpcHelperPhoneMode(state, task) === GPC_HELPER_PHONE_MODE_MANUAL;
    }

    function isGpcTaskOtpWait(task = {}, state = {}) {
      return isGpcTaskManualMode(task, state) && task?.api_waiting_for === 'otp';
    }

    function isGpcTaskPinWait(task = {}, state = {}) {
      return isGpcTaskManualMode(task, state)
        && (task?.api_waiting_for === 'pin' || task?.status === 'otp_ready');
    }

    function isGpcTaskTerminal(status = '') {
      return ['completed', 'failed', 'expired', 'discarded'].includes(String(status || '').trim().toLowerCase());
    }

    function buildGpcTaskProgressSignature(task = {}) {
      return [
        task?.status,
        task?.status_text,
        task?.remote_stage,
        task?.api_waiting_for,
        task?.last_input_error,
        task?.otp_invalid_count,
        task?.failure_stage || task?.failureStage,
        task?.failure_detail || task?.failureDetail,
        task?.error_message || task?.errorMessage,
      ].map((value) => String(value ?? '').trim()).join('|');
    }

    function shouldWatchGpcTaskProgress(task = {}, state = {}) {
      if (!task || isGpcTaskTerminal(task.status)) {
        return false;
      }
      if (isGpcTaskOtpWait(task, state) || isGpcTaskPinWait(task, state)) {
        return false;
      }
      return true;
    }

    function getGpcTaskStaleStatusTimeoutMs(state = {}) {
      const configuredSeconds = Number(state?.gopayHelperTaskStaleSeconds);
      if (Number.isFinite(configuredSeconds) && configuredSeconds > 0) {
        return Math.max(15000, Math.min(600000, Math.floor(configuredSeconds * 1000)));
      }
      return GPC_TASK_STALE_STATUS_TIMEOUT_MS;
    }

    function buildGpcTaskStaleStatusError(task = {}, staleTimeoutMs = GPC_TASK_STALE_STATUS_TIMEOUT_MS) {
      const seconds = Math.max(1, Math.round(staleTimeoutMs / 1000));
      const label = formatGpcRemoteStageLabel(task?.remote_stage)
        || task?.status_text
        || task?.status
        || 'unknown state';
      return new Error(`GPC_TASK_ENDED::GPC task made no progress for ${seconds} seconds (${label}), please recreate the task.`);
    }

    function buildGpcTaskTerminalError(task = {}) {
      const status = String(task?.status || '').trim().toLowerCase();
      const remoteStage = String(task?.remote_stage || task?.remoteStage || '').trim();
      const failureStage = String(task?.failure_stage || task?.failureStage || '').trim();
      const detail = String(
        task?.error_message
        || task?.errorMessage
        || task?.failure_detail
        || task?.failureDetail
        || task?.last_input_error
        || task?.lastInputError
        || task?.status_text
        || task?.statusText
        || task?.message
        || task?.detail
        || task?.data?.detail
        || ''
      ).trim();
      if (detail) {
        return failureStage && !detail.includes(failureStage)
          ? `${detail} (${failureStage})`
          : detail;
      }
      if (/api_otp_timeout/i.test(remoteStage)) {
        return 'GPC OTP timed out, please recreate the task';
      }
      if (/api_pin_timeout/i.test(remoteStage)) {
        return 'GPC PIN timed out, please recreate the task';
      }
      if (failureStage) {
        return `GPC task failed: ${failureStage}`;
      }
      return `Task status ${status || 'unknown'}`;
    }

    async function stopGpcTaskBestEffort(apiUrl, taskId, apiKey, reason = '') {
      if (!apiUrl || !taskId || !apiKey) {
        return;
      }
      try {
        const task = await postGpcTaskAction(apiUrl, taskId, 'stop', {}, apiKey, 15000);
        const statusText = task?.status_text || task?.status || 'stopped';
        await addLog(`Step 7: requested to stop GPC task (${statusText}).`, 'warn');
      } catch (error) {
        await addLog(`Step 7: failed to stop GPC task${reason ? ` (${reason})` : ''}: ${error?.message || String(error || 'Unknown error')}`, 'warn');
      }
    }

    async function clearGpcTaskRuntimeState() {
      const updates = {
        plusManualConfirmationPending: false,
        plusManualConfirmationRequestId: '',
        plusManualConfirmationStep: 0,
        plusManualConfirmationMethod: '',
        plusManualConfirmationTitle: '',
        plusManualConfirmationMessage: '',
        gopayHelperTaskId: '',
        gopayHelperTaskStatus: '',
        gopayHelperStatusText: '',
        gopayHelperRemoteStage: '',
        gopayHelperApiWaitingFor: '',
        gopayHelperApiInputDeadlineAt: '',
        gopayHelperApiInputWaitSeconds: 0,
        gopayHelperLastInputError: '',
        gopayHelperOtpInvalidCount: 0,
        gopayHelperFailureStage: '',
        gopayHelperFailureDetail: '',
        gopayHelperTaskPayload: null,
        gopayHelperTaskProgressSignature: '',
        gopayHelperTaskProgressAt: 0,
        gopayHelperTaskProgressTaskId: '',
        gopayHelperPinPayload: null,
        gopayHelperResolvedOtp: '',
        gopayHelperOtpRequestId: '',
        gopayHelperOtpReferenceId: '',
      };
      await setState(updates);
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(updates);
      }
    }

    function isGpcTaskEndedError(error) {
      return /^GPC_TASK_ENDED::/i.test(error?.message || String(error || ''));
    }

    async function resolveGpcTaskOtp(state = {}, taskId = '', options = {}) {
      let otp = '';
      const useLocalSmsHelper = Boolean(state?.gopayHelperLocalSmsHelperEnabled);
      const retryCount = Math.max(0, Number(options?.retryCount) || 0);
      const helperAfterMs = normalizeEpochMilliseconds(options?.afterMs || options?.after_ms || 0);
      const lastInputError = String(options?.lastInputError || options?.last_input_error || '').trim();
      if (useLocalSmsHelper) {
        try {
          await addLog(
            retryCount > 0 || lastInputError
              ? `Step 7: ${lastInputError || 'OTP validation failed'}, waiting for new GPC OTP from local OTP Helper...`
              : 'Step 7: waiting for GPC OTP from local OTP Helper...',
            'info'
          );
          otp = await pollLocalSmsHelperOtp(state, taskId, {
            afterMs: helperAfterMs,
            singleAttempt: true,
            requestTimeoutMs: 2000,
            timeoutSeconds: 2,
          });
          await addLog('Step 7: local OTP Helper has read the GPC OTP, preparing to submit for verification.', 'ok');
        } catch (error) {
          await addLog(`Step 7: local OTP Helper has not yet read a new OTP: ${error?.message || String(error || 'Unknown error')}, continuing to wait for remote task status update.`, 'warn');
        }
      }
      if (otp) {
        return otp;
      }
      if (useLocalSmsHelper) {
        return '';
      }
      await addLog('Step 7: waiting for user to enter OTP...', 'info');
      return requestGpcOtpInput({
        title: 'GPC OTP verification',
        message: retryCount > 0 || lastInputError
          ? `${lastInputError || 'Previous OTP validation failed'}. Please re-enter the correct OTP (task_id: ${taskId})`
          : `Please enter the received OTP (task_id: ${taskId})`,
        lastInputError,
        inputDeadlineAt: options?.inputDeadlineAt || options?.input_deadline_at || '',
        taskId,
      });
    }

    async function executeGpcHelperBilling(state = {}) {
      const taskId = String(state?.gopayHelperTaskId || '').trim();
      const apiUrl = normalizeGpcHelperBaseUrl(state?.gopayHelperApiUrl || '');
      const apiKey = String(
        state?.gopayHelperApiKey
        || state?.gpcApiKey
        || state?.apiKey
        || ''
      ).trim();
      const deadline = Date.now() + Math.max(120, Math.min(1200, Number(state?.gopayHelperTaskTimeoutSeconds) || 900)) * 1000;
      let otpSubmitCount = 0;
      let otpLastSubmittedAt = 0;
      let lastSubmittedOtp = '';
      let pinSubmitted = false;
      let terminalReached = false;
      let lastProgressSignature = String(state?.gopayHelperTaskProgressSignature || '').trim();
      let lastProgressAt = normalizeEpochMilliseconds(state?.gopayHelperTaskProgressAt || 0) || Date.now();
      let lastProgressTaskId = String(state?.gopayHelperTaskProgressTaskId || '').trim();
      if (lastProgressTaskId !== taskId) {
        lastProgressSignature = '';
        lastProgressAt = Date.now();
        lastProgressTaskId = '';
      }
      const staleStatusTimeoutMs = getGpcTaskStaleStatusTimeoutMs(state);

      if (!taskId) {
        throw new Error('Step 7: GPC mode is missing task_id, please run step 6 first.');
      }
      if (!apiUrl) {
        throw new Error('Step 7: GPC mode is missing API URL.');
      }
      if (!apiKey) {
        throw new Error('Step 7: GPC mode is missing API key.');
      }

      const configuredPhoneMode = normalizeGpcHelperPhoneMode(state?.gopayHelperPhoneMode || state?.phoneMode || GPC_HELPER_PHONE_MODE_MANUAL);
      const rawPin = String(state?.gopayHelperPin || '').trim();
      const pinDigits = rawPin.replace(/[^\d]/g, '');
      const pin = normalizeSixDigitPin(rawPin);
      if (configuredPhoneMode === GPC_HELPER_PHONE_MODE_MANUAL && !pin) {
        if (taskId && apiUrl && apiKey) {
          await stopGpcTaskBestEffort(apiUrl, taskId, apiKey, 'PIN config error');
        }
        throw new Error(pinDigits
          ? 'Step 7: GPC PIN must be 6 digits, please check the side-panel config.'
          : 'Step 7: GPC manual mode is missing PIN config.');
      }

      await addLog(`Step 7: GPC ${configuredPhoneMode === GPC_HELPER_PHONE_MODE_AUTO ? 'auto' : 'manual'} mode started polling task (task_id: ${taskId})...`, 'info');
      try {
        while (Date.now() <= deadline) {
          throwIfStopped();
          const task = await fetchGpcTaskStatus(apiUrl, taskId, apiKey);
          await addLog(formatGpcTaskStatusLog(task), 'info');

          if (task.status === 'completed') {
            terminalReached = true;
            await setState({
              plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
            });
            await addLog('Step 7: GPC task completed, preparing to continue with the next step.', 'ok');
            await completeNodeFromBackground('plus-checkout-billing', {
              plusCheckoutSource: PLUS_PAYMENT_METHOD_GPC_HELPER,
            });
            return;
          }

          if (['failed', 'expired', 'discarded'].includes(task.status)) {
            terminalReached = true;
            throw buildGpcTaskEndedError(task, 'GPC task ended, please recreate the task.');
          }

          if (shouldWatchGpcTaskProgress(task, state)) {
            const progressSignature = buildGpcTaskProgressSignature(task);
            const now = Date.now();
            if (progressSignature && (progressSignature !== lastProgressSignature || lastProgressTaskId !== taskId)) {
              lastProgressSignature = progressSignature;
              lastProgressAt = now;
              lastProgressTaskId = taskId;
              await setState({
                gopayHelperTaskProgressSignature: progressSignature,
                gopayHelperTaskProgressAt: now,
                gopayHelperTaskProgressTaskId: taskId,
              });
            } else if (progressSignature && now - lastProgressAt >= staleStatusTimeoutMs) {
              throw buildGpcTaskStaleStatusError(task, staleStatusTimeoutMs);
            }
          } else {
            lastProgressSignature = '';
            lastProgressAt = Date.now();
            lastProgressTaskId = '';
            await setState({
              gopayHelperTaskProgressSignature: '',
              gopayHelperTaskProgressAt: 0,
              gopayHelperTaskProgressTaskId: taskId,
            });
          }

          if (isGpcTaskOtpWait(task, state)) {
            if (isGpcTaskInputDeadlineExpired(task)) {
              throw buildGpcInputDeadlineError(task, 'OTP');
            }
            if (task.last_input_error) {
              await addLog(
                `Step 7: ${task.last_input_error}${task.otp_invalid_count ? ` (OTP errors ${task.otp_invalid_count})` : ''}`,
                'warn'
              );
            }
            let otp = '';
            try {
              otp = await resolveGpcTaskOtp(state, taskId, {
                retryCount: otpSubmitCount,
                afterMs: otpLastSubmittedAt,
                lastInputError: task.last_input_error,
                inputDeadlineAt: task.api_input_deadline_at,
              });
            } catch (error) {
              if (/OTP input (?:cancelled|timed out)|OTP\s*输入(?:已取消|超时)/i.test(error?.message || String(error || ''))) {
                throw new Error(`GPC_TASK_ENDED::${error?.message || 'OTP input cancelled'}, current GPC task ended.`);
              }
              throw error;
            }
            if (!otp) {
              await sleepWithStop(GPC_TASK_POLL_INTERVAL_MS);
              continue;
            }
            const normalizedOtp = normalizeSixDigitOtp(otp);
            if (!normalizedOtp) {
              await addLog('Step 7: OTP must be 6 digits, waiting for a new input.', 'warn');
              await sleepWithStop(GPC_TASK_POLL_INTERVAL_MS);
              continue;
            }
            if (task.last_input_error && lastSubmittedOtp && normalizedOtp === lastSubmittedOtp) {
              await addLog('Step 7: local OTP Helper still returned the previously failed OTP, waiting for a new code.', 'warn');
              await sleepWithStop(GPC_TASK_POLL_INTERVAL_MS);
              continue;
            }
            await addLog('Step 7: submitting OTP...', 'info');
            try {
              await postGpcTaskAction(
                apiUrl,
                taskId,
                'otp',
                buildGpcTaskOtpPayload({ otp: normalizedOtp }),
                apiKey,
                30000
              );
            } catch (error) {
              if (isGpcOtpFormatConflict(error)) {
                await addLog(`Step 7: OTP submission was rejected: ${error?.message || String(error || 'OTP format error')}. Waiting for re-entry.`, 'warn');
                await sleepWithStop(GPC_TASK_POLL_INTERVAL_MS);
                continue;
              }
              throw error;
            }
            otpSubmitCount += 1;
            otpLastSubmittedAt = Date.now();
            lastSubmittedOtp = normalizedOtp;
            await addLog('Step 7: OTP submitted, continuing to wait for GPC task status updates.', 'ok');
          } else if (isGpcTaskPinWait(task, state) && !pinSubmitted) {
            if (isGpcTaskInputDeadlineExpired(task)) {
              throw buildGpcInputDeadlineError(task, 'PIN');
            }
            await addLog('Step 7: Submitting PIN...', 'info');
            let pinTask = null;
            try {
              pinTask = await postGpcTaskAction(
                apiUrl,
                taskId,
                'pin',
                buildGpcTaskPinPayload({ pin }),
                apiKey,
                30000
              );
            } catch (error) {
              throw new Error(`GPC_TASK_ENDED::${error?.message || String(error || 'PIN submission failed. Please recreate the task.')}`);
            }
            pinSubmitted = true;
            await setState({
              gopayHelperPinPayload: pinTask,
            });
            await addLog('Step 7: PIN submitted, continuing to poll until the task completes.', 'ok');
          }

          await sleepWithStop(GPC_TASK_POLL_INTERVAL_MS);
        }
        throw new Error('Step 7: GPC task polling timed out.');
      } catch (error) {
        if (!terminalReached) {
          await stopGpcTaskBestEffort(apiUrl, taskId, apiKey, error?.message || 'flow interrupted');
        }
        if (isGpcTaskEndedError(error)) {
          await clearGpcTaskRuntimeState();
        }
        throw error;
      }
    }

    function resolveMeiguodizhiCountryCode(value = '') {
      const normalized = normalizeText(value);
      const upper = normalized.toUpperCase();
      if (MEIGUODIZHI_COUNTRY_CONFIG[upper]) {
        return upper;
      }
      const compact = compactCountryText(normalized);
      const match = Object.entries(MEIGUODIZHI_COUNTRY_CONFIG).find(([code, config]) => (
        compact === code.toLowerCase()
        || (config.aliases || []).some((alias) => {
          const compactAlias = compactCountryText(alias);
          return compact === compactAlias || (compactAlias.length >= 4 && compact.includes(compactAlias));
        })
      ));
      return match?.[0] || '';
    }

    function hasCompleteAddressFallback(seed) {
      const fallback = seed?.fallback || {};
      return Boolean(
        normalizeText(fallback.address1)
        && normalizeText(fallback.city)
        && normalizeText(fallback.postalCode)
      );
    }

    function normalizePostalCodeForCountry(countryCode, rawPostalCode = '', fallbackPostalCode = '') {
      const normalizedCountry = resolveMeiguodizhiCountryCode(countryCode) || normalizeText(countryCode).toUpperCase();
      const postalCode = normalizeText(rawPostalCode);
      const fallback = normalizeText(fallbackPostalCode);
      if (normalizedCountry !== 'KR') {
        return postalCode;
      }
      if (/^\d{5}$/.test(postalCode)) {
        return postalCode;
      }
      if (/^\d{5}$/.test(fallback)) {
        return fallback;
      }
      return '04524';
    }

    function buildDirectAddressSeed(countryCode, apiAddress, fallbackSeed) {
      const address1 = normalizeText(apiAddress?.Trans_Address || apiAddress?.Address);
      const city = normalizeText(apiAddress?.City);
      const region = normalizeText(apiAddress?.State_Full || apiAddress?.State);
      const postalCode = normalizePostalCodeForCountry(
        countryCode,
        apiAddress?.Zip_Code,
        fallbackSeed?.fallback?.postalCode
      );
      if (!address1 || !city || !postalCode) {
        return null;
      }
      return {
        ...(fallbackSeed || {}),
        countryCode,
        query: [address1, city].filter(Boolean).join(', '),
        source: 'meiguodizhi',
        skipAutocomplete: true,
        fallback: {
          ...(fallbackSeed?.fallback || {}),
          address1,
          city,
          region,
          postalCode,
        },
      };
    }

    async function fetchMeiguodizhiAddressSeed(countryCode, fallbackSeed) {
      if (typeof fetchImpl !== 'function') {
        return null;
      }
      const countryConfig = MEIGUODIZHI_COUNTRY_CONFIG[countryCode];
      if (!countryConfig?.path) {
        return null;
      }
      const path = countryConfig.path;
      const city = normalizeText(fallbackSeed?.fallback?.city || fallbackSeed?.query || countryConfig.city);
      const response = await fetchImpl(MEIGUODIZHI_ADDRESS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city,
          path,
          method: 'refresh',
        }),
      });
      if (!response?.ok) {
        throw new Error(`HTTP ${response?.status || 0}`);
      }
      const data = await response.json();
      if (data?.status !== 'ok') {
        throw new Error(data?.message || data?.status || 'Unknown response');
      }
      return buildDirectAddressSeed(countryCode, data.address || {}, fallbackSeed);
    }

    function getLocalAddressSeed(countryCode) {
      if (typeof getAddressSeedForCountry !== 'function') {
        return null;
      }
      const seed = getAddressSeedForCountry(countryCode, {
        fallbackCountry: 'DE',
      });
      return seed?.countryCode === countryCode ? seed : null;
    }

    function buildMeiguodizhiLookupSeed(countryCode) {
      const config = MEIGUODIZHI_COUNTRY_CONFIG[countryCode];
      if (!config) {
        return null;
      }
      return {
        countryCode,
        query: config.city,
        fallback: {
          address1: '',
          city: config.city,
          region: '',
          postalCode: '',
        },
      };
    }

    function resolveBillingAddressCountry(state = {}, countryOverride = '', paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const normalizedPaymentMethod = normalizePlusPaymentMethod(paymentMethod || state?.plusPaymentMethod);
      const checkoutCountry = resolveMeiguodizhiCountryCode(countryOverride);
      const savedCheckoutCountry = resolveMeiguodizhiCountryCode(state.plusCheckoutCountry);
      const exitCountry = resolveMeiguodizhiCountryCode(
        state.ipProxyAppliedExitRegion
        || state.ipProxyExitRegion
        || ''
      );

      if (normalizedPaymentMethod === PLUS_PAYMENT_METHOD_GOPAY) {
        const countryCode = exitCountry || checkoutCountry || savedCheckoutCountry || 'ID';
        return {
          countryCode,
          requestedCountry: exitCountry
            || normalizeText(countryOverride)
            || normalizeText(state.plusCheckoutCountry)
            || 'ID',
          source: exitCountry ? 'proxy_exit' : (checkoutCountry ? 'checkout_page' : (savedCheckoutCountry ? 'checkout_state' : 'gopay_fallback')),
        };
      }

      const countryCode = checkoutCountry || savedCheckoutCountry || exitCountry || 'DE';
      return {
        countryCode,
        requestedCountry: normalizeText(countryOverride)
          || normalizeText(state.plusCheckoutCountry)
          || exitCountry
          || 'DE',
        source: checkoutCountry ? 'checkout_page' : (savedCheckoutCountry ? 'checkout_state' : (exitCountry ? 'proxy_exit' : 'paypal_fallback')),
      };
    }

    async function resolveBillingAddressSeed(state = {}, countryOverride = '', options = {}) {
      const paymentMethod = normalizePlusPaymentMethod(options.paymentMethod || state?.plusPaymentMethod);
      const countryResolution = resolveBillingAddressCountry(state, countryOverride, paymentMethod);
      const countryCode = countryResolution.countryCode;
      const requestedCountry = countryResolution.requestedCountry;
      if (paymentMethod === PLUS_PAYMENT_METHOD_GOPAY && countryResolution.source === 'proxy_exit') {
        await addLog(`Step 7: The GoPay billing address will be filled based on the current proxy exit region ${countryCode}.`, 'info');
      }
      const localSeed = getLocalAddressSeed(countryCode);
      const lookupSeed = localSeed || buildMeiguodizhiLookupSeed(countryCode);
      if (!lookupSeed) {
        throw new Error(`Step 7: Unable to identify the billing country/region: ${requestedCountry || 'empty'}`);
      }
      try {
        const remoteSeed = await fetchMeiguodizhiAddressSeed(countryCode, lookupSeed);
        if (hasCompleteAddressFallback(remoteSeed)) {
          await addLog(
            `Step 7: Fetched the billing address from the meiguodizhi API (${remoteSeed.fallback.city} / ${remoteSeed.fallback.postalCode}); skipping Google address suggestions.`,
            'info'
          );
          return remoteSeed;
        }
        await addLog('Step 7: The meiguodizhi API returned incomplete address fields; falling back to the local address seed.', 'warn');
      } catch (error) {
        await addLog(`Step 7: The meiguodizhi address API is unavailable; falling back to the local address seed: ${error?.message || String(error || '')}`, 'warn');
      }

      if (hasCompleteAddressFallback(localSeed)) {
        return localSeed;
      }
      throw new Error(`Step 7: The meiguodizhi address for ${requestedCountry} is unavailable, and no local fallback address exists.`);
    }

    async function getAlivePlusCheckoutTabId(tabId) {
      if (!Number.isInteger(tabId) || tabId <= 0) {
        return null;
      }
      if (!chrome?.tabs?.get) {
        return tabId;
      }
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      return tab && isPlusCheckoutUrl(tab.url) ? tabId : null;
    }

    async function getCurrentPlusCheckoutTabId() {
      if (!chrome?.tabs?.query) {
        return null;
      }

      const queryTabs = typeof queryTabsInAutomationWindow === 'function'
        ? queryTabsInAutomationWindow
        : (queryInfo) => chrome.tabs.query(queryInfo);
      const activeTabs = await queryTabs({ active: true, currentWindow: true }).catch(() => []);
      const activeCheckoutTab = activeTabs.find((tab) => Number.isInteger(tab?.id) && isPlusCheckoutUrl(tab.url));
      if (activeCheckoutTab) {
        return activeCheckoutTab.id;
      }

      const checkoutTabs = await queryTabs({ url: 'https://chatgpt.com/checkout/*' }).catch(() => []);
      const checkoutTab = checkoutTabs.find((tab) => Number.isInteger(tab?.id) && isPlusCheckoutUrl(tab.url));
      return checkoutTab?.id || null;
    }

    async function getCheckoutFrames(tabId) {
      if (!chrome?.webNavigation?.getAllFrames) {
        return [{ frameId: 0, url: '' }];
      }
      const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => null);
      if (!Array.isArray(frames) || !frames.length) {
        return [{ frameId: 0, url: '' }];
      }
      return frames
        .filter((frame) => Number.isInteger(frame?.frameId))
        .sort((left, right) => Number(left.frameId) - Number(right.frameId));
    }

    async function pingCheckoutFrame(tabId, frameId) {
      try {
        const pong = await chrome.tabs.sendMessage(tabId, {
          type: 'PING',
          source: 'background',
          payload: {},
        }, {
          frameId: Number.isInteger(frameId) ? frameId : 0,
        });
        return Boolean(pong?.ok && (!pong.source || pong.source === PLUS_CHECKOUT_SOURCE));
      } catch {
        return false;
      }
    }

    async function ensurePlusCheckoutFrameReady(tabId, frameId) {
      if (await pingCheckoutFrame(tabId, frameId)) {
        return true;
      }
      if (!chrome?.scripting?.executeScript) {
        return false;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          func: (injectedSource) => {
            window.__MULTIPAGE_SOURCE = injectedSource;
          },
          args: [PLUS_CHECKOUT_SOURCE],
        });
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [frameId] },
          files: PLUS_CHECKOUT_INJECT_FILES,
        });
      } catch {
        // If the frame was already injected or navigated mid-injection, ping once more below.
      }

      await sleepWithStop(PLUS_CHECKOUT_FRAME_READY_DELAY_MS);
      return await pingCheckoutFrame(tabId, frameId);
    }

    async function ensurePlusCheckoutFramesReady(tabId, frames) {
      const checkedFrames = [];
      for (const frame of frames) {
        const ready = await ensurePlusCheckoutFrameReady(tabId, frame.frameId);
        checkedFrames.push({ ...frame, ready });
      }
      return checkedFrames;
    }

    async function sendFrameMessage(tabId, frameId, message) {
      return chrome.tabs.sendMessage(tabId, message, {
        frameId: Number.isInteger(frameId) ? frameId : 0,
      });
    }

    async function waitForPaymentRedirectAfterSubmit(tabId, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const paymentConfig = getPaymentMethodConfig(paymentMethod);
      const startedAt = Date.now();
      while (Date.now() - startedAt < PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS) {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
          throw new Error(`Step 7: The checkout tab has been closed. Cannot continue waiting for the ${paymentConfig.label} redirect.`);
        }
        const url = String(tab.url || '');
        if (paymentConfig.redirectPattern.test(url) && !isPlusCheckoutUrl(url)) {
          await waitForTabCompleteUntilStopped(tabId);
          await sleepWithStop(1000);
          return true;
        }
        if (url && !isPlusCheckoutUrl(url)) {
          await addLog(`Step 7: After clicking Subscribe, the page redirected to a non-${paymentConfig.label} recognized URL: ${url}`, 'warn');
          return false;
        }
        await sleepWithStop(500);
      }
      return false;
    }

    async function waitForPayPalRedirectAfterSubmit(tabId) {
      return waitForPaymentRedirectAfterSubmit(tabId, PLUS_PAYMENT_METHOD_PAYPAL);
    }

    async function inspectCheckoutFrame(tabId, frame) {
      try {
        const result = await sendFrameMessage(tabId, frame.frameId, {
          type: 'PLUS_CHECKOUT_GET_STATE',
          source: 'background',
          payload: {},
        });
        if (result?.error) {
          return { frame, error: result.error };
        }
        return { frame: { ...frame, ready: true }, result: result || {} };
      } catch (error) {
        const readyError = frame.ready === false ? 'content-script-not-ready' : '';
        const message = error?.message || String(error || '');
        return { frame, error: readyError ? `${readyError}: ${message}` : message };
      }
    }

    function isPaymentFrameUrl(url = '') {
      return /elements-inner-payment|componentName=payment/i.test(String(url || ''));
    }

    function isAddressFrameUrl(url = '') {
      return /elements-inner-address|componentName=address/i.test(String(url || ''));
    }

    function isAutocompleteFrameUrl(url = '') {
      return /elements-inner-autocompl/i.test(String(url || ''));
    }

    function buildFrameSummary(inspections) {
      return inspections
        .map((item) => {
          const flags = [];
          if (item.result?.hasPayPal) flags.push('paypal');
          if (item.result?.hasGoPay) flags.push('gopay');
          if (item.result?.billingFieldsVisible) flags.push('billing');
          if (item.result?.hasSubscribeButton) flags.push('subscribe');
          if (!flags.length && item.error) flags.push(item.error);
          if (!flags.length) flags.push('no-match');
          return `${item.frame.frameId}:${item.frame.url || 'about:blank'}:${flags.join(',')}`;
        })
        .slice(0, 8)
        .join(' | ');
    }

    async function inspectCheckoutFrames(tabId, frames) {
      const inspections = [];
      for (const frame of frames) {
        const inspection = await inspectCheckoutFrame(tabId, frame);
        inspections.push(inspection);
      }
      return inspections;
    }

    function pickPaymentFrame(inspections, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const normalizedPaymentMethod = normalizePlusPaymentMethod(paymentMethod);
      if (normalizedPaymentMethod === PLUS_PAYMENT_METHOD_GOPAY) {
        return inspections.find((item) => item.result?.hasGoPay || item.result?.gopayCandidates?.length)
          || inspections.find((item) => isPaymentFrameUrl(item.frame.url))
          || null;
      }
      return inspections.find((item) => item.result?.hasPayPal || item.result?.paypalCandidates?.length)
        || inspections.find((item) => isPaymentFrameUrl(item.frame.url))
        || null;
    }

    function pickBillingFrame(inspections) {
      return inspections.find((item) => item.result?.billingFieldsVisible)
        || inspections.find((item) => isAddressFrameUrl(item.frame.url))
        || null;
    }

    function pickSubscribeFrame(inspections) {
      return inspections.find((item) => item.result?.hasSubscribeButton)
        || inspections.find((item) => item.frame.frameId === 0)
        || null;
    }

    function findCheckoutAmountInspection(inspections = []) {
      return inspections.find((item) => item.result?.checkoutAmountSummary?.hasTodayDue)
        || null;
    }

    async function inspectCheckoutAmountSummary(tabId) {
      const frames = await getReadyCheckoutFrames(tabId);
      const inspections = await inspectCheckoutFrames(tabId, frames);
      const amountInspection = findCheckoutAmountInspection(inspections);
      return amountInspection?.result?.checkoutAmountSummary || null;
    }

    async function ensureFreeTrialAmount(tabId, state = {}, options = {}) {
      const phaseLabel = String(options.phaseLabel || '').trim() || 'Before submission';
      const amountSummary = await inspectCheckoutAmountSummary(tabId);
      if (!amountSummary?.hasTodayDue) {
        await addLog(`Step 7: ${phaseLabel} could not identify checkout's "today due" amount; continuing to avoid a false positive.`, 'warn');
        return;
      }

      if (amountSummary.isZero) {
        await addLog(`Step 7: ${phaseLabel} confirmed today's due amount is ${amountSummary.rawAmount || '0'}; continuing.`, 'ok');
        return;
      }

      const amountLabel = amountSummary.rawAmount || (
        Number.isFinite(Number(amountSummary.amount)) ? String(amountSummary.amount) : 'unknown amount'
      );
      await addLog(`Step 7: ${phaseLabel} detected that today's due amount is not 0 (${amountLabel}), which means the current account is not eligible for a free trial; skipping payment submission.`, 'warn');
      if (typeof markCurrentRegistrationAccountUsed === 'function') {
        await markCurrentRegistrationAccountUsed(state, {
          reason: 'plus-checkout-non-free-trial',
          logPrefix: 'Plus Checkout: current account is not eligible for a free trial',
        });
      }
      throw new Error(`PLUS_CHECKOUT_NON_FREE_TRIAL::Step 7: today's due amount is not 0 (${amountLabel}); the current account is not eligible for a free trial, so payment submission has been skipped.`);
    }

    async function getReadyCheckoutFrames(tabId) {
      return ensurePlusCheckoutFramesReady(tabId, await getCheckoutFrames(tabId));
    }

    async function resolveOptionalFrameByUrl(tabId, predicate) {
      const frames = await getCheckoutFrames(tabId);
      const frame = frames.find((item) => predicate(item.url));
      if (!frame) {
        return null;
      }
      const ready = await ensurePlusCheckoutFrameReady(tabId, frame.frameId);
      return {
        frame,
        ready,
      };
    }

    async function resolvePaymentFrame(tabId, frames, paymentMethod = PLUS_PAYMENT_METHOD_PAYPAL) {
      const inspections = await inspectCheckoutFrames(tabId, frames);
      const picked = pickPaymentFrame(inspections, paymentMethod);
      if (picked) {
        return {
          frameId: picked.frame.frameId,
          frameUrl: picked.frame.url || '',
          ready: picked.frame.ready !== false,
          inspections,
        };
      }

      return {
        frameId: null,
        frameUrl: '',
        inspections,
      };
    }

    async function waitForBillingFrame(tabId) {
      while (true) {
        const frames = await getReadyCheckoutFrames(tabId);
        const inspections = await inspectCheckoutFrames(tabId, frames);
        const picked = pickBillingFrame(inspections);
        if (picked) {
          return {
            frameId: picked.frame.frameId,
            frameUrl: picked.frame.url || '',
            countryText: picked.result?.countryText || '',
            ready: picked.frame.ready !== false,
            inspections,
          };
        }
        await sleepWithStop(250);
      }
    }

    async function waitForSubscribeFrame(tabId, candidateFrames) {
      const frames = candidateFrames.length ? candidateFrames : [{ frameId: 0, url: '' }];
      while (true) {
        const readyFrames = await ensurePlusCheckoutFramesReady(tabId, frames);
        const inspections = await inspectCheckoutFrames(tabId, readyFrames);
        const picked = pickSubscribeFrame(inspections);
        if (picked) {
          return picked.frame;
        }
        await sleepWithStop(250);
      }
    }

    async function getCheckoutTabId(state = {}) {
      const registeredTabId = await getTabId(PLUS_CHECKOUT_SOURCE);
      if (registeredTabId && await isTabAlive(PLUS_CHECKOUT_SOURCE)) {
        const aliveRegisteredTabId = await getAlivePlusCheckoutTabId(registeredTabId);
        if (aliveRegisteredTabId) {
          return aliveRegisteredTabId;
        }
      }
      const storedTabId = Number(state.plusCheckoutTabId) || 0;
      if (storedTabId) {
        const aliveStoredTabId = await getAlivePlusCheckoutTabId(storedTabId);
        if (aliveStoredTabId) {
          return aliveStoredTabId;
        }
      }
      const currentCheckoutTabId = await getCurrentPlusCheckoutTabId();
      if (currentCheckoutTabId) {
        await addLog('Step 7: Detected that we are already on the Plus Checkout page and are taking over the current tab.', 'info');
        return currentCheckoutTabId;
      }
      throw new Error('Step 7: Plus Checkout tab not found. Open the Plus Checkout page first, or complete Step 6.');
    }

    async function executePlusCheckoutBilling(state = {}) {
      if (isGpcHelperCheckout(state)) {
        await executeGpcHelperBilling(state);
        return;
      }
      const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
      const paymentConfig = getPaymentMethodConfig(paymentMethod);
      const tabId = await getCheckoutTabId(state);
      await addLog('Step 7: Waiting for the Plus Checkout page to finish loading...', 'info');
      await waitForTabCompleteUntilStopped(tabId);
      await sleepWithStop(1000);

      await ensureContentScriptReadyOnTabUntilStopped(PLUS_CHECKOUT_SOURCE, tabId, {
        inject: PLUS_CHECKOUT_INJECT_FILES,
        injectSource: PLUS_CHECKOUT_SOURCE,
        logMessage: 'Step 7: Checkout page is still loading; waiting for the billing-fill script to be ready...',
      });
      const readyFrames = await getReadyCheckoutFrames(tabId);
      await ensureFreeTrialAmount(tabId, state, {
        phaseLabel: 'After checkout page load',
      });
      const paymentFrame = await resolvePaymentFrame(tabId, readyFrames, paymentMethod);
      if (paymentFrame.frameId === null) {
        const frameSummary = buildFrameSummary(paymentFrame.inspections);
        throw new Error(`Step 7: Could not find ${paymentConfig.label} DOM in the main page or any iframe; cannot switch payment method automatically. Frame summary: ${frameSummary}`);
      }
      if (!paymentFrame.ready) {
        throw new Error(`Step 7: Located the iframe containing ${paymentConfig.label} (frameId=${paymentFrame.frameId}), but the billing script cannot be injected into that iframe. Please provide the iframe's console structure or a screenshot.`);
      }

      if (paymentFrame.frameId !== 0) {
        await addLog(`Step 7: ${paymentConfig.label} is in the checkout iframe (frameId=${paymentFrame.frameId}); switching to operate inside that frame.`, 'info');
      }

      const randomName = generateRandomName();
      const fullName = [randomName.firstName, randomName.lastName].filter(Boolean).join(' ');

      await addLog(`Step 7: Switching the ${paymentConfig.label} payment method...`, 'info');
      const paymentResult = await sendFrameMessage(tabId, paymentFrame.frameId, {
        type: paymentConfig.selectMessageType,
        source: 'background',
        payload: { paymentMethod },
      });
      if (paymentResult?.error) {
        throw new Error(paymentResult.error);
      }

      const billingFrame = await waitForBillingFrame(tabId);
      if (!billingFrame.ready) {
        throw new Error(`Step 7: Located the billing-address iframe (frameId=${billingFrame.frameId}), but the billing script cannot be injected into that iframe. Please provide the iframe's console structure or a screenshot.`);
      }
      if (billingFrame.frameId !== paymentFrame.frameId) {
        await addLog(`Step 7: The billing address is in the checkout iframe (frameId=${billingFrame.frameId}); switching to fill it inside that frame.`, 'info');
      }

      let billingState = state;
      if (paymentMethod === PLUS_PAYMENT_METHOD_GOPAY && typeof probeIpProxyExit === 'function') {
        const staleExitRegion = normalizeText(
          state?.ipProxyAppliedExitRegion
          || state?.ipProxyExitRegion
          || ''
        );
        try {
          await addLog('Step 7: Preparing to fill the GoPay billing address based on the proxy exit; rechecking the current exit region...', 'info');
          const probeResult = await probeIpProxyExit({
            state,
            timeoutMs: 12000,
            authRebindRetry: true,
            detectWhenDisabled: true,
          });
          const routing = probeResult?.proxyRouting || {};
          const probedExitRegion = normalizeText(routing.exitRegion || '');
          const probedExitIp = normalizeText(routing.exitIp || '');
          const probedExitSource = normalizeText(routing.exitSource || '');
          const probeEndpoint = normalizeText(routing.endpoint || routing.exitEndpoint || '');
          const probeReason = normalizeText(routing.reason || '');
          const probeError = normalizeText(routing.exitError || routing.error || '');
          if (probedExitRegion) {
            billingState = {
              ...(state || {}),
              ipProxyAppliedExitRegion: probedExitRegion,
              ipProxyExitRegion: probedExitRegion,
              ipProxyAppliedExitIp: probedExitIp,
              ipProxyAppliedExitSource: probedExitSource,
            };
            const sourceSuffix = probedExitSource ? `, source ${probedExitSource}` : '';
            const endpointSuffix = probeEndpoint ? `, endpoint ${probeEndpoint}` : '';
            await addLog(`Step 7: Current proxy exit recheck result: ${probedExitRegion}${probedExitIp ? ` / ${probedExitIp}` : ''}${sourceSuffix}${endpointSuffix}.`, 'info');
          } else {
            billingState = {
              ...(state || {}),
              ipProxyAppliedExitRegion: '',
              ipProxyExitRegion: '',
              ipProxyAppliedExitIp: probedExitIp,
              ipProxyAppliedExitSource: probedExitSource,
            };
            await addLog(
              `Step 7: The proxy exit recheck did not return a country/region code; the old exit region${staleExitRegion ? ` ${staleExitRegion}` : ''} has been cleared and will not be reused.${probeReason ? ` Status: ${probeReason}.` : ''}${probeError ? ` Diagnosis: ${probeError}` : ''}`,
              'warn'
            );
          }
        } catch (error) {
          billingState = {
            ...(state || {}),
            ipProxyAppliedExitRegion: '',
            ipProxyExitRegion: '',
          };
          await addLog(`Step 7: Proxy exit recheck failed; the old exit region${staleExitRegion ? ` ${staleExitRegion}` : ''} has been cleared and will not be reused: ${error?.message || String(error || 'unknown error')}`, 'warn');
        }
      }
      if (paymentMethod === PLUS_PAYMENT_METHOD_GOPAY
        && typeof probeIpProxyExit === 'function'
        && !resolveMeiguodizhiCountryCode(billingState?.ipProxyAppliedExitRegion || billingState?.ipProxyExitRegion || '')) {
        throw new Error('Step 7: The GoPay billing address requires the current proxy exit country/region, but this recheck did not return a country code. Filling has been stopped to avoid reusing the old KR/ID region. Please click IP Proxy "Detect Exit", confirm that JP is shown, and then continue.');
      }
      const addressSeed = await resolveBillingAddressSeed(billingState, billingFrame.countryText, { paymentMethod });
      if (!addressSeed) {
        throw new Error('Step 7: No usable local billing address seed found.');
      }

      await addLog(`Step 7: Filling the billing address (${addressSeed.countryCode} / ${addressSeed.query})...`, 'info');
      const autocompleteFrame = await resolveOptionalFrameByUrl(tabId, isAutocompleteFrameUrl);
      let result = null;
      if (!addressSeed.skipAutocomplete && autocompleteFrame?.frame && autocompleteFrame.frame.frameId !== billingFrame.frameId) {
        if (!autocompleteFrame.ready) {
          throw new Error('Step 7: Found the Google address suggestions iframe, but cannot inject the billing script. Please provide the iframe console structure.');
        }
        await addLog(`Step 7: Google address suggestions are in a separate iframe (frameId=${autocompleteFrame.frame.frameId}); splitting input and selection actions.`, 'info');

        const queryResult = await sendFrameMessage(tabId, billingFrame.frameId, {
          type: 'PLUS_CHECKOUT_FILL_ADDRESS_QUERY',
          source: 'background',
          payload: {
            fullName,
            addressSeed,
          },
        });
        if (queryResult?.error) {
          throw new Error(queryResult.error);
        }

        const suggestionResult = await sendFrameMessage(tabId, autocompleteFrame.frame.frameId, {
          type: 'PLUS_CHECKOUT_SELECT_ADDRESS_SUGGESTION',
          source: 'background',
          payload: {
            addressSeed,
          },
        });
        const suggestionError = suggestionResult?.error || '';
        if (suggestionError) {
          await addLog(`Step 7: Google address suggestions are unavailable; falling back to local address fields: ${suggestionError}`, 'warn');
        }

        const structuredResult = await sendFrameMessage(tabId, billingFrame.frameId, {
          type: 'PLUS_CHECKOUT_ENSURE_BILLING_ADDRESS',
          source: 'background',
          payload: {
            addressSeed,
            overwriteStructuredAddress: Boolean(suggestionError),
          },
        });
        if (structuredResult?.error) {
          throw new Error(structuredResult.error);
        }

        result = {
          ...structuredResult,
          selectedAddressText: suggestionError ? '' : (suggestionResult?.selectedAddressText || ''),
        };
      } else {
        result = await sendFrameMessage(tabId, billingFrame.frameId, {
          type: 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS',
          source: 'background',
          payload: {
            fullName,
            addressSeed,
          },
        });

        if (result?.error) {
          throw new Error(result.error);
        }
      }

      await setState({
        plusCheckoutTabId: tabId,
        plusBillingCountryText: result?.countryText || '',
        plusBillingAddress: result?.structuredAddress || null,
      });
      await ensureFreeTrialAmount(tabId, state, {
        phaseLabel: 'Before subscription submission',
      });

      let redirectedToPayment = false;
      let lastSubmitError = '';
      for (let attempt = 1; attempt <= PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS; attempt += 1) {
        await addLog(
          attempt === 1
            ? 'Step 7: Billing address has been filled. Waiting 3 seconds for checkout validation...'
            : `Step 7: Preparing to re-check the Subscribe button, attempt ${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS}...`,
          attempt === 1 ? 'info' : 'warn'
        );
        await sleepWithStop(3000);
        await addLog('Step 7: Locating the Subscribe button...', 'info');
        const subscribeFrame = await waitForSubscribeFrame(tabId, [
          { frameId: 0, url: '' },
          { frameId: paymentFrame.frameId, url: paymentFrame.frameUrl || '' },
          { frameId: billingFrame.frameId, url: billingFrame.frameUrl || '' },
        ]);
        const subscribeResult = await sendFrameMessage(tabId, subscribeFrame.frameId, {
          type: 'PLUS_CHECKOUT_CLICK_SUBSCRIBE',
          source: 'background',
          payload: {
            beforeClickDelayMs: attempt === 1 ? 700 : 1200,
            paymentMethod,
          },
        });
        if (subscribeResult?.error) {
          lastSubmitError = subscribeResult.error;
          await addLog(`Step 7: Subscribe click failed (${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS}): ${lastSubmitError}`, 'warn');
          continue;
        }

        const subscribeClicked = subscribeResult?.clicked !== false;
        const subscribeButtonText = String(subscribeResult?.subscribeButtonText || '').trim();
        const subscribeButtonStatus = String(subscribeResult?.subscribeButtonStatus || '').trim();
        if (subscribeClicked) {
          await addLog(`Step 7: Clicked the Subscribe button; waiting to redirect to ${paymentConfig.label} (${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS})...`, 'info');
        } else {
          const buttonStateLabel = subscribeButtonText || subscribeButtonStatus || 'unknown';
          await addLog(`Step 7: The Subscribe button is currently "${buttonStateLabel}"; no click this round, waiting to see whether the page redirects to ${paymentConfig.label} (${attempt}/${PLUS_CHECKOUT_SUBMIT_MAX_ATTEMPTS})...`, 'warn');
        }
        redirectedToPayment = await waitForPaymentRedirectAfterSubmit(tabId, paymentMethod);
        if (redirectedToPayment) {
          break;
        }
        lastSubmitError = subscribeClicked
          ? `Did not redirect to ${paymentConfig.label} within ${Math.round(PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS / 1000)} seconds after clicking Subscribe`
          : `The Subscribe button is currently "${subscribeButtonText || subscribeButtonStatus || 'unknown'}"; did not redirect to ${paymentConfig.label} within ${Math.round(PLUS_CHECKOUT_PAYPAL_REDIRECT_TIMEOUT_MS / 1000)} seconds`;
        await addLog(`Step 7: ${lastSubmitError}; rechecking the Subscribe button.`, 'warn');
      }

      if (!redirectedToPayment) {
        throw new Error(`Step 7: After multiple checks, the page still did not redirect to ${paymentConfig.label}. ${lastSubmitError}`);
      }

      await completeNodeFromBackground('plus-checkout-billing', {
        plusBillingCountryText: result?.countryText || '',
      });
    }

    return {
      executePlusCheckoutBilling,
    };
  }

  return {
    createPlusCheckoutBillingExecutor,
  };
});
