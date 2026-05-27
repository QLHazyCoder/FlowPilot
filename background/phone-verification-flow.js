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
      DEFAULT_HERO_SMS_BASE_URL = 'https://hero-sms.com/stubs/handler_api.php',
      DEFAULT_FIVE_SIM_BASE_URL = 'https://5sim.net/v1',
      DEFAULT_FIVE_SIM_PRODUCT = 'openai',
      DEFAULT_FIVE_SIM_OPERATOR = 'any',
      DEFAULT_FIVE_SIM_COUNTRY_ORDER = ['thailand'],
      DEFAULT_NEX_SMS_BASE_URL = 'https://api.nexsms.net',
      DEFAULT_NEX_SMS_COUNTRY_ORDER = [1],
      DEFAULT_NEX_SMS_SERVICE_CODE = 'ot',
      DEFAULT_HERO_SMS_REUSE_ENABLED = true,
      createFiveSimProvider = null,
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
    const HERO_SMS_LAST_PRICE_TIERS_KEY = 'heroSmsLastPriceTiers';
    const HERO_SMS_LAST_PRICE_COUNTRY_ID_KEY = 'heroSmsLastPriceCountryId';
    const HERO_SMS_LAST_PRICE_COUNTRY_LABEL_KEY = 'heroSmsLastPriceCountryLabel';
    const HERO_SMS_LAST_PRICE_USER_LIMIT_KEY = 'heroSmsLastPriceUserLimit';
    const HERO_SMS_LAST_PRICE_AT_KEY = 'heroSmsLastPriceAt';
    const FIVE_SIM_RATE_LIMIT_ERROR_PREFIX = 'FIVE_SIM_RATE_LIMIT::';
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
    const DEFAULT_PHONE_PRICE_LOOKUP_ATTEMPTS = 3;
    const MAX_PHONE_PRICE_CANDIDATES = 8;
    const DEFAULT_PHONE_ACTIVATION_RETRY_ROUNDS = 3;
    const PHONE_ACTIVATION_RETRY_ROUNDS_MIN = 1;
    const PHONE_ACTIVATION_RETRY_ROUNDS_MAX = 10;
    const DEFAULT_PHONE_ACTIVATION_RETRY_DELAY_MS = 2000;
    const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
    const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
    const HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH = 'price_high';
    const PHONE_SMS_PROVIDER_HERO = 'hero-sms';
    const PHONE_SMS_PROVIDER_5SIM = '5sim';
    const PHONE_SMS_PROVIDER_HERO_SMS = PHONE_SMS_PROVIDER_HERO;
    const PHONE_SMS_PROVIDER_FIVE_SIM = PHONE_SMS_PROVIDER_5SIM;
    const PHONE_SMS_PROVIDER_NEXSMS = 'nexsms';
    const DEFAULT_PHONE_SMS_PROVIDER = PHONE_SMS_PROVIDER_HERO;
    const DEFAULT_PHONE_SMS_PROVIDER_ORDER = Object.freeze([
      PHONE_SMS_PROVIDER_HERO,
      PHONE_SMS_PROVIDER_5SIM,
      PHONE_SMS_PROVIDER_NEXSMS,
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
      { prefix: '84', id: 10, label: 'Vietnam' },
      { prefix: '66', id: 52, label: 'Thailand' },
      { prefix: '62', id: 6, label: 'Indonesia' },
      { prefix: '44', id: 16, label: 'United Kingdom' },
      { prefix: '81', id: 151, label: 'Japan' },
      { prefix: '49', id: 43, label: 'Germany' },
      { prefix: '33', id: 73, label: 'France' },
      { prefix: '1', id: 187, label: 'USA' },
    ]);
    const activationPriceHintsByKey = new Map();
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

    function normalizeUrl(value, fallback = DEFAULT_HERO_SMS_BASE_URL) {
      const trimmed = String(value || '').trim();
      if (!trimmed) {
        return fallback;
      }
      try {
        return new URL(trimmed).toString();
      } catch {
        return fallback;
      }
    }

    function normalizeApiKey(value) {
      return String(value || '').trim();
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
      if (normalized === PHONE_SMS_PROVIDER_NEXSMS) {
        return PHONE_SMS_PROVIDER_NEXSMS;
      }
      return PHONE_SMS_PROVIDER_HERO;
    }
    function isFiveSimProvider(state = {}) {
      return normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER) === PHONE_SMS_PROVIDER_5SIM;
    }

    function normalizeNexSmsCountryId(value, fallback = 0) {
      const parsed = Math.floor(Number(value));
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
      const fallbackParsed = Math.floor(Number(fallback));
      if (Number.isFinite(fallbackParsed) && fallbackParsed >= 0) {
        return fallbackParsed;
      }
      return 0;
    }

    function normalizeNexSmsCountryOrder(value = []) {
      const source = Array.isArray(value)
        ? value
        : String(value || '')
          .split(/[\r\n,，;；]+/)
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      const normalized = [];
      const seen = new Set();
      source.forEach((entry) => {
        const id = normalizeNexSmsCountryId(
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? (entry.id || entry.countryId || entry.country || '')
            : entry,
          -1
        );
        if (id < 0 || seen.has(id)) {
          return;
        }
        seen.add(id);
        normalized.push(id);
      });
      return normalized.slice(0, 10);
    }

    function resolveNexSmsCountryCandidates(state = {}) {
      const ids = normalizeNexSmsCountryOrder(state?.nexSmsCountryOrder);
      return ids.map((id) => ({
        id,
        label: `Country #${id}`,
      }));
    }

    function normalizeNexSmsServiceCode(value = '', fallback = DEFAULT_NEX_SMS_SERVICE_CODE) {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      if (normalized) {
        return normalized;
      }
      const fallbackNormalized = String(fallback || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      return fallbackNormalized || 'ot';
    }

    function normalizeFiveSimCountryCode(value = '', fallback = 'thailand') {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      return normalized || fallback;
    }

    function normalizeFiveSimCountryOrder(value = []) {
      const source = Array.isArray(value)
        ? value
        : String(value || '')
          .split(/[\r\n,，;；]+/)
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      const normalized = [];
      const seen = new Set();

      source.forEach((entry) => {
        const code = normalizeFiveSimCountryCode(
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? (entry.code || entry.country || entry.id || '')
            : entry,
          ''
        );
        if (!code || seen.has(code)) {
          return;
        }
        seen.add(code);
        normalized.push(code);
      });

      return normalized.slice(0, 10);
    }

    function resolveFiveSimCountryCandidates(state = {}) {
      let codes = normalizeFiveSimCountryOrder(state?.fiveSimCountryOrder);
      if (!codes.length) {
        const legacyPrimary = normalizeFiveSimCountryCode(state?.fiveSimCountryId, '');
        const legacyFallback = normalizeFiveSimCountryOrder(state?.fiveSimCountryFallback);
        codes = normalizeFiveSimCountryOrder([
          ...(legacyPrimary ? [legacyPrimary] : []),
          ...legacyFallback,
        ]);
      }
      return codes.map((code) => ({
        code,
        id: code,
        label: (
          code === normalizeFiveSimCountryCode(state?.fiveSimCountryId, '')
            ? normalizeCountryLabel(state?.fiveSimCountryLabel, code)
            : code
        ),
      }));
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

    function normalizePhoneActivationRetryRounds(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_ACTIVATION_RETRY_ROUNDS;
      }
      return Math.max(PHONE_ACTIVATION_RETRY_ROUNDS_MIN, Math.min(PHONE_ACTIVATION_RETRY_ROUNDS_MAX, parsed));
    }

    function normalizePhoneActivationRetryDelayMs(value) {
      const parsed = Math.floor(Number(value));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_PHONE_ACTIVATION_RETRY_DELAY_MS;
      }
      return Math.max(500, Math.min(30000, parsed));
    }

    function assertFiveSimMaxPriceCompatibleWithOperator(operator, maxPriceLimit) {
      const normalizedOperator = normalizeFiveSimCountryCode(operator, DEFAULT_FIVE_SIM_OPERATOR);
      if (maxPriceLimit !== null && maxPriceLimit !== undefined && normalizedOperator !== DEFAULT_FIVE_SIM_OPERATOR) {
        throw new Error('5sim price cap is only supported when operator is "any". Please clear the price cap or switch operator to any first.');
      }
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

    function resolvePhonePriceRange(state = {}, provider = DEFAULT_PHONE_SMS_PROVIDER) {
      const normalizedProvider = normalizePhoneSmsProvider(provider);
      const minPriceLimit = normalizedProvider === PHONE_SMS_PROVIDER_5SIM
        ? normalizeHeroSmsPriceLimit(state?.fiveSimMinPrice)
        : normalizeHeroSmsPriceLimit(state?.heroSmsMinPrice);
      const maxPriceLimit = normalizedProvider === PHONE_SMS_PROVIDER_5SIM
        ? normalizeHeroSmsPriceLimit(state?.fiveSimMaxPrice)
        : normalizeHeroSmsPriceLimit(state?.heroSmsMaxPrice);
      return {
        provider: normalizedProvider,
        minPriceLimit,
        maxPriceLimit,
        hasMinPriceLimit: minPriceLimit !== null,
        hasMaxPriceLimit: maxPriceLimit !== null,
        invalidRange: minPriceLimit !== null && maxPriceLimit !== null && minPriceLimit > maxPriceLimit,
      };
    }

    function isPriceWithinRange(price, minPriceLimit = null, maxPriceLimit = null) {
      const numeric = Number(price);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return false;
      }
      const normalized = Math.round(numeric * 10000) / 10000;
      if (minPriceLimit !== null && normalized < minPriceLimit) {
        return false;
      }
      if (maxPriceLimit !== null && normalized > maxPriceLimit) {
        return false;
      }
      return true;
    }

    function filterPriceCandidatesWithinRange(prices = [], minPriceLimit = null, maxPriceLimit = null) {
      return (Array.isArray(prices) ? prices : []).filter((price) => (
        isPriceWithinRange(price, minPriceLimit, maxPriceLimit)
      ));
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
        return normalized.slice(0, 3);
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

      return fallbackNormalized.slice(0, 3);
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
      return [currentProvider, ...withoutCurrent].slice(0, 3);
    }

    function reorderPriceCandidates(prices = [], acquirePriority = HERO_SMS_ACQUIRE_PRIORITY_COUNTRY, preferredPrice = null) {
      const hasNullTier = Array.isArray(prices)
        && prices.some((value) => value === null || value === undefined || String(value).trim() === '');
      const normalized = Array.from(
        new Set(
          (Array.isArray(prices) ? prices : [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
            .map((value) => Math.round(value * 10000) / 10000)
        )
      ).sort((left, right) => left - right);
      const ordered = acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH
        ? normalized.reverse()
        : normalized;
      const preferred = Number(preferredPrice);
      if (!Number.isFinite(preferred) || preferred <= 0) {
        if (ordered.length) {
          return ordered;
        }
        return hasNullTier ? [null] : [];
      }
      const normalizedPreferred = Math.round(preferred * 10000) / 10000;
      const withoutPreferred = ordered.filter((value) => value !== normalizedPreferred);
      return [normalizedPreferred, ...withoutPreferred];
    }

    function filterPriceCandidatesAboveFloor(prices = [], minExclusivePrice = null) {
      const floor = normalizeHeroSmsPrice(minExclusivePrice);
      if (floor === null || floor <= 0) {
        return Array.isArray(prices) ? [...prices] : [];
      }
      return (Array.isArray(prices) ? prices : []).filter((value) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
          return false;
        }
        const normalized = Math.round(numeric * 10000) / 10000;
        return normalized > floor;
      });
    }

    function shouldUseHeroSmsExpandedPriceLookup(state = {}) {
      if (typeof state?.heroSmsUseExpandedPriceLookup === 'boolean') {
        return state.heroSmsUseExpandedPriceLookup;
      }
      const runningInNode = (
        typeof process !== 'undefined'
        && process
        && process.versions
        && process.versions.node
      );
      // Runtime default: enabled in extension/browser; tests in Node can opt-in explicitly.
      return !runningInNode;
    }

    async function fetchHeroSmsPricePayloads(config, countryConfig, options = {}) {
      const payloads = [];
      const errors = [];
      const actions = Array.isArray(options.actions) && options.actions.length
        ? options.actions
        : (
          shouldUseHeroSmsExpandedPriceLookup(options.state || {})
            ? ['getPricesExtended', 'getPrices']
            : ['getPrices']
        );

      for (const action of actions) {
        try {
          const query = {
            action,
            service: HERO_SMS_SERVICE_CODE,
            country: countryConfig.id,
          };
          if (action === 'getPricesExtended') {
            query.freePrice = 'true';
          }
          const payload = await fetchHeroSmsPayload(config, query, `HeroSMS ${action}`);
          payloads.push(payload);
        } catch (error) {
          errors.push({
            action,
            message: describeHeroSmsPayload(error?.payload || error?.message || ''),
          });
        }
      }

      return {
        payloads,
        errors,
      };
    }

    function collectHeroSmsPriceCandidatesIncludingZeroStock(payload, candidates = []) {
      if (Array.isArray(payload)) {
        payload.forEach((entry) => collectHeroSmsPriceCandidatesIncludingZeroStock(entry, candidates));
        return candidates;
      }
      if (!payload || typeof payload !== 'object') {
        return candidates;
      }

      const cost = normalizeHeroSmsPrice(payload.cost);
      if (cost !== null) {
        candidates.push(cost);
      }

      Object.entries(payload).forEach(([key]) => {
        const keyedPrice = normalizeHeroSmsPrice(key);
        if (keyedPrice !== null) {
          const value = payload[key];
          if (value && typeof value === 'object') {
            const stockState = resolveHeroSmsStockState(value);
            if (stockState.hasStockField) {
              candidates.push(keyedPrice);
            }
            return;
          }
          const numericCount = Number(value);
          if (Number.isFinite(numericCount)) {
            candidates.push(keyedPrice);
          }
        }
      });

      Object.values(payload).forEach((value) => collectHeroSmsPriceCandidatesIncludingZeroStock(value, candidates));
      return candidates;
    }

    async function resolveHeroSmsPricePlanFromPricePayloads(config, countryConfig, state = {}, payloads = []) {
      const userLimit = normalizeHeroSmsPriceLimit(state.heroSmsMaxPrice);
      const inStockCandidates = buildSortedUniquePriceCandidates(
        (Array.isArray(payloads) ? payloads : [])
          .flatMap((payload) => collectHeroSmsPriceCandidates(payload, []))
      );
      const allCatalogCandidates = buildSortedUniquePriceCandidates(
        (Array.isArray(payloads) ? payloads : [])
          .flatMap((payload) => collectHeroSmsPriceCandidatesIncludingZeroStock(payload, []))
      );
      const mergedCandidates = inStockCandidates.length
        ? buildSortedUniquePriceCandidates([
          ...inStockCandidates,
          ...allCatalogCandidates,
        ])
        : [];
      const minCatalogPrice = allCatalogCandidates.length
        ? allCatalogCandidates[0]
        : (mergedCandidates.length ? mergedCandidates[0] : null);

      if (userLimit !== null) {
        const bounded = mergedCandidates.filter((price) => price <= userLimit);
        if (bounded.length > 0) {
          const boundedPlan = {
            prices: bounded,
            userLimit,
            minCatalogPrice,
            syntheticUserLimitProbe: false,
          };
          await persistHeroSmsPricePlanSnapshot(countryConfig, boundedPlan);
          return boundedPlan;
        }
        const userLimitedPlan = {
          prices: [userLimit],
          userLimit,
          minCatalogPrice,
          syntheticUserLimitProbe: true,
        };
        await persistHeroSmsPricePlanSnapshot(countryConfig, userLimitedPlan);
        return userLimitedPlan;
      }

      if (mergedCandidates.length > 0) {
        const plan = {
          prices: mergedCandidates,
          userLimit: null,
          minCatalogPrice,
          syntheticUserLimitProbe: false,
        };
        await persistHeroSmsPricePlanSnapshot(countryConfig, plan);
        return plan;
      }
      const fallbackPlan = {
        prices: [null],
        userLimit: null,
        minCatalogPrice: null,
        syntheticUserLimitProbe: false,
      };
      await persistHeroSmsPricePlanSnapshot(countryConfig, fallbackPlan);
      return fallbackPlan;
    }

    function normalizeCountryPriceFloorMap(rawMap = {}, normalizeCountryKey) {
      const normalizedMap = new Map();
      if (!rawMap || typeof rawMap !== 'object') {
        return normalizedMap;
      }
      Object.entries(rawMap).forEach(([rawCountryKey, rawPrice]) => {
        const countryKey = String(
          typeof normalizeCountryKey === 'function'
            ? normalizeCountryKey(rawCountryKey)
            : rawCountryKey
        ).trim();
        if (!countryKey) {
          return;
        }
        const normalizedPrice = normalizeHeroSmsPrice(rawPrice);
        if (normalizedPrice === null || normalizedPrice <= 0) {
          return;
        }
        normalizedMap.set(countryKey, Math.round(normalizedPrice * 10000) / 10000);
      });
      return normalizedMap;
    }

    function getActivationProviderId(activation = {}, state = {}) {
      return normalizePhoneSmsProvider(activation?.provider || state?.phoneSmsProvider);
    }

    function getPhoneSmsProviderLabel(providerId) {
      const provider = normalizePhoneSmsProvider(providerId);
      if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
        return '5sim';
      }
      if (provider === PHONE_SMS_PROVIDER_NEXSMS) {
        return 'NexSMS';
      }
      return 'HeroSMS';
    }

    function formatStep9Reason(reason = '') {
      const text = String(reason || '').trim();
      if (!text) {
        return 'Unknown';
      }
      const normalized = text.toLowerCase();
      const reasonMap = {
        returned_to_add_phone_loop: 'Repeatedly returned to add phone page',
        phone_number_used: 'Phone number already used',
        sms_not_received: 'SMS not received',
        sms_timeout: 'SMS timeout',
        resend_throttled: 'SMS resend throttled',
        code_rejected: 'Verification code rejected',
        add_phone_rejected: 'Add phone rejected',
        activation_not_found: 'SMS order does not exist or expired',
        resend_phone_banned: 'OpenAI cannot send SMS to this number',
        phone_max_usage_exceeded: 'Phone number reached usage limit',
        resend_server_error: 'Entered server error page after SMS resend',
        whatsapp_resend_channel: 'Page resend entry switched to WhatsApp channel',
        unknown: 'Unknown',
      };
      if (reasonMap[normalized]) {
        return reasonMap[normalized];
      }
      const timeoutWindowMatch = text.match(/^sms_timeout_after_(\d+)_windows$/i);
      if (timeoutWindowMatch) {
        return `Still no SMS received after ${timeoutWindowMatch[1]} wait rounds`;
      }
      return text;
    }

    function formatPhoneSmsApiFailureReason(reason = '') {
      const text = String(reason || '').trim();
      if (!text) {
        return 'Unknown error';
      }
      if (/\bBAD_KEY\b|\bWRONG_KEY\b|\bINVALID_KEY\b/i.test(text)) {
        return 'Invalid API Key (BAD_KEY)';
      }
      if (/\bNO_BALANCE\b|\bNOT_ENOUGH_BALANCE\b/i.test(text)) {
        return 'Insufficient balance';
      }
      if (/\bBANNED\b|\bACCOUNT_BANNED\b/i.test(text)) {
        return 'Account banned';
      }
      if (/\bNO_NUMBERS\b/i.test(text)) {
        return 'No available numbers (NO_NUMBERS)';
      }
      if (/no\s+free\s+phones|numbers?\s+not\s+found|no\s+numbers\s+available|no\s+numbers\s+within|暂无可用号码|均无可用号码|无可用号码/i.test(text)) {
        return 'No available numbers';
      }
      const wrongMaxPrice = text.match(/\bWRONG_MAX_PRICE(?::|\s+requires\s+)?(\d+(?:\.\d+)?)?\b/i);
      if (wrongMaxPrice) {
        return wrongMaxPrice[1]
          ? `Price cap too low; platform requires at least ${wrongMaxPrice[1]} (WRONG_MAX_PRICE)`
          : 'Price cap does not meet platform requirements (WRONG_MAX_PRICE)';
      }
      if (/rate\s*limit|too\s+many\s+requests|限流/i.test(text)) {
        return 'Request throttled';
      }
      if (/unauthorized|forbidden|invalid\s+token|bad\s+key|wrong\s+key/i.test(text)) {
        return 'Invalid API Key';
      }
      if (/order\s+not\s+found|activation\s+not\s+found|no\s+such\s+order/i.test(text)) {
        return 'Order does not exist or expired';
      }
      if (/timed\s*out|timeout/i.test(text)) {
        return 'Request timed out';
      }
      if (/failed\s+to\s+fetch|networkerror|load\s+failed/i.test(text)) {
        return 'Network request failed';
      }
      if (/empty\s+response/i.test(text)) {
        return 'Empty response';
      }
      if (/unknown\s+terminal\s+error/i.test(text)) {
        return 'Unknown termination error';
      }
      return text;
    }

    function formatHeroSmsActionName(action = '') {
      const normalized = String(action || '').trim().toLowerCase();
      if (normalized === 'getnumber' || normalized === 'getnumberv2') {
        return 'Acquire phone number';
      }
      if (normalized === 'getstatus' || normalized === 'getstatusv2') {
        return 'Query SMS status';
      }
      if (normalized === 'setstatus') {
        return 'Update order status';
      }
      if (normalized === 'getprices' || normalized === 'getpricesextended') {
        return 'Query price';
      }
      return action ? `${action} request` : 'request';
    }

    function formatPhoneSmsActionLabel(actionLabel = '') {
      const text = String(actionLabel || '').trim();
      if (!text) {
        return 'SMS platform request';
      }
      const normalized = text.toLowerCase();
      const heroMatch = text.match(/^HeroSMS\s+(.+)$/i);
      if (heroMatch) {
        return `HeroSMS ${formatHeroSmsActionName(heroMatch[1])}`;
      }
      if (normalized === '5sim guest prices') {
        return '5sim query guest price';
      }
      if (normalized === '5sim user prices') {
        return '5sim query account price';
      }
      if (normalized === '5sim buy activation') {
        return '5sim purchase phone number';
      }
      if (normalized === '5sim check activation') {
        return '5sim query SMS status';
      }
      if (normalized === '5sim reuse activation') {
        return '5sim reuse phone number';
      }
      if (normalized === 'nexsms getcountrybyservice') {
        return 'NexSMS query service countries';
      }
      if (normalized === 'nexsms price lookup') {
        return 'NexSMS query price';
      }
      if (normalized === 'nexsms purchase') {
        return 'NexSMS purchase phone number';
      }
      if (normalized === 'nexsms close activation') {
        return 'NexSMS close order';
      }
      if (normalized === 'nexsms get sms messages') {
        return 'NexSMS query SMS';
      }
      return text;
    }

    function createPhoneSmsActionFailureError(actionLabel, reason = '', payload = null, status = 0) {
      const message = `${formatPhoneSmsActionLabel(actionLabel)} failed: ${formatPhoneSmsApiFailureReason(reason || status)}`;
      const error = new Error(message);
      if (payload !== null && payload !== undefined) {
        error.payload = payload;
      }
      if (status) {
        error.status = status;
      }
      return error;
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

    function createHeroSmsActionFailureError(action, reason = '') {
      const normalizedReason = stripRepeatedHeroSmsFailurePrefix(action, describeHeroSmsPayload(reason));
      const error = new Error(`HeroSMS ${formatHeroSmsActionName(action)} failed: ${formatPhoneSmsApiFailureReason(normalizedReason)}`);
      error.localizedPhoneSmsFailure = true;
      return error;
    }

    function formatProviderAcquireFailure(providerId, message = '') {
      const providerLabel = getPhoneSmsProviderLabel(providerId);
      let text = String(message || '').trim();
      if (!text) {
        return 'Unknown error';
      }
      text = text.replace(/^Step\s+\d+\s*[:：]\s*/i, '').trim();
      const heroFailureMatch = text.match(/^HeroSMS\s+([A-Za-z0-9]+)\s+failed\s*:\s*(.+)$/i);
      if (heroFailureMatch) {
        return `${formatHeroSmsActionName(heroFailureMatch[1])} failed: ${formatPhoneSmsApiFailureReason(stripRepeatedHeroSmsFailurePrefix(heroFailureMatch[1], heroFailureMatch[2]))}`;
      }
      if (normalizePhoneSmsProvider(providerId) === PHONE_SMS_PROVIDER_HERO && /^HeroSMS\s+.+(?:failed|失败)[:：]/.test(text)) {
        return text.replace(/^HeroSMS\s+/, '').trim();
      }
      if (/countries\s+are\s+empty|未选择国家/i.test(text)) {
        return 'No country selected. Please select at least 1 country in SMS settings.';
      }
      if (/failed\s+to\s+acquire\s+(?:a\s+)?phone(?:\s+number|\s+activation)?/i.test(text)) {
        return 'Failed to acquire phone number';
      }
      if (/no\s+numbers\s+available\s+across|no\s+free\s+phones|numbers?\s+not\s+found|no\s+numbers\s+within|暂无可用号码|均无可用号码|无可用号码|\bNO_NUMBERS\b/i.test(text)) {
        return formatPhoneSmsApiFailureReason(text);
      }
      if (/buy activation failed|purchase failed|price lookup failed|check activation failed/i.test(text)) {
        return text
          .replace(/^5sim\s+buy activation failed\s*:\s*/i, 'Purchase phone number failed: ')
          .replace(/^5sim\s+check activation failed\s*:\s*/i, 'Query SMS status failed: ')
          .replace(/^NexSMS\s+purchase failed\s*:\s*/i, 'Purchase phone number failed: ')
          .replace(/^NexSMS\s+price lookup failed\s*:\s*/i, 'Query price failed: ');
      }
      if (providerLabel && text.startsWith(`${providerLabel}: `)) {
        return text.slice(providerLabel.length + 2).trim() || text;
      }
      return text;
    }

    function isPhoneSmsReuseEnabled(state = {}) {
      if (isPhoneSignupIdentityState(state)) {
        return false;
      }
      return normalizePhoneSmsReuseEnabled(state);
    }

    function createResolvedFiveSimProvider() {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      const factory = createFiveSimProvider || rootScope.PhoneSmsFiveSimProvider?.createProvider;
      if (typeof factory !== 'function') {
        return null;
      }
      return factory({
        addLog,
        fetchImpl,
        requestTimeoutMs: DEFAULT_PHONE_REQUEST_TIMEOUT_MS,
        sleepWithStop,
        throwIfStopped,
      });
    }

    function getFiveSimProviderForState(_state = {}) {
      return createResolvedFiveSimProvider();
    }

    function normalizeFiveSimCountryId(value, fallback = 'england') {
      const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
      return normalized || fallback;
    }

    function normalizeFiveSimCountryLabel(value = '', fallback = 'England') {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryLabel) {
        return rootScope.PhoneSmsFiveSimProvider.normalizeFiveSimCountryLabel(value, fallback);
      }
      if (rootScope.PhoneSmsFiveSimProvider?.formatFiveSimCountryLabel) {
        return rootScope.PhoneSmsFiveSimProvider.formatFiveSimCountryLabel('', value, fallback);
      }
      return String(value || '').trim() || fallback;
    }

    function normalizeFiveSimCountryFallbackList(value = []) {
      const rootScope = typeof self !== 'undefined' ? self : globalThis;
      if (rootScope.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryFallback) {
        return rootScope.PhoneSmsFiveSimProvider.normalizeFiveSimCountryFallback(value);
      }
      const source = Array.isArray(value)
        ? value
        : String(value || '')
          .split(/[\r\n,，;；]+/)
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      const seen = new Set();
      const normalized = [];
      for (const entry of source) {
        let id = '';
        let label = '';
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          id = normalizeFiveSimCountryId(entry.id ?? entry.countryId ?? entry.slug, '');
          label = String((entry.label ?? entry.countryLabel ?? entry.name ?? entry.text_en) || '').trim();
        } else {
          const text = String(entry || '').trim();
          const structured = text.match(/^([a-z0-9_-]+)\s*(?:[:|/-]\s*(.+))?$/i);
          id = normalizeFiveSimCountryId(structured?.[1] || text, '');
          label = String(structured?.[2] || '').trim();
        }
        if (!id || seen.has(id)) continue;
        seen.add(id);
        normalized.push({ id, label: label || normalizeFiveSimCountryLabel('', id) });
      }
      return normalized;
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
      const rawProvider = String(record.provider || '').trim();
      const provider = normalizePhoneSmsProvider(rawProvider);
      const rawCountryId = record.countryId ?? record.country;
      const fallbackCountryId = provider === PHONE_SMS_PROVIDER_FIVE_SIM ? 'england' : HERO_SMS_COUNTRY_ID;
      const expiresAt = normalizeTimestampMs(record.expiresAt);
      const serviceCode = String(
        record.serviceCode
        || (
          provider === PHONE_SMS_PROVIDER_FIVE_SIM
            ? DEFAULT_FIVE_SIM_PRODUCT
            : (provider === PHONE_SMS_PROVIDER_NEXSMS ? DEFAULT_NEX_SMS_SERVICE_CODE : HERO_SMS_SERVICE_CODE)
        )
      ).trim();
      const countryId = provider === PHONE_SMS_PROVIDER_FIVE_SIM
        ? normalizeFiveSimCountryId(record.countryCode ?? rawCountryId, fallbackCountryId)
        : (
          provider === PHONE_SMS_PROVIDER_NEXSMS
            ? normalizeNexSmsCountryId(rawCountryId, 0)
            : normalizeCountryId(rawCountryId, fallbackCountryId)
        );
      const ignoredPhoneCodeKeys = normalizeStringList(record.ignoredPhoneCodeKeys);
      return {
        activationId,
        phoneNumber,
        provider,
        serviceCode,
        countryId,
        ...(provider === PHONE_SMS_PROVIDER_FIVE_SIM ? { countryCode: countryId } : {}),
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

    function normalizeActivationFallback(record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return null;
      }

      const fallback = {};
      const rawProvider = String(record.provider || '').trim();
      const provider = rawProvider ? normalizePhoneSmsProvider(rawProvider) : '';
      const serviceCode = String(record.serviceCode || '').trim();
      const rawCountryId = record.countryId ?? record.country;
      const countryId = provider === PHONE_SMS_PROVIDER_FIVE_SIM
        ? normalizeFiveSimCountryId(rawCountryId, '')
        : Math.floor(Number(rawCountryId));
      const countryLabel = String(record.countryLabel || '').trim();
      const statusAction = String(record.statusAction || '').trim();

      if (provider) {
        fallback.provider = provider;
      }
      if (serviceCode) {
        fallback.serviceCode = serviceCode;
      }
      if (provider === PHONE_SMS_PROVIDER_FIVE_SIM) {
        if (countryId) {
          fallback.countryId = countryId;
        }
      } else if (Number.isFinite(countryId) && countryId > 0) {
        fallback.countryId = countryId;
        if (provider === PHONE_SMS_PROVIDER_5SIM) {
          fallback.countryCode = countryId;
        }
      }
      if (countryLabel) {
        fallback.countryLabel = countryLabel;
      }
      if (Object.prototype.hasOwnProperty.call(record, 'successfulUses')) {
        fallback.successfulUses = normalizeUseCount(record.successfulUses);
      }
      if (Object.prototype.hasOwnProperty.call(record, 'maxUses')) {
        fallback.maxUses = Math.max(1, Math.floor(Number(record.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES));
      }
      if (statusAction) {
        fallback.statusAction = statusAction;
      }

      return Object.keys(fallback).length ? fallback : null;
    }

    function describeHeroSmsPayload(raw) {
      if (typeof raw === 'string') {
        return raw.trim();
      }
      if (raw && typeof raw === 'object') {
        if (raw.title || raw.details) {
          const title = String(raw.title || '').trim();
          const details = String(raw.details || '').trim();
          return details ? `${title}: ${details}` : title;
        }
        if (raw.status === 'false' && raw.msg) {
          return String(raw.msg).trim();
        }
        try {
          return JSON.stringify(raw);
        } catch {
          return String(raw);
        }
      }
      return String(raw || '').trim();
    }

    function parseHeroSmsPayload(text) {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        return '';
      }
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }

    function buildHeroSmsUrl(baseUrl, query = {}) {
      const url = new URL(normalizeUrl(baseUrl));
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }
        url.searchParams.set(key, String(value));
      });
      return url.toString();
    }

    function buildPhoneCodeTimeoutError(lastResponse = '') {
      const suffix = lastResponse ? ` HeroSMS last status: ${lastResponse}` : '';
      return new Error(`${PHONE_CODE_TIMEOUT_ERROR_PREFIX}Phone verification code wait timed out.${suffix}`);
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
      const message = `Step 4: OpenAI switched to email verification before the phone SMS code was submitted${url ? ` (URL: ${url})` : ''}. This usually means the current phone number is associated with an existing account or login path; please replace the phone number and start the signup over.`;
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
      return new Error(`${PHONE_RESEND_SERVER_ERROR_PREFIX}${message || 'OpenAI contact-verification page returned HTTP ERROR 500 after SMS resend.'}`);
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
        return isPhoneResendServerError(titleText) ? (titleText || 'OpenAI contact-verification page returned HTTP ERROR 500 after SMS resend.') : '';
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
      return combined || 'OpenAI contact-verification page returned HTTP ERROR 500 after SMS resend.';
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
      return new Error(`${PHONE_RESEND_THROTTLED_ERROR_PREFIX}${message || 'OpenAI SMS resend was throttled, and current config treats this as high-probability number ban.'}`);
    }

    function buildPhoneMaxUsageExceededError(message = '') {
      return new Error(`PHONE_MAX_USAGE_EXCEEDED::${message || 'OpenAI returned phone_max_usage_exceeded. Current phone has reached usage limit.'}`);
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
      return message === 'Flow stopped by user.'
        || /Stopped by user/.test(message)
        || /flow\s+was\s+stopped|stopped\s+by\s+user/i.test(message);
    }

    function isAuthContentScriptUnreachableError(error) {
      const message = String(error?.message || error || '').trim();
      return /Receiving end does not exist|Could not establish connection|Frame with ID \d+ is showing error page|等待认证页状态检查超时/i.test(message);
    }

    function buildPhoneRestartStep7Error(phoneNumber = '') {
      const suffix = phoneNumber ? ` Current number: ${phoneNumber}.` : '';
      return new Error(
        `${PHONE_RESTART_STEP7_ERROR_PREFIX}SMS not received after phone verification resend. Please get a new number from Step 7.${suffix}`
      );
    }

    function buildPhoneReplacementLimitError(maxNumberReplacementAttempts, reason = '') {
      const safeMax = Math.max(0, Math.floor(Number(maxNumberReplacementAttempts) || 0));
      const safeReason = String(reason || 'unknown').trim() || 'unknown';
      return new Error(
        `Step 9: Phone verification still failed after replacing the number ${safeMax} times. Last reason: ${formatStep9Reason(safeReason)}.`
      );
    }

    function sanitizePhoneCodeTimeoutError(error) {
      const message = String(error?.message || '');
      if (!message.startsWith(PHONE_CODE_TIMEOUT_ERROR_PREFIX)) {
        return error;
      }
      return new Error(message.slice(PHONE_CODE_TIMEOUT_ERROR_PREFIX.length).trim() || 'Phone verification code wait timed out.');
    }

    function sanitizePhoneRestartStep7Error(error) {
      const message = String(error?.message || '');
      if (!message.startsWith(PHONE_RESTART_STEP7_ERROR_PREFIX)) {
        return error;
      }
      return new Error(
        message.slice(PHONE_RESTART_STEP7_ERROR_PREFIX.length).trim()
        || 'SMS not received after phone verification resend. Please get a new number from Step 7.'
      );
    }

    async function fetchHeroSmsPayload(config, query, actionLabel) {
      const requestUrl = buildHeroSmsUrl(config.baseUrl, {
        api_key: config.apiKey,
        ...query,
      });
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), DEFAULT_PHONE_REQUEST_TIMEOUT_MS)
        : null;

      try {
        const response = await fetchImpl(requestUrl, {
          method: 'GET',
          signal: controller?.signal,
        });
        const text = await response.text();
        const payload = parseHeroSmsPayload(text);
        if (!response.ok) {
          throw createPhoneSmsActionFailureError(
            actionLabel,
            describeHeroSmsPayload(payload) || response.status,
            payload,
            response.status
          );
        }
        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error(`${formatPhoneSmsActionLabel(actionLabel)} timed out.`);
        }
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    function parseFiveSimPayload(text) {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        return '';
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    function describeFiveSimPayload(raw) {
      if (typeof raw === 'string') {
        return raw.trim();
      }
      if (raw && typeof raw === 'object') {
        const message = String(raw.message || raw.error || raw.msg || raw.statusText || '').trim();
        if (message) {
          return message;
        }
        try {
          return JSON.stringify(raw);
        } catch {
          return String(raw);
        }
      }
      return String(raw || '').trim();
    }

    async function fetchFiveSimPayload(config, path, actionLabel, options = {}) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), DEFAULT_PHONE_REQUEST_TIMEOUT_MS)
        : null;

      try {
        const requestUrl = new URL(path.replace(/^\/+/, ''), `${config.baseUrl.replace(/\/+$/, '')}/`);
        const query = (options && options.query && typeof options.query === 'object') ? options.query : {};
        Object.entries(query).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') {
            return;
          }
          requestUrl.searchParams.set(key, String(value));
        });

        const response = await fetchImpl(requestUrl.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          signal: controller?.signal,
        });
        const text = await response.text();
        const payload = parseFiveSimPayload(text);
        if (!response.ok) {
          throw createPhoneSmsActionFailureError(
            actionLabel,
            describeFiveSimPayload(payload) || response.status,
            payload,
            response.status
          );
        }
        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error(`${formatPhoneSmsActionLabel(actionLabel)} timed out.`);
        }
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    function parseNexSmsPayload(text) {
      const trimmed = String(text || '').trim();
      if (!trimmed) {
        return '';
      }
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    }

    function describeNexSmsPayload(raw) {
      if (typeof raw === 'string') {
        return raw.trim();
      }
      if (raw && typeof raw === 'object') {
        const message = String(raw.message || raw.error || raw.msg || raw.statusText || '').trim();
        if (message) {
          return message;
        }
        try {
          return JSON.stringify(raw);
        } catch {
          return String(raw);
        }
      }
      return String(raw || '').trim();
    }

    function isNexSmsSuccessPayload(payload) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return false;
      }
      return Number(payload.code) === 0;
    }

    async function fetchNexSmsPayload(config, path, actionLabel, options = {}) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller
        ? setTimeout(() => controller.abort(), DEFAULT_PHONE_REQUEST_TIMEOUT_MS)
        : null;

      try {
        const method = String(options.method || 'GET').trim().toUpperCase() || 'GET';
        const requestUrl = new URL(path.replace(/^\/+/, ''), `${config.baseUrl.replace(/\/+$/, '')}/`);
        requestUrl.searchParams.set('apiKey', config.apiKey);
        const query = (options && options.query && typeof options.query === 'object') ? options.query : {};
        Object.entries(query).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') {
            return;
          }
          requestUrl.searchParams.set(key, String(value));
        });
        const headers = {
          Accept: 'application/json',
          ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
        };
        const requestInit = {
          method,
          headers,
          signal: controller?.signal,
        };
        if (method !== 'GET' && method !== 'HEAD' && options.body !== undefined) {
          requestInit.body = typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body);
          if (!requestInit.headers['Content-Type']) {
            requestInit.headers['Content-Type'] = 'application/json';
          }
        }
        const response = await fetchImpl(requestUrl.toString(), requestInit);
        const text = await response.text();
        const payload = parseNexSmsPayload(text);
        if (!response.ok) {
          throw createPhoneSmsActionFailureError(
            actionLabel,
            describeNexSmsPayload(payload) || response.status,
            payload,
            response.status
          );
        }
        return payload;
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error(`${formatPhoneSmsActionLabel(actionLabel)} timed out.`);
        }
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    }

    function resolvePhoneConfig(state = {}) {
      const provider = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      if (provider === PHONE_SMS_PROVIDER_5SIM) {
        const apiKey = normalizeApiKey(state.fiveSimApiKey || state.heroSmsApiKey);
        if (!apiKey) {
          throw new Error('5sim API Key missing. Please save SMS API Key in the side panel first.');
        }
        const configuredMaxPrice = normalizeHeroSmsPriceLimit(state.fiveSimMaxPrice);
        const operator = normalizeFiveSimCountryCode(state.fiveSimOperator, DEFAULT_FIVE_SIM_OPERATOR);
        const maxPriceLimit = configuredMaxPrice !== null
          ? configuredMaxPrice
          : normalizeHeroSmsPriceLimit(state.heroSmsMaxPrice);
        assertFiveSimMaxPriceCompatibleWithOperator(operator, maxPriceLimit);
        return {
          provider,
          apiKey,
          baseUrl: normalizeUrl(state.fiveSimBaseUrl, DEFAULT_FIVE_SIM_BASE_URL).replace(/\/+$/, ''),
          operator,
          product: normalizeFiveSimCountryCode(state.fiveSimProduct, DEFAULT_FIVE_SIM_PRODUCT),
          maxPriceLimit,
          countryCandidates: resolveFiveSimCountryCandidates(state),
        };
      }

      if (provider === PHONE_SMS_PROVIDER_NEXSMS) {
        const apiKey = normalizeApiKey(state.nexSmsApiKey || state.heroSmsApiKey);
        if (!apiKey) {
          throw new Error('NexSMS API Key missing. Please save SMS API Key in the side panel first.');
        }
        return {
          provider,
          apiKey,
          baseUrl: normalizeUrl(state.nexSmsBaseUrl, DEFAULT_NEX_SMS_BASE_URL).replace(/\/+$/, ''),
          serviceCode: normalizeNexSmsServiceCode(state.nexSmsServiceCode, DEFAULT_NEX_SMS_SERVICE_CODE),
          countryCandidates: resolveNexSmsCountryCandidates(state),
        };
      }

      const apiKey = normalizeApiKey(state.heroSmsApiKey);
      if (!apiKey) {
        throw new Error('HeroSMS API Key missing. Please save SMS API Key in the side panel first.');
      }
      return {
        provider,
        apiKey,
        baseUrl: normalizeUrl(state.heroSmsBaseUrl, DEFAULT_HERO_SMS_BASE_URL),
        countryCandidates: resolveCountryCandidates(state),
      };
    }

    function resolveHeroSmsPhoneConfig(state = {}) {
      const apiKey = normalizeApiKey(state.heroSmsApiKey);
      if (!apiKey) {
        throw new Error('HeroSMS API Key missing. Please save SMS API Key in the side panel first.');
      }
      return {
        provider: PHONE_SMS_PROVIDER_HERO,
        apiKey,
        baseUrl: normalizeUrl(state.heroSmsBaseUrl, DEFAULT_HERO_SMS_BASE_URL),
        countryCandidates: resolveCountryCandidates(state),
      };
    }

    function parseActivationPayload(payload, fallback = null) {
      const normalizedFallback = normalizeActivation(fallback) || normalizeActivationFallback(fallback);
      const directActivation = normalizeActivation(payload);
      if (directActivation) {
        const statusAction = normalizedFallback?.statusAction || directActivation.statusAction;
          return {
            ...directActivation,
            provider: normalizedFallback?.provider || directActivation.provider,
            serviceCode: normalizedFallback?.serviceCode || directActivation.serviceCode,
            countryId: normalizedFallback?.countryId || directActivation.countryId,
            ...(
              normalizedFallback?.countryLabel || directActivation.countryLabel
                ? { countryLabel: normalizedFallback?.countryLabel || directActivation.countryLabel }
                : {}
            ),
            successfulUses: normalizedFallback?.successfulUses ?? directActivation.successfulUses,
            maxUses: normalizedFallback?.maxUses ?? directActivation.maxUses,
            ...(statusAction ? { statusAction } : {}),
          };
        }

      const text = describeHeroSmsPayload(payload);
      const accessNumberMatch = text.match(/^ACCESS_NUMBER:([^:]+):(.+)$/i);
      if (accessNumberMatch) {
          return {
            activationId: String(accessNumberMatch[1] || '').trim(),
            phoneNumber: String(accessNumberMatch[2] || '').trim(),
            provider: normalizedFallback?.provider || PHONE_SMS_PROVIDER_HERO,
            serviceCode: normalizedFallback?.serviceCode || HERO_SMS_SERVICE_CODE,
            countryId: normalizedFallback?.countryId || HERO_SMS_COUNTRY_ID,
            ...(normalizedFallback?.countryLabel ? { countryLabel: normalizedFallback.countryLabel } : {}),
            successfulUses: normalizedFallback?.successfulUses ?? 0,
            maxUses: normalizedFallback?.maxUses ?? DEFAULT_PHONE_NUMBER_MAX_USES,
            ...(normalizedFallback?.statusAction ? { statusAction: normalizedFallback.statusAction } : {}),
          };
        }

      if (/^ACCESS_READY$/i.test(text) && normalizedFallback) {
        return normalizedFallback;
      }

      return null;
    }

    function resolveActivationStatusAction(activation) {
      return activation?.statusAction === 'getStatusV2' ? 'getStatusV2' : 'getStatus';
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

    function resolveHeroSmsStockState(payload = {}) {
      const physicalCount = Number(payload.physicalCount);
      if (Number.isFinite(physicalCount)) {
        return {
          hasStockField: true,
          stockCount: physicalCount,
        };
      }
      const stockCandidates = [
        payload.count,
        payload.stock,
        payload.available,
        payload.quantity,
        payload.qty,
        payload.left,
        payload.free,
      ]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      if (!stockCandidates.length) {
        return {
          hasStockField: false,
          stockCount: 0,
        };
      }
      return {
        hasStockField: true,
        stockCount: Math.max(...stockCandidates),
      };
    }

    function collectHeroSmsPriceCandidates(payload, candidates = []) {
      if (Array.isArray(payload)) {
        payload.forEach((entry) => collectHeroSmsPriceCandidates(entry, candidates));
        return candidates;
      }
      if (!payload || typeof payload !== 'object') {
        return candidates;
      }

      const cost = normalizeHeroSmsPrice(payload.cost);
      if (cost !== null) {
        const stockState = resolveHeroSmsStockState(payload);
        if (!stockState.hasStockField || stockState.stockCount > 0) {
          candidates.push(cost);
        }
      }

      // Some HeroSMS responses expose price tiers as object keys:
      // { "0.05": { count: 0 }, "0.35": { count: 12 } }.
      // Parse those keyed tiers so higher-price stock is not missed.
      Object.entries(payload).forEach(([key, value]) => {
        const keyedPrice = normalizeHeroSmsPrice(key);
        if (keyedPrice === null) {
          return;
        }
        if (value && typeof value === 'object') {
          const stockState = resolveHeroSmsStockState(value);
          // Ignore numeric keys that are actually country/service IDs.
          // Keyed price tiers are considered valid only when stock fields exist.
          if (stockState.hasStockField && stockState.stockCount > 0) {
            candidates.push(keyedPrice);
          }
          return;
        }
        const numericCount = Number(value);
        if (Number.isFinite(numericCount) && numericCount > 0) {
          candidates.push(keyedPrice);
        }
      });

      Object.values(payload).forEach((value) => collectHeroSmsPriceCandidates(value, candidates));
      return candidates;
    }

    function findLowestHeroSmsPrice(payload) {
      const candidates = collectHeroSmsPriceCandidates(payload, []);
      if (!candidates.length) {
        return null;
      }
      return Math.min(...candidates);
    }

    function buildSortedUniquePriceCandidates(values = []) {
      return Array.from(
        new Set(
          values
            .map((value) => normalizeHeroSmsPrice(value))
            .filter((value) => value !== null)
            .map((value) => Math.round(value * 10000) / 10000)
        )
      )
        .sort((left, right) => left - right)
        .slice(0, MAX_PHONE_PRICE_CANDIDATES);
    }

    function isHeroSmsNoNumbersPayload(payload) {
      return /\bNO_NUMBERS\b/i.test(describeHeroSmsPayload(payload));
    }

    function extractHeroSmsWrongMaxPrice(payload) {
      if (payload && typeof payload === 'object') {
        const title = String(payload.title || '').trim();
        const minPrice = normalizeHeroSmsPrice(payload.info?.min);
        if (/^WRONG_MAX_PRICE$/i.test(title) && minPrice !== null) {
          return minPrice;
        }
      }

      const text = describeHeroSmsPayload(payload);
      const match = text.match(/\bWRONG_MAX_PRICE:(\d+(?:\.\d+)?)\b/i);
      if (!match) {
        return null;
      }
      return normalizeHeroSmsPrice(match[1]);
    }

    function isNetworkFetchFailure(error) {
      const message = String(error?.message || '').trim();
      return /failed to fetch|networkerror|load failed/i.test(message);
    }

    function isHeroSmsTerminalError(payloadOrMessage) {
      const text = describeHeroSmsPayload(payloadOrMessage);
      return /\bNO_BALANCE\b|\bNOT_ENOUGH_BALANCE\b|\bBAD_KEY\b|\bINVALID_KEY\b|\bBANNED\b|\bACCOUNT_BANNED\b|\bWRONG_KEY\b/i.test(text);
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
      const heroCountryCount = resolveCountryCandidates(state).length;
      const fiveSimCountryCount = resolveFiveSimCountryCandidates(state).length;
      const nexSmsCountryCount = resolveNexSmsCountryCandidates(state).length;
      const activeProvider = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      const priceRange = resolvePhonePriceRange(state, activeProvider);
      const minPrice = priceRange.minPriceLimit;
      const maxPrice = priceRange.maxPriceLimit;
      const acquirePriority = normalizeHeroSmsAcquirePriority(state?.heroSmsAcquirePriority);
      return {
        order,
        heroCountryCount,
        fiveSimCountryCount,
        nexSmsCountryCount,
        minPrice,
        maxPrice,
        priceRangeInvalid: priceRange.invalidRange,
        priceRangeText: formatPhonePriceRangeText(minPrice, maxPrice),
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
        suggestions.push('Fix the price range first (min purchase price cannot exceed price cap)');
      } else if (hasMinPrice && hasMaxPrice) {
        suggestions.push(`Widen the price range a bit (currently ${context.priceRangeText || `${minPrice}~${maxPrice}`})`);
      } else if (hasMinPrice) {
        suggestions.push(`Consider lowering the min purchase price (currently ${context.priceRangeText || `${minPrice}~`})`);
      } else if (!hasMaxPrice) {
        suggestions.push('Set a price cap first (suggested >= 0.12)');
      } else if (maxPrice < 0.12) {
        suggestions.push('Raise the price cap (currently too low)');
      }

      if ((context?.heroCountryCount || 0) <= 1) {
        suggestions.push('Add country fallbacks for HeroSMS');
      }
      if ((context?.fiveSimCountryCount || 0) <= 0) {
        suggestions.push('Select at least 1 country for 5sim');
      }
      if ((context?.nexSmsCountryCount || 0) <= 0) {
        suggestions.push('Select at least 1 country for NexSMS');
      }
      if (String(context?.acquirePriority || '') === HERO_SMS_ACQUIRE_PRIORITY_COUNTRY) {
        suggestions.push('Try switching to "price-first"');
      }

      const unique = Array.from(new Set(suggestions));
      if (!unique.length) {
        return 'Raise the price cap first, then adjust provider/country priority and retry';
      }
      return unique.slice(0, 3).join('; ');
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
      const minPriceText = context.minPrice === null ? 'not set' : String(context.minPrice);
      const maxPriceText = context.maxPrice === null ? 'not set' : String(context.maxPrice);
      const priceRangeText = context.priceRangeText || formatPhonePriceRangeText(context.minPrice, context.maxPrice);
      const providerOrderText = context.order.join(' > ');
      const suggestion = formatNoSupplySuggestion(context);
      await addLog(
        `Step 9 diagnostics: No-supply failed ${nextStreak} times in a row; price range=${priceRangeText}; min=${minPriceText}; max=${maxPriceText}; provider order=${providerOrderText}; country counts HeroSMS=${context.heroCountryCount}, 5sim=${context.fiveSimCountryCount}, NexSMS=${context.nexSmsCountryCount}. Suggestion: ${suggestion}.`,
        nextStreak >= 2 ? 'warn' : 'info'
      );
      return true;
    }

    async function resolveCheapestPhoneActivationPrice(config, countryConfig) {
      for (let attempt = 1; attempt <= DEFAULT_PHONE_PRICE_LOOKUP_ATTEMPTS; attempt += 1) {
        try {
          const { payloads } = await fetchHeroSmsPricePayloads(config, countryConfig, { state });
          const price = findLowestHeroSmsPrice(
            payloads && payloads.length
              ? payloads
              : []
          );
          const normalizedPrice = Number.isFinite(Number(price)) ? Number(price) : null;
          if (normalizedPrice !== null) {
            return normalizedPrice;
          }
          const fallbackCandidates = buildSortedUniquePriceCandidates(
            (Array.isArray(payloads) ? payloads : [])
              .flatMap((payload) => collectHeroSmsPriceCandidatesIncludingZeroStock(payload, []))
          );
          if (fallbackCandidates.length > 0) {
            return fallbackCandidates[0];
          }
        } catch (_) {
          // Best-effort lookup only.
        }
      }
      return null;
    }

    async function persistHeroSmsPricePlanSnapshot(countryConfig, pricePlan) {
      if (typeof setState !== 'function') {
        return;
      }
      const prices = Array.isArray(pricePlan?.prices)
        ? pricePlan.prices.filter((price) => Number.isFinite(Number(price)))
        : [];
      const userLimit = pricePlan?.userLimit === null || pricePlan?.userLimit === undefined
        ? ''
        : String(pricePlan.userLimit);
      await setState({
        [HERO_SMS_LAST_PRICE_TIERS_KEY]: prices,
        [HERO_SMS_LAST_PRICE_COUNTRY_ID_KEY]: normalizeCountryId(countryConfig?.id, 0),
        [HERO_SMS_LAST_PRICE_COUNTRY_LABEL_KEY]: normalizeCountryLabel(countryConfig?.label, HERO_SMS_COUNTRY_LABEL),
        [HERO_SMS_LAST_PRICE_USER_LIMIT_KEY]: userLimit,
        [HERO_SMS_LAST_PRICE_AT_KEY]: Date.now(),
      });
    }

    async function resolvePhoneActivationPricePlan(config, countryConfig, state = {}) {
      for (let attempt = 1; attempt <= DEFAULT_PHONE_PRICE_LOOKUP_ATTEMPTS; attempt += 1) {
        try {
          const { payloads } = await fetchHeroSmsPricePayloads(config, countryConfig, { state });
          const plan = await resolveHeroSmsPricePlanFromPricePayloads(
            config,
            countryConfig,
            state,
            payloads
          );
          if (
            Array.isArray(plan?.prices)
            && plan.prices.length > 0
            && (
              plan.prices.some((price) => Number.isFinite(Number(price)) && Number(price) > 0)
              || plan.syntheticUserLimitProbe
            )
          ) {
            return plan;
          }
        } catch (_) {
          // best effort
        }
      }

      const fallbackPlan = {
        prices: [null],
        userLimit: null,
        minCatalogPrice: null,
        syntheticUserLimitProbe: false,
      };
      await persistHeroSmsPricePlanSnapshot(countryConfig, fallbackPlan);
      return fallbackPlan;
    }

    async function fetchPhoneActivationPayload(config, countryConfig, action, options = {}) {
      const query = {
        action,
        service: HERO_SMS_SERVICE_CODE,
        country: countryConfig.id,
      };
      if (options.maxPrice !== null && options.maxPrice !== undefined) {
        query.maxPrice = options.maxPrice;
        if (options.fixedPrice !== false) {
          query.fixedPrice = 'true';
        }
      }
      return fetchHeroSmsPayload(config, query, `HeroSMS ${action}`);
    }

    async function requestPhoneActivationWithPrice(config, countryConfig, action, maxPrice, options = {}) {
      let nextMaxPrice = maxPrice;
      let retriedWithUpdatedPrice = false;
      let retriedWithoutPrice = false;
      const userLimit = normalizeHeroSmsPriceLimit(options.userLimit);
      const userMinLimit = normalizeHeroSmsPriceLimit(options.userMinLimit);

      while (true) {
        try {
          return await fetchPhoneActivationPayload(config, countryConfig, action, {
            maxPrice: nextMaxPrice,
            fixedPrice: options.fixedPrice,
          });
        } catch (error) {
          const updatedMaxPrice = extractHeroSmsWrongMaxPrice(error?.payload || error?.message);
          if (
            nextMaxPrice !== null
            && nextMaxPrice !== undefined
            && !retriedWithUpdatedPrice
            && updatedMaxPrice !== null
          ) {
            if (userLimit !== null && updatedMaxPrice > userLimit) {
              throw new Error(
                `HeroSMS ${formatHeroSmsActionName(action)} failed: Price cap is too low; platform requires at least ${updatedMaxPrice}, which exceeds the currently configured price cap ${userLimit}.`
              );
            }
            if (userMinLimit !== null && updatedMaxPrice < userMinLimit) {
              throw new Error(
                `HeroSMS ${formatHeroSmsActionName(action)} failed: Platform required price ${updatedMaxPrice} is below the currently configured min purchase price ${userMinLimit}.`
              );
            }
            nextMaxPrice = updatedMaxPrice;
            retriedWithUpdatedPrice = true;
            continue;
          }

          if (
            nextMaxPrice !== null
            && nextMaxPrice !== undefined
            && !retriedWithoutPrice
            && isNetworkFetchFailure(error)
          ) {
            nextMaxPrice = null;
            retriedWithoutPrice = true;
            continue;
          }

          throw error;
        }
      }
    }

    function collectFiveSimPriceCandidates(payload, candidates = []) {
      if (Array.isArray(payload)) {
        payload.forEach((entry) => collectFiveSimPriceCandidates(entry, candidates));
        return candidates;
      }
      if (!payload || typeof payload !== 'object') {
        return candidates;
      }
      const cost = Number(payload.cost);
      const count = Number(payload.count);
      if (Number.isFinite(cost) && cost > 0) {
        if (!Number.isFinite(count) || count > 0) {
          candidates.push(Math.round(cost * 10000) / 10000);
        }
      }
      Object.entries(payload).forEach(([key, value]) => {
        const keyedPrice = Number(key);
        if (!Number.isFinite(keyedPrice) || keyedPrice <= 0) {
          return;
        }
        if (value && typeof value === 'object') {
          const keyedCount = Number(value.count);
          if (!Number.isFinite(keyedCount) || keyedCount > 0) {
            candidates.push(Math.round(keyedPrice * 10000) / 10000);
          }
          return;
        }
        const numericCount = Number(value);
        if (!Number.isFinite(numericCount) || numericCount > 0) {
          candidates.push(Math.round(keyedPrice * 10000) / 10000);
        }
      });
      Object.values(payload).forEach((entry) => collectFiveSimPriceCandidates(entry, candidates));
      return candidates;
    }

    function collectFiveSimProductPriceCandidates(payload, product = DEFAULT_FIVE_SIM_PRODUCT, candidates = []) {
      if (Array.isArray(payload)) {
        payload.forEach((entry) => collectFiveSimProductPriceCandidates(entry, product, candidates));
        return candidates;
      }
      if (!payload || typeof payload !== 'object') {
        return candidates;
      }
      const productPayload = payload[product] || payload[String(product || '').toLowerCase()];
      if (productPayload && typeof productPayload === 'object') {
        const price = Number(productPayload.Price ?? productPayload.price ?? productPayload.cost);
        const qty = Number(productPayload.Qty ?? productPayload.qty ?? productPayload.count);
        if (Number.isFinite(price) && price > 0 && (!Number.isFinite(qty) || qty > 0)) {
          candidates.push(Math.round(price * 10000) / 10000);
        }
      }
      Object.values(payload).forEach((entry) => collectFiveSimProductPriceCandidates(entry, product, candidates));
      return candidates;
    }

    function findLowestFiveSimPrice(payload, product = DEFAULT_FIVE_SIM_PRODUCT, countryCode = '', priceRange = {}) {
      const normalizedProduct = normalizeFiveSimCountryCode(product, DEFAULT_FIVE_SIM_PRODUCT);
      const normalizedCountryCode = normalizeFiveSimCountryCode(countryCode, '');
      const root = payload && typeof payload === 'object'
        ? (payload[normalizedProduct] || payload)
        : {};
      const countryPayload = (
        normalizedCountryCode
          ? (root?.[normalizedCountryCode] || root)
          : root
      );
      const candidates = filterPriceCandidatesWithinRange(
        buildSortedUniquePriceCandidates(collectFiveSimPriceCandidates(countryPayload, [])),
        priceRange?.minPriceLimit ?? null,
        priceRange?.maxPriceLimit ?? null
      );
      if (!candidates.length) {
        return null;
      }
      return Math.min(...candidates);
    }

    function isFiveSimNoNumbersError(payloadOrMessage) {
      const text = describeFiveSimPayload(payloadOrMessage);
      return /no\s+free\s+phones|no\s+phones\s+available|no\s+numbers\s+available/i.test(text);
    }

    function isFiveSimRateLimitError(payloadOrMessage, status = 0) {
      if (Number(status) === 429) {
        return true;
      }
      const text = describeFiveSimPayload(payloadOrMessage);
      return /rate\s*limit|too\s*many\s*requests|request\s*limit|429/i.test(text);
    }

    function buildFiveSimRateLimitError(details = []) {
      const suffix = Array.isArray(details) && details.length
        ? `: ${details.join(' | ')}.`
        : '.';
      return new Error(`${FIVE_SIM_RATE_LIMIT_ERROR_PREFIX}5sim purchase API was rate-limited; please retry later${suffix}`);
    }

    function isFiveSimTerminalError(payloadOrMessage, status = 0) {
      if (Number(status) === 401 || Number(status) === 403) {
        return true;
      }
      const text = describeFiveSimPayload(payloadOrMessage);
      return /not\s+enough\s+balance|no\s+balance|unauthorized|invalid\s+token|forbidden|bad\s+key|wrong\s+key|banned/i.test(text);
    }

    async function resolveFiveSimLowestPrice(config, countryCode, priceRange = {}) {
      try {
        const payload = await fetchFiveSimPayload(
          config,
          '/guest/prices',
          '5sim guest prices',
          {
            query: {
              country: countryCode,
              product: config.product,
            },
          }
        );
        return findLowestFiveSimPrice(payload, config.product, countryCode, priceRange);
      } catch {
        return null;
      }
    }

    function parseFiveSimActivationPayload(payload, fallback = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
      }
      const activationId = String(payload.id || payload.activationId || '').trim();
      const phoneNumber = String(payload.phone || payload.number || '').trim();
      if (!activationId || !phoneNumber) {
        return null;
      }

      const fallbackCountryCode = normalizeFiveSimCountryCode(
        fallback.countryCode || fallback.countryId || '',
        'thailand'
      );
      const countryCode = normalizeFiveSimCountryCode(
        payload.country || payload.country_name || payload.countryCode || payload.countryId || fallbackCountryCode,
        fallbackCountryCode
      );
      const countryLabel = String(
        payload.country_name
        || payload.countryName
        || payload.country
        || fallback.countryLabel
        || countryCode
      ).trim();

      return {
        activationId,
        phoneNumber,
        provider: PHONE_SMS_PROVIDER_5SIM,
        serviceCode: normalizeFiveSimCountryCode(payload.product || fallback.serviceCode || DEFAULT_FIVE_SIM_PRODUCT, DEFAULT_FIVE_SIM_PRODUCT),
        countryId: countryCode,
        countryCode,
        countryLabel: countryLabel || countryCode,
        successfulUses: normalizeUseCount(payload.successfulUses ?? fallback.successfulUses ?? 0),
        maxUses: Math.max(1, Math.floor(Number(payload.maxUses ?? fallback.maxUses) || DEFAULT_PHONE_NUMBER_MAX_USES)),
        ...(() => {
          const expiresAt = normalizeTimestampMs(
            payload.expiresAt
            ?? payload.expires
            ?? payload.expireAt
            ?? payload.expired_at
            ?? payload.expiredAt
            ?? fallback.expiresAt
          );
          return expiresAt > 0 ? { expiresAt } : {};
        })(),
      };
    }

    async function requestFiveSimActivation(state = {}, options = {}) {
      const config = resolvePhoneConfig(state);
      const allCountryCandidates = Array.isArray(config.countryCandidates) && config.countryCandidates.length
        ? config.countryCandidates
        : [];
      if (!allCountryCandidates.length) {
        throw new Error(`Step ${getActivePhoneVerificationVisibleStep()}: 5sim has no country selected. Please select at least 1 country in SMS settings.`);
      }
      const blockedCountryIds = new Set(
        (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
          .map((value) => normalizeFiveSimCountryCode(value, ''))
          .filter(Boolean)
      );
      let countryCandidates = allCountryCandidates.filter(
        (entry) => !blockedCountryIds.has(normalizeFiveSimCountryCode(entry.code || entry.id || '', ''))
      );
      if (!countryCandidates.length) {
        countryCandidates = allCountryCandidates;
        if (blockedCountryIds.size) {
          await addLog(
            'Step 9: All selected countries reached temporary SMS failure skip threshold. Lifting skip this round and retrying.',
            'warn'
          );
        }
      }

      const priceRange = resolvePhonePriceRange(state, PHONE_SMS_PROVIDER_5SIM);
      if (priceRange.invalidRange) {
        throw new Error(
          `5sim price range is invalid: min purchase price ${priceRange.minPriceLimit} is greater than price cap ${priceRange.maxPriceLimit}.`
        );
      }
      const maxPriceLimit = priceRange.maxPriceLimit;
      const minPriceLimit = priceRange.minPriceLimit;
      const hasPriceBounds = priceRange.hasMinPriceLimit || priceRange.hasMaxPriceLimit;
      const acquirePriority = normalizeHeroSmsAcquirePriority(state?.heroSmsAcquirePriority);
      const preferredPriceTier = normalizeHeroSmsPriceLimit(state?.heroSmsPreferredPrice);
      const countryPriceFloorByCountryCode = normalizeCountryPriceFloorMap(
        options?.countryPriceFloorByCountryId,
        (value) => normalizeFiveSimCountryCode(value, '')
      );
      const configuredAcquireRounds = normalizePhoneActivationRetryRounds(state?.heroSmsActivationRetryRounds);
      const maxAcquireRounds = Math.max(2, configuredAcquireRounds);
      const retryDelayMs = normalizePhoneActivationRetryDelayMs(state?.heroSmsActivationRetryDelayMs);

      let finalNoNumbersByCountry = [];
      let finalRateLimitByCountry = [];
      let finalLastError = null;

      for (let round = 1; round <= maxAcquireRounds; round += 1) {
        if (maxAcquireRounds > 1) {
          await addLog(
            `Step 9: 5sim is acquiring phone number (round ${round}/${maxAcquireRounds})...`,
            'info'
          );
        }
        const noNumbersByCountry = [];
        const rateLimitByCountry = [];
        const retryableNoNumberCountries = [];
        let lastError = null;

        let orderedCountryCandidates = [...countryCandidates];
        if (
          (acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE || acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH)
          && countryCandidates.length > 1
        ) {
          const rankedCandidates = [];
          for (const [index, countryConfig] of countryCandidates.entries()) {
            const countryCode = normalizeFiveSimCountryCode(countryConfig.code || countryConfig.id || '', 'thailand');
            const lowestPrice = await resolveFiveSimLowestPrice(config, countryCode, priceRange);
            rankedCandidates.push({
              index,
              countryConfig,
              lowestPrice: Number.isFinite(Number(lowestPrice)) ? Number(lowestPrice) : null,
            });
          }
          rankedCandidates.sort((left, right) => {
            const leftPrice = left.lowestPrice;
            const rightPrice = right.lowestPrice;
            const leftHasPrice = Number.isFinite(leftPrice);
            const rightHasPrice = Number.isFinite(rightPrice);
            if (leftHasPrice && rightHasPrice && leftPrice !== rightPrice) {
              return acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH
                ? (rightPrice - leftPrice)
                : (leftPrice - rightPrice);
            }
            if (leftHasPrice !== rightHasPrice) {
              return leftHasPrice ? -1 : 1;
            }
            return left.index - right.index;
          });
          orderedCountryCandidates = rankedCandidates.map((entry) => entry.countryConfig);
            const rankedSummary = rankedCandidates
              .map((entry) => {
                const countryCode = normalizeFiveSimCountryCode(entry.countryConfig.code || entry.countryConfig.id || '', 'thailand');
                const countryLabel = String(entry.countryConfig.label || countryCode).trim() || countryCode;
                return Number.isFinite(entry.lowestPrice)
                  ? `${countryLabel}:${entry.lowestPrice}`
                  : `${countryLabel}:none`;
              })
            .join(' | ');
          await addLog(`Step 9: 5sim price priority ranking: ${rankedSummary}`, 'info');
        }

        for (const countryConfig of orderedCountryCandidates) {
          const countryCode = normalizeFiveSimCountryCode(countryConfig.code || countryConfig.id || '', 'thailand');
          const countryLabel = String(countryConfig.label || countryCode).trim() || countryCode;
          const countryPriceFloor = countryPriceFloorByCountryCode.get(countryCode) ?? null;
          try {
            const explicitFiveSimMaxPriceLimit = normalizeHeroSmsPriceLimit(state.fiveSimMaxPrice);
            let guestPricesPayload = null;
            let productPricesPayload = null;
            if (explicitFiveSimMaxPriceLimit !== null) {
              try {
                productPricesPayload = await fetchFiveSimPayload(
                  config,
                  `/guest/products/${countryCode}/${config.operator}`,
                  '5sim guest products'
                );
              } catch (_) {
                productPricesPayload = null;
              }
            }
            try {
              guestPricesPayload = await fetchFiveSimPayload(
                config,
                '/guest/prices',
                '5sim guest prices',
                {
                  query: {
                    country: countryCode,
                    product: config.product,
                  },
                }
              );
            } catch (_) {
              guestPricesPayload = null;
            }

            const rawPriceCandidates = buildSortedUniquePriceCandidates(
              [
                ...(
                  normalizeHeroSmsPriceLimit(state.fiveSimMaxPrice) !== null
                    ? collectFiveSimProductPriceCandidates(productPricesPayload, config.product, [])
                    : []
                ),
                ...collectFiveSimPriceCandidates(
                  (
                    guestPricesPayload
                    && typeof guestPricesPayload === 'object'
                    && !Array.isArray(guestPricesPayload)
                    ? (guestPricesPayload?.[config.product]?.[countryCode] || guestPricesPayload?.[countryCode] || guestPricesPayload)
                    : guestPricesPayload
                  ),
                  []
                ),
              ]
            );
            const rangeFilteredPriceCandidates = filterPriceCandidatesWithinRange(
              rawPriceCandidates,
              minPriceLimit,
              maxPriceLimit
            );
            const orderedPricesFromCatalog = reorderPriceCandidates(
              rangeFilteredPriceCandidates,
              acquirePriority,
              preferredPriceTier
            );
            const orderedPrices = orderedPricesFromCatalog.length
              ? (
                explicitFiveSimMaxPriceLimit !== null
                  ? [
                    explicitFiveSimMaxPriceLimit,
                    ...orderedPricesFromCatalog.filter((price) => Number(price) !== Number(explicitFiveSimMaxPriceLimit)),
                  ]
                  : orderedPricesFromCatalog
              )
              : (
                minPriceLimit !== null
                  ? (maxPriceLimit !== null ? [maxPriceLimit] : [])
                  : (maxPriceLimit !== null ? [maxPriceLimit] : [null])
              );
            const rangeCheckedPrices = filterPriceCandidatesWithinRange(orderedPrices, minPriceLimit, maxPriceLimit);
            const candidatePrices = rangeCheckedPrices.length
              ? rangeCheckedPrices
              : (hasPriceBounds ? [] : orderedPrices);
            const floorFilteredPrices = filterPriceCandidatesAboveFloor(candidatePrices, countryPriceFloor);
            const hasCountryPriceFloor = (
              countryPriceFloor !== null
              && Number.isFinite(Number(countryPriceFloor))
              && Number(countryPriceFloor) > 0
            );
            const hasAlternativeCountries = orderedCountryCandidates.some((entry) => (
              normalizeFiveSimCountryCode(entry.code || entry.id || '', '')
              !== normalizeFiveSimCountryCode(countryConfig.code || countryConfig.id || '', '')
            ));
            // When a floor is set (e.g. timeout on current tier), do NOT fall back to the
            // original lowest-tier list; that would retry the same tier forever and block
            // country/provider fallback.
            const pricesToTry = hasCountryPriceFloor
              ? (
                floorFilteredPrices.length
                  ? floorFilteredPrices
                  : (hasAlternativeCountries ? [] : candidatePrices.slice(0, 1))
              )
              : (floorFilteredPrices.length ? floorFilteredPrices : candidatePrices);

            if (!pricesToTry.length) {
              const lowestCatalog = rawPriceCandidates.length ? rawPriceCandidates[0] : null;
              if (
                minPriceLimit !== null
                && !rangeFilteredPriceCandidates.length
                && rawPriceCandidates.length
              ) {
                noNumbersByCountry.push(
                  `${countryLabel}: No numbers available in price range ${formatPhonePriceRangeText(minPriceLimit, maxPriceLimit)}; visible tiers=${rawPriceCandidates.join(', ')}`
                );
              } else if (
                maxPriceLimit !== null
                && lowestCatalog !== null
                && Number(lowestCatalog) > Number(maxPriceLimit)
              ) {
                noNumbersByCountry.push(
                  `${countryLabel}: No numbers available within price cap ${maxPriceLimit}; platform lowest price=${lowestCatalog}`
                );
              } else if (countryPriceFloor !== null && rangeFilteredPriceCandidates.length) {
                noNumbersByCountry.push(
                  `${countryLabel}: Current fallback attempt has no price tier above ${countryPriceFloor}`
                );
              } else if (rawPriceCandidates.length) {
                const tierText = rawPriceCandidates.join(', ');
                noNumbersByCountry.push(`${countryLabel}: All visible price tiers unavailable (${tierText})`);
                retryableNoNumberCountries.push(countryLabel);
              } else {
                noNumbersByCountry.push(`${countryLabel}: No numbers available`);
                retryableNoNumberCountries.push(countryLabel);
              }
              continue;
            }

            let acquiredActivation = null;
            let countryNoNumbersText = '';
            for (const candidatePrice of pricesToTry) {
              try {
                const payload = await fetchFiveSimPayload(
                  config,
                  `/user/buy/activation/${countryCode}/${config.operator}/${config.product}`,
                  '5sim buy activation',
                  {
                    query: {
                      ...(candidatePrice !== null && candidatePrice !== undefined ? { maxPrice: candidatePrice } : {}),
                      ...(normalizePhoneSmsReuseEnabled(state) ? { reuse: 1 } : {}),
                    },
                  }
                );
                const activation = parseFiveSimActivationPayload(payload, {
                  countryCode,
                  countryLabel,
                  serviceCode: config.product,
                });
                if (activation) {
                  const priceValue = Number(candidatePrice);
                  rememberActivationAcquiredPrice(activation, priceValue);
                  acquiredActivation = activation;
                  break;
                }
                const payloadText = describeFiveSimPayload(payload);
                if (isFiveSimRateLimitError(payload)) {
                  countryNoNumbersText = payloadText || countryNoNumbersText || 'rate limit';
                  continue;
                }
                if (isFiveSimNoNumbersError(payload)) {
                  countryNoNumbersText = payloadText || countryNoNumbersText || 'No numbers available';
                  continue;
                }
                if (isFiveSimTerminalError(payload)) {
                  throw createPhoneSmsActionFailureError('5sim buy activation', payloadText || 'empty response');
                }
                lastError = createPhoneSmsActionFailureError('5sim buy activation', payloadText || 'empty response');
              } catch (error) {
                if (isFiveSimRateLimitError(error?.payload || error?.message, error?.status)) {
                  countryNoNumbersText = describeFiveSimPayload(error?.payload || error?.message) || countryNoNumbersText || 'rate limit';
                  continue;
                }
                if (isFiveSimTerminalError(error?.payload || error?.message, error?.status)) {
                  throw createPhoneSmsActionFailureError('5sim buy activation', describeFiveSimPayload(error?.payload || error?.message) || 'unknown terminal error', error?.payload, error?.status);
                }
                if (isFiveSimNoNumbersError(error?.payload || error?.message)) {
                  countryNoNumbersText = describeFiveSimPayload(error?.payload || error?.message) || countryNoNumbersText || 'No numbers available';
                  continue;
                }
                lastError = error;
              }
            }

            if (acquiredActivation) {
              return acquiredActivation;
            }

            const lowestCatalogPrice = rawPriceCandidates.length
              ? rawPriceCandidates[0]
              : await resolveFiveSimLowestPrice(config, countryCode);
            if (
              minPriceLimit !== null
              && !rangeFilteredPriceCandidates.length
              && rawPriceCandidates.length
            ) {
              noNumbersByCountry.push(
                `${countryLabel}: No numbers available in price range ${formatPhonePriceRangeText(minPriceLimit, maxPriceLimit)}; visible tiers=${rawPriceCandidates.join(', ')}`
              );
            } else if (maxPriceLimit !== null && lowestCatalogPrice !== null && Number(lowestCatalogPrice) > Number(maxPriceLimit)) {
              noNumbersByCountry.push(
                `${countryLabel}: No numbers available within price cap ${maxPriceLimit}; platform lowest price=${lowestCatalogPrice}`
              );
            } else if (isFiveSimRateLimitError(countryNoNumbersText)) {
              rateLimitByCountry.push(`${countryLabel}: ${countryNoNumbersText || 'rate limit'}`);
            } else {
              noNumbersByCountry.push(`${countryLabel}: ${countryNoNumbersText || 'No numbers available'}`);
              retryableNoNumberCountries.push(countryLabel);
            }
            continue;
          } catch (error) {
            if (isFiveSimRateLimitError(error?.payload || error?.message, error?.status)) {
              rateLimitByCountry.push(`${countryLabel}: ${describeFiveSimPayload(error?.payload || error?.message) || 'rate limit'}`);
              continue;
            }
            if (isFiveSimTerminalError(error?.payload || error?.message, error?.status)) {
              throw createPhoneSmsActionFailureError('5sim buy activation', describeFiveSimPayload(error?.payload || error?.message) || 'unknown terminal error', error?.payload, error?.status);
            }
            if (isFiveSimNoNumbersError(error?.payload || error?.message)) {
              const lowestRangePrice = await resolveFiveSimLowestPrice(config, countryCode, priceRange);
              const lowestCatalogPrice = lowestRangePrice === null
                ? await resolveFiveSimLowestPrice(config, countryCode)
                : lowestRangePrice;
              if (minPriceLimit !== null && lowestRangePrice === null) {
                noNumbersByCountry.push(
                  `${countryLabel}: No numbers available in price range ${formatPhonePriceRangeText(minPriceLimit, maxPriceLimit)}`
                );
              } else if (maxPriceLimit !== null && lowestCatalogPrice !== null && lowestCatalogPrice > maxPriceLimit) {
                noNumbersByCountry.push(
                  `${countryLabel}: No numbers available within price cap ${maxPriceLimit}; platform lowest price=${lowestCatalogPrice}`
                );
              } else {
                noNumbersByCountry.push(`${countryLabel}: ${describeFiveSimPayload(error?.payload || error?.message) || 'No numbers available'}`);
                retryableNoNumberCountries.push(countryLabel);
              }
              continue;
            }
            lastError = error;
          }
        }

        finalNoNumbersByCountry = noNumbersByCountry;
        finalRateLimitByCountry = rateLimitByCountry;
        finalLastError = lastError;

        if (rateLimitByCountry.length) {
          throw buildFiveSimRateLimitError(rateLimitByCountry);
        }

        if (
          noNumbersByCountry.length
          && round < maxAcquireRounds
          && retryableNoNumberCountries.length > 0
        ) {
          await addLog(
            `Step 9: 5sim has no available numbers (round ${round}/${maxAcquireRounds}). Retrying in ${Math.ceil(retryDelayMs / 1000)} seconds. Countries: ${retryableNoNumberCountries.join(', ')}.`,
            'warn'
          );
          await sleepWithStop(retryDelayMs);
          continue;
        }

        break;
      }

      if (finalNoNumbersByCountry.length) {
        throw new Error(
          `5sim tried ${countryCandidates.length} candidate countries; none had available numbers: ${finalNoNumbersByCountry.join(' | ')}.`
        );
      }
      if (finalRateLimitByCountry.length) {
        throw buildFiveSimRateLimitError(finalRateLimitByCountry);
      }
      if (finalLastError) {
        throw finalLastError;
      }
      throw new Error('5sim failed to acquire phone number.');
    }

    function isNexSmsNoNumbersError(payloadOrMessage) {
      const text = describeNexSmsPayload(payloadOrMessage);
      return /numbers?\s+not\s+found|暂无可用|no\s+numbers|no\s+stock|库存.*0|not\s+available/i.test(text);
    }

    function isNexSmsPendingMessage(payloadOrMessage) {
      const text = describeNexSmsPayload(payloadOrMessage);
      return /no\s+sms|暂无短信|waiting|not\s+arrived|empty|未收到|短信为空|no\s+records/i.test(text);
    }

    function isNexSmsTerminalError(payloadOrMessage, status = 0) {
      if (Number(status) === 401 || Number(status) === 403) {
        return true;
      }
      const text = describeNexSmsPayload(payloadOrMessage);
      return /invalid\s*api\s*key|bad[_\s-]*key|wrong[_\s-]*key|unauthorized|forbidden|no\s*balance|insufficient\s*balance|余额不足|账号.*封禁|banned/i.test(text);
    }

    function collectNexSmsPriceCandidates(countryData = {}) {
      const candidates = [];
      const pushCandidate = (value) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
          candidates.push(Math.round(numeric * 10000) / 10000);
        }
      };

      pushCandidate(countryData.minPrice);
      pushCandidate(countryData.medianPrice);
      pushCandidate(countryData.maxPrice);

      if (countryData.priceMap && typeof countryData.priceMap === 'object') {
        Object.entries(countryData.priceMap).forEach(([priceKey, count]) => {
          const availableCount = Number(count);
          if (!Number.isFinite(availableCount) || availableCount <= 0) {
            return;
          }
          pushCandidate(priceKey);
        });
      }

      return buildSortedUniquePriceCandidates(candidates);
    }

    async function resolveNexSmsCountryPricePlan(config, countryConfig, state = {}) {
      const countryId = normalizeNexSmsCountryId(countryConfig?.id, -1);
      if (countryId < 0) {
        throw new Error(`NexSMS country ID is invalid: ${countryConfig?.id}`);
      }
      const payload = await fetchNexSmsPayload(
        config,
        '/api/getCountryByService',
        'NexSMS getCountryByService',
        {
          query: {
            serviceCode: config.serviceCode,
            countryId,
          },
        }
      );
      if (!isNexSmsSuccessPayload(payload)) {
        throw createPhoneSmsActionFailureError('NexSMS getCountryByService', describeNexSmsPayload(payload) || 'empty response');
      }
      const countryData = (payload && typeof payload === 'object' && !Array.isArray(payload))
        ? (payload.data || {})
        : {};
      const countryLabel = normalizeCountryLabel(
        countryData.countryName || countryConfig?.label,
        `Country #${countryId}`
      );
      const prices = collectNexSmsPriceCandidates(countryData);
      const minCatalogPrice = prices.length
        ? prices[0]
        : (() => {
          const minPrice = Number(countryData.minPrice);
          return Number.isFinite(minPrice) && minPrice > 0
            ? Math.round(minPrice * 10000) / 10000
            : null;
        })();
      const userLimit = normalizeHeroSmsPriceLimit(state?.heroSmsMaxPrice);
      const filteredPrices = userLimit === null
        ? prices
        : prices.filter((price) => price <= userLimit);

      return {
        countryId,
        countryLabel,
        prices: filteredPrices,
        userLimit,
        minCatalogPrice,
        rawPayload: payload,
      };
    }

    function parseNexSmsActivationPayload(payload, fallback = {}) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
      }
      if (!isNexSmsSuccessPayload(payload)) {
        return null;
      }
      const data = payload.data || {};
      const phoneCandidates = Array.isArray(data.phoneNumbers)
        ? data.phoneNumbers
        : (Array.isArray(data.numbers) ? data.numbers : []);
      const phoneNumber = String(
        data.phoneNumber
        || data.phone
        || phoneCandidates[0]
        || fallback.phoneNumber
        || ''
      ).trim();
      if (!phoneNumber) {
        return null;
      }
      const countryId = normalizeNexSmsCountryId(
        data.countryId ?? fallback.countryId,
        0
      );
      const countryLabel = normalizeCountryLabel(
        data.countryName || fallback.countryLabel,
        `Country #${countryId}`
      );
      const serviceCode = normalizeNexSmsServiceCode(
        data.serviceCode || fallback.serviceCode || DEFAULT_NEX_SMS_SERVICE_CODE,
        DEFAULT_NEX_SMS_SERVICE_CODE
      );
      return {
        activationId: phoneNumber,
        phoneNumber,
        provider: PHONE_SMS_PROVIDER_NEXSMS,
        serviceCode,
        countryId,
        countryLabel,
        successfulUses: normalizeUseCount(fallback.successfulUses ?? 0),
        maxUses: 1,
      };
    }

    async function requestNexSmsActivation(state = {}, options = {}) {
      const config = resolvePhoneConfig(state);
      const allCountryCandidates = Array.isArray(config.countryCandidates) && config.countryCandidates.length
        ? config.countryCandidates
        : resolveNexSmsCountryCandidates(state);
      if (!allCountryCandidates.length) {
        throw new Error(`Step ${getActivePhoneVerificationVisibleStep()}: NexSMS has no country selected. Please select at least 1 country in SMS settings.`);
      }
      const blockedCountryIds = new Set(
        (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
          .map((value) => normalizeNexSmsCountryId(value, -1))
          .filter((id) => id >= 0)
      );
      let countryCandidates = allCountryCandidates.filter((entry) => {
        const id = normalizeNexSmsCountryId(entry.id, -1);
        return id >= 0 && !blockedCountryIds.has(id);
      });
      if (!countryCandidates.length) {
        countryCandidates = allCountryCandidates;
        if (blockedCountryIds.size) {
          await addLog(
            'Step 9: All selected countries reached temporary SMS failure skip threshold. Lifting skip this round and retrying.',
            'warn'
          );
        }
      }

      const acquirePriority = normalizeHeroSmsAcquirePriority(state?.heroSmsAcquirePriority);
      const priceRange = resolvePhonePriceRange(state, PHONE_SMS_PROVIDER_NEXSMS);
      if (priceRange.invalidRange) {
        throw new Error(
          `NexSMS price range is invalid: min purchase price ${priceRange.minPriceLimit} is greater than price cap ${priceRange.maxPriceLimit}.`
        );
      }
      const minPriceLimit = priceRange.minPriceLimit;
      const maxPriceLimit = priceRange.maxPriceLimit;
      const hasPriceBounds = priceRange.hasMinPriceLimit || priceRange.hasMaxPriceLimit;
      const preferredPriceTier = normalizeHeroSmsPriceLimit(state?.heroSmsPreferredPrice);
      const countryPriceFloorByCountryId = normalizeCountryPriceFloorMap(
        options?.countryPriceFloorByCountryId,
        (value) => String(normalizeNexSmsCountryId(value, -1))
      );
      const configuredAcquireRounds = normalizePhoneActivationRetryRounds(state?.heroSmsActivationRetryRounds);
      const maxAcquireRounds = Math.max(2, configuredAcquireRounds);
      const retryDelayMs = normalizePhoneActivationRetryDelayMs(state?.heroSmsActivationRetryDelayMs);
      let finalNoNumbersByCountry = [];
      let finalLastError = null;

      for (let round = 1; round <= maxAcquireRounds; round += 1) {
        if (maxAcquireRounds > 1) {
          await addLog(
            `Step 9: NexSMS is acquiring phone number (round ${round}/${maxAcquireRounds})...`,
            'info'
          );
        }

        const candidateAttempts = [];
        for (const [index, countryConfig] of countryCandidates.entries()) {
          candidateAttempts.push({
            index,
            countryConfig,
            pricePlan: null,
            orderingPrice: Number.POSITIVE_INFINITY,
          });
        }

        if (
          (acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE || acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH)
          && candidateAttempts.length > 1
        ) {
          for (const attempt of candidateAttempts) {
            try {
              const pricePlan = await resolveNexSmsCountryPricePlan(config, attempt.countryConfig, state);
              attempt.pricePlan = pricePlan;
              const orderedForRanking = reorderPriceCandidates(pricePlan.prices, acquirePriority, preferredPriceTier);
              const rangeFilteredForRanking = filterPriceCandidatesWithinRange(
                orderedForRanking,
                minPriceLimit,
                maxPriceLimit
              );
              const rankingPrices = rangeFilteredForRanking.length
                ? rangeFilteredForRanking
                : (hasPriceBounds ? [] : orderedForRanking);
              attempt.orderingPrice = Array.isArray(rankingPrices) && rankingPrices.length
                ? Number(rankingPrices[0])
                : Number.POSITIVE_INFINITY;
            } catch (error) {
              attempt.pricePlan = null;
              attempt.orderingPrice = Number.POSITIVE_INFINITY;
              attempt.lookupError = error;
            }
          }
          candidateAttempts.sort((left, right) => {
            if (left.orderingPrice !== right.orderingPrice) {
              return acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH
                ? (right.orderingPrice - left.orderingPrice)
                : (left.orderingPrice - right.orderingPrice);
            }
            return left.index - right.index;
          });
          const rankingSummary = candidateAttempts.map((attempt) => {
            const id = normalizeNexSmsCountryId(attempt.countryConfig.id, -1);
            const label = String(attempt.countryConfig.label || `Country #${id}`).trim() || `Country #${id}`;
            return Number.isFinite(attempt.orderingPrice)
              ? `${label}:${attempt.orderingPrice}`
              : `${label}:none`;
          }).join(' | ');
          await addLog(`Step 9: NexSMS price priority ranking: ${rankingSummary}`, 'info');
        }

        const noNumbersByCountry = [];
        const retryableNoNumberCountries = [];
        let lastError = null;

        for (const attempt of candidateAttempts) {
          const countryId = normalizeNexSmsCountryId(attempt.countryConfig.id, -1);
          const countryLabel = normalizeCountryLabel(attempt.countryConfig.label, `Country #${countryId}`);
          const countryPriceFloor = countryPriceFloorByCountryId.get(String(countryId)) ?? null;
          let pricePlan = attempt.pricePlan;
          if (!pricePlan) {
            try {
              pricePlan = await resolveNexSmsCountryPricePlan(config, attempt.countryConfig, state);
            } catch (error) {
              if (isNexSmsTerminalError(error?.payload || error?.message, error?.status)) {
                throw createPhoneSmsActionFailureError('NexSMS price lookup', describeNexSmsPayload(error?.payload || error?.message) || 'unknown terminal error', error?.payload, error?.status);
              }
              lastError = error;
              continue;
            }
          }

          if (!Array.isArray(pricePlan.prices) || !pricePlan.prices.length) {
            if (
              pricePlan.userLimit !== null
              && pricePlan.minCatalogPrice !== null
              && pricePlan.minCatalogPrice > pricePlan.userLimit
            ) {
              noNumbersByCountry.push(
                `${countryLabel}: No numbers available within price cap ${pricePlan.userLimit}; platform lowest price=${pricePlan.minCatalogPrice}`
              );
            } else {
              const reason = describeNexSmsPayload(pricePlan.rawPayload) || 'No available price tiers';
              noNumbersByCountry.push(`${countryLabel}: ${reason}`);
              retryableNoNumberCountries.push(countryLabel);
            }
            continue;
          }

            const orderedPrices = reorderPriceCandidates(pricePlan.prices, acquirePriority, preferredPriceTier);
            const rangeFilteredPrices = filterPriceCandidatesWithinRange(
              orderedPrices,
              minPriceLimit,
              maxPriceLimit
            );
            const candidatePrices = rangeFilteredPrices.length
              ? rangeFilteredPrices
              : (hasPriceBounds ? [] : orderedPrices);
            const floorFilteredPrices = filterPriceCandidatesAboveFloor(candidatePrices, countryPriceFloor);
            const hasCountryPriceFloor = (
              countryPriceFloor !== null
              && Number.isFinite(Number(countryPriceFloor))
              && Number(countryPriceFloor) > 0
            );
            const hasAlternativeCountries = candidateAttempts.some((entry) => (
              normalizeNexSmsCountryId(entry?.countryConfig?.id, -1)
              !== normalizeNexSmsCountryId(attempt?.countryConfig?.id, -1)
            ));
            // With an explicit floor, only try higher tiers. If none exist, we should
            // move to country/provider fallback instead of retrying the same tier again.
            const pricesToTry = hasCountryPriceFloor
              ? (
                floorFilteredPrices.length
                  ? floorFilteredPrices
                  : (hasAlternativeCountries ? [] : candidatePrices.slice(0, 1))
              )
              : (floorFilteredPrices.length ? floorFilteredPrices : candidatePrices);
            if (!pricesToTry.length) {
              if (priceRange.hasMinPriceLimit && !rangeFilteredPrices.length) {
                noNumbersByCountry.push(
                  `${countryLabel}: No numbers available in price range ${formatPhonePriceRangeText(minPriceLimit, maxPriceLimit)}`
                );
                continue;
              }
              if (
                countryPriceFloor !== null
                && Array.isArray(pricePlan.prices)
                && pricePlan.prices.length > 0
              ) {
                noNumbersByCountry.push(
                  `${countryLabel}: Current fallback attempt has no price tier above ${countryPriceFloor}`
                );
              } else {
                noNumbersByCountry.push(`${countryLabel}: ${describeNexSmsPayload(pricePlan.rawPayload) || 'No numbers available'}`);
                retryableNoNumberCountries.push(countryLabel);
              }
              continue;
            }
            for (const price of pricesToTry) {
            try {
              const payload = await fetchNexSmsPayload(
                config,
                '/api/order/purchase',
                'NexSMS purchase',
                {
                  method: 'POST',
                  body: {
                    serviceCode: config.serviceCode,
                    countryId,
                    quantity: 1,
                    price,
                  },
                }
              );
              if (!isNexSmsSuccessPayload(payload)) {
                if (isNexSmsNoNumbersError(payload)) {
                  continue;
                }
                if (isNexSmsTerminalError(payload)) {
                  throw createPhoneSmsActionFailureError('NexSMS purchase', describeNexSmsPayload(payload) || 'empty response');
                }
                lastError = createPhoneSmsActionFailureError('NexSMS purchase', describeNexSmsPayload(payload) || 'empty response');
                continue;
              }
              const activation = parseNexSmsActivationPayload(payload, {
                countryId,
                countryLabel,
                serviceCode: config.serviceCode,
              });
              if (!activation) {
                lastError = new Error('NexSMS purchase succeeded but did not return a phone number.');
                continue;
              }
              const numericPrice = Number(price);
              rememberActivationAcquiredPrice(activation, numericPrice);
              return activation;
            } catch (error) {
              if (isNexSmsTerminalError(error?.payload || error?.message, error?.status)) {
                throw createPhoneSmsActionFailureError('NexSMS purchase', describeNexSmsPayload(error?.payload || error?.message) || 'unknown terminal error', error?.payload, error?.status);
              }
              if (isNexSmsNoNumbersError(error?.payload || error?.message)) {
                continue;
              }
              lastError = error;
            }
          }

          const fallbackReason = describeNexSmsPayload(pricePlan.rawPayload) || 'No numbers available';
          noNumbersByCountry.push(`${countryLabel}: ${fallbackReason}`);
          retryableNoNumberCountries.push(countryLabel);
        }

        finalNoNumbersByCountry = noNumbersByCountry;
        finalLastError = lastError;

        if (
          noNumbersByCountry.length
          && round < maxAcquireRounds
          && retryableNoNumberCountries.length > 0
        ) {
          await addLog(
            `Step 9: NexSMS has no available numbers (round ${round}/${maxAcquireRounds}); retrying in ${Math.ceil(retryDelayMs / 1000)} seconds. Countries: ${retryableNoNumberCountries.join(', ')}.`,
            'warn'
          );
          await sleepWithStop(retryDelayMs);
          continue;
        }

        break;
      }

      if (finalNoNumbersByCountry.length) {
        throw new Error(
          `NexSMS tried ${countryCandidates.length} candidate countries; none had available numbers: ${finalNoNumbersByCountry.join(' | ')}.`
        );
      }
      if (finalLastError) {
        throw finalLastError;
      }
      throw new Error('NexSMS failed to acquire phone number.');
    }

    async function requestPhoneActivation(state = {}, options = {}) {
      if (normalizePhoneSmsProvider(state?.phoneSmsProvider) === PHONE_SMS_PROVIDER_FIVE_SIM) {
        const provider = getFiveSimProviderForState(state);
        if (provider) {
          return provider.requestActivation(state, options);
        }
      }
      const config = resolvePhoneConfig(state);
      if (config.provider === PHONE_SMS_PROVIDER_5SIM) {
        return requestFiveSimActivation(state, options);
      }
      if (config.provider === PHONE_SMS_PROVIDER_NEXSMS) {
        return requestNexSmsActivation(state, options);
      }
      const allCountryCandidates = Array.isArray(config.countryCandidates) && config.countryCandidates.length
        ? config.countryCandidates
        : resolveCountryCandidates(state);
      if (!allCountryCandidates.length) {
        throw new Error(`Step ${getActivePhoneVerificationVisibleStep()}: HeroSMS has no country selected. Please select at least 1 country in SMS settings.`);
      }
      const blockedCountryIds = new Set(
        (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
          .map((value) => normalizeCountryId(value, 0))
          .filter((id) => id > 0)
      );
      let countryCandidates = allCountryCandidates.filter(
        (entry) => !blockedCountryIds.has(normalizeCountryId(entry.id, 0))
      );
      if (!countryCandidates.length) {
        countryCandidates = allCountryCandidates;
        if (blockedCountryIds.size) {
          await addLog(
            'Step 9: All selected countries reached temporary SMS failure skip threshold. Lifting skip this round and retrying.',
            'warn'
          );
        }
      }
      const acquirePriority = normalizeHeroSmsAcquirePriority(state?.heroSmsAcquirePriority);
      const priceRange = resolvePhonePriceRange(state, PHONE_SMS_PROVIDER_HERO);
      if (priceRange.invalidRange) {
        throw new Error(
          `HeroSMS price range is invalid: min purchase price ${priceRange.minPriceLimit} is greater than price cap ${priceRange.maxPriceLimit}.`
        );
      }
      const minPriceLimit = priceRange.minPriceLimit;
      const maxPriceLimit = priceRange.maxPriceLimit;
      const hasPriceBounds = priceRange.hasMinPriceLimit || priceRange.hasMaxPriceLimit;
      const preferredPriceTier = normalizeHeroSmsPriceLimit(state?.heroSmsPreferredPrice);
      const countryPriceFloorByCountryId = normalizeCountryPriceFloorMap(
        options?.countryPriceFloorByCountryId,
        (value) => String(normalizeCountryId(value, 0))
      );
      const requestActions = ['getNumber', 'getNumberV2'];
      const configuredAcquireRounds = normalizePhoneActivationRetryRounds(
        state?.heroSmsActivationRetryRounds
      );
      const maxAcquireRounds = Math.max(2, configuredAcquireRounds);
      const retryDelayMs = normalizePhoneActivationRetryDelayMs(
        state?.heroSmsActivationRetryDelayMs
      );

      let finalNoNumbersByCountry = [];
      let finalLastError = null;
      let finalLastFailureText = '';

      for (let round = 1; round <= maxAcquireRounds; round += 1) {
        if (maxAcquireRounds > 1) {
          await addLog(
            `Step 9: HeroSMS is acquiring phone number (round ${round}/${maxAcquireRounds})...`,
            'info'
          );
        }

        const countryAttempts = countryCandidates.map((countryConfig, index) => ({
          index,
          countryConfig,
          pricePlan: null,
          orderingPrice: Number.POSITIVE_INFINITY,
        }));

        if (
          acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE
          || acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH
        ) {
          for (const attempt of countryAttempts) {
            const pricePlan = await resolvePhoneActivationPricePlan(config, attempt.countryConfig, state);
            const orderedPrices = reorderPriceCandidates(pricePlan?.prices, acquirePriority, preferredPriceTier);
            const rangeFilteredForRanking = filterPriceCandidatesWithinRange(
              orderedPrices,
              minPriceLimit,
              maxPriceLimit
            );
            const rankingPrices = rangeFilteredForRanking.length
              ? rangeFilteredForRanking
              : (hasPriceBounds ? [] : orderedPrices);
            const numericPrices = Array.isArray(orderedPrices)
              ? rankingPrices
                  .map((value) => Number(value))
                  .filter((value) => Number.isFinite(value) && value > 0)
              : [];
            const candidateOrderingPrice = numericPrices.length ? numericPrices[0] : null;
            const cappedByUserLimit = (
              pricePlan?.userLimit !== null
              && pricePlan?.userLimit !== undefined
              && pricePlan?.minCatalogPrice !== null
              && pricePlan?.minCatalogPrice !== undefined
              && Number(pricePlan.minCatalogPrice) > Number(pricePlan.userLimit)
            );
            attempt.pricePlan = pricePlan;
            attempt.orderingPrice = cappedByUserLimit
              ? Number.POSITIVE_INFINITY
              : (candidateOrderingPrice !== null ? candidateOrderingPrice : Number.POSITIVE_INFINITY);
          }
        }

        if (
          (acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE || acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH)
          && countryAttempts.length > 1
        ) {
          countryAttempts.sort((left, right) => {
            if (left.orderingPrice !== right.orderingPrice) {
              return acquirePriority === HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH
                ? (right.orderingPrice - left.orderingPrice)
                : (left.orderingPrice - right.orderingPrice);
            }
            return left.index - right.index;
          });
        }

        const noNumbersByCountry = [];
        const retryableNoNumberCountries = [];
        let lastError = null;
        let lastFailureText = '';

        for (const attempt of countryAttempts) {
          const countryConfig = attempt.countryConfig;
          const countryIdKey = String(normalizeCountryId(countryConfig?.id, 0));
          const countryPriceFloor = countryPriceFloorByCountryId.get(countryIdKey) ?? null;
          const buildFallbackActivation = (requestAction) => ({
            countryId: countryConfig.id,
            ...(requestAction === 'getNumberV2' ? { statusAction: 'getStatusV2' } : {}),
          });
          const pricePlan = attempt.pricePlan || await resolvePhoneActivationPricePlan(config, countryConfig, state);
          let noNumbersObservedInCountry = false;

          const orderedPrices = reorderPriceCandidates(pricePlan.prices, acquirePriority, preferredPriceTier);
          const rangeFilteredPrices = filterPriceCandidatesWithinRange(
            orderedPrices,
            minPriceLimit,
            maxPriceLimit
          );
          const candidatePrices = rangeFilteredPrices.length
            ? rangeFilteredPrices
            : (hasPriceBounds ? [] : orderedPrices);
          const floorFilteredPrices = filterPriceCandidatesAboveFloor(candidatePrices, countryPriceFloor);
          const hasCountryPriceFloor = (
            countryPriceFloor !== null
            && Number.isFinite(Number(countryPriceFloor))
            && Number(countryPriceFloor) > 0
          );
          const hasAlternativeCountries = countryAttempts.some((entry) => (
            String(normalizeCountryId(entry?.countryConfig?.id, 0))
            !== String(normalizeCountryId(countryConfig?.id, 0))
          ));
          // Same rule as 5sim/NexSMS: once floor is set, never re-try lower/equal tiers.
          // Keep a probe fallback only for HeroSMS (single-country/no-tier environments),
          // so replacement-limit behavior remains stable while still allowing country fallback.
          const pricesToTry = hasCountryPriceFloor
            ? (
              floorFilteredPrices.length
                ? floorFilteredPrices
                : (hasAlternativeCountries ? [] : candidatePrices.slice(0, 1))
            )
            : (floorFilteredPrices.length ? floorFilteredPrices : candidatePrices);
          const rawTierText = Array.isArray(pricePlan?.prices) && pricePlan.prices.length
            ? pricePlan.prices
                .map((value) => (value === null || value === undefined ? 'auto' : String(value)))
                .join(', ')
            : 'none';
          await addLog(
            `Step 9: HeroSMS ${countryConfig.label} price plan: tiers=[${rawTierText}], user cap=${pricePlan?.userLimit ?? 'not set'}, catalog lowest=${pricePlan?.minCatalogPrice ?? 'unknown'}.`,
            'info'
          );
          if (pricesToTry.length > 1 || countryPriceFloor !== null) {
            const tierText = pricesToTry
              .map((value) => (value === null || value === undefined ? 'auto' : String(value)))
              .join(', ');
            await addLog(
              `Step 9: HeroSMS ${countryConfig.label} candidate prices this round: ${tierText}${countryPriceFloor !== null ? ` (above ${countryPriceFloor})` : ''}.`,
              'info'
            );
          }
          if (!pricesToTry.length) {
            if (priceRange.hasMinPriceLimit && !rangeFilteredPrices.length) {
              noNumbersByCountry.push(
                `${countryConfig.label}: No numbers available in price range ${formatPhonePriceRangeText(minPriceLimit, maxPriceLimit)}`
              );
              continue;
            }
            if (
              countryPriceFloor !== null
              && Array.isArray(pricePlan.prices)
              && pricePlan.prices.length > 0
            ) {
              noNumbersByCountry.push(
                `${countryConfig.label}: Current fallback attempt has no price tier above ${countryPriceFloor}`
              );
              continue;
            }
            if (
              pricePlan.userLimit !== null
              && pricePlan.minCatalogPrice !== null
              && pricePlan.minCatalogPrice > pricePlan.userLimit
            ) {
              noNumbersByCountry.push(
                `${countryConfig.label}: No numbers available within price cap ${pricePlan.userLimit}; platform lowest price=${pricePlan.minCatalogPrice}`
              );
            } else {
              noNumbersByCountry.push(
                `${countryConfig.label}: ${lastFailureText || 'NO_NUMBERS'}`
              );
              retryableNoNumberCountries.push(countryConfig.label);
            }
            continue;
          }
          for (const maxPrice of pricesToTry) {
            for (const requestAction of requestActions) {
              try {
                const fixedPrice = !Boolean(pricePlan.syntheticUserLimitProbe);
                await addLog(
                  `Step 9: HeroSMS ${countryConfig.label} is trying ${formatHeroSmsActionName(requestAction)} at price tier ${maxPrice === null || maxPrice === undefined ? 'auto' : maxPrice}.`,
                  'info'
                );
                const payload = await requestPhoneActivationWithPrice(
                  config,
                  countryConfig,
                  requestAction,
                  maxPrice,
                  {
                    userLimit: pricePlan.userLimit,
                    userMinLimit: minPriceLimit,
                    fixedPrice,
                  }
                );
                const activation = parseActivationPayload(payload, buildFallbackActivation(requestAction));
                if (activation) {
                  const numericPrice = Number(maxPrice);
                  rememberActivationAcquiredPrice(activation, numericPrice);
                  return {
                    ...activation,
                    countryId: countryConfig.id,
                  };
                }
                const payloadText = describeHeroSmsPayload(payload);
                if (isHeroSmsNoNumbersPayload(payload)) {
                  noNumbersObservedInCountry = true;
                  lastFailureText = payloadText || lastFailureText;
                  continue;
                }
                if (isHeroSmsTerminalError(payload)) {
                  throw createHeroSmsActionFailureError(requestAction, payloadText || 'empty response');
                }
                lastFailureText = payloadText || lastFailureText;
                lastError = createHeroSmsActionFailureError(requestAction, payloadText || 'empty response');
              } catch (error) {
                if (error?.localizedPhoneSmsFailure) {
                  throw error;
                }
                const payloadOrMessage = error?.payload || error?.message;
                if (isHeroSmsTerminalError(payloadOrMessage)) {
                  throw createHeroSmsActionFailureError(requestAction, payloadOrMessage || 'empty response');
                }
                if (isHeroSmsNoNumbersPayload(payloadOrMessage)) {
                  noNumbersObservedInCountry = true;
                  lastFailureText = describeHeroSmsPayload(payloadOrMessage) || lastFailureText;
                  continue;
                }
                lastFailureText = describeHeroSmsPayload(payloadOrMessage) || lastFailureText;
                lastError = error;
              }
            }
          }

          if (noNumbersObservedInCountry) {
            const tiersTriedText = pricesToTry
              .map((value) => (value === null || value === undefined ? 'auto' : String(value)))
              .join(', ');
            if (
              pricePlan.userLimit !== null
              && pricePlan.minCatalogPrice !== null
              && pricePlan.minCatalogPrice > pricePlan.userLimit
            ) {
              noNumbersByCountry.push(
                `${countryConfig.label}: No numbers available within price cap ${pricePlan.userLimit}; platform lowest price=${pricePlan.minCatalogPrice}`
              );
            } else {
              noNumbersByCountry.push(
                `${countryConfig.label}: ${lastFailureText || 'NO_NUMBERS'}${tiersTriedText ? ` (tiers tried: ${tiersTriedText})` : ''}`
              );
              retryableNoNumberCountries.push(countryConfig.label);
            }
            continue;
          }
        }

        finalNoNumbersByCountry = noNumbersByCountry;
        finalLastError = lastError;
        finalLastFailureText = lastFailureText;

        if (
          noNumbersByCountry.length
          && round < maxAcquireRounds
          && retryableNoNumberCountries.length > 0
        ) {
          await addLog(
            `Step 9: HeroSMS has no available numbers (round ${round}/${maxAcquireRounds}). Retrying in ${Math.ceil(retryDelayMs / 1000)} seconds. Countries: ${retryableNoNumberCountries.join(', ')}.`,
            'warn'
          );
          await addLog(
            `Step 9: HeroSMS has no available numbers (round ${round}/${maxAcquireRounds}). Retrying in ${Math.ceil(retryDelayMs / 1000)} seconds. Countries: ${retryableNoNumberCountries.join(', ')}.`,
            'warn'
          );
          await sleepWithStop(retryDelayMs);
          continue;
        }

        break;
      }

      if (finalNoNumbersByCountry.length) {
        throw new Error(
          `HeroSMS tried ${countryCandidates.length} candidate countries; none had available numbers: ${finalNoNumbersByCountry.join(' | ')}.`
        );
      }
      if (finalLastError) {
        throw finalLastError;
      }
      throw new Error(`HeroSMS failed to acquire phone number; last status: ${finalLastFailureText || 'unknown'}.`);
    }

    async function reactivatePhoneActivation(state = {}, activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        throw new Error('No reusable SMS phone order available.');
      }
      if (getActivationProviderId(normalizedActivation, state) === PHONE_SMS_PROVIDER_FIVE_SIM) {
        const provider = getFiveSimProviderForState(state);
        if (provider) {
          return provider.reuseActivation(state, normalizedActivation);
        }
      }

      const config = resolvePhoneConfig(state);
      if (config.provider === PHONE_SMS_PROVIDER_5SIM) {
        const payload = await fetchFiveSimPayload(
          config,
          `/user/check/${encodeURIComponent(normalizedActivation.activationId)}`,
          '5sim reuse activation baseline'
        );
        return {
          ...normalizedActivation,
          source: '5sim-retained-reuse',
          ignoredPhoneCodeKeys: collectPhoneSmsCodeKeys(payload),
        };
      }
      if (config.provider === PHONE_SMS_PROVIDER_NEXSMS) {
        throw new Error('NexSMS current flow does not support reusing phone orders.');
      }
      const payload = await fetchHeroSmsPayload(config, {
        action: 'reactivate',
        id: normalizedActivation.activationId,
      }, 'HeroSMS reactivate');
      const nextActivation = parseActivationPayload(payload, normalizedActivation);
      if (!nextActivation) {
        const text = describeHeroSmsPayload(payload);
        throw new Error(`HeroSMS reuse phone number failed: ${text || 'empty response'}`);
      }
      return nextActivation;
    }

    async function setPhoneActivationStatus(state = {}, activation, status, actionLabel) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        return '';
      }
      const normalizedStatus = Math.floor(Number(status) || 0);
      if (
        (normalizedStatus === 6 || normalizedStatus === 8)
        && shouldSkipTerminalStatusForFreeReuse(state, normalizedActivation)
      ) {
        const identifier = normalizedActivation.phoneNumber || normalizedActivation.activationId || 'current activation';
        await addLog(
          `Step 9: Free-reuse mode only requests SMS; skipping setStatus(${normalizedStatus}) for ${identifier}.`,
          'info'
        );
        return `free reuse setStatus(${normalizedStatus}) skipped`;
      }
      const config = resolvePhoneConfig(state);
      if (config.provider === PHONE_SMS_PROVIDER_5SIM) {
        const endpoint = normalizedStatus === 6
          ? `/user/finish/${normalizedActivation.activationId}`
          : `/user/cancel/${normalizedActivation.activationId}`;
        const payload = await fetchFiveSimPayload(config, endpoint, actionLabel || '5sim set status');
        return describeFiveSimPayload(payload);
      }
      if (config.provider === PHONE_SMS_PROVIDER_NEXSMS) {
        if (normalizedStatus === 6) {
          return 'NexSMS complete skipped';
        }
        const payload = await fetchNexSmsPayload(
          config,
          '/api/close/activation',
          actionLabel || 'NexSMS close activation',
          {
            method: 'POST',
            body: {
              phoneNumber: normalizedActivation.phoneNumber,
            },
          }
        );
        if (!isNexSmsSuccessPayload(payload)) {
          throw createPhoneSmsActionFailureError('NexSMS close activation', describeNexSmsPayload(payload) || 'empty response');
        }
        return describeNexSmsPayload(payload);
      }
      const payload = await fetchHeroSmsPayload(config, {
        action: 'setStatus',
        id: normalizedActivation.activationId,
        status: normalizedStatus,
      }, actionLabel);
      return describeHeroSmsPayload(payload);
    }

    async function completePhoneActivation(state = {}, activation) {
      if (shouldSkipTerminalStatusForFreeReuse(state, activation)) {
        const normalizedActivation = normalizeActivation(activation);
        const identifier = normalizedActivation?.phoneNumber || normalizedActivation?.activationId || 'current activation';
        await addLog(
          `Step 9: Free-reuse mode only requests SMS; skipping SMS completion status for ${identifier}.`,
          'info'
        );
        return;
      }
      if (getActivationProviderId(activation, state) === PHONE_SMS_PROVIDER_FIVE_SIM) {
        const provider = getFiveSimProviderForState(state);
        if (provider) {
          await provider.finishActivation(state, activation);
          return;
        }
      }
      await setPhoneActivationStatus(state, activation, 6, 'HeroSMS setStatus(6)');
    }

    async function cancelPhoneActivation(state = {}, activation) {
      try {
        const normalizedActivation = normalizeActivation(activation);
        if (shouldSkipTerminalStatusForFreeReuse(state, activation)) {
          const identifier = normalizedActivation?.phoneNumber || normalizedActivation?.activationId || 'current activation';
          await addLog(
            `Step 9: Free-reuse mode only requests SMS; skipping SMS cancel status for ${identifier}.`,
            'info'
          );
          return;
        }
        if (getActivationProviderId(activation, state) === PHONE_SMS_PROVIDER_FIVE_SIM) {
          const provider = getFiveSimProviderForState(state);
          if (provider) {
            await provider.cancelActivation(state, activation);
            return;
          }
        }
        await setPhoneActivationStatus(state, activation, 8, 'HeroSMS setStatus(8)');
      } catch (_) {
        // Best-effort cleanup.
      }
    }

    async function retireFreeReusableActivation(reason = '') {
      const suffix = reason ? ` ${reason}` : '';
      await addLog(`Step 9: Cleared free-reuse phone number record.${suffix}`, 'warn');
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
          `Step 9: Removed phone number ${rejectedPhoneNumber} from reuse records.${reason || ' Target site rejected this number.'}`,
          'warn'
        );
      }
    }

    function isFreeAutoReuseActivation(activation) {
      return normalizeActivation(activation)?.source === 'free-auto-reuse';
    }

    function isFiveSimRetainedReuseActivation(activation) {
      const normalizedActivation = normalizeActivation(activation);
      return Boolean(
        normalizedActivation
        && normalizedActivation.provider === PHONE_SMS_PROVIDER_5SIM
        && normalizedActivation.source === '5sim-retained-reuse'
      );
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
              `Step 9: Free-reuse mode only requests SMS; skipping SMS ban status for ${identifier}.`,
            'info'
          );
          return;
        }
        if (getActivationProviderId(activation, state) === PHONE_SMS_PROVIDER_FIVE_SIM) {
          const provider = getFiveSimProviderForState(state);
          if (provider) {
            await provider.banActivation(state, activation);
            return;
          }
        }
        await setPhoneActivationStatus(state, activation, 8, 'HeroSMS setStatus(8)');
      } catch (_) {
        // Best-effort cleanup.
      }
    }

    async function requestAdditionalPhoneSms(state = {}, activation) {
      const config = resolvePhoneConfig(state);
      if (config.provider !== PHONE_SMS_PROVIDER_HERO) {
        return;
      }
      try {
        if (getActivationProviderId(activation, state) === PHONE_SMS_PROVIDER_FIVE_SIM) {
          // 5sim does not expose a HeroSMS-style setStatus(3) resend primitive.
          return;
        }
        await setPhoneActivationStatus(state, activation, 3, 'HeroSMS setStatus(3)');
      } catch (_) {
        // Best-effort request only.
      }
    }

    function isHeroSmsWaitingStatusText(text) {
      return /^STATUS_(WAIT_CODE|WAIT_RETRY|WAIT_RESEND)(?::.+)?$/i.test(String(text || '').trim());
    }

    function isHeroSmsReadyForFreshSmsText(text) {
      return /^STATUS_WAIT_CODE(?::.+)?$/i.test(String(text || '').trim());
    }

    function isHeroSmsCancelledStatusText(text) {
      return /^STATUS_CANCEL$/i.test(String(text || '').trim());
    }

    async function prepareFreeReusablePhoneActivation(state = {}, activation) {
      const normalizedActivation = normalizeFreeReusablePhoneActivation(activation);
      if (!normalizedActivation) {
        return {
          ok: false,
          reason: 'missing_free_reusable_activation',
          message: 'Free-reuse phone activation record missing.',
        };
      }
      if (normalizedActivation.provider === PHONE_SMS_PROVIDER_5SIM) {
        const provider = getFiveSimProviderForState(state);
        if (provider) {
          let retainedActivation = null;
          try {
            retainedActivation = await provider.reuseActivation(state, normalizedActivation);
          } catch (error) {
            return {
              ok: false,
              reason: 'five_sim_reuse_check_failed',
              message: error.message || '5sim phone reuse baseline check failed.',
            };
          }
          return {
            ok: true,
            activation: {
              ...retainedActivation,
              source: 'free-auto-reuse',
            },
          };
        }
        return {
          ok: true,
          activation: {
            ...normalizedActivation,
            source: 'free-auto-reuse',
          },
        };
      }
      if (!String(normalizedActivation.activationId || '').trim()) {
        return {
          ok: false,
          reason: 'missing_activation_id',
          message: 'Saved free-reuse phone number has no HeroSMS activation ID; cannot reactivate automatically.',
        };
      }

      const statusAction = resolveActivationStatusAction(normalizedActivation);
      const config = resolveHeroSmsPhoneConfig(state);
      const start = Date.now();
      let lastStatus = '';
      let prepareRound = 0;

      while (
        Date.now() - start < FREE_PHONE_REUSE_PREPARE_TIMEOUT_MS
        && prepareRound < FREE_PHONE_REUSE_PREPARE_MAX_ROUNDS
      ) {
        throwIfStopped();
        prepareRound += 1;

        try {
          await setPhoneActivationStatus(
            { ...state, phoneSmsProvider: PHONE_SMS_PROVIDER_HERO },
            normalizedActivation,
            3,
            'HeroSMS auto-reuse set order status'
          );
        } catch (error) {
          return {
            ok: false,
            reason: 'set_status_failed',
            message: error.message || 'HeroSMS update order status failed.',
            lastStatus,
            prepareRound,
          };
        }

        await addLog(
          `Step 9: Auto free-reuse refreshed ${normalizedActivation.phoneNumber}; will check waiting status in ${Math.ceil(FREE_PHONE_REUSE_PREPARE_INTERVAL_MS / 1000)} seconds (${prepareRound}/${FREE_PHONE_REUSE_PREPARE_MAX_ROUNDS}).`,
          'info'
        );
        await sleepWithStop(FREE_PHONE_REUSE_PREPARE_INTERVAL_MS);

        try {
          const payload = await fetchHeroSmsPayload(config, {
            action: statusAction,
            id: normalizedActivation.activationId,
          }, `HeroSMS auto-reuse ${statusAction}`);
          const statusText = describeHeroSmsPayload(payload);
          lastStatus = statusText;
          await addLog(
            `Step 9: Auto free-reuse number ${normalizedActivation.phoneNumber} status: ${statusText || 'empty response'} (${prepareRound}/${FREE_PHONE_REUSE_PREPARE_MAX_ROUNDS}).`,
            'info'
          );

          const v2Waiting = statusAction === 'getStatusV2'
            && payload
            && typeof payload === 'object'
            && !Array.isArray(payload)
            && !payload.sms?.code
            && !payload.call?.code;
          if (isHeroSmsReadyForFreshSmsText(statusText) || isHeroSmsWaitingStatusText(statusText) || v2Waiting) {
            return {
              ok: true,
              activation: {
                ...normalizedActivation,
                source: 'free-auto-reuse',
              },
            };
          }
          if (/^STATUS_OK:/i.test(statusText)) {
            await addLog(
              `Step 9: Auto free-reuse still sees the old verification code; will refresh again and wait for SMS status.`,
              'warn'
            );
            continue;
          }
          if (isHeroSmsCancelledStatusText(statusText)) {
            return {
              ok: false,
              reason: 'activation_cancelled',
              message: 'HeroSMS order was canceled before auto free-reuse.',
              lastStatus,
              prepareRound,
            };
          }
        } catch (error) {
          return {
            ok: false,
            reason: 'get_status_failed',
            message: error.message || 'HeroSMS query SMS status failed.',
            lastStatus,
            prepareRound,
          };
        }
      }

      return {
        ok: false,
        reason: 'prepare_timeout',
        message: `Timed out waiting for the saved phone number to enter the SMS-waiting state. Last status: ${lastStatus || 'unknown'}.`,
        lastStatus,
        prepareRound,
      };
    }

    async function pollPhoneActivationCode(state = {}, activation, options = {}) {
      const normalizedActivation = normalizeActivation(activation);
      if (!normalizedActivation) {
        throw new Error('Missing phone SMS order.');
      }
      if (getActivationProviderId(normalizedActivation, state) === PHONE_SMS_PROVIDER_FIVE_SIM) {
        const provider = getFiveSimProviderForState(state);
        if (provider) {
          return provider.pollActivationCode(state, normalizedActivation, options);
        }
      }
      const statusAction = resolveActivationStatusAction(normalizedActivation);

      const config = resolvePhoneConfig(state);
      const configuredTimeoutMs = Math.max(1000, Number(options.timeoutMs) || 0);
      const timeoutMs = configuredTimeoutMs || (
        typeof getOAuthFlowStepTimeoutMs === 'function'
          ? await getOAuthFlowStepTimeoutMs(
            DEFAULT_PHONE_POLL_TIMEOUT_MS,
            { step: 9, actionLabel: options.actionLabel || 'poll phone verification code' }
          )
          : DEFAULT_PHONE_POLL_TIMEOUT_MS
      );
      const intervalMs = Math.max(1000, Number(options.intervalMs) || DEFAULT_PHONE_POLL_INTERVAL_MS);
      const maxRoundsRaw = Math.floor(Number(options.maxRounds));
      const maxRounds = Number.isFinite(maxRoundsRaw) && maxRoundsRaw > 0 ? maxRoundsRaw : 0;
      const start = Date.now();
      let lastResponse = '';
      let pollCount = 0;
      const extractVerificationCode = (rawCode) => {
        const trimmed = String(rawCode || '').trim();
        if (!trimmed) {
          return '';
        }
        const digitMatch = trimmed.match(/\b(\d{4,8})\b/);
        return digitMatch?.[1] || '';
      };
      const emitWaitingForCode = async (statusText) => {
        if (typeof options.onWaitingForCode === 'function') {
          await options.onWaitingForCode({
            activation: normalizedActivation,
            elapsedMs: Date.now() - start,
            pollCount,
            statusText,
            timeoutMs,
          });
        }
      };

      if (config.provider === PHONE_SMS_PROVIDER_5SIM) {
        while (Date.now() - start < timeoutMs) {
          if (maxRounds > 0 && pollCount >= maxRounds) {
            break;
          }
          throwIfStopped();
          const payload = await fetchFiveSimPayload(
            config,
            `/user/check/${normalizedActivation.activationId}`,
            '5sim check activation'
          );
          const text = describeFiveSimPayload(payload);
          lastResponse = text;
          pollCount += 1;

          const smsList = Array.isArray(payload?.sms) ? payload.sms : [];
          const ignoredPhoneCodeKeys = new Set(normalizeStringList(normalizedActivation.ignoredPhoneCodeKeys));
          const directCode = extractVerificationCode(payload?.code || payload?.sms_code);
          let smsCode = '';
          for (let index = smsList.length - 1; index >= 0; index -= 1) {
            const smsItem = smsList[index] || {};
            if (ignoredPhoneCodeKeys.has(buildPhoneSmsCodeKey(smsItem))) {
              continue;
            }
            smsCode = extractVerificationCode(smsItem?.code || smsItem?.text || smsItem?.message || '');
            if (smsCode) {
              break;
            }
          }
          smsCode = directCode || smsCode;
          if (smsCode) {
            return smsCode;
          }

          const statusText = String(payload?.status || '').trim().toUpperCase();
          if (/^(RECEIVED|PENDING|RETRY|PREPARE|WAITING)$/i.test(statusText) || !statusText) {
            const waitingStatusText = statusText || text || 'PENDING';
            if (typeof options.onStatus === 'function') {
              await options.onStatus({
                activation: normalizedActivation,
                elapsedMs: Date.now() - start,
                pollCount,
                statusText: waitingStatusText,
                timeoutMs,
              });
            }
            await emitWaitingForCode(waitingStatusText);
            await sleepWithStop(intervalMs);
            continue;
          }

          if (/^(CANCELED|CANCELLED|BANNED|FINISHED|EXPIRED|TIMEOUT)$/i.test(statusText)) {
            throw new Error(`5sim order ended before SMS arrived: ${statusText}`);
          }

          throw createPhoneSmsActionFailureError('5sim check activation', text || statusText || 'empty response');
        }

        throw buildPhoneCodeTimeoutError(lastResponse);
      }

      if (config.provider === PHONE_SMS_PROVIDER_NEXSMS) {
        while (Date.now() - start < timeoutMs) {
          if (maxRounds > 0 && pollCount >= maxRounds) {
            break;
          }
          throwIfStopped();
          const payload = await fetchNexSmsPayload(
            config,
            '/api/sms/messages',
            'NexSMS get sms messages',
            {
              query: {
                phoneNumber: normalizedActivation.phoneNumber,
                format: 'json_latest',
              },
            }
          );
          const text = describeNexSmsPayload(payload);
          lastResponse = text;
          pollCount += 1;

          if (typeof options.onStatus === 'function') {
            await options.onStatus({
              activation: normalizedActivation,
              elapsedMs: Date.now() - start,
              pollCount,
              statusText: text || 'PENDING',
              timeoutMs,
            });
          }

          if (isNexSmsSuccessPayload(payload)) {
            const directCode = extractVerificationCode(payload?.data?.code || payload?.data?.text || '');
            if (directCode) {
              return directCode;
            }
            await emitWaitingForCode(text || 'PENDING');
            await sleepWithStop(intervalMs);
            continue;
          }

          if (isNexSmsPendingMessage(payload)) {
            await emitWaitingForCode(text || 'PENDING');
            await sleepWithStop(intervalMs);
            continue;
          }
          if (isNexSmsTerminalError(payload)) {
            throw createPhoneSmsActionFailureError('NexSMS get sms messages', text || 'unknown terminal error');
          }
          await emitWaitingForCode(text || 'PENDING');
          await sleepWithStop(intervalMs);
        }

        throw buildPhoneCodeTimeoutError(lastResponse);
      }

      while (Date.now() - start < timeoutMs) {
        if (maxRounds > 0 && pollCount >= maxRounds) {
          break;
        }
        throwIfStopped();
        const payload = await fetchHeroSmsPayload(config, {
          action: statusAction,
          id: normalizedActivation.activationId,
        }, `HeroSMS ${statusAction}`);
        const text = describeHeroSmsPayload(payload);
        lastResponse = text;
        pollCount += 1;

        if (typeof options.onStatus === 'function') {
          await options.onStatus({
            activation: normalizedActivation,
            elapsedMs: Date.now() - start,
            pollCount,
            statusText: text,
            timeoutMs,
          });
        }

        const v2Code = (
          payload
          && typeof payload === 'object'
          && !Array.isArray(payload)
          && (
            extractVerificationCode(payload.sms?.code)
            || extractVerificationCode(payload.call?.code)
          )
        );
        if (v2Code) {
          return v2Code;
        }

        const okMatch = text.match(/^STATUS_OK:(.+)$/i);
        if (okMatch) {
          const extractedCode = extractVerificationCode(okMatch[1] || '');
          if (extractedCode) {
            return extractedCode;
          }
          await emitWaitingForCode(text || 'STATUS_OK');
          await sleepWithStop(intervalMs);
          continue;
        }

        if (/^STATUS_(WAIT_CODE|WAIT_RETRY|WAIT_RESEND)(?::.+)?$/i.test(text)) {
          await emitWaitingForCode(text);
          await sleepWithStop(intervalMs);
          continue;
        }

        if (statusAction === 'getStatusV2' && payload && typeof payload === 'object' && !Array.isArray(payload)) {
          await emitWaitingForCode(text || 'PENDING');
          await sleepWithStop(intervalMs);
          continue;
        }

        if (/^STATUS_CANCEL$/i.test(text)) {
          throw new Error('HeroSMS order was cancelled before SMS arrived.');
        }

        throw createHeroSmsActionFailureError(statusAction, text || 'empty response');
      }

      throw buildPhoneCodeTimeoutError(lastResponse);
    }

    async function readPhonePageState(tabId, timeoutMs = 10000) {
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const deadlineMs = Math.max(1, Math.floor(Number(timeoutMs) || 0));
      let timeoutId = null;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Step ${visibleStep}: Timed out waiting for auth page status check.`));
        }, deadlineMs);
      });
      const readPromise = (async () => {
        await ensureStep8SignupPageReady(tabId, {
          timeoutMs: deadlineMs,
          logMessage: 'Step 9: Waiting for auth page script recovery before continuing phone verification.',
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
          logMessage: 'Step 9: Auth page is switching. Waiting to re-check phone verification status...',
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
      if (normalizePhoneSmsProvider(providerId) === PHONE_SMS_PROVIDER_FIVE_SIM) {
        const provider = getFiveSimProviderForState(state);
        if (provider) {
          return provider.resolveCountryCandidates(state);
        }
        return resolveFiveSimCountryCandidates(state);
      }
      if (normalizePhoneSmsProvider(providerId) === PHONE_SMS_PROVIDER_NEXSMS) {
        return resolveNexSmsCountryCandidates(state);
      }
      return resolveCountryCandidates(state);
    }

    function resolveCountryConfigFromActivation(activation, fallbackState = {}) {
      const providerId = getActivationProviderId(activation, fallbackState);
      const candidates = resolveCountryCandidatesForProvider(fallbackState, providerId);
      if (activation && typeof activation === 'object') {
        if (providerId === PHONE_SMS_PROVIDER_FIVE_SIM) {
          const countryId = normalizeFiveSimCountryId(activation.countryId, '');
          if (countryId) {
            const matched = candidates.find((entry) => String(entry.id) === countryId);
            if (matched) return matched;
            return {
              id: countryId,
              label: normalizeFiveSimCountryLabel(activation.countryLabel, countryId),
            };
          }
        } else {
          const inferredCountry = inferHeroSmsCountryFromPhoneNumber(activation.phoneNumber);
          const rawCountryId = normalizeCountryId(activation.countryId, 0);
          const hasExplicitCountry = Object.prototype.hasOwnProperty.call(activation, 'countryId')
            && Number.isFinite(rawCountryId)
            && rawCountryId > 0
            && !(activation.manualOnly && rawCountryId === HERO_SMS_COUNTRY_ID && inferredCountry?.id && inferredCountry.id !== rawCountryId);
          const countryId = hasExplicitCountry ? rawCountryId : normalizeCountryId(inferredCountry?.id, rawCountryId);
          const countryLabel = hasExplicitCountry
            ? activation.countryLabel
            : (inferredCountry?.label || activation.countryLabel);
          if (countryId > 0) {
            const matched = candidates.find((entry) => entry.id === countryId);
            if (matched) {
              return matched;
            }
            return {
              id: countryId,
              label: normalizeCountryLabel(countryLabel, `Country #${countryId}`),
            };
          }
        }
      }
      return candidates[0] || (providerId === PHONE_SMS_PROVIDER_FIVE_SIM
        ? { id: 'england', label: 'England' }
        : resolveCountryConfig(fallbackState));
    }

    async function submitPhoneNumber(tabId, phoneNumber, activation = null) {
      const state = await getState();
      const countryConfig = resolveCountryConfigFromActivation(activation, state);
      const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
      const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
        ? await getOAuthFlowStepTimeoutMs(30000, { step: visibleStep, actionLabel: 'Submit add phone' })
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
        logMessage: 'Step 9: Waiting for add phone page to be ready...',
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
        ? await getOAuthFlowStepTimeoutMs(45000, { step: visibleStep, actionLabel: 'Submit phone verification code' })
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
        logMessage: 'Step 9: Waiting for phone verification code page to be ready before filling SMS code...',
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
        logMessage: 'Step 9: Waiting for phone verification code resend button to appear...',
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
        ? await getOAuthFlowStepTimeoutMs(45000, { step: visibleStep, actionLabel: 'Submit signup phone verification code' })
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
        logMessage: 'Step 4: Waiting for signup phone verification code page to be ready before filling SMS code...',
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
        ? await getOAuthFlowStepTimeoutMs(65000, { step: visibleStep, actionLabel: 'Resend signup phone verification code' })
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
        logMessage: 'Step 4: Waiting for signup phone verification code resend button to appear...',
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
        logMessage: 'Step 9: Returning to add phone page to change number...',
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
        await addLog(`Step 9: Hit a transient issue while checking the phone resend error; ignored. ${error.message}`, 'warn');
        return {
          hasError: false,
          reason: '',
          message: '',
        };
      }
    }

    function usePageProbeForPhoneResend(state = {}) {
      const provider = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      return provider === PHONE_SMS_PROVIDER_HERO || provider === PHONE_SMS_PROVIDER_NEXSMS || provider === PHONE_SMS_PROVIDER_5SIM;
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
          `Saved phone number ${freeReusableActivation.phoneNumber} reached ${freeReusableActivation.successfulUses}/${freeReusableActivation.maxUses} uses.`
        );
        return null;
      }

      const canPrepareAutomaticFreeReuse = normalizeFreePhoneReuseAutoEnabled(state)
        && !freeReusableActivation.manualOnly
        && Boolean(String(freeReusableActivation.activationId || '').trim());

      if (canPrepareAutomaticFreeReuse) {
        await addLog(
          `Step 9: Preparing auto free-reuse of saved phone number ${freeReusableActivation.phoneNumber} (${freeReusableActivation.successfulUses + 1}/${freeReusableActivation.maxUses}).`,
          'info'
        );
        const prepared = await prepareFreeReusablePhoneActivation(state, freeReusableActivation);
        if (!prepared.ok) {
          const reason = prepared.message || prepared.reason || 'unknown error';
          const stopMessage = `Auto free-reuse preparation failed: ${freeReusableActivation.phoneNumber} did not reach SMS-waiting state. Not purchasing a new HeroSMS number this run. Reason: ${reason}`;
          await addLog(
            `Step 9: Auto free-reuse preparation failed; stopping this SMS attempt and not purchasing a new HeroSMS number. ${reason}`,
            'error'
          );
          if (prepared.reason === 'activation_cancelled') {
            await retireFreeReusableActivation(
              `Auto free-reuse number ${freeReusableActivation.phoneNumber} was canceled by HeroSMS.`
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
      const message = `Starting manual reuse of phone ${freeReusableActivation.phoneNumber}. Please refresh on SMS.`;
      await addLog(`Step 9: ${message}`, 'warn');
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
      const provider = normalizePhoneSmsProvider(state?.phoneSmsProvider || DEFAULT_PHONE_SMS_PROVIDER);
      const providerOrder = resolvePhoneProviderOrder(state, provider);
      const countryCandidates = resolveCountryCandidatesForProvider(state, provider);
      if (
        (provider === PHONE_SMS_PROVIDER_5SIM || provider === PHONE_SMS_PROVIDER_NEXSMS)
        && !countryCandidates.length
      ) {
        throw new Error(`Step ${getActivePhoneVerificationVisibleStep()}: ${provider === PHONE_SMS_PROVIDER_5SIM ? '5sim' : 'NexSMS'} has no country selected. Please select at least 1 country in SMS settings.`);
      }
      const normalizeCountryKey = (value) => (
        provider === PHONE_SMS_PROVIDER_5SIM
          ? normalizeFiveSimCountryCode(value, '')
          : (
            provider === PHONE_SMS_PROVIDER_NEXSMS
              ? String(normalizeNexSmsCountryId(value, -1))
              : String(normalizeCountryId(value, 0))
          )
      );
      const blockedCountryIds = new Set(
        (Array.isArray(options?.blockedCountryIds) ? options.blockedCountryIds : [])
          .map((value) => normalizeCountryKey(value))
          .filter((id) => (
            provider === PHONE_SMS_PROVIDER_NEXSMS
              ? (id !== '' && id !== null && id !== undefined)
              : Boolean(id && id !== '0')
          ))
      );
      const allowedCountryIds = new Set(
        countryCandidates
          .map((entry) => normalizeCountryKey(entry.id || entry.code))
          .filter((id) => (
            provider === PHONE_SMS_PROVIDER_NEXSMS
              ? (id !== '' && id !== null && id !== undefined && !blockedCountryIds.has(id))
              : Boolean(id && id !== '0' && !blockedCountryIds.has(id))
          ))
      );
      const preferredCountryLabel = countryCandidates[0]?.label || (
        provider === PHONE_SMS_PROVIDER_5SIM
          ? ''
          : (
            provider === PHONE_SMS_PROVIDER_NEXSMS
              ? ''
              : HERO_SMS_COUNTRY_LABEL
          )
      );
      const resolveCountryLabelById = (countryId) => {
        const normalizedCountryKey = normalizeCountryKey(countryId);
        return countryCandidates.find((entry) => normalizeCountryKey(entry.id || entry.code) === normalizedCountryKey)?.label
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
        && (provider === PHONE_SMS_PROVIDER_HERO || provider === PHONE_SMS_PROVIDER_5SIM)
        && preferredActivation.provider === provider
        && !blockedCountryIds.has(normalizeCountryKey(preferredActivation.countryId))
        && allowedCountryIds.has(normalizeCountryKey(preferredActivation.countryId))
        && preferredActivation.successfulUses < preferredActivation.maxUses
      );
      if (canTryPreferredActivation) {
        try {
          const reactivated = await reactivatePhoneActivation(state, preferredActivation);
          await addLog(
            `Step 9: Reusing manually selected number ${reactivated.phoneNumber}${reactivated.countryId ? ` (${resolveCountryLabelById(reactivated.countryId)})` : ''}.`,
            'info'
          );
          await resetPhoneNoSupplyFailureStreak(state);
          return reactivated;
        } catch (error) {
          failedPreferredActivation = preferredActivation;
          await removeReusableActivationFromPool(preferredActivation, { state }).catch(() => {});
          await addLog(
            `Step 9: Manually selected number ${preferredActivation.phoneNumber} is unavailable; will get a new number instead. ${error.message}`,
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

      if (reuseEnabled && (provider === PHONE_SMS_PROVIDER_HERO || provider === PHONE_SMS_PROVIDER_5SIM)) {
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
          if (blockedCountryIds.has(normalizeCountryKey(candidateActivation.countryId))) {
            continue;
          }
          if (!allowedCountryIds.has(normalizeCountryKey(candidateActivation.countryId))) {
            continue;
          }
          try {
            const reactivated = await reactivatePhoneActivation(state, candidateActivation);
            await addLog(
              `Step 9: Reusing ${resolveCountryLabelById(reactivated.countryId)} number ${reactivated.phoneNumber} (use ${reactivated.successfulUses + 1}/${reactivated.maxUses}).`,
              'info'
            );
            await resetPhoneNoSupplyFailureStreak(state);
            return reactivated;
          } catch (error) {
            await addLog(`Step 9: Failed to reuse number ${candidateActivation.phoneNumber}; will get a new number instead. ${error.message}`, 'warn');
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
            }
          );
          const providerLabel = getPhoneSmsProviderLabel(providerCandidate);
          const providerCountryLabel = providerCandidate === provider
            ? resolveCountryLabelById(activation.countryId)
            : String(activation?.countryLabel || activation?.countryId || '').trim();
          if (providerCandidate !== provider) {
            await addLog(
              `Step 9: Primary SMS provider ${getPhoneSmsProviderLabel(provider)} has no available numbers; falling back to ${providerLabel}${providerCountryLabel ? ` / ${providerCountryLabel}` : ''}.`,
              'warn'
            );
          }
          await addLog(
            `Step 9: Got number ${activation.phoneNumber} from ${providerLabel}${providerCountryLabel ? ` / ${providerCountryLabel}` : ''}.`,
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
            skippedFallbackProviders.push(`${providerLabel}: no country selected`);
            await addLog(
              `Step 9: Skipping fallback SMS provider ${providerLabel} because no country is selected in SMS settings.`,
              'warn'
            );
            continue;
          }
          lastProviderError = error;
          providerErrors.push(`${providerLabel}: ${formatProviderAcquireFailure(providerCandidate, providerErrorMessage)}`);
        }
      }

      if (providerErrors.length) {
        await logNoSupplyDiagnostics(state, providerOrder, providerErrors);
        const skippedSuffix = skippedFallbackProviders.length
          ? `; skipped fallback providers: ${skippedFallbackProviders.join('; ')}`
          : '';
        throw new Error(`Step ${getActivePhoneVerificationVisibleStep()}: All SMS provider candidates failed to acquire a phone number. ${providerErrors.join('; ')}${skippedSuffix}`);
      }
      throw lastProviderError || new Error(`Step ${getActivePhoneVerificationVisibleStep()}: Failed to acquire phone number order.`);
    }

    async function prepareSignupPhoneActivation(state = {}, options = {}) {
      return withPhoneVerificationLogContext({ step: 2, stepKey: 'submit-signup-email' }, async () => {
        const activation = await acquirePhoneActivation(state, {
          ...options,
          logLabel: options?.logLabel || 'Step 2',
        });
        const normalizedActivation = normalizeActivation(activation);
        if (!normalizedActivation) {
          throw new Error('Step 2: SMS provider returned an invalid phone activation.');
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
      const reusableProvider = normalizedActivation.provider;
      const canPersistReusableActivation = reusableProvider === PHONE_SMS_PROVIDER_HERO
        || reusableProvider === PHONE_SMS_PROVIDER_5SIM;
      if (!canPersistReusableActivation) {
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
      return Boolean(
        normalizedActivation
        && (
          (
            normalizedActivation.provider === PHONE_SMS_PROVIDER_HERO
            && normalizedActivation.source === 'hero-sms-new'
          )
          || normalizedActivation.provider === PHONE_SMS_PROVIDER_5SIM
        )
        && normalizedActivation.phoneCodeReceived
      );
    }

    function shouldSkipTerminalStatusForFreeReuse(state, activation) {
      if (isPhoneSignupIdentityState(state)) {
        return false;
      }
      const normalizedActivation = normalizeActivation(activation);
      if (
        !normalizedActivation
        || (
          normalizedActivation.provider !== PHONE_SMS_PROVIDER_HERO
          && normalizedActivation.provider !== PHONE_SMS_PROVIDER_5SIM
        )
      ) {
        return false;
      }
      if (isFreeAutoReuseActivation(normalizedActivation)) {
        return true;
      }
      if (isFiveSimRetainedReuseActivation(normalizedActivation)) {
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
      if (
        !normalizedActivation
        || (
          normalizedActivation.provider !== PHONE_SMS_PROVIDER_HERO
          && normalizedActivation.provider !== PHONE_SMS_PROVIDER_5SIM
        )
        || !normalizedActivation.phoneCodeReceived
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
        `Step 9: Saved free-reuse phone number ${normalizedActivation.phoneNumber} after receiving a valid SMS.`,
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
          `Step 9: Auto free-reuse phone number ${savedActivation.phoneNumber} reached ${successfulUses}/${maxUses} uses; cleared local record.`,
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
        `Step 9: Auto free-reuse phone number ${savedActivation.phoneNumber} succeeded (${successfulUses}/${maxUses}); keeping it for later signups.`,
        'info'
      );
    }

    async function markFreeReusableActivationAfterInitialSuccess(state, activation) {
      const normalizedActivation = normalizeActivation(activation);
      if (
        !normalizedActivation
        || (
          normalizedActivation.provider !== PHONE_SMS_PROVIDER_HERO
          && normalizedActivation.provider !== PHONE_SMS_PROVIDER_5SIM
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
          `Step 9: Free-reuse phone number ${savedActivation.phoneNumber} reached ${successfulUses}/${maxUses} uses; cleared local record.`,
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
        throw new Error('Missing phone SMS order.');
      }
      const providerLabel = normalizedActivation.provider === PHONE_SMS_PROVIDER_5SIM
        ? '5sim'
        : (normalizedActivation.provider === PHONE_SMS_PROVIDER_NEXSMS ? 'NexSMS' : 'HeroSMS');
      const usePageResend = normalizedActivation.provider !== PHONE_SMS_PROVIDER_5SIM;

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
          `Step 9: Waiting for number ${normalizedActivation.phoneNumber} to receive SMS (window ${windowIndex}/${timeoutWindows}, up to ${waitSeconds} seconds, polling every ${pollIntervalSeconds} seconds, max ${pollMaxRounds} polls).`,
          'info'
        );
        try {
          const code = await pollPhoneActivationCode(state, normalizedActivation, {
            actionLabel: windowIndex === 1
              ? 'Poll phone verification code from SMS provider'
              : 'Poll phone verification code from SMS provider after resend',
            timeoutMs: waitSeconds * 1000,
            intervalMs: pollIntervalSeconds * 1000,
            maxRounds: pollMaxRounds,
            onStatus: async ({ elapsedMs, pollCount, statusText }) => {
              if (/^STATUS_(WAIT_CODE|WAIT_RETRY|WAIT_RESEND)(?::.+)?$/i.test(String(statusText || '').trim())) {
                const pageError = await checkPhoneResendPageError(tabId, state);
                if (pageError?.reason === 'resend_phone_banned') {
                  throw new Error(`${PHONE_RESEND_BANNED_NUMBER_ERROR_PREFIX}${pageError.message || 'OpenAI cannot send SMS to this phone number.'}`);
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
                    `Step 9: Number ${normalizedActivation.phoneNumber} resend was rate-limited, but "treat as suspected ban" is not enabled; continuing to wait for SMS. ${pageError.message || ''}`.trim(),
                    'warn'
                  );
                }
              }
              await addLog(
                `Step 9: ${getPhoneSmsProviderLabel(normalizedActivation.provider)} number ${normalizedActivation.phoneNumber} status: ${statusText} (waited ${Math.ceil(elapsedMs / 1000)} seconds, poll ${pollCount}/${pollMaxRounds}).`,
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
                `Step 9: OpenAI cannot send SMS to number ${normalizedActivation.phoneNumber}; replacing the number immediately. ${error.message}`,
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
                `Step 9: OpenAI reports number ${normalizedActivation.phoneNumber} reached its usage limit; replacing the number immediately. ${error.message}`,
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
                `Step 9: Page hit contact-verification 500 after SMS resend; replacing the number immediately. ${error.message}`,
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
                  `Step 9: Number ${normalizedActivation.phoneNumber} resend was rate-limited and is configured as high-risk banned; replacing the number immediately. ${error.message}`,
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
                `Step 9: Number ${normalizedActivation.phoneNumber} resend was rate-limited; high-risk replacement not enabled, keeping original wait logic. ${error.message}`,
                'warn'
              );
              await sleepWithStop(pollIntervalSeconds * 1000);
              continue;
            }
            if (isPhoneActivationOrderMissingError(error, normalizedActivation.provider)) {
              await addLog(
                `Step 9: ${providerLabel} SMS order for number ${normalizedActivation.phoneNumber} has expired (${error.message || error}); replacing the number immediately.`,
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
              `Step 9: Number ${normalizedActivation.phoneNumber} did not receive SMS within ${waitSeconds} seconds; requesting resend.`,
              'warn'
            );
            if (!usePageResend) {
              await addLog(
                `Step 9: ${providerLabel} keeps the current verification page session and skips the page resend to avoid triggering 405 or rate limiting; continuing to poll the current number.`,
                'warn'
              );
              continue;
            }
            if (resendTriggeredForCurrentNumber) {
              await addLog(
                `Step 9: Number ${normalizedActivation.phoneNumber} has already triggered one page resend; to avoid rate limiting, will keep polling without clicking resend again.`,
                'warn'
              );
              continue;
            }
            try {
              const resendProbeResult = await resendPhoneVerificationCode(tabId, { probeOnly: true });
              if (isWhatsAppPhoneResendResult(resendProbeResult)) {
                await addLog(
                  `Step 9: Page resend entry shows WhatsApp channel (${resendProbeResult.channelText || resendProbeResult.text || 'WhatsApp'}); the SMS provider cannot read WhatsApp messages, so replacing the number immediately.`,
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
                      `Step 9: Page resend entry switched to WhatsApp channel (${resendResult.channelText || resendResult.text || 'WhatsApp'}); the SMS provider cannot read WhatsApp messages, so replacing the number immediately.`,
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
              await addLog('Step 9: Clicked "Resend SMS" on the phone verification code page.', 'info');
            } catch (resendError) {
              if (isStopRequestedError(resendError)) {
                throw resendError;
              }
              if (isPhoneResendBannedNumberError(resendError)) {
                await addLog(
                  `Step 9: OpenAI cannot send SMS to number ${normalizedActivation.phoneNumber}; replacing the number immediately. ${resendError.message}`,
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
                  `Step 9: Number ${normalizedActivation.phoneNumber} SMS resend was rate-limited; replacing the number immediately. ${resendError.message}`,
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
                  `Step 9: Page hit contact-verification 500 after SMS resend; replacing the number immediately. ${resendError.message}`,
                  'warn'
                );
                await clearPhoneRuntimeCountdown();
                return {
                  code: '',
                  replaceNumber: true,
                  reason: 'resend_server_error',
                };
              }
              await addLog(`Step 9: Failed to click the resend button on the phone verification code page. ${resendError.message}`, 'warn');
            }
            continue;
          }

          await addLog(
            `Step 9: Number ${normalizedActivation.phoneNumber} did not receive SMS in ${timeoutWindows} consecutive windows; will replace the number within step 9.`,
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

      throw new Error('Phone verification incomplete.');
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
        throw new Error(options?.missingActivationMessage || `Step ${visibleStep}: Phone activation record missing. Please re-execute prerequisite steps.`);
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
            `Step ${visibleStep}: Waiting for the SMS code on ${normalizedActivation.phoneNumber} (window ${windowIndex}/${timeoutWindows}, up to ${waitSeconds} seconds, polling every ${pollIntervalSeconds} seconds, max ${pollMaxRounds} polls).`,
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
                  `Step ${visibleStep}: ${providerLabel} status ${normalizedActivation.phoneNumber}: ${statusText} (waited ${Math.ceil(elapsedMs / 1000)} seconds, poll ${pollCount}/${pollMaxRounds}).`,
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
                throw new Error(`Step ${visibleStep}: Current phone activation has expired. Please re-execute prerequisite steps to get new SMS.${error.message || error}`);
              }
              throw error;
            }

            if (windowIndex < timeoutWindows) {
              await addLog(
                `Step ${visibleStep}: ${normalizedActivation.phoneNumber} did not receive SMS within ${waitSeconds} seconds; preparing to request a resend.`,
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

        throw new Error(`Step ${visibleStep}: Phone verification code could not be acquired successfully.`);
      });
    }

    async function waitForSignupPhoneCode(state = {}, activation, options = {}) {
      return waitForScopedPhoneCode(state, activation, {
        ...options,
        step: 4,
        stepKey: 'fetch-signup-code',
        purpose: 'signup',
        actionLabelPrefix: 'signup phone verification',
        missingActivationMessage: 'Step 4: Signup phone activation record missing. Please re-execute Step 2.',
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
        missingActivationMessage: `Step ${visibleStep}: Login phone activation record missing. Please re-execute Step ${visibleStep >= 11 ? 10 : 7}.`,
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
          throw new Error('Step 4: Current signup phone activation record not found. Please re-execute Step 2.');
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
              `Step 4: Failed to check the signup phone page state (${phaseLabel}); continuing to wait for SMS. ${error.message}`,
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
                  await addLog('Step 4: Clicked "Resend" on the signup phone verification code page.', 'info', {
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
                  await addLog(`Step 4: Failed to resend on the signup phone verification page; continuing to poll for SMS. ${resendError.message}`, 'warn', {
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
            await addLog(`Step 4: Acquired phone verification code ${code}.`, 'info', {
              step: 4,
              stepKey: 'fetch-signup-code',
            });

            const submitResult = await submitSignupPhoneVerificationCode(tabId, code, {
              signupProfile: options.signupProfile || null,
            });

            if (submitResult.invalidCode) {
              const invalidErrorText = String(submitResult.errorText || submitResult.url || 'unknown error').trim();
              if (attempt >= DEFAULT_PHONE_SUBMIT_ATTEMPTS) {
                throw new Error(`Step 4: Phone verification code was rejected ${DEFAULT_PHONE_SUBMIT_ATTEMPTS} times in a row: ${invalidErrorText}`);
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
                await addLog(`Step 4: Failed to click resend after code rejection. ${resendError.message}`, 'warn', {
                  step: 4,
                  stepKey: 'fetch-signup-code',
                });
              }
              await addLog(
                `Step 4: Phone verification code was rejected; requested a new SMS (${attempt + 1}/${DEFAULT_PHONE_SUBMIT_ATTEMPTS}).`,
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
            await addLog('Step 4: Phone verification code passed. Continuing to profile entry.', 'ok', {
              step: 4,
              stepKey: 'fetch-signup-code',
            });
            return submitResult || {};
          }

          throw new Error('Step 4: Phone verification code could not be submitted successfully.');
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
        ? await getOAuthFlowStepTimeoutMs(45000, { step: visibleStep, actionLabel: 'Submit login phone verification code' })
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
        logMessage: `Step ${visibleStep}: Waiting for the login phone verification code page to be ready before filling the SMS code...`,
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
        ? await getOAuthFlowStepTimeoutMs(65000, { step: visibleStep, actionLabel: 'Resend login phone verification code' })
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
        logMessage: `Step ${visibleStep}: Waiting for the login phone verification code resend button to appear...`,
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
          throw new Error(`Step ${visibleStep}: Missing registered phone activation record; cannot continue the phone-login verification flow.`);
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
          throw new Error(`Step ${visibleStep}: Could not reuse the current signup phone number. Please re-execute Step ${visibleStep >= 11 ? 10 : 7}.`);
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
          throw new Error(`Step ${visibleStep}: Current login phone activation record not found. Please re-execute Step ${visibleStep >= 11 ? 10 : 7}.`);
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
                  await addLog(`Step ${visibleStep}: Clicked "Resend" on the login phone verification code page.`, 'info', {
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
                  await addLog(`Step ${visibleStep}: Failed to resend on the login phone verification page; continuing to poll for SMS. ${resendError.message}`, 'warn', {
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
            await addLog(`Step ${visibleStep}: Got login phone verification code ${code}.`, 'info', {
              step: visibleStep,
              stepKey: 'fetch-login-code',
            });

            const submitResult = await submitLoginPhoneVerificationCode(tabId, code, {
              visibleStep,
            });

            if (submitResult.invalidCode) {
              const invalidErrorText = String(submitResult.errorText || submitResult.url || 'unknown error').trim();
              if (attempt >= DEFAULT_PHONE_SUBMIT_ATTEMPTS) {
                throw new Error(`Step ${visibleStep}: Login phone verification code was rejected ${DEFAULT_PHONE_SUBMIT_ATTEMPTS} times in a row: ${invalidErrorText}`);
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
                await addLog(`Step ${visibleStep}: Failed to click resend after the login phone verification code was rejected. ${resendError.message}`, 'warn', {
                  step: visibleStep,
                  stepKey: 'fetch-login-code',
                });
              }
              await addLog(
                `Step ${visibleStep}: Login phone verification code was rejected; requested a new SMS (${attempt + 1}/${DEFAULT_PHONE_SUBMIT_ATTEMPTS}).`,
                'warn',
                { step: visibleStep, stepKey: 'fetch-login-code' }
              );
              continue;
            }

            await finalizeLoginPhoneActivationAfterSuccess(state, activation, { visibleStep });
            shouldCancelActivation = false;
            await addLog(`Step ${visibleStep}: Login phone verification code passed; continuing to the next authorization step.`, 'ok', {
              step: visibleStep,
              stepKey: 'fetch-login-code',
            });
            return submitResult || {};
          }

          throw new Error(`Step ${visibleStep}: Login phone verification code could not be submitted successfully.`);
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
        if (normalizedProvider === PHONE_SMS_PROVIDER_5SIM) {
          const normalizedCountryCode = normalizeFiveSimCountryCode(countryId, '');
          return normalizedCountryCode ? `${normalizedProvider}:${normalizedCountryCode}` : '';
        }
        if (normalizedProvider === PHONE_SMS_PROVIDER_NEXSMS) {
          const normalizedCountryId = normalizeNexSmsCountryId(countryId, -1);
          return normalizedCountryId >= 0 ? `${normalizedProvider}:${normalizedCountryId}` : '';
        }
        const normalizedCountryId = normalizeCountryId(countryId, 0);
        return normalizedCountryId > 0 ? `${normalizedProvider}:${normalizedCountryId}` : '';
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
        if (normalizedProvider === PHONE_SMS_PROVIDER_5SIM) {
          const matched = resolveFiveSimCountryCandidates(state)
            .find((entry) => String(entry.id || entry.code || '') === normalizedCountryKey);
          return matched?.label || normalizedCountryKey || 'Unknown country';
        }
        if (normalizedProvider === PHONE_SMS_PROVIDER_NEXSMS) {
          const normalizedCountryId = normalizeNexSmsCountryId(normalizedCountryKey, -1);
          const matched = resolveNexSmsCountryCandidates(state)
            .find((entry) => normalizeNexSmsCountryId(entry.id, -1) === normalizedCountryId);
          return matched?.label || `Country #${normalizedCountryId}`;
        }
        const normalizedCountryId = normalizeCountryId(normalizedCountryKey, 0);
        const matched = resolveCountryCandidates(state)
          .find((entry) => normalizeCountryId(entry.id, 0) === normalizedCountryId);
        return matched?.label || `Country #${normalizedCountryId}`;
      };

      const directNavigateToAddPhone = async (attemptLabel = 'after replace-number rotation') => {
        if (typeof navigateAuthTabToAddPhone !== 'function') {
          return null;
        }
        const visibleStep = normalizeLogStep(activePhoneVerificationLogStep) || 9;
        const result = await navigateAuthTabToAddPhone(tabId, {
          visibleStep,
          timeoutMs: 30000,
          logMessage: 'Step 9: Auth page is unreachable; opening the add-phone page directly and waiting for the script to recover.',
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
            `Step 9: Failed to check auth page state (${attemptLabel}). ${error.message}`,
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
            `Step 9: Failed to return to the add-phone page (${attemptLabel}). ${error.message}`,
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
            `Step 9: Before submitting phone number, the auth page did not stay on the add-phone page (${attemptLabel}). URL: ${latest?.url || 'unknown'}`
          );
        }
        return latest;
      };

      const getCountryFailureKey = (countryId, providerId = normalizePhoneSmsProvider(state?.phoneSmsProvider)) => (
        normalizePhoneSmsProvider(providerId) === PHONE_SMS_PROVIDER_FIVE_SIM
          ? normalizeFiveSimCountryId(countryId, '')
          : String(normalizeCountryId(countryId, 0) || '')
      );

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
            `Step 9: ${countryLabel} accumulated ${nextCount} SMS failures (${formatStep9Reason(reason)}); the next phone number acquisition will prioritize other selected countries.`,
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
        const countryKey = normalizeCountryFailureKey(
          normalizedActivation.countryId,
          normalizedActivation.provider
        );
        if (!countryKey) {
          return;
        }
        const floorPrice = normalizeHeroSmsPrice(
          normalizedActivation.price
          ?? normalizedActivation.maxPrice
          ?? normalizedActivation.selectedPrice
          ?? getActivationAcquiredPriceHint(normalizedActivation)
        );
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
          `Step 9: ${countryLabel} will try a higher price tier (> ${normalizedFloor}) due to ${formatStep9Reason(reason || 'sms_timeout')}.`,
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
          `Step 9: Preferred number ${activation.phoneNumber} failed (${formatStep9Reason(reason || 'unknown')}); will get a new number instead.`,
          'warn'
        );
      };

      const rotateActivationAfterAddPhoneFailure = async (failureReason, failureCode, submitState = {}) => {
        await markPreferredActivationExhausted(failureCode || failureReason);
        usedNumberReplacementAttempts += 1;
        if (usedNumberReplacementAttempts > maxNumberReplacementAttempts) {
          throw buildPhoneReplacementLimitError(maxNumberReplacementAttempts, failureCode || 'add_phone_rejected');
        }
        await addLog(
          `Step 9: Replacing the number after add-phone failed (${formatStep9Reason(failureReason)}, ${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}).`,
          'warn'
        );
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
            `Step 9: Failed to return to the add-phone page after the number was rejected; continuing with the current available state. ${returnError.message}`,
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
            `Step 9: Failed to confirm the add-phone page state after the number was rejected. ${verifyError.message}`,
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
                  `Step 9: Current number ${activation.phoneNumber} keeps returning to the add-phone page; replacing the number (${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}).`,
                  'warn'
                );
                if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
                  await retireFreeReusableActivation(
                    `Auto free-reuse number ${activation.phoneNumber} keeps returning to the add-phone page.`
                  );
                }
                if (shouldCancelActivation && activation) {
                  await cancelPhoneActivation(state, activation);
                }
                await clearCurrentActivation();
                activation = null;
                shouldCancelActivation = false;
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
                `Step 9: Page returned to add-phone; will resubmit the current number ${activation.phoneNumber} first instead of acquiring a new one.`,
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
                    `Step 9: Phone verification still failed after replacing the number ${maxNumberReplacementAttempts} times. Last reason: ${formatStep9Reason('phone_number_used')}.`
                  );
                }

                await addLog(
                  `Step 9: Add-phone page reports ${activation.phoneNumber} is already in use (${addPhoneRejectText}); replacing the number (${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}).`,
                  'warn'
                );
                await discardPhoneActivationFromReuse(
                  `Target site rejected this number (${addPhoneRejectText}).`,
                  activation,
                  await getState()
                );
                if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
                  await retireFreeReusableActivation(
                    `Auto free-reuse number ${activation.phoneNumber} was rejected by the target site.`
                  );
                }
                if (shouldCancelActivation && activation) {
                  await banPhoneActivation(state, activation);
                }
                await clearCurrentActivation();
                activation = null;
                shouldCancelActivation = false;
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
                `Step 9: Add-phone page rejected the current number, but did not explicitly report "already in use" (${addPhoneRejectText}); will retry once with the same number.`,
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
                  `Step 9: Add-phone page keeps rejecting the current number with no clear "already used" status: ${submitResult.errorText || submitResult.url || 'unknown error'}.`
                );
              }
            }

            await addLog('Step 9: Submitted the phone number on the add-phone page.', 'info');
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
            throw new Error('Auth page is waiting for the phone verification code, but the current run has no saved phone SMS order.');
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
            await addLog(`Step 9: Received phone verification code ${codeResult.code}.`, 'info');
            const submitResult = await submitPhoneVerificationCode(tabId, codeResult.code);

            if (submitResult.returnedToAddPhone) {
              await addLog(
                'Step 9: After submitting the verification code the page returned to add-phone; will retry the current number first.',
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
                  `Target site rejected this number (${invalidErrorText}).`,
                  activation,
                  await getState()
                );
                if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
                  await retireFreeReusableActivation(
                    `Auto free-reuse number ${activation.phoneNumber} was rejected by the target site.`
                  );
                }
                if (shouldCancelActivation && activation) {
                  await banPhoneActivation(state, activation);
                  shouldCancelActivation = false;
                }
                await addLog(
                  `Step 9: Phone number reported as already used (${invalidErrorText}); switching to a new number immediately.`,
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
                  `Step 9: Phone verification code was rejected ${DEFAULT_PHONE_SUBMIT_ATTEMPTS} times in a row (${invalidErrorText}); replacing the number.`,
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
                      `Step 9: After the verification code was rejected, the resend entry shows WhatsApp channel (${resendProbeResult.channelText || resendProbeResult.text || 'WhatsApp'}); the SMS provider cannot read WhatsApp messages, so switching numbers.`,
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
                        `Step 9: After the verification code was rejected, the resend entry switched to WhatsApp channel (${resendResult.channelText || resendResult.text || 'WhatsApp'}); the SMS provider cannot read WhatsApp messages, so switching numbers.`,
                        'warn'
                      );
                      break;
                    }
                  }
                  await addLog('Step 9: Clicked "Resend SMS" after the verification code was rejected.', 'info');
                } catch (resendError) {
                  await addLog(`Step 9: Failed to click resend after the verification code was rejected. ${resendError.message}`, 'warn');
                }
                if (shouldReplaceNumber) {
                  break;
                }
                await addLog(
                  `Step 9: Phone verification code was rejected; requested another SMS (${remainingResendRequests} resends remaining).`,
                  'warn'
                );
              } else {
                await addLog(
                  'Step 9: Phone verification code was rejected and the configured resend count is used up; will keep retrying in the current SMS window.',
                  'warn'
                );
              }
              continue;
            }

            const latestSuccessState = await getState();
            if (shouldSkipTerminalStatusForFreeReuse(latestSuccessState, activation)) {
              const terminalProviderLabel = getPhoneSmsProviderLabel(activation.provider);
              await addLog(
                `Step 9: Skipped ${terminalProviderLabel} completion status to keep ${activation.phoneNumber} for free reuse.`,
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
            await addLog('Step 9: Phone verification complete; waiting for the OAuth authorization page.', 'ok');
            return submitResult;
          }

          if (!shouldReplaceNumber) {
            if (pageState?.addPhonePage) {
              continue;
            }
            throw new Error('Phone verification incomplete.');
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

          if (shouldCancelActivation && activation) {
            await cancelPhoneActivation(state, activation);
          }
          if (shouldRetireFreeReusableActivationOnFailure(await getState(), activation)) {
            await retireFreeReusableActivation(
              `Auto free-reuse number ${activation.phoneNumber} was replaced after failing.`
            );
          }
          if (isPhoneNumberUsedError(replaceReason)) {
            await discardPhoneActivationFromReuse(
              `Target site rejected this number (${replaceReason}).`,
              activation,
              await getState()
            );
          }
          await clearCurrentActivation();
          activation = null;
          shouldCancelActivation = false;
          addPhoneReentryWithSameActivation = 0;

          let returnResult = null;
          try {
            returnResult = await returnToAddPhone(tabId);
          } catch (returnError) {
            await addLog(`Step 9: Failed to return to the add-phone page before replacing the number. ${returnError.message}`, 'warn');
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
            `Step 9: Replacing the number and retrying within step 9 (${usedNumberReplacementAttempts}/${maxNumberReplacementAttempts}).`,
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
            `Auto free-reuse number ${activation.phoneNumber} failed during execution: ${errorMessage || 'unknown error'}.`
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
