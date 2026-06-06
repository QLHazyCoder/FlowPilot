(function attachBackgroundPhoneVerification(root, factory) {
  root.MultiPageBackgroundPhoneVerification = factory();
})(typeof self !== 'undefined' ? self : globalThis, function createBackgroundPhoneVerificationModule() {
  function createPhoneVerificationHelpers(deps = {}) {
    const {
      addLog: rawAddLog = async () => {},
      ensureStep8SignupPageReady,
      fetchImpl = (...args) => fetch(...args),
      generateRandomBirthday,
      generateRandomName,
      getOAuthFlowStepTimeoutMs,
      getState,
      requestStop = null,
      readAuthTabSnapshot = null,
      sendToContentScript,
      sendToContentScriptResilient,
      navigateAuthTabToAddPhone = null,
      setState,
      broadcastDataUpdate = null,
      sleepWithStop,
      throwIfStopped,
      DEFAULT_HERO_SMS_OPERATOR = 'any',
      DEFAULT_HERO_SMS_REUSE_ENABLED = true,
      HERO_SMS_COUNTRY_ID = 52,
      HERO_SMS_COUNTRY_LABEL = 'Thailand',
      HERO_SMS_SERVICE_CODE = 'dr',
      HERO_SMS_SERVICE_LABEL = 'OpenAI',
      DEFAULT_PHONE_CODE_WAIT_SECONDS = 60,
      DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS = 2,
      DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS = 5,
      DEFAULT_PHONE_CODE_POLL_ROUNDS = 4,
    } = deps;

    const PHONE_ACTIVATION_STATE_KEY = 'currentPhoneActivation';
    const PHONE_VERIFICATION_CODE_STATE_KEY = 'currentPhoneVerificationCode';
    const REUSABLE_PHONE_ACTIVATION_STATE_KEY = 'reusablePhoneActivation';
    const REUSABLE_PHONE_ACTIVATION_POOL_STATE_KEY = 'phoneReusableActivationPool';
    const FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY = 'freeReusablePhoneActivation';
    const PREFERRED_PHONE_ACTIVATION_STATE_KEY = 'phonePreferredActivation';
    const PHONE_RUNTIME_COUNTDOWN_ENDS_AT_KEY = 'currentPhoneVerificationCountdownEndsAt';
    const PHONE_RUNTIME_COUNTDOWN_WINDOW_INDEX_KEY = 'currentPhoneVerificationCountdownWindowIndex';
    const PHONE_RUNTIME_COUNTDOWN_WINDOW_TOTAL_KEY = 'currentPhoneVerificationCountdownWindowTotal';
    const PHONE_NO_SUPPLY_FAILURE_STREAK_STATE_KEY = 'phoneNoSupplyFailureStreak';
    const PHONE_CODE_WAIT_SECONDS_MIN = 15;
    const PHONE_CODE_WAIT_SECONDS_MAX = 300;
    const PHONE_CODE_TIMEOUT_WINDOWS_MIN = 1;
    const PHONE_CODE_TIMEOUT_WINDOWS_MAX = 10;
    const PHONE_CODE_POLL_INTERVAL_SECONDS_MIN = 1;
    const PHONE_CODE_POLL_INTERVAL_SECONDS_MAX = 30;
    const PHONE_CODE_POLL_ROUNDS_MIN = 1;
    const PHONE_CODE_POLL_ROUNDS_MAX = 120;
    const DEFAULT_PHONE_POLL_INTERVAL_MS = DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS * 1000;
    const DEFAULT_PHONE_POLL_TIMEOUT_MS = 180000;
    const DEFAULT_PHONE_REQUEST_TIMEOUT_MS = 20000;
    const DEFAULT_PHONE_SUBMIT_ATTEMPTS = 3;
    const DEFAULT_PHONE_NUMBER_MAX_USES = 3;
    const DEFAULT_PHONE_NUMBER_REPLACEMENT_LIMIT = 3;
    const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
    const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
    const HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH = 'price_high';
    const PHONE_SMS_PROVIDER_HERO = 'hero-sms';
    const PHONE_SMS_PROVIDER_5SIM = '5sim';
    const PHONE_SMS_PROVIDER_HERO_SMS = PHONE_SMS_PROVIDER_HERO;
    const PHONE_SMS_PROVIDER_FIVE_SIM = PHONE_SMS_PROVIDER_5SIM;
    const PHONE_SMS_PROVIDER_NEXSMS = 'nexsms';
    const PHONE_SMS_PROVIDER_MADAO = 'madao';
    const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO;
    const DEFAULT_PHONE_SMS_PROVIDER_ORDER = Object.freeze([
      PHONE_SMS_PROVIDER_HERO,
      PHONE_SMS_PROVIDER_5SIM,
      PHONE_SMS_PROVIDER_NEXSMS,
      PHONE_SMS_PROVIDER_MADAO,
    ]);
    const MAX_PHONE_REUSABLE_POOL = 12;
    const PHONE_CODE_TIMEOUT_ERROR_PREFIX = 'PHONE_CODE_TIMEOUT::';
    const PHONE_STALE_SIGNUP_EMAIL_VERIFICATION_ERROR_CODE = 'PHONE_SIGNUP_STALE_EMAIL_VERIFICATION';
    const PHONE_RESTART_STEP7_ERROR_PREFIX = 'PHONE_RESTART_STEP7::';
    const PHONE_RESEND_THROTTLED_ERROR_PREFIX = 'PHONE_RESEND_THROTTLED::';
    const PHONE_RESEND_BANNED_NUMBER_ERROR_PREFIX = 'PHONE_RESEND_BANNED_NUMBER::';
    const PHONE_RESEND_SERVER_ERROR_PREFIX = 'PHONE_RESEND_SERVER_ERROR::';
    const PHONE_ROUTE_405_RECOVERY_FAILED_ERROR_PREFIX = 'PHONE_ROUTE_405_RECOVERY_FAILED::';
    const PHONE_MANUAL_FREE_REUSE_ERROR_PREFIX = 'PHONE_MANUAL_FREE_REUSE::';
    const PHONE_AUTO_FREE_REUSE_PREPARE_ERROR_PREFIX = 'PHONE_AUTO_FREE_REUSE_PREPARE::';
    const FREE_PHONE_REUSE_PREPARE_TIMEOUT_MS = 20000;
    const FREE_PHONE_REUSE_PREPARE_INTERVAL_MS = 2000;
    const FREE_PHONE_REUSE_PREPARE_MAX_ROUNDS = 10;
    const PHONE_SMS_FAILURE_SKIP_THRESHOLD = 2;
    const MAX_ACTIVATION_PRICE_HINTS = 256;
    const HERO_SMS_COUNTRY_BY_PHONE_PREFIX = Object.freeze([
      { prefix: '84', id: 10, iso: 'VN', label: 'Vietnam' },
      { prefix: '66', id: 52, iso: 'TH', label: 'Thailand' },
      { prefix: '62', id: 6, iso: 'ID', label: 'Indonesia' },
      { prefix: '44', id: 16, iso: 'GB', label: 'United Kingdom' },
      { prefix: '81', id: 151, iso: 'JP', label: 'Japan' },
      { prefix: '49', id: 43, iso: 'DE', label: 'Germany' },
      { prefix: '33', id: 73, iso: 'FR', label: 'France' },
      { prefix: '1', id: 187, iso: 'US', label: 'USA' },
    ]);
    const activationPriceHintsByKey = new Map();
    const phoneSmsProviderAdaptersById = new Map();
    let activePhoneVerificationLogStep = null;
    let activePhoneVerificationLogStepKey = null;

    function normalizeLogStep(value) {
      const step = Math.floor(Number(value) || 0);
      return step > 0 ? step : null;
    }

    function getActivePhoneVerificationVisibleStep(fallback = 9) {
      return normalizeLogStep(activePhoneVerificationLogStep) || fallback;
    }

    function normalizePhoneVerificationLogMessage(message) {
      return String(message || '')
        .replace(/^Step\s+9\s+diagnostics\s*:\s*/i, 'diagnostics: ')
        .replace(/^Step\s+9\s*[:：]\s*/i, '')
        .replace(/^步骤\s*9\s*[:：]\s*/, '')
        .replace(/\bstep\s+9\b/gi, 'current step')
        .trim();
    }

    async function addLog(message, level = 'info', options = {}) {
      const normalizedOptions = options && typeof options === 'object' ? { ...options } : {};
      const step = normalizeLogStep(normalizedOptions.step || normalizedOptions.visibleStep)
        || normalizeLogStep(activePhoneVerificationLogStep);
      if (step) {
        normalizedOptions.step = step;
        if (!normalizedOptions.stepKey) {
          normalizedOptions.stepKey = activePhoneVerificationLogStepKey || 'phone-verification';
        }
      }
      delete normalizedOptions.visibleStep;
      return rawAddLog(normalizePhoneVerificationLogMessage(message), level, normalizedOptions);
    }

    async function withPhoneVerificationLogContext(options = {}, action) {
      const previousStep = activePhoneVerificationLogStep;
      const previousStepKey = activePhoneVerificationLogStepKey;
      activePhoneVerificationLogStep = normalizeLogStep(options.step || options.visibleStep) || previousStep;
      activePhoneVerificationLogStepKey = String(options.stepKey || '').trim() || previousStepKey;
      try {
        return await action();
      } finally {
        activePhoneVerificationLogStep = previousStep;
        activePhoneVerificationLogStepKey = previousStepKey;
      }
    }

    function normalizePhoneSmsProvider(value = '') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.PhoneSmsProviderRegistry?.normalizeProviderId) {
        return rootScope.PhoneSmsProviderRegistry.normalizeProviderId(value);
      }
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === PHONE_SMS_PROVIDER_5SIM) {
        return PHONE_SMS_PROVIDER_5SIM;
      }
      if (normalized === 'nexsms') {
        return 'nexsms';
      }
      if (normalized === PHONE_SMS_PROVIDER_MADAO) {
        return PHONE_SMS_PROVIDER_MADAO;
      }
      return PHONE_SMS_PROVIDER_HERO;
    }

    function normalizeUseCount(value) {
      return Math.max(0, Math.floor(Number(value) || 0));
    }

    function normalizeStringList(value = []) {
      const source = Array.isArray(value) ? value : [];
      const seen = new Set();
      const normalized = [];
      source.forEach((entry) => {
        const text = String(entry || '').trim();
        if (!text || seen.has(text)) {
          return;
        }
        seen.add(text);
        normalized.push(text);
      });
      return normalized;
    }

    function buildPhoneSmsCodeKey(message = {}) {
      return [
        message.id ?? message.ID ?? '',
        message.created_at ?? message.date ?? '',
        message.code ?? '',
        message.text ?? '',
        message.message ?? '',
      ].map((part) => String(part || '').trim()).filter(Boolean).join('::');
    }

    function collectPhoneSmsCodeKeys(payload) {
      const smsList = Array.isArray(payload?.sms) ? payload.sms : [];
      return normalizeStringList(smsList.map((message) => buildPhoneSmsCodeKey(message)).filter(Boolean));
    }

    function normalizePhoneDigits(value) {
      return String(value || '').replace(/\D+/g, '');
    }

    function phoneNumbersMatch(left, right) {
      const leftDigits = normalizePhoneDigits(left);
      const rightDigits = normalizePhoneDigits(right);
      return Boolean(
        leftDigits
        && rightDigits
        && (
          leftDigits === rightDigits
          || leftDigits.endsWith(rightDigits)
          || rightDigits.endsWith(leftDigits)
        )
      );
    }

    function normalizeTimestampMs(value) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        if (numeric >= 1000000000000) {
          return Math.floor(numeric);
        }
        if (numeric >= 1000000000) {
          return Math.floor(numeric * 1000);
        }
      }

      const text = String(value || '').trim();
      if (!text) {
        return 0;
      }
      const parsed = Date.parse(text);
      return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
    }

    function normalizePhoneReplacementLimit(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_NUMBER_REPLACEMENT_LIMIT;
      }
      return Math.max(1, Math.min(20, parsed));
    }

    function normalizeHeroSmsPriceLimit(value) {
      if (value === undefined || value === null || String(value).trim() === '') {
        return null;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
      }
      return Math.round(parsed * 10000) / 10000;
    }

    function formatPhonePriceRangeText(minPriceLimit = null, maxPriceLimit = null) {
      const minPrice = normalizeHeroSmsPriceLimit(minPriceLimit);
      const maxPrice = normalizeHeroSmsPriceLimit(maxPriceLimit);
      if (minPrice !== null && maxPrice !== null) {
        return `${minPrice}~${maxPrice}`;
      }
      if (minPrice !== null) {
        return `${minPrice}~`;
      }
      if (maxPrice !== null) {
        return `~${maxPrice}`;
      }
      return 'unbounded';
    }

    function isPhoneNumberUsedError(value) {
      const text = String(value || '').trim();
      if (!text) {
        return false;
      }
      return /phone_max_usage_exceeded|phone_number_in_use|already\s+linked\s+to\s+the\s+maximum\s+number\s+of\s+accounts|phone\s+number\s+is\s+already\s+(?:in\s+use|linked|registered)|phone\s+number\s+has\s+already\s+been\s+used|already\s+associated\s+with\s+another\s+account|not\s+eligible\s+to\s+be\s+used|cannot\s+be\s+used\s+for\s+verification|号码.*(?:已|被).*(?:使用|占用|绑定|注册)|手机号.*(?:已|被).*(?:使用|占用|绑定|注册)|该手机号.*(?:已|被).*(?:使用|占用|绑定|注册)/i.test(text);
    }

    function isPhoneNumberUsedFailureReason(value) {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) {
        return false;
      }
      return normalized === 'phone_number_used'
        || normalized === 'phone_number_in_use'
        || normalized === 'phone_max_usage_exceeded'
        || isPhoneNumberUsedError(normalized);
    }

    function getPhoneReplacementReleaseAction(reason = '') {
      const normalized = String(reason || '').trim().toLowerCase();
      if (normalized === 'code_rejected' || isPhoneNumberUsedFailureReason(normalized)) {
        return 'ban';
      }
      return 'cancel';
    }

    function isPhoneNumberInvalidError(value) {
      const text = String(value || '').trim();
      if (!text) {
        return false;
      }
      return /phone\s+number\s+is\s+not\s+valid|invalid\s+phone\s+number|invalid\s+phone|not\s+a\s+valid\s+phone|号码.*无效|手机号.*无效|电话号码.*无效/i.test(text);
    }

    function isPhoneNumberDeliveryRefusedError(value) {
      const text = String(value || '').trim();
      if (!text) {
        return false;
      }
      return /无法向此电话号码发送验证码|无法向.*(?:电话号码|手机号|号码).*发送(?:验证码|短信)|(?:不能|无法).*发送.*(?:验证码|短信).*(?:电话号码|手机号|号码)|(?:cannot|can't|could\s*not|couldn't|unable\s+to)\s+(?:send|deliver).{0,80}(?:verification\s+code|code|sms|text(?:\s+message)?).{0,80}(?:phone|number)|(?:verification\s+code|sms|text(?:\s+message)?).{0,80}(?:cannot|can't|could\s*not|couldn't|unable\s+to).{0,80}(?:send|deliver)/i.test(text);
    }

    function isWhatsAppPhoneResendResult(value) {
      if (!value) {
        return false;
      }
      const text = typeof value === 'string'
        ? value
        : [
          value.channel,
          value.channelText,
          value.text,
          value.buttonText,
          value.label,
          value.message,
        ].filter(Boolean).join(' ');
      return /whats\s*app/i.test(String(text || ''));
    }

    function isRecoverableAddPhoneSubmitError(value) {
      const text = String(value || '').trim();
      if (!text) {
        return false;
      }
      return (
        isPhoneNumberInvalidError(text)
        || /failed\s+to\s+select\b.*add-phone\s+page|missing\s+the\s+country\s+option|could\s+not\s+determine\s+the\s+dial\s+code|add-phone\s+page\s+is\s+missing\s+the\s+phone\s+number\s+input|add-phone\s+page\s+is\s+missing\s+the\s+submit\s+button/i.test(text)
      );
    }

    function normalizeCountryId(value, fallback = HERO_SMS_COUNTRY_ID) {
      const parsed = Math.floor(Number(value));
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
      const fallbackParsed = Math.floor(Number(fallback));
      if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
        return fallbackParsed;
      }
      return 0;
    }

    function normalizeCountryLabel(value = '', fallback = HERO_SMS_COUNTRY_LABEL) {
      return String(value || '').trim() || fallback;
    }

    function normalizeHeroSmsOperator(value = '', fallback = DEFAULT_HERO_SMS_OPERATOR) {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '');
      if (normalized) {
        return normalized;
      }
      const fallbackNormalized = String(fallback || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '');
      return fallbackNormalized || DEFAULT_HERO_SMS_OPERATOR;
    }

    function inferHeroSmsCountryFromPhoneNumber(phoneNumber = '') {
      const digits = String(phoneNumber || '').replace(/\D+/g, '');
      if (!digits) {
        return null;
      }
      const match = HERO_SMS_COUNTRY_BY_PHONE_PREFIX.find((entry) => digits.startsWith(entry.prefix));
      if (!match) {
        return null;
      }
      return {
        id: normalizeCountryId(match.id, 0),
        iso: String(match.iso || '').trim().toUpperCase(),
        label: normalizeCountryLabel(match.label, `Country #${match.id}`),
      };
    }

    function normalizePhoneCodeWaitSeconds(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_CODE_WAIT_SECONDS;
      }
      return Math.max(PHONE_CODE_WAIT_SECONDS_MIN, Math.min(PHONE_CODE_WAIT_SECONDS_MAX, parsed));
    }

    function normalizePhoneCodeTimeoutWindows(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS;
      }
      return Math.max(PHONE_CODE_TIMEOUT_WINDOWS_MIN, Math.min(PHONE_CODE_TIMEOUT_WINDOWS_MAX, parsed));
    }

    function normalizePhoneCodePollIntervalSeconds(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS;
      }
      return Math.max(PHONE_CODE_POLL_INTERVAL_SECONDS_MIN, Math.min(PHONE_CODE_POLL_INTERVAL_SECONDS_MAX, parsed));
    }

    function normalizePhoneCodePollMaxRounds(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_CODE_POLL_ROUNDS;
      }
      return Math.max(PHONE_CODE_POLL_ROUNDS_MIN, Math.min(PHONE_CODE_POLL_ROUNDS_MAX, parsed));
    }

    function resolvePhoneCodePollMaxRoundsForWindow(waitSeconds, pollIntervalSeconds, configuredMaxRounds) {
      const normalizedWaitSeconds = normalizePhoneCodeWaitSeconds(waitSeconds);
      const normalizedPollIntervalSeconds = normalizePhoneCodePollIntervalSeconds(pollIntervalSeconds);
      const normalizedConfiguredRounds = normalizePhoneCodePollMaxRounds(configuredMaxRounds);
      const roundsNeededForWaitWindow = Math.max(
        PHONE_CODE_POLL_ROUNDS_MIN,
        Math.ceil(normalizedWaitSeconds / normalizedPollIntervalSeconds)
      );
      return Math.max(normalizedConfiguredRounds, roundsNeededForWaitWindow);
    }

    function normalizeHeroSmsReuseEnabled(value) {
      if (value === undefined || value === null) {
        return Boolean(DEFAULT_HERO_SMS_REUSE_ENABLED);
      }
      return Boolean(value);
    }

    function normalizePhoneSmsReuseEnabled(state = {}) {
      if (Object.prototype.hasOwnProperty.call(state, 'phoneSmsReuseEnabled')) {
        return Boolean(state.phoneSmsReuseEnabled);
      }
      return normalizeHeroSmsReuseEnabled(state?.heroSmsReuseEnabled);
    }

    function normalizeFreePhoneReuseEnabled(value) {
      return Boolean(value);
    }

    function normalizeFreePhoneReuseAutoEnabled(state = {}) {
      return normalizeFreePhoneReuseEnabled(state?.freePhoneReuseEnabled)
        && Boolean(state?.freePhoneReuseAutoEnabled);
    }

    function normalizeHeroSmsAcquirePriority(value = '') {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === HERO_SMS_ACQUIRE_PRIORITY_PRICE) {
        return HERO_SMS_ACQUIRE_PRIORITY_PRICE;
      }
      if (normalized === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH) {
        return HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH;
      }
      return HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
    }

    function normalizePhoneSmsProviderOrder(value = [], fallbackOrder = []) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.PhoneSmsProviderRegistry?.normalizeProviderOrder) {
        return rootScope.PhoneSmsProviderRegistry.normalizeProviderOrder(value, fallbackOrder);
      }
      const source = Array.isArray(value)
        ? value
        : String(value || '')
      .split(/[\r\n,]+/)
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      const normalized = [];
      const seen = new Set();

      source.forEach((entry) => {
        const provider = normalizePhoneSmsProvider(entry);
        if (seen.has(provider)) {
          return;
        }
        seen.add(provider);
        normalized.push(provider);
      });

      if (normalized.length) {
        return normalized.slice(0, DEFAULT_PHONE_SMS_PROVIDER_ORDER.length);
      }

      const fallback = Array.isArray(fallbackOrder) ? fallbackOrder : [];
      if (!fallback.length) {
        return [];
      }
      const fallbackNormalized = [];
      fallback.forEach((entry) => {
        const provider = normalizePhoneSmsProvider(entry);
        if (!provider || fallbackNormalized.includes(provider)) {
          return;
        }
        fallbackNormalized.push(provider);
      });

      return fallbackNormalized.slice(0, DEFAULT_PHONE_SMS_PROVIDER_ORDER.length);
    }
    function resolvePhoneProviderOrder(state = {}, preferredProvider = '') {
      const currentProvider = normalizePhoneSmsProvider(
        preferredProvider || state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER
      );
      const hasExplicitOrder = Array.isArray(state?.phoneSmsProviderOrder)
        ? state.phoneSmsProviderOrder.length > 0
        : String(state?.phoneSmsProviderOrder || '').trim().length > 0;
      if (hasExplicitOrder) {
        const explicitOrder = normalizePhoneSmsProviderOrder(
          state?.phoneSmsProviderOrder,
          []
        );
        if (explicitOrder.length) {
          return explicitOrder;
        }
        return [currentProvider];
      }
      const fallbackOrder = normalizePhoneSmsProviderOrder(
        [currentProvider],
        DEFAULT_PHONE_SMS_PROVIDER_ORDER
      );
      if (fallbackOrder[0] === currentProvider) {
        return fallbackOrder;
      }
      const withoutCurrent = fallbackOrder.filter((provider) => provider !== currentProvider);
      return [currentProvider, ...withoutCurrent].slice(0, DEFAULT_PHONE_SMS_PROVIDER_ORDER.length);
    }

    function getActivationProviderId(activation = {}, state = {}) {
      return normalizePhoneSmsProvider(activation?.provider || state?.phoneSmsProvider);
    }

    function scopeStateToActivationProvider(state = {}, activation = {}) {
      const provider = getActivationProviderId(activation, state);
      if (!provider) {
        return state || {};
      }
      return {
        ...(state || {}),
        phoneSmsProvider: provider,
      };
    }

    function getPhoneSmsProviderLabel(providerId) {
      const provider = normalizePhoneSmsProvider(providerId);
      if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
        return '5sim';
      }
      if (provider === PHONE_SMS_PROVIDER_NEXSMS) {
        return 'NexSMS';
      }
      if (provider === PHONE_SMS_PROVIDER_MADAO) {
        return 'MaDao';
      }
      return 'HeroSMS';
    }

    function formatStep9Reason(reason = '') {
      const text = String(reason || '').trim();
      if (!text) {
        return '未知';
      }
      const normalized = text.toLowerCase();
      const reasonMap = {
        returned_to_add_phone_loop: '反复返回添加手机号页',
        phone_number_used: '手机号已被使用',
        sms_not_received: '未收到短信',
        sms_timeout: '短信超时',
        resend_throttled: '重发短信被限流',
        code_rejected: '验证码被拒绝',
        add_phone_rejected: '添加手机号被拒绝',
        activation_not_found: '接码订单不存在或已失效',
        resend_phone_banned: 'OpenAI 无法向该号码发送短信',
        phone_max_usage_exceeded: '手机号达到使用上限',
        resend_server_error: '重发短信后进入服务器错误页',
        whatsapp_resend_channel: '页面重发入口切换为 WhatsApp 通道',
        unknown: '未知',
      };
      if (reasonMap[normalized]) {
        return reasonMap[normalized];
      }
      const timeoutWindowMatch = text.match(/^sms_timeout_after_(\d+)_windows$/i);
      if (timeoutWindowMatch) {
        return `连续 ${timeoutWindowMatch[1]} 轮等待后仍未收到短信`;
      }
      return text;
    }

    function formatPhoneSmsApiFailureReason(reason = '') {
      const text = String(reason || '').trim();
      if (!text) {
        return '未知错误';
      }
      if (/\bBAD_KEY\b|\bWRONG_KEY\b|\bINVALID_KEY\b/i.test(text)) {
        return 'API Key 无效（BAD_KEY）';
      }
      if (/\bNO_BALANCE\b|\bNOT_ENOUGH_BALANCE\b/i.test(text)) {
        return '余额不足';
      }
      if (/\bBANNED\b|\bACCOUNT_BANNED\b/i.test(text)) {
        return '账号已被封禁';
      }
      if (/\bNO_NUMBERS\b/i.test(text)) {
        return '暂无可用号码（NO_NUMBERS）';
      }
      if (/no\s+free\s+phones|numbers?\s+not\s+found|no\s+numbers\s+available|no\s+numbers\s+within|暂无可用号码|均无可用号码|无可用号码/i.test(text)) {
        return '暂无可用号码';
      }
      const wrongMaxPrice = text.match(/\bWRONG_MAX_PRICE(?::|\s+requires\s+)?(\d+(?:\.\d+)?)?\b/i);
      if (wrongMaxPrice) {
        return wrongMaxPrice[1]
          ? `价格上限过低，平台要求至少 ${wrongMaxPrice[1]}（WRONG_MAX_PRICE）`
          : '价格上限不符合平台要求（WRONG_MAX_PRICE）';
      }
      if (/rate\s*limit|too\s+many\s+requests|限流/i.test(text)) {
        return '请求限流';
      }
      if (/unauthorized|forbidden|invalid\s+token|bad\s+key|wrong\s+key/i.test(text)) {
        return 'API Key 无效';
      }
      if (/order\s+not\s+found|activation\s+not\s+found|no\s+such\s+order/i.test(text)) {
        return '订单不存在或已失效';
      }
      if (/timed\s*out|timeout/i.test(text)) {
        return '请求超时';
      }
      if (/failed\s+to\s+fetch|networkerror|load\s+failed/i.test(text)) {
        return '网络请求失败';
      }
      if (/empty\s+response/i.test(text)) {
        return '空响应';
      }
      if (/unknown\s+terminal\s+error/i.test(text)) {
        return '未知终止错误';
      }
      return text;
    }

    function formatHeroSmsActionName(action = '') {
      const normalized = String(action || '').trim().toLowerCase();
      if (normalized === 'getnumber' || normalized === 'getnumberv2') {
        return '获取手机号';
      }
      if (normalized === 'getstatus' || normalized === 'getstatusv2') {
        return '查询短信状态';
      }
      if (normalized === 'setstatus') {
        return '更新订单状态';
      }
      if (normalized === 'getprices' || normalized === 'getpricesextended') {
        return '查询价格';
      }
      return action ? `${action} 请求` : '请求';
    }

    function stripRepeatedHeroSmsFailurePrefix(action, reason = '') {
      const actionText = String(action || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!actionText) {
        return String(reason || '').trim();
      }
      let text = String(reason || '').trim();
      const prefixPattern = new RegExp(`^HeroSMS\\s+${actionText}\\s+failed\\s*:\\s*`, 'i');
      while (prefixPattern.test(text)) {
        text = text.replace(prefixPattern, '').trim();
      }
      return text;
    }

    function formatProviderAcquireFailure(providerId, message = '') {
      const providerLabel = getPhoneSmsProviderLabel(providerId);
      let text = String(message || '').trim();
      if (!text) {
        return '未知错误';
      }
      text = text.replace(/^Step\s+\d+\s*[:：]\s*/i, '').trim();
      const heroFailureMatch = text.match(/^HeroSMS\s+([A-Za-z0-9]+)\s+failed\s*:\s*(.+)$/i);
      if (heroFailureMatch) {
        return `${formatHeroSmsActionName(heroFailureMatch[1])}失败：${formatPhoneSmsApiFailureReason(stripRepeatedHeroSmsFailurePrefix(heroFailureMatch[1], heroFailureMatch[2]))}`;
      }
      if (normalizePhoneSmsProvider(providerId) === PHONE_SMS_PROVIDER_HERO && /^HeroSMS\s+.+失败：/.test(text)) {
        return text.replace(/^HeroSMS\s+/, '').trim();
      }
      if (/countries\s+are\s+empty|未选择国家/i.test(text)) {
        return '未选择国家，请先在接码设置中至少选择 1 个国家';
      }
      if (/failed\s+to\s+acquire\s+(?:a\s+)?phone(?:\s+number|\s+activation)?/i.test(text)) {
        return '获取手机号失败';
      }
      if (/no\s+numbers\s+available\s+across|no\s+free\s+phones|numbers?\s+not\s+found|no\s+numbers\s+within|暂无可用号码|均无可用号码|无可用号码|\bNO_NUMBERS\b/i.test(text)) {
        return formatPhoneSmsApiFailureReason(text);
      }
      if (/buy activation failed|purchase failed|price lookup failed|check activation failed/i.test(text)) {
        return text
          .replace(/^5sim\s+buy activation failed\s*:\s*/i, '购买手机号失败：')
          .replace(/^5sim\s+check activation failed\s*:\s*/i, '查询短信状态失败：')
          .replace(/^NexSMS\s+purchase failed\s*:\s*/i, '购买手机号失败：')
          .replace(/^NexSMS\s+price lookup failed\s*:\s*/i, '查询价格失败：');
      }
      if (providerLabel && text.startsWith(`${providerLabel}：`)) {
        return text.slice(providerLabel.length + 1).trim() || text;
      }
      return text;
    }

    function isPhoneSmsReuseEnabled(state = {}) {
      if (isPhoneSignupIdentityState(state)) {
        return false;
      }
      return normalizePhoneSmsReuseEnabled(state);
    }

    function getPhoneSmsProviderAdapterForState(state = {}, providerId = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER)) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (!rootScope.PhoneSmsProviderRegistry?.createProvider) {
        throw new Error('接码平台 registry 未加载。');
      }
      const normalizedProviderId = normalizePhoneSmsProvider(providerId);
      if (phoneSmsProviderAdaptersById.has(normalizedProviderId)) {
        return phoneSmsProviderAdaptersById.get(normalizedProviderId);
      }
      const providerAdapter = rootScope.PhoneSmsProviderRegistry.createProvider(normalizedProviderId, {
        addLog,
        fetchImpl,
        requestTimeoutMs: DEFAULT_PHONE_REQUEST_TIMEOUT_MS,
        setState,
        sleepWithStop,
        throwIfStopped,
      });
      phoneSmsProviderAdaptersById.set(normalizedProviderId, providerAdapter);
      return providerAdapter;
    }

    function getActivationProviderAdapterForState(state = {}, activation = null) {
      return getPhoneSmsProviderAdapterForState(
        state,
        getActivationProviderId(activation || {}, state)
      );
    }

    function readPhoneSmsProviderCapability(provider, capabilityName, fallback = false) {
      if (!provider || !capabilityName) {
        return Boolean(fallback);
      }
      const capabilities = provider.capabilities && typeof provider.capabilities === 'object'
        ? provider.capabilities
        : {};
      if (typeof capabilities[capabilityName] === 'boolean') {
        return capabilities[capabilityName];
      }
      return Boolean(fallback);
    }

    function callPhoneSmsProviderCapability(provider, methodName, args = [], fallbackCapability = '', fallback = false) {
      if (provider && typeof provider[methodName] === 'function') {
        return Boolean(provider[methodName](...args));
      }
      return readPhoneSmsProviderCapability(provider, fallbackCapability, fallback);
    }

    function getPhoneSmsProviderAdapterForActivation(state = {}, activation = null) {
      const scopedState = scopeStateToActivationProvider(state, activation || {});
      return getActivationProviderAdapterForState(scopedState, activation);
    }

    function callPhoneSmsProviderMethod(provider, methodName, args = [], fallback = undefined) {
      if (provider && typeof provider[methodName] === 'function') {
        return provider[methodName](...args);
      }
      return fallback;
    }

    function getProviderCountryKey(provider, value) {
      const normalized = callPhoneSmsProviderMethod(provider, 'normalizeCountryKey', [value], null);
      if (normalized !== null && normalized !== undefined) {
        return String(normalized || '').trim();
      }
      const countryId = normalizeCountryId(value, 0);
      return countryId > 0 ? String(countryId) : '';
    }

    function getProviderActivationCountryKey(state = {}, activation = null) {
      const provider = getPhoneSmsProviderAdapterForActivation(state, activation || {});
      const providerKey = callPhoneSmsProviderMethod(provider, 'getActivationCountryKey', [activation], null);
      if (providerKey !== null && providerKey !== undefined) {
        return String(providerKey || '').trim();
      }
      return getProviderCountryKey(provider, activation?.countryId ?? activation?.country);
    }

    function getProviderCountryLabel(state = {}, providerId = DEFAULT_PHONE_SMS_PROVIDER, countryId = '') {
      const scopedState = scopeStateToActivationProvider(state, { provider: providerId });
      const provider = getPhoneSmsProviderAdapterForState(scopedState, providerId);
      const label = callPhoneSmsProviderMethod(provider, 'resolveCountryLabel', [scopedState, countryId], '');
      return String(label || countryId || 'Unknown country').trim() || 'Unknown country';
    }

    function getProviderActivationPrice(state = {}, activation = null) {
      const provider = getPhoneSmsProviderAdapterForActivation(state, activation || {});
      const providerPrice = callPhoneSmsProviderMethod(provider, 'getActivationPrice', [activation], null);
      const normalizedProviderPrice = normalizeHeroSmsPrice(providerPrice);
      if (normalizedProviderPrice !== null && normalizedProviderPrice > 0) {
        return normalizedProviderPrice;
      }
      return normalizeHeroSmsPrice(
        activation?.price
        ?? activation?.maxPrice
        ?? activation?.selectedPrice
        ?? activation?.madaoPrice
      );
    }

    function normalizeCountryFallbackList(value = []) {
      const source = Array.isArray(value)
        ? value
        : String(value || '')
          .split(/[\r\n,，;；]+/)
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      const seen = new Set();
      const normalized = [];

      for (const entry of source) {
        let id = 0;
        let label = '';

        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          id = normalizeCountryId(entry.id ?? entry.countryId, 0);
          label = String((entry.label ?? entry.countryLabel) || '').trim();
        } else {
          const text = String(entry || '').trim();
          const structured = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
          if (structured) {
            id = normalizeCountryId(structured[1], 0);
            label = String(structured[2] || '').trim();
          } else {
            id = normalizeCountryId(text, 0);
          }
        }

        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
          continue;
        }
        seen.add(id);
        normalized.push({
          id,
          label: label || `Country #${id}`,
        });
      }

      return normalized;
    }

    function resolveCountryConfig(state = {}) {
      const hasExplicitPrimaryCountry = Object.prototype.hasOwnProperty.call(state || {}, 'heroSmsCountryId');
      const fallbackList = normalizeCountryFallbackList(state.heroSmsCountryFallback);
      const primaryCountryId = normalizeCountryId(state.heroSmsCountryId, 0);
      if (primaryCountryId > 0) {
        return {
          id: primaryCountryId,
          label: normalizeCountryLabel(state.heroSmsCountryLabel, HERO_SMS_COUNTRY_LABEL),
        };
      }
      if (hasExplicitPrimaryCountry) {
        if (fallbackList.length) {
          const firstFallback = fallbackList[0];
          return {
            id: normalizeCountryId(firstFallback.id, 0),
            label: normalizeCountryLabel(firstFallback.label, `Country #${firstFallback.id}`),
          };
        }
        return null;
      }
      return {
        id: normalizeCountryId(HERO_SMS_COUNTRY_ID, HERO_SMS_COUNTRY_ID),
        label: normalizeCountryLabel(state.heroSmsCountryLabel, HERO_SMS_COUNTRY_LABEL),
      };
    }

    function resolveCountryCandidates(state = {}) {
      const primary = resolveCountryConfig(state);
      const fallbackList = normalizeCountryFallbackList(state.heroSmsCountryFallback);
      if (!primary || !Number.isFinite(primary.id) || primary.id <= 0) {
        return fallbackList
          .map((entry) => ({
            id: normalizeCountryId(entry.id, 0),
            label: normalizeCountryLabel(entry.label, `Country #${entry.id}`),
          }))
          .filter((entry) => entry.id > 0);
      }
      const seen = new Set([primary.id]);
      const candidates = [primary];

      fallbackList.forEach((entry) => {
        const nextId = normalizeCountryId(entry.id, 0);
        if (!Number.isFinite(nextId) || nextId <= 0 || seen.has(nextId)) {
          return;
        }
        seen.add(nextId);
        candidates.push({
          id: nextId,
          label: normalizeCountryLabel(entry.label, `Country #${nextId}`),
        });
      });

      return candidates;
    }

    function normalizeActivation(record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
      }
      const rawProvider = String(record.provider || '').trim();
      const provider = normalizePhoneSmsProvider(rawProvider);
      try {
        const adapter = getPhoneSmsProviderAdapterForState({ phoneSmsProvider: provider }, provider);
        const adapterActivation = callPhoneSmsProviderMethod(adapter, 'normalizeActivation', [record], null);
        if (adapterActivation) {
          const expiresAt = normalizeTimestampMs(record.expiresAt || adapterActivation.expiresAt);
          const ignoredPhoneCodeKeys = normalizeStringList(
            record.ignoredPhoneCodeKeys || adapterActivation.ignoredPhoneCodeKeys
          );
          return {
            ...adapterActivation,
            provider: normalizePhoneSmsProvider(adapterActivation.provider || provider),
            successfulUses: normalizeUseCount(adapterActivation.successfulUses),
            maxUses: Math.max(1, Math.floor(Number(adapterActivation.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES)),
            ...(expiresAt > 0 ? { expiresAt } : {}),
            ...(record.source ? { source: String(record.source || '').trim() } : {}),
            ...(record.phoneCodeReceived || adapterActivation.phoneCodeReceived ? { phoneCodeReceived: true } : {}),
            ...(record.phoneCodeReceivedAt || adapterActivation.phoneCodeReceivedAt
              ? { phoneCodeReceivedAt: Math.max(0, Number(record.phoneCodeReceivedAt || adapterActivation.phoneCodeReceivedAt) || 0) }
              : {}),
            ...(ignoredPhoneCodeKeys.length ? { ignoredPhoneCodeKeys } : {}),
          };
        }
      } catch (_) {
        // Registry is loaded in normal runtime; keep the small legacy fallback below for isolated tests.
      }
      const activationId = String(
        record.activationId ?? record.id ?? record.activation ?? ''
      ).trim();
      const phoneNumber = String(
        record.phoneNumber ?? record.number ?? record.phone ?? ''
      ).trim();
      if (!activationId || !phoneNumber) {
        return null;
      }
      const statusAction = String(record.statusAction || '').trim();
      const countryLabel = String(record.countryLabel || '').trim();
      const rawCountryId = record.countryId ?? record.country;
      const fallbackCountryId = HERO_SMS_COUNTRY_ID;
      const expiresAt = normalizeTimestampMs(record.expiresAt);
      const serviceCode = String(record.serviceCode || HERO_SMS_SERVICE_CODE).trim();
      const countryId = normalizeCountryId(rawCountryId, fallbackCountryId);
      const ignoredPhoneCodeKeys = normalizeStringList(record.ignoredPhoneCodeKeys);
      return {
        activationId,
        phoneNumber,
        provider,
        serviceCode,
        countryId,
        ...(countryLabel ? { countryLabel } : {}),
        successfulUses: normalizeUseCount(record.successfulUses),
        maxUses: Math.max(1, Math.floor(Number(record.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES)),
        ...(expiresAt > 0 ? { expiresAt } : {}),
        ...(statusAction ? { statusAction } : {}),
        ...(record.source ? { source: String(record.source || '').trim() } : {}),
        ...(record.phoneCodeReceived ? { phoneCodeReceived: true } : {}),
        ...(record.phoneCodeReceivedAt ? { phoneCodeReceivedAt: Math.max(0, Number(record.phoneCodeReceivedAt) || 0) } : {}),
        ...(ignoredPhoneCodeKeys.length ? { ignoredPhoneCodeKeys } : {}),
      };
    }

    function normalizeManualFreeReusablePhoneActivation(record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
      }
      const phoneNumber = String(
        record.phoneNumber ?? record.number ?? record.phone ?? ''
      ).trim();
      if (!phoneNumber) {
        return null;
      }
      const activationId = String(
        record.activationId ?? record.id ?? record.activation ?? ''
      ).trim();
      const inferredCountry = inferHeroSmsCountryFromPhoneNumber(phoneNumber);
      const countryId = normalizeCountryId(record.countryId, inferredCountry?.id || HERO_SMS_COUNTRY_ID);
      const countryLabel = String(
        record.countryLabel
        || (inferredCountry && inferredCountry.id === countryId ? inferredCountry.label : '')
      ).trim();
      const statusAction = String(record.statusAction || '').trim();
      return {
        ...(activationId ? { activationId } : {}),
        phoneNumber,
        provider: PHONE_SMS_PROVIDER_HERO,
        serviceCode: String(record.serviceCode || HERO_SMS_SERVICE_CODE).trim() || HERO_SMS_SERVICE_CODE,
        countryId,
        ...(countryLabel ? { countryLabel } : {}),
        successfulUses: normalizeUseCount(record.successfulUses),
        maxUses: Math.max(1, Math.floor(Number(record.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES)),
        ...(statusAction ? { statusAction } : {}),
        source: 'free-manual-reuse',
        recordedAt: Math.max(0, Number(record.recordedAt) || Date.now()),
        manualOnly: !activationId,
      };
    }

    function normalizeFreeReusablePhoneActivation(record) {
      const normalized = normalizeActivation(record) || normalizeManualFreeReusablePhoneActivation(record);
      if (!normalized) {
        return null;
      }
      const recordedAt = Math.max(0, Number(record?.recordedAt) || 0);
      const reusableActivation = {
        ...normalized,
        provider: normalized.provider,
        source: 'free-manual-reuse',
        ...(recordedAt ? { recordedAt } : {}),
      };
      delete reusableActivation.phoneCodeReceived;
      delete reusableActivation.phoneCodeReceivedAt;
      delete reusableActivation.ignoredPhoneCodeKeys;
      return reusableActivation;
    }

    function markActivationPhoneCodeReceived(activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return null;
      }
      return {
        ...normalizedActivation,
        phoneCodeReceived: true,
        phoneCodeReceivedAt: normalizedActivation.phoneCodeReceivedAt || Date.now(),
      };
    }

    function normalizeActivationPool(value = []) {
      const source = Array.isArray(value) ? value : [];
      const normalized = [];
      const seen = new Set();
      source.forEach((entry) => {
        const activation = normalizeActivation(entry);
        if (!activation) {
          return;
        }
        const key = buildActivationIdentityKey(activation);
        if (!key || seen.has(key)) {
          return;
        }
        seen.add(key);
        normalized.push(activation);
      });
      return normalized.slice(0, MAX_PHONE_REUSABLE_POOL);
    }

    function buildActivationIdentityKey(activation) {
      const normalized = normalizeActivation(activation);
      if (!normalized) {
        return '';
      }
      return [
        normalizePhoneSmsProvider(normalized.provider || ''),
        String(normalized.activationId || '').trim(),
        String(normalized.phoneNumber || '').trim(),
      ].join('::');
    }

    function isSameActivation(left, right) {
      const leftKey = buildActivationIdentityKey(left);
      const rightKey = buildActivationIdentityKey(right);
      return Boolean(leftKey && rightKey && leftKey === rightKey);
    }

    function rememberActivationAcquiredPrice(activation, price) {
      const key = buildActivationIdentityKey(activation);
      const normalizedPrice = normalizeHeroSmsPrice(price);
      if (!key || normalizedPrice === null || normalizedPrice <= 0) {
        return;
      }
      const roundedPrice = Math.round(normalizedPrice * 10000) / 10000;
      activationPriceHintsByKey.set(key, roundedPrice);
      while (activationPriceHintsByKey.size > MAX_ACTIVATION_PRICE_HINTS) {
        const oldest = activationPriceHintsByKey.keys().next();
        if (oldest?.done) {
          break;
        }
        activationPriceHintsByKey.delete(oldest.value);
      }
    }

    function getActivationAcquiredPriceHint(activation) {
      const key = buildActivationIdentityKey(activation);
      if (!key) {
        return null;
      }
      const raw = activationPriceHintsByKey.get(key);
      const normalizedPrice = normalizeHeroSmsPrice(raw);
      return normalizedPrice === null || normalizedPrice <= 0
        ? null
        : Math.round(normalizedPrice * 10000) / 10000;
    }

    function forgetActivationAcquiredPriceHint(activation) {
      const key = buildActivationIdentityKey(activation);
      if (!key) {
        return;
      }
      activationPriceHintsByKey.delete(key);
    }

    async function setPhoneRuntimeState(updates = {}) {
      await setState(updates);
      if (typeof broadcastDataUpdate === 'function') {
        broadcastDataUpdate(updates);
      }
    }

    async function persistFreeReusableActivation(activation) {
      await setPhoneRuntimeState({
        [FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]: normalizeFreeReusablePhoneActivation(activation),
      });
    }

    async function clearFreeReusableActivation() {
      await setPhoneRuntimeState({
        [FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]: null,
      });
    }

    function buildPhoneCodeTimeoutError(lastResponse = '') {
      const suffix = lastResponse ? ` HeroSMS 最后状态：${lastResponse}` : '';
      return new Error(`${PHONE_CODE_TIMEOUT_ERROR_PREFIX}等待手机验证码超时。${suffix}`);
    }

    function isSignupEmailVerificationPageState(pageState = {}) {
      const url = String(pageState?.url || pageState?.href || '').trim();
      return Boolean(
        pageState?.emailVerificationPage
        || pageState?.emailVerificationRequired
        || /\/email-verification(?:[/?#]|$)/i.test(url)
      );
    }

    function buildSignupPhoneStaleEmailVerificationError(pageState = {}) {
      const url = String(pageState?.url || pageState?.href || '').trim();
      const message = `步骤 4：OpenAI 在手机短信验证码提交前已切到邮箱验证${url ? `（URL: ${url}）` : ''}。这通常表示当前手机号已关联现有账号或登录路径，请更换手机号后重新开始注册。`;
      const error = new Error(message);
      error.code = PHONE_STALE_SIGNUP_EMAIL_VERIFICATION_ERROR_CODE;
      error.stalePhoneSignupEmailVerification = true;
      if (url) {
        error.url = url;
      }
      error.pageState = pageState;
      return error;
    }

    function isPhoneCodeTimeoutError(error) {
      return String(error?.message || '').startsWith(PHONE_CODE_TIMEOUT_ERROR_PREFIX);
    }

    function isStaleSignupPhoneEmailVerificationError(error) {
      return Boolean(
        error?.stalePhoneSignupEmailVerification
        || error?.code === PHONE_STALE_SIGNUP_EMAIL_VERIFICATION_ERROR_CODE
      );
    }

    function isPhoneResendThrottledError(error) {
      const message = String(error?.message || error || '').trim();
      if (!message) {
        return false;
      }
      if (message.startsWith(PHONE_RESEND_THROTTLED_ERROR_PREFIX)) {
        return true;
      }
      return /tried\s+to\s+resend\s+too\s+many\s+times|please\s+try\s+again\s+later|too\s+many\s+resend|resend\s+too\s+many|发送.*过于频繁|稍后再试/i.test(message);
    }

    function isPhoneResendBannedNumberError(error) {
      const message = String(error?.message || error || '').trim();
      if (!message) {
        return false;
      }
      if (message.startsWith(PHONE_RESEND_BANNED_NUMBER_ERROR_PREFIX)) {
        return true;
      }
      return /无法向此电话号码发送短信|无法向此手机号发送短信|无法发送短信到此电话号码|无法发送短信到此手机号|can(?:not|'t)\s+send\s+(?:an?\s+)?(?:sms|text(?:\s+message)?)\s+to\s+(?:this|that)\s+(?:phone\s+)?number|unable\s+to\s+send\s+(?:an?\s+)?(?:sms|text(?:\s+message)?)\s+to\s+(?:this|that)\s+(?:phone\s+)?number/i.test(message);
    }

    function isPhoneResendServerError(error) {
      const message = String(error?.message || error || '').trim();
      if (!message) {
        return false;
      }
      if (message.startsWith(PHONE_RESEND_SERVER_ERROR_PREFIX)) {
        return true;
      }
      return /this\s+page\s+isn['’]?t\s+working|currently\s+unable\s+to\s+handle\s+this\s+request|http\s+error\s+500|500\s+internal\s+server\s+error/i.test(message);
    }

    function buildPhoneResendServerError(error) {
      const message = String(error?.message || error || '').trim();
      if (message.startsWith(PHONE_RESEND_SERVER_ERROR_PREFIX)) {
        return new Error(message);
      }
      return new Error(`${PHONE_RESEND_SERVER_ERROR_PREFIX}${message || 'OpenAI contact-verification 页面在重发短信后返回 HTTP ERROR 500。'}`);
    }

    function getPhoneResendServerErrorFromSnapshot(snapshot = {}) {
      const rawUrl = String(snapshot?.url || snapshot?.href || '').trim();
      if (!/\/contact-verification(?:[/?#]|$)/i.test(rawUrl)) {
        return '';
      }
      const bodyText = [
        snapshot?.text,
        snapshot?.bodyText,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const titleText = String(snapshot?.title || '').replace(/\s+/g, ' ').trim();
      if (!bodyText) {
        return isPhoneResendServerError(titleText) ? (titleText || 'OpenAI contact-verification 页面在重发短信后返回 HTTP ERROR 500。') : '';
      }
      const combined = [
        bodyText,
        titleText,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!isPhoneResendServerError(combined)) {
        return '';
      }
      return combined || 'OpenAI contact-verification 页面在重发短信后返回 HTTP ERROR 500。';
    }

    async function readPhoneResendServerErrorFromAuthTab(tabId) {
      if (typeof readAuthTabSnapshot !== 'function') {
        return '';
      }
      try {
        return getPhoneResendServerErrorFromSnapshot(await readAuthTabSnapshot(tabId));
      } catch (_) {
        return '';
      }
    }

    async function throwPhoneResendServerErrorIfAuthTabShowsIt(tabId) {
      const serverErrorText = await readPhoneResendServerErrorFromAuthTab(tabId);
      if (serverErrorText) {
        throw buildPhoneResendServerError(serverErrorText);
      }
    }

    function shouldTreatResendThrottledAsBanned(state = {}) {
      return Boolean(state?.phoneResendThrottledAsBannedEnabled);
    }

    function buildHighRiskResendThrottledError(message = '') {
      return new Error(`${PHONE_RESEND_THROTTLED_ERROR_PREFIX}${message || 'OpenAI 重发短信被限流，且当前配置会按高概率封禁手机号处理。'}`);
    }

    function buildPhoneMaxUsageExceededError(message = '') {
      return new Error(`PHONE_MAX_USAGE_EXCEEDED::${message || 'OpenAI 返回 phone_max_usage_exceeded，当前手机号已达到使用上限。'}`);
    }

    function isPhoneMaxUsageExceededFlowError(error) {
      const message = String(error?.message || error || '').trim();
      return message.startsWith('PHONE_MAX_USAGE_EXCEEDED::') || isPhoneNumberUsedError(message);
    }

    function isPhoneRoute405RecoveryError(error) {
      const message = String(error?.message || error || '').trim();
      if (!message) {
        return false;
      }
      if (message.startsWith(PHONE_ROUTE_405_RECOVERY_FAILED_ERROR_PREFIX)) {
        return true;
      }
      return /route\s+error.*405|405\s+method\s+not\s+allowed|post\s+request\s+to\s+["']?\/phone-verification|did\s+not\s+provide\s+an?\s+[`'"]?action/i.test(message);
    }

    function isPhoneActivationOrderMissingError(error, provider = '') {
      const message = String(error?.message || error || '').trim();
      if (!message) {
        return false;
      }
      const normalizedProvider = normalizePhoneSmsProvider(provider);
      if (normalizedProvider === PHONE_SMS_PROVIDER_5SIM) {
        return /5sim\s+check\s+activation\s+failed.*order\s+not\s+found|order\s+not\s+found|activation\s+not\s+found|no\s+such\s+order|订单不存在|订单.*失效/i.test(message);
      }
      return /activation\s+not\s+found|order\s+not\s+found|no\s+such\s+order|订单不存在|订单.*失效/i.test(message);
    }

    function isStopRequestedError(error) {
      const message = String(error?.message || error || '').trim();
      if (!message) {
        return false;
      }
      return message === '流程已被用户停止。'
        || /已被用户停止/.test(message)
        || /flow\s+was\s+stopped|stopped\s+by\s+user/i.test(message);
    }

    function isAuthContentScriptUnreachableError(error) {
      const message = String(error?.message || error || '').trim();
      return /Receiving end does not exist|Could not establish connection|Frame with ID \d+ is showing error page|等待认证页状态检查超时/i.test(message);
    }

    function buildPhoneRestartStep7Error(phoneNumber = '') {
      const suffix = phoneNumber ? ` 当前号码：${phoneNumber}。` : '';
      return new Error(
        `${PHONE_RESTART_STEP7_ERROR_PREFIX}手机验证重发后仍未收到短信，请从步骤 7 重新获取新号码。${suffix}`
      );
    }

    function buildPhoneReplacementLimitError(maxNumberReplacementAttempts, reason = '') {
      const safeMax = Math.max(0, Math.floor(Number(maxNumberReplacementAttempts) || 0));
      const safeReason = String(reason || 'unknown').trim() || 'unknown';
      return new Error(
        `步骤 9：更换 ${safeMax} 次号码后手机号验证仍未成功。最后原因：${formatStep9Reason(safeReason)}。`
      );
    }

    function sanitizePhoneCodeTimeoutError(error) {
      const message = String(error?.message || '');
      if (!message.startsWith(PHONE_CODE_TIMEOUT_ERROR_PREFIX)) {
        return error;
      }
      return new Error(message.slice(PHONE_CODE_TIMEOUT_ERROR_PREFIX.length).trim() || '等待手机验证码超时。');
    }

    function sanitizePhoneRestartStep7Error(error) {
      const message = String(error?.message || '');
      if (!message.startsWith(PHONE_RESTART_STEP7_ERROR_PREFIX)) {
        return error;
      }
      return new Error(
        message.slice(PHONE_RESTART_STEP7_ERROR_PREFIX.length).trim()
        || '手机验证重发后仍未收到短信，请从步骤 7 重新获取新号码。'
      );
    }

    const LATEST_PHONE_SETTING_KEYS = Object.freeze([
      'phoneSmsProvider',
      'phoneSmsProviderOrder',
      'phoneSmsReuseEnabled',
      'madaoBaseUrl',
      'madaoHttpSecret',
      'madaoMode',
      'madaoRoutingPlanId',
      'madaoProviderId',
      'madaoCountry',
      'madaoAutoPickCountry',
      'madaoReusePhone',
      'madaoMinPrice',
      'madaoMaxPrice',
      'heroSmsApiKey',
      'heroSmsBaseUrl',
      'heroSmsCountryId',
      'heroSmsCountryLabel',
      'heroSmsCountryFallback',
      'heroSmsAcquirePriority',
      'heroSmsOperator',
      'heroSmsMinPrice',
      'heroSmsMaxPrice',
      'heroSmsPreferredPrice',
      'heroSmsActivationRetryRounds',
      'heroSmsActivationRetryDelayMs',
      'fiveSimApiKey',
      'fiveSimBaseUrl',
      'fiveSimCountryId',
      'fiveSimCountryLabel',
      'fiveSimCountryFallback',
      'fiveSimCountryOrder',
      'fiveSimOperator',
      'fiveSimProduct',
      'fiveSimMinPrice',
      'fiveSimMaxPrice',
      'nexSmsApiKey',
      'nexSmsBaseUrl',
      'nexSmsCountryOrder',
      'nexSmsServiceCode',
      'customUrlSmsPool',
      'customUrlSmsPoolCursor',
      'phoneVerificationReplacementLimit',
      'phoneCodeWaitSeconds',
      'phoneCodeTimeoutWindows',
      'phoneCodePollIntervalSeconds',
      'phoneCodePollMaxRounds',
      'freePhoneReuseEnabled',
      'freePhoneReuseAutoEnabled',
    ]);

    async function mergeLatestPhoneSettingsState(state = {}, options = {}) {
      if (typeof getState !== 'function') {
        return state || {};
      }
      try {
        const latestState = await getState();
        if (!latestState || typeof latestState !== 'object') {
          return state || {};
        }
        const mergedState = {
          ...latestState,
          ...(state || {}),
        };
        const preservePhoneSmsProvider = Boolean(options?.preservePhoneSmsProvider);
        LATEST_PHONE_SETTING_KEYS.forEach((key) => {
          if (preservePhoneSmsProvider && key === 'phoneSmsProvider') {
            return;
          }
          if (Object.prototype.hasOwnProperty.call(latestState, key)) {
            mergedState[key] = latestState[key];
          }
        });
        mergedState.heroSmsOperator = normalizeHeroSmsOperator(
          mergedState.heroSmsOperator,
          DEFAULT_HERO_SMS_OPERATOR
        );
        return mergedState;
      } catch (_) {
        return state || {};
      }
    }

    function normalizeHeroSmsPrice(value) {
      const direct = Number(value);
      if (Number.isFinite(direct) && direct >= 0) {
        return direct;
      }

      const text = String(value ?? '').trim();
      if (!text) {
        return null;
      }

      // HeroSMS occasionally returns formatted price strings such as "$0.1183".
      // Extract the first decimal token so those tiers can still participate in
      // fallback selection and pricing diagnostics.
      const matched = text.match(/-?\d+(?:[.,]\d+)?/);
      if (!matched) {
        return null;
      }
      const normalizedText = String(matched[0] || '').replace(',', '.');
      const parsed = Number(normalizedText);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
      }
      return parsed;
    }

    function isProviderNoSupplyFailureMessage(message = '') {
      const text = String(message || '').trim();
      if (!text) {
        return false;
      }
      return /no\s+numbers\s+available\s+across|no\s+free\s+phones|numbers?\s+not\s+found|no\s+numbers\s+within\s+(?:maxprice|price\s+range)|price\s+range\s+is\s+invalid|step\s*9:\s*(?:5sim|nexsms)\s+countries\s+are\s+empty|暂无可用号码|均无可用号码|无可用号码|价格区间|未选择国家|\bNO_NUMBERS\b/i.test(text);
    }

    function resolveNoSupplyDiagnosticsContext(state = {}, providerOrder = []) {
      const order = Array.isArray(providerOrder) && providerOrder.length
        ? providerOrder
        : resolvePhoneProviderOrder(state, state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      const providerCountryCounts = Object.fromEntries(
        order.map((providerId) => [
          providerId,
          resolveCountryCandidatesForProvider({
            ...state,
            phoneSmsProvider: providerId,
          }, providerId).length,
        ])
      );
      const activeProvider = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      const activeAdapter = getPhoneSmsProviderAdapterForState(state, activeProvider);
      const priceRange = callPhoneSmsProviderMethod(
        activeAdapter,
        'resolvePriceRange',
        [state],
        {
          minPriceLimit: null,
          maxPriceLimit: null,
          invalidRange: false,
        }
      );
      const priceRangeText = callPhoneSmsProviderMethod(
        activeAdapter,
        'formatPriceRangeText',
        [priceRange.minPriceLimit, priceRange.maxPriceLimit],
        formatPhonePriceRangeText(priceRange.minPriceLimit, priceRange.maxPriceLimit)
      );
      const minPrice = priceRange.minPriceLimit;
      const maxPrice = priceRange.maxPriceLimit;
      const acquirePriority = normalizeHeroSmsAcquirePriority(state?.heroSmsAcquirePriority);
      return {
        order,
        providerCountryCounts,
        heroCountryCount: providerCountryCounts[PHONE_SMS_PROVIDER_HERO] || 0,
        fiveSimCountryCount: providerCountryCounts[PHONE_SMS_PROVIDER_5SIM] || 0,
        nexSmsCountryCount: providerCountryCounts.nexsms || 0,
        minPrice,
        maxPrice,
        priceRangeInvalid: priceRange.invalidRange,
        priceRangeText,
        acquirePriority,
      };
    }

    function isPhoneSignupIdentityState(state = {}) {
      const signupMethod = String(state?.resolvedSignupMethod || state?.signupMethod || '').trim().toLowerCase();
      const identifierType = String(state?.accountIdentifierType || '').trim().toLowerCase();
      if (signupMethod === 'phone' || identifierType === 'phone') {
        return true;
      }
      return Boolean(
        normalizeActivation(state?.signupPhoneActivation)
        || normalizeActivation(state?.signupPhoneCompletedActivation)
      );
    }

    function formatNoSupplySuggestion(context = {}) {
      const suggestions = [];
      const minPrice = Number(context?.minPrice);
      const maxPrice = Number(context?.maxPrice);
      const hasMinPrice = Number.isFinite(minPrice) && minPrice > 0;
      const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0;
      if (context?.priceRangeInvalid) {
        suggestions.push('先修正价格区间（最低购买价不能高于价格上限）');
      } else if (hasMinPrice && hasMaxPrice) {
        suggestions.push(`先适当放宽价格区间（当前 ${context.priceRangeText || `${minPrice}~${maxPrice}`}）`);
      } else if (hasMinPrice) {
        suggestions.push(`可适当降低最低购买价（当前 ${context.priceRangeText || `${minPrice}~`}）`);
      } else if (!hasMaxPrice) {
        suggestions.push('先设置价格上限（建议 >= 0.12）');
      } else if (maxPrice < 0.12) {
        suggestions.push('先提高价格上限（当前偏低）');
      }

      if ((context?.heroCountryCount || 0) <= 1) {
        suggestions.push('HeroSMS 增加国家回退');
      }
      if ((context?.fiveSimCountryCount || 0) <= 0) {
        suggestions.push('5sim 至少选择 1 个国家');
      }
      if ((context?.nexSmsCountryCount || 0) <= 0) {
        suggestions.push('NexSMS 至少选择 1 个国家');
      }
      if (String(context?.acquirePriority || '') === HERO_SMS_ACQUIRE_PRIORITY_COUNTRY) {
        suggestions.push('可尝试切到“价格优先”');
      }

      const unique = Array.from(new Set(suggestions));
      if (!unique.length) {
        return '优先提高价格上限，并调整服务商/国家优先级后重试';
      }
      return unique.slice(0, 3).join('；');
    }

    async function resetPhoneNoSupplyFailureStreak(state = {}) {
      const latestState = (typeof getState === 'function')
        ? (await getState().catch(() => state))
        : state;
      const current = Math.max(0, Math.floor(Number(latestState?.[PHONE_NO_SUPPLY_FAILURE_STREAK_STATE_KEY]) || 0));
      if (current > 0) {
        await setPhoneRuntimeState({
          [PHONE_NO_SUPPLY_FAILURE_STREAK_STATE_KEY]: 0,
        });
      }
    }

    async function logNoSupplyDiagnostics(state = {}, providerOrder = [], providerErrors = []) {
      const allNoSupply = Array.isArray(providerErrors)
        && providerErrors.length > 0
        && providerErrors.every((entry) => isProviderNoSupplyFailureMessage(entry));
      if (!allNoSupply) {
        await resetPhoneNoSupplyFailureStreak(state);
        return false;
      }

      const latestState = (typeof getState === 'function')
        ? (await getState().catch(() => state))
        : state;
      const previousStreak = Math.max(
        0,
        Math.floor(Number(latestState?.[PHONE_NO_SUPPLY_FAILURE_STREAK_STATE_KEY]) || 0)
      );
      const nextStreak = previousStreak + 1;
      await setPhoneRuntimeState({
        [PHONE_NO_SUPPLY_FAILURE_STREAK_STATE_KEY]: nextStreak,
      });

      const context = resolveNoSupplyDiagnosticsContext(
        latestState && typeof latestState === 'object' ? latestState : state,
        providerOrder
      );
      const minPriceText = context.minPrice === null ? '未设置' : String(context.minPrice);
      const maxPriceText = context.maxPrice === null ? '未设置' : String(context.maxPrice);
      const priceRangeText = context.priceRangeText || formatPhonePriceRangeText(context.minPrice, context.maxPrice);
      const providerOrderText = context.order.join(' > ');
      const suggestion = formatNoSupplySuggestion(context);
      await addLog(
        `步骤 9 诊断：无号连续失败 ${nextStreak} 次；价格区间=${priceRangeText}；最低价=${minPriceText}；最高价=${maxPriceText}；平台顺序=${providerOrderText}；国家数 HeroSMS=${context.heroCountryCount}, 5sim=${context.fiveSimCountryCount}, NexSMS=${context.nexSmsCountryCount}。建议：${suggestion}。`,
        nextStreak >= 2 ? 'warn' : 'info'
      );
      return true;
    }

    async function requestPhoneActivation(state = {}, options = {}) {
      state = await mergeLatestPhoneSettingsState(state, {
        preservePhoneSmsProvider: Boolean(options?.preservePhoneSmsProvider),
      });
      const provider = getPhoneSmsProviderAdapterForState(state);
      if (!provider || typeof provider.requestActivation !== 'function') {
        throw new Error(`${getPhoneSmsProviderLabel(state?.phoneSmsProvider)} 接码平台模块未加载。`);
      }
      const activation = await provider.requestActivation(state, options);
      const normalizedActivation = normalizeActivation(activation) || activation;
      rememberActivationAcquiredPrice(
        normalizedActivation,
        getProviderActivationPrice(state, activation)
        ?? getProviderActivationPrice(state, normalizedActivation)
      );
      return normalizedActivation;
    }

    async function reactivatePhoneActivation(state = {}, activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        throw new Error('缺少可复用的手机号接码订单。');
      }
      const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
      const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
      if (!provider || typeof provider.reuseActivation !== 'function') {
        throw new Error(`${getPhoneSmsProviderLabel(getActivationProviderId(normalizedActivation, state))} 当前流程不支持复用手机号订单。`);
      }
      return provider.reuseActivation(scopedState, normalizedActivation);
    }

    async function completePhoneActivation(state = {}, activation) {
      if (shouldSkipTerminalStatusForFreeReuse(state, activation)) {
        const normalizedActivation = normalizeActivation(activation);
        const identifier = normalizedActivation?.phoneNumber || normalizedActivation?.activationId || 'current activation';
        await addLog(
          `步骤 9：白嫖复用模式仅请求短信，跳过 ${identifier} 的接码完成状态。`,
          'info'
        );
        return;
      }
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return;
      }
      const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
      const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
      if (typeof provider?.finishActivation !== 'function') {
        throw new Error(`${getPhoneSmsProviderLabel(getActivationProviderId(normalizedActivation, state))} 不支持完成接码订单。`);
      }
      await provider.finishActivation(scopedState, normalizedActivation);
    }

    async function cancelPhoneActivation(state = {}, activation) {
      try {
        const normalizedActivation = normalizeActivation(activation);
        if (shouldSkipTerminalStatusForFreeReuse(state, activation)) {
          const identifier = normalizedActivation?.phoneNumber || normalizedActivation?.activationId || 'current activation';
          await addLog(
            `步骤 9：白嫖复用模式仅请求短信，跳过 ${identifier} 的接码取消状态。`,
            'info'
          );
          return;
        }
        if (!normalizedActivation) {
          return;
        }
        const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
        const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
        if (typeof provider?.cancelActivation === 'function') {
          await provider.cancelActivation(scopedState, normalizedActivation);
        }
      } catch (_) {
        // Best-effort cleanup.
      }
    }

    async function retireFreeReusableActivation(reason = '') {
      const suffix = reason ? ` ${reason}` : '';
      await addLog(`步骤 9：已清除白嫖复用手机号记录。${suffix}`, 'warn');
      await clearFreeReusableActivation();
    }

    async function discardPhoneActivationFromReuse(reason = '', activation = null, state = {}) {
      const rejectedPhoneNumber = String(activation?.phoneNumber || '').trim();
      if (!rejectedPhoneNumber) {
        return;
      }
      const updates = {};
      const currentActivation = normalizeActivation(state[PHONE_ACTIVATION_STATE_KEY]);
      if (phoneNumbersMatch(currentActivation?.phoneNumber, rejectedPhoneNumber)) {
        updates[PHONE_ACTIVATION_STATE_KEY] = null;
        updates[PHONE_VERIFICATION_CODE_STATE_KEY] = '';
      }
      const reusableActivation = normalizeActivation(state[REUSABLE_PHONE_ACTIVATION_STATE_KEY]);
      if (phoneNumbersMatch(reusableActivation?.phoneNumber, rejectedPhoneNumber)) {
        updates[REUSABLE_PHONE_ACTIVATION_STATE_KEY] = null;
      }
      const reusablePool = readReusableActivationPoolFromState(state);
      const nextReusablePool = reusablePool.filter((entry) => (
        !phoneNumbersMatch(entry?.phoneNumber, rejectedPhoneNumber)
      ));
      if (nextReusablePool.length !== reusablePool.length) {
        updates[REUSABLE_PHONE_ACTIVATION_POOL_STATE_KEY] = nextReusablePool;
      }
      const freeReusableActivation = normalizeFreeReusablePhoneActivation(state[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]);
      if (phoneNumbersMatch(freeReusableActivation?.phoneNumber, rejectedPhoneNumber)) {
        updates[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY] = null;
      }
      if (Object.keys(updates).length) {
        await setPhoneRuntimeState(updates);
        await addLog(
          `步骤 9：已从复用记录中移除手机号 ${rejectedPhoneNumber}。${reason || '目标站拒绝该号码。'}`,
          'warn'
        );
      }
    }

    function isFreeAutoReuseActivation(activation) {
      return normalizeActivation(activation)?.source === 'free-auto-reuse';
    }

    function isRetainedReuseActivation(activation) {
      return normalizeActivation(activation)?.source === '5sim-retained-reuse';
    }

    function shouldRetireFreeReusableActivationOnFailure(state, activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return false;
      }
      if (normalizedActivation.phoneCodeReceived) {
        return false;
      }
      if (isFreeAutoReuseActivation(normalizedActivation)) {
        return true;
      }
      const savedFreeActivation = normalizeFreeReusablePhoneActivation(
        state?.[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]
      );
      return Boolean(
        savedFreeActivation
        && (
          isSameActivation(savedFreeActivation, normalizedActivation)
          || phoneNumbersMatch(savedFreeActivation.phoneNumber, normalizedActivation.phoneNumber)
        )
      );
    }

    async function banPhoneActivation(state = {}, activation) {
      try {
        if (shouldSkipTerminalStatusForFreeReuse(state, activation)) {
          const normalizedActivation = normalizeActivation(activation);
          const identifier = normalizedActivation?.phoneNumber || normalizedActivation?.activationId || 'current activation';
          await addLog(
            `步骤 9：白嫖复用模式仅请求短信，跳过 ${identifier} 的接码封禁状态。`,
            'info'
          );
          return;
        }
        const normalizedActivation = normalizeActivation(activation);
        if (!normalizedActivation) {
          return;
        }
        const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
        const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
        if (typeof provider?.banActivation === 'function') {
          await provider.banActivation(scopedState, normalizedActivation);
        }
      } catch (_) {
        // Best-effort cleanup.
      }
    }

    async function requestAdditionalPhoneSms(state = {}, activation) {
      try {
        const normalizedActivation = normalizeActivation(activation);
        if (!normalizedActivation) {
          return;
        }
        const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
        const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
        if (typeof provider?.requestAdditionalSms === 'function') {
          await provider.requestAdditionalSms(scopedState, normalizedActivation);
        }
      } catch (_) {
        // Best-effort request only.
      }
    }

    async function prepareFreeReusablePhoneActivation(state = {}, activation) {
      const normalizedActivation = normalizeFreeReusablePhoneActivation(activation);
      if (!normalizedActivation) {
        return {
          ok: false,
          reason: 'missing_free_reusable_activation',
          message: '免费复用手机号激活记录缺失。',
        };
      }
      if (!String(normalizedActivation.activationId || '').trim()) {
        return {
          ok: false,
          reason: 'missing_activation_id',
          message: '已保存的免费复用手机号缺少激活 ID，无法自动重新激活。',
        };
      }

      const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
      const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
      if (provider && typeof provider.prepareActivationForReuse === 'function') {
        const prepared = await provider.prepareActivationForReuse(
          scopedState,
          normalizedActivation,
          {
            timeoutMs: FREE_PHONE_REUSE_PREPARE_TIMEOUT_MS,
            intervalMs: FREE_PHONE_REUSE_PREPARE_INTERVAL_MS,
            maxRounds: FREE_PHONE_REUSE_PREPARE_MAX_ROUNDS,
          }
        );
        if (prepared?.ok && prepared.activation) {
          return {
            ...prepared,
            activation: {
              ...prepared.activation,
              source: 'free-auto-reuse',
            },
          };
        }
        return prepared;
      }

      return {
        ok: false,
        reason: 'prepare_unsupported',
        message: `${getPhoneSmsProviderLabel(normalizedActivation.provider)} 不支持自动白嫖复用准备。`,
      };
    }

    async function pollPhoneActivationCode(state = {}, activation, options = {}) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        throw new Error('缺少手机号接码订单。');
      }
      const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
      const configuredTimeoutMs = Math.max(1000, Number(options.timeoutMs) || 0);
      const timeoutMs = configuredTimeoutMs || (
        typeof getOAuthFlowStepTimeoutMs === 'function'
          ? await getOAuthFlowStepTimeoutMs(
            DEFAULT_PHONE_POLL_TIMEOUT_MS,
            { step: 9, actionLabel: options.actionLabel || 'poll phone verification code' }
          )
          : DEFAULT_PHONE_POLL_TIMEOUT_MS
      );
      const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
      if (!provider || typeof provider.pollActivationCode !== 'function') {
        throw new Error(`${getPhoneSmsProviderLabel(getActivationProviderId(normalizedActivation, state))} 不支持查询短信验证码。`);
      }
      return provider.pollActivationCode(scopedState, normalizedActivation, {
        ...options,
        timeoutMs,
      });
    }

    async function readPhonePageState(tabId, timeoutMs = 10000) {
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const deadlineMs = Math.max(1, Math.floor(Number(timeoutMs) || 0));
      let timeoutId = null;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`步骤 ${visibleStep}：等待认证页状态检查超时。`));
        }, deadlineMs);
      });
      const readPromise = (async () => {
        await ensureStep8SignupPageReady(tabId, {
          timeoutMs: deadlineMs,
          logMessage: '步骤 9：等待认证页脚本恢复后继续手机号验证。',
          visibleStep,
          logStepKey: 'phone-verification',
        });
        const result = await sendToContentScriptResilient('openai-auth', {
          type: 'STEP8_GET_STATE',
          source: 'background',
          payload: { visibleStep },
        }, {
          timeoutMs: deadlineMs,
          responseTimeoutMs: deadlineMs,
          retryDelayMs: 600,
          logMessage: '步骤 9：认证页正在切换，等待后重新检查手机号验证状态...',
          logStep: visibleStep,
          logStepKey: 'phone-verification',
        });

        if (result?.error) {
          throw new Error(result.error);
        }
        return result || {};
      })();

      try {
        return await Promise.race([readPromise, timeoutPromise]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    function resolveCountryCandidatesForProvider(state = {}, providerId = normalizePhoneSmsProvider(state?.phoneSmsProvider)) {
      const normalizedProviderId = normalizePhoneSmsProvider(providerId);
      try {
        const provider = getPhoneSmsProviderAdapterForState(state, normalizedProviderId);
        if (provider && typeof provider.resolveCountryCandidates === 'function') {
          return provider.resolveCountryCandidates(state);
        }
      } catch (_) {
        // Fall back to local normalization for diagnostics and legacy tests.
      }
      return resolveCountryCandidates(state);
    }

    function resolveCountryConfigFromActivation(activation, fallbackState = {}) {
      const providerId = getActivationProviderId(activation, fallbackState);
      try {
        const scopedState = scopeStateToActivationProvider(fallbackState, { provider: providerId });
        const provider = getPhoneSmsProviderAdapterForState(scopedState, providerId);
        const resolved = callPhoneSmsProviderMethod(provider, 'resolveActivationCountry', [activation, scopedState], null);
        if (resolved && (resolved.id || resolved.label)) {
          return resolved;
        }
      } catch (_) {
        // Fall back below for isolated legacy tests.
      }
      const candidates = resolveCountryCandidatesForProvider(fallbackState, providerId);
      return candidates[0] || resolveCountryConfig(fallbackState);
    }

    async function submitPhoneNumber(tabId, phoneNumber, activation = null) {
      const state = await getState();
      const countryConfig = resolveCountryConfigFromActivation(activation, state);
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(30000, { step: visibleStep, actionLabel: '提交添加手机号' })
        : 30000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'SUBMIT_PHONE_NUMBER',
        source: 'background',
        payload: {
          phoneNumber,
          countryId: countryConfig.id,
          countryLabel: countryConfig.label,
        },
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: '步骤 9：等待添加手机号页面就绪...',
        logStep: visibleStep,
        logStepKey: 'phone-verification',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function submitPhoneVerificationCode(tabId, code) {
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const signupProfile = (
        typeof generateRandomName === 'function'
        && typeof generateRandomBirthday === 'function'
      )
        ? (() => {
          const name = generateRandomName();
          const birthday = generateRandomBirthday();
          if (!name?.firstName || !name?.lastName || !birthday) {
            return null;
          }
          return {
            firstName: name.firstName,
            lastName: name.lastName,
            year: birthday.year,
            month: birthday.month,
            day: birthday.day,
          };
        })()
        : null;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(45000, { step: visibleStep, actionLabel: '提交手机验证码' })
        : 45000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'SUBMIT_PHONE_VERIFICATION_CODE',
        source: 'background',
        payload: {
          code,
          ...(signupProfile ? { signupProfile } : {}),
        },
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: '步骤 9：等待手机验证码页面就绪后填写短信验证码...',
        logStep: visibleStep,
        logStepKey: 'phone-verification',
      });

      if (result?.error) {
        if (isPhoneNumberUsedError(result.error)) {
          return {
            invalidCode: true,
            errorText: String(result.error || ''),
          };
        }
        throw new Error(result.error);
      }
      return result || {};
    }

    async function resendPhoneVerificationCode(tabId, options = {}) {
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(65000, { step: visibleStep, actionLabel: 'resend phone verification code' })
        : 65000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'RESEND_PHONE_VERIFICATION_CODE',
        source: 'background',
        payload: options || {},
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: '步骤 9：等待手机验证码重发按钮出现...',
        logStep: visibleStep,
        logStepKey: 'phone-verification',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function submitSignupPhoneVerificationCode(tabId, code, options = {}) {
      const visibleStep = 4;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(45000, { step: visibleStep, actionLabel: '提交注册手机验证码' })
        : 45000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'SUBMIT_PHONE_VERIFICATION_CODE',
        step: visibleStep,
        source: 'background',
        payload: {
          code,
          purpose: 'signup',
          signupProfile: options.signupProfile || null,
        },
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: '步骤 4：等待注册手机验证码页面就绪后填写短信验证码...',
        logStep: visibleStep,
        logStepKey: 'fetch-signup-code',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function resendSignupPhoneVerificationCode(tabId) {
      const visibleStep = 4;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(65000, { step: visibleStep, actionLabel: '重新发送注册手机验证码' })
        : 65000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'RESEND_VERIFICATION_CODE',
        step: visibleStep,
        source: 'background',
        payload: {},
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: '步骤 4：等待注册手机验证码重发按钮出现...',
        logStep: visibleStep,
        logStepKey: 'fetch-signup-code',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function returnToAddPhone(tabId) {
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(30000, { step: visibleStep, actionLabel: 'return to add-phone page' })
        : 30000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'RETURN_TO_ADD_PHONE',
        source: 'background',
        payload: {},
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: '步骤 9：返回添加手机号页面以更换号码...',
        logStep: visibleStep,
        logStepKey: 'phone-verification',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function checkPhoneResendPageError(tabId, state = {}) {
      if (!usePageProbeForPhoneResend(state)) {
        return {
          hasError: false,
          reason: '',
          message: '',
        };
      }
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      try {
        const result = await sendToContentScriptResilient('openai-auth', {
          type: 'CHECK_PHONE_RESEND_ERROR',
          source: 'background',
          payload: { visibleStep },
        }, {
          timeoutMs: 3000,
          responseTimeoutMs: 3000,
          retryDelayMs: 500,
          logStep: visibleStep,
          logStepKey: 'phone-verification',
        });

        if (result?.error) {
          throw new Error(result.error);
        }
        return result || {};
      } catch (error) {
        if (isStopRequestedError(error)) {
          throw error;
        }
        if (isPhoneResendBannedNumberError(error)) {
          return {
            hasError: true,
            reason: 'resend_phone_banned',
            message: error.message,
          };
        }
        if (isPhoneResendThrottledError(error)) {
          return {
            hasError: true,
            reason: 'resend_throttled',
            message: error.message,
          };
        }
        if (isPhoneResendServerError(error)) {
          return {
            hasError: true,
            reason: 'resend_server_error',
            message: error.message,
          };
        }
        if (isPhoneMaxUsageExceededFlowError(error)) {
          return {
            hasError: true,
            reason: 'phone_max_usage_exceeded',
            message: error.message,
          };
        }
        await addLog(`步骤 9：检查手机重发错误时遇到暂时性问题，已忽略。${error.message}`, 'warn');
        return {
          hasError: false,
          reason: '',
          message: '',
        };
      }
    }

    function usePageProbeForPhoneResend(state = {}) {
      const provider = getPhoneSmsProviderAdapterForState(state);
      return callPhoneSmsProviderCapability(
        provider,
        'shouldProbePageResend',
        [state],
        'supportsPageResendProbe',
        false
      );
    }

    async function persistCurrentActivation(activation) {
      const normalizedActivation = normalizeActivation(activation);
      const updates = {
        [PHONE_ACTIVATION_STATE_KEY]: normalizedActivation || null,
        [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
      };
      if (!normalizedActivation) {
        updates[PHONE_RUNTIME_COUNTDOWN_ENDS_AT_KEY] = 0;
        updates[PHONE_RUNTIME_COUNTDOWN_WINDOW_INDEX_KEY] = 0;
        updates[PHONE_RUNTIME_COUNTDOWN_WINDOW_TOTAL_KEY] = 0;
      }
      await setPhoneRuntimeState(updates);
    }

    async function persistReusableActivation(activation) {
      await setPhoneRuntimeState({
        [REUSABLE_PHONE_ACTIVATION_STATE_KEY]: normalizeActivation(activation) || null,
      });
    }

    function readReusableActivationPoolFromState(state = {}) {
      return normalizeActivationPool(state?.[REUSABLE_PHONE_ACTIVATION_POOL_STATE_KEY]);
    }

    async function persistReusableActivationPool(pool = []) {
      await setPhoneRuntimeState({
        [REUSABLE_PHONE_ACTIVATION_POOL_STATE_KEY]: normalizeActivationPool(pool),
      });
    }

    async function upsertReusableActivationPool(activation, options = {}) {
      const normalized = normalizeActivation(activation);
      if (!normalized) {
        return [];
      }
      const state = options?.state || await getState();
      const existingPool = readReusableActivationPoolFromState(state);
      const filtered = existingPool.filter((entry) => !isSameActivation(entry, normalized));
      const nextPool = [normalized, ...filtered].slice(0, MAX_PHONE_REUSABLE_POOL);
      await persistReusableActivationPool(nextPool);
      return nextPool;
    }

    async function removeReusableActivationFromPool(activation, options = {}) {
      const normalized = normalizeActivation(activation);
      if (!normalized) {
        return [];
      }
      const state = options?.state || await getState();
      const existingPool = readReusableActivationPoolFromState(state);
      const nextPool = existingPool.filter((entry) => !isSameActivation(entry, normalized));
      if (nextPool.length === existingPool.length) {
        return existingPool;
      }
      await persistReusableActivationPool(nextPool);
      return nextPool;
    }

    async function clearCurrentActivation() {
      await persistCurrentActivation(null);
    }

    async function clearReusableActivation() {
      await persistReusableActivation(null);
    }

    async function handoffFreeReusablePhone(tabId, state = {}) {
      if (isPhoneSignupIdentityState(state)) {
        return null;
      }
      if (!normalizeFreePhoneReuseEnabled(state?.freePhoneReuseEnabled)) {
        return null;
      }
      const freeReusableActivation = normalizeFreeReusablePhoneActivation(
        state[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]
      );
      if (!freeReusableActivation) {
        return null;
      }

      if (freeReusableActivation.successfulUses >= freeReusableActivation.maxUses) {
        await retireFreeReusableActivation(
          `保存的手机号 ${freeReusableActivation.phoneNumber} 已达到 ${freeReusableActivation.successfulUses}/${freeReusableActivation.maxUses} 次。`
        );
        return null;
      }

      const canPrepareAutomaticFreeReuse = normalizeFreePhoneReuseAutoEnabled(state)
        && !freeReusableActivation.manualOnly
        && Boolean(String(freeReusableActivation.activationId || '').trim());

      if (canPrepareAutomaticFreeReuse) {
        await addLog(
          `步骤 9：准备自动白嫖复用已保存手机号 ${freeReusableActivation.phoneNumber}（${freeReusableActivation.successfulUses + 1}/${freeReusableActivation.maxUses}）。`,
          'info'
        );
        const prepared = await prepareFreeReusablePhoneActivation(state, freeReusableActivation);
        if (!prepared.ok) {
          const reason = prepared.message || prepared.reason || 'unknown error';
          const stopMessage = `自动白嫖复用准备失败：${freeReusableActivation.phoneNumber} 未确认进入等待短信状态，本次不购买新 HeroSMS 号码。原因：${reason}`;
          await addLog(
            `步骤 9：自动白嫖复用准备失败，停止本次接码且不购买新 HeroSMS 号码。${reason}`,
            'error'
          );
          if (prepared.reason === 'activation_cancelled') {
            await retireFreeReusableActivation(
              `自动白嫖复用号码 ${freeReusableActivation.phoneNumber} 已被 HeroSMS 取消。`
            );
          }
          if (typeof requestStop === 'function') {
            await requestStop({ logMessage: stopMessage });
          }
          throw new Error(`${PHONE_AUTO_FREE_REUSE_PREPARE_ERROR_PREFIX}${stopMessage}`);
        }
        await persistCurrentActivation(prepared.activation);
        return prepared.activation;
      }

      const fillResult = await submitPhoneNumber(tabId, freeReusableActivation.phoneNumber, freeReusableActivation);
      await clearCurrentActivation();
      const message = `开始手动复用手机 ${freeReusableActivation.phoneNumber}，请到 SMS 上刷新。`;
      await addLog(`步骤 9：${message}`, 'warn');
      if (typeof requestStop === 'function') {
        await requestStop({ logMessage: message });
      }
      const handoffError = new Error(`${PHONE_MANUAL_FREE_REUSE_ERROR_PREFIX}${message}`);
      handoffError.result = {
        manualFreePhoneReuse: true,
        phoneNumber: freeReusableActivation.phoneNumber,
        fillResult,
      };
      throw handoffError;
    }

    async function setPhoneRuntimeCountdown(activation, waitSeconds, windowIndex, windowTotal) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return;
      }
      const safeWaitSeconds = Math.max(0, Math.floor(Number(waitSeconds) || 0));
      await setPhoneRuntimeState({
        [PHONE_ACTIVATION_STATE_KEY]: normalizedActivation,
        [PHONE_RUNTIME_COUNTDOWN_ENDS_AT_KEY]: Date.now() + safeWaitSeconds * 1000,
        [PHONE_RUNTIME_COUNTDOWN_WINDOW_INDEX_KEY]: Math.max(0, Math.floor(Number(windowIndex) || 0)),
        [PHONE_RUNTIME_COUNTDOWN_WINDOW_TOTAL_KEY]: Math.max(0, Math.floor(Number(windowTotal) || 0)),
      });
    }

    async function clearPhoneRuntimeCountdown() {
      await setPhoneRuntimeState({
        [PHONE_RUNTIME_COUNTDOWN_ENDS_AT_KEY]: 0,
        [PHONE_RUNTIME_COUNTDOWN_WINDOW_INDEX_KEY]: 0,
        [PHONE_RUNTIME_COUNTDOWN_WINDOW_TOTAL_KEY]: 0,
      });
    }

    async function persistSignupPhoneRuntimeState(updates = {}) {
      await setPhoneRuntimeState({
        signupPhoneNumber: '',
        signupPhoneActivation: null,
        signupPhoneVerificationRequestedAt: null,
        signupPhoneVerificationPurpose: '',
        accountIdentifierType: null,
        accountIdentifier: '',
        ...updates,
      });
    }

    async function clearSignupPhoneRuntimeState(extraUpdates = {}) {
      await persistSignupPhoneRuntimeState({
        [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
        ...extraUpdates,
      });
    }

    async function acquirePhoneActivation(state = {}, options = {}) {
      state = await mergeLatestPhoneSettingsState(state);
      const provider = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      const providerOrder = resolvePhoneProviderOrder(state, provider);
      const activeProviderAdapter = getPhoneSmsProviderAdapterForState(state, provider);
      const countryCandidates = resolveCountryCandidatesForProvider(state, provider);
      const providerExpectsConfiguredCountries = readPhoneSmsProviderCapability(
        activeProviderAdapter,
        'requiresCountrySelection',
        true
      );
      if (providerExpectsConfiguredCountries && !countryCandidates.length) {
        throw new Error(`步骤 ${getActivePhoneVerificationVisibleStep()}：${getPhoneSmsProviderLabel(provider)} 未选择国家，请先在接码设置中至少选择 1 个国家。`);
      }
      const normalizeCountryKey = (value) => getProviderCountryKey(activeProviderAdapter, value);
      const normalizeActivationCountryKey = (activationRecord) => (
        getProviderActivationCountryKey(state, activationRecord)
      );
      const blockedCountryIds = new Set(
        (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
          .map((value) => normalizeCountryKey(value))
          .filter(Boolean)
      );
      const allowedCountryIds = new Set(
        countryCandidates
          .map((entry) => normalizeCountryKey(entry.id || entry.code))
          .filter((id) => Boolean(id && !blockedCountryIds.has(id)))
      );
      const preferredCountryLabel = countryCandidates[0]?.label || '';
      const resolveCountryLabelById = (countryId) => {
        const normalizedCountryKey = normalizeCountryKey(countryId);
        return countryCandidates.find((entry) => normalizeCountryKey(entry.id || entry.code) === normalizedCountryKey)?.label
          || getProviderCountryLabel(state, provider, countryId)
          || preferredCountryLabel;
      };
      const scopedStateForProvider = (providerName) => ({
        ...state,
        phoneSmsProvider: normalizePhoneSmsProvider(providerName),
      });
      const canUseSavedActivationForCurrentFlow = !isPhoneSignupIdentityState(state);
      const preferredActivation = normalizeActivation(state[PREFERRED_PHONE_ACTIVATION_STATE_KEY]);
      let failedPreferredActivation = null;
      const canTryPreferredActivation = (
        canUseSavedActivationForCurrentFlow
        && !Boolean(options?.skipPreferredActivation)
        && preferredActivation
        && preferredActivation.provider === provider
        && !blockedCountryIds.has(normalizeActivationCountryKey(preferredActivation))
        && (
          !allowedCountryIds.size
          || allowedCountryIds.has(normalizeActivationCountryKey(preferredActivation))
        )
        && preferredActivation.successfulUses < preferredActivation.maxUses
      );
      if (canTryPreferredActivation) {
        try {
          const reactivated = await reactivatePhoneActivation(state, preferredActivation);
          await addLog(
            `步骤 9：优先复用手动选择号码 ${reactivated.phoneNumber}${reactivated.countryId ? `（${resolveCountryLabelById(reactivated.countryId)}）` : ''}。`,
            'info'
          );
          await resetPhoneNoSupplyFailureStreak(state);
          return reactivated;
        } catch (error) {
          failedPreferredActivation = preferredActivation;
          await removeReusableActivationFromPool(preferredActivation, { state }).catch(() => {});
          await addLog(
            `步骤 9：手动选择号码 ${preferredActivation.phoneNumber} 不可用，将改为获取新号码。${error.message}`,
            'warn'
          );
        }
      }
      const reuseEnabled = isPhoneSmsReuseEnabled(state);
      const reusableActivation = normalizeActivation(state[REUSABLE_PHONE_ACTIVATION_STATE_KEY]);
      const reusableActivationPool = readReusableActivationPoolFromState(state);
      const reusableCandidates = [];
      const seenReusableKeys = new Set();
      const pushReusableCandidate = (candidate) => {
        const normalizedCandidate = normalizeActivation(candidate);
        if (!normalizedCandidate) {
          return;
        }
        const candidateKey = buildActivationIdentityKey(normalizedCandidate);
        if (!candidateKey || seenReusableKeys.has(candidateKey)) {
          return;
        }
        seenReusableKeys.add(candidateKey);
        reusableCandidates.push(normalizedCandidate);
      };
      pushReusableCandidate(reusableActivation);
      reusableActivationPool.forEach((candidate) => pushReusableCandidate(candidate));

      if (reuseEnabled) {
        for (const candidateActivation of reusableCandidates) {
          if (candidateActivation.provider !== provider) {
            continue;
          }
          if (isSameActivation(candidateActivation, failedPreferredActivation)) {
            continue;
          }
          if (candidateActivation.successfulUses >= candidateActivation.maxUses) {
            continue;
          }
          const candidateCountryKey = normalizeActivationCountryKey(candidateActivation);
          if (blockedCountryIds.has(candidateCountryKey)) {
            continue;
          }
          if (allowedCountryIds.size && !allowedCountryIds.has(candidateCountryKey)) {
            continue;
          }
          try {
            const reactivated = await reactivatePhoneActivation(state, candidateActivation);
            await addLog(
              `步骤 9：复用 ${resolveCountryLabelById(reactivated.countryId)} 号码 ${reactivated.phoneNumber}（第 ${reactivated.successfulUses + 1}/${reactivated.maxUses} 次）。`,
              'info'
            );
            await resetPhoneNoSupplyFailureStreak(state);
            return reactivated;
          } catch (error) {
            await addLog(`步骤 9：复用号码 ${candidateActivation.phoneNumber} 失败，将改为获取新号码。${error.message}`, 'warn');
            await removeReusableActivationFromPool(candidateActivation, { state }).catch(() => {});
            if (isSameActivation(reusableActivation, candidateActivation)) {
              await clearReusableActivation();
            }
          }
        }
      }

      let lastProviderError = null;
      const providerErrors = [];
      const skippedFallbackProviders = [];
      for (const providerCandidate of providerOrder) {
        const useBlockedCountryIds = providerCandidate === provider
          ? Array.from(blockedCountryIds)
          : [];
        const useCountryPriceFloorByCountryId = (
          providerCandidate === provider
          && options?.countryPriceFloorByCountryId
          && typeof options.countryPriceFloorByCountryId === 'object'
        )
          ? options.countryPriceFloorByCountryId
          : {};
        try {
          const activation = await requestPhoneActivation(
            scopedStateForProvider(providerCandidate),
            {
              blockedCountryIds: useBlockedCountryIds,
              countryPriceFloorByCountryId: useCountryPriceFloorByCountryId,
              preservePhoneSmsProvider: true,
            }
          );
          const providerLabel = getPhoneSmsProviderLabel(providerCandidate);
          const providerCountryLabel = providerCandidate === provider
            ? resolveCountryLabelById(activation.countryId)
            : String(activation?.countryLabel || activation?.countryId || '').trim();
          if (providerCandidate !== provider) {
            await addLog(
              `步骤 9：主接码平台 ${getPhoneSmsProviderLabel(provider)} 暂无可用号码，已回退到 ${providerLabel}${providerCountryLabel ? ` / ${providerCountryLabel}` : ''}。`,
              'warn'
            );
          }
          await addLog(
            `步骤 9：已从 ${providerLabel}${providerCountryLabel ? ` / ${providerCountryLabel}` : ''} 获取号码 ${activation.phoneNumber}。`,
            'info'
          );
          await resetPhoneNoSupplyFailureStreak(state);
          return activation;
        } catch (error) {
          if (isStopRequestedError(error)) {
            throw error;
          }
          const providerErrorMessage = String(error?.message || error || 'unknown error');
          const providerLabel = getPhoneSmsProviderLabel(providerCandidate);
          if (
            providerCandidate !== provider
            && /(?:step|步骤)\s*9\s*[:：]\s*(?:5sim|nexsms).*(?:countries\s+are\s+empty|未选择国家)/i.test(providerErrorMessage)
          ) {
            skippedFallbackProviders.push(`${providerLabel}：未选择国家`);
            await addLog(
              `步骤 9：跳过回退接码平台 ${providerLabel}，因为接码设置中未选择国家。`,
              'warn'
            );
            continue;
          }
          lastProviderError = error;
          providerErrors.push(`${providerLabel}：${formatProviderAcquireFailure(providerCandidate, providerErrorMessage)}`);
        }
      }

      if (providerErrors.length) {
        await logNoSupplyDiagnostics(state, providerOrder, providerErrors);
        const skippedSuffix = skippedFallbackProviders.length
          ? `；已跳过回退平台：${skippedFallbackProviders.join('；')}`
          : '';
        throw new Error(`步骤 ${getActivePhoneVerificationVisibleStep()}：所有接码平台候选均未获取到手机号。${providerErrors.join('；')}${skippedSuffix}`);
      }
      throw lastProviderError || new Error(`步骤 ${getActivePhoneVerificationVisibleStep()}：获取手机号订单失败。`);
    }

    async function prepareSignupPhoneActivation(state = {}, options = {}) {
      return withPhoneVerificationLogContext({ step: 2, stepKey: 'submit-signup-email' }, async () => {
        const activation = await acquirePhoneActivation(state, {
          ...options,
          logLabel: options?.logLabel || '步骤 2',
        });
        const normalizedActivation = normalizeActivation(activation);
        if (!normalizedActivation) {
          throw new Error('步骤 2：接码平台返回的手机号订单无效。');
        }
        const countryConfig = resolveCountryConfigFromActivation(normalizedActivation, state);
        const signupActivation = normalizeActivation({
          ...normalizedActivation,
          countryId: countryConfig?.id ?? normalizedActivation.countryId,
          countryLabel: normalizedActivation.countryLabel || countryConfig?.label || '',
        }) || normalizedActivation;
        await persistSignupPhoneRuntimeState({
          signupPhoneNumber: signupActivation.phoneNumber,
          signupPhoneActivation: signupActivation,
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: 'signup',
          accountIdentifierType: 'phone',
          accountIdentifier: signupActivation.phoneNumber,
        });
        return signupActivation;
      });
    }

    async function markActivationReusableAfterSuccess(state, activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (isPhoneSignupIdentityState(state)) {
        return;
      }
      if (!isPhoneSmsReuseEnabled(state)) {
        await clearReusableActivation();
        return;
      }
      if (!normalizedActivation) {
        await clearReusableActivation();
        return;
      }
      const provider = getPhoneSmsProviderAdapterForActivation(state, normalizedActivation);
      if (!callPhoneSmsProviderCapability(
        provider,
        'canPersistReusableActivation',
        [state, normalizedActivation],
        'supportsReusableActivation',
        false
      )) {
        await clearReusableActivation();
        return;
      }

      const successfulUses = normalizedActivation.successfulUses + 1;
      const nextReusableActivation = {
        ...normalizedActivation,
        successfulUses,
      };
      delete nextReusableActivation.phoneCodeReceived;
      delete nextReusableActivation.phoneCodeReceivedAt;
      delete nextReusableActivation.ignoredPhoneCodeKeys;
      await upsertReusableActivationPool(nextReusableActivation, { state });
      if (!normalizePhoneSmsReuseEnabled(state)) {
        await clearReusableActivation();
        return;
      }
      if (successfulUses >= normalizedActivation.maxUses) {
        await clearReusableActivation();
        await removeReusableActivationFromPool(nextReusableActivation, { state });
        return;
      }

      await persistReusableActivation(nextReusableActivation);
    }

    function shouldPreserveActivationForFreeReuse(state, activation) {
      if (isPhoneSignupIdentityState(state)) {
        return false;
      }
      if (!normalizeFreePhoneReuseEnabled(state?.freePhoneReuseEnabled)) {
        return false;
      }
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return false;
      }
      const activationSnapshot = {
        ...normalizedActivation,
        ...(activation && typeof activation === 'object' && activation.phoneCodeReceived ? { phoneCodeReceived: true } : {}),
        ...(activation && typeof activation === 'object' && activation.phoneCodeReceivedAt ? { phoneCodeReceivedAt: activation.phoneCodeReceivedAt } : {}),
      };
      const provider = getPhoneSmsProviderAdapterForActivation(state, activationSnapshot);
      return callPhoneSmsProviderCapability(
        provider,
        'canPreserveActivationForFreeReuse',
        [state, activationSnapshot],
        'supportsFreeReusePreservation',
        false
      );
    }

    function shouldSkipTerminalStatusForFreeReuse(state, activation) {
      if (isPhoneSignupIdentityState(state)) {
        return false;
      }
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return false;
      }
      if (isFreeAutoReuseActivation(normalizedActivation)) {
        return true;
      }
      if (isRetainedReuseActivation(normalizedActivation)) {
        return true;
      }
      if (normalizedActivation.source === 'free-manual-reuse') {
        return true;
      }
      const savedFreeActivation = normalizeFreeReusablePhoneActivation(
        state?.[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]
      );
      if (
        savedFreeActivation
        && (
          isSameActivation(savedFreeActivation, normalizedActivation)
          || phoneNumbersMatch(savedFreeActivation.phoneNumber, normalizedActivation.phoneNumber)
        )
      ) {
        return true;
      }
      return shouldPreserveActivationForFreeReuse(state, normalizedActivation);
    }

    async function markFreeReusableActivationAfterCode(state, activation) {
      const latestState = {
        ...(state || {}),
        ...(typeof getState === 'function' ? await getState() : {}),
      };
      if (isPhoneSignupIdentityState(latestState)) {
        return;
      }
      if (!normalizeFreePhoneReuseEnabled(latestState?.freePhoneReuseEnabled)) {
        return;
      }
      if (normalizeFreeReusablePhoneActivation(latestState[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY])) {
        return;
      }
      const normalizedActivation = normalizeActivation(activation);
      const activationSnapshot = normalizedActivation
        ? {
          ...normalizedActivation,
          ...(activation && typeof activation === 'object' && activation.phoneCodeReceived ? { phoneCodeReceived: true } : {}),
          ...(activation && typeof activation === 'object' && activation.phoneCodeReceivedAt ? { phoneCodeReceivedAt: activation.phoneCodeReceivedAt } : {}),
        }
        : null;
      const provider = activationSnapshot
        ? getPhoneSmsProviderAdapterForActivation(latestState, activationSnapshot)
        : null;
      if (
        !normalizedActivation
        || !callPhoneSmsProviderCapability(
          provider,
          'canPreserveActivationForFreeReuse',
          [latestState, activationSnapshot],
          'supportsFreeReusePreservation',
          false
        )
        || !activationSnapshot.phoneCodeReceived
        || isFreeAutoReuseActivation(normalizedActivation)
      ) {
        return;
      }
      const countryConfig = resolveCountryConfigFromActivation(normalizedActivation, latestState);
      await persistFreeReusableActivation({
        ...normalizedActivation,
        source: 'free-manual-reuse',
        countryId: countryConfig.id,
        ...(countryConfig.label ? { countryLabel: countryConfig.label } : {}),
        recordedAt: Date.now(),
      });
      await addLog(
        `步骤 9：收到有效短信后已保存白嫖复用手机号 ${normalizedActivation.phoneNumber}。`,
        'info'
      );
    }

    async function markFreeReusableActivationAfterAutoSuccess(state, activation) {
      const normalizedActivation = normalizeFreeReusablePhoneActivation(activation);
      if (!normalizedActivation || !isFreeAutoReuseActivation(activation)) {
        return;
      }

      const latestState = {
        ...(state || {}),
        ...(typeof getState === 'function' ? await getState() : {}),
      };
      if (isPhoneSignupIdentityState(latestState)) {
        return;
      }
      const savedActivation = normalizeFreeReusablePhoneActivation(
        latestState[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]
      );
      if (!savedActivation || savedActivation.activationId !== normalizedActivation.activationId) {
        return;
      }

      const successfulUses = savedActivation.successfulUses + 1;
      const maxUses = Math.max(1, Math.floor(Number(savedActivation.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES));
      if (successfulUses >= maxUses) {
        await clearFreeReusableActivation();
        await addLog(
          `步骤 9：自动白嫖复用手机号 ${savedActivation.phoneNumber} 已达到 ${successfulUses}/${maxUses} 次，已清除本地记录。`,
          'info'
        );
        return;
      }

      await persistFreeReusableActivation({
        ...savedActivation,
        source: 'free-manual-reuse',
        successfulUses,
        maxUses,
      });
      await addLog(
        `步骤 9：自动白嫖复用手机号 ${savedActivation.phoneNumber} 成功（${successfulUses}/${maxUses}），保留供后续注册使用。`,
        'info'
      );
    }

    async function markFreeReusableActivationAfterInitialSuccess(state, activation) {
      const normalizedActivation = normalizeActivation(activation);
      const activationSnapshot = normalizedActivation
        ? {
          ...normalizedActivation,
          ...(activation && typeof activation === 'object' && activation.phoneCodeReceived ? { phoneCodeReceived: true } : {}),
          ...(activation && typeof activation === 'object' && activation.phoneCodeReceivedAt ? { phoneCodeReceivedAt: activation.phoneCodeReceivedAt } : {}),
        }
        : null;
      const provider = activationSnapshot
        ? getPhoneSmsProviderAdapterForActivation(state, activationSnapshot)
        : null;
      if (
        !normalizedActivation
        || !callPhoneSmsProviderCapability(
          provider,
          'canPreserveActivationForFreeReuse',
          [state, activationSnapshot],
          'supportsFreeReusePreservation',
          false
        )
        || isFreeAutoReuseActivation(normalizedActivation)
      ) {
        return;
      }

      const latestState = {
        ...(state || {}),
        ...(typeof getState === 'function' ? await getState() : {}),
      };
      if (isPhoneSignupIdentityState(latestState)) {
        return;
      }
      const savedActivation = normalizeFreeReusablePhoneActivation(
        latestState[FREE_REUSABLE_PHONE_ACTIVATION_STATE_KEY]
      );
      if (
        !savedActivation
        || !(
          isSameActivation(savedActivation, normalizedActivation)
          || phoneNumbersMatch(savedActivation.phoneNumber, normalizedActivation.phoneNumber)
        )
      ) {
        return;
      }

      const maxUses = Math.max(1, Math.floor(Number(savedActivation.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES));
      const successfulUses = Math.min(maxUses, normalizeUseCount(savedActivation.successfulUses) + 1);
      if (successfulUses >= maxUses) {
        await clearFreeReusableActivation();
        await addLog(
          `步骤 9：白嫖复用手机号 ${savedActivation.phoneNumber} 已达到 ${successfulUses}/${maxUses} 次，已清除本地记录。`,
          'info'
        );
        return;
      }

      if (successfulUses !== savedActivation.successfulUses || savedActivation.maxUses !== maxUses) {
        await persistFreeReusableActivation({
          ...savedActivation,
          source: 'free-manual-reuse',
          successfulUses,
          maxUses,
        });
      }
    }

    async function waitForPhoneCodeOrRotateNumber(tabId, state, activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        throw new Error('缺少手机号接码订单。');
      }
      const provider = getPhoneSmsProviderAdapterForActivation(state, normalizedActivation);
      const providerLabel = getPhoneSmsProviderLabel(normalizedActivation.provider);
      const usePageResend = callPhoneSmsProviderCapability(
        provider,
        'shouldUsePageResend',
        [state, normalizedActivation],
        'supportsPageResend',
        true
      );

      const waitSeconds = normalizePhoneCodeWaitSeconds(state?.phoneCodeWaitSeconds);
      const timeoutWindows = normalizePhoneCodeTimeoutWindows(state?.phoneCodeTimeoutWindows);
      const pollIntervalSeconds = normalizePhoneCodePollIntervalSeconds(state?.phoneCodePollIntervalSeconds);
      const pollMaxRounds = resolvePhoneCodePollMaxRoundsForWindow(
        waitSeconds,
        pollIntervalSeconds,
        state?.phoneCodePollMaxRounds
      );
      let resendTriggeredForCurrentNumber = false;

      for (let windowIndex = 1; windowIndex <= timeoutWindows; windowIndex += 1) {
        await setPhoneRuntimeCountdown(normalizedActivation, waitSeconds, windowIndex, timeoutWindows);
        await addLog(
          `步骤 9：等待号码 ${normalizedActivation.phoneNumber} 接收短信（等待窗口 ${windowIndex}/${timeoutWindows}，最长 ${waitSeconds} 秒，每 ${pollIntervalSeconds} 秒轮询一次，最多 ${pollMaxRounds} 次轮询）。`,
          'info'
        );
        try {
          const code = await pollPhoneActivationCode(state, normalizedActivation, {
            actionLabel: windowIndex === 1
              ? '从接码平台轮询手机验证码'
              : '从接码平台轮询重发后的手机验证码',
            timeoutMs: waitSeconds * 1000,
            intervalMs: pollIntervalSeconds * 1000,
            maxRounds: pollMaxRounds,
            onStatus: async ({ elapsedMs, pollCount, statusText }) => {
              if (/^STATUS_(WAIT_CODE|WAIT_RETRY|WAIT_RESEND)(?::.+)?$/i.test(String(statusText || '').trim())) {
                const pageError = await checkPhoneResendPageError(tabId, state);
                if (pageError?.reason === 'resend_phone_banned') {
                  throw new Error(`${PHONE_RESEND_BANNED_NUMBER_ERROR_PREFIX}${pageError.message || 'OpenAI 无法向此手机号发送短信。'}`);
                }
                if (pageError?.reason === 'phone_max_usage_exceeded') {
                  throw buildPhoneMaxUsageExceededError(pageError.message);
                }
                if (pageError?.reason === 'resend_server_error') {
                  throw buildPhoneResendServerError(pageError.message);
                }
                if (pageError?.reason === 'resend_throttled') {
                  if (shouldTreatResendThrottledAsBanned(state)) {
                    throw buildHighRiskResendThrottledError(pageError.message);
                  }
                  await addLog(
                    `步骤 9：检测到号码 ${normalizedActivation.phoneNumber} 重发限流，但未启用“按疑似封禁处理”，继续等待短信。${pageError.message || ''}`.trim(),
                    'warn'
                  );
                }
              }
              await addLog(
                `步骤 9：${getPhoneSmsProviderLabel(normalizedActivation.provider)} 号码 ${normalizedActivation.phoneNumber} 状态：${statusText}（已等待 ${Math.ceil(elapsedMs / 1000)} 秒，第 ${pollCount}/${pollMaxRounds} 次轮询）。`,
                'info'
              );
            },
          });
          await clearPhoneRuntimeCountdown();
          return {
            code,
            replaceNumber: false,
          };
        } catch (error) {
          if (!isPhoneCodeTimeoutError(error)) {
            if (isPhoneResendBannedNumberError(error)) {
              await addLog(
                `步骤 9：OpenAI 无法向号码 ${normalizedActivation.phoneNumber} 发送短信，立即更换号码。${error.message}`,
                'warn'
              );
              await clearPhoneRuntimeCountdown();
              return {
                code: '',
                replaceNumber: true,
                reason: 'resend_phone_banned',
              };
            }
            if (isPhoneMaxUsageExceededFlowError(error)) {
              await addLog(
                `步骤 9：OpenAI 提示号码 ${normalizedActivation.phoneNumber} 达到使用上限，立即更换号码。${error.message}`,
                'warn'
              );
              await clearPhoneRuntimeCountdown();
              return {
                code: '',
                replaceNumber: true,
                reason: 'phone_max_usage_exceeded',
              };
            }
            if (isPhoneResendServerError(error)) {
              await addLog(
                `步骤 9：重发短信后进入 contact-verification 500 页面，立即更换号码。${error.message}`,
                'warn'
              );
              await clearPhoneRuntimeCountdown();
              return {
                code: '',
                replaceNumber: true,
                reason: 'resend_server_error',
              };
            }
            if (isPhoneResendThrottledError(error)) {
              if (shouldTreatResendThrottledAsBanned(state)) {
                await addLog(
                  `步骤 9：号码 ${normalizedActivation.phoneNumber} 重发限流且配置为高风险封禁，立即更换号码。${error.message}`,
                  'warn'
                );
                await clearPhoneRuntimeCountdown();
                return {
                  code: '',
                  replaceNumber: true,
                  reason: 'resend_throttled_high_risk_banned',
                };
              }
              await addLog(
                `步骤 9：号码 ${normalizedActivation.phoneNumber} 重发限流，但未启用高风险换号，继续原等待逻辑。${error.message}`,
                'warn'
              );
              await sleepWithStop(pollIntervalSeconds * 1000);
              continue;
            }
            if (isPhoneActivationOrderMissingError(error, normalizedActivation.provider)) {
              await addLog(
                `步骤 9：${providerLabel} 号码 ${normalizedActivation.phoneNumber} 的接码订单已失效（${error.message || error}），立即更换号码。`,
                'warn'
              );
              await clearPhoneRuntimeCountdown();
              return {
                code: '',
                replaceNumber: true,
                reason: 'activation_not_found',
              };
            }
            throw error;
          }

          if (windowIndex < timeoutWindows) {
            await addLog(
              `步骤 9：号码 ${normalizedActivation.phoneNumber} 在 ${waitSeconds} 秒内未收到短信，正在请求再次发送。`,
              'warn'
            );
            if (!usePageResend) {
              await addLog(
                `步骤 9：${providerLabel} 保持当前验证码页会话并跳过页面重发，避免触发 405 或重发限流；继续轮询当前号码。`,
                'warn'
              );
              continue;
            }
            if (resendTriggeredForCurrentNumber) {
              await addLog(
                `步骤 9：号码 ${normalizedActivation.phoneNumber} 已触发过一次页面重发；为避免限流，将继续轮询不再点击重发。`,
                'warn'
              );
              continue;
            }
            try {
              const resendProbeResult = await resendPhoneVerificationCode(tabId, { probeOnly: true });
              if (isWhatsAppPhoneResendResult(resendProbeResult)) {
                await addLog(
                  `步骤 9：页面重发入口显示 WhatsApp 通道（${resendProbeResult.channelText || resendProbeResult.text || 'WhatsApp'}），当前接码平台无法读取 WhatsApp 消息，立即更换号码。`,
                  'warn'
                );
                await clearPhoneRuntimeCountdown();
                return {
                  code: '',
                  replaceNumber: true,
                  reason: 'whatsapp_resend_channel',
                };
              }
              await requestAdditionalPhoneSms(state, normalizedActivation);
              if (resendProbeResult?.probed) {
                const resendResult = await resendPhoneVerificationCode(tabId);
                if (isWhatsAppPhoneResendResult(resendResult)) {
                  await addLog(
                    `步骤 9：页面重发入口切换为 WhatsApp 通道（${resendResult.channelText || resendResult.text || 'WhatsApp'}），当前接码平台无法读取 WhatsApp 消息，立即更换号码。`,
                    'warn'
                  );
                  await clearPhoneRuntimeCountdown();
                  return {
                    code: '',
                    replaceNumber: true,
                    reason: 'whatsapp_resend_channel',
                  };
                }
              }
              resendTriggeredForCurrentNumber = true;
              await addLog('步骤 9：已点击手机验证码页面的“重新发送短信”。', 'info');
            } catch (resendError) {
              if (isStopRequestedError(resendError)) {
                throw resendError;
              }
              if (isPhoneResendBannedNumberError(resendError)) {
                await addLog(
                  `步骤 9：OpenAI 无法向号码 ${normalizedActivation.phoneNumber} 发送短信，立即更换号码。${resendError.message}`,
                  'warn'
                );
                await clearPhoneRuntimeCountdown();
                return {
                  code: '',
                  replaceNumber: true,
                  reason: 'resend_phone_banned',
                };
              }
              if (isPhoneResendThrottledError(resendError)) {
                await addLog(
                  `步骤 9：号码 ${normalizedActivation.phoneNumber} 重发短信被限流，立即更换号码。${resendError.message}`,
                  'warn'
                );
                await clearPhoneRuntimeCountdown();
                return {
                  code: '',
                  replaceNumber: true,
                  reason: shouldTreatResendThrottledAsBanned(state)
                    ? 'resend_throttled_high_risk_banned'
                    : 'resend_throttled',
                };
              }
              if (isPhoneResendServerError(resendError)) {
                await addLog(
                  `步骤 9：重发短信后进入 contact-verification 500 页面，立即更换号码。${resendError.message}`,
                  'warn'
                );
                await clearPhoneRuntimeCountdown();
                return {
                  code: '',
                  replaceNumber: true,
                  reason: 'resend_server_error',
                };
              }
              await addLog(`步骤 9：点击手机验证码页面重发按钮失败。${resendError.message}`, 'warn');
            }
            continue;
          }

          await addLog(
            `步骤 9：号码 ${normalizedActivation.phoneNumber} 连续 ${timeoutWindows} 轮未收到短信，将在步骤 9 内更换号码。`,
            'warn'
          );
          await clearPhoneRuntimeCountdown();
          return {
            code: '',
            replaceNumber: true,
            reason: `sms_timeout_after_${timeoutWindows}_windows`,
          };
        }
      }

      throw new Error('手机号验证未完成。');
    }

    function buildCompletedActivationSnapshot(activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return null;
      }
      return {
        ...normalizedActivation,
        successfulUses: normalizedActivation.successfulUses + 1,
      };
    }

    async function waitForScopedPhoneCode(state = {}, activation, options = {}) {
      const normalizedActivation = normalizeActivation(activation);
      const visibleStep = normalizeLogStep(options?.step) || 4;
      const stepKey = String(options?.stepKey || 'fetch-signup-code').trim() || 'fetch-signup-code';
      const purpose = String(options?.purpose || 'signup').trim() || 'signup';
      const actionLabelPrefix = String(options?.actionLabelPrefix || 'signup phone verification').trim() || 'phone verification';
      const onPollStatus = typeof options?.onPollStatus === 'function' ? options.onPollStatus : null;
      if (!normalizedActivation) {
        throw new Error(options?.missingActivationMessage || `步骤 ${visibleStep}：手机号激活记录缺失，请重新执行前置步骤。`);
      }

      return withPhoneVerificationLogContext({ step: visibleStep, stepKey }, async () => {
        const providerLabel = getPhoneSmsProviderLabel(normalizedActivation.provider);
        const waitSeconds = normalizePhoneCodeWaitSeconds(state?.phoneCodeWaitSeconds);
        const timeoutWindows = normalizePhoneCodeTimeoutWindows(state?.phoneCodeTimeoutWindows);
        const pollIntervalSeconds = normalizePhoneCodePollIntervalSeconds(state?.phoneCodePollIntervalSeconds);
        const pollMaxRounds = resolvePhoneCodePollMaxRoundsForWindow(
          waitSeconds,
          pollIntervalSeconds,
          state?.phoneCodePollMaxRounds
        );

        for (let windowIndex = 1; windowIndex <= timeoutWindows; windowIndex += 1) {
          await setPhoneRuntimeState({
            signupPhoneActivation: normalizedActivation,
            signupPhoneNumber: normalizedActivation.phoneNumber,
            signupPhoneVerificationPurpose: purpose,
            signupPhoneVerificationRequestedAt: Date.now(),
            [PHONE_RUNTIME_COUNTDOWN_ENDS_AT_KEY]: Date.now() + waitSeconds * 1000,
            [PHONE_RUNTIME_COUNTDOWN_WINDOW_INDEX_KEY]: windowIndex,
            [PHONE_RUNTIME_COUNTDOWN_WINDOW_TOTAL_KEY]: timeoutWindows,
          });
          await addLog(
            `步骤 ${visibleStep}：正在等待 ${normalizedActivation.phoneNumber} 的短信验证码（等待窗口 ${windowIndex}/${timeoutWindows}，最长 ${waitSeconds} 秒，每 ${pollIntervalSeconds} 秒轮询一次，最多 ${pollMaxRounds} 次轮询）。`,
            'info',
            { step: visibleStep, stepKey }
          );
          try {
            const code = await pollPhoneActivationCode(state, normalizedActivation, {
              actionLabel: windowIndex === 1
                ? `poll ${actionLabelPrefix} code from ${providerLabel}`
                : `poll resent ${actionLabelPrefix} code from ${providerLabel}`,
              timeoutMs: waitSeconds * 1000,
              intervalMs: pollIntervalSeconds * 1000,
              maxRounds: pollMaxRounds,
              onStatus: async ({ elapsedMs, pollCount, statusText }) => {
                await addLog(
                  `步骤 ${visibleStep}：${providerLabel} 状态 ${normalizedActivation.phoneNumber}: ${statusText}（已等待 ${Math.ceil(elapsedMs / 1000)} 秒，第 ${pollCount}/${pollMaxRounds} 次轮询）。`,
                  'info',
                  { step: visibleStep, stepKey }
                );
              },
              onWaitingForCode: async ({ elapsedMs, pollCount, statusText }) => {
                if (onPollStatus) {
                  await onPollStatus({ elapsedMs, pollCount, statusText });
                }
              },
            });
            await clearPhoneRuntimeCountdown();
            await setPhoneRuntimeState({
              [PHONE_VERIFICATION_CODE_STATE_KEY]: String(code || '').trim(),
              signupPhoneVerificationRequestedAt: Date.now(),
            });
            return code;
          } catch (error) {
            if (!isPhoneCodeTimeoutError(error)) {
              if (isPhoneActivationOrderMissingError(error, normalizedActivation.provider)) {
                throw new Error(`步骤 ${visibleStep}：当前手机号激活已失效，请重新执行前置步骤获取新短信。${error.message || error}`);
              }
              throw error;
            }

            if (windowIndex < timeoutWindows) {
              await addLog(
                `步骤 ${visibleStep}：${normalizedActivation.phoneNumber} 在 ${waitSeconds} 秒内未收到短信，准备请求重发。`,
                'warn',
                { step: visibleStep, stepKey }
              );
              await requestAdditionalPhoneSms(state, normalizedActivation);
              if (typeof options.onTimeoutWindow === 'function') {
                await options.onTimeoutWindow({
                  activation: normalizedActivation,
                  windowIndex,
                  timeoutWindows,
                });
              }
              continue;
            }

            await clearPhoneRuntimeCountdown();
            throw error;
          }
        }

        throw new Error(`步骤 ${visibleStep}：手机验证码未能成功获取。`);
      });
    }

    async function waitForSignupPhoneCode(state = {}, activation, options = {}) {
      return waitForScopedPhoneCode(state, activation, {
        ...options,
        step: 4,
        stepKey: 'fetch-signup-code',
        purpose: 'signup',
        actionLabelPrefix: 'signup phone verification',
        missingActivationMessage: '步骤 4：注册手机号激活记录缺失，请重新执行步骤 2。',
      });
    }

    async function waitForLoginPhoneCode(state = {}, activation, options = {}) {
      const visibleStep = normalizeLogStep(options?.visibleStep || options?.step) || 8;
      return waitForScopedPhoneCode(state, activation, {
        ...options,
        step: visibleStep,
        stepKey: 'fetch-login-code',
        purpose: 'login',
        actionLabelPrefix: 'login phone verification',
        missingActivationMessage: `步骤 ${visibleStep}：登录手机号激活记录缺失，请重新执行步骤 ${visibleStep >= 11 ? 10 : 7}。`,
      });
    }

    async function finalizeSignupPhoneActivationAfterSuccess(state = {}, activation = null) {
      const normalizedActivation = normalizeActivation(activation || state?.signupPhoneActivation);
      if (!normalizedActivation) {
        await clearSignupPhoneRuntimeState();
        return null;
      }
      await completePhoneActivation(state, normalizedActivation);
      await markActivationReusableAfterSuccess(state, normalizedActivation);
      await clearSignupPhoneRuntimeState({
        signupPhoneCompletedActivation: buildCompletedActivationSnapshot(normalizedActivation),
        signupPhoneNumber: normalizedActivation.phoneNumber,
        accountIdentifierType: 'phone',
        accountIdentifier: normalizedActivation.phoneNumber,
      });
      return normalizedActivation;
    }

    async function cancelSignupPhoneActivation(state = {}, activation = null) {
      const normalizedActivation = normalizeActivation(activation || state?.signupPhoneActivation);
      if (normalizedActivation) {
        await cancelPhoneActivation(state, normalizedActivation);
      }
      await clearSignupPhoneRuntimeState();
    }

    async function completeSignupPhoneVerificationFlow(tabId, options = {}) {
      return withPhoneVerificationLogContext({ step: 4, stepKey: 'fetch-signup-code' }, async () => {
        let state = options?.state || await getState();
        const activation = normalizeActivation(options?.activation || state?.signupPhoneActivation);
        const pageStateCheckTimeoutMs = Math.max(1, Math.floor(Number(options?.pageStateCheckTimeoutMs) || 5000));
        if (!activation) {
          throw new Error('步骤 4：未找到当前注册手机号激活记录，请重新执行步骤 2。');
        }

        const assertSignupPhoneStillApplicable = async (phaseLabel) => {
          try {
            const pageState = await readPhonePageState(tabId, pageStateCheckTimeoutMs);
            if (isSignupEmailVerificationPageState(pageState)) {
              throw buildSignupPhoneStaleEmailVerificationError(pageState);
            }
            return pageState;
          } catch (error) {
            if (isStopRequestedError(error) || isStaleSignupPhoneEmailVerificationError(error)) {
              throw error;
            }
            await throwPhoneResendServerErrorIfAuthTabShowsIt(tabId);
            await addLog(
              `步骤 4：检查注册手机号页面状态（${phaseLabel}）失败，将继续等待短信。${error.message}`,
              'warn',
              {
                step: 4,
                stepKey: 'fetch-signup-code',
              }
            );
            return null;
          }
        };

        let shouldCancelActivation = true;
        try {
          for (let attempt = 1; attempt <= DEFAULT_PHONE_SUBMIT_ATTEMPTS; attempt += 1) {
            throwIfStopped();
            state = await getState();
            await assertSignupPhoneStillApplicable('waiting for SMS code');
            const code = await waitForSignupPhoneCode(state, activation, {
              onPollStatus: async () => {
                await assertSignupPhoneStillApplicable('while waiting for SMS code');
              },
              onTimeoutWindow: async () => {
                try {
                  await resendSignupPhoneVerificationCode(tabId);
                  await addLog('步骤 4：已点击注册手机验证码页面的“重新发送”。', 'info', {
                    step: 4,
                    stepKey: 'fetch-signup-code',
                  });
                } catch (resendError) {
                  if (isStopRequestedError(resendError)) {
                    throw resendError;
                  }
                  if (isPhoneResendServerError(resendError)) {
                    throw buildPhoneResendServerError(resendError);
                  }
                  await throwPhoneResendServerErrorIfAuthTabShowsIt(tabId);
                  await addLog(`步骤 4：注册手机验证码页面重发失败，将继续轮询短信。${resendError.message}`, 'warn', {
                    step: 4,
                    stepKey: 'fetch-signup-code',
                  });
                }
              },
            });

            await assertSignupPhoneStillApplicable('before submitting SMS code');

            await setPhoneRuntimeState({
              [PHONE_VERIFICATION_CODE_STATE_KEY]: String(code || '').trim(),
              signupPhoneVerificationRequestedAt: Date.now(),
              signupPhoneVerificationPurpose: 'signup',
            });
            await addLog(`步骤 4：已获取手机验证码 ${code}。`, 'info', {
              step: 4,
              stepKey: 'fetch-signup-code',
            });

            const submitResult = await submitSignupPhoneVerificationCode(tabId, code, {
              signupProfile: options.signupProfile || null,
            });

            if (submitResult.invalidCode) {
              const invalidErrorText = String(submitResult.errorText || submitResult.url || '未知错误').trim();
              if (attempt >= DEFAULT_PHONE_SUBMIT_ATTEMPTS) {
                throw new Error(`步骤 4：手机验证码连续 ${DEFAULT_PHONE_SUBMIT_ATTEMPTS} 次被拒绝：${invalidErrorText}`);
              }

              await requestAdditionalPhoneSms(state, activation);
              try {
                await resendSignupPhoneVerificationCode(tabId);
              } catch (resendError) {
                if (isStopRequestedError(resendError)) {
                  throw resendError;
                }
                if (isPhoneResendServerError(resendError)) {
                  throw buildPhoneResendServerError(resendError);
                }
                await throwPhoneResendServerErrorIfAuthTabShowsIt(tabId);
                await addLog(`步骤 4：验证码被拒后点击重发失败。${resendError.message}`, 'warn', {
                  step: 4,
                  stepKey: 'fetch-signup-code',
                });
              }
              await addLog(
                `步骤 4：手机验证码被拒绝，已请求新短信（${attempt + 1}/${DEFAULT_PHONE_SUBMIT_ATTEMPTS}）。`,
                'warn',
                { step: 4, stepKey: 'fetch-signup-code' }
              );
              continue;
            }

            await finalizeSignupPhoneActivationAfterSuccess(state, activation);
            shouldCancelActivation = false;
            await setPhoneRuntimeState({
              [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
              signupPhoneVerificationRequestedAt: null,
              signupPhoneVerificationPurpose: '',
            });
            await addLog('步骤 4：手机验证码已通过，继续进入资料填写。', 'ok', {
              step: 4,
              stepKey: 'fetch-signup-code',
            });
            return submitResult || {};
          }

          throw new Error('步骤 4：手机验证码未能成功提交。');
        } catch (error) {
          if (shouldCancelActivation && activation) {
            await cancelSignupPhoneActivation(state, activation).catch(() => {});
          }
          await setPhoneRuntimeState({
            [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
            signupPhoneVerificationRequestedAt: null,
            signupPhoneVerificationPurpose: '',
          });
          throw sanitizePhoneCodeTimeoutError(error);
        }
      });
    }

    async function submitLoginPhoneVerificationCode(tabId, code, options = {}) {
      const visibleStep = normalizeLogStep(options?.visibleStep || options?.step) || 8;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(45000, { step: visibleStep, actionLabel: '提交登录手机验证码' })
        : 45000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'SUBMIT_PHONE_VERIFICATION_CODE',
        step: visibleStep,
        source: 'background',
        payload: {
          code,
          purpose: 'login',
          visibleStep,
        },
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: `步骤 ${visibleStep}：等待登录手机验证码页面就绪后填写短信验证码...`,
        logStep: visibleStep,
        logStepKey: 'fetch-login-code',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function resendLoginPhoneVerificationCode(tabId, options = {}) {
      const visibleStep = normalizeLogStep(options?.visibleStep || options?.step) || 8;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(65000, { step: visibleStep, actionLabel: '重新发送登录手机验证码' })
        : 65000;
      const result = await sendToContentScriptResilient('openai-auth', {
        type: 'RESEND_VERIFICATION_CODE',
        step: visibleStep,
        source: 'background',
        payload: {},
      }, {
        timeoutMs,
        responseTimeoutMs: timeoutMs,
        retryDelayMs: 600,
        logMessage: `步骤 ${visibleStep}：等待登录手机验证码重发按钮出现...`,
        logStep: visibleStep,
        logStepKey: 'fetch-login-code',
      });

      if (result?.error) {
        throw new Error(result.error);
      }
      return result || {};
    }

    async function prepareLoginPhoneActivation(state = {}, options = {}) {
      const visibleStep = normalizeLogStep(options?.visibleStep || options?.step) || 8;
      return withPhoneVerificationLogContext({ step: visibleStep, stepKey: 'fetch-login-code' }, async () => {
        const preferredActivation = normalizeActivation(
          options?.activation
          || state?.signupPhoneCompletedActivation
          || state?.signupPhoneActivation
        );
        if (!preferredActivation) {
          throw new Error(`步骤 ${visibleStep}：缺少已注册手机号激活记录，无法继续手机号登录验证码流程。`);
        }

        const activeActivation = normalizeActivation(state?.signupPhoneActivation);
        if (activeActivation && isSameActivation(activeActivation, preferredActivation)) {
          await setPhoneRuntimeState({
            signupPhoneNumber: activeActivation.phoneNumber,
            signupPhoneVerificationPurpose: 'login',
          });
          return activeActivation;
        }

        const reactivated = await reactivatePhoneActivation(state, preferredActivation);
        const normalizedActivation = normalizeActivation(reactivated);
        if (!normalizedActivation) {
          throw new Error(`步骤 ${visibleStep}：无法复用当前注册手机号，请重新执行步骤 ${visibleStep >= 11 ? 10 : 7}。`);
        }

        await setPhoneRuntimeState({
          signupPhoneActivation: normalizedActivation,
          signupPhoneCompletedActivation: preferredActivation,
          signupPhoneNumber: normalizedActivation.phoneNumber,
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: 'login',
          [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
          accountIdentifierType: 'phone',
          accountIdentifier: normalizedActivation.phoneNumber,
        });
        return normalizedActivation;
      });
    }

    async function finalizeLoginPhoneActivationAfterSuccess(state = {}, activation = null, options = {}) {
      const normalizedActivation = normalizeActivation(activation || state?.signupPhoneActivation);
      const visibleStep = normalizeLogStep(options?.visibleStep || options?.step) || 8;
      if (!normalizedActivation) {
        await setPhoneRuntimeState({
          signupPhoneActivation: null,
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: '',
          [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
        });
        return null;
      }

      return withPhoneVerificationLogContext({ step: visibleStep, stepKey: 'fetch-login-code' }, async () => {
        await completePhoneActivation(state, normalizedActivation);
        await setPhoneRuntimeState({
          signupPhoneActivation: null,
          signupPhoneCompletedActivation: buildCompletedActivationSnapshot(normalizedActivation),
          signupPhoneNumber: normalizedActivation.phoneNumber,
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: '',
          [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
          accountIdentifierType: 'phone',
          accountIdentifier: normalizedActivation.phoneNumber,
        });
        return normalizedActivation;
      });
    }

    async function completeLoginPhoneVerificationFlow(tabId, options = {}) {
      const visibleStep = normalizeLogStep(options?.visibleStep || options?.step) || 8;
      return withPhoneVerificationLogContext({ step: visibleStep, stepKey: 'fetch-login-code' }, async () => {
        let state = options?.state || await getState();
        const baseActivation = normalizeActivation(
          options?.activation
          || state?.signupPhoneCompletedActivation
          || state?.signupPhoneActivation
        );
        if (!baseActivation) {
          throw new Error(`步骤 ${visibleStep}：未找到当前登录手机号激活记录，请重新执行步骤 ${visibleStep >= 11 ? 10 : 7}。`);
        }

        let activation = await prepareLoginPhoneActivation(state, {
          activation: baseActivation,
          visibleStep,
        });
        let shouldCancelActivation = true;

        try {
          for (let attempt = 1; attempt <= DEFAULT_PHONE_SUBMIT_ATTEMPTS; attempt += 1) {
            throwIfStopped();
            state = await getState();
            const code = await waitForLoginPhoneCode(state, activation, {
              visibleStep,
              onTimeoutWindow: async () => {
                try {
                  await resendLoginPhoneVerificationCode(tabId, { visibleStep });
                  await addLog(`步骤 ${visibleStep}：已点击登录手机验证码页面的“重新发送”。`, 'info', {
                    step: visibleStep,
                    stepKey: 'fetch-login-code',
                  });
                } catch (resendError) {
                  if (isStopRequestedError(resendError)) {
                    throw resendError;
                  }
                  if (isPhoneResendServerError(resendError)) {
                    throw buildPhoneResendServerError(resendError);
                  }
                  await addLog(`步骤 ${visibleStep}：登录手机验证码页面重发失败，将继续轮询短信。${resendError.message}`, 'warn', {
                    step: visibleStep,
                    stepKey: 'fetch-login-code',
                  });
                }
              },
            });

            await setPhoneRuntimeState({
              [PHONE_VERIFICATION_CODE_STATE_KEY]: String(code || '').trim(),
              signupPhoneVerificationRequestedAt: Date.now(),
              signupPhoneVerificationPurpose: 'login',
            });
            await addLog(`步骤 ${visibleStep}：已获取登录手机验证码 ${code}。`, 'info', {
              step: visibleStep,
              stepKey: 'fetch-login-code',
            });

            const submitResult = await submitLoginPhoneVerificationCode(tabId, code, {
              visibleStep,
            });

            if (submitResult.invalidCode) {
              const invalidErrorText = String(submitResult.errorText || submitResult.url || '未知错误').trim();
              if (attempt >= DEFAULT_PHONE_SUBMIT_ATTEMPTS) {
                throw new Error(`步骤 ${visibleStep}：登录手机验证码连续 ${DEFAULT_PHONE_SUBMIT_ATTEMPTS} 次被拒绝：${invalidErrorText}`);
              }

              await requestAdditionalPhoneSms(state, activation);
              try {
                await resendLoginPhoneVerificationCode(tabId, { visibleStep });
              } catch (resendError) {
                if (isStopRequestedError(resendError)) {
                  throw resendError;
                }
                if (isPhoneResendServerError(resendError)) {
                  throw buildPhoneResendServerError(resendError);
                }
                await addLog(`步骤 ${visibleStep}：登录手机验证码被拒后点击重发失败。${resendError.message}`, 'warn', {
                  step: visibleStep,
                  stepKey: 'fetch-login-code',
                });
              }
              await addLog(
                `步骤 ${visibleStep}：登录手机验证码被拒绝，已请求新短信（${attempt + 1}/${DEFAULT_PHONE_SUBMIT_ATTEMPTS}）。`,
                'warn',
                { step: visibleStep, stepKey: 'fetch-login-code' }
              );
              continue;
            }

            await finalizeLoginPhoneActivationAfterSuccess(state, activation, { visibleStep });
            shouldCancelActivation = false;
            await addLog(`步骤 ${visibleStep}：登录手机验证码已通过，继续进入后续授权流程。`, 'ok', {
              step: visibleStep,
              stepKey: 'fetch-login-code',
            });
            return submitResult || {};
          }

          throw new Error(`步骤 ${visibleStep}：登录手机验证码未能成功提交。`);
        } catch (error) {
          if (shouldCancelActivation && activation) {
            await cancelPhoneActivation(state, activation).catch(() => {});
          }
          await setPhoneRuntimeState({
            signupPhoneActivation: null,
            [PHONE_VERIFICATION_CODE_STATE_KEY]: '',
            signupPhoneVerificationRequestedAt: null,
            signupPhoneVerificationPurpose: '',
          });
          throw sanitizePhoneCodeTimeoutError(error);
        }
      });
    }

    async function completePhoneVerificationFlow(tabId, initialPageState = null, options = {}) {
      const previousLogStep = activePhoneVerificationLogStep;
      const previousLogStepKey = activePhoneVerificationLogStepKey;
      activePhoneVerificationLogStep = normalizeLogStep(options.visibleStep || options.step) || 9;
      activePhoneVerificationLogStepKey = 'phone-verification';
      let state = await getState();
      let activation = normalizeActivation(state[PHONE_ACTIVATION_STATE_KEY]);
      let pageState = initialPageState || await readPhonePageState(tabId);
      let shouldCancelActivation = false;
      let remainingResendRequests = Math.max(0, Number(state.verificationResendCount) || 0);
      const maxNumberReplacementAttempts = normalizePhoneReplacementLimit(
        state.phoneVerificationReplacementLimit
      );
      let usedNumberReplacementAttempts = 0;
      let preferredActivationExhausted = false;
      let preferReuseExistingActivationOnAddPhone = false;
      let addPhoneReentryWithSameActivation = 0;
      const countrySmsFailureCounts = new Map();
      const countryPriceFloorByKey = new Map();
      const normalizeCountryFailureKey = (countryId, provider = activation?.provider || state?.phoneSmsProvider || '') => {
        const normalizedProvider = normalizePhoneSmsProvider(provider || state?.phoneSmsProvider || '');
        const scopedState = scopeStateToActivationProvider(state, { provider: normalizedProvider });
        const providerAdapter = getPhoneSmsProviderAdapterForState(scopedState, normalizedProvider);
        const countryKey = getProviderCountryKey(providerAdapter, countryId);
        return countryKey ? `${normalizedProvider}:${countryKey}` : '';
      };
      const splitCountryFailureKey = (countryKey, providerHint = '') => {
        const fallbackProvider = normalizePhoneSmsProvider(
          providerHint || activation?.provider || state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER
        );
        const raw = String(countryKey || '').trim();
        if (!raw) {
          return { provider: fallbackProvider, countryKey: '' };
        }
        const idx = raw.indexOf(':');
        if (idx <= 0) {
          return { provider: fallbackProvider, countryKey: raw };
        }
        const providerPrefix = normalizePhoneSmsProvider(raw.slice(0, idx));
        const keyPart = raw.slice(idx + 1).trim();
        return {
          provider: providerPrefix || fallbackProvider,
          countryKey: keyPart,
        };
      };
      const resolveCountryLabelByFailureKey = (countryKey, provider = activation?.provider || state?.phoneSmsProvider || '') => {
        const parsed = splitCountryFailureKey(countryKey, provider);
        const normalizedProvider = normalizePhoneSmsProvider(parsed.provider || provider || state?.phoneSmsProvider || '');
        const normalizedCountryKey = String(parsed.countryKey || '').trim();
        if (!normalizedCountryKey) {
          return 'Unknown country';
        }
        return getProviderCountryLabel(state, normalizedProvider, normalizedCountryKey);
      };

      const directNavigateToAddPhone = async (attemptLabel = 'after replace-number rotation') => {
        if (typeof navigateAuthTabToAddPhone !== 'function') {
          return null;
        }
        const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
        const result = await navigateAuthTabToAddPhone(tabId, {
          visibleStep,
          timeoutMs: 30000,
          logMessage: '步骤 9：认证页已失联，直接打开添加手机号页面后等待脚本恢复。',
          logStepKey: 'phone-verification',
          attemptLabel,
        });
        if (result?.error) {
          throw new Error(result.error);
        }
        return {
          addPhonePage: true,
          phoneVerificationPage: false,
          url: 'https://auth.openai.com/add-phone',
          ...(result || {}),
        };
      };

      const ensureAddPhonePageBeforeSubmit = async (attemptLabel = 'before submit', options = {}) => {
        const allowDirectNavigation = Boolean(options.allowDirectNavigation);
        let snapshot = null;
        let snapshotError = null;
        try {
          snapshot = await readPhonePageState(tabId, 12000);
        } catch (error) {
          snapshotError = error;
          await addLog(
            `步骤 9：检查认证页状态失败（${attemptLabel}）。${error.message}`,
            'warn'
          );
          snapshot = null;
        }

        if (snapshot?.addPhonePage) {
          return snapshot;
        }

        let returnError = null;
        try {
          const returned = await returnToAddPhone(tabId);
          const merged = {
            ...(snapshot || {}),
            ...(returned || {}),
          };
          if (merged?.addPhonePage) {
            return merged;
          }
        } catch (error) {
          returnError = error;
          await addLog(
            `步骤 9：返回添加手机号页面失败（${attemptLabel}）。${error.message}`,
            'warn'
          );
        }

        if (
          allowDirectNavigation
          && (
            isAuthContentScriptUnreachableError(snapshotError)
            || isAuthContentScriptUnreachableError(returnError)
          )
        ) {
          const navigated = await directNavigateToAddPhone(attemptLabel);
          if (navigated) {
            return navigated;
          }
        }

        let latest = null;
        try {
          latest = await readPhonePageState(tabId, 15000);
        } catch (error) {
          if (allowDirectNavigation && isAuthContentScriptUnreachableError(error)) {
            const navigated = await directNavigateToAddPhone(attemptLabel);
            if (navigated) {
              return navigated;
            }
          }
          throw error;
        }
        if (!latest?.addPhonePage) {
          throw new Error(
            `步骤 9：提交手机号前认证页未停留在添加手机号页面（${attemptLabel}）。URL: ${latest?.url || 'unknown'}`
          );
        }
        return latest;
      };

      const getCountryFailureCount = (countryId, providerId = normalizePhoneSmsProvider(state?.phoneSmsProvider)) => {
        const countryKey = normalizeCountryFailureKey(countryId, providerId);
        if (!countryKey) {
          return 0;
        }
        return Math.max(0, Math.floor(Number(countrySmsFailureCounts.get(countryKey)) || 0));
      };

      const markCountrySmsFailure = async (countryId, reason = 'sms_timeout', providerId = normalizePhoneSmsProvider(state?.phoneSmsProvider)) => {
        const countryKey = normalizeCountryFailureKey(countryId, providerId);
        if (!countryKey) {
          return;
        }
        const parsed = splitCountryFailureKey(countryKey, providerId);
        const nextCount = getCountryFailureCount(parsed.countryKey, parsed.provider) + 1;
        countrySmsFailureCounts.set(countryKey, nextCount);
        if (nextCount >= PHONE_SMS_FAILURE_SKIP_THRESHOLD) {
          const countryLabel = resolveCountryLabelByFailureKey(countryKey, providerId);
          await addLog(
            `步骤 9：${countryLabel} 已累计 ${nextCount} 次短信失败（${formatStep9Reason(reason)}）；下次获取号码会优先尝试其它已选国家。`,
            'warn'
          );
        }
      };

      const clearCountrySmsFailure = (countryId, providerId = normalizePhoneSmsProvider(state?.phoneSmsProvider)) => {
        const countryKey = normalizeCountryFailureKey(countryId, providerId);
        if (!countryKey) {
          return;
        }
        countrySmsFailureCounts.delete(countryKey);
        countryPriceFloorByKey.delete(countryKey);
      };

      const getBlockedCountryIds = () => {
        const activeProvider = normalizePhoneSmsProvider(
          state?.phoneSmsProvider || activation?.provider || DEFAULT_PHONE_SMS_PROVIDER
        );
        return Array.from(countrySmsFailureCounts.entries())
          .filter(([countryKey, count]) => (
            Number(count) >= PHONE_SMS_FAILURE_SKIP_THRESHOLD
            || !countryPriceFloorByKey.has(countryKey)
          ))
          .map(([countryKey]) => splitCountryFailureKey(countryKey, activeProvider))
          .filter((entry) => entry.provider === activeProvider)
          .map((entry) => String(entry.countryKey || '').trim())
          .filter(Boolean);
      };

      const getCountryPriceFloorById = () => {
        const activeProvider = normalizePhoneSmsProvider(
          state?.phoneSmsProvider || activation?.provider || DEFAULT_PHONE_SMS_PROVIDER
        );
        const floorById = {};
        countryPriceFloorByKey.forEach((price, compoundCountryKey) => {
          const numeric = normalizeHeroSmsPrice(price);
          if (numeric === null || numeric <= 0) {
            return;
          }
          const parsed = splitCountryFailureKey(compoundCountryKey, activeProvider);
          if (parsed.provider !== activeProvider) {
            return;
          }
          const keyPart = String(parsed.countryKey || '').trim();
          if (!keyPart) {
            return;
          }
          floorById[keyPart] = Math.round(numeric * 10000) / 10000;
        });
        return floorById;
      };

      const setCountryPriceFloorFromActivation = async (activationCandidate, reason = '') => {
        const normalizedActivation = normalizeActivation(activationCandidate);
        if (!normalizedActivation) {
          return;
        }
        const activationCountryKey = getProviderActivationCountryKey(state, normalizedActivation);
        const countryKey = normalizeCountryFailureKey(activationCountryKey, normalizedActivation.provider);
        if (!countryKey) {
          return;
        }
        const floorPrice = getProviderActivationPrice(state, normalizedActivation)
          ?? getActivationAcquiredPriceHint(normalizedActivation);
        if (floorPrice === null || floorPrice <= 0) {
          return;
        }
        const currentFloor = normalizeHeroSmsPrice(countryPriceFloorByKey.get(countryKey));
        if (currentFloor !== null && currentFloor >= floorPrice) {
          return;
        }
        const normalizedFloor = Math.round(floorPrice * 10000) / 10000;
        countryPriceFloorByKey.set(countryKey, normalizedFloor);
        const countryLabel = resolveCountryLabelByFailureKey(countryKey, normalizedActivation.provider);
        await addLog(
          `步骤 9：${countryLabel} 因 ${formatStep9Reason(reason || 'sms_timeout')} 将尝试更高价格档位（> ${normalizedFloor}）。`,
          'warn'
        );
      };

      const isPreferredActivation = (activationCandidate, stateSnapshot = {}) => (
        isSameActivation(
          stateSnapshot?.[PREFERRED_PHONE_ACTIVATION_STATE_KEY],
          activationCandidate
        )
      );

      const markPreferredActivationExhausted = async (reason = '') => {
        if (preferredActivationExhausted || !activation || !isPreferredActivation(activation, state)) {
          return;
        }
        preferredActivationExhausted = true;
        await addLog(
          `步骤 9：优先号码 ${activation.phoneNumber} 失败（${formatStep9Reason(reason || 'unknown')}），将改为获取新号码。`,
          'warn'
        );
      };

      const rotateCurrentActivation = async (reason = '', releaseAction = 'cancel') => {
        const normalizedActivation = normalizeActivation(activation);
        if (!normalizedActivation) {
          return { handled: false, nextActivation: null };
        }
        const scopedState = scopeStateToActivationProvider(state, normalizedActivation);
        const provider = getActivationProviderAdapterForState(scopedState, normalizedActivation);
        if (!provider || typeof provider.rotateActivation !== 'function') {
          return { handled: false, nextActivation: null };
        }
        const rotated = await provider.rotateActivation(
          scopedState,
          normalizedActivation,
          {
            releaseAction,
            reason,
          }
        );
        const nextActivation = normalizeActivation(rotated?.nextActivation);
        if (!nextActivation) {
          return { handled: true, nextActivation: null };
        }
        activation = nextActivation;
        shouldCancelActivation = true;
        await persistCurrentActivation(nextActivation);
        await addLog(
          `步骤 9：${getPhoneSmsProviderLabel(nextActivation.provider)} 已切换到新号码 ${nextActivation.phoneNumber}。`,
          'info'
        );
        return { handled: true, nextActivation };
      };

      const rotateActivationAfterAddPhoneFailure = async (failureReason, failureCode, submitState = {}) => {
        await markPreferredActivationExhausted(failureCode || failureReason);
        usedNumberReplacementAttempts += 1;
        if (usedNumberReplacementAttempts > maxNumberReplacementAttempts) {
          throw buildPhoneReplacementLimitError(maxNumberReplacementAttempts, failureCode || 'add_phone_rejected');
        }
        await addLog(
          `步骤 9：添加手机号失败后正在更换号码（${formatStep9Reason(failureReason)}，${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}）。`,
          'warn'
        );
        const rotated = shouldCancelActivation && activation
          ? await rotateCurrentActivation(
            failureCode || failureReason,
            getPhoneReplacementReleaseAction(failureCode || failureReason)
          )
          : { handled: false, nextActivation: null };
        if (rotated.nextActivation) {
          preferReuseExistingActivationOnAddPhone = false;
          addPhoneReentryWithSameActivation = 0;
          pageState = {
            ...pageState,
            ...submitState,
            addPhonePage: true,
            phoneVerificationPage: false,
          };
          return;
        }
        if (rotated.handled) {
          await clearCurrentActivation();
          activation = null;
          shouldCancelActivation = false;
          preferReuseExistingActivationOnAddPhone = false;
          addPhoneReentryWithSameActivation = 0;
          pageState = {
            ...pageState,
            ...submitState,
            addPhonePage: true,
            phoneVerificationPage: false,
          };
          return;
        }
        if (shouldCancelActivation && activation) {
          await cancelPhoneActivation(state, activation);
        }
        await clearCurrentActivation();
        activation = null;
        shouldCancelActivation = false;
        preferReuseExistingActivationOnAddPhone = false;
        addPhoneReentryWithSameActivation = 0;
        let addPhoneSnapshot = {
          ...pageState,
          ...submitState,
          addPhonePage: true,
          phoneVerificationPage: false,
        };
        try {
          const returned = await returnToAddPhone(tabId);
          addPhoneSnapshot = {
            ...addPhoneSnapshot,
            ...returned,
            addPhonePage: true,
            phoneVerificationPage: false,
          };
        } catch (returnError) {
          await addLog(
            `步骤 9：号码被拒后返回添加手机号页面失败，将用当前可用状态继续。${returnError.message}`,
            'warn'
          );
        }
        try {
          const verified = await ensureAddPhonePageBeforeSubmit('after add-phone rejection');
          addPhoneSnapshot = {
            ...addPhoneSnapshot,
            ...verified,
            addPhonePage: true,
            phoneVerificationPage: false,
          };
        } catch (verifyError) {
          await addLog(
            `步骤 9：号码被拒后确认添加手机号页面状态失败。${verifyError.message}`,
            'warn'
          );
        }
        pageState = addPhoneSnapshot;
      };

      try {
        while (true) {
          state = await getState();
          if (!activation) {
            activation = normalizeActivation(state[PHONE_ACTIVATION_STATE_KEY]);
          }

          if (pageState?.addPhonePage) {
            const addPhoneUrlText = String(pageState?.url || '').trim().toLowerCase();
            const looksLikeAddPhoneUrl = /\/add-phone(?:[/?#]|$)/i.test(addPhoneUrlText);
            if (!looksLikeAddPhoneUrl) {
              pageState = await ensureAddPhonePageBeforeSubmit(
                activation ? 'with current activation' : 'with new activation'
              );
            }
            if (!activation) {
              activation = await handoffFreeReusablePhone(tabId, state);
              if (activation) {
                shouldCancelActivation = false;
              } else {
                activation = await acquirePhoneActivation(state, {
                  blockedCountryIds: getBlockedCountryIds(),
                  countryPriceFloorByCountryId: getCountryPriceFloorById(),
                  skipPreferredActivation: preferredActivationExhausted,
                });
                shouldCancelActivation = true;
                await persistCurrentActivation(activation);
              }
              addPhoneReentryWithSameActivation = 0;
            } else if (preferReuseExistingActivationOnAddPhone) {
              addPhoneReentryWithSameActivation += 1;
              if (addPhoneReentryWithSameActivation > 1) {
                usedNumberReplacementAttempts += 1;
                if (usedNumberReplacementAttempts > maxNumberReplacementAttempts) {
                  throw buildPhoneReplacementLimitError(maxNumberReplacementAttempts, 'returned_to_add_phone_loop');
                }
                await addLog(
                  `步骤 9：当前号码 ${activation.phoneNumber} 反复返回添加手机号页，正在更换号码（${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}）。`,
                  'warn'
                );
                if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
                  await retireFreeReusableActivation(
                    `自动白嫖复用号码 ${activation.phoneNumber} 反复返回添加手机号页。`
                  );
                }
                const rotated = shouldCancelActivation && activation
                  ? await rotateCurrentActivation('returned_to_add_phone_loop', 'cancel')
                  : { handled: false, nextActivation: null };
                if (!rotated.nextActivation) {
                  if (!rotated.handled && shouldCancelActivation && activation) {
                    await cancelPhoneActivation(state, activation);
                  }
                  await clearCurrentActivation();
                  activation = null;
                  shouldCancelActivation = false;
                }
                preferReuseExistingActivationOnAddPhone = false;
                addPhoneReentryWithSameActivation = 0;
                pageState = {
                  ...pageState,
                  addPhonePage: true,
                  phoneVerificationPage: false,
                };
                continue;
              }
              await addLog(
                `步骤 9：页面返回添加手机号，将先重新提交当前号码 ${activation.phoneNumber}，暂不获取新号码。`,
                'warn'
              );
            }

            let submitResult = null;
            try {
              submitResult = await submitPhoneNumber(tabId, activation.phoneNumber, activation);
            } catch (submitError) {
              const submitErrorText = String(submitError?.message || submitError || 'unknown error');
              if (isPhoneNumberDeliveryRefusedError(submitErrorText) || isRecoverableAddPhoneSubmitError(submitErrorText)) {
                await rotateActivationAfterAddPhoneFailure(
                  submitErrorText,
                  isPhoneNumberDeliveryRefusedError(submitErrorText) ? 'phone_delivery_refused' : 'add_phone_submit_failed',
                  { url: pageState?.url || '' }
                );
                continue;
              }
              throw submitError;
            }
            if (submitResult.addPhoneRejected) {
              const addPhoneRejectText = String(submitResult.errorText || submitResult.url || 'unknown error');
              if (isPhoneNumberUsedError(addPhoneRejectText)) {
                usedNumberReplacementAttempts += 1;
                if (usedNumberReplacementAttempts > maxNumberReplacementAttempts) {
                  throw new Error(
                    `步骤 9：更换 ${maxNumberReplacementAttempts} 次号码后手机号验证仍未成功。最后原因：${formatStep9Reason('phone_number_used')}。`
                  );
                }

                await addLog(
                  `步骤 9：添加手机号页面提示 ${activation.phoneNumber} 已被使用（${addPhoneRejectText}），正在更换号码（${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}）。`,
                  'warn'
                );
                await discardPhoneActivationFromReuse(
                  `目标站拒绝该号码（${addPhoneRejectText}）。`,
                  activation,
                  await getState()
                );
                if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
                  await retireFreeReusableActivation(
                    `自动白嫖复用号码 ${activation.phoneNumber} 被目标站拒绝。`
                  );
                }
                const rotated = shouldCancelActivation && activation
                  ? await rotateCurrentActivation('phone_number_used', 'ban')
                  : { handled: false, nextActivation: null };
                if (!rotated.nextActivation) {
                  if (!rotated.handled && shouldCancelActivation && activation) {
                    await banPhoneActivation(state, activation);
                  }
                  await clearCurrentActivation();
                  activation = null;
                  shouldCancelActivation = false;
                }
                preferReuseExistingActivationOnAddPhone = false;
                addPhoneReentryWithSameActivation = 0;
                pageState = {
                  ...pageState,
                  ...submitResult,
                  addPhonePage: true,
                  phoneVerificationPage: false,
                };
                continue;
              }
              if (isPhoneNumberDeliveryRefusedError(addPhoneRejectText)) {
                await rotateActivationAfterAddPhoneFailure(
                  addPhoneRejectText,
                  'phone_delivery_refused',
                  submitResult || {}
                );
                continue;
              }

              await addLog(
                `步骤 9：添加手机号页面拒绝当前号码，但未明确提示已使用（${addPhoneRejectText}），将用同一号码再试一次。`,
                'warn'
              );
              let retrySubmitError = null;
              try {
                submitResult = await submitPhoneNumber(tabId, activation.phoneNumber, activation);
              } catch (submitError) {
                retrySubmitError = submitError;
              }
              if (retrySubmitError || submitResult.addPhoneRejected) {
                const retryRejectText = String(
                  retrySubmitError?.message
                  || submitResult?.errorText
                  || submitResult?.url
                  || 'unknown error'
                );
                if (
                  isPhoneNumberUsedError(retryRejectText)
                  || isPhoneNumberDeliveryRefusedError(retryRejectText)
                  || isRecoverableAddPhoneSubmitError(retryRejectText)
                ) {
                  await rotateActivationAfterAddPhoneFailure(
                    `add-phone keeps rejecting ${activation.phoneNumber} (${retryRejectText})`,
                    isPhoneNumberUsedError(retryRejectText)
                      ? 'phone_number_used'
                      : (isPhoneNumberDeliveryRefusedError(retryRejectText) ? 'phone_delivery_refused' : 'add_phone_rejected'),
                    submitResult || {}
                  );
                  continue;
                }
                throw new Error(
                  `步骤 9：添加手机号页面持续拒绝当前号码，但没有明确“已使用”状态：${submitResult.errorText || submitResult.url || '未知错误'}。`
                );
              }
            }

            await addLog('步骤 9：已在添加手机号页面提交号码。', 'info');
            pageState = {
              ...pageState,
              ...submitResult,
              addPhonePage: false,
              phoneVerificationPage: true,
            };
            preferReuseExistingActivationOnAddPhone = false;
            addPhoneReentryWithSameActivation = 0;
          }

          if (!pageState?.phoneVerificationPage) {
            pageState = await readPhonePageState(tabId);
          }

          if (!pageState?.phoneVerificationPage) {
            return pageState;
          }

          if (!activation) {
            throw new Error('认证页面正在等待手机验证码，但当前运行没有保存手机号接码订单。');
          }

          let shouldReplaceNumber = false;
          let replaceReason = '';

          for (let attempt = 1; attempt <= DEFAULT_PHONE_SUBMIT_ATTEMPTS; attempt += 1) {
            throwIfStopped();

            const codeResult = await waitForPhoneCodeOrRotateNumber(tabId, state, activation);
            if (codeResult.replaceNumber) {
              await markPreferredActivationExhausted(codeResult.reason || 'sms_timeout');
              shouldReplaceNumber = true;
              replaceReason = codeResult.reason || 'sms_not_received';
              break;
            }

            await setPhoneRuntimeState({
              [PHONE_VERIFICATION_CODE_STATE_KEY]: String(codeResult.code || '').trim(),
            });
            activation = markActivationPhoneCodeReceived(activation) || activation;
            await persistCurrentActivation(activation);
            await setPhoneRuntimeState({
              [PHONE_VERIFICATION_CODE_STATE_KEY]: String(codeResult.code || '').trim(),
            });
            await markFreeReusableActivationAfterCode(state, activation);
            await addLog(`步骤 9：已收到手机验证码 ${codeResult.code}。`, 'info');
            const submitResult = await submitPhoneVerificationCode(tabId, codeResult.code);

            if (submitResult.returnedToAddPhone) {
              await addLog(
                '步骤 9：提交验证码后返回添加手机号页面，将先重试当前号码。',
                'warn'
              );
              preferReuseExistingActivationOnAddPhone = true;
              pageState = {
                ...pageState,
                ...submitResult,
                addPhonePage: true,
                phoneVerificationPage: false,
              };
              break;
            }

            if (submitResult.invalidCode) {
              const invalidErrorText = String(submitResult.errorText || submitResult.url || 'unknown error');
              if (isPhoneNumberUsedError(invalidErrorText)) {
                shouldReplaceNumber = true;
                replaceReason = 'phone_number_used';
                await discardPhoneActivationFromReuse(
                  `目标站拒绝该号码（${invalidErrorText}）。`,
                  activation,
                  await getState()
                );
                if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
                  await retireFreeReusableActivation(
                    `自动白嫖复用号码 ${activation.phoneNumber} 被目标站拒绝。`
                  );
                }
                if (shouldCancelActivation && activation) {
                  await banPhoneActivation(state, activation);
                  shouldCancelActivation = false;
                }
                await addLog(
                  `步骤 9：手机号被提示已使用（${invalidErrorText}），立即更换新号码。`,
                  'warn'
                );
                break;
              }

              if (attempt >= DEFAULT_PHONE_SUBMIT_ATTEMPTS) {
                shouldReplaceNumber = true;
                replaceReason = 'code_rejected';
                if (shouldCancelActivation && activation) {
                  await banPhoneActivation(state, activation);
                  shouldCancelActivation = false;
                }
                await addLog(
                  `步骤 9：手机验证码连续 ${DEFAULT_PHONE_SUBMIT_ATTEMPTS} 次被拒（${invalidErrorText}），将更换号码。`,
                  'warn'
                );
                break;
              }

              if (remainingResendRequests > 0) {
                remainingResendRequests -= 1;
                try {
                  const resendProbeResult = await resendPhoneVerificationCode(tabId, { probeOnly: true });
                  if (isWhatsAppPhoneResendResult(resendProbeResult)) {
                    shouldReplaceNumber = true;
                    replaceReason = 'whatsapp_resend_channel';
                    await addLog(
                      `步骤 9：验证码被拒后的重发入口显示 WhatsApp 通道（${resendProbeResult.channelText || resendProbeResult.text || 'WhatsApp'}），当前接码平台无法读取 WhatsApp 消息，将更换号码。`,
                      'warn'
                    );
                    break;
                  }
                  await requestAdditionalPhoneSms(state, activation);
                  if (resendProbeResult?.probed) {
                    const resendResult = await resendPhoneVerificationCode(tabId);
                    if (isWhatsAppPhoneResendResult(resendResult)) {
                      shouldReplaceNumber = true;
                      replaceReason = 'whatsapp_resend_channel';
                      await addLog(
                        `步骤 9：验证码被拒后的重发入口切换为 WhatsApp 通道（${resendResult.channelText || resendResult.text || 'WhatsApp'}），当前接码平台无法读取 WhatsApp 消息，将更换号码。`,
                        'warn'
                      );
                      break;
                    }
                  }
                  await addLog('步骤 9：手机验证码被拒后已点击“重新发送短信”。', 'info');
                } catch (resendError) {
                  await addLog(`步骤 9：验证码被拒后点击重发失败。${resendError.message}`, 'warn');
                }
                if (shouldReplaceNumber) {
                  break;
                }
                await addLog(
                  `步骤 9：手机验证码被拒，已请求再次发送短信（剩余 ${remainingResendRequests} 次重发）。`,
                  'warn'
                );
              } else {
                await addLog(
                  '步骤 9：手机验证码被拒，配置的重发次数已用完，将在当前接码窗口内继续重试。',
                  'warn'
                );
              }
              continue;
            }

            const latestSuccessState = await getState();
            if (shouldSkipTerminalStatusForFreeReuse(latestSuccessState, activation)) {
              const terminalProviderLabel = getPhoneSmsProviderLabel(activation.provider);
              await addLog(
                `步骤 9：已跳过 ${terminalProviderLabel} 完成状态，保留 ${activation.phoneNumber} 供白嫖复用。`,
                'info'
              );
              await markFreeReusableActivationAfterInitialSuccess(latestSuccessState, activation);
            } else {
              await completePhoneActivation(latestSuccessState, activation);
            }
            await markFreeReusableActivationAfterAutoSuccess(state, activation);
            if (!isFreeAutoReuseActivation(activation)) {
              await markActivationReusableAfterSuccess(state, activation);
            }
            clearCountrySmsFailure(activation.countryId, activation.provider);
            shouldCancelActivation = false;
            await clearCurrentActivation();
            await setPhoneRuntimeState({
              phoneNumber: activation.phoneNumber,
            });
            addPhoneReentryWithSameActivation = 0;
            await addLog('步骤 9：手机号验证已完成，等待 OAuth 授权页。', 'ok');
            return submitResult;
          }

          if (!shouldReplaceNumber) {
            if (pageState?.addPhonePage) {
              continue;
            }
            throw new Error('手机号验证未完成。');
          }

          if (
            activation
            && (
              replaceReason === 'resend_throttled'
              || replaceReason === 'route_405_retry_loop'
              || /^sms_timeout_after_/i.test(String(replaceReason || ''))
            )
          ) {
            await setCountryPriceFloorFromActivation(activation, replaceReason || 'sms_timeout');
            await markCountrySmsFailure(activation.countryId, replaceReason || 'sms_timeout', activation.provider);
          }
          await markPreferredActivationExhausted(replaceReason || 'replace_number');

          usedNumberReplacementAttempts += 1;
          if (usedNumberReplacementAttempts > maxNumberReplacementAttempts) {
            throw buildPhoneReplacementLimitError(maxNumberReplacementAttempts, replaceReason || 'unknown');
          }

          const rotated = shouldCancelActivation && activation
            ? await rotateCurrentActivation(
              replaceReason || 'replace_number',
              getPhoneReplacementReleaseAction(replaceReason || 'replace_number')
            )
            : { handled: false, nextActivation: null };
          if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
            await retireFreeReusableActivation(
              `自动白嫖复用号码 ${activation.phoneNumber} 在失败后被更换。`
            );
          }
          if (isPhoneNumberUsedFailureReason(replaceReason)) {
            await discardPhoneActivationFromReuse(
              `目标站拒绝该号码（${replaceReason}）。`,
              activation,
              await getState()
            );
          }
          if (!rotated.nextActivation) {
            if (!rotated.handled && shouldCancelActivation && activation) {
              await cancelPhoneActivation(state, activation);
            }
            await clearCurrentActivation();
            activation = null;
            shouldCancelActivation = false;
          }
          addPhoneReentryWithSameActivation = 0;

          let returnResult = null;
          try {
            returnResult = await returnToAddPhone(tabId);
          } catch (returnError) {
            await addLog(`步骤 9：更换号码前返回添加手机号页面失败。${returnError.message}`, 'warn');
          }

          if (!returnResult?.addPhonePage) {
            try {
              const stateSnapshot = await readPhonePageState(tabId, 12000);
              if (stateSnapshot?.addPhonePage) {
                returnResult = {
                  ...(returnResult || {}),
                  ...stateSnapshot,
                  addPhonePage: true,
                  phoneVerificationPage: false,
                };
              }
            } catch (_) {
              // Best effort: keep fallback state for compatibility with tests and older flows.
            }
          }
          const verifiedAddPhoneState = await ensureAddPhonePageBeforeSubmit(
            'after replace-number rotation',
            { allowDirectNavigation: true }
          );
          returnResult = {
            ...(returnResult || {}),
            ...verifiedAddPhoneState,
            addPhonePage: true,
            phoneVerificationPage: false,
          };

          await addLog(
            `步骤 9：正在更换号码并在步骤 9 内重试（${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}）。`,
            'warn'
          );
          pageState = {
            ...pageState,
            ...returnResult,
            addPhonePage: true,
            phoneVerificationPage: false,
          };
        }
      } catch (error) {
        const errorMessage = String(error?.message || error || '');
        if (
          errorMessage.startsWith(PHONE_MANUAL_FREE_REUSE_ERROR_PREFIX)
          || errorMessage.startsWith(PHONE_AUTO_FREE_REUSE_PREPARE_ERROR_PREFIX)
        ) {
          throw error;
        }
        if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
          await retireFreeReusableActivation(
            `自动白嫖复用号码 ${activation.phoneNumber} 执行失败：${errorMessage || 'unknown error'}。`
          );
        }
        if (shouldCancelActivation && activation) {
          await cancelPhoneActivation(await getState(), activation);
        }
        await clearCurrentActivation();
        throw sanitizePhoneRestartStep7Error(sanitizePhoneCodeTimeoutError(error));
      } finally {
        activePhoneVerificationLogStep = previousLogStep;
        activePhoneVerificationLogStepKey = previousLogStepKey;
      }
    }

    return {
      cancelSignupPhoneActivation,
      completeLoginPhoneVerificationFlow,
      completePhoneVerificationFlow,
      completeSignupPhoneVerificationFlow,
      finalizeLoginPhoneActivationAfterSuccess,
      finalizeSignupPhoneActivationAfterSuccess,
      isPhoneResendBannedNumberError,
      normalizeActivation,
      pollPhoneActivationCode,
      prepareLoginPhoneActivation,
      prepareSignupPhoneActivation,
      reactivatePhoneActivation,
      requestPhoneActivation,
      waitForLoginPhoneCode,
      waitForSignupPhoneCode,
    };
  }

  return {
    createPhoneVerificationHelpers,
  };
});
