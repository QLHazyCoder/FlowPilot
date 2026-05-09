// background.js — Service Worker: orchestration, state, tab management, message routing

importScripts(
  'managed-alias-utils.js',
  'mail2925-utils.js',
  'paypal-utils.js',
  'gopay-utils.js',
  'phone-sms/providers/hero-sms.js',
  'phone-sms/providers/five-sim.js',
  'phone-sms/providers/registry.js',
  'background/phone-verification-flow.js',
  'background/account-run-history.js',
  'background/contribution-oauth.js',
  'background/mail-2925-session.js',
  'background/paypal-account-store.js',
  'background/ip-proxy-provider-711proxy.js',
  'background/ip-proxy-core.js',
  'background/panel-bridge.js',
  'background/generated-email-helpers.js',
  'background/signup-flow-helpers.js',
  'background/message-router.js',
  'background/verification-flow.js',
  'background/auto-run-controller.js',
  'background/tab-runtime.js',
  'background/navigation-utils.js',
  'background/logging-status.js',
  'background/steps/registry.js',
  'data/step-definitions.js',
  'data/address-sources.js',
  'background/steps/open-chatgpt.js',
  'background/steps/submit-signup-email.js',
  'background/steps/fill-password.js',
  'background/steps/fetch-signup-code.js',
  'background/steps/fill-profile.js',
  'background/steps/wait-registration-success.js',
  'background/steps/create-plus-checkout.js',
  'background/steps/fill-plus-checkout.js',
  'background/steps/gopay-manual-confirm.js',
  'background/steps/paypal-approve.js',
  'background/steps/gopay-approve.js',
  'background/steps/plus-return-confirm.js',
  'background/steps/oauth-login.js',
  'background/steps/fetch-login-code.js',
  'background/steps/confirm-oauth.js',
  'background/steps/platform-verify.js',
  'data/names.js',
  'hotmail-utils.js',
  'microsoft-email.js',
  'luckmail-utils.js',
  'cloudflare-temp-email-utils.js',
  'cloudmail-utils.js',
  'background/cloudmail-provider.js',
  'icloud-utils.js',
  'mail-provider-utils.js',
  'content/activation-utils.js'
);

const NORMAL_STEP_DEFINITIONS = self.MultiPageStepDefinitions?.getSteps?.({ plusModeEnabled: false }) || [];
const PLUS_PAYPAL_STEP_DEFINITIONS = self.MultiPageStepDefinitions?.getSteps?.({
  plusModeEnabled: true,
  plusPaymentMethod: 'paypal',
}) || NORMAL_STEP_DEFINITIONS;
const PLUS_GOPAY_STEP_DEFINITIONS = self.MultiPageStepDefinitions?.getSteps?.({
  plusModeEnabled: true,
  plusPaymentMethod: 'gopay',
}) || PLUS_PAYPAL_STEP_DEFINITIONS;
const PLUS_GPC_STEP_DEFINITIONS = self.MultiPageStepDefinitions?.getSteps?.({
  plusModeEnabled: true,
  plusPaymentMethod: 'gpc-helper',
}) || PLUS_GOPAY_STEP_DEFINITIONS;
const PLUS_STEP_DEFINITIONS = PLUS_PAYPAL_STEP_DEFINITIONS;
const ALL_STEP_DEFINITIONS = self.MultiPageStepDefinitions?.getAllSteps?.() || [
  ...NORMAL_STEP_DEFINITIONS,
  ...PLUS_PAYPAL_STEP_DEFINITIONS,
  ...PLUS_GOPAY_STEP_DEFINITIONS,
  ...PLUS_GPC_STEP_DEFINITIONS,
];
const STEP_IDS = Array.from(new Set(ALL_STEP_DEFINITIONS
  .map((definition) => Number(definition?.id))
  .filter(Number.isFinite)))
  .sort((left, right) => left - right);
const NORMAL_STEP_IDS = NORMAL_STEP_DEFINITIONS
  .map((definition) => Number(definition?.id))
  .filter(Number.isFinite)
  .sort((left, right) => left - right);
const PLUS_PAYPAL_STEP_IDS = PLUS_PAYPAL_STEP_DEFINITIONS
  .map((definition) => Number(definition?.id))
  .filter(Number.isFinite)
  .sort((left, right) => left - right);
const PLUS_GOPAY_STEP_IDS = PLUS_GOPAY_STEP_DEFINITIONS
  .map((definition) => Number(definition?.id))
  .filter(Number.isFinite)
  .sort((left, right) => left - right);
const PLUS_GPC_STEP_IDS = PLUS_GPC_STEP_DEFINITIONS
  .map((definition) => Number(definition?.id))
  .filter(Number.isFinite)
  .sort((left, right) => left - right);
const PLUS_STEP_IDS = PLUS_PAYPAL_STEP_IDS;
const LAST_STEP_ID = Math.max(
  NORMAL_STEP_IDS[NORMAL_STEP_IDS.length - 1] || 10,
  PLUS_PAYPAL_STEP_IDS[PLUS_PAYPAL_STEP_IDS.length - 1] || 10,
  PLUS_GOPAY_STEP_IDS[PLUS_GOPAY_STEP_IDS.length - 1] || 10,
  PLUS_GPC_STEP_IDS[PLUS_GPC_STEP_IDS.length - 1] || 10
);
const FINAL_OAUTH_CHAIN_START_STEP = 7;

const {
  extractVerificationCodeFromMessage,
  filterHotmailAccountsByUsage,
  getLatestHotmailMessage,
  getHotmailMailApiRequestConfig,
  getHotmailVerificationPollConfig,
  getHotmailVerificationRequestTimestamp,
  normalizeHotmailServiceMode,
  normalizeHotmailMailApiMessages,
  pickHotmailAccountForRun,
  pickVerificationMessage,
  pickVerificationMessageWithFallback,
  pickVerificationMessageWithTimeFallback,
  shouldClearHotmailCurrentSelection,
} = self.HotmailUtils;
const {
  MAIL2925_LIMIT_COOLDOWN_MS,
  findMail2925Account,
  getMail2925AccountStatus,
  normalizeMail2925Account,
  normalizeMail2925Accounts,
  parseMail2925ImportText,
  pickMail2925AccountForRun,
  upsertMail2925AccountInList,
} = self.Mail2925Utils;
const {
  fetchMicrosoftMailboxMessages,
} = self.MultiPageMicrosoftEmail;
const {
  DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  DEFAULT_LUCKMAIL_BASE_URL,
  DEFAULT_LUCKMAIL_EMAIL_TYPE,
  buildLuckmailBaselineCursor,
  buildLuckmailMailCursor,
  filterReusableLuckmailPurchases,
  isLuckmailMailNewerThanCursor,
  isLuckmailPurchaseReusable,
  isLuckmailPurchaseForProject,
  isLuckmailPurchasePreserved,
  normalizeLuckmailBaseUrl,
  normalizeLuckmailEmailType,
  normalizeLuckmailMailCursor,
  normalizeLuckmailProjectName,
  normalizeLuckmailPurchase,
  normalizeLuckmailPurchaseId,
  normalizeLuckmailPurchaseListPage,
  normalizeLuckmailPurchases,
  normalizeLuckmailTags,
  normalizeLuckmailTokenCode,
  normalizeLuckmailTokenMail,
  normalizeLuckmailTokenMails,
  normalizeLuckmailUsedPurchases,
  normalizeTimestamp: normalizeLuckmailTimestamp,
  pickLuckmailVerificationMail,
} = self.LuckMailUtils;
const {
  DEFAULT_MAIL_PAGE_SIZE: CLOUDFLARE_TEMP_EMAIL_DEFAULT_PAGE_SIZE,
  buildCloudflareTempEmailHeaders,
  getCloudflareTempEmailAddressFromResponse,
  joinCloudflareTempEmailUrl,
  normalizeCloudflareTempEmailAddress,
  normalizeCloudflareTempEmailBaseUrl,
  normalizeCloudflareTempEmailDomain,
  normalizeCloudflareTempEmailDomains,
  normalizeCloudflareTempEmailMailApiMessages,
} = self.CloudflareTempEmailUtils;
const {
  DEFAULT_MAIL_PAGE_SIZE: CLOUD_MAIL_DEFAULT_PAGE_SIZE,
  buildCloudMailHeaders,
  getCloudMailTokenFromResponse,
  joinCloudMailUrl,
  normalizeCloudMailAddress,
  normalizeCloudMailBaseUrl,
  normalizeCloudMailDomain,
  normalizeCloudMailDomains,
  normalizeCloudMailMailApiMessages,
} = self.CloudMailUtils;
const {
  findIcloudAliasByEmail,
  getConfiguredIcloudHostPreference,
  getIcloudHostHintFromMessage,
  getIcloudLoginUrlForHost,
  getIcloudMailUrlForHost,
  getIcloudSetupUrlForHost,
  normalizeBooleanMap,
  normalizeIcloudAliasList,
  normalizeIcloudAliasRecord,
  normalizeIcloudHost,
  pickReusableIcloudAlias,
  toNormalizedEmailSet,
} = self.IcloudUtils;
const {
  getIcloudForwardMailConfig: getSharedIcloudForwardMailConfig,
  normalizeIcloudForwardMailProvider,
  normalizeIcloudTargetMailboxType,
} = self.MailProviderUtils;
const {
  isRecoverableStep9AuthFailure,
} = self.MultiPageActivationUtils;

const LOG_PREFIX = '[MultiPage:bg]';
const DUCK_AUTOFILL_URL = 'https://duckduckgo.com/email/settings/autofill';
const ICLOUD_SETUP_URLS = [
  'https://setup.icloud.com/setup/ws/1',
  'https://setup.icloud.com.cn/setup/ws/1',
];
const ICLOUD_LOGIN_URLS = [
  'https://www.icloud.com/',
  'https://www.icloud.com.cn/',
];
const ICLOUD_REQUEST_TIMEOUT_MS = 15000;
const ICLOUD_LIST_MAX_ATTEMPTS = 3;
const ICLOUD_WRITE_MAX_ATTEMPTS = 2;
const ICLOUD_RETRY_DELAYS_MS = [1000, 2500, 5000];
const ICLOUD_TAB_URL_PATTERNS = [
  'https://www.icloud.com/*',
  'https://www.icloud.com.cn/*',
  'https://setup.icloud.com/*',
  'https://setup.icloud.com.cn/*',
  'https://*.icloud.com/*',
  'https://*.icloud.com.cn/*',
];
const ICLOUD_MAILDOMAINWS_CLIENT_BUILD_NUMBER = '2206Hotfix11';
const ICLOUD_ALIAS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ICLOUD_TRANSIENT_RETRY_MAX_ATTEMPTS = 2;
const ICLOUD_TRANSIENT_RETRY_DELAY_MS = 1200;
const ICLOUD_PROVIDER = 'icloud';
const GMAIL_PROVIDER = 'gmail';
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const HOTMAIL_PROVIDER = 'hotmail-api';
const LUCKMAIL_PROVIDER = 'luckmail-api';
const CLOUDFLARE_TEMP_EMAIL_PROVIDER = 'cloudflare-temp-email';
const CLOUDFLARE_TEMP_EMAIL_GENERATOR = 'cloudflare-temp-email';
const CLOUD_MAIL_PROVIDER = 'cloudmail';
const CLOUD_MAIL_GENERATOR = 'cloudmail';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const HOTMAIL_MAILBOXES = ['INBOX', 'Junk'];
const STOP_ERROR_MESSAGE = '流程已被用户停止。';
const CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX = 'CF_SECURITY_BLOCKED::';
const CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE = '您已触发Cloudflare 安全防护系统，已完全停止流程，请不要短时间内多次进行重新发送验证码，连续刷新、反复点击重试会加重风控；请先关闭页面等待 15-30 分钟，让系统的临时限制自动解除。或者更换浏览器';
const BROWSER_SWITCH_REQUIRED_ERROR_PREFIX = 'BROWSER_SWITCH_REQUIRED::';
const HUMAN_STEP_DELAY_MIN = 700;
const HUMAN_STEP_DELAY_MAX = 2200;
const STEP6_MAX_ATTEMPTS = 3;
const STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS = 8;
const OAUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;
const SUB2API_STEP1_RESPONSE_TIMEOUT_MS = 90000;
const SUB2API_STEP9_RESPONSE_TIMEOUT_MS = 120000;
const DEFAULT_SUB2API_URL = '';
const DEFAULT_CODEX2API_URL = 'http://localhost:8080/admin/accounts';
const DEFAULT_GPC_HELPER_API_URL = 'https://gpc.qlhazycoder.top';
const DEFAULT_SUB2API_GROUP_NAME = 'codex';
const DEFAULT_SUB2API_PROXY_NAME = '';
const DEFAULT_SUB2API_ACCOUNT_PRIORITY = 1;
const CONTRIBUTION_SOURCE_CPA = 'cpa';
const CONTRIBUTION_SOURCE_SUB2API = 'sub2api';
const CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME = 'codex号池';
const CONTRIBUTION_SUB2API_PLUS_GROUP_NAME = 'openai-plus';
const DEFAULT_SUB2API_GROUP_NAMES = [
  DEFAULT_SUB2API_GROUP_NAME,
  CONTRIBUTION_SUB2API_PLUS_GROUP_NAME,
];
const DEFAULT_SUB2API_REDIRECT_URI = 'http://localhost:1455/auth/callback';
const DEFAULT_IP_PROXY_SERVICE = '711proxy';
const IP_PROXY_SERVICE_VALUES = ['711proxy', 'lumiproxy', 'iproyal', 'omegaproxy'];
const IP_PROXY_ENABLED_SERVICE_VALUES = ['711proxy'];
const DEFAULT_IP_PROXY_MODE = 'account';
const IP_PROXY_MODE_VALUES = ['api', 'account'];
const DEFAULT_IP_PROXY_PROTOCOL = 'http';
const IP_PROXY_PROTOCOL_VALUES = ['http', 'https', 'socks4', 'socks5'];
const IP_PROXY_FETCH_TIMEOUT_MS = 20000;
const IP_PROXY_SETTINGS_SCOPE = 'regular';
const IP_PROXY_BYPASS_LIST = ['<local>', 'localhost', '127.0.0.1'];
const IP_PROXY_ROUTE_ALL_TRAFFIC = true;
const IP_PROXY_FORCE_DIRECT_HOST_PATTERNS = [
  'pm-redirects.stripe.com',
  '*.pm-redirects.stripe.com',
  'hwork.pro',
  '*.hwork.pro',
  'auth.openai.com',
  'auth0.openai.com',
  'accounts.openai.com',
  'luckyous.com',
  '*.luckyous.com',
];
const IP_PROXY_FORCE_DIRECT_FALLBACK = 'PROXY 127.0.0.1:7897';
const IP_PROXY_ACCOUNT_LIST_ENABLED = false;
const IP_PROXY_INIT_ENABLE_EXIT_PROBE = false;
const IP_PROXY_INIT_SUPPRESS_AUTH_REBIND = true;
const IP_PROXY_INIT_AUTO_APPLY = false;
const IP_PROXY_TARGET_HOST_PATTERNS = [
  'openai.com',
  '*.openai.com',
  'chatgpt.com',
  '*.chatgpt.com',
  'ipwho.is',
  '*.ipwho.is',
  'ipapi.co',
  '*.ipapi.co',
  'ipinfo.io',
  '*.ipinfo.io',
  'api.ipify.org',
  'api64.ipify.org',
  'api.ip.cc',
  'ifconfig.me',
  'checkip.amazonaws.com',
  'ipv4.icanhazip.com',
  'ident.me',
  'httpbin.org',
  'ip-api.com',
  'myip.ipip.net',
];
const AUTO_RUN_TIMER_ALARM_NAME = 'auto-run-timer';
const IP_PROXY_AUTO_SYNC_ALARM_NAME = 'ip-proxy-auto-sync';
const AUTO_RUN_TIMER_KIND_SCHEDULED_START = 'scheduled_start';
const AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS = 'between_rounds';
const AUTO_RUN_TIMER_KIND_BEFORE_RETRY = 'before_retry';
const IP_PROXY_AUTO_SYNC_INTERVAL_MIN_MINUTES = 1;
const IP_PROXY_AUTO_SYNC_INTERVAL_MAX_MINUTES = 1440;
const IP_PROXY_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES = 15;
const AUTO_RUN_DELAY_MIN_MINUTES = 1;
const AUTO_RUN_DELAY_MAX_MINUTES = 1440;
const AUTO_RUN_RETRY_DELAY_MS = 3000;
const AUTO_RUN_MAX_RETRIES_PER_ROUND = 3;
const AUTO_STEP_DELAY_MIN_ALLOWED_SECONDS = 0;
const AUTO_STEP_DELAY_MAX_ALLOWED_SECONDS = 600;
const VERIFICATION_RESEND_COUNT_MIN = 0;
const VERIFICATION_RESEND_COUNT_MAX = 20;
const DEFAULT_VERIFICATION_RESEND_COUNT = 4;
const PHONE_REPLACEMENT_LIMIT_MIN = 1;
const PHONE_REPLACEMENT_LIMIT_MAX = 20;
const DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT = 3;
const PHONE_CODE_WAIT_SECONDS_MIN = 15;
const PHONE_CODE_WAIT_SECONDS_MAX = 300;
const DEFAULT_PHONE_CODE_WAIT_SECONDS = 60;
const PHONE_CODE_TIMEOUT_WINDOWS_MIN = 1;
const PHONE_CODE_TIMEOUT_WINDOWS_MAX = 10;
const DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS = 2;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MIN = 1;
const PHONE_CODE_POLL_INTERVAL_SECONDS_MAX = 30;
const DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS = 5;
const PHONE_CODE_POLL_ROUNDS_MIN = 1;
const PHONE_CODE_POLL_ROUNDS_MAX = 120;
const DEFAULT_PHONE_CODE_POLL_ROUNDS = 4;
const LEGACY_AUTO_STEP_DELAY_KEYS = ['autoStepRandomDelayMinSeconds', 'autoStepRandomDelayMaxSeconds'];
const LEGACY_VERIFICATION_RESEND_COUNT_KEYS = ['signupVerificationResendCount', 'loginVerificationResendCount'];
const DEFAULT_LOCAL_CPA_STEP9_MODE = 'submit';
const MAIL_2925_MODE_PROVIDE = 'provide';
const MAIL_2925_MODE_RECEIVE = 'receive';
const DEFAULT_MAIL_2925_MODE = MAIL_2925_MODE_PROVIDE;
const HOTMAIL_SERVICE_MODE_REMOTE = 'remote';
const HOTMAIL_SERVICE_MODE_LOCAL = 'local';
const DEFAULT_HOTMAIL_REMOTE_BASE_URL = '';
const DEFAULT_HOTMAIL_LOCAL_BASE_URL = 'http://127.0.0.1:17373';
const DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL = DEFAULT_HOTMAIL_LOCAL_BASE_URL;
const HOTMAIL_LOCAL_HELPER_TIMEOUT_MS = 45000;
const DEFAULT_LUCKMAIL_PROJECT_CODE = 'openai';
const DEFAULT_HERO_SMS_BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';
const HERO_SMS_SERVICE_CODE = 'dr';
const HERO_SMS_SERVICE_LABEL = 'OpenAI';
const HERO_SMS_COUNTRY_ID = 52;
const HERO_SMS_COUNTRY_LABEL = 'Thailand';
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
const DEFAULT_FIVE_SIM_BASE_URL = 'https://5sim.net/v1';
const DEFAULT_FIVE_SIM_PRODUCT = 'openai';
const DEFAULT_FIVE_SIM_OPERATOR = 'any';
const DEFAULT_FIVE_SIM_COUNTRY_ORDER = Object.freeze(['thailand']);
const DEFAULT_NEX_SMS_BASE_URL = 'https://api.nexsms.net';
const DEFAULT_NEX_SMS_SERVICE_CODE = 'ot';
const DEFAULT_NEX_SMS_COUNTRY_ORDER = Object.freeze([1]);
const DEFAULT_HERO_SMS_REUSE_ENABLED = true;
const HERO_SMS_ACQUIRE_PRIORITY_COUNTRY = 'country';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE = 'price';
const HERO_SMS_ACQUIRE_PRIORITY_PRICE_HIGH = 'price_high';
const DEFAULT_HERO_SMS_ACQUIRE_PRIORITY = HERO_SMS_ACQUIRE_PRIORITY_COUNTRY;
const FIVE_SIM_COUNTRY_ID = 'vietnam';
const FIVE_SIM_COUNTRY_LABEL = '越南 (Vietnam)';
const FIVE_SIM_SUPPORTED_COUNTRY_IDS = ['indonesia', 'thailand', 'vietnam'];
const FIVE_SIM_SUPPORTED_COUNTRY_ID_SET = new Set(FIVE_SIM_SUPPORTED_COUNTRY_IDS);
const HERO_SMS_SUPPORTED_COUNTRY_IDS = [6, 52, 187, 16, 151, 43, 73, 10];
const HERO_SMS_SUPPORTED_COUNTRY_ID_SET = new Set(HERO_SMS_SUPPORTED_COUNTRY_IDS.map(String));
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
const FIVE_SIM_OPERATOR = DEFAULT_FIVE_SIM_OPERATOR;
const PLUS_PAYMENT_METHOD_PAYPAL = 'paypal';
const PLUS_PAYMENT_METHOD_GOPAY = 'gopay';
const PLUS_PAYMENT_METHOD_GPC_HELPER = 'gpc-helper';
const DEFAULT_PLUS_PAYMENT_METHOD = PLUS_PAYMENT_METHOD_PAYPAL;
const DISPLAY_TIMEZONE = 'Asia/Shanghai';
const MICROSOFT_TOKEN_DNR_RULE_ID = 1001;
const PERSISTENT_ALIAS_STATE_KEYS = [
  'manualAliasUsage',
  'preservedAliases',
  'icloudAliasCache',
  'icloudAliasCacheAt',
];
const ACCOUNT_RUN_HISTORY_STORAGE_KEY = 'accountRunHistory';
const SIGNUP_METHOD_EMAIL = 'email';
const SIGNUP_METHOD_PHONE = 'phone';
const DEFAULT_SIGNUP_METHOD = SIGNUP_METHOD_EMAIL;
const CONTRIBUTION_RUNTIME_DEFAULTS = self.MultiPageBackgroundContributionOAuth?.RUNTIME_DEFAULTS || {
  contributionMode: false,
  contributionModeExpected: false,
  contributionSource: CONTRIBUTION_SOURCE_SUB2API,
  contributionTargetGroupName: CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME,
  contributionNickname: '',
  contributionQq: '',
  contributionSessionId: '',
  contributionAuthUrl: '',
  contributionAuthState: '',
  contributionCallbackUrl: '',
  contributionStatus: '',
  contributionStatusMessage: '',
  contributionLastPollAt: 0,
  contributionCallbackStatus: 'idle',
  contributionCallbackMessage: '',
  contributionAuthOpenedAt: 0,
  contributionAuthTabId: 0,
};
const CONTRIBUTION_RUNTIME_KEYS = self.MultiPageBackgroundContributionOAuth?.RUNTIME_KEYS
  || Object.keys(CONTRIBUTION_RUNTIME_DEFAULTS);

function isPlusModeState(state = {}) {
  return Boolean(state?.plusModeEnabled);
}

function normalizePlusPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === PLUS_PAYMENT_METHOD_GPC_HELPER) {
    return PLUS_PAYMENT_METHOD_GPC_HELPER;
  }
  return normalized === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_PAYMENT_METHOD_GOPAY : PLUS_PAYMENT_METHOD_PAYPAL;
}

function normalizeGpcHelperPhoneMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'auto' || normalized === 'builtin' ? 'auto' : 'manual';
}

function normalizeContributionModeSource(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === CONTRIBUTION_SOURCE_SUB2API
    ? CONTRIBUTION_SOURCE_SUB2API
    : CONTRIBUTION_SOURCE_CPA;
}

function resolveContributionModeRoutingState(state = {}) {
  const currentStatus = String(state?.contributionStatus || '').trim().toLowerCase();
  const currentSource = normalizeContributionModeSource(state?.contributionSource);
  const hasActiveSession = Boolean(
    String(state?.contributionSessionId || '').trim()
    && currentStatus
    && !['auto_approved', 'auto_rejected', 'expired', 'error'].includes(currentStatus)
  );

  if (hasActiveSession) {
    return {
      source: currentSource,
      targetGroupName: currentSource === CONTRIBUTION_SOURCE_SUB2API
        ? (String(state?.contributionTargetGroupName || '').trim() || CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME)
        : '',
    };
  }

  const source = CONTRIBUTION_SOURCE_SUB2API;
  return {
    source,
    targetGroupName: isPlusModeState(state)
      ? CONTRIBUTION_SUB2API_PLUS_GROUP_NAME
      : (String(state?.contributionTargetGroupName || '').trim() || CONTRIBUTION_SUB2API_DEFAULT_GROUP_NAME),
  };
}

function getSignupMethodForStepDefinitions(state = {}) {
  return normalizeSignupMethod(state?.resolvedSignupMethod || state?.signupMethod);
}

function getStepDefinitionsForState(state = {}) {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  if (rootScope.MultiPageStepDefinitions?.getSteps) {
    return rootScope.MultiPageStepDefinitions.getSteps({
      plusModeEnabled: isPlusModeState(state),
      plusPaymentMethod: normalizePlusPaymentMethod(state?.plusPaymentMethod),
      signupMethod: getSignupMethodForStepDefinitions(state),
    });
  }
  if (!isPlusModeState(state)) {
    return NORMAL_STEP_DEFINITIONS;
  }
  const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
  if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
    return PLUS_GPC_STEP_DEFINITIONS;
  }
  return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_GOPAY_STEP_DEFINITIONS : PLUS_PAYPAL_STEP_DEFINITIONS;
}

function getStepIdsForState(state = {}) {
  const definitions = getStepDefinitionsForState(state);
  if (Array.isArray(definitions) && definitions.length) {
    return definitions
      .map((definition) => Number(definition?.id))
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
  }
  if (!isPlusModeState(state)) {
    return NORMAL_STEP_IDS;
  }
  const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
  if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
    return PLUS_GPC_STEP_IDS;
  }
  return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? PLUS_GOPAY_STEP_IDS : PLUS_PAYPAL_STEP_IDS;
}

function getLastStepIdForState(state = {}) {
  const ids = getStepIdsForState(state);
  return ids[ids.length - 1] || 10;
}

function getAuthChainStartStepId(state = {}) {
  return isPlusModeState(state) ? 10 : FINAL_OAUTH_CHAIN_START_STEP;
}

function getStepDefinitionForState(step, state = {}) {
  const numericStep = Number(step);
  return getStepDefinitionsForState(state).find((definition) => Number(definition.id) === numericStep) || null;
}

function getStepIdByKeyForState(stepKey, state = {}) {
  const normalizedKey = String(stepKey || '').trim();
  if (!normalizedKey) return null;
  const ids = getStepIdsForState(state);
  for (const id of ids) {
    if (String(getStepDefinitionForState(id, state)?.key || '').trim() === normalizedKey) {
      return Number(id);
    }
  }
  return null;
}

initializeSessionStorageAccess();
setupDeclarativeNetRequestRules();

function setupDeclarativeNetRequestRules() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    return;
  }

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [MICROSOFT_TOKEN_DNR_RULE_ID],
    addRules: [{
      id: MICROSOFT_TOKEN_DNR_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Origin', operation: 'remove' },
        ],
      },
      condition: {
        urlFilter: 'login.microsoftonline.com/*/oauth2/v2.0/token',
        resourceTypes: ['xmlhttprequest'],
      },
    }],
  }).catch((error) => {
    console.warn(LOG_PREFIX, 'Failed to setup declarativeNetRequest rules:', error?.message || error);
  });
}

// ============================================================
// 状态管理（chrome.storage.session + chrome.storage.local）
// ============================================================

const PERSISTED_SETTING_DEFAULTS = {
  panelMode: 'cpa',
  vpsUrl: '',
  vpsPassword: '',
  localCpaStep9Mode: DEFAULT_LOCAL_CPA_STEP9_MODE,
  sub2apiUrl: DEFAULT_SUB2API_URL,
  sub2apiEmail: '',
  sub2apiPassword: '',
  sub2apiGroupName: DEFAULT_SUB2API_GROUP_NAME,
  sub2apiGroupNames: DEFAULT_SUB2API_GROUP_NAMES,
  sub2apiAccountPriority: DEFAULT_SUB2API_ACCOUNT_PRIORITY,
  sub2apiDefaultProxyName: DEFAULT_SUB2API_PROXY_NAME,
  ipProxyEnabled: false,
  ipProxyService: DEFAULT_IP_PROXY_SERVICE,
  ipProxyMode: DEFAULT_IP_PROXY_MODE,
  ipProxyApiUrl: '',
  ipProxyServiceProfiles: {},
  ipProxyAccountList: '',
  ipProxyAccountSessionPrefix: '',
  ipProxyAccountLifeMinutes: '',
  ipProxyPoolTargetCount: '20',
  ipProxyAutoSyncEnabled: false,
  ipProxyAutoSyncIntervalMinutes: IP_PROXY_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES,
  ipProxyHost: '',
  ipProxyPort: '',
  ipProxyProtocol: DEFAULT_IP_PROXY_PROTOCOL,
  ipProxyUsername: '',
  ipProxyPassword: '',
  ipProxyRegion: '',
  codex2apiUrl: DEFAULT_CODEX2API_URL,
  codex2apiAdminKey: '',
  customPassword: '',
  plusModeEnabled: false,
  plusPaymentMethod: DEFAULT_PLUS_PAYMENT_METHOD,
  paypalEmail: '',
  paypalPassword: '',
  currentPayPalAccountId: '',
  gopayCountryCode: '+86',
  gopayPhone: '',
  gopayOtp: '',
  gopayPin: '',
  gopayHelperApiUrl: DEFAULT_GPC_HELPER_API_URL,
  gopayHelperApiKey: '',
  gopayHelperCardKey: '',
  gopayHelperPhoneMode: 'manual',
  gopayHelperPhoneNumber: '',
  gopayHelperCountryCode: '+86',
  gopayHelperPin: '',
  gopayHelperOtpChannel: 'whatsapp',
  gopayHelperLocalSmsHelperEnabled: false,
  gopayHelperLocalSmsHelperUrl: 'http://127.0.0.1:18767',
  gopayHelperLocalSmsTimeoutSeconds: 90,
  gopayHelperLocalSmsPollIntervalSeconds: 2,
  gopayHelperReferenceId: '',
  gopayHelperGoPayGuid: '',
  gopayHelperRedirectUrl: '',
  gopayHelperNextAction: '',
  gopayHelperFlowId: '',
  gopayHelperChallengeId: '',
  gopayHelperStartPayload: null,
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
  gopayHelperBalance: '',
  gopayHelperBalancePayload: null,
  gopayHelperBalanceUpdatedAt: 0,
  gopayHelperBalanceError: '',
  gopayHelperRemainingUses: 0,
  gopayHelperAutoModeEnabled: false,
  gopayHelperApiKeyStatus: '',
  autoRunSkipFailures: false,
  autoRunFallbackThreadIntervalMinutes: 0,
  oauthFlowTimeoutEnabled: true,
  autoRunDelayEnabled: false,
  operationDelayEnabled: true,
  autoRunDelayMinutes: 30,
  autoStepDelaySeconds: null,
  step6CookieCleanupEnabled: false,
  phoneVerificationEnabled: false,
  freePhoneReuseEnabled: true,
  freePhoneReuseAutoEnabled: true,
  signupMethod: DEFAULT_SIGNUP_METHOD,
  phoneSmsProvider: DEFAULT_PHONE_SMS_PROVIDER,
  phoneSmsProviderOrder: [],
  verificationResendCount: DEFAULT_VERIFICATION_RESEND_COUNT,
  phoneVerificationReplacementLimit: DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT,
  phoneCodeWaitSeconds: DEFAULT_PHONE_CODE_WAIT_SECONDS,
  phoneCodeTimeoutWindows: DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS,
  phoneCodePollIntervalSeconds: DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS,
  phoneCodePollMaxRounds: DEFAULT_PHONE_CODE_POLL_ROUNDS,
  mailProvider: '163',
  mail2925Mode: DEFAULT_MAIL_2925_MODE,
  mail2925UseAccountPool: false,
  emailGenerator: 'duck',
  customMailProviderPool: [],
  customEmailPool: [],
  customEmailPoolEntries: [],
  autoDeleteUsedIcloudAlias: false,
  icloudHostPreference: 'auto',
  icloudTargetMailboxType: 'icloud-inbox',
  icloudForwardMailProvider: 'qq',
  icloudFetchMode: 'reuse_existing',
  accountRunHistoryTextEnabled: true,
  accountRunHistoryHelperBaseUrl: DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL,
  gmailBaseEmail: '',
  mail2925BaseEmail: '',
  currentMail2925AccountId: '',
  emailPrefix: '',
  inbucketHost: '',
  inbucketMailbox: '',
  hotmailServiceMode: HOTMAIL_SERVICE_MODE_LOCAL,
  hotmailRemoteBaseUrl: DEFAULT_HOTMAIL_REMOTE_BASE_URL,
  hotmailLocalBaseUrl: DEFAULT_HOTMAIL_LOCAL_BASE_URL,
  luckmailApiKey: '',
  luckmailBaseUrl: DEFAULT_LUCKMAIL_BASE_URL,
  luckmailEmailType: DEFAULT_LUCKMAIL_EMAIL_TYPE,
  luckmailDomain: '',
  luckmailUsedPurchases: {},
  luckmailPreserveTagId: 0,
  luckmailPreserveTagName: DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  cloudflareDomain: '',
  cloudflareDomains: [],
  cloudflareTempEmailBaseUrl: '',
  cloudflareTempEmailAdminAuth: '',
  cloudflareTempEmailCustomAuth: '',
  cloudflareTempEmailReceiveMailbox: '',
  cloudflareTempEmailUseRandomSubdomain: false,
  cloudflareTempEmailDomain: '',
  cloudflareTempEmailDomains: [],
  cloudMailBaseUrl: '',
  cloudMailAdminEmail: '',
  cloudMailAdminPassword: '',
  cloudMailToken: '',
  cloudMailReceiveMailbox: '',
  cloudMailDomain: '',
  cloudMailDomains: [],
  hotmailAccounts: [],
  mail2925Accounts: [],
  paypalAccounts: [],
  phoneSmsProvider: DEFAULT_PHONE_SMS_PROVIDER,
  heroSmsApiKey: '',
  heroSmsReuseEnabled: DEFAULT_HERO_SMS_REUSE_ENABLED,
  heroSmsAcquirePriority: DEFAULT_HERO_SMS_ACQUIRE_PRIORITY,
  heroSmsMaxPrice: '',
  heroSmsPreferredPrice: '',
  heroSmsCountryId: HERO_SMS_COUNTRY_ID,
  heroSmsCountryLabel: HERO_SMS_COUNTRY_LABEL,
  heroSmsCountryFallback: [],
  fiveSimApiKey: '',
  fiveSimProduct: DEFAULT_FIVE_SIM_PRODUCT,
  fiveSimCountryId: FIVE_SIM_COUNTRY_ID,
  fiveSimCountryLabel: FIVE_SIM_COUNTRY_LABEL,
  fiveSimCountryFallback: [],
  fiveSimCountryOrder: [...DEFAULT_FIVE_SIM_COUNTRY_ORDER],
  fiveSimMaxPrice: '',
  fiveSimOperator: FIVE_SIM_OPERATOR,
  nexSmsApiKey: '',
  nexSmsCountryOrder: [...DEFAULT_NEX_SMS_COUNTRY_ORDER],
  nexSmsServiceCode: DEFAULT_NEX_SMS_SERVICE_CODE,
  phonePreferredActivation: null,
};

const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
const SETTINGS_EXPORT_FILENAME_PREFIX = 'multipage-settings';
const STEP6_REGISTRATION_SUCCESS_WAIT_MS = 20000;

const DEFAULT_STATE = {
  currentStep: 0, // 当前流程执行到的步骤编号。
  stepStatuses: Object.fromEntries(STEP_IDS.map((stepId) => [stepId, 'pending'])),
  ...CONTRIBUTION_RUNTIME_DEFAULTS,
  oauthUrl: null, // 运行时抓取到的 OAuth 地址，不要手动预填。
  resolvedSignupMethod: null, // 当前自动轮次冻结后的实际注册方式。
  accountIdentifierType: null,
  accountIdentifier: '',
  email: null, // 运行时邮箱，由程序自动获取并写入，不能手动预填。
  password: null, // 运行时实际密码，由 customPassword 或程序自动生成后写入。
  accounts: [], // 已生成账号记录：{ email, password, createdAt }。
  accountRunHistory: [], // 账号运行历史快照，实际持久化在 chrome.storage.local。
  manualAliasUsage: {},
  preservedAliases: {},
  icloudAliasCache: [],
  icloudAliasCacheAt: 0,
  lastEmailTimestamp: null, // 最近一次获取到邮箱数据的运行时时间戳。
  lastSignupCode: null, // 注册验证码，运行时由程序自动读取并写入。
  lastLoginCode: null, // 登录验证码，运行时由程序自动读取并写入。
  localhostUrl: null, // 运行时捕获到的 localhost 回调地址，不要手动预填。
  cpaOAuthState: null, // CPA OAuth state。
  cpaManagementOrigin: null, // CPA 管理接口 origin。
  sub2apiSessionId: null, // SUB2API OpenAI Auth 会话 ID。
  sub2apiOAuthState: null, // SUB2API OpenAI Auth state。
  sub2apiGroupId: null, // SUB2API 目标分组 ID。
  sub2apiDraftName: null, // SUB2API 本轮预生成的账号名称。
  sub2apiProxyId: null, // SUB2API 本轮使用的代理 ID。
  codex2apiSessionId: null, // Codex2API OAuth 会话 ID。
  codex2apiOAuthState: null, // Codex2API OAuth state。
  plusCheckoutTabId: null, // Plus checkout / PayPal 标签页 ID。
  plusCheckoutUrl: null, // Plus checkout 运行时短链，不写入持久配置。
  plusCheckoutCountry: 'DE',
  plusCheckoutCurrency: 'EUR',
  plusCheckoutSource: '',
  plusBillingCountryText: '',
  plusBillingAddress: null,
  plusPaypalApprovedAt: null,
  plusGoPayApprovedAt: null,
  plusReturnUrl: '',
  plusManualConfirmationPending: false,
  plusManualConfirmationRequestId: '',
  plusManualConfirmationStep: 0,
  plusManualConfirmationMethod: '',
  plusManualConfirmationTitle: '',
  plusManualConfirmationMessage: '',
  gopayHelperReferenceId: '',
  gopayHelperGoPayGuid: '',
  gopayHelperRedirectUrl: '',
  gopayHelperNextAction: '',
  gopayHelperFlowId: '',
  gopayHelperChallengeId: '',
  gopayHelperStartPayload: null,
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
  gopayHelperOrderCreatedAt: 0,
  gopayHelperPinPayload: null,
  gopayHelperResolvedOtp: '',
  gopayHelperOtpRequestId: '',
  gopayHelperOtpReferenceId: '',
  flowStartTime: null, // 当前流程开始时间。
  tabRegistry: {}, // 程序维护的标签页注册表。
  sourceLastUrls: {}, // 各来源页面最近一次打开的地址记录。
  logs: [], // 侧边栏展示的运行日志。
  ...PERSISTED_SETTING_DEFAULTS, // 合并 chrome.storage.local 中持久化保存的用户配置。
  ipProxyApiPool: [],
  ipProxyApiCurrentIndex: 0,
  ipProxyApiCurrent: null,
  ipProxyAccountPool: [],
  ipProxyAccountCurrentIndex: 0,
  ipProxyAccountCurrent: null,
  ipProxyPool: [],
  ipProxyCurrentIndex: 0,
  ipProxyCurrent: null,
  luckmailApiKey: '',
  luckmailBaseUrl: DEFAULT_LUCKMAIL_BASE_URL,
  luckmailEmailType: DEFAULT_LUCKMAIL_EMAIL_TYPE,
  luckmailDomain: '',
  luckmailUsedPurchases: {},
  luckmailPreserveTagId: 0,
  luckmailPreserveTagName: DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  currentLuckmailPurchase: null,
  currentLuckmailMailCursor: null,
  currentPhoneActivation: null,
  phoneNumber: '',
  currentPhoneVerificationCode: '',
  currentPhoneVerificationCountdownEndsAt: 0,
  currentPhoneVerificationCountdownWindowIndex: 0,
  currentPhoneVerificationCountdownWindowTotal: 0,
  reusablePhoneActivation: null,
  freeReusablePhoneActivation: null,
  phoneReusableActivationPool: [],
  signupPhoneNumber: '',
  signupPhoneActivation: null,
  signupPhoneCompletedActivation: null,
  signupPhoneVerificationRequestedAt: null,
  signupPhoneVerificationPurpose: '',
  heroSmsLastPriceTiers: [],
  heroSmsLastPriceCountryId: 0,
  heroSmsLastPriceCountryLabel: '',
  heroSmsLastPriceUserLimit: '',
  heroSmsLastPriceAt: 0,
  pendingPhoneActivationConfirmation: null,
  autoRunning: false, // 当前是否处于自动运行中。
  autoRunPhase: 'idle', // 当前自动运行阶段。
  autoRunCurrentRun: 0, // 自动运行当前执行到第几轮。
  autoRunTotalRuns: 1, // 自动运行计划总轮数。
  autoRunAttemptRun: 0, // 当前轮次的重试序号。
  autoRunSessionId: 0,
  autoRunRoundSummaries: [], // 自动运行轮次摘要。
  scheduledAutoRunAt: null, // 自动运行计划启动时间戳。
  autoRunTimerPlan: null, // 自动运行可恢复计时计划快照。
  autoRunCountdownAt: null,
  autoRunCountdownTitle: '',
  autoRunCountdownNote: '',
  signupVerificationRequestedAt: null,
  loginVerificationRequestedAt: null,
  oauthFlowDeadlineAt: null,
  oauthFlowDeadlineSourceUrl: null,
  currentPayPalAccountId: null,
  currentHotmailAccountId: null,
  currentMail2925AccountId: null,
  preferredIcloudHost: '',
  ipProxyApplied: false,
  ipProxyAppliedReason: 'disabled',
  ipProxyAppliedAt: 0,
  ipProxyAppliedHost: '',
  ipProxyAppliedPort: 0,
  ipProxyAppliedRegion: '',
  ipProxyAppliedHasAuth: false,
  ipProxyAppliedProvider: DEFAULT_IP_PROXY_SERVICE,
  ipProxyAppliedError: '',
  ipProxyAppliedWarning: '',
  ipProxyAppliedExitIp: '',
  ipProxyAppliedExitRegion: '',
  ipProxyAppliedExitDetecting: false,
  ipProxyAppliedExitError: '',
  ipProxyAppliedExitSource: '',
};

function normalizeAutoRunDelayMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return PERSISTED_SETTING_DEFAULTS.autoRunDelayMinutes;
  }
  return Math.min(
    AUTO_RUN_DELAY_MAX_MINUTES,
    Math.max(AUTO_RUN_DELAY_MIN_MINUTES, Math.floor(numeric))
  );
}

function normalizeAutoRunFallbackThreadIntervalMinutes(value) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return 0;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(
    AUTO_RUN_DELAY_MAX_MINUTES,
    Math.max(0, Math.floor(numeric))
  );
}

function normalizeIpProxyAutoSyncIntervalMinutes(value, fallback = IP_PROXY_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return Math.min(
      IP_PROXY_AUTO_SYNC_INTERVAL_MAX_MINUTES,
      Math.max(IP_PROXY_AUTO_SYNC_INTERVAL_MIN_MINUTES, Math.floor(Number(fallback) || IP_PROXY_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES))
    );
  }
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return Math.min(
      IP_PROXY_AUTO_SYNC_INTERVAL_MAX_MINUTES,
      Math.max(IP_PROXY_AUTO_SYNC_INTERVAL_MIN_MINUTES, Math.floor(Number(fallback) || IP_PROXY_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES))
    );
  }
  return Math.min(
    IP_PROXY_AUTO_SYNC_INTERVAL_MAX_MINUTES,
    Math.max(IP_PROXY_AUTO_SYNC_INTERVAL_MIN_MINUTES, Math.floor(numeric))
  );
}

function normalizeAutoStepDelaySeconds(value, fallback = null) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return fallback;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    AUTO_STEP_DELAY_MAX_ALLOWED_SECONDS,
    Math.max(AUTO_STEP_DELAY_MIN_ALLOWED_SECONDS, Math.floor(numeric))
  );
}

function normalizeVerificationResendCount(value, fallback) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return fallback;
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(
    VERIFICATION_RESEND_COUNT_MAX,
    Math.max(VERIFICATION_RESEND_COUNT_MIN, Math.floor(numeric))
  );
}

function normalizePhoneVerificationReplacementLimit(value, fallback = DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isFinite(numeric)) {
    return Math.min(
      PHONE_REPLACEMENT_LIMIT_MAX,
      Math.max(PHONE_REPLACEMENT_LIMIT_MIN, Math.floor(Number(fallback) || DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT))
    );
  }
  return Math.min(
    PHONE_REPLACEMENT_LIMIT_MAX,
    Math.max(PHONE_REPLACEMENT_LIMIT_MIN, Math.floor(numeric))
  );
}

function normalizePhoneCodeWaitSeconds(value, fallback = DEFAULT_PHONE_CODE_WAIT_SECONDS) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isFinite(numeric)) {
    return Math.min(
      PHONE_CODE_WAIT_SECONDS_MAX,
      Math.max(PHONE_CODE_WAIT_SECONDS_MIN, Math.floor(Number(fallback) || DEFAULT_PHONE_CODE_WAIT_SECONDS))
    );
  }
  return Math.min(
    PHONE_CODE_WAIT_SECONDS_MAX,
    Math.max(PHONE_CODE_WAIT_SECONDS_MIN, Math.floor(numeric))
  );
}

function normalizePhoneCodeTimeoutWindows(value, fallback = DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isFinite(numeric)) {
    return Math.min(
      PHONE_CODE_TIMEOUT_WINDOWS_MAX,
      Math.max(PHONE_CODE_TIMEOUT_WINDOWS_MIN, Math.floor(Number(fallback) || DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS))
    );
  }
  return Math.min(
    PHONE_CODE_TIMEOUT_WINDOWS_MAX,
    Math.max(PHONE_CODE_TIMEOUT_WINDOWS_MIN, Math.floor(numeric))
  );
}

function normalizePhoneCodePollIntervalSeconds(value, fallback = DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isFinite(numeric)) {
    return Math.min(
      PHONE_CODE_POLL_INTERVAL_SECONDS_MAX,
      Math.max(PHONE_CODE_POLL_INTERVAL_SECONDS_MIN, Math.floor(Number(fallback) || DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS))
    );
  }
  return Math.min(
    PHONE_CODE_POLL_INTERVAL_SECONDS_MAX,
    Math.max(PHONE_CODE_POLL_INTERVAL_SECONDS_MIN, Math.floor(numeric))
  );
}

function normalizePhoneCodePollMaxRounds(value, fallback = DEFAULT_PHONE_CODE_POLL_ROUNDS) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isFinite(numeric)) {
    return Math.min(
      PHONE_CODE_POLL_ROUNDS_MAX,
      Math.max(PHONE_CODE_POLL_ROUNDS_MIN, Math.floor(Number(fallback) || DEFAULT_PHONE_CODE_POLL_ROUNDS))
    );
  }
  return Math.min(
    PHONE_CODE_POLL_ROUNDS_MAX,
    Math.max(PHONE_CODE_POLL_ROUNDS_MIN, Math.floor(numeric))
  );
}

function normalizeBoundedIntegerSetting(value, fallback, min, max) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  const fallbackNumeric = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumeric)
    ? Math.min(max, Math.max(min, Math.floor(fallbackNumeric)))
    : min;
  if (!rawValue || !Number.isFinite(numeric)) {
    return normalizedFallback;
  }
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function normalizeLocalHttpBaseUrl(value = '', fallback = 'http://127.0.0.1:18767') {
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

function normalizeHeroSmsMaxPrice(value = '') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return String(Math.round(numeric * 10000) / 10000);
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

function normalizeHeroSmsCountryFallback(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const seenIds = new Set();
  const normalized = [];

  for (const entry of source) {
    let countryId = 0;
    let countryLabel = '';

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      countryId = Math.floor(Number(entry.countryId ?? entry.id) || 0);
      countryLabel = String((entry.countryLabel ?? entry.label) || '').trim();
    } else {
      const text = String(entry || '').trim();
      const structuredMatch = text.match(/^(\d+)\s*(?:[:|/-]\s*(.+))?$/);
      if (structuredMatch) {
        countryId = Math.floor(Number(structuredMatch[1]) || 0);
        countryLabel = String(structuredMatch[2] || '').trim();
      } else {
        countryId = Math.floor(Number(text) || 0);
      }
    }

    if (!Number.isFinite(countryId) || countryId <= 0 || seenIds.has(countryId)) {
      continue;
    }
    seenIds.add(countryId);
    normalized.push({
      id: countryId,
      label: countryLabel || `Country #${countryId}`,
    });
    if (normalized.length >= 20) {
      break;
    }
  }

  return normalized;
}


function normalizePhoneSmsProvider(value = '') {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  if (rootScope.PhoneSmsProviderRegistry?.normalizeProviderId) {
    return rootScope.PhoneSmsProviderRegistry.normalizeProviderId(value);
  }
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === PHONE_SMS_PROVIDER_FIVE_SIM) {
    return PHONE_SMS_PROVIDER_FIVE_SIM;
  }
  if (normalized === PHONE_SMS_PROVIDER_NEXSMS) {
    return PHONE_SMS_PROVIDER_NEXSMS;
  }
  return PHONE_SMS_PROVIDER_HERO_SMS;
}

function normalizePhoneSmsProviderOrder(value = [], fallbackOrder = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[\r\n,，;；]+/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  const normalized = [];
  const seen = new Set();

  source.forEach((entry) => {
    const provider = normalizePhoneSmsProvider(
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry.provider || entry.id || entry.value || '')
        : entry
    );
    if (!provider || seen.has(provider)) {
      return;
    }
    seen.add(provider);
    normalized.push(provider);
  });

  if (normalized.length) {
    return normalized.slice(0, DEFAULT_PHONE_SMS_PROVIDER_ORDER.length);
  }

  const fallback = Array.isArray(fallbackOrder) ? fallbackOrder : [];
  fallback.forEach((entry) => {
    const provider = normalizePhoneSmsProvider(
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? (entry.provider || entry.id || entry.value || '')
        : entry
    );
    if (!provider || seen.has(provider)) {
      return;
    }
    seen.add(provider);
    normalized.push(provider);
  });

  return normalized.slice(0, DEFAULT_PHONE_SMS_PROVIDER_ORDER.length);
}

function normalizeSignupMethod(value = '') {
  return String(value || '').trim().toLowerCase() === 'phone'
    ? 'phone'
    : 'email';
}

function canUsePhoneSignup(state = {}) {
  return Boolean(state?.phoneVerificationEnabled)
    && !Boolean(state?.plusModeEnabled)
    && !Boolean(state?.contributionMode);
}

function resolveSignupMethod(state = {}) {
  const frozenMethod = String(state?.resolvedSignupMethod || '').trim().toLowerCase();
  if (frozenMethod === SIGNUP_METHOD_EMAIL || frozenMethod === SIGNUP_METHOD_PHONE) {
    return normalizeSignupMethod(frozenMethod);
  }
  const method = normalizeSignupMethod(state?.signupMethod);
  return method === SIGNUP_METHOD_PHONE && canUsePhoneSignup(state)
    ? SIGNUP_METHOD_PHONE
    : SIGNUP_METHOD_EMAIL;
}

async function ensureResolvedSignupMethodForRun(options = {}) {
  const state = await getState();
  const force = Boolean(options.force);
  const existing = String(state?.resolvedSignupMethod || '').trim().toLowerCase();
  if (!force && (existing === SIGNUP_METHOD_EMAIL || existing === SIGNUP_METHOD_PHONE)) {
    return normalizeSignupMethod(existing);
  }

  const configuredMethod = normalizeSignupMethod(state?.signupMethod);
  const resolvedMethod = resolveSignupMethod({
    ...state,
    resolvedSignupMethod: null,
  });
  await setState({ resolvedSignupMethod: resolvedMethod });
  if (configuredMethod === SIGNUP_METHOD_PHONE && resolvedMethod !== SIGNUP_METHOD_PHONE) {
    await addLog('当前模式暂不支持手机号注册，本轮已固定为邮箱注册。', 'warn');
  }
  return resolvedMethod;
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

function normalizeFiveSimCountryId(value, fallback = FIVE_SIM_COUNTRY_ID) {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  const rawNormalized = rootScope.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryId
    ? rootScope.PhoneSmsFiveSimProvider.normalizeFiveSimCountryId(value, '')
    : String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const normalized = String(rawNormalized || '').trim().toLowerCase();
  if (normalized) {
    return normalized;
  }
  const fallbackSource = fallback === undefined || fallback === null ? FIVE_SIM_COUNTRY_ID : fallback;
  const normalizedFallback = String(fallbackSource).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  if (!normalizedFallback) {
    return '';
  }
  return normalizedFallback || FIVE_SIM_COUNTRY_ID;
}

function normalizeFiveSimCountryCode(value = '', fallback = 'thailand') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '');
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
  return fallbackNormalized || DEFAULT_NEX_SMS_SERVICE_CODE;
}

function normalizePhonePreferredActivation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const activationId = String(value.activationId ?? value.id ?? value.activation ?? '').trim();
  const phoneNumber = String(value.phoneNumber ?? value.number ?? value.phone ?? '').trim();
  if (!activationId || !phoneNumber) {
    return null;
  }
  const provider = normalizePhoneSmsProvider(value.provider || value.smsProvider || DEFAULT_PHONE_SMS_PROVIDER);
  return {
    ...value,
    provider,
    activationId,
    phoneNumber,
    countryId: value.countryId ?? value.country ?? value.countryCode ?? null,
    countryLabel: String(value.countryLabel || value.label || '').trim(),
    successfulUses: Math.max(0, Math.floor(Number(value.successfulUses) || 0)),
    maxUses: Math.max(1, Math.floor(Number(value.maxUses) || 1)),
  };
}

function normalizeFiveSimCountryLabel(value = '', fallback = FIVE_SIM_COUNTRY_LABEL) {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  if (rootScope.PhoneSmsFiveSimProvider?.normalizeFiveSimCountryLabel) {
    return rootScope.PhoneSmsFiveSimProvider.normalizeFiveSimCountryLabel(value, fallback);
  }
  if (rootScope.PhoneSmsFiveSimProvider?.formatFiveSimCountryLabel) {
    return rootScope.PhoneSmsFiveSimProvider.formatFiveSimCountryLabel('', value, fallback);
  }
  return String(value || '').trim() || fallback;
}

function normalizeFiveSimOperator(value = '', fallback = FIVE_SIM_OPERATOR) {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  if (rootScope.PhoneSmsFiveSimProvider?.normalizeFiveSimOperator) {
    return rootScope.PhoneSmsFiveSimProvider.normalizeFiveSimOperator(value || fallback);
  }
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '') || fallback;
}

function normalizeFiveSimMaxPrice(value = '') {
  const rootScope = typeof self !== 'undefined' ? self : globalThis;
  if (rootScope.PhoneSmsFiveSimProvider?.normalizeFiveSimMaxPrice) {
    return rootScope.PhoneSmsFiveSimProvider.normalizeFiveSimMaxPrice(value);
  }
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '';
  }
  return String(Math.round(numeric * 10000) / 10000);
}

function normalizeFiveSimCountryFallback(value = []) {
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
  const seenIds = new Set();
  const normalized = [];

  for (const entry of source) {
    let countryId = '';
    let countryLabel = '';

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      countryId = normalizeFiveSimCountryId(entry.countryId ?? entry.id ?? entry.slug, '');
      countryLabel = String((entry.countryLabel ?? entry.label ?? entry.name ?? entry.text_en) || '').trim();
    } else {
      const text = String(entry || '').trim();
      const structuredMatch = text.match(/^([a-z0-9_-]+)\s*(?:[:|/-]\s*(.+))?$/i);
      countryId = normalizeFiveSimCountryId(structuredMatch?.[1] || text, '');
      countryLabel = String(structuredMatch?.[2] || '').trim();
    }

    if (!countryId || seenIds.has(countryId)) {
      continue;
    }
    seenIds.add(countryId);
    normalized.push({
      id: countryId,
      label: countryLabel || normalizeFiveSimCountryLabel('', countryId),
    });
    if (normalized.length >= 20) {
      break;
    }
  }

  return normalized;
}

function resolveLegacyAutoStepDelaySeconds(input = {}) {
  const hasLegacyMin = input.autoStepRandomDelayMinSeconds !== undefined;
  const hasLegacyMax = input.autoStepRandomDelayMaxSeconds !== undefined;
  if (!hasLegacyMin && !hasLegacyMax) {
    return undefined;
  }

  const minSeconds = normalizeAutoStepDelaySeconds(input.autoStepRandomDelayMinSeconds, null);
  const maxSeconds = normalizeAutoStepDelaySeconds(input.autoStepRandomDelayMaxSeconds, null);
  if (minSeconds === null && maxSeconds === null) {
    return null;
  }
  if (minSeconds === null) {
    return maxSeconds;
  }
  if (maxSeconds === null) {
    return minSeconds;
  }
  return Math.round((minSeconds + maxSeconds) / 2);
}

function normalizeRunCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(1, Math.floor(numeric));
}

function normalizeAutoRunTimerKind(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === AUTO_RUN_TIMER_KIND_SCHEDULED_START) {
    return AUTO_RUN_TIMER_KIND_SCHEDULED_START;
  }
  if (normalized === AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS) {
    return AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS;
  }
  if (normalized === AUTO_RUN_TIMER_KIND_BEFORE_RETRY) {
    return AUTO_RUN_TIMER_KIND_BEFORE_RETRY;
  }
  return '';
}

function normalizeAutoRunSessionId(value) {
  const numeric = Math.floor(Number(value) || 0);
  return numeric > 0 ? numeric : 0;
}

function createAutoRunSessionId() {
  autoRunSessionSeed = Math.max(autoRunSessionSeed + 1, Date.now());
  autoRunSessionId = autoRunSessionSeed;
  return autoRunSessionId;
}

function setCurrentAutoRunSessionId(value) {
  autoRunSessionId = normalizeAutoRunSessionId(value);
  return autoRunSessionId;
}

function clearCurrentAutoRunSessionId(expectedSessionId = null) {
  if (expectedSessionId === null) {
    autoRunSessionId = 0;
    return autoRunSessionId;
  }

  const normalizedExpected = normalizeAutoRunSessionId(expectedSessionId);
  if (!normalizedExpected || normalizedExpected === autoRunSessionId) {
    autoRunSessionId = 0;
  }
  return autoRunSessionId;
}

function isCurrentAutoRunSessionId(value) {
  const normalized = normalizeAutoRunSessionId(value);
  return normalized > 0 && normalized === autoRunSessionId;
}

function throwIfAutoRunSessionStopped(sessionId) {
  const normalizedSessionId = normalizeAutoRunSessionId(sessionId);
  if (normalizedSessionId && !isCurrentAutoRunSessionId(normalizedSessionId)) {
    throw new Error(STOP_ERROR_MESSAGE);
  }
  throwIfStopped();
}

function normalizeAutoRunTimerPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return null;
  }

  const kind = normalizeAutoRunTimerKind(plan.kind);
  if (!kind) {
    return null;
  }

  const fireAt = Number(plan.fireAt);
  if (!Number.isFinite(fireAt)) {
    return null;
  }

  const totalRuns = normalizeRunCount(plan.totalRuns);
  const autoRunSkipFailures = Boolean(plan.autoRunSkipFailures);
  const mode = plan.mode === 'continue' ? 'continue' : 'restart';
  const currentRun = Math.max(0, Math.min(totalRuns, Math.floor(Number(plan.currentRun) || 0)));
  const attemptRun = Math.max(
    0,
    Math.min(AUTO_RUN_MAX_RETRIES_PER_ROUND + 1, Math.floor(Number(plan.attemptRun) || 0))
  );
  const autoRunSessionId = normalizeAutoRunSessionId(plan.autoRunSessionId ?? plan.sessionId);
  const roundSummaries = serializeAutoRunRoundSummaries(totalRuns, plan.roundSummaries);
  const countdownTitle = String(plan.countdownTitle || '').trim();
  const countdownNote = String(plan.countdownNote || '').trim();

  if (kind === AUTO_RUN_TIMER_KIND_SCHEDULED_START) {
    return {
      kind,
      fireAt,
      totalRuns,
      autoRunSkipFailures,
      mode,
      currentRun: 0,
      attemptRun: 0,
      autoRunSessionId,
      roundSummaries: [],
      countdownTitle: countdownTitle || '已计划自动运行',
      countdownNote: countdownNote || `计划于 ${formatAutoRunScheduleTime(fireAt)} 开始`,
    };
  }

  if (kind === AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS) {
    const normalizedCurrentRun = Math.max(1, Math.min(totalRuns, currentRun));
    const normalizedAttemptRun = Math.max(1, attemptRun);
    return {
      kind,
      fireAt,
      totalRuns,
      autoRunSkipFailures,
      mode: 'restart',
      currentRun: normalizedCurrentRun,
      attemptRun: normalizedAttemptRun,
      autoRunSessionId,
      roundSummaries,
      countdownTitle: countdownTitle || '线程间隔中',
      countdownNote: countdownNote || `第 ${Math.min(normalizedCurrentRun + 1, totalRuns)}/${totalRuns} 轮即将开始`,
    };
  }

  const normalizedCurrentRun = Math.max(1, Math.min(totalRuns, currentRun));
  const normalizedAttemptRun = Math.max(1, attemptRun);
  return {
    kind,
    fireAt,
    totalRuns,
    autoRunSkipFailures,
    mode: 'restart',
    currentRun: normalizedCurrentRun,
    attemptRun: normalizedAttemptRun,
    autoRunSessionId,
    roundSummaries,
    countdownTitle: countdownTitle || '线程间隔中',
    countdownNote: countdownNote || `第 ${normalizedCurrentRun}/${totalRuns} 轮第 ${normalizedAttemptRun} 次尝试即将开始`,
  };
}

function normalizeAutoRunTimerPlanFromState(state = {}) {
  const directPlan = normalizeAutoRunTimerPlan(state.autoRunTimerPlan);
  if (directPlan) {
    return directPlan;
  }

  if (state.autoRunPhase !== 'scheduled') {
    return null;
  }

  const legacyScheduledAt = Number(state.scheduledAutoRunAt);
  if (!Number.isFinite(legacyScheduledAt)) {
    return null;
  }

  return normalizeAutoRunTimerPlan({
    kind: AUTO_RUN_TIMER_KIND_SCHEDULED_START,
    fireAt: legacyScheduledAt,
    totalRuns: state.scheduledAutoRunPlan?.totalRuns ?? state.autoRunTotalRuns,
    autoRunSkipFailures: state.scheduledAutoRunPlan?.autoRunSkipFailures ?? state.autoRunSkipFailures,
    autoRunSessionId: state.autoRunSessionId,
    mode: state.scheduledAutoRunPlan?.mode,
  });
}

function getAutoRunTimerPlanPhase(kind = '') {
  return kind === AUTO_RUN_TIMER_KIND_SCHEDULED_START ? 'scheduled' : 'waiting_interval';
}

function getAutoRunTimerStatusPayload(plan) {
  const normalizedPlan = normalizeAutoRunTimerPlan(plan);
  if (!normalizedPlan) {
    return null;
  }

  const phase = getAutoRunTimerPlanPhase(normalizedPlan.kind);
  return {
    phase,
    currentRun: normalizedPlan.currentRun,
    totalRuns: normalizedPlan.totalRuns,
    attemptRun: normalizedPlan.attemptRun,
    sessionId: normalizedPlan.autoRunSessionId,
    scheduledAt: phase === 'scheduled' ? normalizedPlan.fireAt : null,
    countdownAt: normalizedPlan.fireAt,
    countdownTitle: normalizedPlan.countdownTitle,
    countdownNote: normalizedPlan.countdownNote,
  };
}

function normalizeEmailGenerator(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  const customEmailPoolGenerator = typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
    ? CUSTOM_EMAIL_POOL_GENERATOR
    : 'custom-pool';
  const gmailAliasGenerator = typeof GMAIL_ALIAS_GENERATOR === 'string'
    ? GMAIL_ALIAS_GENERATOR
    : 'gmail-alias';
  if (normalized === 'custom' || normalized === 'manual') {
    return 'custom';
  }
  if (normalized === gmailAliasGenerator) {
    return gmailAliasGenerator;
  }
  if (normalized === customEmailPoolGenerator) {
    return customEmailPoolGenerator;
  }
  if (normalized === 'icloud') {
    return 'icloud';
  }
  if (normalized === 'cloudflare') return 'cloudflare';
  if (normalized === CLOUDFLARE_TEMP_EMAIL_GENERATOR) return CLOUDFLARE_TEMP_EMAIL_GENERATOR;
  if (normalized === 'cloudmail') return 'cloudmail';
  return 'duck';
}

function normalizeIcloudFetchMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'always_new' ? 'always_new' : 'reuse_existing';
}

function normalizeCustomEmailPool(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\r\n,，;；]+/);

  return source
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

function normalizeCustomEmailPoolEntryObjects(value = []) {
  const source = Array.isArray(value) ? value : [];
  const seenEmails = new Set();
  const entries = [];

  for (const rawEntry of source) {
    const asObject = rawEntry && typeof rawEntry === 'object'
      ? rawEntry
      : { email: rawEntry };
    const email = String(asObject.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      continue;
    }
    if (seenEmails.has(email)) {
      continue;
    }
    seenEmails.add(email);
    entries.push({
      id: String(asObject.id || `custom-pool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
      email,
      enabled: asObject.enabled !== undefined ? Boolean(asObject.enabled) : true,
      used: Boolean(asObject.used),
      note: String(asObject.note || '').trim(),
      lastUsedAt: Number.isFinite(Number(asObject.lastUsedAt)) ? Number(asObject.lastUsedAt) : 0,
    });
  }

  return entries;
}

function isCustomEmailPoolGenerator(stateOrValue = {}) {
  const generator = typeof stateOrValue === 'string'
    ? stateOrValue
    : stateOrValue?.emailGenerator;
  const customEmailPoolGenerator = typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
    ? CUSTOM_EMAIL_POOL_GENERATOR
    : 'custom-pool';
  return normalizeEmailGenerator(generator) === customEmailPoolGenerator;
}

function getCustomEmailPool(state = {}) {
  if (typeof normalizeCustomEmailPoolEntryObjects === 'function') {
    const entries = normalizeCustomEmailPoolEntryObjects(state?.customEmailPoolEntries);
    if (entries.length > 0) {
      return entries
        .filter((entry) => entry.enabled && !entry.used)
        .map((entry) => entry.email);
    }
  }
  return normalizeCustomEmailPool(state?.customEmailPool);
}

function getCustomEmailPoolEntries(state = {}) {
  const entries = normalizeCustomEmailPoolEntryObjects(state?.customEmailPoolEntries);
  if (entries.length > 0) {
    return entries;
  }
  return normalizeCustomEmailPool(state?.customEmailPool).map((email) => ({
    id: `custom-pool-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    email,
    enabled: true,
    used: false,
    note: '',
    lastUsedAt: 0,
  }));
}

async function markCurrentCustomEmailPoolEntryUsed(state = {}, options = {}) {
  if (!isCustomEmailPoolGenerator(state)) {
    return { updated: false };
  }

  const currentEmail = String(state?.email || '').trim().toLowerCase();
  if (!currentEmail) {
    return { updated: false };
  }

  const entries = getCustomEmailPoolEntries(state);
  if (!entries.length) {
    return { updated: false };
  }

  let changed = false;
  const now = Date.now();
  const nextEntries = entries.map((entry) => {
    if (entry.email !== currentEmail) {
      return entry;
    }
    if (entry.used && entry.lastUsedAt) {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      used: true,
      lastUsedAt: now,
    };
  });

  if (!changed) {
    return { updated: false };
  }

  const nextCustomEmailPool = nextEntries
    .filter((entry) => entry.enabled && !entry.used)
    .map((entry) => entry.email);
  await setPersistentSettings({
    customEmailPoolEntries: nextEntries,
    customEmailPool: nextCustomEmailPool,
  });
  await setState({
    customEmailPoolEntries: nextEntries,
    customEmailPool: nextCustomEmailPool,
  });
  broadcastDataUpdate({
    customEmailPoolEntries: nextEntries,
    customEmailPool: nextCustomEmailPool,
  });
  const logPrefix = String(options.logPrefix || '').trim() || '自定义邮箱池：流程成功后';
  await addLog(`${logPrefix}已将 ${currentEmail} 标记为已用。`, options.level || 'ok');
  return {
    updated: true,
    customEmailPoolEntries: nextEntries,
    customEmailPool: nextCustomEmailPool,
  };
}

async function markCurrentRegistrationAccountUsed(state = {}, options = {}) {
  const providedState = state && typeof state === 'object' ? state : {};
  const currentState = await getState();
  const latestState = {
    ...providedState,
    ...(currentState && typeof currentState === 'object' ? currentState : {}),
  };
  const reasonPrefix = String(options.logPrefix || '').trim() || '当前账号';
  let updated = false;

  if (latestState.currentHotmailAccountId && isHotmailProvider(latestState)) {
    await patchHotmailAccount(latestState.currentHotmailAccountId, {
      used: true,
      lastUsedAt: Date.now(),
    });
    await addLog(`${reasonPrefix}：Hotmail 账号已标记为已用。`, options.level || 'warn');
    updated = true;
  }

  if (isLuckmailProvider(latestState)) {
    const currentPurchase = getCurrentLuckmailPurchase(latestState);
    if (currentPurchase?.id) {
      await setLuckmailPurchaseUsedState(currentPurchase.id, true);
      await clearLuckmailRuntimeState({ clearEmail: true });
      await addLog(`${reasonPrefix}：LuckMail 邮箱 ${currentPurchase.email_address} 已标记为已用。`, options.level || 'warn');
      updated = true;
    }
  }

  if (String(latestState.mailProvider || '').trim().toLowerCase() === '2925' && latestState.currentMail2925AccountId) {
    await patchMail2925Account(latestState.currentMail2925AccountId, {
      lastUsedAt: Date.now(),
      lastError: '',
    });
    await addLog(`${reasonPrefix}：2925 账号已记录最近使用时间。`, options.level || 'warn');
    updated = true;
  }

  const icloudResult = await finalizeIcloudAliasAfterSuccessfulFlow(latestState);
  updated = Boolean(icloudResult?.handled) || updated;

  if (typeof markCurrentCustomEmailPoolEntryUsed === 'function') {
    const result = await markCurrentCustomEmailPoolEntryUsed(latestState, {
      logPrefix: `${reasonPrefix}：自定义邮箱池`,
      level: options.level || 'warn',
    });
    updated = Boolean(result?.updated) || updated;
  }

  return { updated };
}

function getCustomEmailPoolEmailForRun(state = {}, targetRun = 1) {
  const entries = getCustomEmailPool(state);
  const numericRun = Math.max(1, Math.floor(Number(targetRun) || 1));
  return entries[numericRun - 1] || '';
}

function getCustomMailProviderPool(state = {}) {
  return normalizeCustomEmailPool(state?.customMailProviderPool);
}

function getCustomMailProviderPoolEmailForRun(state = {}, targetRun = 1) {
  const entries = getCustomMailProviderPool(state);
  const numericRun = Math.max(1, Math.floor(Number(targetRun) || 1));
  return entries[numericRun - 1] || '';
}

function normalizePanelMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'sub2api') {
    return 'sub2api';
  }
  if (normalized === 'codex2api') {
    return 'codex2api';
  }
  return 'cpa';
}

function normalizeMailProvider(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'custom':
    case ICLOUD_PROVIDER:
    case GMAIL_PROVIDER:
    case HOTMAIL_PROVIDER:
    case LUCKMAIL_PROVIDER:
    case CLOUDFLARE_TEMP_EMAIL_PROVIDER:
    case CLOUD_MAIL_PROVIDER:
    case '163':
    case '163-vip':
    case '126':
    case 'qq':
    case 'inbucket':
    case '2925':
      return normalized;
    default:
      return PERSISTED_SETTING_DEFAULTS.mailProvider;
  }
}

function buildLuckmailSessionSettingsPayload(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const payload = {};

  if (input.luckmailApiKey !== undefined) {
    payload.luckmailApiKey = String(input.luckmailApiKey || '');
  }
  if (input.luckmailBaseUrl !== undefined) {
    payload.luckmailBaseUrl = normalizeLuckmailBaseUrl(input.luckmailBaseUrl);
  }
  if (input.luckmailEmailType !== undefined) {
    payload.luckmailEmailType = normalizeLuckmailEmailType(input.luckmailEmailType);
  }
  if (input.luckmailDomain !== undefined) {
    payload.luckmailDomain = String(input.luckmailDomain || '').trim();
  }
  if (input.luckmailUsedPurchases !== undefined) {
    payload.luckmailUsedPurchases = normalizeLuckmailUsedPurchases(input.luckmailUsedPurchases);
  }
  if (input.luckmailPreserveTagId !== undefined) {
    payload.luckmailPreserveTagId = Number(input.luckmailPreserveTagId) || 0;
  }
  if (input.luckmailPreserveTagName !== undefined) {
    payload.luckmailPreserveTagName = String(input.luckmailPreserveTagName || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME;
  }
  if (input.currentLuckmailPurchase !== undefined) {
    payload.currentLuckmailPurchase = input.currentLuckmailPurchase
      ? normalizeLuckmailPurchase(input.currentLuckmailPurchase)
      : null;
  }
  if (input.currentLuckmailMailCursor !== undefined) {
    payload.currentLuckmailMailCursor = input.currentLuckmailMailCursor
      ? normalizeLuckmailMailCursor(input.currentLuckmailMailCursor)
      : null;
  }

  return payload;
}

function normalizeMail2925Mode(value = '') {
  return String(value || '').trim().toLowerCase() === MAIL_2925_MODE_RECEIVE
    ? MAIL_2925_MODE_RECEIVE
    : DEFAULT_MAIL_2925_MODE;
}

function normalizeLocalCpaStep9Mode(value = '') {
  return String(value || '').trim().toLowerCase() === 'bypass'
    ? 'bypass'
    : DEFAULT_LOCAL_CPA_STEP9_MODE;
}

function normalizeCloudflareDomain(rawValue = '') {
  let value = String(rawValue || '').trim().toLowerCase();
  if (!value) return '';
  value = value.replace(/^@+/, '');
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return '';
  return value;
}

function normalizeCloudflareDomains(values) {
  const normalizedDomains = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeCloudflareDomain(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedDomains.push(normalized);
  }

  return normalizedDomains;
}

function normalizeHotmailRemoteBaseUrl(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value) return DEFAULT_HOTMAIL_REMOTE_BASE_URL;

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return DEFAULT_HOTMAIL_REMOTE_BASE_URL;
    }

    if (parsed.pathname.endsWith('/api/mail-new') || parsed.pathname.endsWith('/api/mail-all') || parsed.pathname === '/api.html') {
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_HOTMAIL_REMOTE_BASE_URL;
  }
}

function normalizeHotmailLocalBaseUrl(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value) return DEFAULT_HOTMAIL_LOCAL_BASE_URL;

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return DEFAULT_HOTMAIL_LOCAL_BASE_URL;
    }

    if (['/messages', '/code', '/clear', '/token'].includes(parsed.pathname)) {
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_HOTMAIL_LOCAL_BASE_URL;
  }
}

function normalizeAccountRunHistoryHelperBaseUrl(rawValue = '') {
  const value = String(rawValue || '').trim();
  if (!value) return DEFAULT_ACCOUNT_RUN_HISTORY_HELPER_BASE_URL;

  try {
    const parsed = new URL(value);
    if (parsed.pathname === '/append-account-log' || parsed.pathname === '/sync-account-run-records') {
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
    }
    return normalizeHotmailLocalBaseUrl(parsed.toString());
  } catch {
    return normalizeHotmailLocalBaseUrl(value);
  }
}

function getHotmailServiceSettings(state = {}) {
  return {
    mode: normalizeHotmailServiceMode(state.hotmailServiceMode),
    remoteBaseUrl: normalizeHotmailRemoteBaseUrl(state.hotmailRemoteBaseUrl),
    localBaseUrl: normalizeHotmailLocalBaseUrl(state.hotmailLocalBaseUrl),
  };
}

function getCloudflareTempEmailConfig(state = {}) {
  return {
    baseUrl: normalizeCloudflareTempEmailBaseUrl(state.cloudflareTempEmailBaseUrl),
    adminAuth: String(state.cloudflareTempEmailAdminAuth || ''),
    customAuth: String(state.cloudflareTempEmailCustomAuth || ''),
    receiveMailbox: normalizeCloudflareTempEmailReceiveMailbox(state.cloudflareTempEmailReceiveMailbox),
    useRandomSubdomain: Boolean(state.cloudflareTempEmailUseRandomSubdomain),
    domain: normalizeCloudflareTempEmailDomain(state.cloudflareTempEmailDomain),
    domains: normalizeCloudflareTempEmailDomains(state.cloudflareTempEmailDomains),
  };
}

function normalizeCloudflareTempEmailReceiveMailbox(value = '') {
  const normalized = normalizeCloudflareTempEmailAddress(value);
  if (!normalized) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : '';
}

function resolveCloudflareTempEmailPollTargetEmail(state = {}, pollPayload = {}, config = getCloudflareTempEmailConfig(state)) {
  const configuredReceiveMailbox = normalizeCloudflareTempEmailReceiveMailbox(config.receiveMailbox);
  const mailProvider = String(state?.mailProvider || '').trim().toLowerCase();
  const emailGenerator = String(state?.emailGenerator || '').trim().toLowerCase();
  const shouldPreferConfiguredReceiveMailbox = mailProvider === 'cloudflare-temp-email'
    && emailGenerator !== 'cloudflare-temp-email';
  if (shouldPreferConfiguredReceiveMailbox && configuredReceiveMailbox) {
    return configuredReceiveMailbox;
  }

  const requestedTarget = normalizeCloudflareTempEmailReceiveMailbox(pollPayload.targetEmail);
  if (requestedTarget) {
    return requestedTarget;
  }

  return normalizeCloudflareTempEmailReceiveMailbox(state.email);
}

const cloudMailProvider = self.MultiPageBackgroundCloudMailProvider.createCloudMailProvider({
  addLog,
  buildCloudMailHeaders,
  CLOUD_MAIL_DEFAULT_PAGE_SIZE,
  CLOUD_MAIL_GENERATOR,
  CLOUD_MAIL_PROVIDER,
  getCloudMailTokenFromResponse,
  getState,
  joinCloudMailUrl,
  normalizeCloudMailAddress,
  normalizeCloudMailBaseUrl,
  normalizeCloudMailDomain,
  normalizeCloudMailDomains,
  normalizeCloudMailMailApiMessages,
  pickVerificationMessageWithTimeFallback,
  setEmailState,
  setPersistentSettings,
  sleepWithStop,
  throwIfStopped,
});
const {
  getCloudMailConfig,
  normalizeCloudMailReceiveMailbox,
  fetchCloudMailAddress,
  pollCloudMailVerificationCode,
  resolveCloudMailPollTargetEmail,
} = cloudMailProvider;

function normalizeSub2ApiGroupNames(value = '') {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\r\n,，、]+/);
  const names = [];
  const seen = new Set();
  for (const item of source) {
    const name = String(item || '').trim();
    const key = name.toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return names;
}

function normalizeSub2ApiAccountPriority(value, fallback = DEFAULT_SUB2API_ACCOUNT_PRIORITY) {
  const rawValue = String(value ?? '').trim();
  const numeric = Number(rawValue);
  if (!rawValue || !Number.isSafeInteger(numeric) || numeric < 1) {
    const fallbackNumber = Number(fallback);
    return Number.isSafeInteger(fallbackNumber) && fallbackNumber >= 1
      ? fallbackNumber
      : DEFAULT_SUB2API_ACCOUNT_PRIORITY;
  }
  return numeric;
}

function normalizePersistentSettingValue(key, value) {
  switch (key) {
    case 'panelMode':
      return normalizePanelMode(value);
    case 'vpsUrl':
      return String(value || '').trim();
    case 'vpsPassword':
      return String(value || '');
    case 'localCpaStep9Mode':
      return normalizeLocalCpaStep9Mode(value);
    case 'sub2apiUrl':
      return String(value || '').trim();
    case 'sub2apiEmail':
      return String(value || '').trim();
    case 'sub2apiPassword':
      return String(value || '');
    case 'sub2apiGroupName':
      return String(value || '').trim();
    case 'sub2apiGroupNames':
      return normalizeSub2ApiGroupNames(value);
    case 'sub2apiAccountPriority':
      return normalizeSub2ApiAccountPriority(value);
    case 'sub2apiDefaultProxyName':
      return String(value || '').trim();
    case 'ipProxyEnabled':
      return Boolean(value);
    case 'ipProxyService':
      return normalizeIpProxyProviderValue(value);
    case 'ipProxyMode':
      return normalizeIpProxyMode(value);
    case 'ipProxyApiUrl':
      return String(value || '').trim();
    case 'ipProxyServiceProfiles':
      return normalizeIpProxyServiceProfiles(value || {}, PERSISTED_SETTING_DEFAULTS);
    case 'ipProxyAccountList':
      return normalizeIpProxyAccountList(value || '');
    case 'ipProxyAccountSessionPrefix':
      return normalizeIpProxyAccountSessionPrefix(value || '');
    case 'ipProxyAccountLifeMinutes':
      return normalizeIpProxyAccountLifeMinutes(value || '');
    case 'ipProxyPoolTargetCount':
      return normalizeIpProxyPoolTargetCount(value || '', 20);
    case 'ipProxyAutoSyncEnabled':
      return Boolean(value);
    case 'ipProxyAutoSyncIntervalMinutes':
      return normalizeIpProxyAutoSyncIntervalMinutes(
        value,
        PERSISTED_SETTING_DEFAULTS.ipProxyAutoSyncIntervalMinutes
      );
    case 'ipProxyHost':
      return String(value || '').trim();
    case 'ipProxyPort':
      return String(normalizeIpProxyPort(value || '') || '');
    case 'ipProxyProtocol':
      return normalizeIpProxyProtocol(value);
    case 'ipProxyUsername':
      return String(value || '').trim();
    case 'ipProxyPassword':
      return String(value || '');
    case 'ipProxyRegion':
      return String(value || '').trim();
    case 'ipProxyApiPool':
      return normalizeProxyPoolEntries(
        value,
        normalizeIpProxyProviderValue(value?.provider || DEFAULT_IP_PROXY_SERVICE)
      );
    case 'ipProxyApiCurrentIndex':
      return normalizeIpProxyCurrentIndex(value, 0);
    case 'ipProxyApiCurrent':
      return normalizeProxyPoolEntries(value ? [value] : [], DEFAULT_IP_PROXY_SERVICE)[0] || null;
    case 'ipProxyAccountPool':
      return normalizeProxyPoolEntries(
        value,
        normalizeIpProxyProviderValue(value?.provider || DEFAULT_IP_PROXY_SERVICE)
      );
    case 'ipProxyAccountCurrentIndex':
      return normalizeIpProxyCurrentIndex(value, 0);
    case 'ipProxyAccountCurrent':
      return normalizeProxyPoolEntries(value ? [value] : [], DEFAULT_IP_PROXY_SERVICE)[0] || null;
    case 'ipProxyPool':
      return normalizeProxyPoolEntries(
        value,
        normalizeIpProxyProviderValue(value?.provider || DEFAULT_IP_PROXY_SERVICE)
      );
    case 'ipProxyCurrentIndex':
      return normalizeIpProxyCurrentIndex(value, 0);
    case 'ipProxyCurrent':
      return normalizeProxyPoolEntries(value ? [value] : [], DEFAULT_IP_PROXY_SERVICE)[0] || null;
    case 'codex2apiUrl':
      return normalizeCodex2ApiUrl(value);
    case 'codex2apiAdminKey':
      return String(value || '').trim();
    case 'customPassword':
      return String(value || '');
    case 'signupMethod':
      return normalizeSignupMethod(value);
    case 'plusPaymentMethod':
      return normalizePlusPaymentMethod(value);
    case 'paypalEmail':
      return String(value || '').trim();
    case 'paypalPassword':
      return String(value || '');
    case 'currentPayPalAccountId':
      return String(value || '').trim();
    case 'gopayCountryCode':
      return self.GoPayUtils?.normalizeGoPayCountryCode
        ? self.GoPayUtils.normalizeGoPayCountryCode(value)
        : String(value || '+86').trim();
    case 'gopayPhone':
      return self.GoPayUtils?.normalizeGoPayPhone
        ? self.GoPayUtils.normalizeGoPayPhone(value)
        : String(value || '').trim();
    case 'gopayOtp':
      return self.GoPayUtils?.normalizeGoPayOtp
        ? self.GoPayUtils.normalizeGoPayOtp(value)
        : String(value || '').trim().replace(/[^\d]/g, '');
    case 'gopayPin':
      return self.GoPayUtils?.normalizeGoPayPin
        ? self.GoPayUtils.normalizeGoPayPin(value)
        : String(value || '');
    case 'gopayHelperPhoneMode':
      return self.GoPayUtils?.normalizeGpcHelperPhoneMode
        ? self.GoPayUtils.normalizeGpcHelperPhoneMode(value)
        : (String(value || '').trim().toLowerCase() === 'auto' || String(value || '').trim().toLowerCase() === 'builtin' ? 'auto' : 'manual');
    case 'gopayHelperPhoneNumber':
      return self.GoPayUtils?.normalizeGoPayPhone
        ? self.GoPayUtils.normalizeGoPayPhone(value)
        : String(value || '').trim();
    case 'gopayHelperPin':
      return self.GoPayUtils?.normalizeGoPayPin
        ? self.GoPayUtils.normalizeGoPayPin(value)
        : String(value || '');
    case 'gopayHelperCountryCode':
      return self.GoPayUtils?.normalizeGoPayCountryCode
        ? self.GoPayUtils.normalizeGoPayCountryCode(value)
        : String(value || '+86').trim();
    case 'gopayHelperOtpChannel':
      return self.GoPayUtils?.normalizeGpcOtpChannel
        ? self.GoPayUtils.normalizeGpcOtpChannel(value)
        : (String(value || '').trim().toLowerCase() === 'sms' ? 'sms' : 'whatsapp');
    case 'gopayHelperLocalSmsHelperUrl':
      return normalizeLocalHttpBaseUrl(
        value,
        PERSISTED_SETTING_DEFAULTS.gopayHelperLocalSmsHelperUrl || 'http://127.0.0.1:18767'
      );
    case 'gopayHelperLocalSmsTimeoutSeconds':
      return normalizeBoundedIntegerSetting(
        value,
        PERSISTED_SETTING_DEFAULTS.gopayHelperLocalSmsTimeoutSeconds,
        10,
        300
      );
    case 'gopayHelperLocalSmsPollIntervalSeconds':
      return normalizeBoundedIntegerSetting(
        value,
        PERSISTED_SETTING_DEFAULTS.gopayHelperLocalSmsPollIntervalSeconds,
        1,
        30
      );
    case 'gopayHelperApiUrl':
      {
        const defaultGpcHelperApiUrl = PERSISTED_SETTING_DEFAULTS.gopayHelperApiUrl
          || (typeof DEFAULT_GPC_HELPER_API_URL !== 'undefined' ? DEFAULT_GPC_HELPER_API_URL : 'https://gpc.qlhazycoder.top');
        const normalizedGpcHelperApiUrl = self.GoPayUtils?.normalizeGpcHelperBaseUrl
          ? self.GoPayUtils.normalizeGpcHelperBaseUrl(value || defaultGpcHelperApiUrl)
          : String(value || defaultGpcHelperApiUrl).trim().replace(/\/+$/g, '');
        if (!self.GoPayUtils?.normalizeGpcHelperBaseUrl) {
          try {
            const parsed = new URL(normalizedGpcHelperApiUrl);
            const hostname = parsed.hostname.toLowerCase();
            if (hostname !== 'gpc.qlhazycoder.top' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
              return defaultGpcHelperApiUrl;
            }
          } catch {
            return defaultGpcHelperApiUrl;
          }
        }
        return normalizedGpcHelperApiUrl;
      }
    case 'gopayHelperApiKey':
    case 'gopayHelperCardKey':
    case 'gopayHelperReferenceId':
    case 'gopayHelperGoPayGuid':
    case 'gopayHelperRedirectUrl':
    case 'gopayHelperNextAction':
    case 'gopayHelperFlowId':
    case 'gopayHelperChallengeId':
    case 'gopayHelperTaskId':
    case 'gopayHelperTaskStatus':
    case 'gopayHelperStatusText':
    case 'gopayHelperRemoteStage':
    case 'gopayHelperApiWaitingFor':
    case 'gopayHelperApiInputDeadlineAt':
    case 'gopayHelperLastInputError':
    case 'gopayHelperFailureStage':
    case 'gopayHelperFailureDetail':
    case 'gopayHelperBalance':
    case 'gopayHelperBalanceError':
    case 'gopayHelperApiKeyStatus':
      return String(value || '').trim();
    case 'gopayHelperBalancePayload':
    case 'gopayHelperStartPayload':
    case 'gopayHelperTaskPayload':
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    case 'gopayHelperBalanceUpdatedAt':
    case 'gopayHelperApiInputWaitSeconds':
    case 'gopayHelperOtpInvalidCount':
    case 'gopayHelperRemainingUses':
      return Math.max(0, Number(value) || 0);
    case 'autoRunSkipFailures':
    case 'oauthFlowTimeoutEnabled':
    case 'gopayHelperLocalSmsHelperEnabled':
    case 'gopayHelperAutoModeEnabled':
    case 'autoRunDelayEnabled':
      return Boolean(value);
    case 'operationDelayEnabled':
      return typeof value === 'boolean' ? value : true;
    case 'step6CookieCleanupEnabled':
    case 'phoneVerificationEnabled':
    case 'freePhoneReuseEnabled':
    case 'freePhoneReuseAutoEnabled':
    case 'plusModeEnabled':
      return Boolean(value);
    case 'phoneSmsProvider':
      return normalizePhoneSmsProvider(value);
    case 'phoneSmsProviderOrder':
      return normalizePhoneSmsProviderOrder(value);
    case 'autoRunFallbackThreadIntervalMinutes':
      return normalizeAutoRunFallbackThreadIntervalMinutes(value);
    case 'autoRunDelayMinutes':
      return normalizeAutoRunDelayMinutes(value);
    case 'autoStepDelaySeconds':
      return normalizeAutoStepDelaySeconds(value, PERSISTED_SETTING_DEFAULTS.autoStepDelaySeconds);
    case 'verificationResendCount':
      return normalizeVerificationResendCount(value, DEFAULT_VERIFICATION_RESEND_COUNT);
    case 'phoneVerificationReplacementLimit':
      return normalizePhoneVerificationReplacementLimit(value, DEFAULT_PHONE_VERIFICATION_REPLACEMENT_LIMIT);
    case 'phoneCodeWaitSeconds':
      return normalizePhoneCodeWaitSeconds(value, DEFAULT_PHONE_CODE_WAIT_SECONDS);
    case 'phoneCodeTimeoutWindows':
      return normalizePhoneCodeTimeoutWindows(value, DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS);
    case 'phoneCodePollIntervalSeconds':
      return normalizePhoneCodePollIntervalSeconds(value, DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS);
    case 'phoneCodePollMaxRounds':
      return normalizePhoneCodePollMaxRounds(value, DEFAULT_PHONE_CODE_POLL_ROUNDS);
    case 'mailProvider':
      return normalizeMailProvider(value);
    case 'mail2925Mode':
      return normalizeMail2925Mode(value);
    case 'mail2925UseAccountPool':
      return Boolean(value);
    case 'emailGenerator':
      return normalizeEmailGenerator(value);
    case 'customMailProviderPool':
    case 'customEmailPool':
      return normalizeCustomEmailPool(value);
    case 'customEmailPoolEntries':
      return normalizeCustomEmailPoolEntryObjects(value);
    case 'autoDeleteUsedIcloudAlias':
    case 'accountRunHistoryTextEnabled':
    case 'cloudflareTempEmailUseRandomSubdomain':
      return Boolean(value);
    case 'icloudHostPreference':
      return normalizeIcloudHost(value) || 'auto';
    case 'icloudTargetMailboxType':
      return normalizeIcloudTargetMailboxType(value);
    case 'icloudForwardMailProvider':
      return normalizeIcloudForwardMailProvider(value);
    case 'icloudFetchMode':
      return normalizeIcloudFetchMode(value);
    case 'accountRunHistoryHelperBaseUrl':
      return normalizeAccountRunHistoryHelperBaseUrl(value);
    case 'gmailBaseEmail':
    case 'mail2925BaseEmail':
    case 'currentMail2925AccountId':
    case 'emailPrefix':
      return String(value || '').trim();
    case 'inbucketHost':
      return String(value || '').trim();
    case 'inbucketMailbox':
      return String(value || '').trim();
    case 'hotmailServiceMode':
      return normalizeHotmailServiceMode(value);
    case 'hotmailRemoteBaseUrl':
      return normalizeHotmailRemoteBaseUrl(value);
    case 'hotmailLocalBaseUrl':
      return normalizeHotmailLocalBaseUrl(value);
    case 'luckmailApiKey':
      return String(value || '');
    case 'luckmailBaseUrl':
      return normalizeLuckmailBaseUrl(value);
    case 'luckmailEmailType':
      return normalizeLuckmailEmailType(value);
    case 'luckmailDomain':
      return String(value || '').trim();
    case 'luckmailUsedPurchases':
      return normalizeLuckmailUsedPurchases(value);
    case 'luckmailPreserveTagId':
      return Number(value) || 0;
    case 'luckmailPreserveTagName':
      return String(value || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME;
    case 'cloudflareDomain':
      return normalizeCloudflareDomain(value);
    case 'cloudflareDomains':
      return normalizeCloudflareDomains(value);
    case 'cloudflareTempEmailBaseUrl':
      return normalizeCloudflareTempEmailBaseUrl(value);
    case 'cloudflareTempEmailAdminAuth':
    case 'cloudflareTempEmailCustomAuth':
      return String(value || '');
    case 'cloudflareTempEmailReceiveMailbox':
      return normalizeCloudflareTempEmailReceiveMailbox(value);
    case 'cloudflareTempEmailDomain':
      return normalizeCloudflareTempEmailDomain(value);
    case 'cloudflareTempEmailDomains':
      return normalizeCloudflareTempEmailDomains(value);
    case 'cloudMailBaseUrl':
      return normalizeCloudMailBaseUrl(value);
    case 'cloudMailAdminEmail':
      return String(value || '').trim();
    case 'cloudMailAdminPassword':
    case 'cloudMailToken':
      return String(value || '');
    case 'cloudMailReceiveMailbox':
      return normalizeCloudMailReceiveMailbox(value);
    case 'cloudMailDomain':
      return normalizeCloudMailDomain(value);
    case 'cloudMailDomains':
      return normalizeCloudMailDomains(value);
    case 'hotmailAccounts':
      return normalizeHotmailAccounts(value);
    case 'mail2925Accounts':
      return normalizeMail2925Accounts(value);
    case 'paypalAccounts':
      return normalizePayPalAccounts(value);
    case 'phoneSmsProvider':
      return normalizePhoneSmsProvider(value);
    case 'heroSmsApiKey':
      return String(value || '');
    case 'heroSmsReuseEnabled':
      return Boolean(value);
    case 'heroSmsAcquirePriority':
      return normalizeHeroSmsAcquirePriority(value);
    case 'heroSmsMaxPrice':
      return normalizeHeroSmsMaxPrice(value);
    case 'heroSmsPreferredPrice':
      return normalizeHeroSmsMaxPrice(value);
    case 'heroSmsCountryId': {
      const parsed = Math.floor(Number(value));
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
      return HERO_SMS_COUNTRY_ID;
    }
    case 'heroSmsCountryLabel':
      return String(value || HERO_SMS_COUNTRY_LABEL).trim() || HERO_SMS_COUNTRY_LABEL;
    case 'heroSmsCountryFallback':
      return normalizeHeroSmsCountryFallback(value);
    case 'fiveSimApiKey':
      return String(value || '');
    case 'fiveSimProduct':
      return normalizeFiveSimCountryCode(value, DEFAULT_FIVE_SIM_PRODUCT);
    case 'fiveSimCountryId':
      return normalizeFiveSimCountryId(value);
    case 'fiveSimCountryLabel':
      return normalizeFiveSimCountryLabel(value);
    case 'fiveSimCountryFallback':
      return normalizeFiveSimCountryFallback(value);
    case 'fiveSimCountryOrder':
      return normalizeFiveSimCountryOrder(value);
    case 'fiveSimMaxPrice':
      return normalizeFiveSimMaxPrice(value);
    case 'fiveSimOperator':
      return normalizeFiveSimOperator(value);
    case 'nexSmsApiKey':
      return String(value || '');
    case 'nexSmsCountryOrder':
      return normalizeNexSmsCountryOrder(value);
    case 'nexSmsServiceCode':
      return normalizeNexSmsServiceCode(value);
    case 'phonePreferredActivation':
      return normalizePhonePreferredActivation(value);
    default:
      return value;
  }
}

function buildPersistentSettingsPayload(input = {}, options = {}) {
  const { fillDefaults = false, requireKnownKeys = false } = options;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('\u914d\u7f6e\u5185\u5bb9\u683c\u5f0f\u65e0\u6548\u3002');
  }

  const normalizedInput = { ...input };
  if (normalizedInput.autoStepDelaySeconds === undefined) {
    const legacyAutoStepDelaySeconds = resolveLegacyAutoStepDelaySeconds(normalizedInput);
    if (legacyAutoStepDelaySeconds !== undefined) {
      normalizedInput.autoStepDelaySeconds = legacyAutoStepDelaySeconds;
    }
  }
  if (normalizedInput.verificationResendCount === undefined) {
    const legacyVerificationResendCount = normalizedInput.signupVerificationResendCount !== undefined
      ? normalizedInput.signupVerificationResendCount
      : normalizedInput.loginVerificationResendCount;
    if (legacyVerificationResendCount !== undefined) {
      normalizedInput.verificationResendCount = legacyVerificationResendCount;
    }
  }

  const payload = {};
  let matchedKeyCount = 0;
  for (const key of PERSISTED_SETTING_KEYS) {
    if (normalizedInput[key] !== undefined) {
      payload[key] = normalizePersistentSettingValue(key, normalizedInput[key]);
      matchedKeyCount += 1;
    } else if (fillDefaults) {
      payload[key] = normalizePersistentSettingValue(key, PERSISTED_SETTING_DEFAULTS[key]);
    }
  }

  if (requireKnownKeys && matchedKeyCount === 0) {
    throw new Error('\u914d\u7f6e\u6587\u4ef6\u4e2d\u6ca1\u6709\u53ef\u8bc6\u522b\u7684\u914d\u7f6e\u5185\u5bb9\u3002');
  }

  if (payload.cloudflareDomains) {
    const domains = normalizeCloudflareDomains(payload.cloudflareDomains);
    if (payload.cloudflareDomain && !domains.includes(payload.cloudflareDomain)) {
      domains.unshift(payload.cloudflareDomain);
    }
    payload.cloudflareDomains = domains;
  }
  if (payload.cloudflareTempEmailDomains) {
    const domains = normalizeCloudflareTempEmailDomains(payload.cloudflareTempEmailDomains);
    if (payload.cloudflareTempEmailDomain && !domains.includes(payload.cloudflareTempEmailDomain)) {
      domains.unshift(payload.cloudflareTempEmailDomain);
    }
    payload.cloudflareTempEmailDomains = domains;
  }
  if (payload.cloudMailDomains) {
    const domains = normalizeCloudMailDomains(payload.cloudMailDomains);
    if (payload.cloudMailDomain && !domains.includes(payload.cloudMailDomain)) {
      domains.unshift(payload.cloudMailDomain);
    }
    payload.cloudMailDomains = domains;
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'sub2apiGroupName')
    || Object.prototype.hasOwnProperty.call(payload, 'sub2apiGroupNames')
  ) {
    const groupNames = normalizeSub2ApiGroupNames([
      ...(Array.isArray(payload.sub2apiGroupNames) ? payload.sub2apiGroupNames : []),
      payload.sub2apiGroupName,
    ]);
    payload.sub2apiGroupNames = groupNames.length
      ? groupNames
      : [...DEFAULT_SUB2API_GROUP_NAMES];
  }
  const nextSignupConstraintState = {
    ...PERSISTED_SETTING_DEFAULTS,
    ...payload,
    resolvedSignupMethod: null,
  };
  if (Object.prototype.hasOwnProperty.call(payload, 'phoneVerificationEnabled')
    || Object.prototype.hasOwnProperty.call(payload, 'plusModeEnabled')
    || Object.prototype.hasOwnProperty.call(payload, 'signupMethod')) {
    payload.signupMethod = resolveSignupMethod(nextSignupConstraintState);
  }
  if (payload.ipProxyServiceProfiles) {
    const selectedService = normalizeIpProxyProviderValue(
      payload.ipProxyService || PERSISTED_SETTING_DEFAULTS.ipProxyService
    );
    const normalizedProfiles = normalizeIpProxyServiceProfiles(payload.ipProxyServiceProfiles, {
      ...PERSISTED_SETTING_DEFAULTS,
      ...payload,
    });
    payload.ipProxyServiceProfiles = normalizedProfiles;
    const activeProfile = normalizedProfiles[selectedService]
      || buildIpProxyServiceProfileFromState({
        ...PERSISTED_SETTING_DEFAULTS,
        ...payload,
      });
    payload.ipProxyService = selectedService;
    payload.ipProxyMode = normalizeIpProxyMode(activeProfile?.mode || payload.ipProxyMode);
    payload.ipProxyApiUrl = String(activeProfile?.apiUrl || payload.ipProxyApiUrl || '').trim();
    payload.ipProxyAccountList = normalizeIpProxyAccountList(activeProfile?.accountList || payload.ipProxyAccountList || '');
    payload.ipProxyAccountSessionPrefix = normalizeIpProxyAccountSessionPrefix(activeProfile?.accountSessionPrefix || payload.ipProxyAccountSessionPrefix || '');
    payload.ipProxyAccountLifeMinutes = normalizeIpProxyAccountLifeMinutes(activeProfile?.accountLifeMinutes || payload.ipProxyAccountLifeMinutes || '');
    payload.ipProxyPoolTargetCount = normalizeIpProxyPoolTargetCount(activeProfile?.poolTargetCount || payload.ipProxyPoolTargetCount || '', 20);
    payload.ipProxyHost = String(activeProfile?.host || payload.ipProxyHost || '').trim();
    payload.ipProxyPort = String(normalizeIpProxyPort(activeProfile?.port || payload.ipProxyPort || '') || '');
    payload.ipProxyProtocol = normalizeIpProxyProtocol(activeProfile?.protocol || payload.ipProxyProtocol);
    payload.ipProxyUsername = String(activeProfile?.username || payload.ipProxyUsername || '').trim();
    payload.ipProxyPassword = String(activeProfile?.password || payload.ipProxyPassword || '');
    payload.ipProxyRegion = String(activeProfile?.region || payload.ipProxyRegion || '').trim();
  }

  return payload;
}

async function getPersistedSettings() {
  const stored = await chrome.storage.local.get([
    ...PERSISTED_SETTING_KEYS,
    ...LEGACY_AUTO_STEP_DELAY_KEYS,
    ...LEGACY_VERIFICATION_RESEND_COUNT_KEYS,
  ]);
  return buildPersistentSettingsPayload(stored, { fillDefaults: true });
}

async function getPersistedAliasState() {
  try {
    const stored = await chrome.storage.local.get(PERSISTENT_ALIAS_STATE_KEYS);
    const manualAliasUsage = normalizeBooleanMap(stored.manualAliasUsage);
    const preservedAliases = normalizeBooleanMap(stored.preservedAliases);
    return {
      manualAliasUsage,
    preservedAliases,
    icloudAliasCache: normalizeIcloudAliasCacheList(stored.icloudAliasCache, {
      usedEmails: toNormalizedEmailSet(manualAliasUsage),
      preservedEmails: toNormalizedEmailSet(preservedAliases),
    }),
      icloudAliasCacheAt: Math.max(0, Number(stored.icloudAliasCacheAt) || 0),
    };
  } catch (err) {
    console.warn(LOG_PREFIX, 'Failed to read persisted iCloud alias state:', err?.message || err);
    return {
      manualAliasUsage: {},
      preservedAliases: {},
      icloudAliasCache: [],
      icloudAliasCacheAt: 0,
    };
  }
}

async function getState() {
  const [state, persistedSettings, persistedAliasState, accountRunHistory] = await Promise.all([
    chrome.storage.session.get(null),
    getPersistedSettings(),
    getPersistedAliasState(),
    accountRunHistoryHelpers?.getPersistedAccountRunHistory?.() || [],
  ]);
  return { ...DEFAULT_STATE, ...persistedSettings, ...persistedAliasState, ...state, accountRunHistory };
}

async function initializeSessionStorageAccess() {
  try {
    if (chrome.storage?.session?.setAccessLevel) {
      await chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      });
      console.log(LOG_PREFIX, 'Enabled storage.session for content scripts');
    }
  } catch (err) {
    console.warn(LOG_PREFIX, 'Failed to enable storage.session for content scripts:', err?.message || err);
  }
}

async function setState(updates) {
  console.log(LOG_PREFIX, 'storage.set:', JSON.stringify(updates).slice(0, 200));
  if (Object.keys(updates || {}).length > 0) {
    await chrome.storage.session.set(updates);
    const persistentAliasUpdates = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'manualAliasUsage')) {
      persistentAliasUpdates.manualAliasUsage = normalizeBooleanMap(updates.manualAliasUsage);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'preservedAliases')) {
      persistentAliasUpdates.preservedAliases = normalizeBooleanMap(updates.preservedAliases);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'icloudAliasCache')) {
      persistentAliasUpdates.icloudAliasCache = normalizeIcloudAliasCacheList(updates.icloudAliasCache);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'icloudAliasCacheAt')) {
      persistentAliasUpdates.icloudAliasCacheAt = Math.max(0, Number(updates.icloudAliasCacheAt) || 0);
    }
    if (Object.keys(persistentAliasUpdates).length > 0) {
      await chrome.storage.local.set(persistentAliasUpdates);
    }
  }
}

async function setPersistentSettings(updates) {
  const persistedUpdates = buildPersistentSettingsPayload(updates);

  if (Object.keys(persistedUpdates).length > 0) {
    await chrome.storage.local.set(persistedUpdates);
  }
}

function buildSettingsExportFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${SETTINGS_EXPORT_FILENAME_PREFIX}-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.json`;
}

async function exportSettingsBundle() {
  const settings = await getPersistedSettings();
  const bundle = {
    schemaVersion: SETTINGS_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    settings,
  };

  return {
    fileName: buildSettingsExportFilename(),
    fileContent: JSON.stringify(bundle, null, 2),
  };
}

async function importSettingsBundle(configBundle) {
  const state = await ensureManualInteractionAllowed('\u5bfc\u5165\u914d\u7f6e');
  if (Object.values(state.stepStatuses || {}).some((status) => status === 'running')) {
    throw new Error('\u5f53\u524d\u6709\u6b65\u9aa4\u6b63\u5728\u6267\u884c\uff0c\u65e0\u6cd5\u5bfc\u5165\u914d\u7f6e\u3002');
  }
  if (!configBundle || typeof configBundle !== 'object' || Array.isArray(configBundle)) {
    throw new Error('\u914d\u7f6e\u6587\u4ef6\u5185\u5bb9\u65e0\u6548\u3002');
  }

  const schemaVersion = Number(configBundle.schemaVersion);
  if (schemaVersion !== SETTINGS_EXPORT_SCHEMA_VERSION) {
    throw new Error(`\u4ec5\u652f\u6301\u5bfc\u5165 schemaVersion=${SETTINGS_EXPORT_SCHEMA_VERSION} \u7684\u914d\u7f6e\u6587\u4ef6\u3002`);
  }
  if (!configBundle.settings || typeof configBundle.settings !== 'object' || Array.isArray(configBundle.settings)) {
    throw new Error('\u914d\u7f6e\u6587\u4ef6\u7f3a\u5c11 settings \u914d\u7f6e\u6bb5\u3002');
  }

  const importedSettings = buildPersistentSettingsPayload(configBundle.settings, {
    fillDefaults: true,
    requireKnownKeys: true,
  });

  await setPersistentSettings(importedSettings);

  const sessionUpdates = {
    ...importedSettings,
    currentHotmailAccountId: null,
    email: null,
  };

  await setState(sessionUpdates);
  broadcastDataUpdate({
    ...importedSettings,
    currentHotmailAccountId: null,
    ...(sessionUpdates.email !== undefined ? { email: sessionUpdates.email } : {}),
  });

  return getState();
}

function broadcastDataUpdate(payload) {
  chrome.runtime.sendMessage({
    type: 'DATA_UPDATED',
    payload,
  }).catch(() => { });
}

function broadcastIcloudAliasesChanged(payload = {}) {
  chrome.runtime.sendMessage({
    type: 'ICLOUD_ALIASES_CHANGED',
    payload,
  }).catch(() => { });
}

function normalizePhoneIdentityDigits(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

function getPhoneActivationPhoneNumber(activation = null) {
  if (!activation || typeof activation !== 'object' || Array.isArray(activation)) {
    return '';
  }
  return String(
    activation.phoneNumber
    ?? activation.number
    ?? activation.phone
    ?? ''
  ).trim();
}

function isPhoneActivationForNumber(activation, phoneNumber) {
  const activationPhone = getPhoneActivationPhoneNumber(activation);
  const targetPhone = String(phoneNumber || '').trim();
  if (!activationPhone || !targetPhone) {
    return false;
  }
  if (activationPhone === targetPhone) {
    return true;
  }
  const activationDigits = normalizePhoneIdentityDigits(activationPhone);
  const targetDigits = normalizePhoneIdentityDigits(targetPhone);
  return Boolean(activationDigits && targetDigits && activationDigits === targetDigits);
}

async function setEmailStateSilently(email) {
  const normalizedEmail = String(email || '').trim() || null;
  const currentState = await getState();
  const updates = {
    email: normalizedEmail,
  };

  if (normalizedEmail) {
    updates.accountIdentifierType = 'email';
    updates.accountIdentifier = normalizedEmail;
    updates.phoneNumber = '';
    updates.signupPhoneNumber = '';
    updates.signupPhoneActivation = null;
    updates.signupPhoneCompletedActivation = null;
    updates.signupPhoneVerificationRequestedAt = null;
    updates.signupPhoneVerificationPurpose = '';
  } else if (String(currentState?.accountIdentifierType || '').trim().toLowerCase() === 'email') {
    updates.accountIdentifierType = null;
    updates.accountIdentifier = '';
  }

  await setState(updates);
  broadcastDataUpdate(updates);
}

async function setEmailState(email) {
  await setEmailStateSilently(email);
  if (email) {
    await appendManualAccountRunRecordIfNeeded('step2_stopped', null, '步骤 2 已使用邮箱，流程尚未完成。');
    await resumeAutoRunIfWaitingForEmail();
  }
}

async function setSignupPhoneStateSilently(phoneNumber) {
  const normalizedPhoneNumber = String(phoneNumber || '').trim();
  const currentState = await getState();
  const updates = {
    signupPhoneNumber: normalizedPhoneNumber,
  };

  if (normalizedPhoneNumber) {
    updates.accountIdentifierType = 'phone';
    updates.accountIdentifier = normalizedPhoneNumber;
    updates.phoneNumber = '';
    if (!isPhoneActivationForNumber(currentState?.signupPhoneActivation, normalizedPhoneNumber)) {
      updates.signupPhoneActivation = null;
      updates.signupPhoneVerificationRequestedAt = null;
      updates.signupPhoneVerificationPurpose = '';
    }
    if (!isPhoneActivationForNumber(currentState?.signupPhoneCompletedActivation, normalizedPhoneNumber)) {
      updates.signupPhoneCompletedActivation = null;
    }
  } else if (String(currentState?.accountIdentifierType || '').trim().toLowerCase() === 'phone') {
    updates.accountIdentifierType = null;
    updates.accountIdentifier = '';
    updates.signupPhoneActivation = null;
    updates.signupPhoneCompletedActivation = null;
    updates.signupPhoneVerificationRequestedAt = null;
    updates.signupPhoneVerificationPurpose = '';
  }

  await setState(updates);
  broadcastDataUpdate(updates);
}

async function setSignupPhoneState(phoneNumber) {
  await setSignupPhoneStateSilently(phoneNumber);
  if (String(phoneNumber || '').trim()) {
    await appendManualAccountRunRecordIfNeeded('step2_stopped', null, '步骤 2 已使用手机号，流程尚未完成。');
  }
}

async function setPasswordState(password) {
  await setState({ password });
  broadcastDataUpdate({ password });
}

function buildContributionModeState(enabled, persistedSettings = {}, currentState = {}) {
  const currentContributionState = {};
  for (const key of CONTRIBUTION_RUNTIME_KEYS) {
    currentContributionState[key] = currentState[key] !== undefined
      ? currentState[key]
      : CONTRIBUTION_RUNTIME_DEFAULTS[key];
  }

  if (enabled) {
    const routing = resolveContributionModeRoutingState({
      ...persistedSettings,
      ...currentState,
      ...currentContributionState,
    });
    return {
      ...currentContributionState,
      contributionMode: true,
      contributionModeExpected: true,
      contributionSource: routing.source,
      contributionTargetGroupName: routing.targetGroupName,
      panelMode: routing.source,
      customPassword: '',
      accountRunHistoryTextEnabled: false,
    };
  }

  return {
    ...CONTRIBUTION_RUNTIME_DEFAULTS,
    contributionMode: false,
    contributionModeExpected: false,
    panelMode: persistedSettings.panelMode || DEFAULT_STATE.panelMode,
    customPassword: persistedSettings.customPassword || '',
    accountRunHistoryTextEnabled: Boolean(persistedSettings.accountRunHistoryTextEnabled),
  };
}

async function setContributionMode(enabled) {
  const normalizedEnabled = Boolean(enabled);
  const [persistedSettings, currentState] = await Promise.all([
    getPersistedSettings(),
    getState(),
  ]);

  const updates = buildContributionModeState(normalizedEnabled, persistedSettings, currentState);

  await setState(updates);
  const nextState = await getState();
  const contributionBroadcast = {};
  for (const key of CONTRIBUTION_RUNTIME_KEYS) {
    contributionBroadcast[key] = nextState[key];
  }
  broadcastDataUpdate({
    ...contributionBroadcast,
    panelMode: nextState.panelMode,
    customPassword: nextState.customPassword,
    accountRunHistoryTextEnabled: nextState.accountRunHistoryTextEnabled,
    accountRunHistoryHelperBaseUrl: nextState.accountRunHistoryHelperBaseUrl,
  });
  return nextState;
}

function getLuckmailUsedPurchases(state = {}) {
  return normalizeLuckmailUsedPurchases(state?.luckmailUsedPurchases);
}

function getLuckmailPreserveTagInfo(state = {}) {
  return {
    id: Number(state?.luckmailPreserveTagId) || 0,
    name: String(state?.luckmailPreserveTagName || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  };
}

async function setLuckmailUsedPurchasesState(usedPurchases) {
  const normalizedUsedPurchases = normalizeLuckmailUsedPurchases(usedPurchases);
  await setPersistentSettings({ luckmailUsedPurchases: normalizedUsedPurchases });
  await setState({ luckmailUsedPurchases: normalizedUsedPurchases });
  broadcastDataUpdate({ luckmailUsedPurchases: normalizedUsedPurchases });
  return normalizedUsedPurchases;
}

async function setLuckmailPurchaseUsedState(purchaseId, used) {
  const normalizedPurchaseId = normalizeLuckmailPurchaseId(purchaseId);
  if (!normalizedPurchaseId) {
    throw new Error('LuckMail 邮箱 ID 无效。');
  }

  const state = await getState();
  const usedPurchases = getLuckmailUsedPurchases(state);
  if (used) {
    usedPurchases[normalizedPurchaseId] = true;
  } else {
    delete usedPurchases[normalizedPurchaseId];
  }

  await setLuckmailUsedPurchasesState(usedPurchases);
  return {
    purchaseId: Number(normalizedPurchaseId),
    used: Boolean(used),
  };
}

async function setLuckmailPreserveTagInfo(tag) {
  const normalizedTags = normalizeLuckmailTags([tag]);
  const normalizedTag = normalizedTags[0] || {
    id: 0,
    name: DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  };
  const updates = {
    luckmailPreserveTagId: Number(normalizedTag.id) || 0,
    luckmailPreserveTagName: String(normalizedTag.name || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  };
  await setPersistentSettings(updates);
  await setState(updates);
  broadcastDataUpdate(updates);
  return updates;
}

async function setLuckmailPurchaseState(purchase) {
  const normalizedPurchase = purchase ? normalizeLuckmailPurchase(purchase) : null;
  await setState({ currentLuckmailPurchase: normalizedPurchase });
  broadcastDataUpdate({ currentLuckmailPurchase: normalizedPurchase });
  return normalizedPurchase;
}

async function setLuckmailMailCursorState(cursor) {
  const normalizedCursor = cursor ? normalizeLuckmailMailCursor(cursor) : null;
  await setState({ currentLuckmailMailCursor: normalizedCursor });
  return normalizedCursor;
}

async function clearLuckmailRuntimeState(options = {}) {
  const { clearEmail = false } = options;
  const updates = {
    currentLuckmailPurchase: null,
    currentLuckmailMailCursor: null,
  };
  if (clearEmail) {
    updates.email = null;
  }
  await setState(updates);
  broadcastDataUpdate(updates);
}

function getManualAliasUsageMap(state) {
  return normalizeBooleanMap(state?.manualAliasUsage);
}

function getPreservedAliasMap(state) {
  return normalizeBooleanMap(state?.preservedAliases);
}

function isAliasPreserved(state, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return Boolean(getPreservedAliasMap(state)[normalizedEmail]);
}

function getEffectiveUsedEmails(state) {
  return toNormalizedEmailSet(getManualAliasUsageMap(state));
}

function normalizeIcloudAliasCacheList(value = [], options = {}) {
  const aliases = Array.isArray(value) ? value : [];
  const usedEmails = toNormalizedEmailSet(options.usedEmails);
  const preservedEmails = toNormalizedEmailSet(options.preservedEmails);
  return aliases
    .map((alias) => normalizeIcloudAliasRecord(alias, { usedEmails, preservedEmails }))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      if (left.used !== right.used) return left.used ? 1 : -1;
      return String(left.email).localeCompare(String(right.email));
    });
}

function getIcloudAliasCacheFromState(state, options = {}) {
  const maxAgeMs = Math.max(0, Number(options.maxAgeMs) || ICLOUD_ALIAS_CACHE_MAX_AGE_MS);
  const cachedAt = Number(state?.icloudAliasCacheAt || 0);
  if (!Array.isArray(state?.icloudAliasCache) || state.icloudAliasCache.length <= 0) {
    return [];
  }
  if (maxAgeMs > 0 && cachedAt > 0 && Date.now() - cachedAt > maxAgeMs) {
    return [];
  }
  return normalizeIcloudAliasCacheList(state.icloudAliasCache, {
    usedEmails: getEffectiveUsedEmails(state),
    preservedEmails: getPreservedAliasMap(state),
  });
}

function isLikelyIcloudAliasEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return false;
  }
  return /@(icloud\.com|me\.com|mac\.com|privaterelay\.appleid\.com)$/.test(email);
}

function buildIcloudAliasFallbackFromLocalState(state = {}) {
  const manualAliasUsage = getManualAliasUsageMap(state);
  const preservedAliases = getPreservedAliasMap(state);
  const candidates = new Set();

  for (const email of Object.keys(manualAliasUsage)) {
    if (isLikelyIcloudAliasEmail(email)) {
      candidates.add(String(email).trim().toLowerCase());
    }
  }
  for (const email of Object.keys(preservedAliases)) {
    if (isLikelyIcloudAliasEmail(email)) {
      candidates.add(String(email).trim().toLowerCase());
    }
  }

  const currentEmail = String(state?.email || '').trim().toLowerCase();
  if (isLikelyIcloudAliasEmail(currentEmail)) {
    candidates.add(currentEmail);
  }

  if (!candidates.size) {
    return [];
  }

  const aliases = Array.from(candidates, (email) => ({
    hme: email,
    email,
    state: 'active',
    active: true,
  }));
  return normalizeIcloudAliasCacheList(aliases, {
    usedEmails: getEffectiveUsedEmails(state),
    preservedEmails: preservedAliases,
  });
}

async function setIcloudAliasUsedState(payload = {}, options = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('未提供 iCloud 隐私邮箱地址。');
  }

  const used = Boolean(payload.used);
  const state = await getState();
  const manualAliasUsage = getManualAliasUsageMap(state);
  manualAliasUsage[email] = used;
  await setState({ manualAliasUsage });
  if (!options.silentLog) {
    await addLog(`iCloud：已将 ${email} 标记为${used ? '已用' : '未用'}`, 'ok');
  }
  broadcastIcloudAliasesChanged({ reason: 'used-updated', email, used });
  return { email, used };
}

async function setIcloudAliasPreservedState(payload = {}) {
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('未提供 iCloud 隐私邮箱地址。');
  }

  const preserved = Boolean(payload.preserved);
  const state = await getState();
  const preservedAliases = getPreservedAliasMap(state);
  preservedAliases[email] = preserved;
  await setState({ preservedAliases });
  await addLog(`iCloud：已将 ${email} ${preserved ? '设为保留' : '取消保留'}`, 'ok');
  broadcastIcloudAliasesChanged({ reason: 'preserved-updated', email, preserved });
  return { email, preserved };
}

async function resetState() {
  console.log(LOG_PREFIX, 'Resetting all state');
  // Preserve settings and persistent data across resets
  const [prev, persistedSettings, persistedAliasState] = await Promise.all([
    chrome.storage.session.get([
      'seenCodes',
      'seenInbucketMailIds',
      'accounts',
      'tabRegistry',
      'sourceLastUrls',
      'reusablePhoneActivation',
      'freeReusablePhoneActivation',
      'phoneReusableActivationPool',
      'luckmailApiKey',
      'luckmailBaseUrl',
      'luckmailEmailType',
      'luckmailDomain',
      'luckmailUsedPurchases',
      'luckmailPreserveTagId',
      'luckmailPreserveTagName',
      'preferredIcloudHost',
      ...CONTRIBUTION_RUNTIME_KEYS,
    ]),
    getPersistedSettings(),
    getPersistedAliasState(),
  ]);
  const contributionModeState = buildContributionModeState(Boolean(prev.contributionMode), persistedSettings, prev);
  const reusablePhoneActivation = (
    prev.reusablePhoneActivation
    && typeof prev.reusablePhoneActivation === 'object'
    && !Array.isArray(prev.reusablePhoneActivation)
    && String(
      prev.reusablePhoneActivation.activationId
      ?? prev.reusablePhoneActivation.id
      ?? prev.reusablePhoneActivation.activation
      ?? ''
    ).trim()
    && String(
      prev.reusablePhoneActivation.phoneNumber
      ?? prev.reusablePhoneActivation.number
      ?? prev.reusablePhoneActivation.phone
      ?? ''
    ).trim()
  )
    ? prev.reusablePhoneActivation
    : null;
  const phoneReusableActivationPool = Array.isArray(prev.phoneReusableActivationPool)
    ? prev.phoneReusableActivationPool
      .map((entry) => normalizePhonePreferredActivation(entry))
      .filter(Boolean)
    : [];
  const freeReusablePhoneActivation = (
    prev.freeReusablePhoneActivation
    && typeof prev.freeReusablePhoneActivation === 'object'
    && !Array.isArray(prev.freeReusablePhoneActivation)
    && String(
      prev.freeReusablePhoneActivation.phoneNumber
      ?? prev.freeReusablePhoneActivation.number
      ?? prev.freeReusablePhoneActivation.phone
      ?? ''
    ).trim()
  )
    ? prev.freeReusablePhoneActivation
    : null;
  await chrome.storage.session.clear();
  await chrome.storage.session.set({
    ...DEFAULT_STATE,
    ...persistedSettings,
    ...persistedAliasState,
    ...contributionModeState,
    seenCodes: prev.seenCodes || [],
    seenInbucketMailIds: prev.seenInbucketMailIds || [],
    accounts: prev.accounts || [],
    tabRegistry: prev.tabRegistry || {},
    sourceLastUrls: prev.sourceLastUrls || {},
    luckmailApiKey: String(prev.luckmailApiKey || ''),
    luckmailBaseUrl: normalizeLuckmailBaseUrl(prev.luckmailBaseUrl),
    luckmailEmailType: normalizeLuckmailEmailType(prev.luckmailEmailType),
    luckmailDomain: String(prev.luckmailDomain || '').trim(),
    luckmailUsedPurchases: normalizeLuckmailUsedPurchases(prev.luckmailUsedPurchases),
    luckmailPreserveTagId: Number(prev.luckmailPreserveTagId) || 0,
    luckmailPreserveTagName: String(prev.luckmailPreserveTagName || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
    currentLuckmailPurchase: null,
    currentLuckmailMailCursor: null,
    // Keep reusable phone activation across round resets so the same number can be reactivated up to maxUses.
    reusablePhoneActivation,
    // Keep free reuse phone activation until the user clears or the flow retires it.
    freeReusablePhoneActivation,
    phoneReusableActivationPool,
    preferredIcloudHost: prev.preferredIcloudHost || '',
  });
}

/**
 * Generate a random password: 14 chars, mix of uppercase, lowercase, digits, symbols.
 */
function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;

  // Ensure at least one of each type
  let pw = '';
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill remaining 10 chars
  for (let i = 0; i < 10; i++) {
    pw += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

function normalizePayPalAccount(account = {}) {
  if (self.PayPalUtils?.normalizePayPalAccount) {
    return self.PayPalUtils.normalizePayPalAccount(account);
  }
  return {
    id: String(account.id || crypto.randomUUID()),
    email: String(account.email || '').trim().toLowerCase(),
    password: String(account.password || ''),
    createdAt: Number.isFinite(Number(account.createdAt)) ? Number(account.createdAt) : Date.now(),
    updatedAt: Number.isFinite(Number(account.updatedAt)) ? Number(account.updatedAt) : Date.now(),
    lastUsedAt: Number.isFinite(Number(account.lastUsedAt)) ? Number(account.lastUsedAt) : 0,
  };
}

function normalizePayPalAccounts(accounts) {
  if (self.PayPalUtils?.normalizePayPalAccounts) {
    return self.PayPalUtils.normalizePayPalAccounts(accounts);
  }
  return Array.isArray(accounts) ? accounts.map((account) => normalizePayPalAccount(account)) : [];
}

function findPayPalAccount(accounts, accountId) {
  if (self.PayPalUtils?.findPayPalAccount) {
    return self.PayPalUtils.findPayPalAccount(accounts, accountId);
  }
  const normalizedId = String(accountId || '').trim();
  if (!normalizedId) return null;
  return normalizePayPalAccounts(accounts).find((account) => account.id === normalizedId) || null;
}

function upsertPayPalAccountInList(accounts, nextAccount) {
  if (self.PayPalUtils?.upsertPayPalAccountInList) {
    return self.PayPalUtils.upsertPayPalAccountInList(accounts, nextAccount);
  }
  const normalizedNext = normalizePayPalAccount(nextAccount);
  const list = normalizePayPalAccounts(accounts);
  const existingIndex = list.findIndex((account) => account.id === normalizedNext.id);
  if (existingIndex >= 0) {
    list[existingIndex] = normalizedNext;
    return list;
  }
  return [...list, normalizedNext];
}

function normalizeHotmailAccount(account = {}) {
  const normalizedLastAuthAt = Number.isFinite(Number(account.lastAuthAt)) ? Number(account.lastAuthAt) : 0;
  const normalizedStatus = String(
    account.status
    || (normalizedLastAuthAt > 0 ? 'authorized' : 'pending')
  );
  return {
    id: String(account.id || crypto.randomUUID()),
    email: String(account.email || '').trim(),
    password: String(account.password || ''),
    clientId: String(account.clientId || '').trim(),
    refreshToken: String(account.refreshToken || ''),
    status: normalizedStatus,
    enabled: account.enabled !== undefined ? Boolean(account.enabled) : true,
    used: Boolean(account.used),
    lastUsedAt: Number.isFinite(Number(account.lastUsedAt)) ? Number(account.lastUsedAt) : 0,
    lastAuthAt: normalizedLastAuthAt,
    lastError: String(account.lastError || ''),
  };
}

function normalizeHotmailAccounts(accounts) {
  if (!Array.isArray(accounts)) return [];

  const deduped = new Map();
  for (const account of accounts) {
    const normalized = normalizeHotmailAccount(account);
    if (!normalized.email && !normalized.id) continue;
    deduped.set(normalized.id, normalized);
  }
  return [...deduped.values()];
}

function findHotmailAccount(accounts, accountId) {
  return normalizeHotmailAccounts(accounts).find((account) => account.id === accountId) || null;
}

function isHotmailProvider(stateOrProvider) {
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  return provider === HOTMAIL_PROVIDER;
}

function isLuckmailProvider(stateOrProvider) {
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  return provider === LUCKMAIL_PROVIDER;
}

function isCustomMailProvider(stateOrProvider) {
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  return provider === 'custom';
}

function getMail2925Mode(stateOrMode) {
  if (typeof stateOrMode === 'string') {
    return normalizeMail2925Mode(stateOrMode);
  }
  return normalizeMail2925Mode(stateOrMode?.mail2925Mode);
}

async function syncHotmailAccounts(accounts) {
  const normalized = normalizeHotmailAccounts(accounts);
  await setPersistentSettings({ hotmailAccounts: normalized });
  await setState({ hotmailAccounts: normalized });
  broadcastDataUpdate({ hotmailAccounts: normalized });
  return normalized;
}

async function upsertHotmailAccount(input) {
  const state = await getState();
  const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
  const normalizedEmail = String(input?.email || '').trim().toLowerCase();
  const existing = input?.id
    ? findHotmailAccount(accounts, input.id)
    : accounts.find((account) => account.email.toLowerCase() === normalizedEmail) || null;
  const credentialsChanged = !existing
    || (input?.clientId !== undefined && String(input.clientId).trim() !== existing.clientId)
    || (input?.refreshToken !== undefined && String(input.refreshToken).trim() !== existing.refreshToken)
    || (input?.email !== undefined && String(input.email).trim().toLowerCase() !== existing.email.toLowerCase());
  const normalized = normalizeHotmailAccount({
    ...(existing || {}),
    ...(credentialsChanged ? {
      status: 'pending',
      lastAuthAt: 0,
      lastError: '',
    } : {}),
    ...input,
    id: input?.id || existing?.id || crypto.randomUUID(),
  });

  const nextAccounts = existing
    ? accounts.map((account) => (account.id === normalized.id ? normalized : account))
    : [...accounts, normalized];

  await syncHotmailAccounts(nextAccounts);
  return normalized;
}

async function deleteHotmailAccount(accountId) {
  const state = await getState();
  const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
  const nextAccounts = accounts.filter((account) => account.id !== accountId);
  await syncHotmailAccounts(nextAccounts);

  if (state.currentHotmailAccountId === accountId) {
    await setState({ currentHotmailAccountId: null });
    if (isHotmailProvider(state)) {
      await setEmailState(null);
    }
    broadcastDataUpdate({ currentHotmailAccountId: null });
  }
}

async function deleteHotmailAccounts(mode = 'all') {
  const state = await getState();
  const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
  const targets = filterHotmailAccountsByUsage(accounts, mode);
  const targetIds = new Set(targets.map((account) => account.id));
  const nextAccounts = mode === 'used'
    ? accounts.filter((account) => !targetIds.has(account.id))
    : [];

  await syncHotmailAccounts(nextAccounts);

  if (state.currentHotmailAccountId && targetIds.has(state.currentHotmailAccountId)) {
    await setState({ currentHotmailAccountId: null });
    if (isHotmailProvider(state)) {
      await setEmailState(null);
    }
    broadcastDataUpdate({ currentHotmailAccountId: null });
  }

  return {
    deletedCount: targets.length,
    remainingCount: nextAccounts.length,
  };
}

async function patchHotmailAccount(accountId, updates = {}) {
  const state = await getState();
  const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
  const account = findHotmailAccount(accounts, accountId);
  if (!account) {
    throw new Error('未找到对应的 Hotmail 账号。');
  }

  const nextAccount = normalizeHotmailAccount({
    ...account,
    ...updates,
    id: account.id,
  });

  await syncHotmailAccounts(accounts.map((item) => (item.id === account.id ? nextAccount : item)));

  if (state.currentHotmailAccountId === account.id && shouldClearHotmailCurrentSelection(nextAccount)) {
    await setState({ currentHotmailAccountId: null });
    broadcastDataUpdate({ currentHotmailAccountId: null });
    if (isHotmailProvider(state)) {
      await setEmailState(null);
    }
  }

  return nextAccount;
}

async function setCurrentHotmailAccount(accountId, options = {}) {
  const { markUsed = false, syncEmail = true } = options;
  const state = await getState();
  const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
  const account = findHotmailAccount(accounts, accountId);
  if (!account) {
    throw new Error('未找到对应的 Hotmail 账号。');
  }

  if (markUsed) {
    account.lastUsedAt = Date.now();
    await syncHotmailAccounts(accounts.map((item) => (item.id === account.id ? account : item)));
  }

  await setState({ currentHotmailAccountId: account.id });
  broadcastDataUpdate({ currentHotmailAccountId: account.id });
  if (syncEmail) {
    await setEmailState(account.email || null);
  }
  return account;
}

function isAuthorizedHotmailRunAccount(candidate) {
  return Boolean(candidate)
    && candidate.status === 'authorized'
    && !candidate.used
    && Boolean(candidate.refreshToken);
}

function isPendingHotmailVerificationCandidate(candidate) {
  return Boolean(candidate)
    && candidate.status === 'pending'
    && !candidate.used
    && Boolean(candidate.refreshToken);
}

function compareHotmailAccountAllocationPriority(left, right) {
  const leftUsedAt = Number(left?.lastUsedAt) || 0;
  const rightUsedAt = Number(right?.lastUsedAt) || 0;
  if (leftUsedAt !== rightUsedAt) {
    return leftUsedAt - rightUsedAt;
  }

  return String(left?.email || '').localeCompare(String(right?.email || ''));
}

function pickPendingHotmailAccountForVerification(accounts, options = {}) {
  const excludeIds = new Set((options.excludeIds || []).filter(Boolean));
  const candidates = normalizeHotmailAccounts(accounts)
    .filter((candidate) => isPendingHotmailVerificationCandidate(candidate) && !excludeIds.has(candidate.id));
  if (!candidates.length) {
    return null;
  }

  const preferredAccountId = String(options.preferredAccountId || '').trim();
  if (preferredAccountId) {
    const preferredCandidate = candidates.find((candidate) => candidate.id === preferredAccountId);
    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  return candidates
    .slice()
    .sort(compareHotmailAccountAllocationPriority)[0] || null;
}

async function ensureHotmailAccountForFlow(options = {}) {
  const {
    allowAllocate = true,
    markUsed = false,
    preferredAccountId = null,
    excludeIds = [],
  } = options;
  const state = await getState();
  const accounts = normalizeHotmailAccounts(state.hotmailAccounts);
  const excludedAccountIds = new Set((excludeIds || []).filter(Boolean));
  const availableAccounts = accounts.filter((candidate) => isAuthorizedHotmailRunAccount(candidate) && !excludedAccountIds.has(candidate.id));

  let account = null;
  if (preferredAccountId && !excludedAccountIds.has(preferredAccountId)) {
    account = findHotmailAccount(accounts, preferredAccountId);
  }
  if ((!account || !isAuthorizedHotmailRunAccount(account)) && state.currentHotmailAccountId && !excludedAccountIds.has(state.currentHotmailAccountId)) {
    account = findHotmailAccount(accounts, state.currentHotmailAccountId);
  }
  if ((!account || !isAuthorizedHotmailRunAccount(account)) && allowAllocate) {
    account = availableAccounts.length ? pickHotmailAccountForRun(availableAccounts, {}) : null;
  }

  if (!account) {
    throw new Error('没有可用的 Hotmail 账号。请先在侧边栏添加至少一个带刷新令牌（refresh token）的账号。');
  }
  if (!isAuthorizedHotmailRunAccount(account)) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 尚未就绪，无法读取邮件。`);
  }

  return setCurrentHotmailAccount(account.id, { markUsed, syncEmail: true });
}

function buildHotmailLocalEndpoint(baseUrl, path) {
  const normalizedBaseUrl = normalizeHotmailLocalBaseUrl(baseUrl);
  return new URL(path, `${normalizedBaseUrl}/`).toString();
}

async function requestHotmailRemoteMailbox(account, mailbox = 'INBOX') {
  if (!account?.email) {
    throw new Error('Hotmail 账号缺少邮箱地址。');
  }
  if (!account?.clientId) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 缺少客户端 ID。`);
  }
  if (!account?.refreshToken) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 缺少刷新令牌（refresh token）。`);
  }

  const { timeoutMs } = getHotmailMailApiRequestConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const result = await fetchMicrosoftMailboxMessages({
      clientId: account.clientId,
      refreshToken: account.refreshToken,
      mailbox,
      top: 10,
      signal: controller.signal,
    });

    return {
      mailbox,
      payload: {
        source: 'microsoft-api',
        transport: result.transport,
        tokenStrategy: result.tokenStrategy,
      },
      messages: normalizeHotmailMailApiMessages(result.messages).map((message) => ({
        ...message,
        mailbox: message?.mailbox || mailbox,
      })),
      nextRefreshToken: result.nextRefreshToken,
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Hotmail API 对接请求超时（>${Math.round(timeoutMs / 1000)} 秒）：${mailbox}`);
    }
    throw new Error(`Hotmail API 对接请求失败：${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function applyHotmailApiResultToAccount(account, apiResult) {
  const nextRefreshToken = String(apiResult?.nextRefreshToken || '').trim();
  return {
    ...account,
    refreshToken: nextRefreshToken || account.refreshToken,
    status: 'authorized',
    lastAuthAt: Date.now(),
    lastError: '',
  };
}

function buildHotmailMailApiFailureAccount(account, errorMessage) {
  return normalizeHotmailAccount({
    ...account,
    status: 'error',
    lastError: String(errorMessage || ''),
  });
}

async function fetchHotmailMailboxMessagesFromRemoteService(account, mailboxes = HOTMAIL_MAILBOXES) {
  let workingAccount = normalizeHotmailAccount(account);
  const mailboxResults = [];

  try {
    for (const mailbox of mailboxes) {
      const result = await requestHotmailRemoteMailbox(workingAccount, mailbox);
      workingAccount = applyHotmailApiResultToAccount(workingAccount, result);
      mailboxResults.push({
        mailbox,
        count: result.messages.length,
        messages: result.messages.map((message) => ({
          ...message,
          mailbox: message?.mailbox || mailbox,
        })),
      });
    }
  } catch (err) {
    const failedAccount = buildHotmailMailApiFailureAccount(workingAccount, err.message);
    await upsertHotmailAccount(failedAccount);
    throw err;
  }

  const savedAccount = await upsertHotmailAccount(workingAccount);
  return {
    account: savedAccount,
    mailboxResults,
    messages: mailboxResults.flatMap((item) => item.messages),
  };
}

async function requestHotmailLocalMessages(account, mailboxes = HOTMAIL_MAILBOXES) {
  if (!account?.email) {
    throw new Error('Hotmail 账号缺少邮箱地址。');
  }
  if (!account?.clientId) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 缺少客户端 ID。`);
  }
  if (!account?.refreshToken) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 缺少刷新令牌（refresh token）。`);
  }

  const serviceSettings = getHotmailServiceSettings(await getState());
  const { timeoutMs } = getHotmailMailApiRequestConfig();
  const requestTimeoutMs = Math.max(timeoutMs, HOTMAIL_LOCAL_HELPER_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), requestTimeoutMs);

  let response;
  try {
    response = await fetch(buildHotmailLocalEndpoint(serviceSettings.localBaseUrl, '/messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: account.email,
        clientId: account.clientId,
        refreshToken: account.refreshToken,
        mailboxes,
        top: 5,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Hotmail 本地助手请求超时（>${Math.round(requestTimeoutMs / 1000)} 秒）`);
    }
    throw new Error(`Hotmail 本地助手请求失败：${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok || payload?.ok === false) {
    const errorText = payload?.error || payload?.message || text || `HTTP ${response.status}`;
    throw new Error(`Hotmail 本地助手返回失败：${errorText}`);
  }

  const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
  const normalizedMessages = normalizeHotmailMailApiMessages(rawMessages).map((message, index) => ({
    ...message,
    mailbox: rawMessages[index]?.mailbox || 'INBOX',
    receivedTimestamp: Number(rawMessages[index]?.receivedTimestamp || 0) || 0,
  }));
  const mailboxResults = Array.isArray(payload?.mailboxResults)
    ? payload.mailboxResults.map((item) => ({
      mailbox: String(item?.mailbox || 'INBOX'),
      count: Number(item?.count || 0),
      messages: normalizedMessages.filter((message) => String(message.mailbox || 'INBOX') === String(item?.mailbox || 'INBOX')),
    }))
    : mailboxes.map((mailbox) => ({
      mailbox,
      count: normalizedMessages.filter((message) => String(message.mailbox || 'INBOX') === mailbox).length,
      messages: normalizedMessages.filter((message) => String(message.mailbox || 'INBOX') === mailbox),
    }));

  const nextAccount = applyHotmailApiResultToAccount(account, {
    nextRefreshToken: String(payload?.nextRefreshToken || '').trim(),
  });
  const savedAccount = await upsertHotmailAccount(nextAccount);
  return {
    account: savedAccount,
    mailboxResults,
    messages: normalizedMessages,
  };
}

async function requestHotmailLocalCode(account, pollPayload = {}) {
  if (!account?.email) {
    throw new Error('Hotmail 账号缺少邮箱地址。');
  }
  if (!account?.clientId) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 缺少客户端 ID。`);
  }
  if (!account?.refreshToken) {
    throw new Error(`Hotmail 账号 ${account.email || account.id} 缺少刷新令牌（refresh token）。`);
  }

  const serviceSettings = getHotmailServiceSettings(await getState());
  const { timeoutMs } = getHotmailMailApiRequestConfig();
  const requestTimeoutMs = Math.max(timeoutMs, HOTMAIL_LOCAL_HELPER_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), requestTimeoutMs);

  let response;
  try {
    response = await fetch(buildHotmailLocalEndpoint(serviceSettings.localBaseUrl, '/code'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: account.email,
        clientId: account.clientId,
        refreshToken: account.refreshToken,
        mailboxes: HOTMAIL_MAILBOXES,
        top: 5,
        senderFilters: pollPayload.senderFilters || [],
        subjectFilters: pollPayload.subjectFilters || [],
        excludeCodes: pollPayload.excludeCodes || [],
        filterAfterTimestamp: Number(pollPayload.filterAfterTimestamp || 0) || 0,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Hotmail 本地助手请求超时（>${Math.round(requestTimeoutMs / 1000)} 秒）`);
    }
    throw new Error(`Hotmail 本地助手请求失败：${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok || payload?.ok === false) {
    const errorText = payload?.error || payload?.message || text || `HTTP ${response.status}`;
    throw new Error(`Hotmail 本地助手返回失败：${errorText}`);
  }

  const normalizedMessage = payload?.message
    ? {
      ...normalizeHotmailMailApiMessages([payload.message])[0],
      mailbox: payload?.message?.mailbox || 'INBOX',
      receivedTimestamp: Number(payload?.message?.receivedTimestamp || 0) || 0,
    }
    : null;
  const nextAccount = applyHotmailApiResultToAccount(account, {
    nextRefreshToken: String(payload?.nextRefreshToken || '').trim(),
  });
  const savedAccount = await upsertHotmailAccount(nextAccount);
  return {
    account: savedAccount,
    code: String(payload?.code || ''),
    message: normalizedMessage,
    usedTimeFallback: Boolean(payload?.usedTimeFallback),
    selectionSource: String(payload?.selectionSource || ''),
  };
}

async function pollHotmailVerificationCodeViaLocalHelper(step, account, pollPayload = {}) {
  const maxAttempts = Number(pollPayload.maxAttempts) || 5;
  const intervalMs = Number(pollPayload.intervalMs) || 3000;
  let workingAccount = account;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfStopped();
    try {
      await addLog(`步骤 ${step}：正在通过本地助手轮询 Hotmail 验证码（${attempt}/${maxAttempts}）...`, 'info');
      const fetchResult = await requestHotmailLocalCode(workingAccount, pollPayload);
      workingAccount = fetchResult.account;

      if (fetchResult.code) {
        const mailboxLabel = fetchResult.message?.mailbox || 'INBOX';
        if (fetchResult.usedTimeFallback) {
          await addLog(`步骤 ${step}：本地助手使用时间回退后命中 Hotmail ${mailboxLabel} 验证码。`, 'warn');
        }
        await addLog(`步骤 ${step}：已通过本地助手在 Hotmail ${mailboxLabel} 中找到验证码：${fetchResult.code}`, 'ok');
        return {
          ok: true,
          code: fetchResult.code,
          emailTimestamp: fetchResult.message?.receivedTimestamp || Date.now(),
          mailId: fetchResult.message?.id || '',
        };
      }

      lastError = new Error(`步骤 ${step}：本地助手暂未返回匹配验证码（${attempt}/${maxAttempts}）。`);
      await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
    } catch (err) {
      lastError = err;
      await addLog(`步骤 ${step}：本地助手轮询 Hotmail 失败：${err.message}`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleepWithStop(intervalMs);
    }
  }

  throw lastError || new Error(`步骤 ${step}：本地助手未返回新的匹配验证码。`);
}

async function fetchHotmailMailboxMessages(account, mailboxes = HOTMAIL_MAILBOXES) {
  const serviceSettings = getHotmailServiceSettings(await getState());
  if (serviceSettings.mode === HOTMAIL_SERVICE_MODE_LOCAL) {
    return requestHotmailLocalMessages(account, mailboxes);
  }
  return fetchHotmailMailboxMessagesFromRemoteService(account, mailboxes);
}

async function verifyHotmailAccount(accountId) {
  const state = await getState();
  const account = findHotmailAccount(state.hotmailAccounts, accountId);
  if (!account) {
    throw new Error('未找到需要校验的 Hotmail 账号。');
  }

  const result = await fetchHotmailMailboxMessages(account, ['INBOX']);
  return {
    account: result.account,
    messageCount: result.mailboxResults[0]?.count || 0,
  };
}

async function ensureHotmailMailboxReadyForAutoRunRound(options = {}) {
  const {
    targetRun = 0,
    totalRuns = 0,
    attemptRun = 1,
  } = options;
  const state = await getState();
  if (!isHotmailProvider(state)) {
    return null;
  }

  const buildRoundLabel = () => {
    if (targetRun > 0 && totalRuns > 0) {
      return `第 ${targetRun}/${totalRuns} 轮`;
    }
    return '当前轮';
  };
  const exhaustedAccountIds = new Set();
  let preferredAccountId = state.currentHotmailAccountId || null;
  let lastError = null;

  while (true) {
    throwIfStopped();
    const latestState = await getState();
    const latestAccounts = normalizeHotmailAccounts(latestState.hotmailAccounts);
    const remainingAuthorizedAccounts = latestAccounts
      .filter((candidate) => isAuthorizedHotmailRunAccount(candidate) && !exhaustedAccountIds.has(candidate.id));
    const remainingPendingAccounts = latestAccounts
      .filter((candidate) => isPendingHotmailVerificationCandidate(candidate) && !exhaustedAccountIds.has(candidate.id));
    if (!remainingAuthorizedAccounts.length && !remainingPendingAccounts.length) {
      if (lastError) {
        throw new Error(`自动运行${buildRoundLabel()}开始前未找到可通过校验的 Hotmail 账号：${lastError.message}`);
      }
      throw new Error('没有可用的 Hotmail 账号。请先在侧边栏添加至少一个带刷新令牌（refresh token）的账号。');
    }

    let account = null;
    if (remainingAuthorizedAccounts.length) {
      account = await ensureHotmailAccountForFlow({
        allowAllocate: true,
        markUsed: false,
        preferredAccountId,
        excludeIds: [...exhaustedAccountIds],
      });
    } else {
      const pendingAccount = pickPendingHotmailAccountForVerification(latestAccounts, {
        preferredAccountId,
        excludeIds: [...exhaustedAccountIds],
      });
      if (!pendingAccount) {
        throw new Error('没有可用的 Hotmail 账号。请先在侧边栏添加至少一个带刷新令牌（refresh token）的账号。');
      }
      account = await setCurrentHotmailAccount(pendingAccount.id, {
        markUsed: false,
        syncEmail: true,
      });
      await addLog(
        `自动运行${buildRoundLabel()}开始前未找到已校验 Hotmail 账号，正在尝试校验待校验账号 ${account.email}。`,
        'warn'
      );
    }

    try {
      await addLog(
        `自动运行${buildRoundLabel()}第 ${attemptRun} 次尝试开始前，正在校验 Hotmail 账号 ${account.email} 的邮箱可用性。`,
        'info'
      );
      const result = await verifyHotmailAccount(account.id);
      await addLog(
        `自动运行${buildRoundLabel()}开始前已校验 Hotmail 账号 ${result.account?.email || account.email}，INBOX 当前 ${result.messageCount} 封邮件。`,
        'ok'
      );
      return result.account;
    } catch (error) {
      lastError = error;
      exhaustedAccountIds.add(account.id);
      preferredAccountId = null;
      const latestErrorMessage = error?.message || '未知错误';
      await addLog(
        `自动运行${buildRoundLabel()}开始前校验 Hotmail 账号 ${account.email} 失败：${latestErrorMessage}`,
        'warn'
      );
      const nextState = await getState();
      const hasRemainingAccounts = normalizeHotmailAccounts(nextState.hotmailAccounts)
        .some((candidate) => (
          isAuthorizedHotmailRunAccount(candidate) || isPendingHotmailVerificationCandidate(candidate)
        ) && !exhaustedAccountIds.has(candidate.id));
      if (hasRemainingAccounts) {
        await addLog(`自动运行${buildRoundLabel()}开始前将切换下一个 Hotmail 账号并重试。`, 'warn');
      }
    }
  }
}

async function testHotmailAccountMailAccess(accountId) {
  const state = await getState();
  const account = findHotmailAccount(state.hotmailAccounts, accountId);
  if (!account) {
    throw new Error('未找到需要测试的 Hotmail 账号。');
  }

  const result = await fetchHotmailMailboxMessages(account, HOTMAIL_MAILBOXES);
  const latestMessage = getLatestHotmailMessage(result.messages);
  const latestCode = latestMessage ? extractVerificationCodeFromMessage(latestMessage) : null;

  return {
    account: result.account,
    accountId: result.account.id,
    email: result.account.email,
    messageCount: result.messages.length,
    latestSubject: latestMessage?.subject || '',
    latestMailbox: latestMessage?.mailbox || '',
    latestCode: latestCode || '',
    inboxCount: result.mailboxResults.find((item) => item.mailbox === 'INBOX')?.count || 0,
    junkCount: result.mailboxResults.find((item) => item.mailbox === 'Junk')?.count || 0,
  };
}

async function pollHotmailVerificationCode(step, state, pollPayload = {}) {
  await addLog(`步骤 ${step}：正在确定 Hotmail 收信账号...`, 'info');
  let account = await ensureHotmailAccountForFlow({
    allowAllocate: true,
    markUsed: false,
    preferredAccountId: state.currentHotmailAccountId || null,
  });
  await addLog(`步骤 ${step}：当前使用 Hotmail 账号 ${account.email} 轮询收件箱。`, 'info');

  const serviceSettings = getHotmailServiceSettings(state);
  if (serviceSettings.mode === HOTMAIL_SERVICE_MODE_LOCAL) {
    return pollHotmailVerificationCodeViaLocalHelper(step, account, pollPayload);
  }

  const maxAttempts = Number(pollPayload.maxAttempts) || 5;
  const intervalMs = Number(pollPayload.intervalMs) || 3000;
  let lastError = null;

  function summarizeMessagesForLog(messages) {
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
        return `[${message.mailbox || 'INBOX'}] ${receivedAt} | ${sender} | ${subject} | ${preview}`;
      })
      .join(' || ');
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfStopped();
    try {
      await addLog(`步骤 ${step}：正在通过 API对接 轮询 Hotmail 邮件（${attempt}/${maxAttempts}）...`, 'info');
      const fetchResult = await fetchHotmailMailboxMessages(account, HOTMAIL_MAILBOXES);
      account = fetchResult.account;
      const matchResult = pickVerificationMessageWithTimeFallback(fetchResult.messages, {
        afterTimestamp: pollPayload.filterAfterTimestamp || 0,
        senderFilters: pollPayload.senderFilters || [],
        subjectFilters: pollPayload.subjectFilters || [],
        excludeCodes: pollPayload.excludeCodes || [],
      });
      const match = matchResult.match;

      if (match?.code) {
        const mailboxLabel = match.message?.mailbox || 'INBOX';
        if (matchResult.usedRelaxedFilters) {
          const fallbackLabel = matchResult.usedTimeFallback ? '宽松匹配 + 时间回退' : '宽松匹配';
          await addLog(`步骤 ${step}：严格规则未命中，已改用 ${fallbackLabel} 并命中 Hotmail ${mailboxLabel} 验证码。`, 'warn');
        }
        await addLog(`步骤 ${step}：已通过 API对接 在 Hotmail ${mailboxLabel} 中找到验证码：${match.code}`, 'ok');
        return {
          ok: true,
          code: match.code,
          emailTimestamp: match.receivedAt || Date.now(),
          mailId: match.message?.id || '',
        };
      }

      lastError = new Error(`步骤 ${step}：暂未在 Hotmail 收件箱中找到匹配验证码（${attempt}/${maxAttempts}）。`);
      await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
      const mailSummary = summarizeMessagesForLog(fetchResult.messages);
      if (mailSummary) {
        await addLog(`步骤 ${step}：最近邮件样本：${mailSummary}`, 'info');
      }
    } catch (err) {
      lastError = err;
      await addLog(`步骤 ${step}：Hotmail API 对接轮询失败：${err.message}`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleepWithStop(intervalMs);
    }
  }

  throw lastError || new Error(`步骤 ${step}：未在 Hotmail 收件箱中找到新的匹配验证码。`);
}

function generateRandomSuffix(length = 6) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let suffix = '';
  for (let i = 0; i < length; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return suffix;
}

const GMAIL_ALIAS_WORDS = [
  'amber', 'apple', 'ash', 'berry', 'birch', 'blue', 'brook', 'cedar',
  'cloud', 'clover', 'coast', 'cocoa', 'coral', 'dawn', 'delta', 'echo',
  'ember', 'field', 'flint', 'flora', 'forest', 'frost', 'glade', 'harbor',
  'hazel', 'honey', 'ivory', 'jade', 'lake', 'leaf', 'light', 'lilac',
  'lotus', 'lunar', 'maple', 'meadow', 'mist', 'moon', 'nova', 'oasis',
  'olive', 'opal', 'pearl', 'pine', 'pixel', 'plum', 'quartz', 'rain',
  'raven', 'river', 'rose', 'sage', 'shore', 'sky', 'solar', 'spark',
  'stone', 'storm', 'sun', 'terra', 'vale', 'wave', 'willow', 'zephyr',
];

function generateRandomWordAliasTag(parts = 3) {
  const selected = [];
  for (let i = 0; i < parts; i++) {
    selected.push(GMAIL_ALIAS_WORDS[Math.floor(Math.random() * GMAIL_ALIAS_WORDS.length)]);
  }
  return selected.join('');
}

function parseGmailBaseEmail(rawValue) {
  const value = String(rawValue || '').trim().toLowerCase();
  const match = value.match(/^([^@\s+]+)@((?:gmail|googlemail)\.com)$/i);
  if (!match) return null;
  return {
    localPart: match[1],
    domain: match[2].toLowerCase(),
  };
}

function isGeneratedAliasProvider(stateOrProvider, mail2925Mode = undefined) {
  if (
    stateOrProvider
    && typeof stateOrProvider === 'object'
    && !Array.isArray(stateOrProvider)
    && normalizeEmailGenerator(stateOrProvider.emailGenerator) === (
      typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
        ? CUSTOM_EMAIL_POOL_GENERATOR
        : 'custom-pool'
    )
  ) {
    return false;
  }
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  const resolvedMail2925Mode = mail2925Mode !== undefined
    ? normalizeMail2925Mode(mail2925Mode)
    : getMail2925Mode(stateOrProvider);
  const utils = (typeof self !== 'undefined' ? self : globalThis).MultiPageManagedAliasUtils || null;
  if (utils?.usesManagedAliasGeneration) {
    return utils.usesManagedAliasGeneration(provider, { mail2925Mode: resolvedMail2925Mode });
  }
  if (utils?.isManagedAliasProvider) {
    if (String(provider || '').trim().toLowerCase() === '2925') {
      return utils.isManagedAliasProvider(provider) && resolvedMail2925Mode === MAIL_2925_MODE_PROVIDE;
    }
    return utils.isManagedAliasProvider(provider);
  }
  return provider === GMAIL_PROVIDER
    || (provider === '2925' && resolvedMail2925Mode === MAIL_2925_MODE_PROVIDE);
}

function shouldUseCustomRegistrationEmail(state = {}) {
  return isCustomMailProvider(state)
    || (!isHotmailProvider(state)
      && !isGeneratedAliasProvider(state)
      && normalizeEmailGenerator(state.emailGenerator) === 'custom');
}

function buildGeneratedAliasEmail(state) {
  const provider = state.mailProvider || '163';
  const emailPrefix = (state.emailPrefix || '').trim();

  if (provider === GMAIL_PROVIDER) {
    if (!emailPrefix) {
      throw new Error('Gmail 原邮箱未设置，请先在侧边栏填写。');
    }
    const parsed = parseGmailBaseEmail(emailPrefix);
    if (!parsed) {
      throw new Error('Gmail 原邮箱格式不正确，请填写类似 name@gmail.com 的地址。');
    }
    return `${parsed.localPart}+${generateRandomWordAliasTag()}@${parsed.domain}`;
  }

  if (!emailPrefix) {
    throw new Error('2925 邮箱前缀未设置，请先在侧边栏填写。');
  }

  if (provider === '2925' && isGeneratedAliasProvider(state)) {
    return `${emailPrefix}${generateRandomSuffix(6)}@2925.com`;
  }

  throw new Error(`未支持的别名邮箱类型：${provider}`);
}

function getManagedAliasUtils() {
  return (typeof self !== 'undefined' ? self : globalThis).MultiPageManagedAliasUtils || null;
}

function parseGmailBaseEmail(rawValue) {
  const utils = getManagedAliasUtils();
  if (utils?.parseManagedAliasBaseEmail) {
    return utils.parseManagedAliasBaseEmail(rawValue, GMAIL_PROVIDER);
  }

  const value = String(rawValue || '').trim().toLowerCase();
  const match = value.match(/^([^@\s+]+)@((?:gmail|googlemail)\.com)$/i);
  if (!match) return null;
  return {
    localPart: match[1],
    domain: match[2].toLowerCase(),
  };
}

function parseManagedAliasBaseEmail(rawValue, provider) {
  const utils = getManagedAliasUtils();
  if (utils?.parseManagedAliasBaseEmail) {
    return utils.parseManagedAliasBaseEmail(rawValue, provider);
  }

  if (provider === GMAIL_PROVIDER) {
    return parseGmailBaseEmail(rawValue);
  }

  const value = String(rawValue || '').trim().toLowerCase();
  const match = value.match(/^([^@\s+]+)@(2925\.com)$/i);
  if (!match) return null;
  return {
    localPart: match[1],
    domain: match[2].toLowerCase(),
  };
}

function isManagedAliasEmail(value, provider, baseEmail = '') {
  const utils = getManagedAliasUtils();
  if (utils?.isManagedAliasEmail) {
    return utils.isManagedAliasEmail(value, provider, baseEmail);
  }

  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) return false;
  const parsedEmail = normalizedValue.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
  if (!parsedEmail) return false;

  const candidateLocalPart = parsedEmail[1];
  const candidateDomain = parsedEmail[2];
  if (provider === GMAIL_PROVIDER) {
    if (!/^(?:gmail|googlemail)\.com$/i.test(candidateDomain)) {
      return false;
    }
    const parsedBaseEmail = parseManagedAliasBaseEmail(baseEmail, provider);
    if (!parsedBaseEmail) {
      return true;
    }
    return candidateDomain === parsedBaseEmail.domain
      && candidateLocalPart.split('+')[0] === parsedBaseEmail.localPart;
  }

  if (provider !== '2925' || candidateDomain !== '2925.com') {
    return false;
  }

  const parsedBaseEmail = parseManagedAliasBaseEmail(baseEmail, provider);
  if (!parsedBaseEmail) {
    return true;
  }

  return candidateLocalPart === parsedBaseEmail.localPart || candidateLocalPart.startsWith(parsedBaseEmail.localPart);
}

function getManagedAliasBaseEmail(state = {}, provider = state?.mailProvider) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const legacyEmailPrefix = String(state?.emailPrefix || '').trim();
  if (normalizedProvider === GMAIL_PROVIDER) {
    const gmailBaseEmail = String(state?.gmailBaseEmail || '').trim();
    if (gmailBaseEmail) {
      return gmailBaseEmail;
    }
    return parseManagedAliasBaseEmail(legacyEmailPrefix, normalizedProvider) ? legacyEmailPrefix : '';
  }

  if (normalizedProvider === '2925') {
    const currentAccount = Boolean(state?.mail2925UseAccountPool)
      ? getCurrentMail2925Account(state)
      : null;
    if (currentAccount?.email) {
      return currentAccount.email;
    }
    const mail2925BaseEmail = String(state?.mail2925BaseEmail || '').trim();
    if (mail2925BaseEmail) {
      return mail2925BaseEmail;
    }
    return parseManagedAliasBaseEmail(legacyEmailPrefix, normalizedProvider) ? legacyEmailPrefix : '';
  }

  return '';
}

function isGeneratedAliasProvider(stateOrProvider, mail2925Mode = undefined) {
  if (
    stateOrProvider
    && typeof stateOrProvider === 'object'
    && !Array.isArray(stateOrProvider)
    && normalizeEmailGenerator(stateOrProvider.emailGenerator) === (
      typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
        ? CUSTOM_EMAIL_POOL_GENERATOR
        : 'custom-pool'
    )
  ) {
    return false;
  }
  const provider = typeof stateOrProvider === 'string'
    ? stateOrProvider
    : stateOrProvider?.mailProvider;
  const resolvedMail2925Mode = mail2925Mode !== undefined
    ? normalizeMail2925Mode(mail2925Mode)
    : getMail2925Mode(stateOrProvider);
  const utils = getManagedAliasUtils();
  if (utils?.usesManagedAliasGeneration) {
    return utils.usesManagedAliasGeneration(provider, { mail2925Mode: resolvedMail2925Mode });
  }
  if (utils?.isManagedAliasProvider) {
    if (String(provider || '').trim().toLowerCase() === '2925') {
      return utils.isManagedAliasProvider(provider) && resolvedMail2925Mode === MAIL_2925_MODE_PROVIDE;
    }
    return utils.isManagedAliasProvider(provider);
  }
  return provider === GMAIL_PROVIDER
    || (provider === '2925' && resolvedMail2925Mode === MAIL_2925_MODE_PROVIDE);
}

function shouldUseCustomRegistrationEmail(state = {}) {
  return isCustomMailProvider(state)
    || (!isHotmailProvider(state)
      && !isGeneratedAliasProvider(state)
      && normalizeEmailGenerator(state.emailGenerator) === 'custom');
}

function isReusableGeneratedAliasEmail(state = {}, email = state?.email) {
  if (!isGeneratedAliasProvider(state)) {
    return false;
  }

  return isManagedAliasEmail(email, state?.mailProvider, getManagedAliasBaseEmail(state));
}

function buildGeneratedAliasEmail(state) {
  const provider = state.mailProvider || '163';
  const baseEmail = getManagedAliasBaseEmail(state, provider);
  const baseLabel = provider === GMAIL_PROVIDER ? 'Gmail 原邮箱' : '2925 基邮箱';
  const exampleEmail = provider === GMAIL_PROVIDER ? 'name@gmail.com' : 'name@2925.com';

  if (!baseEmail) {
    throw new Error(`${baseLabel}未设置，请先在侧边栏填写，或直接在“注册邮箱”中手动填写完整邮箱。`);
  }

  if (!parseManagedAliasBaseEmail(baseEmail, provider)) {
    throw new Error(`${baseLabel}格式不正确，请填写类似 ${exampleEmail} 的地址。`);
  }

  const utils = getManagedAliasUtils();
  if (utils?.buildManagedAliasEmail) {
    return utils.buildManagedAliasEmail(
      provider,
      baseEmail,
      provider === GMAIL_PROVIDER ? generateRandomWordAliasTag() : generateRandomSuffix(6)
    );
  }

  const parsedBaseEmail = parseManagedAliasBaseEmail(baseEmail, provider);
  if (provider === GMAIL_PROVIDER) {
    return `${parsedBaseEmail.localPart}+${generateRandomWordAliasTag()}@${parsedBaseEmail.domain}`;
  }
  if (provider === '2925') {
    return `${parsedBaseEmail.localPart}${generateRandomSuffix(6)}@${parsedBaseEmail.domain}`;
  }

  throw new Error(`未支持的别名邮箱类型：${provider}`);
}

function getLuckmailSessionConfig(state = {}) {
  return {
    apiKey: String(state.luckmailApiKey || ''),
    baseUrl: normalizeLuckmailBaseUrl(state.luckmailBaseUrl),
    emailType: normalizeLuckmailEmailType(state.luckmailEmailType),
    domain: String(state.luckmailDomain || '').trim(),
  };
}

function ensureLuckmailApiKey(state = {}) {
  const apiKey = String(state.luckmailApiKey || '').trim();
  if (!apiKey) {
    throw new Error('LuckMail API Key 为空，请先在侧边栏填写。');
  }
  return apiKey;
}

async function requestLuckmail(method, path, { baseUrl, apiKey, params, jsonData, timeout = 30000 } = {}) {
  const requestUrl = new URL(`${normalizeLuckmailBaseUrl(baseUrl)}${path}`);
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      requestUrl.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const headers = {
    Accept: 'application/json',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const upperMethod = String(method || 'GET').toUpperCase();
  const fetchOptions = {
    method: upperMethod,
    headers,
    signal: controller.signal,
  };
  if (jsonData !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(jsonData || {});
  }

  let response = null;
  try {
    response = await fetch(requestUrl.toString(), fetchOptions);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`LuckMail 请求超时：${path}`);
    }
    throw new Error(`LuckMail 请求失败：${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`LuckMail 返回了无法解析的响应：${path}`);
  }

  if (!response.ok) {
    const errorText = String(payload?.message || response.statusText || 'HTTP error');
    throw new Error(`LuckMail 请求失败：${errorText}`);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`LuckMail 返回数据无效：${path}`);
  }

  if (payload.code !== 0) {
    const errorText = String(payload.message || 'Unknown error');
    throw new Error(`LuckMail 接口返回失败：${errorText}`);
  }

  return payload.data;
}

function createLuckmailClient(state = {}) {
  const config = getLuckmailSessionConfig(state);
  const apiKey = ensureLuckmailApiKey(state);
  const request = (method, path, options = {}) => requestLuckmail(method, path, {
    baseUrl: config.baseUrl,
    apiKey,
    ...options,
  });

  return {
    user: {
      async purchaseEmails(projectCode, quantity, { emailType, domain } = {}) {
        const body = {
          project_code: projectCode,
          quantity,
          email_type: normalizeLuckmailEmailType(emailType),
        };
        if (domain) {
          body.domain = String(domain).trim();
        }
        return request('POST', '/api/v1/openapi/email/purchase', {
          jsonData: body,
        });
      },
      async getPurchases({ page = 1, pageSize = 100, projectId, tagId, keyword, userDisabled } = {}) {
        return normalizeLuckmailPurchaseListPage(await request('GET', '/api/v1/openapi/email/purchases', {
          params: {
            page,
            page_size: pageSize,
            project_id: projectId,
            tag_id: tagId,
            keyword,
            user_disabled: userDisabled,
          },
        }));
      },
      async getTokenCode(token) {
        return normalizeLuckmailTokenCode(await request(
          'GET',
          `/api/v1/openapi/email/token/${encodeURIComponent(token)}/code`
        ));
      },
      async checkTokenAlive(token) {
        const data = await request(
          'GET',
          `/api/v1/openapi/email/token/${encodeURIComponent(token)}/alive`
        );
        return {
          email_address: String(data?.email_address || ''),
          project: String(data?.project || ''),
          alive: Boolean(data?.alive),
          status: String(data?.status || ''),
          message: String(data?.message || ''),
          mail_count: Number(data?.mail_count) || 0,
        };
      },
      async getTokenMails(token) {
        const data = await request('GET', `/api/v1/openapi/email/token/${encodeURIComponent(token)}/mails`);
        return {
          email_address: String(data?.email_address || ''),
          project: String(data?.project || ''),
          warranty_until: String(data?.warranty_until || ''),
          mails: normalizeLuckmailTokenMails(data?.mails || []),
        };
      },
      async getTokenMailDetail(token, messageId) {
        return normalizeLuckmailTokenMail(await request(
          'GET',
          `/api/v1/openapi/email/token/${encodeURIComponent(token)}/mails/${encodeURIComponent(messageId)}`
        ));
      },
      async setPurchaseDisabled(purchaseId, disabled) {
        await request('PUT', `/api/v1/openapi/email/purchases/${encodeURIComponent(purchaseId)}/disabled`, {
          jsonData: {
            disabled: disabled ? 1 : 0,
          },
        });
      },
      async batchSetPurchaseDisabled(ids, disabled) {
        await request('POST', '/api/v1/openapi/email/purchases/batch-disabled', {
          jsonData: {
            ids: (Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
            disabled: disabled ? 1 : 0,
          },
        });
      },
      async setPurchaseTag(purchaseId, { tagId, tagName } = {}) {
        const body = {};
        if (tagId !== undefined) {
          body.tag_id = Number(tagId) || 0;
        }
        if (tagName !== undefined) {
          body.tag_name = String(tagName || '').trim();
        }
        await request('PUT', `/api/v1/openapi/email/purchases/${encodeURIComponent(purchaseId)}/tag`, {
          jsonData: body,
        });
      },
      async batchSetPurchaseTag(ids, { tagId, tagName } = {}) {
        const body = {
          ids: (Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
        };
        if (tagId !== undefined) {
          body.tag_id = Number(tagId) || 0;
        }
        if (tagName !== undefined) {
          body.tag_name = String(tagName || '').trim();
        }
        await request('POST', '/api/v1/openapi/email/purchases/batch-tag', {
          jsonData: body,
        });
      },
      async getTags() {
        return normalizeLuckmailTags(await request('GET', '/api/v1/openapi/email/tags'));
      },
      async createTag(name, limitType, remark) {
        const body = {
          name: String(name || '').trim(),
          limit_type: Number(limitType) || 0,
        };
        if (remark !== undefined) {
          body.remark = String(remark || '').trim();
        }
        return normalizeLuckmailTags([await request('POST', '/api/v1/openapi/email/tags', {
          jsonData: body,
        })])[0] || null;
      },
    },
  };
}

function getCurrentLuckmailPurchase(state = {}) {
  return state.currentLuckmailPurchase
    ? normalizeLuckmailPurchase(state.currentLuckmailPurchase)
    : null;
}

function buildLuckmailPurchaseView(purchase, state = {}) {
  const normalizedPurchase = normalizeLuckmailPurchase(purchase);
  const usedPurchases = getLuckmailUsedPurchases(state);
  const preserveTagInfo = getLuckmailPreserveTagInfo(state);

  return {
    id: normalizedPurchase.id,
    email_address: normalizedPurchase.email_address,
    project_name: normalizeLuckmailProjectName(normalizedPurchase.project_name) || DEFAULT_LUCKMAIL_PROJECT_CODE,
    price: normalizedPurchase.price,
    status: normalizedPurchase.status,
    tag_id: normalizedPurchase.tag_id,
    tag_name: normalizedPurchase.tag_name,
    user_disabled: normalizedPurchase.user_disabled,
    warranty_hours: normalizedPurchase.warranty_hours,
    warranty_until: normalizedPurchase.warranty_until,
    created_at: normalizedPurchase.created_at,
    used: Boolean(usedPurchases[normalizeLuckmailPurchaseId(normalizedPurchase.id)]),
    preserved: isLuckmailPurchasePreserved(normalizedPurchase, {
      preserveTagId: preserveTagInfo.id,
      preserveTagName: preserveTagInfo.name,
    }),
    disabled: normalizedPurchase.user_disabled === 1,
    current: Number(getCurrentLuckmailPurchase(state)?.id) === normalizedPurchase.id,
    reusable: isLuckmailPurchaseReusable(normalizedPurchase, {
      projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
      usedPurchases,
      preserveTagId: preserveTagInfo.id,
      preserveTagName: preserveTagInfo.name,
      now: Date.now(),
    }),
  };
}

async function getAllLuckmailPurchases(state, options = {}) {
  const client = options.client || createLuckmailClient(state);
  const pageSize = Math.max(1, Math.min(100, Number(options.pageSize) || 100));
  const maxPages = Math.max(1, Number(options.maxPages) || 50);
  const purchases = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const pageResult = await client.user.getPurchases({
      page,
      pageSize,
      keyword: options.keyword,
      projectId: options.projectId,
      tagId: options.tagId,
      userDisabled: options.userDisabled,
    });
    const normalizedPage = normalizeLuckmailPurchaseListPage(pageResult);
    purchases.push(...normalizedPage.list);

    if (normalizedPage.list.length === 0) {
      break;
    }
    if (normalizedPage.total > 0 && purchases.length >= normalizedPage.total) {
      break;
    }
    if (normalizedPage.list.length < normalizedPage.page_size) {
      break;
    }
  }

  return purchases;
}

async function listLuckmailPurchasesByProject(state, options = {}) {
  const projectCode = normalizeLuckmailProjectName(options.projectCode || DEFAULT_LUCKMAIL_PROJECT_CODE)
    || DEFAULT_LUCKMAIL_PROJECT_CODE;
  const purchases = await getAllLuckmailPurchases(state, options);
  return purchases.filter((purchase) => isLuckmailPurchaseForProject(purchase, projectCode));
}

async function getLuckmailPurchaseById(state, purchaseId, options = {}) {
  const normalizedPurchaseId = Number(normalizeLuckmailPurchaseId(purchaseId)) || 0;
  if (!normalizedPurchaseId) {
    throw new Error('LuckMail 邮箱 ID 无效。');
  }

  const purchases = await listLuckmailPurchasesByProject(state, options);
  const purchase = purchases.find((item) => item.id === normalizedPurchaseId) || null;
  if (!purchase) {
    throw new Error(`未找到 ID=${normalizedPurchaseId} 的 openai LuckMail 邮箱。`);
  }
  return purchase;
}

async function listLuckmailPurchasesForManagement() {
  const state = await getState();
  const purchases = await listLuckmailPurchasesByProject(state, {
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });
  return purchases.map((purchase) => buildLuckmailPurchaseView(purchase, state));
}

async function ensureLuckmailPreserveTag(client, state = null) {
  const resolvedState = state || await getState();
  const preserveTagInfo = getLuckmailPreserveTagInfo(resolvedState);
  if (preserveTagInfo.id > 0) {
    return preserveTagInfo;
  }

  const tags = normalizeLuckmailTags(await client.user.getTags());
  let preserveTag = tags.find(
    (tag) => normalizeLuckmailProjectName(tag.name) === normalizeLuckmailProjectName(preserveTagInfo.name)
  ) || null;

  if (!preserveTag) {
    preserveTag = await client.user.createTag(
      DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
      0,
      '保留邮箱（不参与自动复用）'
    );
  }

  await setLuckmailPreserveTagInfo(preserveTag);
  return {
    id: Number(preserveTag?.id) || 0,
    name: String(preserveTag?.name || '').trim() || DEFAULT_LUCKMAIL_PRESERVE_TAG_NAME,
  };
}

async function activateLuckmailPurchaseForFlow(state, client, purchase, options = {}) {
  const normalizedPurchase = normalizeLuckmailPurchase(purchase);
  if (!normalizedPurchase?.email_address || !normalizedPurchase?.token) {
    throw new Error('LuckMail 邮箱缺少 email/token，无法用于当前流程。');
  }

  let baselineCursor = null;
  if (options.initializeCursor !== false) {
    const mailList = await client.user.getTokenMails(normalizedPurchase.token);
    baselineCursor = buildLuckmailBaselineCursor(mailList?.mails || []);
  }

  await setLuckmailPurchaseState(normalizedPurchase);
  await setLuckmailMailCursorState(baselineCursor);
  await setEmailState(normalizedPurchase.email_address);

  if (options.logMessage) {
    await addLog(options.logMessage, options.logLevel || 'ok');
  }

  return normalizedPurchase;
}

async function findReusableLuckmailPurchaseForFlow(state, client) {
  const preserveTagInfo = getLuckmailPreserveTagInfo(state);
  const reusablePurchases = filterReusableLuckmailPurchases(
    await listLuckmailPurchasesByProject(state, {
      client,
      projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
    }),
    {
      projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
      usedPurchases: getLuckmailUsedPurchases(state),
      preserveTagId: preserveTagInfo.id,
      preserveTagName: preserveTagInfo.name,
      now: Date.now(),
    }
  );

  for (const candidate of reusablePurchases) {
    try {
      const aliveResult = await client.user.checkTokenAlive(candidate.token);
      if (!aliveResult?.alive) {
        await addLog(
          `LuckMail：跳过不可复用邮箱 ${candidate.email_address}：${aliveResult?.message || aliveResult?.status || 'token 不可用'}`,
          'warn'
        );
        continue;
      }
      return candidate;
    } catch (err) {
      await addLog(`LuckMail：检测复用邮箱 ${candidate.email_address} 失败：${err.message}`, 'warn');
    }
  }

  return null;
}

async function selectLuckmailPurchase(purchaseId) {
  const state = await ensureManualInteractionAllowed('切换 LuckMail 邮箱');
  const client = createLuckmailClient(state);
  const purchase = await getLuckmailPurchaseById(state, purchaseId, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });

  if (purchase.user_disabled === 1) {
    throw new Error(`LuckMail 邮箱 ${purchase.email_address} 已禁用，无法使用。`);
  }

  const aliveResult = await client.user.checkTokenAlive(purchase.token);
  if (!aliveResult?.alive) {
    throw new Error(`LuckMail 邮箱 ${purchase.email_address} 当前不可用：${aliveResult?.message || aliveResult?.status || 'token 已失效'}`);
  }

  const activatedPurchase = await activateLuckmailPurchaseForFlow(state, client, purchase, {
    initializeCursor: true,
    logMessage: `LuckMail：已切换当前邮箱为 ${purchase.email_address}`,
  });
  const nextState = await getState();
  return buildLuckmailPurchaseView(activatedPurchase, nextState);
}

async function setLuckmailPurchasePreservedState(purchaseId, preserved) {
  const state = await ensureManualInteractionAllowed('设置 LuckMail 邮箱保留状态');
  const client = createLuckmailClient(state);
  const purchase = await getLuckmailPurchaseById(state, purchaseId, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });

  if (preserved) {
    const preserveTag = await ensureLuckmailPreserveTag(client, state);
    await client.user.setPurchaseTag(purchase.id, { tagId: preserveTag.id });
  } else {
    await client.user.setPurchaseTag(purchase.id, { tagId: 0 });
  }

  await addLog(`LuckMail：已将 ${purchase.email_address} ${preserved ? '设为保留' : '取消保留'}`, 'ok');
  const refreshedState = await getState();
  const refreshedPurchase = await getLuckmailPurchaseById(refreshedState, purchase.id, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });
  return buildLuckmailPurchaseView(refreshedPurchase, await getState());
}

async function setLuckmailPurchaseDisabledState(purchaseId, disabled) {
  const state = await ensureManualInteractionAllowed(disabled ? '禁用 LuckMail 邮箱' : '启用 LuckMail 邮箱');
  const client = createLuckmailClient(state);
  const purchase = await getLuckmailPurchaseById(state, purchaseId, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });

  await client.user.setPurchaseDisabled(purchase.id, disabled ? 1 : 0);

  const currentPurchase = getCurrentLuckmailPurchase(await getState());
  if (disabled && currentPurchase?.id === purchase.id) {
    await clearLuckmailRuntimeState({ clearEmail: isLuckmailProvider(await getState()) });
  }

  await addLog(`LuckMail：已将 ${purchase.email_address} ${disabled ? '禁用' : '启用'}`, 'ok');
  const refreshedState = await getState();
  const refreshedPurchase = await getLuckmailPurchaseById(refreshedState, purchase.id, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });
  return buildLuckmailPurchaseView(refreshedPurchase, await getState());
}

async function batchUpdateLuckmailPurchases(input = {}) {
  const action = String(input.action || '').trim();
  const selectedIds = Array.isArray(input.ids)
    ? [...new Set(input.ids.map((id) => Number(normalizeLuckmailPurchaseId(id)) || 0).filter((id) => id > 0))]
    : [];
  if (!selectedIds.length) {
    throw new Error('请先选择至少一个 LuckMail 邮箱。');
  }

  const state = await ensureManualInteractionAllowed('批量更新 LuckMail 邮箱');
  const client = createLuckmailClient(state);
  const purchases = await listLuckmailPurchasesByProject(state, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });
  const purchaseMap = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const targetPurchases = selectedIds.map((id) => purchaseMap.get(id)).filter(Boolean);

  if (!targetPurchases.length) {
    throw new Error('未找到可批量处理的 openai LuckMail 邮箱。');
  }

  const targetIds = targetPurchases.map((purchase) => purchase.id);

  if (action === 'used' || action === 'unused') {
    const nextUsedState = getLuckmailUsedPurchases(state);
    targetIds.forEach((id) => {
      const key = normalizeLuckmailPurchaseId(id);
      if (!key) return;
      if (action === 'used') {
        nextUsedState[key] = true;
      } else {
        delete nextUsedState[key];
      }
    });
    await setLuckmailUsedPurchasesState(nextUsedState);
    await addLog(`LuckMail：已批量${action === 'used' ? '标记已用' : '标记未用'} ${targetIds.length} 个邮箱`, 'ok');
  } else if (action === 'preserve' || action === 'unpreserve') {
    if (action === 'preserve') {
      const preserveTag = await ensureLuckmailPreserveTag(client, state);
      await client.user.batchSetPurchaseTag(targetIds, { tagId: preserveTag.id });
    } else {
      await client.user.batchSetPurchaseTag(targetIds, { tagId: 0 });
    }
    await addLog(`LuckMail：已批量${action === 'preserve' ? '保留' : '取消保留'} ${targetIds.length} 个邮箱`, 'ok');
  } else if (action === 'disable' || action === 'enable') {
    await client.user.batchSetPurchaseDisabled(targetIds, action === 'disable' ? 1 : 0);
    const currentPurchase = getCurrentLuckmailPurchase(await getState());
    if (action === 'disable' && currentPurchase?.id && targetIds.includes(currentPurchase.id)) {
      await clearLuckmailRuntimeState({ clearEmail: isLuckmailProvider(await getState()) });
    }
    await addLog(`LuckMail：已批量${action === 'disable' ? '禁用' : '启用'} ${targetIds.length} 个邮箱`, 'ok');
  } else {
    throw new Error(`不支持的 LuckMail 批量操作：${action}`);
  }

  return {
    updatedIds: targetIds,
  };
}

async function disableUsedLuckmailPurchases() {
  const state = await ensureManualInteractionAllowed('禁用已用 LuckMail 邮箱');
  const usedPurchases = getLuckmailUsedPurchases(state);
  const preserveTagInfo = getLuckmailPreserveTagInfo(state);
  const client = createLuckmailClient(state);
  const purchases = await listLuckmailPurchasesByProject(state, {
    client,
    projectCode: DEFAULT_LUCKMAIL_PROJECT_CODE,
  });
  const targets = purchases.filter((purchase) => {
    const purchaseId = normalizeLuckmailPurchaseId(purchase.id);
    return Boolean(purchaseId && usedPurchases[purchaseId])
      && !isLuckmailPurchasePreserved(purchase, {
        preserveTagId: preserveTagInfo.id,
        preserveTagName: preserveTagInfo.name,
      })
      && purchase.user_disabled !== 1;
  });

  if (!targets.length) {
    return { disabledIds: [] };
  }

  const targetIds = targets.map((purchase) => purchase.id);
  await client.user.batchSetPurchaseDisabled(targetIds, 1);
  const currentPurchase = getCurrentLuckmailPurchase(await getState());
  if (currentPurchase?.id && targetIds.includes(currentPurchase.id)) {
    await clearLuckmailRuntimeState({ clearEmail: isLuckmailProvider(await getState()) });
  }
  await addLog(`LuckMail：已禁用 ${targetIds.length} 个本地已用邮箱`, 'ok');
  return { disabledIds: targetIds };
}

async function ensureLuckmailPurchaseForFlow(options = {}) {
  const { allowReuse = true } = options;
  const state = await getState();
  const existingPurchase = getCurrentLuckmailPurchase(state);
  if (allowReuse && existingPurchase?.email_address && existingPurchase?.token) {
    if (state.email !== existingPurchase.email_address) {
      await setEmailState(existingPurchase.email_address);
    }
    return existingPurchase;
  }

  const config = getLuckmailSessionConfig(state);
  const client = createLuckmailClient(state);
  if (allowReuse) {
    const reusablePurchase = await findReusableLuckmailPurchaseForFlow(state, client);
    if (reusablePurchase) {
      return activateLuckmailPurchaseForFlow(state, client, reusablePurchase, {
        initializeCursor: true,
        logMessage: `LuckMail：已复用 openai 邮箱 ${reusablePurchase.email_address}`,
      });
    }
  }

  const result = await client.user.purchaseEmails(DEFAULT_LUCKMAIL_PROJECT_CODE, 1, {
    emailType: config.emailType,
    domain: config.domain || undefined,
  });
  const purchases = normalizeLuckmailPurchases(result);
  const purchase = purchases[0] || null;
  if (!purchase?.email_address || !purchase?.token) {
    throw new Error('LuckMail 购邮成功，但未返回可用邮箱或 token。');
  }

  return activateLuckmailPurchaseForFlow(state, client, purchase, {
    initializeCursor: false,
    logMessage: `LuckMail：已购买邮箱 ${purchase.email_address}（类型：${config.emailType}，项目：${DEFAULT_LUCKMAIL_PROJECT_CODE}）`,
  });
}

async function resolveLuckmailVerificationMail(client, token, filters = {}, tokenCodeResult = null) {
  const tokenCode = tokenCodeResult ? normalizeLuckmailTokenCode(tokenCodeResult) : null;
  if (tokenCode?.mail) {
    const tokenMail = tokenCode.verification_code && !tokenCode.mail.verification_code
      ? {
        ...tokenCode.mail,
        verification_code: tokenCode.verification_code,
      }
      : tokenCode.mail;
    const inlineMatch = pickLuckmailVerificationMail([tokenMail], filters);
    if (inlineMatch) {
      return inlineMatch;
    }
  }

  const mailList = await client.user.getTokenMails(token);
  let match = pickLuckmailVerificationMail(mailList.mails, filters);
  if (match?.mail?.message_id && !match.mail.verification_code) {
    const detail = await client.user.getTokenMailDetail(token, match.mail.message_id);
    match = pickLuckmailVerificationMail([detail], filters);
  }
  return match || null;
}

async function legacyPollLuckmailVerificationCode(step, state, pollPayload = {}) {
  const purchase = getCurrentLuckmailPurchase(state);
  if (!purchase?.token) {
    throw new Error('LuckMail 当前没有可用 token，请先执行步骤 3 购买邮箱。');
  }

  const client = createLuckmailClient(state);
  const maxAttempts = Math.max(1, Number(pollPayload.maxAttempts) || 3);
  const intervalMs = Math.max(15000, Number(pollPayload.intervalMs) || 15000);
  const excludedCodes = new Set((pollPayload.excludeCodes || []).filter(Boolean));

  const initialCursor = normalizeLuckmailMailCursor((await getState()).currentLuckmailMailCursor);
  if (!initialCursor.messageId && !initialCursor.receivedAt) {
    const mailList = await client.user.getTokenMails(purchase.token);
    const baselineCursor = buildLuckmailBaselineCursor(mailList?.mails || []);
    await setLuckmailMailCursorState(baselineCursor);
    if (baselineCursor?.messageId || baselineCursor?.receivedAt) {
      await addLog(`步骤 ${step}：LuckMail 已保存当前邮箱旧邮件快照，后续仅使用新收到的验证码。`, 'info');
    }
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfStopped();
    await addLog(`步骤 ${step}：正在通过 LuckMail 轮询验证码（${attempt}/${maxAttempts}）...`, 'info');

    try {
      const tokenCode = await client.user.getTokenCode(purchase.token);
      const cursor = normalizeLuckmailMailCursor((await getState()).currentLuckmailMailCursor);
      if (tokenCode.verification_code && tokenCode.mail && !isLuckmailMailNewerThanCursor(tokenCode.mail, cursor)) {
        throw new Error(`步骤 ${step}：LuckMail 返回的最新邮件仍是旧验证码。`);
      }

      let match = null;
      if (tokenCode.has_new_mail || tokenCode.verification_code) {
        match = await resolveLuckmailVerificationMail(client, purchase.token, filters, tokenCode);
      }
      if (!match) {
        match = await resolveLuckmailVerificationMail(client, purchase.token, filters, null);
      }

      if (match?.mail) {
        const cursor = normalizeLuckmailMailCursor((await getState()).currentLuckmailMailCursor);
        if (!isLuckmailMailNewerThanCursor(match.mail, cursor)) {
          throw new Error(`步骤 ${step}：LuckMail 命中的邮件不是新邮件。`);
        }

        await setLuckmailMailCursorState(buildLuckmailMailCursor(match.mail));
        return {
          ok: true,
          code: match.code,
          emailTimestamp: normalizeLuckmailTimestamp(match.mail.received_at) || Date.now(),
          mailId: match.mail.message_id,
        };
      }

      lastError = new Error(`步骤 ${step}：暂未在 LuckMail 邮箱中找到新的匹配验证码。`);
    } catch (err) {
      if (isStopError(err)) {
        throw err;
      }
      lastError = err;
      await addLog(`步骤 ${step}：LuckMail 轮询失败：${err.message}`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleepWithStop(intervalMs);
    }
  }

  throw lastError || new Error(`步骤 ${step}：未在 LuckMail 邮箱中找到新的匹配验证码。`);
}

async function pollLuckmailVerificationCode(step, state, pollPayload = {}) {
  const purchase = getCurrentLuckmailPurchase(state);
  if (!purchase?.token) {
    throw new Error('LuckMail 当前没有可用 token，请先执行步骤 3 购买邮箱。');
  }

  const client = createLuckmailClient(state);
  const maxAttempts = Math.max(1, Number(pollPayload.maxAttempts) || 3);
  const intervalMs = Math.max(15000, Number(pollPayload.intervalMs) || 15000);
  const excludedCodes = new Set((pollPayload.excludeCodes || []).filter(Boolean));

  const initialCursor = normalizeLuckmailMailCursor((await getState()).currentLuckmailMailCursor);
  if (!initialCursor.messageId && !initialCursor.receivedAt) {
    const mailList = await client.user.getTokenMails(purchase.token);
    const baselineCursor = buildLuckmailBaselineCursor(mailList?.mails || []);
    await setLuckmailMailCursorState(baselineCursor);
    if (baselineCursor?.messageId || baselineCursor?.receivedAt) {
      await addLog(`步骤 ${step}：LuckMail 已保存当前邮箱旧邮件快照，后续仅使用新收到的验证码。`, 'info');
    }
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    throwIfStopped();
    await addLog(`步骤 ${step}：正在通过 LuckMail /code 接口轮询验证码（${attempt}/${maxAttempts}）...`, 'info');

    try {
      const tokenCode = await client.user.getTokenCode(purchase.token);
      const remoteEmail = String(tokenCode?.email_address || '').trim().toLowerCase();
      const expectedEmail = String(purchase.email_address || state?.email || '').trim().toLowerCase();
      if (remoteEmail && expectedEmail && remoteEmail !== expectedEmail) {
        throw new Error(`步骤 ${step}：LuckMail token 对应邮箱与当前邮箱不一致。当前邮箱：${expectedEmail}；token 邮箱：${remoteEmail}`);
      }

      const tokenMail = tokenCode.verification_code && tokenCode.mail && !tokenCode.mail.verification_code
        ? {
          ...tokenCode.mail,
          verification_code: tokenCode.verification_code,
        }
        : tokenCode.mail;
      const code = String(tokenCode?.verification_code || tokenMail?.verification_code || '').trim();
      const cursor = normalizeLuckmailMailCursor((await getState()).currentLuckmailMailCursor);

      if (!code || !tokenMail) {
        lastError = new Error(`步骤 ${step}：LuckMail /code 接口暂未返回新的验证码。`);
      } else if (excludedCodes.has(code)) {
        lastError = new Error(`步骤 ${step}：LuckMail 返回的验证码 ${code} 已试过，等待 15 秒后再次轮询。`);
      } else if (!isLuckmailMailNewerThanCursor(tokenMail, cursor)) {
        lastError = new Error(`步骤 ${step}：LuckMail /code 返回的最新邮件仍是旧验证码。`);
      } else {
        await setLuckmailMailCursorState(buildLuckmailMailCursor(tokenMail));
        return {
          ok: true,
          code,
          emailTimestamp: normalizeLuckmailTimestamp(tokenMail.received_at) || Date.now(),
          mailId: tokenMail.message_id,
        };
      }
    } catch (err) {
      if (isStopError(err)) {
        throw err;
      }
      lastError = err;
      await addLog(`步骤 ${step}：LuckMail /code 轮询失败：${err.message}`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleepWithStop(intervalMs);
    }
  }

  throw lastError || new Error(`步骤 ${step}：未在 LuckMail /code 接口中获取到新的验证码。`);
}

function summarizeCloudflareTempEmailMessagesForLog(messages) {
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

async function deleteCloudflareTempEmailMail(config, mailId) {
  const normalizedMailId = String(mailId || '').trim();
  if (!normalizedMailId) return false;

  await requestCloudflareTempEmailJson(config, `/admin/mails/${encodeURIComponent(normalizedMailId)}`, {
    method: 'DELETE',
  });
  return true;
}

async function listCloudflareTempEmailMessages(state, options = {}) {
  const config = ensureCloudflareTempEmailConfig(state, { requireAdminAuth: true });
  const address = normalizeCloudflareTempEmailAddress(options.address);
  const payload = await requestCloudflareTempEmailJson(config, '/admin/mails', {
    method: 'GET',
    searchParams: {
      limit: Number(options.limit) || CLOUDFLARE_TEMP_EMAIL_DEFAULT_PAGE_SIZE,
      offset: Number(options.offset) || 0,
      address,
    },
  });

  const messages = normalizeCloudflareTempEmailMailApiMessages(payload).filter((message) => {
    if (!address) return true;
    return !message.address || normalizeCloudflareTempEmailAddress(message.address) === address;
  });

  return { config, messages };
}

async function pollCloudflareTempEmailVerificationCode(step, state, pollPayload = {}) {
  const config = ensureCloudflareTempEmailConfig(state, { requireAdminAuth: true });
  const targetEmail = resolveCloudflareTempEmailPollTargetEmail(state, pollPayload, config);
  const registrationEmail = normalizeCloudflareTempEmailReceiveMailbox(state.email);
  if (!targetEmail) {
    throw new Error('Cloudflare Temp Email 轮询前缺少目标邮箱地址，请先填写注册邮箱或“邮件接收”邮箱。');
  }

  if (registrationEmail && registrationEmail !== targetEmail) {
    await addLog(`步骤 ${step}：正在轮询 Cloudflare Temp Email 收件邮箱（${targetEmail}），注册邮箱为 ${registrationEmail}...`, 'info');
  } else {
    await addLog(`步骤 ${step}：正在轮询 Cloudflare Temp Email 邮件（${targetEmail}）...`, 'info');
  }
  const maxAttempts = Number(pollPayload.maxAttempts) || 5;
  const intervalMs = Number(pollPayload.intervalMs) || 3000;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfStopped();
    try {
      const { messages } = await listCloudflareTempEmailMessages(state, {
        address: targetEmail,
        limit: pollPayload.limit || CLOUDFLARE_TEMP_EMAIL_DEFAULT_PAGE_SIZE,
        offset: pollPayload.offset || 0,
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
          await addLog(`步骤 ${step}：严格规则未命中，已改用 ${fallbackLabel} 并命中 Cloudflare Temp Email 验证码。`, 'warn');
        }
        try {
          await deleteCloudflareTempEmailMail(config, match.message?.id);
        } catch (err) {
          await addLog(`步骤 ${step}：删除 Cloudflare Temp Email 邮件失败：${err.message}`, 'warn');
        }
        return {
          ok: true,
          code: match.code,
          emailTimestamp: match.receivedAt || Date.now(),
          mailId: match.message?.id || '',
        };
      }

      lastError = new Error(`步骤 ${step}：暂未在 Cloudflare Temp Email 中找到匹配验证码（${attempt}/${maxAttempts}）。`);
      await addLog(lastError.message, attempt === maxAttempts ? 'warn' : 'info');
      const sample = summarizeCloudflareTempEmailMessagesForLog(messages);
      if (sample) {
        await addLog(`步骤 ${step}：最近邮件样本：${sample}`, 'info');
      }
    } catch (err) {
      lastError = err;
      await addLog(`步骤 ${step}：Cloudflare Temp Email 轮询失败：${err.message}`, 'warn');
    }

    if (attempt < maxAttempts) {
      await sleepWithStop(intervalMs);
    }
  }

  throw lastError || new Error(`步骤 ${step}：未在 Cloudflare Temp Email 中找到新的匹配验证码。`);
}

async function getOpenIcloudHostPreference() {
  try {
    const tabs = await chrome.tabs.query({
      url: ICLOUD_TAB_URL_PATTERNS,
    });

    const activeTab = tabs.find((tab) => tab.active);
    const candidates = activeTab ? [activeTab, ...tabs.filter((tab) => tab.id !== activeTab.id)] : tabs;
    for (const tab of candidates) {
      try {
        const host = normalizeIcloudHost(new URL(tab.url).host);
        if (host) return host;
      } catch {}
    }
  } catch {}

  return '';
}

async function getPreferredIcloudLoginUrl(error = null, state = null) {
  const currentState = state || await getState();
  const configuredHost = getConfiguredIcloudHostPreference(currentState);
  if (configuredHost) {
    return getIcloudLoginUrlForHost(configuredHost);
  }

  const openHost = await getOpenIcloudHostPreference();
  if (openHost) {
    return getIcloudLoginUrlForHost(openHost);
  }

  const savedHost = normalizeIcloudHost(currentState?.preferredIcloudHost);
  if (savedHost) {
    return getIcloudLoginUrlForHost(savedHost);
  }

  const messageHint = getIcloudHostHintFromMessage(getErrorMessage(error));
  if (messageHint) {
    return getIcloudLoginUrlForHost(messageHint);
  }

  return getIcloudLoginUrlForHost('icloud.com') || ICLOUD_LOGIN_URLS[0];
}

async function getPreferredIcloudSetupUrls(state = null, error = null) {
  const currentState = state || await getState();
  const configuredHost = getConfiguredIcloudHostPreference(currentState);
  if (configuredHost) {
    const forcedSetupUrl = getIcloudSetupUrlForHost(configuredHost);
    if (forcedSetupUrl) {
      return [forcedSetupUrl];
    }
  }
  const preferredLoginUrl = await getPreferredIcloudLoginUrl(error, state);
  const preferredHost = normalizeIcloudHost(new URL(preferredLoginUrl).host);
  const preferredSetupUrl = getIcloudSetupUrlForHost(preferredHost);
  if (!preferredSetupUrl) {
    return [...ICLOUD_SETUP_URLS];
  }
  return [
    preferredSetupUrl,
    ...ICLOUD_SETUP_URLS.filter((url) => url !== preferredSetupUrl),
  ];
}

function isIcloudLoginRequiredError(error) {
  const message = getErrorMessage(error).toLowerCase();
  const hasAuthStatus401 = /\bstatus 401\b/.test(message);
  const hasAuthStatus403 = /\bstatus 403\b/.test(message);
  const hasTransientStatus = /\bstatus (409|421|429|5\d\d)\b/.test(message);
  const hasTransientNetworkHint = message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('cors')
    || message.includes('address space');
  const hasExplicitLoginHint = message.includes('please sign in')
    || message.includes('sign in required')
    || message.includes('not logged in')
    || message.includes('login required')
    || message.includes('re-authentication required')
    || message.includes('unauthenticated')
    || message.includes('authentication required')
    || message.includes('需要先登录')
    || message.includes('请先登录');
  const hasSelfPromptHint = message.includes('请先在新打开的 icloud 页面中完成登录')
    || message.includes('请先在当前浏览器登录');
  const hasAuthStatusWithExplicitLoginHint = (hasAuthStatus401 || hasAuthStatus403)
    && hasExplicitLoginHint;

  // Keep transient validate/network/cors errors out of login-required path.
  if (message.includes('could not validate icloud session')) {
    return false;
  }
  if (message.includes('page_context:')) {
    return false;
  }
  if (hasSelfPromptHint) {
    return false;
  }
  if (hasTransientStatus || hasTransientNetworkHint) {
    return false;
  }

  if (hasAuthStatusWithExplicitLoginHint) {
    return true;
  }

  if (hasExplicitLoginHint) {
    return true;
  }

  return false;
}

function isIcloudTransientContextError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return /\bstatus (401|403|409|421|429|5\d\d)\b/.test(message)
    || message.includes('could not validate icloud session')
    || message.includes('page_context:')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('cors')
    || message.includes('address space')
    || message.includes('timeout')
    || message.includes('timed out');
}

let lastIcloudLoginPromptAt = 0;
const activeIcloudRequestControllers = new Set();
let lastResolvedIcloudServiceUrl = '';
const icloudTransientLogThrottle = new Map();

function shouldEmitIcloudTransientLog(key, windowMs = 1500) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) {
    return true;
  }
  const now = Date.now();
  const lastAt = Number(icloudTransientLogThrottle.get(normalizedKey) || 0);
  if (now - lastAt < Math.max(200, Number(windowMs) || 1500)) {
    return false;
  }
  icloudTransientLogThrottle.set(normalizedKey, now);
  return true;
}

async function openIcloudLoginPage(preferredUrl) {
  const tabs = await chrome.tabs.query({
    url: ICLOUD_TAB_URL_PATTERNS,
  });
  const preferredHost = new URL(preferredUrl).host;
  const preferredIcloudHost = normalizeIcloudHost(preferredHost);
  const existingSameHost = tabs.find((tab) => {
    try {
      return normalizeIcloudHost(new URL(tab.url).host) === preferredIcloudHost;
    } catch {
      return false;
    }
  });
  const existingAnyIcloudTab = tabs.find((tab) => Number.isInteger(tab?.id));

  if (existingSameHost?.id) {
    await chrome.tabs.update(existingSameHost.id, { active: true });
    return existingSameHost.id;
  }

  if (existingAnyIcloudTab?.id) {
    await chrome.tabs.update(existingAnyIcloudTab.id, { active: true });
    return existingAnyIcloudTab.id;
  }

  const created = await chrome.tabs.create({ url: preferredUrl, active: true });
  return created.id;
}

async function promptIcloudLogin(error, actionLabel = 'iCloud 操作') {
  const now = Date.now();
  const preferredUrl = await getPreferredIcloudLoginUrl(error);
  const originalError = getErrorMessage(error);

  chrome.runtime.sendMessage({
    type: 'ICLOUD_LOGIN_REQUIRED',
    payload: {
      actionLabel,
      loginUrl: preferredUrl,
      message: '需要先登录 iCloud，我已经为你打开登录页。',
      detail: originalError,
    },
  }).catch(() => { });

  if (now - lastIcloudLoginPromptAt < 15000) {
    return;
  }
  lastIcloudLoginPromptAt = now;

  await addLog(`iCloud：${actionLabel}时需要登录，正在打开 ${new URL(preferredUrl).host} ...`, 'warn');

  try {
    await openIcloudLoginPage(preferredUrl);
  } catch (tabErr) {
    await addLog(`iCloud：自动打开登录页失败：${getErrorMessage(tabErr)}`, 'warn');
  }
}

async function withIcloudLoginHelp(actionLabel, action) {
  const safeActionLabel = String(actionLabel || 'iCloud 操作').trim() || 'iCloud 操作';
  const maxTransientAttempts = Math.max(1, Number(ICLOUD_TRANSIENT_RETRY_MAX_ATTEMPTS) || 1);
  const retryDelayMs = Math.max(300, Number(ICLOUD_TRANSIENT_RETRY_DELAY_MS) || 1200);
  for (let attempt = 1; attempt <= maxTransientAttempts; attempt += 1) {
    try {
      return await action();
    } catch (err) {
      if (isIcloudLoginRequiredError(err)) {
        await promptIcloudLogin(err, actionLabel);
        throw new Error('请先在新打开的 iCloud 页面中完成登录，再回来点击“我已登录”。');
      }
      if (isIcloudTransientContextError(err)) {
        if (attempt < maxTransientAttempts) {
          if (shouldEmitIcloudTransientLog(`${safeActionLabel}:retry:${attempt}/${maxTransientAttempts}`)) {
            await addLog(`iCloud：${safeActionLabel}受网络/上下文波动影响，正在重试（${attempt}/${maxTransientAttempts}）...`, 'warn');
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
        if (shouldEmitIcloudTransientLog(`${safeActionLabel}:final`)) {
          await addLog(`iCloud：${safeActionLabel}受网络/上下文波动影响：${getErrorMessage(err)}`, 'warn');
        }
        const transientError = new Error(`iCloud：${safeActionLabel}受网络/上下文波动影响，请稍后重试。`);
        transientError.code = 'ICLOUD_TRANSIENT_CONTEXT';
        transientError.actionLabel = safeActionLabel;
        transientError.cause = err;
        throw transientError;
      }
      throw err;
    }
  }
  throw new Error('iCloud 操作失败：未知错误。');
}

function isIcloudApiUrl(url = '') {
  const rawUrl = String(url || '').trim();
  if (!rawUrl) {
    return false;
  }
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    const hostname = String(parsedUrl.hostname || '').trim().toLowerCase().replace(/\.$/, '');
    if (!hostname) {
      return false;
    }
    return hostname === 'icloud.com'
      || hostname.endsWith('.icloud.com')
      || hostname === 'icloud.com.cn'
      || hostname.endsWith('.icloud.com.cn');
  } catch {
    return false;
  }
}

function normalizeIcloudServiceUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return '';
  }
  try {
    const parsedUrl = new URL(value);
    if ((parsedUrl.protocol === 'https:' && parsedUrl.port === '443')
      || (parsedUrl.protocol === 'http:' && parsedUrl.port === '80')) {
      parsedUrl.port = '';
    }
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

function rememberIcloudServiceUrl(rawUrl = '') {
  const normalized = normalizeIcloudServiceUrl(rawUrl);
  if (normalized) {
    lastResolvedIcloudServiceUrl = normalized;
  }
  return normalized;
}

function isIcloudMaildomainwsHost(rawHost = '') {
  const host = String(rawHost || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) {
    return false;
  }
  return host.endsWith('maildomainws.icloud.com') || host.endsWith('maildomainws.icloud.com.cn');
}

function appendIcloudClientQueryParams(rawUrl = '') {
  const input = String(rawUrl || '').trim();
  if (!input) {
    return '';
  }
  try {
    const parsed = new URL(input);
    if (!isIcloudMaildomainwsHost(parsed.hostname)) {
      return input;
    }

    if (!parsed.searchParams.has('clientBuildNumber')) {
      parsed.searchParams.set('clientBuildNumber', ICLOUD_MAILDOMAINWS_CLIENT_BUILD_NUMBER);
    }
    if (!parsed.searchParams.has('clientMasteringNumber')) {
      parsed.searchParams.set('clientMasteringNumber', ICLOUD_MAILDOMAINWS_CLIENT_BUILD_NUMBER);
    }
    if (!parsed.searchParams.has('clientId')) {
      parsed.searchParams.set('clientId', '');
    }
    if (!parsed.searchParams.has('dsid')) {
      parsed.searchParams.set('dsid', '');
    }
    return parsed.toString();
  } catch {
    return input;
  }
}

function isIcloudMailPageUrl(rawUrl = '') {
  try {
    const parsedUrl = new URL(String(rawUrl || '').trim());
    if (!normalizeIcloudHost(parsedUrl.hostname)) {
      return false;
    }
    const pathname = String(parsedUrl.pathname || '').toLowerCase();
    return pathname === '/mail' || pathname.startsWith('/mail/');
  } catch {
    return false;
  }
}

async function waitForIcloudMailTabReady(tabId, timeoutMs = 8000) {
  if (!Number.isInteger(tabId)) {
    return false;
  }
  const deadline = Date.now() + Math.max(500, Number(timeoutMs) || 8000);
  while (Date.now() < deadline) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const status = String(tab?.status || '');
      if (isIcloudMailPageUrl(tab?.url) && status === 'complete') {
        return true;
      }
    } catch {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function ensureIcloudMailContextTab(tabs = [], targetHost = '', preferredHost = '') {
  const tabList = Array.isArray(tabs) ? tabs : [];
  const normalizedTargetHost = normalizeIcloudHost(targetHost);
  const normalizedPreferredHost = normalizeIcloudHost(preferredHost);
  const fallbackHost = normalizedTargetHost
    || normalizedPreferredHost
    || await getOpenIcloudHostPreference()
    || 'icloud.com';
  const fallbackMailUrl = getIcloudMailUrlForHost(fallbackHost) || getIcloudMailUrlForHost('icloud.com');
  if (!fallbackMailUrl) {
    return tabList;
  }

  const readHostFromTab = (tab) => {
    try {
      return normalizeIcloudHost(new URL(String(tab?.url || '')).hostname);
    } catch {
      return '';
    }
  };

  const mailTabs = tabList.filter((tab) => isIcloudMailPageUrl(tab?.url));
  if (mailTabs.length > 0) {
    if (fallbackHost) {
      const hasTargetHostMailTab = mailTabs.some((tab) => readHostFromTab(tab) === fallbackHost);
      if (!hasTargetHostMailTab && Number.isInteger(mailTabs[0]?.id)) {
        try {
          await chrome.tabs.update(mailTabs[0].id, { url: fallbackMailUrl, active: false });
          await waitForIcloudMailTabReady(mailTabs[0].id, 9000);
          try {
            return await chrome.tabs.query({
              url: ICLOUD_TAB_URL_PATTERNS,
            });
          } catch {
            return tabList;
          }
        } catch {}
      }
    }
    return tabList;
  }

  const sameHostIcloudTab = tabList.find((tab) => (
    Number.isInteger(tab?.id) && readHostFromTab(tab) === fallbackHost
  ));
  const anyIcloudTab = tabList.find((tab) => Number.isInteger(tab?.id));

  try {
    if (sameHostIcloudTab?.id) {
      await chrome.tabs.update(sameHostIcloudTab.id, { url: fallbackMailUrl, active: false });
      await waitForIcloudMailTabReady(sameHostIcloudTab.id, 9000);
    } else if (anyIcloudTab?.id) {
      await chrome.tabs.update(anyIcloudTab.id, { url: fallbackMailUrl, active: false });
      await waitForIcloudMailTabReady(anyIcloudTab.id, 9000);
    } else {
      const created = await chrome.tabs.create({ url: fallbackMailUrl, active: false });
      await waitForIcloudMailTabReady(created?.id, 9000);
    }
  } catch {}

  try {
    return await chrome.tabs.query({
      url: ICLOUD_TAB_URL_PATTERNS,
    });
  } catch {
    return tabList;
  }
}

function shouldTryIcloudRequestPageContextFallback(url, status, errorMessage = '') {
  if (!isIcloudApiUrl(url)) {
    return false;
  }

  const normalizedStatus = Number(status) || 0;
  if (normalizedStatus === 401
    || normalizedStatus === 403
    || normalizedStatus === 409
    || normalizedStatus === 421
    || normalizedStatus === 429
    || normalizedStatus >= 500) {
    return true;
  }

  const message = String(errorMessage || '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message.includes('timed out')
    || message.includes('timeout')
    || message.includes('cors')
    || message.includes('address space');
}

async function icloudRequestViaPageContext(method, url, options = {}) {
  const {
    data,
    contentType = '',
  } = options;
  const state = await getState();
  const configuredHost = getConfiguredIcloudHostPreference(state);
  const targetHost = configuredHost || normalizeIcloudHost(new URL(url).hostname);
  const preferredHost = configuredHost || normalizeIcloudHost(state?.preferredIcloudHost);

  let tabs = await chrome.tabs.query({
    url: ICLOUD_TAB_URL_PATTERNS,
  });
  tabs = await ensureIcloudMailContextTab(tabs, targetHost, preferredHost);
  if (!tabs.length) {
    throw new Error('page_context:no_icloud_tab');
  }

  const sortedTabs = [...tabs].sort((left, right) => {
    const score = (tab) => {
      let tabHost = '';
      try {
        tabHost = normalizeIcloudHost(new URL(String(tab?.url || '')).hostname);
      } catch {}
      return (isIcloudMailPageUrl(tab?.url) ? 8 : 0)
        + (tab?.active ? 4 : 0)
        + (tabHost && tabHost === targetHost ? 2 : 0)
        + (tabHost && tabHost === preferredHost ? 1 : 0);
    };
    return score(right) - score(left);
  });
  const mailTabs = sortedTabs.filter((tab) => isIcloudMailPageUrl(tab?.url));
  const candidateTabs = mailTabs.length ? mailTabs : sortedTabs;

  const errors = [];
  for (const tab of candidateTabs) {
    if (!Number.isInteger(tab?.id)) {
      continue;
    }
    try {
      const injections = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        world: 'MAIN',
        func: async (requestConfig) => {
          const timeoutMs = 15000;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const headers = requestConfig.hasData
              ? { 'Content-Type': requestConfig.contentType || 'application/json' }
              : undefined;
            const response = await fetch(requestConfig.url, {
              method: requestConfig.method,
              credentials: 'include',
              cache: 'no-store',
              mode: 'cors',
              headers,
              body: requestConfig.hasData ? JSON.stringify(requestConfig.data) : undefined,
              signal: controller.signal,
            });
            const text = await response.text();
            return {
              ok: Boolean(response.ok),
              status: Number(response.status) || 0,
              text,
              error: '',
            };
          } catch (err) {
            return {
              ok: false,
              status: 0,
              text: '',
              error: String(err?.message || err || 'unknown error'),
            };
          } finally {
            clearTimeout(timeoutId);
          }
        },
        args: [{
          method,
          url,
          hasData: data !== undefined,
          data: data === undefined ? null : data,
          contentType: contentType || '',
        }],
      });

      const result = injections?.[0]?.result || null;
      if (!result) {
        throw new Error('empty result');
      }
      if (!result.ok) {
        if (result.status) {
          throw new Error(`status ${result.status}`);
        }
        throw new Error(result.error || 'page context request failed');
      }

      if (!String(result.text || '').trim()) {
        return {};
      }

      try {
        return JSON.parse(result.text);
      } catch (parseErr) {
        throw new Error(`invalid json: ${getErrorMessage(parseErr)}`);
      }
    } catch (err) {
      errors.push(`tab_${tab.id}:${getErrorMessage(err)}`);
    }
  }

  throw new Error(errors.length ? errors.join(' | ') : 'page_context:unknown');
}

function getIcloudRequestTargetLabel(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return String(rawUrl || '').trim();
  }
}

function getIcloudRetryDelay(attemptIndex) {
  if (attemptIndex <= 0) return ICLOUD_RETRY_DELAYS_MS[0];
  return ICLOUD_RETRY_DELAYS_MS[Math.min(attemptIndex - 1, ICLOUD_RETRY_DELAYS_MS.length - 1)];
}

function isIcloudRetryableStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(Number(status));
}

function isIcloudRetryableError(error) {
  const status = Number(error?.status || error?.responseStatus || 0);
  if (status && isIcloudRetryableStatus(status)) {
    return true;
  }
  if (error?.timedOut || error?.networkFailure) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network error')
    || message.includes('fetch failed')
    || message.includes('timed out')
    || message.includes('timeout')
    || (error?.name === 'AbortError' && !stopRequested);
}

function abortActiveIcloudRequests() {
  for (const controller of [...activeIcloudRequestControllers]) {
    try {
      controller.abort();
    } catch {}
  }
  activeIcloudRequestControllers.clear();
}

async function icloudRequest(method, url, options = {}) {
  const {
    data,
    timeoutMs = ICLOUD_REQUEST_TIMEOUT_MS,
    maxAttempts = 1,
    retryLabel = '',
    logRetries = false,
  } = options;
  const requestUrl = appendIcloudClientQueryParams(url);
  const requestContentType = (() => {
    if (data === undefined) {
      return '';
    }
    try {
      return isIcloudMaildomainwsHost(new URL(requestUrl).hostname)
        ? 'text/plain;charset=UTF-8'
        : 'application/json';
    } catch {
      return 'application/json';
    }
  })();

  let lastError = null;
  const totalAttempts = Math.max(1, Number(maxAttempts) || 1);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    throwIfStopped();

    const controller = new AbortController();
    let response = null;
    let timeoutTriggered = false;
    let timeoutId = null;
    activeIcloudRequestControllers.add(controller);

    try {
      timeoutId = setTimeout(() => {
        timeoutTriggered = true;
        try {
          controller.abort();
        } catch {}
      }, Math.max(1000, Number(timeoutMs) || ICLOUD_REQUEST_TIMEOUT_MS));

      response = await fetch(requestUrl, {
        method,
        credentials: 'include',
        headers: requestContentType ? { 'Content-Type': requestContentType } : undefined,
        body: data !== undefined ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let responseText = '';
        try {
          responseText = normalizeText(await response.text()).slice(0, 240);
        } catch {}

        const error = new Error(
          responseText
            ? `iCloud 请求失败：${method} ${requestUrl}，status ${response.status}，body: ${responseText}`
            : `iCloud 请求失败：${method} ${requestUrl}，status ${response.status}`
        );
        error.status = response.status;
        throw error;
      }

      const rawText = await response.text();
      if (!rawText) {
        return {};
      }

      try {
        return JSON.parse(rawText);
      } catch (err) {
        throw new Error(`iCloud 返回的 JSON 无法解析：${method} ${requestUrl}，${err.message}`);
      }
    } catch (err) {
      if (stopRequested) {
        throw new Error(STOP_ERROR_MESSAGE);
      }

      let requestError = err;
      if (timeoutTriggered || err?.name === 'AbortError') {
        requestError = new Error(`iCloud 请求超时：${method} ${url}，${timeoutMs}ms`);
        requestError.name = 'IcloudTimeoutError';
        requestError.timedOut = true;
      } else if (!requestError?.status) {
        const message = getErrorMessage(requestError);
        if (/failed to fetch|networkerror|network error|fetch failed/i.test(message)) {
          requestError.networkFailure = true;
        }
      }

      const directErrorMessage = getErrorMessage(requestError)
        || `iCloud 请求失败：${method} ${requestUrl}`;
      const shouldTryPageContext = shouldTryIcloudRequestPageContextFallback(
        requestUrl,
        Number(requestError?.status) || 0,
        directErrorMessage
      );
      if (shouldTryPageContext) {
        try {
          return await icloudRequestViaPageContext(method, requestUrl, {
            data,
            contentType: requestContentType || undefined,
          });
        } catch (pageContextError) {
          const pageContextMessage = getErrorMessage(pageContextError);
          if (!pageContextMessage.includes('page_context:no_icloud_tab')) {
            const mergedError = new Error(`${directErrorMessage} | page_context:${pageContextMessage}`);
            if (requestError?.status) {
              mergedError.status = requestError.status;
            }
            requestError = mergedError;
          }
        }
      }

      lastError = requestError;
      const shouldRetry = attempt < totalAttempts && isIcloudRetryableError(requestError);
      if (!shouldRetry) {
        throw requestError;
      }

      if (logRetries) {
        const delayMs = getIcloudRetryDelay(attempt);
        await addLog(
          `iCloud：${retryLabel || getIcloudRequestTargetLabel(requestUrl)} 第 ${attempt}/${totalAttempts} 次失败：${getErrorMessage(requestError)}，${Math.round(delayMs / 1000)} 秒后重试...`,
          'warn'
        );
      }

      await sleepWithStop(getIcloudRetryDelay(attempt));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activeIcloudRequestControllers.delete(controller);
    }
  }

  throw lastError || new Error(`iCloud 请求失败：${method} ${requestUrl}`);
}

async function validateIcloudSession(setupUrl) {
  const data = await icloudRequest('POST', `${setupUrl}/validate`);
  if (!data?.webservices?.premiummailsettings?.url) {
    throw new Error('Could not validate iCloud session. Hide My Email service was unavailable.');
  }
  return data;
}

function shouldTryIcloudPageContextFallback(errors = []) {
  const combinedMessage = String((errors || []).join(' | ')).toLowerCase();
  if (!combinedMessage) {
    return false;
  }
  return combinedMessage.includes('status 401')
    || combinedMessage.includes('status 403')
    || combinedMessage.includes('status 421')
    || combinedMessage.includes('networkerror')
    || combinedMessage.includes('network request failed')
    || combinedMessage.includes('failed to fetch')
    || combinedMessage.includes('timed out')
    || combinedMessage.includes('timeout')
    || combinedMessage.includes('cors');
}

async function validateIcloudSessionViaPageContext(tabId, setupUrl) {
  const host = new URL(setupUrl).host;
  try {
    const injections = await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: 'MAIN',
      func: async (targetSetupUrl) => {
        const timeoutMs = 12000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(`${targetSetupUrl}/validate`, {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            mode: 'cors',
            signal: controller.signal,
          });
          const text = await response.text();
          let data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch {}
          return {
            ok: Boolean(response.ok),
            status: Number(response.status) || 0,
            data,
            error: '',
          };
        } catch (err) {
          return {
            ok: false,
            status: 0,
            data: null,
            error: String(err?.message || err || 'unknown error'),
          };
        } finally {
          clearTimeout(timeoutId);
        }
      },
      args: [setupUrl],
    });

    const result = injections?.[0]?.result || null;
    if (result?.ok && result?.data?.webservices?.premiummailsettings?.url) {
      return {
        setupUrl,
        serviceUrl: normalizeIcloudServiceUrl(result.data.webservices.premiummailsettings.url),
        resolvedBy: 'page_context',
      };
    }

    if (result?.status) {
      throw new Error(`status ${result.status}`);
    }
    throw new Error(result?.error || 'page context validate failed');
  } catch (err) {
    throw new Error(`${host}: ${getErrorMessage(err)}`);
  }
}

async function resolveIcloudPremiumMailServiceViaPageContext(setupUrls, state, options = {}) {
  const errors = [];
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({
      url: ICLOUD_TAB_URL_PATTERNS,
    });
  } catch (err) {
    errors.push(`page_context:query_tabs:${getErrorMessage(err)}`);
    return { service: null, errors, noTab: false };
  }

  const explicitHost = normalizeIcloudHost(options?.hostPreference || options?.preferredHost || '');
  const configuredHost = getConfiguredIcloudHostPreference(state);
  const preferredHost = explicitHost
    || configuredHost
    || normalizeIcloudHost(state?.preferredIcloudHost);
  tabs = await ensureIcloudMailContextTab(tabs, preferredHost, preferredHost);
  if (!tabs.length) {
    return { service: null, errors: [], noTab: true };
  }
  const sortedTabs = [...tabs].sort((left, right) => {
    const leftActive = left?.active ? 1 : 0;
    const rightActive = right?.active ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    const leftMail = isIcloudMailPageUrl(left?.url) ? 1 : 0;
    const rightMail = isIcloudMailPageUrl(right?.url) ? 1 : 0;
    if (leftMail !== rightMail) return rightMail - leftMail;
    let leftHost = '';
    let rightHost = '';
    try { leftHost = normalizeIcloudHost(new URL(String(left?.url || '')).host); } catch {}
    try { rightHost = normalizeIcloudHost(new URL(String(right?.url || '')).host); } catch {}
    const leftPreferred = leftHost && leftHost === preferredHost ? 1 : 0;
    const rightPreferred = rightHost && rightHost === preferredHost ? 1 : 0;
    return rightPreferred - leftPreferred;
  });

  for (const tab of sortedTabs) {
    if (!Number.isInteger(tab?.id)) {
      continue;
    }
    for (const setupUrl of setupUrls) {
      try {
        const service = await validateIcloudSessionViaPageContext(tab.id, setupUrl);
        return { service, errors };
      } catch (err) {
        errors.push(`page_context:tab_${tab.id}:${getErrorMessage(err)}`);
      }
    }
  }

  return { service: null, errors, noTab: false };
}

async function resolveIcloudPremiumMailService(options = {}) {
  const errors = [];
  const state = await getState();
  const explicitHost = normalizeIcloudHost(options?.hostPreference || options?.preferredHost || '');
  const configuredHost = getConfiguredIcloudHostPreference(state);
  const effectiveHost = explicitHost || configuredHost;
  const setupUrls = effectiveHost
    ? (() => {
        const forcedSetupUrl = getIcloudSetupUrlForHost(effectiveHost);
        return forcedSetupUrl ? [forcedSetupUrl] : [];
      })()
    : await getPreferredIcloudSetupUrls(state);

  for (const setupUrl of setupUrls) {
    try {
      const data = await validateIcloudSession(setupUrl);
      const preferredIcloudHost = normalizeIcloudHost(new URL(setupUrl).host);
      if (preferredIcloudHost && preferredIcloudHost !== normalizeIcloudHost(state.preferredIcloudHost)) {
        await setState({ preferredIcloudHost });
      }
      return {
        setupUrl,
        serviceUrl: rememberIcloudServiceUrl(data.webservices.premiummailsettings.url),
      };
    } catch (err) {
      errors.push(`${new URL(setupUrl).host}: ${getErrorMessage(err)}`);
    }
  }

  if (shouldTryIcloudPageContextFallback(errors)) {
    const {
      service,
      errors: pageContextErrors,
      noTab: pageContextNoTab = false,
    } = await resolveIcloudPremiumMailServiceViaPageContext(setupUrls, state, {
      hostPreference: effectiveHost,
    });
    if (service) {
      const preferredIcloudHost = normalizeIcloudHost(new URL(service.setupUrl).host);
      if (preferredIcloudHost && preferredIcloudHost !== normalizeIcloudHost(state.preferredIcloudHost)) {
        await setState({ preferredIcloudHost });
      }
      await addLog(`iCloud：后台会话校验失败，已切换页面上下文校验（${new URL(service.setupUrl).host}）。`, 'warn');
      return {
        ...service,
        serviceUrl: rememberIcloudServiceUrl(service.serviceUrl),
      };
    }
    if (!pageContextNoTab && Array.isArray(pageContextErrors) && pageContextErrors.length) {
      errors.push(...pageContextErrors);
    }
  }

  throw new Error(errors.length
    ? `Could not validate iCloud session. ${errors.join(' | ')}`
    : `Could not validate iCloud session. 请先在当前浏览器登录 ${effectiveHost || 'icloud.com 或 icloud.com.cn'}。`);
}

function getIcloudAliasLabel() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `MultiPage ${dateStr}`;
}

async function checkIcloudSession(options = {}) {
  const actionLabel = String(options?.actionLabel || '检查 iCloud 会话').trim() || '检查 iCloud 会话';
  const { actionLabel: _ignoredActionLabel, ...resolveOptions } = options || {};
  return withIcloudLoginHelp(actionLabel, async () => {
    const { setupUrl } = await resolveIcloudPremiumMailService(resolveOptions);
    await addLog(`iCloud：会话校验通过（${new URL(setupUrl).host}）`, 'ok');
    return { ok: true, setupUrl };
  });
}

async function loadNormalizedIcloudAliases(options = {}) {
  const {
    resolveOptions = {},
    serviceUrl: initialServiceUrl = '',
    silent = false,
  } = options;

  let serviceUrl = String(initialServiceUrl || '').trim().replace(/\/$/, '');
  let lastError = null;

  for (let endpointAttempt = 1; endpointAttempt <= 2; endpointAttempt += 1) {
    throwIfStopped();

    if (!serviceUrl) {
      const resolved = await resolveIcloudPremiumMailService(resolveOptions);
      serviceUrl = resolved.serviceUrl;
    }

    try {
      if (!silent) {
        await addLog(`iCloud：正在从 ${new URL(serviceUrl).host} 加载 Hide My Email 别名列表...`, 'info');
      }
      const response = await icloudRequest('GET', `${serviceUrl}/v2/hme/list`, {
        timeoutMs: ICLOUD_REQUEST_TIMEOUT_MS,
        maxAttempts: ICLOUD_LIST_MAX_ATTEMPTS,
        retryLabel: '加载 iCloud 别名列表',
        logRetries: true,
      });
      const state = await getState();
      return {
        serviceUrl,
        aliases: normalizeIcloudAliasList(response, {
          usedEmails: getEffectiveUsedEmails(state),
          preservedEmails: getPreservedAliasMap(state),
        }),
      };
    } catch (err) {
      lastError = err;
      if (endpointAttempt >= 2 || !isIcloudRetryableError(err)) {
        throw err;
      }
      await addLog(`iCloud：${new URL(serviceUrl).host} 别名列表请求失败，正在刷新服务节点后重试...`, 'warn');
      serviceUrl = '';
    }
  }

  throw lastError || new Error('加载 iCloud 别名列表失败。');
}

async function listIcloudAliases(options = {}) {
  try {
    return await withIcloudLoginHelp('加载 iCloud 隐私邮箱列表', async () => {
      const { serviceUrl } = await resolveIcloudPremiumMailService(options);
      const response = await icloudRequest('GET', `${serviceUrl}/v2/hme/list`);
      const state = await getState();
      const aliases = normalizeIcloudAliasList(response, {
        usedEmails: getEffectiveUsedEmails(state),
        preservedEmails: getPreservedAliasMap(state),
      });
      await setState({
        icloudAliasCache: normalizeIcloudAliasCacheList(aliases),
        icloudAliasCacheAt: Date.now(),
      });
      return aliases;
    });
  } catch (err) {
    const message = getErrorMessage(err);
    const transientContextError = err?.code === 'ICLOUD_TRANSIENT_CONTEXT'
      || message.includes('网络/上下文波动');
    if (!transientContextError) {
      throw err;
    }
    const state = await getState();
    const freshCachedAliases = getIcloudAliasCacheFromState(state);
    if (freshCachedAliases.length) {
      await addLog(`iCloud：加载别名失败，已回退最近缓存（${freshCachedAliases.length} 条）。`, 'warn');
      return freshCachedAliases;
    }

    const staleCachedAliases = getIcloudAliasCacheFromState(state, { maxAgeMs: 0 });
    if (staleCachedAliases.length) {
      await addLog(`iCloud：加载别名失败，已回退历史缓存（${staleCachedAliases.length} 条）。`, 'warn');
      return staleCachedAliases;
    }

    const localFallbackAliases = buildIcloudAliasFallbackFromLocalState(state);
    if (localFallbackAliases.length) {
      await addLog(`iCloud：加载别名失败，已回退本地别名记录（${localFallbackAliases.length} 条）。`, 'warn');
      return localFallbackAliases;
    }

    throw err;
  }
}

async function deleteIcloudAlias(payload) {
  return withIcloudLoginHelp('删除 iCloud 隐私邮箱', async () => {
    const alias = typeof payload === 'string'
      ? { email: String(payload).trim().toLowerCase(), anonymousId: '' }
      : {
          email: String(payload?.email || '').trim().toLowerCase(),
          anonymousId: String(payload?.anonymousId || '').trim(),
        };

    if (!alias.email) {
      throw new Error('未提供需要删除的 iCloud 隐私邮箱。');
    }
    if (!alias.anonymousId) {
      throw new Error(`缺少 ${alias.email} 的 anonymousId，请先刷新 iCloud 别名列表。`);
    }

    let serviceUrl = '';
    try {
      ({ serviceUrl } = await resolveIcloudPremiumMailService());
    } catch (resolveErr) {
      const canFallbackToCachedService = isIcloudTransientContextError(resolveErr)
        && Boolean(lastResolvedIcloudServiceUrl);
      if (!canFallbackToCachedService) {
        throw resolveErr;
      }
      serviceUrl = lastResolvedIcloudServiceUrl;
      await addLog(`iCloud：会话校验暂时不可用，已回退最近可用服务节点 ${new URL(serviceUrl).host} 继续删除。`, 'warn');
    }

    try {
      const directDelete = await icloudRequest('POST', `${serviceUrl}/v1/hme/delete`, {
        data: { anonymousId: alias.anonymousId },
      });
      if (directDelete?.success === false) {
        throw new Error(directDelete?.error?.errorMessage || 'delete failed');
      }
    } catch (err) {
      await addLog(`iCloud：直接删除 ${alias.email} 失败，尝试先停用再删除...`, 'warn');

      const deactivated = await icloudRequest('POST', `${serviceUrl}/v1/hme/deactivate`, {
        data: { anonymousId: alias.anonymousId },
      });
      if (deactivated?.success === false) {
        throw new Error(deactivated?.error?.errorMessage || `停用 ${alias.email} 失败`);
      }

      const deleted = await icloudRequest('POST', `${serviceUrl}/v1/hme/delete`, {
        data: { anonymousId: alias.anonymousId },
      });
      if (deleted?.success === false) {
        throw new Error(deleted?.error?.errorMessage || `删除 ${alias.email} 失败`);
      }
    }

    const state = await getState();
    const manualAliasUsage = getManualAliasUsageMap(state);
    const preservedAliases = getPreservedAliasMap(state);
    delete manualAliasUsage[alias.email];
    delete preservedAliases[alias.email];
    await setState({ manualAliasUsage, preservedAliases });

    await addLog(`iCloud：已删除 ${alias.email}`, 'ok');
    broadcastIcloudAliasesChanged({ reason: 'deleted', email: alias.email });
    return { email: alias.email };
  });
}

async function deleteUsedIcloudAliases() {
  const aliases = await listIcloudAliases();
  const usedAliases = aliases.filter((alias) => alias.used);
  if (!usedAliases.length) {
    return { deleted: [], skipped: [] };
  }

  const deleted = [];
  const skipped = [];
  for (const alias of usedAliases) {
    if (alias.preserved) {
      skipped.push({ email: alias.email, error: 'preserved' });
      continue;
    }
    try {
      await deleteIcloudAlias(alias);
      deleted.push(alias.email);
    } catch (err) {
      skipped.push({ email: alias.email, error: getErrorMessage(err) });
    }
  }
  return { deleted, skipped };
}

async function fetchIcloudHideMyEmail(options = {}) {
  return withIcloudLoginHelp('获取 iCloud 隐私邮箱', async () => {
    throwIfStopped();
    const generateNew = Boolean(options?.generateNew);
    const preferredHost = String(options?.hostPreference || options?.preferredHost || '').trim();
    await addLog('iCloud：正在加载别名列表并校验当前浏览器登录状态...', 'info');

    const { serviceUrl, setupUrl } = await resolveIcloudPremiumMailService(
      preferredHost ? { hostPreference: preferredHost } : {}
    );
    await addLog(`iCloud：已通过 ${new URL(setupUrl).host} 验证会话`, 'ok');
    await addLog(`iCloud：当前 Hide My Email 服务节点 ${new URL(serviceUrl).host}`, 'info');

    let activeServiceUrl = serviceUrl;
    const existingAliases = await listIcloudAliases();
    const existingAliasEmailSet = new Set(
      existingAliases
        .map((aliasItem) => String(aliasItem?.email || '').trim().toLowerCase())
        .filter(Boolean)
    );

    if (!generateNew) {
      const reusableAlias = pickReusableIcloudAlias(existingAliases);
      if (reusableAlias) {
        await setEmailState(reusableAlias.email);
        await addLog(`iCloud：复用未使用别名 ${reusableAlias.email}`, 'ok');
        broadcastIcloudAliasesChanged({ reason: 'selected', email: reusableAlias.email });
        return reusableAlias.email;
      }
    } else {
      await addLog('iCloud：已启用“始终创建新别名”，本次将跳过复用。', 'info');
    }

    await addLog('iCloud：没有可复用别名，开始生成新的 Hide My Email 地址...', 'warn');
    await addLog(`iCloud：正在向 ${new URL(activeServiceUrl).host} 请求新的 Hide My Email 候选地址...`, 'info');

    try {
      let generated = null;
      try {
        generated = await icloudRequest('POST', `${activeServiceUrl}/v1/hme/generate`, {
          timeoutMs: ICLOUD_REQUEST_TIMEOUT_MS,
          maxAttempts: ICLOUD_WRITE_MAX_ATTEMPTS,
          retryLabel: '生成 Hide My Email 地址',
          logRetries: true,
        });
      } catch (err) {
        if (!isIcloudRetryableError(err)) {
          throw err;
        }
        await addLog('iCloud：生成候选别名失败，正在刷新服务节点后再试一次...', 'warn');
        const refreshedService = await resolveIcloudPremiumMailService(
          preferredHost ? { hostPreference: preferredHost } : {}
        );
        activeServiceUrl = refreshedService.serviceUrl;
        generated = await icloudRequest('POST', `${activeServiceUrl}/v1/hme/generate`, {
          timeoutMs: ICLOUD_REQUEST_TIMEOUT_MS,
          maxAttempts: ICLOUD_WRITE_MAX_ATTEMPTS,
          retryLabel: '生成 Hide My Email 地址',
          logRetries: true,
        });
      }

      if (!generated?.success || !generated?.result?.hme) {
        throw new Error(generated?.error?.errorMessage || 'iCloud 隐私邮箱生成失败。');
      }

      const generatedHmeRaw = generated.result.hme;
      const generatedAlias = String(
        (typeof generatedHmeRaw === 'string'
          ? generatedHmeRaw
          : generatedHmeRaw?.hme
            || generatedHmeRaw?.email
            || generatedHmeRaw?.alias
            || generatedHmeRaw?.address
            || '')
      ).trim().toLowerCase();
      if (!generatedAlias) {
        throw new Error('iCloud 隐私邮箱生成失败：未返回可用别名。');
      }
      await addLog(`iCloud：已生成候选别名 ${generatedAlias}，正在保留...`, 'info');

      const reserveData = {
        ...(generatedHmeRaw && typeof generatedHmeRaw === 'object' && !Array.isArray(generatedHmeRaw)
          ? generatedHmeRaw
          : {}),
        hme: generatedAlias,
        label: getIcloudAliasLabel(),
        note: 'Generated through Multi-Page Automation',
      };

      let alias = '';
      try {
        const reserved = await icloudRequest('POST', `${activeServiceUrl}/v1/hme/reserve`, {
          data: reserveData,
          timeoutMs: ICLOUD_REQUEST_TIMEOUT_MS,
          maxAttempts: 1,
        });

        if (!reserved?.success || !reserved?.result?.hme?.hme) {
          throw new Error(reserved?.error?.errorMessage || 'iCloud 隐私邮箱保留失败。');
        }

        alias = String(reserved.result.hme.hme || '').trim().toLowerCase();
      } catch (reserveErr) {
        const reserveErrMessage = getErrorMessage(reserveErr);
        const shouldTryListFallback = isIcloudRetryableError(reserveErr)
          || /\bstatus (?:401|403|409)\b/i.test(reserveErrMessage)
          || /failed to fetch/i.test(reserveErrMessage);
        if (!shouldTryListFallback) {
          throw reserveErr;
        }

        await addLog('iCloud：保留别名返回鉴权/网络异常，正在回查别名列表确认是否已创建...', 'warn');
        const { aliases: aliasesAfterReserveFailure, serviceUrl: refreshedListServiceUrl } = await loadNormalizedIcloudAliases({
          serviceUrl: activeServiceUrl,
          silent: true,
        });
        activeServiceUrl = refreshedListServiceUrl || activeServiceUrl;

        let recoveredAlias = findIcloudAliasByEmail(aliasesAfterReserveFailure, generatedAlias);
        if (!recoveredAlias) {
          recoveredAlias = aliasesAfterReserveFailure.find(
            (aliasItem) => !existingAliasEmailSet.has(String(aliasItem?.email || '').trim().toLowerCase())
          ) || null;
        }

        if (recoveredAlias?.email) {
          alias = String(recoveredAlias.email || '').trim().toLowerCase();
          await addLog(`iCloud：保留请求异常，但已在列表确认别名 ${alias}，继续使用。`, 'warn');
        } else if (isIcloudRetryableError(reserveErr)) {
          await addLog(`iCloud：列表中尚未出现 ${generatedAlias}，正在刷新服务节点后重试保留一次...`, 'warn');
          const refreshedService = await resolveIcloudPremiumMailService(
            preferredHost ? { hostPreference: preferredHost } : {}
          );
          activeServiceUrl = refreshedService.serviceUrl;
          const reservedRetry = await icloudRequest('POST', `${activeServiceUrl}/v1/hme/reserve`, {
            data: reserveData,
            timeoutMs: ICLOUD_REQUEST_TIMEOUT_MS,
            maxAttempts: 1,
          });
          if (!reservedRetry?.success || !reservedRetry?.result?.hme?.hme) {
            throw new Error(reservedRetry?.error?.errorMessage || 'iCloud 隐私邮箱保留失败。');
          }
          alias = String(reservedRetry.result.hme.hme || '').trim().toLowerCase();
        } else {
          alias = generatedAlias;
          await addLog(`iCloud：保留请求异常，已回退使用生成别名 ${alias}。`, 'warn');
        }
      }

      await setEmailState(alias);
      await addLog(`iCloud：已创建并保留新别名 ${alias}`, 'ok');
      broadcastIcloudAliasesChanged({ reason: 'created', email: alias });
      return alias;
    } catch (err) {
      if (!shouldStopIcloudAutoFetchRetries(err)) {
        throw err;
      }

      const reusableAlias = pickReusableIcloudAlias(existingAliases);
      if (reusableAlias) {
        await setEmailState(reusableAlias.email);
        await addLog(
          `iCloud：当前网络/上下文波动，暂无法创建新别名，已临时回退复用 ${reusableAlias.email}。`,
          'warn'
        );
        broadcastIcloudAliasesChanged({ reason: 'selected', email: reusableAlias.email });
        return reusableAlias.email;
      }

      throw new Error(
        `iCloud 当前无法创建新别名：${getErrorMessage(err)}。请先确认 iCloud 页面已登录且网络可访问，再重试。`
      );
    }
  });
}

async function finalizeIcloudAliasAfterSuccessfulFlow(state) {
  const email = String(state?.email || '').trim().toLowerCase();
  if (!email) {
    return { handled: false, deleted: false };
  }

  const knownIcloudAlias = normalizeEmailGenerator(state?.emailGenerator) === 'icloud'
    || Object.prototype.hasOwnProperty.call(getManualAliasUsageMap(state), email)
    || Object.prototype.hasOwnProperty.call(getPreservedAliasMap(state), email);
  if (!knownIcloudAlias) {
    return { handled: false, deleted: false };
  }

  await setIcloudAliasUsedState({ email, used: true }, { silentLog: true });
  await addLog(`iCloud：流程成功后已标记 ${email} 为已用。`, 'ok');

  if (!state.autoDeleteUsedIcloudAlias) {
    return { handled: true, deleted: false };
  }

  if (isAliasPreserved(state, email)) {
    await addLog(`iCloud：${email} 已被标记为保留，跳过自动删除。`, 'info');
    return { handled: true, deleted: false };
  }

  try {
    const aliases = await listIcloudAliases();
    const alias = findIcloudAliasByEmail(aliases, email);
    if (!alias) {
      await addLog(`iCloud：自动删除跳过，列表中未找到 ${email}。`, 'warn');
      return { handled: true, deleted: false };
    }
    if (alias.preserved) {
      await addLog(`iCloud：${email} 在最新别名列表中已是保留状态，跳过自动删除。`, 'info');
      return { handled: true, deleted: false };
    }
    if (!alias.anonymousId) {
      await addLog(`iCloud：自动删除跳过，${email} 缺少 anonymousId，请先刷新列表后重试。`, 'warn');
      return { handled: true, deleted: false };
    }
    await deleteIcloudAlias(alias);
    await addLog(`iCloud：流程成功后已自动删除 ${email}。`, 'ok');
    return { handled: true, deleted: true };
  } catch (err) {
    if (isIcloudTransientContextError(err)) {
      await addLog(`iCloud：自动删除 ${email} 暂时跳过（网络/上下文波动），可稍后手动删除。`, 'info');
    } else {
      await addLog(`iCloud：自动删除 ${email} 失败：${getErrorMessage(err)}`, 'warn');
    }
    return { handled: true, deleted: false };
  }
}

async function finalizePhoneActivationAfterSuccessfulFlow(state) {
  if (typeof phoneVerificationHelpers?.finalizePendingPhoneActivationConfirmation !== 'function') {
    return null;
  }
  return phoneVerificationHelpers.finalizePendingPhoneActivationConfirmation(state);
}

async function clearFreeReusablePhoneActivation() {
  await setState({ freeReusablePhoneActivation: null });
  broadcastDataUpdate({ freeReusablePhoneActivation: null });
  await addLog('已清除白嫖复用手机号记录。', 'ok');
  return { ok: true, freeReusablePhoneActivation: null };
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
    id: Math.max(1, Math.floor(Number(match.id) || 0)),
    label: String(match.label || '').trim() || `Country #${match.id}`,
  };
}

function normalizePhoneDigits(value = '') {
  return String(value || '').replace(/\D+/g, '');
}

function phoneNumbersMatch(left = '', right = '') {
  const leftDigits = normalizePhoneDigits(left);
  const rightDigits = normalizePhoneDigits(right);
  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
}

function normalizeLocalHeroSmsActivation(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null;
  }
  const activationId = String(record.activationId ?? record.id ?? record.activation ?? '').trim();
  const phoneNumber = String(record.phoneNumber ?? record.number ?? record.phone ?? '').trim();
  if (!activationId || !phoneNumber) {
    return null;
  }
  const rawProvider = String(record.provider ?? record.smsProvider ?? '').trim();
  const provider = rawProvider ? normalizePhoneSmsProvider(rawProvider) : PHONE_SMS_PROVIDER_HERO;
  if (provider !== PHONE_SMS_PROVIDER_HERO) {
    return null;
  }
  const countryId = Math.max(
    0,
    Math.floor(Number(record.countryId ?? record.country ?? record.countryCode) || 0)
  );
  const countryLabel = String(record.countryLabel || record.label || '').trim();
  const serviceCode = String(record.serviceCode || record.service || HERO_SMS_SERVICE_CODE).trim() || HERO_SMS_SERVICE_CODE;
  return {
    ...record,
    provider: PHONE_SMS_PROVIDER_HERO,
    activationId,
    phoneNumber,
    serviceCode,
    ...(countryId > 0 ? { countryId } : {}),
    ...(countryLabel ? { countryLabel } : {}),
  };
}

function findLocalHeroSmsActivationForPhone(state = {}, phoneNumber = '') {
  const candidates = [
    state.currentPhoneActivation,
    state.reusablePhoneActivation,
    state.pendingPhoneActivationConfirmation,
    state.signupPhoneActivation,
    state.signupPhoneCompletedActivation,
    state.phonePreferredActivation,
    state.freeReusablePhoneActivation,
  ];
  if (Array.isArray(state.phoneReusableActivationPool)) {
    candidates.push(...state.phoneReusableActivationPool);
  }
  for (const candidate of candidates) {
    const normalized = normalizeLocalHeroSmsActivation(candidate);
    if (normalized && phoneNumbersMatch(normalized.phoneNumber, phoneNumber)) {
      return normalized;
    }
  }
  return null;
}

async function setFreeReusablePhoneActivation(record = {}) {
  const phoneNumber = String(record.phoneNumber || record.number || record.phone || '').trim();
  if (!phoneNumber) {
    throw new Error('请先填写白嫖复用手机号。');
  }
  const state = await getState();
  const localActivation = findLocalHeroSmsActivationForPhone(state, phoneNumber);
  const activationId = String(
    record.activationId
    || record.id
    || record.activation
    || localActivation?.activationId
    || ''
  ).trim();
  const inferredCountry = inferHeroSmsCountryFromPhoneNumber(phoneNumber);
  const hasExplicitCountry = Number.isFinite(Number(record.countryId)) && Number(record.countryId) > 0;
  const countryId = Math.max(
    1,
    Math.floor(
      Number(record.countryId)
      || Number(localActivation?.countryId)
      || Number(inferredCountry?.id)
      || Number(state.heroSmsCountryId)
      || HERO_SMS_COUNTRY_ID
    )
  );
  const stateCountryLabel = Math.floor(Number(state.heroSmsCountryId) || 0) === countryId
    ? String(state.heroSmsCountryLabel || '').trim()
    : '';
  const countryLabel = String(
    record.countryLabel
    || (Number(localActivation?.countryId) === countryId ? localActivation?.countryLabel : '')
    || (!hasExplicitCountry && inferredCountry?.id === countryId ? inferredCountry.label : '')
    || stateCountryLabel
    || (countryId === HERO_SMS_COUNTRY_ID ? HERO_SMS_COUNTRY_LABEL : `Country #${countryId}`)
  ).trim();
  const activation = {
    ...(activationId ? { activationId } : {}),
    phoneNumber,
    provider: PHONE_SMS_PROVIDER_HERO,
    serviceCode: String(record.serviceCode || localActivation?.serviceCode || HERO_SMS_SERVICE_CODE).trim() || HERO_SMS_SERVICE_CODE,
    countryId,
    ...(countryLabel ? { countryLabel } : {}),
    successfulUses: Math.max(0, Math.floor(Number(record.successfulUses) || 0)),
    maxUses: Math.max(1, Math.floor(Number(record.maxUses) || 3)),
    source: 'free-manual-reuse',
    recordedAt: Date.now(),
    manualOnly: !activationId,
  };
  await setState({ freeReusablePhoneActivation: activation });
  broadcastDataUpdate({ freeReusablePhoneActivation: activation });
  await addLog(
    activationId
      ? `已手动记录白嫖复用手机号 ${phoneNumber}（#${activationId}）。`
      : `已手动记录白嫖复用手机号 ${phoneNumber}。未填写 HeroSMS 激活 ID，仅支持手动填号复用。`,
    'ok'
  );
  return { ok: true, freeReusablePhoneActivation: activation };
}

// ============================================================
// Tab Registry
// ============================================================

async function getTabRegistry() {
  return tabRuntime.getTabRegistry();
}

async function registerTab(source, tabId) {
  return tabRuntime.registerTab(source, tabId);
}

async function isTabAlive(source) {
  return tabRuntime.isTabAlive(source);
}

async function getTabId(source) {
  return tabRuntime.getTabId(source);
}

function parseUrlSafely(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.parseUrlSafely) {
    return navigationUtils.parseUrlSafely(rawUrl);
  }
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function normalizeSub2ApiUrl(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.normalizeSub2ApiUrl) {
    return navigationUtils.normalizeSub2ApiUrl(rawUrl);
  }
  const input = (rawUrl || '').trim() || DEFAULT_SUB2API_URL;
  if (!input) return '';
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const parsed = new URL(withProtocol);
  if (!parsed.pathname || parsed.pathname === '/') {
    parsed.pathname = '/admin/accounts';
  }
  parsed.hash = '';
  return parsed.toString();
}

function normalizeCodex2ApiUrl(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.normalizeCodex2ApiUrl) {
    return navigationUtils.normalizeCodex2ApiUrl(rawUrl);
  }
  const input = (rawUrl || '').trim() || DEFAULT_CODEX2API_URL;
  const withProtocol = /^https?:\/\//i.test(input) ? input : `http://${input}`;
  const parsed = new URL(withProtocol);
  if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '/admin') {
    parsed.pathname = '/admin/accounts';
  }
  parsed.hash = '';
  return parsed.toString();
}

function getPanelMode(state = {}) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.getPanelMode) {
    return navigationUtils.getPanelMode(state);
  }
  if (state.panelMode === 'sub2api') {
    return 'sub2api';
  }
  if (state.panelMode === 'codex2api') {
    return 'codex2api';
  }
  return 'cpa';
}

function getPanelModeLabel(modeOrState) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.getPanelModeLabel) {
    return navigationUtils.getPanelModeLabel(modeOrState);
  }
  const mode = typeof modeOrState === 'string' ? modeOrState : getPanelMode(modeOrState);
  if (mode === 'sub2api') {
    return 'SUB2API';
  }
  if (mode === 'codex2api') {
    return 'Codex2API';
  }
  return 'CPA';
}

function isSignupPageHost(hostname = '') {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.isSignupPageHost) {
    return navigationUtils.isSignupPageHost(hostname);
  }
  return ['auth0.openai.com', 'auth.openai.com', 'accounts.openai.com'].includes(hostname);
}

function isSignupEntryHost(hostname = '') {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.isSignupEntryHost) {
    return navigationUtils.isSignupEntryHost(hostname);
  }
  return ['chatgpt.com', 'chat.openai.com'].includes(hostname);
}

function isSignupPasswordPageUrl(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.isSignupPasswordPageUrl) {
    return navigationUtils.isSignupPasswordPageUrl(rawUrl);
  }
  const parsed = parseUrlSafely(rawUrl);
  if (!parsed) return false;
  return isSignupPageHost(parsed.hostname)
    && /\/(?:create-account|log-in)\/password(?:[/?#]|$)/i.test(parsed.pathname || '');
}

function isSignupEmailVerificationPageUrl(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.isSignupEmailVerificationPageUrl) {
    return navigationUtils.isSignupEmailVerificationPageUrl(rawUrl);
  }
  const parsed = parseUrlSafely(rawUrl);
  if (!parsed) return false;
  return isSignupPageHost(parsed.hostname)
    && /\/email-verification(?:[/?#]|$)/i.test(parsed.pathname || '');
}

function is163MailHost(hostname = '') {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.is163MailHost) {
    return navigationUtils.is163MailHost(hostname);
  }
  return hostname === 'mail.163.com'
    || hostname.endsWith('.mail.163.com')
    || hostname === 'mail.126.com'
    || hostname.endsWith('.mail.126.com')
    || hostname === 'webmail.vip.163.com';
}

function isLocalhostOAuthCallbackUrl(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.isLocalhostOAuthCallbackUrl) {
    return navigationUtils.isLocalhostOAuthCallbackUrl(rawUrl);
  }
  const parsed = parseUrlSafely(rawUrl);
  if (!parsed) return false;
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
  if (!['/auth/callback', '/codex/callback'].includes(parsed.pathname)) return false;
  const code = (parsed.searchParams.get('code') || '').trim();
  const state = (parsed.searchParams.get('state') || '').trim();
  return Boolean(code && state);
}

function isLocalCpaUrl(rawUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.isLocalCpaUrl) {
    return navigationUtils.isLocalCpaUrl(rawUrl);
  }
  const parsed = parseUrlSafely(rawUrl);
  if (!parsed) return false;
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  return ['localhost', '127.0.0.1'].includes(parsed.hostname);
}

function shouldBypassStep9ForLocalCpa(state) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.shouldBypassStep9ForLocalCpa) {
    return navigationUtils.shouldBypassStep9ForLocalCpa(state);
  }
  return normalizeLocalCpaStep9Mode(state?.localCpaStep9Mode) === 'bypass'
    && Boolean(state?.localhostUrl)
    && isLocalCpaUrl(state?.vpsUrl);
}

function matchesSourceUrlFamily(source, candidateUrl, referenceUrl) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.matchesSourceUrlFamily) {
    return navigationUtils.matchesSourceUrlFamily(source, candidateUrl, referenceUrl);
  }
  const candidate = parseUrlSafely(candidateUrl);
  if (!candidate) return false;
  const reference = parseUrlSafely(referenceUrl);
  switch (source) {
    case 'signup-page':
      return isSignupPageHost(candidate.hostname) || isSignupEntryHost(candidate.hostname);
    case 'duck-mail':
      return candidate.hostname === 'duckduckgo.com' && candidate.pathname.startsWith('/email/');
    case 'qq-mail':
      return candidate.hostname === 'mail.qq.com' || candidate.hostname === 'wx.mail.qq.com';
    case 'mail-163':
      return is163MailHost(candidate.hostname);
    case 'gmail-mail':
      return candidate.hostname === 'mail.google.com';
    case 'inbucket-mail':
      return Boolean(reference) && candidate.origin === reference.origin && candidate.pathname.startsWith('/m/');
    case 'mail-2925':
      return candidate.hostname === '2925.com' || candidate.hostname === 'www.2925.com';
    case 'vps-panel':
      return Boolean(reference) && candidate.origin === reference.origin && candidate.pathname === reference.pathname;
    case 'sub2api-panel':
      return Boolean(reference)
        && candidate.origin === reference.origin
        && (candidate.pathname.startsWith('/admin/accounts') || candidate.pathname.startsWith('/login') || candidate.pathname === '/');
    default:
      return false;
  }
}

async function rememberSourceLastUrl(source, url) {
  return tabRuntime.rememberSourceLastUrl(source, url);
}

async function closeConflictingTabsForSource(source, currentUrl, options = {}) {
  return tabRuntime.closeConflictingTabsForSource(source, currentUrl, options);
}

function isLocalhostOAuthCallbackTabMatch(callbackUrl, candidateUrl) {
  return tabRuntime.isLocalhostOAuthCallbackTabMatch(callbackUrl, candidateUrl);
}

async function closeLocalhostCallbackTabs(callbackUrl, options = {}) {
  return tabRuntime.closeLocalhostCallbackTabs(callbackUrl, options);
}

function buildLocalhostCleanupPrefix(rawUrl) {
  return tabRuntime.buildLocalhostCleanupPrefix(rawUrl);
}

async function closeTabsByUrlPrefix(prefix, options = {}) {
  return tabRuntime.closeTabsByUrlPrefix(prefix, options);
}

async function pingContentScriptOnTab(tabId) {
  return tabRuntime.pingContentScriptOnTab(tabId);
}

async function waitForTabUrlFamily(source, tabId, referenceUrl, options = {}) {
  return tabRuntime.waitForTabUrlFamily(source, tabId, referenceUrl, options);
}

async function waitForTabUrlMatch(tabId, matcher, options = {}) {
  return tabRuntime.waitForTabUrlMatch(tabId, matcher, options);
}

async function waitForTabUrlMatchUntilStopped(tabId, matcher, options = {}) {
  const retryDelayMs = Math.max(100, Math.floor(Number(options.retryDelayMs) || 300));
  while (true) {
    throwIfStopped();
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      throw new Error('目标标签页已关闭，无法继续等待页面跳转。');
    }
    if (typeof matcher === 'function' && matcher(tab.url || '', tab)) {
      return tab;
    }
    await sleepWithStop(retryDelayMs);
  }
}

async function waitForTabComplete(tabId, options = {}) {
  return tabRuntime.waitForTabComplete(tabId, options);
}

async function waitForTabStableComplete(tabId, options = {}) {
  return tabRuntime.waitForTabStableComplete(tabId, options);
}

async function waitForTabCompleteUntilStopped(tabId, options = {}) {
  const retryDelayMs = Math.max(100, Math.floor(Number(options.retryDelayMs) || 300));
  while (true) {
    throwIfStopped();
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      throw new Error('目标标签页已关闭，无法继续等待页面加载完成。');
    }
    if (tab.status === 'complete') {
      return tab;
    }
    await sleepWithStop(retryDelayMs);
  }
}

async function ensureContentScriptReadyOnTab(source, tabId, options = {}) {
  return tabRuntime.ensureContentScriptReadyOnTab(source, tabId, options);
}

function isContentScriptReadyPong(source, pong) {
  if (!pong?.ok) return false;
  if (pong.source && pong.source !== source) return false;
  if (source === 'plus-checkout') {
    return Boolean(pong.plusCheckoutReady);
  }
  return true;
}

function isUnrecoverableContentScriptInjectError(error) {
  return /Could not load file/i.test(String(error?.message || error || ''));
}

async function ensureContentScriptReadyOnTabUntilStopped(source, tabId, options = {}) {
  const {
    inject = null,
    injectSource = null,
    retryDelayMs = 700,
    logMessage = '',
  } = options;
  let logged = false;

  while (true) {
    throwIfStopped();
    const pong = await pingContentScriptOnTab(tabId);
    if (isContentScriptReadyPong(source, pong)) {
      await registerTab(source, tabId);
      return;
    }

    if (!inject || !inject.length) {
      throw new Error(`${getSourceLabel(source)} 内容脚本未就绪，且未提供可用的注入文件。`);
    }

    try {
      if (injectSource) {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (injectedSource) => {
            window.__MULTIPAGE_SOURCE = injectedSource;
          },
          args: [injectSource],
        });
      }
      await chrome.scripting.executeScript({
        target: { tabId },
        files: inject,
      });
    } catch (error) {
      console.warn(LOG_PREFIX, `[ensureContentScriptReadyOnTabUntilStopped] inject failed for ${source}:`, error?.message || error);
      if (isUnrecoverableContentScriptInjectError(error)) {
        throw new Error(`${getSourceLabel(source)} 内容脚本文件加载失败：${error?.message || error}。请在扩展管理页重新加载当前扩展，确认文件已包含在已加载的扩展目录中。`);
      }
    }

    const pongAfterInject = await pingContentScriptOnTab(tabId);
    if (isContentScriptReadyPong(source, pongAfterInject)) {
      await registerTab(source, tabId);
      return;
    }

    if (logMessage && !logged) {
      logged = true;
      await addLog(logMessage, 'warn');
    }
    await sleepWithStop(retryDelayMs);
  }
}

// ============================================================
// Command Queue (for content scripts not yet ready)
// ============================================================

const pendingCommands = new Map(); // source -> { message, resolve, reject, timer }

function getContentScriptResponseTimeoutMs(message) {
  return tabRuntime.getContentScriptResponseTimeoutMs(message);
}

function getMessageDebugLabel(source, message, tabId = null) {
  return tabRuntime.getMessageDebugLabel(source, message, tabId);
}

function summarizeMessageResultForDebug(result) {
  return tabRuntime.summarizeMessageResultForDebug(result);
}

function sendTabMessageWithTimeout(tabId, source, message, responseTimeoutMs = getContentScriptResponseTimeoutMs(message)) {
  return tabRuntime.sendTabMessageWithTimeout(tabId, source, message, responseTimeoutMs);
}

async function sendTabMessageUntilStopped(tabId, source, message, options = {}) {
  const retryDelayMs = Math.max(100, Math.floor(Number(options.retryDelayMs) || 300));
  while (true) {
    throwIfStopped();
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (!isRetryableContentScriptTransportError(error)) {
        throw error;
      }
      await sleepWithStop(retryDelayMs);
    }
  }
}

function queueCommand(source, message, timeout = 15000) {
  return tabRuntime.queueCommand(source, message, timeout);
}

function flushCommand(source, tabId) {
  return tabRuntime.flushCommand(source, tabId);
}

function cancelPendingCommands(reason = STOP_ERROR_MESSAGE) {
  return tabRuntime.cancelPendingCommands(reason);
}

// ============================================================
// Reuse or create tab
// ============================================================

async function reuseOrCreateTab(source, url, options = {}) {
  return tabRuntime.reuseOrCreateTab(source, url, options);
}

// ============================================================
// Send command to content script (with readiness check)
// ============================================================

async function sendToContentScript(source, message, options = {}) {
  return tabRuntime.sendToContentScript(source, message, options);
}

async function sendToContentScriptResilient(source, message, options = {}) {
  return tabRuntime.sendToContentScriptResilient(source, message, options);
}

async function sendToMailContentScriptResilient(mail, message, options = {}) {
  return tabRuntime.sendToMailContentScriptResilient(mail, message, options);
}

// ============================================================
// Logging
// ============================================================

async function addLog(message, level = 'info', options = {}) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.addLog) {
    return loggingStatus.addLog(message, level, options);
  }
  const state = await getState();
  const logs = state.logs || [];
  const step = Math.floor(Number(options?.step) || 0);
  const entry = {
    message: String(message || ''),
    level,
    timestamp: Date.now(),
    step: step > 0 ? step : null,
    stepKey: String(options?.stepKey || '').trim(),
  };
  logs.push(entry);
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  await setState({ logs });
  chrome.runtime.sendMessage({ type: 'LOG_ENTRY', payload: entry }).catch(() => { });
}

function getStep8CallbackUrlFromNavigation(details, signupTabId) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.getStep8CallbackUrlFromNavigation) {
    return navigationUtils.getStep8CallbackUrlFromNavigation(details, signupTabId);
  }
  if (!Number.isInteger(signupTabId) || !details) return '';
  if (details.tabId !== signupTabId) return '';
  if (details.frameId !== 0) return '';
  return isLocalhostOAuthCallbackUrl(details.url) ? details.url : '';
}

function getStep8CallbackUrlFromTabUpdate(tabId, changeInfo, tab, signupTabId) {
  if (typeof navigationUtils !== 'undefined' && navigationUtils?.getStep8CallbackUrlFromTabUpdate) {
    return navigationUtils.getStep8CallbackUrlFromTabUpdate(tabId, changeInfo, tab, signupTabId);
  }
  if (!Number.isInteger(signupTabId) || tabId !== signupTabId) return '';
  const candidates = [changeInfo?.url, tab?.url];
  for (const candidate of candidates) {
    if (isLocalhostOAuthCallbackUrl(candidate)) return candidate;
  }
  return '';
}

function getSourceLabel(source) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.getSourceLabel) {
    return loggingStatus.getSourceLabel(source);
  }
  const labels = {
    'gmail-mail': 'Gmail 邮箱',
    'sidepanel': '侧边栏',
    'signup-page': '认证页',
    'vps-panel': 'CPA 面板',
    'sub2api-panel': 'SUB2API 后台',
    'qq-mail': 'QQ 邮箱',
    'mail-163': '163 邮箱',
    'mail-2925': '2925 邮箱',
    'inbucket-mail': 'Inbucket 邮箱',
    'duck-mail': 'Duck 邮箱',
    'hotmail-api': 'Hotmail（API对接/本地助手）',
    'luckmail-api': 'LuckMail（API 购邮）',
    'cloudflare-temp-email': 'Cloudflare Temp Email',
    'cloudmail': 'Cloud Mail',
    'plus-checkout': 'Plus Checkout',
    'paypal-flow': 'PayPal 授权页',
  };
  return labels[source] || source || '未知来源';
}

// ============================================================
// Step Status Management
// ============================================================

async function setStepStatus(step, status) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.setStepStatus) {
    return loggingStatus.setStepStatus(step, status);
  }
  const state = await getState();
  const statuses = { ...state.stepStatuses };
  statuses[step] = status;
  await setState({ stepStatuses: statuses, currentStep: step });
  chrome.runtime.sendMessage({
    type: 'STEP_STATUS_CHANGED',
    payload: { step, status },
  }).catch(() => { });
}

function isStopError(error) {
  const message = typeof error === 'string' ? error : error?.message;
  return message === STOP_ERROR_MESSAGE;
}

function isRetryableContentScriptTransportError(error) {
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /back\/forward cache|message channel is closed|Receiving end does not exist|port closed before a response was received|A listener indicated an asynchronous response|did not respond in \d+s|failed to fetch|networkerror|network error|fetch failed|load failed/i.test(message);
}

function isStepFetchNetworkRetryableError(error) {
  const message = String(getErrorMessage(error) || '').toLowerCase();
  return /failed to fetch|networkerror|network error|fetch failed|load failed|net::err_/i.test(message);
}

function getStepFetchNetworkRetryPolicy(step) {
  if (typeof STEP_FETCH_NETWORK_RETRY_POLICIES === 'undefined' || !(STEP_FETCH_NETWORK_RETRY_POLICIES instanceof Map)) {
    return null;
  }

  const policy = STEP_FETCH_NETWORK_RETRY_POLICIES.get(Number(step));
  if (!policy) {
    return null;
  }

  return {
    maxAttempts: Math.max(1, Math.floor(Number(policy.maxAttempts) || 1)),
    cooldownMs: Math.max(0, Math.floor(Number(policy.cooldownMs) || 0)),
  };
}

const navigationUtils = self.MultiPageBackgroundNavigationUtils?.createNavigationUtils({
  DEFAULT_CODEX2API_URL,
  DEFAULT_SUB2API_URL,
  normalizeLocalCpaStep9Mode,
});

const loggingStatus = self.MultiPageBackgroundLoggingStatus?.createLoggingStatus({
  chrome,
  DEFAULT_STATE,
  getState,
  isRecoverableStep9AuthFailure,
  LOG_PREFIX,
  setState,
  STOP_ERROR_MESSAGE,
});

const tabRuntime = self.MultiPageBackgroundTabRuntime?.createTabRuntime({
  addLog,
  chrome,
  getSourceLabel,
  getState,
  isLocalhostOAuthCallbackUrl,
  isRetryableContentScriptTransportError,
  LOG_PREFIX,
  matchesSourceUrlFamily,
  setState,
  sleepWithStop,
  STOP_ERROR_MESSAGE,
  throwIfStopped,
});

function getErrorMessage(error) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.getErrorMessage) {
    return loggingStatus.getErrorMessage(error);
  }
  return String(typeof error === 'string' ? error : error?.message || '')
    .replace(/^GPC_TASK_ENDED::/i, '');
}

function isCloudflareSecurityBlockedError(error) {
  return getErrorMessage(error).startsWith(CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX);
}

function isTerminalSecurityBlockedError(error) {
  return isCloudflareSecurityBlockedError(error);
}

function getCloudflareSecurityBlockedMessage(error) {
  const message = getErrorMessage(error);
  if (message.startsWith(CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX)) {
    return message.slice(CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX.length).trim() || CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE;
  }
  return CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE;
}

function getTerminalSecurityBlockedMessage(error) {
  return getCloudflareSecurityBlockedMessage(error);
}

function getTerminalSecurityBlockedAlertText(error) {
  return '检测到 Cloudflare 风控，请暂停当前操作。';
}

function getTerminalSecurityBlockedTitle(error) {
  return 'Cloudflare 风控拦截';
}

function isBrowserSwitchRequiredError(error) {
  return getErrorMessage(error).startsWith(BROWSER_SWITCH_REQUIRED_ERROR_PREFIX);
}

function getBrowserSwitchRequiredMessage(error) {
  const message = getErrorMessage(error);
  return message.startsWith(BROWSER_SWITCH_REQUIRED_ERROR_PREFIX)
    ? message.slice(BROWSER_SWITCH_REQUIRED_ERROR_PREFIX.length).trim()
    : message;
}

function broadcastSecurityBlockedAlert(title = '流程已完全停止', message = CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE, alertText = '检测到 Cloudflare 风控，请暂停当前操作。') {
  chrome.runtime.sendMessage({
    type: 'SECURITY_BLOCKED_ALERT',
    payload: {
      title,
      message,
      alert: {
        text: alertText,
        tone: 'danger',
      },
    },
  }).catch(() => { });
}

async function handleCloudflareSecurityBlocked(error) {
  const title = getTerminalSecurityBlockedTitle(error);
  const message = getTerminalSecurityBlockedMessage(error);
  const alertText = getTerminalSecurityBlockedAlertText(error);
  await requestStop({ logMessage: message });
  broadcastSecurityBlockedAlert(title, message, alertText);
  return message;
}

async function handleBrowserSwitchRequired(error) {
  const message = getBrowserSwitchRequiredMessage(error)
    || '检测到第 10 步的特殊冲突状态，请更换浏览器后重新进行注册登录。';
  await requestStop({ logMessage: message });
  return message;
}

function isVerificationMailPollingError(error) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.isVerificationMailPollingError) {
    return loggingStatus.isVerificationMailPollingError(error);
  }
  const message = getErrorMessage(error);
  return /未在 .*邮箱中找到新的匹配邮件|未在 Hotmail 收件箱中找到新的匹配验证码|邮箱轮询结束，但未获取到验证码|无法获取新的(?:注册|登录)验证码|页面未能重新就绪|页面通信异常|did not respond in \d+s/i.test(message);
}

function isAddPhoneAuthFailure(error) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.isAddPhoneAuthFailure) {
    return loggingStatus.isAddPhoneAuthFailure(error);
  }
  const message = getErrorMessage(error);
  if (/\u624b\u673a\u53f7\u8f93\u5165\u6a21\u5f0f|phone\s+entry/i.test(message)) {
    return false;
  }
  return /https:\/\/auth\.openai\.com\/add-phone(?:[/?#]|$)|\badd-phone\b|\u6dfb\u52a0\u624b\u673a\u53f7|\u624b\u673a\u53f7\u7801|\u8fdb\u5165\u624b\u673a\u53f7\u9875\u9762|\u624b\u673a\u53f7\u9875|\u624b\u673a\u53f7\u9875\u9762|phone\s+number|telephone/i.test(message);
}

function getLoginAuthStateLabel(state) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.getLoginAuthStateLabel) {
    return loggingStatus.getLoginAuthStateLabel(state);
  }
  switch (state) {
    case 'verification_page': return '登录验证码页';
    case 'phone_verification_page': return '手机验证码页';
    case 'password_page': return '密码页';
    case 'email_page': return '邮箱输入页';
    case 'phone_entry_page': return '手机号输入页';
    case 'login_timeout_error_page': return '登录超时报错页';
    case 'oauth_consent_page': return 'OAuth 授权页';
    case 'add_phone_page': return '手机号页';
    case 'add_email_page': return '添加邮箱页';
    default: return '未知页面';
  }
}

function isRestartCurrentAttemptError(error) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.isRestartCurrentAttemptError) {
    return loggingStatus.isRestartCurrentAttemptError(error);
  }
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /当前邮箱已存在，需要重新开始新一轮|SIGNUP_PHONE_PASSWORD_MISMATCH::/i.test(message);
}

function isSignupPhonePasswordMismatchFailure(error) {
  const message = getErrorMessage(error);
  return /SIGNUP_PHONE_PASSWORD_MISMATCH::/i.test(message);
}

function getSignupPhonePasswordMismatchRestartPayload(preservedState = {}) {
  const preservedEmail = String(preservedState.email || '').trim();
  const preservedPassword = String(preservedState.password || '').trim();
  const accountIdentifierType = String(preservedState.accountIdentifierType || '').trim().toLowerCase();
  const activeSignupPhoneNumber = String(
    preservedState.signupPhoneNumber
    || preservedState.signupPhoneActivation?.phoneNumber
    || preservedState.signupPhoneCompletedActivation?.phoneNumber
    || (accountIdentifierType === 'phone' ? preservedState.accountIdentifier : '')
    || ''
  ).trim();
  const shouldClearSignupPhoneRuntime = Boolean(
    activeSignupPhoneNumber
    || preservedState.signupPhoneActivation
    || preservedState.signupPhoneCompletedActivation
    || preservedState.signupPhoneVerificationRequestedAt
    || preservedState.signupPhoneVerificationPurpose
    || accountIdentifierType === 'phone'
  );
  const restorePayload = {};
  if (preservedEmail) restorePayload.email = preservedEmail;
  if (preservedPassword) restorePayload.password = preservedPassword;
  if (shouldClearSignupPhoneRuntime) {
    restorePayload.signupPhoneNumber = '';
    restorePayload.signupPhoneActivation = null;
    restorePayload.signupPhoneCompletedActivation = null;
    restorePayload.signupPhoneVerificationRequestedAt = null;
    restorePayload.signupPhoneVerificationPurpose = '';
    if (accountIdentifierType === 'phone') {
      restorePayload.accountIdentifierType = null;
      restorePayload.accountIdentifier = '';
    }
  }
  return {
    activeSignupPhoneNumber,
    preservedEmail,
    restorePayload,
    shouldClearSignupPhoneRuntime,
  };
}

async function restartSignupPhonePasswordMismatchAttemptFromStep(step, restartCount, error) {
  const preservedState = await getState();
  const {
    activeSignupPhoneNumber,
    preservedEmail,
    restorePayload,
    shouldClearSignupPhoneRuntime,
  } = getSignupPhonePasswordMismatchRestartPayload(preservedState);
  const emailSuffix = preservedEmail ? `当前邮箱：${preservedEmail}；` : '';
  const phoneSuffix = activeSignupPhoneNumber ? `当前手机号：${activeSignupPhoneNumber}；` : '';
  const errorMessage = getErrorMessage(error);
  const reasonLabel = /PHONE_RESEND_BANNED_NUMBER::|无法向此(?:电话|手机)号码发送短信|无法发送短信到此(?:电话|手机)号码|unable\s+to\s+send\s+(?:an?\s+)?(?:sms|text(?:\s+message)?)\s+to\s+(?:this|that)\s+(?:phone\s+)?number/i
    .test(errorMessage)
    ? '当前注册手机号无法接收短信'
    : (/与此(?:电话|手机)号码相关联的帐户已存在|account\s+associated\s+with\s+this\s+phone\s+number\s+already\s+exists/i
      .test(errorMessage)
      ? '注册手机号异常'
      : '手机号/密码不匹配');
  await addLog(
    `步骤 ${step}：检测到${reasonLabel}，准备丢弃当前注册手机号并回到步骤 1 重新开始（第 ${restartCount} 次重开）。${phoneSuffix}${emailSuffix}原因：${errorMessage}`,
    'warn'
  );
  await invalidateDownstreamAfterStepRestart(1, {
    logLabel: `步骤 ${step} 检测到${reasonLabel}后准备回到步骤 1 重新获取手机号重试（第 ${restartCount} 次重开）`,
  });
  if (shouldClearSignupPhoneRuntime) {
    await addLog(`步骤 ${step}：已清空本轮注册手机号与接码订单，下一次重开将重新获取号码。`, 'warn');
  }
  if (Object.keys(restorePayload).length) {
    await setState(restorePayload);
  }
}

function isSignupUserAlreadyExistsFailure(error) {
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.isSignupUserAlreadyExistsFailure) {
    return loggingStatus.isSignupUserAlreadyExistsFailure(error);
  }
  const message = getErrorMessage(error);
  return /SIGNUP_USER_ALREADY_EXISTS::|user_already_exists/i.test(message);
}

function isStep4Route405RecoveryLimitFailure(error) {
  const message = getErrorMessage(error);
  return /STEP4_405_RECOVERY_LIMIT::|步骤\s*4：检测到\s*405\s*错误页面，已连续点击“重试”恢复/i.test(message);
}

function isPhoneSmsPlatformRateLimitFailure(error) {
  const message = getErrorMessage(error);
  return /FIVE_SIM_RATE_LIMIT::|5sim[\s\S]*(?:限流|rate\s*limit)/i.test(message);
}

function isPlusCheckoutNonFreeTrialFailure(error) {
  const message = getErrorMessage(error);
  return /PLUS_CHECKOUT_NON_FREE_TRIAL::|今日应付金额不是\s*0|没有免费试用资格/i.test(message);
}

function isGpcTaskEndedFailure(error) {
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /GPC_TASK_ENDED::/i.test(message);
}

function isGpcCheckoutRestartRequiredFailure(error) {
  const message = getErrorMessage(error);
  if (/PLUS_CHECKOUT_NON_FREE_TRIAL::|今日应付金额不是\s*0|没有免费试用资格/i.test(message)) {
    return false;
  }
  if (/GPC_TASK_ENDED::/i.test(message)) {
    return true;
  }
  return /GPC\s*API\s*请求超时|步骤\s*[67][\s\S]*GPC[\s\S]*(?:任务轮询超时|请求超时|超时|timeout|timed\s*out|卡死|无响应)|account\s+already\s+linked|GOPAY已经绑了订阅|(?:账号|账户|GoPay|GOPAY)[\s\S]*(?:已绑定|已经绑定|已绑|绑了订阅|绑定了订阅)|创建\s*GPC\s*订单失败[\s\S]*(?:任务已结束|任务结束|failed|expired|discarded|请求超时|timeout|timed\s*out)/i.test(message);
}

function isGoPayCheckoutRestartRequiredFailure(error) {
  const message = getErrorMessage(error);
  return /GOPAY_RESTART_FROM_STEP6::|GOPAY_RETRY_REQUIRED::/i.test(message);
}

function isStep9RecoverableAuthError(error) {
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /STEP9_OAUTH_RETRY::/i.test(message)
    || isRecoverableStep9AuthFailure(message);
}

function isLegacyStep9RecoverableAuthError(error) {
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /STEP9_OAUTH_TIMEOUT::|认证失败:\s*(?:Timeout waiting for OAuth callback|timeout of \d+ms exceeded)/i.test(message);
}

function isStepDoneStatus(status) {
  return status === 'completed' || status === 'manual_completed' || status === 'skipped';
}

function getFirstUnfinishedStep(statuses = {}, stateOverride = null) {
  const state = stateOverride || {};
  const activeStepIds = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : (typeof STEP_IDS !== 'undefined' && Array.isArray(STEP_IDS) && STEP_IDS.length
      ? STEP_IDS
      : Array.from({ length: typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10 }, (_, index) => index + 1));
  for (const step of activeStepIds) {
    if (!isStepDoneStatus(statuses[step] || 'pending')) return step;
  }
  return null;
}

function hasSavedProgress(statuses = {}, stateOverride = null) {
  const state = stateOverride || {};
  const merged = { ...DEFAULT_STATE.stepStatuses, ...statuses };
  const activeStepIds = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : (typeof STEP_IDS !== 'undefined' && Array.isArray(STEP_IDS) && STEP_IDS.length
      ? STEP_IDS
      : Array.from({ length: typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10 }, (_, index) => index + 1));
  return activeStepIds.some((step) => (merged[step] || 'pending') !== 'pending');
}

function getDownstreamStateResets(step, state = {}) {
  const stepKey = getStepExecutionKeyForState(step, state);
  const plusRuntimeResets = {
    plusCheckoutTabId: null,
    plusCheckoutUrl: null,
    plusCheckoutCountry: 'DE',
    plusCheckoutCurrency: 'EUR',
    plusCheckoutSource: '',
    plusBillingCountryText: '',
    plusBillingAddress: null,
    plusPaypalApprovedAt: null,
    plusGoPayApprovedAt: null,
    plusReturnUrl: '',
    plusManualConfirmationPending: false,
    plusManualConfirmationRequestId: '',
    plusManualConfirmationStep: 0,
    plusManualConfirmationMethod: '',
    plusManualConfirmationTitle: '',
    plusManualConfirmationMessage: '',
    gopayHelperReferenceId: '',
    gopayHelperGoPayGuid: '',
    gopayHelperRedirectUrl: '',
    gopayHelperNextAction: '',
    gopayHelperFlowId: '',
    gopayHelperChallengeId: '',
    gopayHelperStartPayload: null,
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
    gopayHelperOrderCreatedAt: 0,
    gopayHelperPinPayload: null,
    gopayHelperResolvedOtp: '',
    gopayHelperOtpRequestId: '',
    gopayHelperOtpReferenceId: '',
  };

  if (step <= 1) {
    return {
      ...plusRuntimeResets,
      oauthUrl: null,
      cpaOAuthState: null,
      cpaManagementOrigin: null,
      sub2apiSessionId: null,
      sub2apiOAuthState: null,
      sub2apiGroupId: null,
      sub2apiDraftName: null,
      codex2apiSessionId: null,
      codex2apiOAuthState: null,
      flowStartTime: null,
      password: null,
      lastEmailTimestamp: null,
      signupVerificationRequestedAt: null,
      loginVerificationRequestedAt: null,
      oauthFlowDeadlineAt: null,
      oauthFlowDeadlineSourceUrl: null,
      pendingPhoneActivationConfirmation: null,
      lastSignupCode: null,
      lastLoginCode: null,
      localhostUrl: null,
      currentPhoneVerificationCode: '',
      currentPhoneVerificationCountdownEndsAt: 0,
      currentPhoneVerificationCountdownWindowIndex: 0,
      currentPhoneVerificationCountdownWindowTotal: 0,
    };
  }
  if (step === 2) {
    return {
      ...plusRuntimeResets,
      password: null,
      lastEmailTimestamp: null,
      signupVerificationRequestedAt: null,
      loginVerificationRequestedAt: null,
      oauthFlowDeadlineAt: null,
      oauthFlowDeadlineSourceUrl: null,
      pendingPhoneActivationConfirmation: null,
      lastSignupCode: null,
      lastLoginCode: null,
      localhostUrl: null,
      currentPhoneVerificationCode: '',
      currentPhoneVerificationCountdownEndsAt: 0,
      currentPhoneVerificationCountdownWindowIndex: 0,
      currentPhoneVerificationCountdownWindowTotal: 0,
    };
  }
  if (step === 3 || step === 4) {
    return {
      ...plusRuntimeResets,
      lastEmailTimestamp: null,
      signupVerificationRequestedAt: null,
      loginVerificationRequestedAt: null,
      oauthFlowDeadlineAt: null,
      oauthFlowDeadlineSourceUrl: null,
      pendingPhoneActivationConfirmation: null,
      lastSignupCode: null,
      lastLoginCode: null,
      localhostUrl: null,
      currentPhoneVerificationCode: '',
      currentPhoneVerificationCountdownEndsAt: 0,
      currentPhoneVerificationCountdownWindowIndex: 0,
      currentPhoneVerificationCountdownWindowTotal: 0,
    };
  }
  if (step === 5 || step === 6 || step === 7 || step === 8) {
    return {
      ...(step <= 6 ? plusRuntimeResets : {}),
      ...(step === 7 ? {
        plusBillingCountryText: '',
        plusBillingAddress: null,
        plusPaypalApprovedAt: null,
        plusGoPayApprovedAt: null,
        plusReturnUrl: '',
        plusManualConfirmationPending: false,
        plusManualConfirmationRequestId: '',
        plusManualConfirmationStep: 0,
        plusManualConfirmationMethod: '',
        plusManualConfirmationTitle: '',
        plusManualConfirmationMessage: '',
        gopayHelperResolvedOtp: '',
        gopayHelperLastInputError: '',
        gopayHelperOtpRequestId: '',
        gopayHelperOtpReferenceId: '',
      } : {}),
      ...(step === 8 ? {
        plusPaypalApprovedAt: null,
        plusGoPayApprovedAt: null,
        plusReturnUrl: '',
      } : {}),
      lastLoginCode: null,
      loginVerificationRequestedAt: null,
      oauthFlowDeadlineAt: null,
      oauthFlowDeadlineSourceUrl: null,
      pendingPhoneActivationConfirmation: null,
      localhostUrl: null,
      currentPhoneVerificationCode: '',
      currentPhoneVerificationCountdownEndsAt: 0,
      currentPhoneVerificationCountdownWindowIndex: 0,
      currentPhoneVerificationCountdownWindowTotal: 0,
    };
  }
  if (step === 9) {
    return {
      pendingPhoneActivationConfirmation: null,
      plusReturnUrl: '',
      localhostUrl: null,
      currentPhoneVerificationCode: '',
      currentPhoneVerificationCountdownEndsAt: 0,
      currentPhoneVerificationCountdownWindowIndex: 0,
      currentPhoneVerificationCountdownWindowTotal: 0,
    };
  }
  if (stepKey === 'oauth-login' || stepKey === 'fetch-login-code') {
    return {
      lastLoginCode: null,
      loginVerificationRequestedAt: null,
      oauthFlowDeadlineAt: null,
      oauthFlowDeadlineSourceUrl: null,
      pendingPhoneActivationConfirmation: null,
      localhostUrl: null,
      currentPhoneVerificationCode: '',
      currentPhoneVerificationCountdownEndsAt: 0,
      currentPhoneVerificationCountdownWindowIndex: 0,
      currentPhoneVerificationCountdownWindowTotal: 0,
    };
  }
  if (stepKey === 'confirm-oauth') {
    return {
      pendingPhoneActivationConfirmation: null,
      localhostUrl: null,
    };
  }
  return {};
}

async function invalidateDownstreamAfterStepRestart(step, options = {}) {
  const { logLabel = `步骤 ${step} 重新执行` } = options;
  const state = await getState();
  const statuses = { ...(state.stepStatuses || {}) };
  const changedSteps = [];

  const activeStepIds = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : (typeof STEP_IDS !== 'undefined' && Array.isArray(STEP_IDS) && STEP_IDS.length
      ? STEP_IDS
      : Array.from({ length: typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10 }, (_, index) => index + 1));
  for (const downstream of activeStepIds) {
    if (downstream <= step) {
      continue;
    }
    if (statuses[downstream] !== 'pending') {
      statuses[downstream] = 'pending';
      changedSteps.push(downstream);
    }
  }

  if (changedSteps.length) {
    await setState({ stepStatuses: statuses });
    for (const downstream of changedSteps) {
      chrome.runtime.sendMessage({
        type: 'STEP_STATUS_CHANGED',
        payload: { step: downstream, status: 'pending' },
      }).catch(() => { });
    }
    await addLog(`${logLabel}，已重置后续步骤状态：${changedSteps.join(', ')}`, 'warn');
  }

  const resets = getDownstreamStateResets(step, state);
  if (Object.keys(resets).length) {
    await setState(resets);
    broadcastDataUpdate(resets);
  }
}

function clearStopRequest() {
  stopRequested = false;
}

function getRunningSteps(statuses = {}, stateOverride = null) {
  const state = stateOverride || {};
  const merged = { ...DEFAULT_STATE.stepStatuses, ...statuses };
  const activeStepIds = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : (typeof STEP_IDS !== 'undefined' && Array.isArray(STEP_IDS) && STEP_IDS.length
      ? STEP_IDS
      : Array.from({ length: typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10 }, (_, index) => index + 1));
  return activeStepIds
    .filter((step) => merged[step] === 'running')
    .sort((a, b) => a - b);
}

function inferStoppedRecordStep(state = {}) {
  const statuses = { ...DEFAULT_STATE.stepStatuses, ...(state?.stepStatuses || {}) };
  const stepIds = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : (typeof STEP_IDS !== 'undefined' && Array.isArray(STEP_IDS) && STEP_IDS.length
      ? STEP_IDS
      : Array.from({ length: typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10 }, (_, index) => index + 1));

  const runningSteps = stepIds.filter((step) => statuses[step] === 'running');
  if (runningSteps.length) {
    return runningSteps[0];
  }

  const hasProgress = stepIds.some((step) => statuses[step] !== 'pending');
  if (!hasProgress) {
    return null;
  }

  for (const step of stepIds) {
    const status = statuses[step] || 'pending';
    if (!(status === 'completed' || status === 'manual_completed' || status === 'skipped')) {
      return step;
    }
  }

  return null;
}

function resolveAccountRunRecordStatusForStop(status, state = {}) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'stopped') {
    const inferredStep = inferStoppedRecordStep(state);
    if (Number.isInteger(inferredStep) && inferredStep > 0) {
      return `step${inferredStep}_stopped`;
    }
  }
  return status;
}

function extractStoppedStepFromRecordStatus(status = '') {
  const match = String(status || '').trim().toLowerCase().match(/^step(\d+)_stopped$/);
  if (!match) {
    return null;
  }
  const step = Number(match[1]);
  return Number.isInteger(step) && step > 0 ? step : null;
}

function resolveAccountRunRecordReasonForStop(status, reason = '') {
  const text = String(reason || '').trim();
  const stoppedStep = extractStoppedStepFromRecordStatus(status);

  if (!stoppedStep) {
    if (!text || text === STOP_ERROR_MESSAGE || /^流程已被用户停止。?$/.test(text)) {
      return '流程已停止。';
    }
    return text;
  }

  if (!text || text === STOP_ERROR_MESSAGE || /^流程已被用户停止。?$/.test(text)) {
    return `步骤 ${stoppedStep} 已被用户停止。`;
  }

  if (/流程尚未完成/.test(text) || /已使用邮箱/.test(text)) {
    return `步骤 ${stoppedStep} 已停止：邮箱已设置，流程尚未完成。`;
  }

  if (/步骤\s*\d+\s*已(?:被用户)?停止/.test(text)) {
    return text.replace(/步骤\s*\d+/, `步骤 ${stoppedStep}`);
  }

  return text;
}

function getAutoRunStatusPayload(phase, payload = {}) {
  const normalizedPayload = {
    ...payload,
    currentRun: payload.currentRun ?? autoRunCurrentRun,
    totalRuns: payload.totalRuns ?? autoRunTotalRuns,
    attemptRun: payload.attemptRun ?? autoRunAttemptRun,
    sessionId: payload.sessionId ?? payload.autoRunSessionId ?? autoRunSessionId,
  };
  if (typeof loggingStatus !== 'undefined' && loggingStatus?.getAutoRunStatusPayload) {
    return loggingStatus.getAutoRunStatusPayload(phase, normalizedPayload);
  }
  return {
    autoRunning: phase === 'scheduled'
      || phase === 'running'
      || phase === 'waiting_step'
      || phase === 'waiting_email'
      || phase === 'retrying'
      || phase === 'waiting_interval',
    autoRunPhase: phase,
    autoRunCurrentRun: normalizedPayload.currentRun ?? 0,
    autoRunTotalRuns: normalizedPayload.totalRuns ?? 1,
    autoRunAttemptRun: normalizedPayload.attemptRun ?? 0,
    autoRunSessionId: normalizeAutoRunSessionId(normalizedPayload.sessionId),
    scheduledAutoRunAt: Number.isFinite(Number(normalizedPayload.scheduledAt)) ? Number(normalizedPayload.scheduledAt) : null,
    autoRunCountdownAt: Number.isFinite(Number(normalizedPayload.countdownAt)) ? Number(normalizedPayload.countdownAt) : null,
    autoRunCountdownTitle: normalizedPayload.countdownTitle === undefined ? '' : String(normalizedPayload.countdownTitle || ''),
    autoRunCountdownNote: normalizedPayload.countdownNote === undefined ? '' : String(normalizedPayload.countdownNote || ''),
  };
}

async function broadcastAutoRunStatus(phase, payload = {}, extraState = {}) {
  const rawScheduledAt = phase === 'scheduled'
    ? (payload.scheduledAt ?? payload.scheduledAutoRunAt ?? null)
    : null;
  const rawCountdownAt = payload.countdownAt ?? payload.autoRunCountdownAt ?? null;
  const statusPayload = {
    phase,
    currentRun: payload.currentRun ?? autoRunCurrentRun,
    totalRuns: payload.totalRuns ?? autoRunTotalRuns,
    attemptRun: payload.attemptRun ?? autoRunAttemptRun,
    sessionId: payload.sessionId ?? payload.autoRunSessionId ?? autoRunSessionId,
    scheduledAt: rawScheduledAt === null ? null : Number(rawScheduledAt),
    countdownAt: rawCountdownAt === null ? null : Number(rawCountdownAt),
    countdownTitle: payload.countdownTitle === undefined ? '' : String(payload.countdownTitle || ''),
    countdownNote: payload.countdownNote === undefined ? '' : String(payload.countdownNote || ''),
  };

  await setState({
    ...extraState,
    ...getAutoRunStatusPayload(phase, statusPayload),
  });
  chrome.runtime.sendMessage({
    type: 'AUTO_RUN_STATUS',
    payload: statusPayload,
  }).catch(() => { });
}

function isAutoRunLockedState(state) {
  return Boolean(state.autoRunning)
    && (
      state.autoRunPhase === 'running'
      || state.autoRunPhase === 'waiting_step'
      || state.autoRunPhase === 'retrying'
      || state.autoRunPhase === 'waiting_interval'
    );
}

function isAutoRunPausedState(state) {
  return Boolean(state.autoRunning) && state.autoRunPhase === 'waiting_email';
}

function isAutoRunScheduledState(state) {
  const plan = normalizeAutoRunTimerPlanFromState(state);
  const scheduledAt = state.scheduledAutoRunAt === null ? null : Number(state.scheduledAutoRunAt);
  return Boolean(state.autoRunning)
    && state.autoRunPhase === 'scheduled'
    && Number.isFinite(scheduledAt)
    && plan?.kind === AUTO_RUN_TIMER_KIND_SCHEDULED_START;
}

function getPendingAutoRunTimerPlan(state = {}) {
  return normalizeAutoRunTimerPlanFromState(state);
}

function formatAutoRunScheduleTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
    timeZone: DISPLAY_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function setAutoRunDelayEnabledState(enabled) {
  const normalized = Boolean(enabled);
  await setPersistentSettings({ autoRunDelayEnabled: normalized });
  await setState({ autoRunDelayEnabled: normalized });
  broadcastDataUpdate({ autoRunDelayEnabled: normalized });
}

async function ensureAutoRunTimerAlarm(fireAt) {
  if (!Number.isFinite(fireAt) || fireAt <= Date.now()) {
    return false;
  }

  const existingAlarm = await chrome.alarms.get(AUTO_RUN_TIMER_ALARM_NAME);
  if (!existingAlarm || Math.abs((existingAlarm.scheduledTime || 0) - fireAt) > 1000) {
    await chrome.alarms.clear(AUTO_RUN_TIMER_ALARM_NAME);
    await chrome.alarms.create(AUTO_RUN_TIMER_ALARM_NAME, { when: fireAt });
  }

  return true;
}

async function clearAutoRunTimerAlarm() {
  await chrome.alarms.clear(AUTO_RUN_TIMER_ALARM_NAME);
}

async function persistAutoRunTimerPlan(plan, extraState = {}) {
  const normalizedPlan = normalizeAutoRunTimerPlan(plan);
  if (!normalizedPlan) {
    throw new Error('自动运行计时计划无效。');
  }

  const statusPayload = getAutoRunTimerStatusPayload(normalizedPlan);
  await broadcastAutoRunStatus(
    statusPayload.phase,
    statusPayload,
    {
      ...extraState,
      autoRunTimerPlan: normalizedPlan,
      scheduledAutoRunPlan: null,
    }
  );
  await ensureAutoRunTimerAlarm(normalizedPlan.fireAt);
  return normalizedPlan;
}

function getAutoRunTimerResumeOptions(plan) {
  const normalizedPlan = normalizeAutoRunTimerPlan(plan);
  if (!normalizedPlan) {
    return null;
  }

  if (normalizedPlan.kind === AUTO_RUN_TIMER_KIND_SCHEDULED_START) {
    return {
      loopOptions: {
        autoRunSessionId: normalizedPlan.autoRunSessionId,
        autoRunSkipFailures: normalizedPlan.autoRunSkipFailures,
        mode: normalizedPlan.mode,
      },
      statusPayload: {
        currentRun: 0,
        totalRuns: normalizedPlan.totalRuns,
        attemptRun: 0,
        sessionId: normalizedPlan.autoRunSessionId,
      },
    };
  }

  if (normalizedPlan.kind === AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS) {
    const nextRun = Math.min(normalizedPlan.currentRun + 1, normalizedPlan.totalRuns);
    return {
      loopOptions: {
        autoRunSessionId: normalizedPlan.autoRunSessionId,
        autoRunSkipFailures: normalizedPlan.autoRunSkipFailures,
        mode: 'restart',
        resumeCurrentRun: nextRun,
        resumeAttemptRun: 1,
        resumeRoundSummaries: normalizedPlan.roundSummaries,
      },
      statusPayload: {
        currentRun: nextRun,
        totalRuns: normalizedPlan.totalRuns,
        attemptRun: 1,
        sessionId: normalizedPlan.autoRunSessionId,
      },
    };
  }

  return {
    loopOptions: {
      autoRunSessionId: normalizedPlan.autoRunSessionId,
      autoRunSkipFailures: normalizedPlan.autoRunSkipFailures,
      mode: 'restart',
      resumeCurrentRun: normalizedPlan.currentRun,
      resumeAttemptRun: normalizedPlan.attemptRun,
      resumeRoundSummaries: normalizedPlan.roundSummaries,
    },
    statusPayload: {
      currentRun: normalizedPlan.currentRun,
      totalRuns: normalizedPlan.totalRuns,
      attemptRun: normalizedPlan.attemptRun,
      sessionId: normalizedPlan.autoRunSessionId,
    },
  };
}

let autoRunTimerLaunching = false;

async function launchAutoRunTimerPlan(trigger = 'alarm', options = {}) {
  const { expectedKinds = [] } = options;
  if (autoRunTimerLaunching) {
    return false;
  }

  autoRunTimerLaunching = true;
  try {
    const state = await getState();
    const plan = getPendingAutoRunTimerPlan(state);
    if (!plan) {
      return false;
    }
    if (expectedKinds.length && !expectedKinds.includes(plan.kind)) {
      return false;
    }
    if (autoRunActive) {
      return false;
    }
    if (plan.autoRunSessionId && !isCurrentAutoRunSessionId(plan.autoRunSessionId)) {
      return false;
    }

    const resumeOptions = getAutoRunTimerResumeOptions(plan);
    if (!resumeOptions) {
      await clearAutoRunTimerAlarm();
      await broadcastAutoRunStatus('idle', {
        currentRun: 0,
        totalRuns: 1,
        attemptRun: 0,
      }, {
        autoRunRoundSummaries: [],
        autoRunTimerPlan: null,
        scheduledAutoRunPlan: null,
      });
      return false;
    }

    await clearAutoRunTimerAlarm();
    if (plan.autoRunSessionId && !isCurrentAutoRunSessionId(plan.autoRunSessionId)) {
      return false;
    }
    autoRunCurrentRun = resumeOptions.statusPayload.currentRun;
    autoRunTotalRuns = plan.totalRuns;
    autoRunAttemptRun = resumeOptions.statusPayload.attemptRun;
    autoRunSessionId = normalizeAutoRunSessionId(plan.autoRunSessionId);
    if (plan.kind === AUTO_RUN_TIMER_KIND_SCHEDULED_START && trigger !== 'manual' && state.autoRunDelayEnabled) {
      await setAutoRunDelayEnabledState(false);
    }
    await broadcastAutoRunStatus(
      'running',
      resumeOptions.statusPayload,
      {
        autoRunSkipFailures: plan.autoRunSkipFailures,
        autoRunRoundSummaries: serializeAutoRunRoundSummaries(plan.totalRuns, plan.roundSummaries),
        autoRunTimerPlan: null,
        scheduledAutoRunPlan: null,
      }
    );

    if (plan.autoRunSessionId && !isCurrentAutoRunSessionId(plan.autoRunSessionId)) {
      return false;
    }
    clearStopRequest();
    let logMessage = '倒计时结束，自动运行开始执行。';
    if (plan.kind === AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS) {
      logMessage = trigger === 'manual'
        ? '已手动跳过线程间隔，自动流程立即开始下一轮。'
        : '线程间隔结束，自动流程开始下一轮。';
    } else if (plan.kind === AUTO_RUN_TIMER_KIND_BEFORE_RETRY) {
      logMessage = trigger === 'manual'
        ? `已手动跳过线程间隔，立即开始第 ${plan.currentRun}/${plan.totalRuns} 轮第 ${plan.attemptRun} 次尝试。`
        : `线程间隔结束，开始第 ${plan.currentRun}/${plan.totalRuns} 轮第 ${plan.attemptRun} 次尝试。`;
    } else if (trigger === 'manual') {
      logMessage = '已手动跳过倒计时，自动运行立即开始。';
    }
    await addLog(logMessage, 'info');
    if (plan.autoRunSessionId && !isCurrentAutoRunSessionId(plan.autoRunSessionId)) {
      return false;
    }

    startAutoRunLoop(plan.totalRuns, resumeOptions.loopOptions);
    return true;
  } finally {
    autoRunTimerLaunching = false;
  }
}

async function scheduleAutoRun(totalRuns, options = {}) {
  const state = await getState();
  if (isAutoRunLockedState(state) || isAutoRunPausedState(state) || autoRunActive) {
    throw new Error('自动运行已在进行中，请先停止后再重新计划。');
  }
  if (getPendingAutoRunTimerPlan(state)) {
    throw new Error('已有自动运行倒计时计划，请先取消或立即开始。');
  }

  const delayMinutes = normalizeAutoRunDelayMinutes(options.delayMinutes);
  const sessionId = createAutoRunSessionId();
  const timerPlan = normalizeAutoRunTimerPlan({
    kind: AUTO_RUN_TIMER_KIND_SCHEDULED_START,
    fireAt: Date.now() + delayMinutes * 60 * 1000,
    totalRuns,
    autoRunSkipFailures: options.autoRunSkipFailures,
    autoRunSessionId: sessionId,
    mode: options.mode,
  });

  autoRunCurrentRun = 0;
  autoRunTotalRuns = timerPlan.totalRuns;
  autoRunAttemptRun = 0;
  autoRunSessionId = sessionId;

  await persistAutoRunTimerPlan(timerPlan, {
    autoRunSkipFailures: timerPlan.autoRunSkipFailures,
    autoRunRoundSummaries: serializeAutoRunRoundSummaries(timerPlan.totalRuns, []),
  });
  await addLog(
    `自动运行已计划：${delayMinutes} 分钟后启动（${formatAutoRunScheduleTime(timerPlan.fireAt)}），目标 ${timerPlan.totalRuns} 轮。`,
    'info'
  );
  return { ok: true, scheduledAt: timerPlan.fireAt };
}

async function cancelScheduledAutoRun(options = {}) {
  const state = await getState();
  const plan = getPendingAutoRunTimerPlan(state);
  if (!plan || plan.kind !== AUTO_RUN_TIMER_KIND_SCHEDULED_START) {
    return false;
  }

  autoRunCurrentRun = 0;
  autoRunTotalRuns = plan.totalRuns;
  autoRunAttemptRun = 0;
  clearCurrentAutoRunSessionId(plan.autoRunSessionId);
  await broadcastAutoRunStatus(
    'idle',
    {
      currentRun: 0,
      totalRuns: plan.totalRuns,
      attemptRun: 0,
      sessionId: 0,
    },
    {
      autoRunSessionId: 0,
      autoRunRoundSummaries: [],
      autoRunTimerPlan: null,
      scheduledAutoRunPlan: null,
    }
  );
  await clearAutoRunTimerAlarm();
  if (options.logMessage !== false) {
    await addLog(options.logMessage || '已取消自动运行倒计时计划。', 'warn');
  }
  return true;
}

async function restoreAutoRunTimerIfNeeded() {
  const state = await getState();
  let plan = getPendingAutoRunTimerPlan(state);
  if (!plan) {
    clearCurrentAutoRunSessionId();
    if (state.autoRunPhase === 'scheduled' || state.autoRunPhase === 'waiting_interval') {
      await clearAutoRunTimerAlarm();
      await broadcastAutoRunStatus('idle', {
        currentRun: 0,
        totalRuns: 1,
        attemptRun: 0,
        sessionId: 0,
      }, {
        autoRunSessionId: 0,
        autoRunRoundSummaries: [],
        autoRunTimerPlan: null,
        scheduledAutoRunPlan: null,
      });
    }
    return;
  }

  if (!plan.autoRunSessionId) {
    const restoredSessionId = createAutoRunSessionId();
    plan = await persistAutoRunTimerPlan({
      ...plan,
      autoRunSessionId: restoredSessionId,
    }, {
      autoRunSkipFailures: plan.autoRunSkipFailures,
      autoRunRoundSummaries: serializeAutoRunRoundSummaries(plan.totalRuns, plan.roundSummaries),
    });
  } else {
    setCurrentAutoRunSessionId(plan.autoRunSessionId);
  }

  if (plan.fireAt <= Date.now()) {
    await launchAutoRunTimerPlan('restore');
    return;
  }

  const statusPayload = getAutoRunTimerStatusPayload(plan);
  await broadcastAutoRunStatus(
    statusPayload.phase,
    statusPayload,
    {
      autoRunSessionId: plan.autoRunSessionId,
      autoRunSkipFailures: plan.autoRunSkipFailures,
      autoRunRoundSummaries: serializeAutoRunRoundSummaries(plan.totalRuns, plan.roundSummaries),
      autoRunTimerPlan: plan,
      scheduledAutoRunPlan: null,
    }
  );
  await ensureAutoRunTimerAlarm(plan.fireAt);
}

async function ensureManualInteractionAllowed(actionLabel) {
  const state = await getState();

  if (isAutoRunLockedState(state)) {
    throw new Error(`自动流程运行中，请先停止后再${actionLabel}。`);
  }
  if (isAutoRunPausedState(state)) {
    throw new Error(`自动流程当前已暂停。请点击“继续”，或先确认接管自动流程后再${actionLabel}。`);
  }
  if (isAutoRunScheduledState(state)) {
    throw new Error(`自动流程已计划启动。请先取消计划，或立即开始后再${actionLabel}。`);
  }

  return state;
}

async function skipStep(step) {
  const state = await ensureManualInteractionAllowed('跳过步骤');
  const activeStepIds = typeof getStepIdsForState === 'function'
    ? getStepIdsForState(state)
    : (typeof STEP_IDS !== 'undefined' && Array.isArray(STEP_IDS) && STEP_IDS.length
      ? STEP_IDS
      : Array.from({ length: typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10 }, (_, index) => index + 1));

  if (!Number.isInteger(step) || !activeStepIds.includes(step)) {
    throw new Error(`无效步骤：${step}`);
  }

  const statuses = { ...(state.stepStatuses || {}) };
  const currentStatus = statuses[step];
  if (currentStatus === 'running') {
    throw new Error(`步骤 ${step} 正在运行中，不能跳过。`);
  }
  if (isStepDoneStatus(currentStatus)) {
    throw new Error(`步骤 ${step} 已完成，无需再跳过。`);
  }

  const currentIndex = activeStepIds.indexOf(step);
  if (currentIndex > 0) {
    const prevStep = activeStepIds[currentIndex - 1];
    const prevStatus = statuses[prevStep];
    if (!isStepDoneStatus(prevStatus)) {
      throw new Error(`请先完成步骤 ${prevStep}，再跳过步骤 ${step}。`);
    }
  }

  await setStepStatus(step, 'skipped');
  await addLog(`步骤 ${step} 已跳过`, 'warn');

  if (step === 1) {
    const latestState = await getState();
    const skippedSteps = [];
    for (let linkedStep = 2; linkedStep <= 5; linkedStep += 1) {
      const linkedStatus = latestState.stepStatuses?.[linkedStep];
      if (!isStepDoneStatus(linkedStatus) && linkedStatus !== 'running') {
        await setStepStatus(linkedStep, 'skipped');
        skippedSteps.push(linkedStep);
      }
    }
    if (skippedSteps.length) {
      await addLog(`步骤 1 已跳过，步骤 ${skippedSteps.join('、')} 也已同时跳过。`, 'warn');
    }
  }

  return { ok: true, step, status: 'skipped' };
}

function throwIfStopped(error = null) {
  const errorMessage = typeof error === 'string' ? error : error?.message;
  if (errorMessage === STOP_ERROR_MESSAGE) {
    throw error instanceof Error ? error : new Error(STOP_ERROR_MESSAGE);
  }
  if (stopRequested) {
    throw new Error(STOP_ERROR_MESSAGE);
  }
}

async function sleepWithStop(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    throwIfStopped();
    await new Promise(r => setTimeout(r, Math.min(100, ms - (Date.now() - start))));
  }
}

async function humanStepDelay(min = HUMAN_STEP_DELAY_MIN, max = HUMAN_STEP_DELAY_MAX) {
  const duration = Math.floor(Math.random() * (max - min + 1)) + min;
  await sleepWithStop(duration);
}

async function clickWithDebugger(tabId, rect, options = {}) {
  const visibleStep = Math.floor(Number(options.visibleStep) || 0) || 9;
  throwIfStopped();
  if (!tabId) {
    throw new Error('未找到用于调试点击的认证页面标签页。');
  }
  if (!rect || !Number.isFinite(rect.centerX) || !Number.isFinite(rect.centerY)) {
    throw new Error(`步骤 ${visibleStep} 的调试器兜底点击需要有效的按钮坐标。`);
  }

  const target = { tabId };
  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (err) {
    throw new Error(
      `步骤 ${visibleStep} 的调试器兜底点击附加失败：${err.message}。` +
      '如果认证页标签已打开 DevTools，请先关闭后重试。'
    );
  }

  try {
    throwIfStopped();
    const x = Math.round(rect.centerX);
    const y = Math.round(rect.centerY);

    await chrome.debugger.sendCommand(target, 'Page.bringToFront');
    throwIfStopped();
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x,
      y,
      button: 'none',
      buttons: 0,
      clickCount: 0,
    });
    throwIfStopped();
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    throwIfStopped();
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
  } finally {
    await chrome.debugger.detach(target).catch(() => { });
  }
}

async function broadcastStopToContentScripts() {
  const registry = await getTabRegistry();
  for (const entry of Object.values(registry)) {
    if (!entry?.tabId) continue;
    try {
      await chrome.tabs.sendMessage(entry.tabId, {
        type: 'STOP_FLOW',
        source: 'background',
        payload: {},
      });
    } catch { }
  }
}

let stopRequested = false;

// ============================================================
// Message Handler (central router)
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(LOG_PREFIX, `Received: ${message.type} from ${message.source || 'sidepanel'}`, message);

  handleMessage(message, sender).then(response => {
    sendResponse(response);
  }).catch(err => {
    console.error(LOG_PREFIX, 'Handler error:', err);
    sendResponse({ error: err.message });
  });

  return true; // async response
});

async function handleMessage(message, sender) {
  return messageRouter.handleMessage(message, sender);
}

// ============================================================
// Step Data Handlers
// ============================================================

async function handleStepData(step, payload) {
  if (typeof messageRouter !== 'undefined' && messageRouter?.handleStepData) {
    return messageRouter.handleStepData(step, payload);
  }

  switch (step) {
    case 1: {
      const updates = {};
      if (payload.oauthUrl) {
        updates.oauthUrl = payload.oauthUrl;
        broadcastDataUpdate({ oauthUrl: payload.oauthUrl });
      }
      if (payload.sub2apiSessionId !== undefined) updates.sub2apiSessionId = payload.sub2apiSessionId || null;
      if (payload.sub2apiOAuthState !== undefined) updates.sub2apiOAuthState = payload.sub2apiOAuthState || null;
      if (payload.sub2apiGroupId !== undefined) updates.sub2apiGroupId = payload.sub2apiGroupId || null;
      if (payload.sub2apiDraftName !== undefined) updates.sub2apiDraftName = payload.sub2apiDraftName || null;
      if (payload.sub2apiProxyId !== undefined) updates.sub2apiProxyId = payload.sub2apiProxyId || null;
      if (payload.cpaOAuthState !== undefined) updates.cpaOAuthState = payload.cpaOAuthState || null;
      if (payload.cpaManagementOrigin !== undefined) updates.cpaManagementOrigin = payload.cpaManagementOrigin || null;
      if (payload.codex2apiSessionId !== undefined) updates.codex2apiSessionId = payload.codex2apiSessionId || null;
      if (payload.codex2apiOAuthState !== undefined) updates.codex2apiOAuthState = payload.codex2apiOAuthState || null;
      if (payload.sub2apiGroupIds !== undefined) updates.sub2apiGroupIds = Array.isArray(payload.sub2apiGroupIds)
        ? payload.sub2apiGroupIds
        : [];
      if (Object.keys(updates).length) {
        await setState(updates);
      }
      break;
    }
    case 2:
      if (payload.email) await setEmailState(payload.email);
      if (payload.accountIdentifierType || payload.accountIdentifier || payload.signupPhoneNumber || payload.signupPhoneActivation) {
        await setState({
          accountIdentifierType: payload.accountIdentifierType || null,
          accountIdentifier: String(payload.accountIdentifier || '').trim(),
          signupPhoneNumber: String(payload.signupPhoneNumber || '').trim(),
          signupPhoneActivation: payload.signupPhoneActivation || null,
        });
      }
      if (payload.skippedPasswordStep) {
        const latestState = await getState();
        const step3Status = latestState.stepStatuses?.[3];
        if (step3Status !== 'running' && step3Status !== 'completed' && step3Status !== 'manual_completed') {
          await setStepStatus(3, 'skipped');
          const identityLabel = payload.accountIdentifierType === 'phone' ? '手机号' : '邮箱';
          await addLog(`步骤 2：提交${identityLabel}后页面直接进入验证码页，已自动跳过步骤 3。`, 'warn');
        }
      }
      break;
    case 3:
      if (payload.email) await setEmailState(payload.email);
      if (payload.signupVerificationRequestedAt) {
        await setState({ signupVerificationRequestedAt: payload.signupVerificationRequestedAt });
      }
      if (payload.skipProfileStep) {
        const latestState = await getState();
        const step5Status = latestState.stepStatuses?.[5];
        if (step5Status !== 'running' && step5Status !== 'completed' && step5Status !== 'manual_completed') {
          await setStepStatus(5, 'skipped');
          await addLog('步骤 3：页面已直接进入已登录态，已自动跳过步骤 5。', 'warn');
        }
      }
      if (payload.loginVerificationRequestedAt) {
        await setState({ loginVerificationRequestedAt: payload.loginVerificationRequestedAt });
      }
      break;
    case 7:
      if (payload.loginVerificationRequestedAt) {
        await setState({ loginVerificationRequestedAt: payload.loginVerificationRequestedAt });
      }
      break;
    case 4:
      await setState({
    ...(payload.phoneVerification ? {
          currentPhoneVerificationCode: '',
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: '',
        } : {
          lastEmailTimestamp: payload.emailTimestamp || null,
        }),
        signupVerificationRequestedAt: null,
      });
      break;
    case 8:
      await setState({
        ...(payload.phoneVerification || payload.loginPhoneVerification ? {
          currentPhoneVerificationCode: '',
          signupPhoneVerificationRequestedAt: null,
          signupPhoneVerificationPurpose: '',
        } : {
          lastEmailTimestamp: payload.emailTimestamp || null,
        }),
        loginVerificationRequestedAt: null,
      });
      break;
    case 9:
      if (payload.localhostUrl) {
        if (!isLocalhostOAuthCallbackUrl(payload.localhostUrl)) {
          throw new Error('步骤 9 返回了无效的 localhost OAuth 回调地址。');
        }
        await setState({
          localhostUrl: payload.localhostUrl,
          oauthFlowDeadlineAt: null,
          oauthFlowDeadlineSourceUrl: null,
        });
        broadcastDataUpdate({ localhostUrl: payload.localhostUrl });
      }
      break;
  }
}

// ============================================================
// Step Completion Waiting
// ============================================================

// Map of step -> { resolve, reject } for waiting on step completion
const stepWaiters = new Map();
let resumeWaiter = null;
const AUTO_RUN_SIGNAL_COMPLETION_TIMEOUT_MS = 120000;
const AUTO_RUN_BACKGROUND_COMPLETED_STEPS = new Set([1, 2, 4, 6, 7, 8, 9]);
const STEP_COMPLETION_SIGNAL_STEPS = new Set([3, 5, 10, 12]);
const AUTO_RUN_BACKGROUND_COMPLETED_STEP_KEYS = new Set([
  'open-chatgpt',
  'submit-signup-email',
  'fetch-signup-code',
  'wait-registration-success',
  'plus-checkout-create',
  'plus-checkout-billing',
  'paypal-approve',
  'plus-checkout-return',
  'oauth-login',
  'fetch-login-code',
  'confirm-oauth',
]);
const STEP_COMPLETION_SIGNAL_STEP_KEYS = new Set([
  'fill-password',
  'fill-profile',
  'gopay-subscription-confirm',
  'platform-verify',
]);
const STEP_COMPLETION_SIGNAL_TIMEOUTS_BY_STEP_KEY = new Map([
  ['gopay-subscription-confirm', 1800000],
]);
const AUTO_RUN_PRE_EXECUTION_DELAYS_BY_STEP_KEY = new Map([
  ['plus-checkout-create', 20000],
]);

function waitForStepComplete(step, timeoutMs = 120000) {
  throwIfStopped();
  const normalizedStep = Number(step);
  const existingWaiter = stepWaiters.get(normalizedStep);
  if (existingWaiter?.promise) {
    console.log(LOG_PREFIX, `[waitForStepComplete] reuse existing waiter for step ${normalizedStep}`);
    return existingWaiter.promise;
  }

  console.log(LOG_PREFIX, `[waitForStepComplete] register step ${normalizedStep}, timeout=${timeoutMs}ms`);
  const waiter = {
    promise: null,
    resolve: null,
    reject: null,
  };

  waiter.promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (stepWaiters.get(normalizedStep) === waiter) {
        stepWaiters.delete(normalizedStep);
      }
      console.warn(LOG_PREFIX, `[waitForStepComplete] timeout for step ${normalizedStep} after ${timeoutMs}ms`);
      reject(new Error(`步骤 ${normalizedStep} 等待超时（>${timeoutMs / 1000} 秒）`));
    }, timeoutMs);

    waiter.resolve = (data) => {
      clearTimeout(timer);
      if (stepWaiters.get(normalizedStep) === waiter) {
        stepWaiters.delete(normalizedStep);
      }
      resolve(data);
    };
    waiter.reject = (err) => {
      clearTimeout(timer);
      if (stepWaiters.get(normalizedStep) === waiter) {
        stepWaiters.delete(normalizedStep);
      }
      reject(err);
    };
  });

  stepWaiters.set(normalizedStep, waiter);
  return waiter.promise;
}

function getStepExecutionKeyForState(step, state = {}) {
  if (typeof getStepDefinitionForState !== 'function') {
    return '';
  }
  return String(getStepDefinitionForState(step, state)?.key || '').trim();
}

function doesStepUseBackgroundCompletion(step, state = {}) {
  const stepKey = getStepExecutionKeyForState(step, state);
  if (stepKey) {
    return AUTO_RUN_BACKGROUND_COMPLETED_STEP_KEYS.has(stepKey);
  }
  return AUTO_RUN_BACKGROUND_COMPLETED_STEPS.has(step);
}

function doesStepUseCompletionSignal(step, state = {}) {
  const stepKey = getStepExecutionKeyForState(step, state);
  if (stepKey) {
    return STEP_COMPLETION_SIGNAL_STEP_KEYS.has(stepKey);
  }
  return STEP_COMPLETION_SIGNAL_STEPS.has(step);
}

function getAutoRunPreExecutionDelayMs(step, state = {}) {
  const stepKey = getStepExecutionKeyForState(step, state);
  if (stepKey) {
    return AUTO_RUN_PRE_EXECUTION_DELAYS_BY_STEP_KEY.get(stepKey) || 0;
  }
  return 0;
}

function getStepCompletionSignalTimeoutMs(step, state = {}) {
  const stepKey = getStepExecutionKeyForState(step, state);
  if (stepKey) {
    return STEP_COMPLETION_SIGNAL_TIMEOUTS_BY_STEP_KEY.get(stepKey) || AUTO_RUN_SIGNAL_COMPLETION_TIMEOUT_MS;
  }
  return AUTO_RUN_SIGNAL_COMPLETION_TIMEOUT_MS;
}

function notifyStepComplete(step, payload) {
  const waiter = stepWaiters.get(step);
  console.log(LOG_PREFIX, `[notifyStepComplete] step ${step}, hasWaiter=${Boolean(waiter)}`);
  if (waiter) waiter.resolve(payload);
}

function notifyStepError(step, error) {
  const waiter = stepWaiters.get(step);
  console.warn(LOG_PREFIX, `[notifyStepError] step ${step}, hasWaiter=${Boolean(waiter)}, error=${error}`);
  if (waiter) waiter.reject(new Error(error));
}

async function runCompletedStepSideEffects(step, payload, completionState, lastStepId) {
  await handleStepData(step, payload);
  if (step === lastStepId) {
    await appendAndBroadcastAccountRunRecord('success', completionState);
  }
}

async function reportCompletedStepSideEffectError(step, error) {
  const message = getErrorMessage(error);
  console.warn(LOG_PREFIX, `[completeStepFromBackground] step ${step} post-completion side effect failed:`, error);
  await addLog(`已完成，但完成后的收尾处理失败：${message}`, 'warn', { step });
}

async function completeStepFromBackground(step, payload = {}) {
  if (stopRequested) {
    await setStepStatus(step, 'stopped');
    await appendManualAccountRunRecordIfNeeded(`step${step}_stopped`, null, STOP_ERROR_MESSAGE);
    notifyStepError(step, STOP_ERROR_MESSAGE);
    return;
  }

  const latestState = await getState();
  const lastStepId = typeof getLastStepIdForState === 'function'
    ? getLastStepIdForState(latestState)
    : (typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10);
  const completionState = step === lastStepId ? latestState : null;
  await setStepStatus(step, 'completed');
  await addLog('已完成', 'ok', { step });

  if (step === lastStepId) {
    notifyStepComplete(step, payload);
    void runCompletedStepSideEffects(step, payload, completionState, lastStepId)
      .catch((error) => reportCompletedStepSideEffectError(step, error));
    return;
  }

  await runCompletedStepSideEffects(step, payload, completionState, lastStepId);
  notifyStepComplete(step, payload);
}

async function appendManualAccountRunRecordIfNeeded(status, stateOverride = null, reason = '') {
  if (!accountRunHistoryHelpers?.appendAccountRunRecord) {
    return null;
  }

  const state = stateOverride || await getState();
  return appendAndBroadcastAccountRunRecord(status, state, reason);
}

async function finalizeDeferredStepExecutionError(step, error) {
  const latestState = await getState();
  const currentStatus = latestState.stepStatuses?.[step];
  if (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'stopped') {
    return;
  }

  if (isStopError(error)) {
    await setStepStatus(step, 'stopped');
    await addLog('已被用户停止', 'warn', { step });
    await appendManualAccountRunRecordIfNeeded(`step${step}_stopped`, latestState, getErrorMessage(error));
    return;
  }

  await setStepStatus(step, 'failed');
  await addLog(`失败：${getErrorMessage(error)}`, 'error', { step });
  await appendManualAccountRunRecordIfNeeded(`step${step}_failed`, latestState, getErrorMessage(error));
}

async function executeStepViaCompletionSignal(step, timeoutMs = 0) {
  const executionState = await getState();
  const resolvedTimeoutMs = Number(timeoutMs) > 0
    ? timeoutMs
    : getStepCompletionSignalTimeoutMs(step, executionState);
  const completionResultPromise = waitForStepComplete(step, resolvedTimeoutMs).then(
    payload => ({ ok: true, payload }),
    error => ({ ok: false, error }),
  );

  let executeError = null;
  try {
    await executeStep(step, { deferRetryableTransportError: true });
  } catch (err) {
    executeError = err;
    if (isStopError(err) || !isRetryableContentScriptTransportError(err)) {
      notifyStepError(step, getErrorMessage(err));
    }
  }

  const completionResult = await completionResultPromise;
  if (completionResult.ok) {
    if (executeError) {
      console.warn(
        LOG_PREFIX,
        `[executeStepViaCompletionSignal] step ${step} completed after deferred execute error: ${getErrorMessage(executeError)}`
      );
    }
    return completionResult.payload;
  }

  if (executeError && isRetryableContentScriptTransportError(executeError)) {
    const completionMessage = getErrorMessage(completionResult.error);
    if (/等待超时/.test(completionMessage)) {
      await finalizeDeferredStepExecutionError(step, executeError);
      throw executeError;
    }
    throw completionResult.error;
  }

  if (executeError) {
    throw executeError;
  }

  throw completionResult.error;
}

async function waitForRunningStepsToFinish(payload = {}) {
  let currentState = await getState();
  let runningSteps = getRunningSteps(currentState.stepStatuses, currentState);
  if (!runningSteps.length) {
    return currentState;
  }

  await addLog(`自动继续：检测到步骤 ${runningSteps.join(', ')} 正在运行，等待完成后再继续自动流程...`, 'info');
  await broadcastAutoRunStatus('waiting_step', payload);

  while (runningSteps.length) {
    await sleepWithStop(250);
    currentState = await getState();
    runningSteps = getRunningSteps(currentState.stepStatuses, currentState);
  }

  await addLog('自动继续：当前运行步骤已结束，准备按最新进度继续自动流程...', 'info');
  return currentState;
}

const AUTH_CHAIN_STEP_IDS = new Set([7, 8, 9, 10, 11, 12, 13]);
const AUTH_CHAIN_STEP_KEYS = new Set([
  'oauth-login',
  'fetch-login-code',
  'confirm-oauth',
  'platform-verify',
]);
let activeTopLevelAuthChainExecution = null;

function isAuthChainStep(step, state = {}) {
  const stepKey = typeof getStepDefinitionForState === 'function'
    ? String(getStepDefinitionForState(step, state)?.key || '').trim()
    : '';
  if (stepKey && typeof AUTH_CHAIN_STEP_KEYS !== 'undefined') {
    return AUTH_CHAIN_STEP_KEYS.has(stepKey);
  }
  return AUTH_CHAIN_STEP_IDS.has(Number(step));
}

async function acquireTopLevelAuthChainExecution(step, state = {}) {
  const normalizedStep = Number(step);
  if (!isAuthChainStep(normalizedStep, state)) {
    return {
      joined: false,
      release() {},
    };
  }

  if (activeTopLevelAuthChainExecution) {
    const activeExecution = activeTopLevelAuthChainExecution;
    await addLog(
      `步骤 ${normalizedStep}：检测到步骤 ${activeExecution.step} 正在运行，本次请求将复用当前授权链，不再重复启动。`,
      'warn'
    );
    const result = await activeExecution.promise;
    if (result?.error) {
      throw result.error;
    }
    return {
      joined: true,
      release() {},
    };
  }

  let settleExecution = () => {};
  const promise = new Promise((resolve) => {
    settleExecution = (error = null) => resolve({ error });
  });
  const execution = {
    step: normalizedStep,
    promise,
  };
  activeTopLevelAuthChainExecution = execution;

  return {
    joined: false,
    release(error = null) {
      if (activeTopLevelAuthChainExecution === execution) {
        activeTopLevelAuthChainExecution = null;
      }
      settleExecution(error);
    },
  };
}

async function markRunningStepsStopped() {
  const state = await getState();
  const runningSteps = getRunningSteps(state.stepStatuses, state);

  for (const step of runningSteps) {
    await setStepStatus(step, 'stopped');
  }
}

async function requestStop(options = {}) {
  const { logMessage = '已收到停止请求，正在取消当前操作...' } = options;
  const state = await getState();
  const runningSteps = getRunningSteps(state.stepStatuses, state);
  const inferredStopStep = inferStoppedRecordStep(state);
  const timerPlan = getPendingAutoRunTimerPlan(state);

  if (timerPlan?.kind === AUTO_RUN_TIMER_KIND_SCHEDULED_START && !autoRunActive) {
    await cancelScheduledAutoRun({
      logMessage: options.logMessage === false
        ? false
        : (options.logMessage || '已取消自动运行倒计时计划。'),
    });
    return;
  }

  if (timerPlan && !autoRunActive) {
    autoRunCurrentRun = timerPlan.currentRun;
    autoRunTotalRuns = timerPlan.totalRuns;
    autoRunAttemptRun = timerPlan.attemptRun;
    clearCurrentAutoRunSessionId(timerPlan.autoRunSessionId);
    if (options.logMessage !== false) {
      await addLog(options.logMessage || '已停止等待中的自动流程。', 'warn');
    }
    await broadcastAutoRunStatus('stopped', {
      currentRun: timerPlan.currentRun,
      totalRuns: timerPlan.totalRuns,
      attemptRun: timerPlan.attemptRun,
      sessionId: 0,
    }, {
      autoRunSessionId: 0,
      autoRunSkipFailures: timerPlan.autoRunSkipFailures,
      autoRunRoundSummaries: serializeAutoRunRoundSummaries(timerPlan.totalRuns, timerPlan.roundSummaries),
      autoRunTimerPlan: null,
      scheduledAutoRunPlan: null,
    });
    await clearAutoRunTimerAlarm();
    clearStopRequest();
    return;
  }

  if (stopRequested) return;

  stopRequested = true;
  clearCurrentAutoRunSessionId();
  cancelPendingCommands();
  abortActiveIcloudRequests();
  cleanupStep8NavigationListeners();
  rejectPendingStep8(new Error(STOP_ERROR_MESSAGE));

  await addLog(logMessage, 'warn');
  await broadcastStopToContentScripts();

  if (!runningSteps.length && Number.isInteger(inferredStopStep) && inferredStopStep > 0) {
    await appendAndBroadcastAccountRunRecord('stopped', state, STOP_ERROR_MESSAGE);
  }

  for (const waiter of stepWaiters.values()) {
    waiter.reject(new Error(STOP_ERROR_MESSAGE));
  }
  stepWaiters.clear();

  if (state.plusManualConfirmationPending) {
    const clearManualConfirmationState = {
      plusManualConfirmationPending: false,
      plusManualConfirmationRequestId: '',
      plusManualConfirmationStep: 0,
      plusManualConfirmationMethod: '',
      plusManualConfirmationTitle: '',
      plusManualConfirmationMessage: '',
    };
    await setState(clearManualConfirmationState);
    broadcastDataUpdate(clearManualConfirmationState);
  }

  if (resumeWaiter) {
    resumeWaiter.reject(new Error(STOP_ERROR_MESSAGE));
    resumeWaiter = null;
  }

  await markRunningStepsStopped();
  autoRunActive = false;
  await broadcastAutoRunStatus('stopped', {
    currentRun: autoRunCurrentRun,
    totalRuns: autoRunTotalRuns,
    attemptRun: autoRunAttemptRun,
    sessionId: 0,
  }, {
    autoRunSessionId: 0,
    autoRunTimerPlan: null,
    scheduledAutoRunPlan: null,
  });
}

// ============================================================
// Step Execution
// ============================================================

const STEP_FETCH_NETWORK_RETRY_POLICIES = new Map([
  [4, { maxAttempts: 3, cooldownMs: 12000 }],
  [8, { maxAttempts: 3, cooldownMs: 12000 }],
  [9, { maxAttempts: 3, cooldownMs: 12000 }],
]);

async function executeStep(step, options = {}) {
  const { deferRetryableTransportError = false } = options;
  console.log(LOG_PREFIX, `Executing step ${step}`);
  let state = await getState();
  const authChainClaim = await acquireTopLevelAuthChainExecution(step, state);
  if (authChainClaim.joined) {
    return;
  }

  let executionError = null;
  throwIfStopped();
  try {
    await setStepStatus(step, 'running');
    await addLog('开始执行', 'info', { step });
    await humanStepDelay();
    const fetchRetryPolicy = typeof getStepFetchNetworkRetryPolicy === 'function'
      ? getStepFetchNetworkRetryPolicy(step)
      : null;
    const isFetchRetryable = (error) => {
      if (typeof isStepFetchNetworkRetryableError === 'function') {
        return isStepFetchNetworkRetryableError(error);
      }
      return isRetryableContentScriptTransportError(error);
    };
    let attempt = 1;

    while (true) {
      state = await getState();

      // Set flow start time on first step
      if (step === 1 && !state.flowStartTime) {
        await setState({ flowStartTime: Date.now() });
      }

      const activeStepRegistry = getStepRegistryForState(state);
      if (!activeStepRegistry?.getStepDefinition?.(step)) {
        throw new Error(`当前模式下不存在步骤：${step}`);
      }

      try {
        await activeStepRegistry.executeStep(step, {
          ...state,
          visibleStep: Number(step),
          stepDefinition: getStepDefinitionForState(step, state),
        });

        if (attempt > 1) {
          await addLog(
            `[NETWORK_FETCH_RETRY] 步骤 ${step}：网络请求异常已恢复，当前重试成功（${attempt}/${fetchRetryPolicy?.maxAttempts || attempt}）。`,
            'ok'
          );
        }
        break;
      } catch (attemptError) {
        if (!fetchRetryPolicy || !isFetchRetryable(attemptError) || attempt >= fetchRetryPolicy.maxAttempts) {
          throw attemptError;
        }

        const nextAttempt = attempt + 1;
        const cooldownMs = fetchRetryPolicy.cooldownMs;
        const cooldownSeconds = Math.max(1, Math.ceil(cooldownMs / 1000));
        await addLog(
          `[NETWORK_FETCH_RETRY] 步骤 ${step}：检测到网络请求异常（${getErrorMessage(attemptError)}），${cooldownSeconds} 秒后重试（${nextAttempt}/${fetchRetryPolicy.maxAttempts}）。`,
          'warn'
        );
        if (cooldownMs > 0) {
          await sleepWithStop(cooldownMs);
        }
        attempt = nextAttempt;
      }
    }
  } catch (err) {
    executionError = err;
    const errorState = await getState();
    if (isStopError(err)) {
      await setStepStatus(step, 'stopped');
      await addLog('已被用户停止', 'warn', { step });
      await appendManualAccountRunRecordIfNeeded(`step${step}_stopped`, errorState, getErrorMessage(err));
      throw err;
    }
    if (isTerminalSecurityBlockedError(err)) {
      await handleCloudflareSecurityBlocked(err);
      throw new Error(STOP_ERROR_MESSAGE);
    }
    if (isBrowserSwitchRequiredError(err)) {
      await handleBrowserSwitchRequired(err);
      throw new Error(STOP_ERROR_MESSAGE);
    }
    if (!(deferRetryableTransportError && doesStepUseCompletionSignal(step, errorState) && isRetryableContentScriptTransportError(err))) {
      await setStepStatus(step, 'failed');
      await addLog(`失败：${err.message}`, 'error', { step });
      await appendManualAccountRunRecordIfNeeded(`step${step}_failed`, errorState, getErrorMessage(err));
    } else {
      console.warn(
        LOG_PREFIX,
        `[executeStep] deferring retryable transport error for step ${step}: ${getErrorMessage(err)}`
      );
    }
    throw err;
  } finally {
    authChainClaim.release(executionError);
  }
}

/**
 * Execute a step and wait for it to complete before returning.
 * @param {number} step
 * @param {number} delayAfter - ms to wait after completion (for page transitions)
 */
async function executeStepAndWait(step, delayAfter = 2000) {
  throwIfStopped();

  const delaySeconds = normalizeAutoStepDelaySeconds((await getState()).autoStepDelaySeconds, null);
  if (delaySeconds > 0) {
    await addLog(
      `自动运行：步骤 ${step} 执行前额外等待 ${delaySeconds} 秒，避免节奏过快。`,
      'info'
    );
    await sleepWithStop(delaySeconds * 1000);
  }

  let executionState = await getState();
  const preExecutionDelayMs = getAutoRunPreExecutionDelayMs(step, executionState);
  if (preExecutionDelayMs > 0) {
    await addLog(
      `自动运行：步骤 ${step} 执行前固定等待 ${Math.round(preExecutionDelayMs / 1000)} 秒，确保 Plus Checkout 创建前页面稳定。`,
      'info'
    );
    await sleepWithStop(preExecutionDelayMs);
    executionState = await getState();
  }

  if (doesStepUseBackgroundCompletion(step, executionState)) {
    await addLog(`自动运行：步骤 ${step} 由后台流程负责收尾，执行函数返回后将直接进入下一步。`, 'info');
    await executeStep(step);
    const latestState = await getState();
    await addLog(`自动运行：步骤 ${step} 已执行返回，当前状态为 ${latestState.stepStatuses?.[step] || 'pending'}，准备继续后续步骤。`, 'info');
  } else if (doesStepUseCompletionSignal(step, executionState)) {
    await addLog(`自动运行：步骤 ${step} 已发起，正在等待完成信号（超时 ${AUTO_RUN_SIGNAL_COMPLETION_TIMEOUT_MS / 1000} 秒）。`, 'info');
    await executeStepViaCompletionSignal(step, AUTO_RUN_SIGNAL_COMPLETION_TIMEOUT_MS);
    await addLog(`自动运行：步骤 ${step} 已收到完成信号，准备继续后续步骤。`, 'info');
  } else {
    await executeStep(step);
  }

  if (step === 5) {
    const signupTabId = await getTabId('signup-page');
    if (signupTabId) {
      await addLog('自动运行：步骤 5 已收到完成信号，正在等待当前页面完成加载并稳定...', 'info');
      await waitForTabStableComplete(signupTabId, {
        timeoutMs: 30000,
        retryDelayMs: 300,
        stableMs: 1000,
        initialDelayMs: 800,
      });
    }
  }

  // Extra delay for page transitions / DOM updates
  if (delayAfter > 0) {
    await sleepWithStop(delayAfter + Math.floor(Math.random() * 1200));
  }
}

function getEmailGeneratorLabel(generator) {
  const customEmailPoolGenerator = typeof CUSTOM_EMAIL_POOL_GENERATOR === 'string'
    ? CUSTOM_EMAIL_POOL_GENERATOR
    : 'custom-pool';
  const gmailAliasGenerator = typeof GMAIL_ALIAS_GENERATOR === 'string'
    ? GMAIL_ALIAS_GENERATOR
    : 'gmail-alias';
  if (generator === 'custom') {
    return '自定义邮箱';
  }
  if (generator === gmailAliasGenerator) {
    return 'Gmail +tag 邮箱';
  }
  if (generator === customEmailPoolGenerator) {
    return '自定义邮箱池';
  }
  if (generator === 'icloud') {
    return 'iCloud 隐私邮箱';
  }
  if (generator === 'cloudflare') return 'Cloudflare 邮箱';
  if (generator === CLOUDFLARE_TEMP_EMAIL_GENERATOR) return 'Cloudflare Temp Email';
  if (generator === CLOUD_MAIL_GENERATOR) return 'Cloud Mail';
  return 'Duck 邮箱';
}
const mail2925SessionManager = self.MultiPageBackgroundMail2925Session?.createMail2925SessionManager({
  addLog,
  broadcastDataUpdate,
  chrome,
  findMail2925Account,
  getMail2925AccountStatus,
  getState,
  isAutoRunLockedState,
  isMail2925AccountAvailable: self.Mail2925Utils?.isMail2925AccountAvailable,
  MAIL2925_LIMIT_COOLDOWN_MS,
  normalizeMail2925Account,
  normalizeMail2925Accounts,
  pickMail2925AccountForRun,
  requestStop,
  ensureContentScriptReadyOnTab,
  reuseOrCreateTab,
  sendToContentScriptResilient,
  sendToMailContentScriptResilient,
  setPersistentSettings,
  setState,
  sleepWithStop,
  throwIfStopped,
  upsertMail2925AccountInList,
  waitForTabComplete,
  waitForTabUrlMatch,
});

async function upsertMail2925Account(input = {}) {
  return mail2925SessionManager.upsertMail2925Account(input);
}

async function deleteMail2925Account(accountId) {
  return mail2925SessionManager.deleteMail2925Account(accountId);
}

async function deleteMail2925Accounts(mode = 'all') {
  return mail2925SessionManager.deleteMail2925Accounts(mode);
}

async function patchMail2925Account(accountId, updates = {}) {
  return mail2925SessionManager.patchMail2925Account(accountId, updates);
}

async function setCurrentMail2925Account(accountId, options = {}) {
  return mail2925SessionManager.setCurrentMail2925Account(accountId, options);
}

function getCurrentMail2925Account(state = null) {
  return mail2925SessionManager.getCurrentMail2925Account(state || {});
}

async function ensureMail2925AccountForFlow(options = {}) {
  return mail2925SessionManager.ensureMail2925AccountForFlow(options);
}

async function ensureMail2925MailboxSession(options = {}) {
  return mail2925SessionManager.ensureMail2925MailboxSession(options);
}

async function handleMail2925LimitReachedError(step, error) {
  return mail2925SessionManager.handleMail2925LimitReachedError(step, error);
}

function isMail2925LimitReachedError(error) {
  if (typeof mail2925SessionManager !== 'undefined' && mail2925SessionManager?.isMail2925LimitReachedError) {
    return mail2925SessionManager.isMail2925LimitReachedError(error);
  }
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /^MAIL2925_LIMIT_REACHED::/.test(message)
    || /子邮箱.{0,12}已达上限|已达上限邮箱|子邮箱上限|邮箱已达上限/i.test(message);
}

function isMail2925ThreadTerminatedError(error) {
  if (typeof mail2925SessionManager !== 'undefined' && mail2925SessionManager?.isMail2925ThreadTerminatedError) {
    return mail2925SessionManager.isMail2925ThreadTerminatedError(error);
  }
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /^MAIL2925_THREAD_TERMINATED::/.test(message);
}

function isMail2925PoolExhaustedPauseError(error) {
  if (typeof mail2925SessionManager !== 'undefined' && mail2925SessionManager?.isMail2925PoolExhaustedPauseError) {
    return mail2925SessionManager.isMail2925PoolExhaustedPauseError(error);
  }
  const message = String(typeof error === 'string' ? error : error?.message || '');
  return /^MAIL2925_POOL_EXHAUSTED_PAUSE::/.test(message);
}

const payPalAccountStore = self.MultiPageBackgroundPayPalAccountStore?.createPayPalAccountStore({
  broadcastDataUpdate,
  findPayPalAccount,
  getState,
  normalizePayPalAccount,
  normalizePayPalAccounts,
  setPersistentSettings,
  setState,
  upsertPayPalAccountInList,
});

async function syncPayPalAccounts(accounts) {
  return payPalAccountStore?.syncPayPalAccounts?.(accounts) || [];
}

async function upsertPayPalAccount(input = {}) {
  if (!payPalAccountStore?.upsertPayPalAccount) {
    throw new Error('PayPal 账号存储能力尚未接入。');
  }
  return payPalAccountStore.upsertPayPalAccount(input);
}

async function setCurrentPayPalAccount(accountId) {
  if (!payPalAccountStore?.setCurrentPayPalAccount) {
    throw new Error('PayPal 账号选择能力尚未接入。');
  }
  return payPalAccountStore.setCurrentPayPalAccount(accountId);
}

function getCurrentPayPalAccount(state = null) {
  return payPalAccountStore?.getCurrentPayPalAccount?.(state || {}) || null;
}

const generatedEmailHelpers = self.MultiPageGeneratedEmailHelpers?.createGeneratedEmailHelpers({
  addLog,
  buildGeneratedAliasEmail,
  buildCloudflareTempEmailHeaders,
  CLOUDFLARE_TEMP_EMAIL_GENERATOR,
  CUSTOM_EMAIL_POOL_GENERATOR,
  DUCK_AUTOFILL_URL,
  fetch,
  fetchIcloudHideMyEmail,
  getCloudflareTempEmailAddressFromResponse,
  getCloudflareTempEmailConfig,
  getCustomEmailPoolEmail: getCustomEmailPoolEmailForRun,
  getState,
  ensureMail2925AccountForFlow,
  joinCloudflareTempEmailUrl,
  normalizeCloudflareDomain,
  normalizeCloudflareTempEmailAddress,
  normalizeEmailGenerator,
  isGeneratedAliasProvider,
  reuseOrCreateTab,
  sendToContentScript,
  setEmailState,
  throwIfStopped,
});

function generateCloudflareAliasLocalPart() {
  return generatedEmailHelpers.generateCloudflareAliasLocalPart();
}

async function fetchCloudflareEmail(state, options = {}) {
  return generatedEmailHelpers.fetchCloudflareEmail(state, options);
}

function ensureCloudflareTempEmailConfig(state, options = {}) {
  return generatedEmailHelpers.ensureCloudflareTempEmailConfig(state, options);
}

async function requestCloudflareTempEmailJson(config, path, options = {}) {
  return generatedEmailHelpers.requestCloudflareTempEmailJson(config, path, options);
}

async function fetchCloudflareTempEmailAddress(state, options = {}) {
  return generatedEmailHelpers.fetchCloudflareTempEmailAddress(state, options);
}

async function fetchDuckEmail(options = {}) {
  return generatedEmailHelpers.fetchDuckEmail(options);
}

async function fetchGeneratedEmail(state, options = {}) {
  const currentState = state || await getState();
  const generator = normalizeEmailGenerator(options.generator ?? currentState.emailGenerator);
  if (generator === CLOUD_MAIL_GENERATOR) {
    return fetchCloudMailAddress(currentState, options);
  }
  return generatedEmailHelpers.fetchGeneratedEmail(state, options);
}

// ============================================================
// Auto Run Flow
// ============================================================

let autoRunActive = false;
let autoRunCurrentRun = 0;
let autoRunTotalRuns = 1;
let autoRunAttemptRun = 0;
let autoRunSessionId = 0;
let autoRunSessionSeed = 0;
let ipProxyAutoSyncRunning = false;
const EMAIL_FETCH_MAX_ATTEMPTS = 5;
const VERIFICATION_POLL_MAX_ROUNDS = 5;
const STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS = 25000;
const MAIL_2925_VERIFICATION_MAX_ATTEMPTS = 15;
const MAIL_2925_VERIFICATION_INTERVAL_MS = 15000;
const AUTO_STEP_DELAYS = {
  1: 2000,
  2: 2000,
  3: 3000,
  4: 2000,
  5: 0,
  6: 3000,
  7: 2000,
  8: 2000,
  9: 1000,
};
const accountRunHistoryHelpers = self.MultiPageBackgroundAccountRunHistory?.createAccountRunHistoryHelpers({
  ACCOUNT_RUN_HISTORY_STORAGE_KEY,
  addLog,
  buildLocalHelperEndpoint: (baseUrl, path) => buildHotmailLocalEndpoint(baseUrl, path),
  chrome,
  getErrorMessage,
  getState,
  normalizeAccountRunHistoryHelperBaseUrl,
});
const contributionOAuthManager = self.MultiPageBackgroundContributionOAuth?.createContributionOAuthManager({
  addLog,
  broadcastDataUpdate,
  chrome,
  closeLocalhostCallbackTabs,
  getState,
  setState,
});
contributionOAuthManager?.ensureCallbackListeners?.();

async function broadcastAccountRunHistoryUpdate() {
  if (!accountRunHistoryHelpers?.getPersistedAccountRunHistory) {
    return [];
  }

  const history = await accountRunHistoryHelpers.getPersistedAccountRunHistory();
  broadcastDataUpdate({ accountRunHistory: history });
  return history;
}

async function appendAndBroadcastAccountRunRecord(status, stateOverride = null, reason = '') {
  if (!accountRunHistoryHelpers?.appendAccountRunRecord) {
    return null;
  }

  const state = stateOverride || await getState();
  const resolvedStatus = resolveAccountRunRecordStatusForStop(status, state);
  const resolvedReason = resolveAccountRunRecordReasonForStop(resolvedStatus, reason);
  const record = await accountRunHistoryHelpers.appendAccountRunRecord(resolvedStatus, state, resolvedReason);
  if (!record) {
    return null;
  }

  await broadcastAccountRunHistoryUpdate();
  return record;
}

async function clearAndBroadcastAccountRunHistory(stateOverride = null) {
  if (!accountRunHistoryHelpers?.clearAccountRunHistory) {
    return { clearedCount: 0 };
  }

  const result = await accountRunHistoryHelpers.clearAccountRunHistory(stateOverride);
  await broadcastAccountRunHistoryUpdate();
  return result;
}

async function deleteAndBroadcastAccountRunHistoryRecords(recordIds = [], stateOverride = null) {
  if (!accountRunHistoryHelpers?.deleteAccountRunHistoryRecords) {
    return { deletedCount: 0, remainingCount: 0 };
  }

  const result = await accountRunHistoryHelpers.deleteAccountRunHistoryRecords(recordIds, stateOverride);
  await broadcastAccountRunHistoryUpdate();
  return result;
}

function resolveIpProxyCandidateCountForAutoSwitch(state = {}, mode = 'account', provider = DEFAULT_IP_PROXY_SERVICE) {
  const normalizedMode = typeof normalizeIpProxyMode === 'function'
    ? normalizeIpProxyMode(mode)
    : String(mode || 'account').trim().toLowerCase();
  const normalizedProvider = typeof normalizeIpProxyProviderValue === 'function'
    ? normalizeIpProxyProviderValue(provider)
    : String(provider || DEFAULT_IP_PROXY_SERVICE).trim().toLowerCase();
  if (normalizedMode === 'account' && typeof getAccountModeProxyPoolFromState === 'function') {
    const pool = getAccountModeProxyPoolFromState(state, normalizedProvider);
    return Array.isArray(pool) ? pool.length : 0;
  }
  if (typeof getIpProxyRuntimeSnapshot === 'function') {
    const runtime = getIpProxyRuntimeSnapshot(state, normalizedMode, normalizedProvider);
    return Array.isArray(runtime?.pool) ? runtime.pool.length : 0;
  }
  return 0;
}

function resolveIpProxyAutoSyncIntervalMinutes(value, fallback = IP_PROXY_AUTO_SYNC_DEFAULT_INTERVAL_MINUTES) {
  return normalizeIpProxyAutoSyncIntervalMinutes(value, fallback);
}

async function clearIpProxyAutoSyncAlarm() {
  await chrome.alarms.clear(IP_PROXY_AUTO_SYNC_ALARM_NAME);
}

async function ensureIpProxyAutoSyncAlarm(stateOverride = null) {
  const state = stateOverride || await getState();
  const enabled = Boolean(state?.ipProxyAutoSyncEnabled);
  if (!enabled) {
    await clearIpProxyAutoSyncAlarm();
    return false;
  }
  const intervalMinutes = resolveIpProxyAutoSyncIntervalMinutes(
    state?.ipProxyAutoSyncIntervalMinutes,
    PERSISTED_SETTING_DEFAULTS.ipProxyAutoSyncIntervalMinutes
  );
  const existingAlarm = await chrome.alarms.get(IP_PROXY_AUTO_SYNC_ALARM_NAME);
  const existingPeriod = Number(existingAlarm?.periodInMinutes) || 0;
  if (!existingAlarm || Math.abs(existingPeriod - intervalMinutes) > 0.0001) {
    await chrome.alarms.clear(IP_PROXY_AUTO_SYNC_ALARM_NAME);
    await chrome.alarms.create(IP_PROXY_AUTO_SYNC_ALARM_NAME, {
      periodInMinutes: intervalMinutes,
      delayInMinutes: intervalMinutes,
    });
  }
  return true;
}

async function runIpProxyAutoSync(trigger = 'alarm') {
  if (ipProxyAutoSyncRunning) {
    return { skipped: true, reason: 'running' };
  }
  ipProxyAutoSyncRunning = true;
  try {
    const state = await getState();
    if (!state?.ipProxyAutoSyncEnabled) {
      await clearIpProxyAutoSyncAlarm();
      return { skipped: true, reason: 'disabled' };
    }
    if (!state?.ipProxyEnabled) {
      return { skipped: true, reason: 'proxy_disabled' };
    }
    const mode = typeof normalizeIpProxyMode === 'function'
      ? normalizeIpProxyMode(state?.ipProxyMode)
      : String(state?.ipProxyMode || 'account').trim().toLowerCase();
    const result = await refreshIpProxyPool({
      state,
      mode,
      skipExitProbe: true,
    });
    if (typeof addLog === 'function') {
      const display = String(result?.display || '').trim();
      await addLog(
        display
          ? `IP 代理自动同步完成（${trigger}）：${display}`
          : `IP 代理自动同步完成（${trigger}）。`,
        'info'
      ).catch(() => {});
    }
    return { skipped: false, result };
  } catch (error) {
    if (typeof addLog === 'function') {
      await addLog(
        `IP 代理自动同步失败：${error?.message || String(error || '未知错误')}`,
        'warn'
      ).catch(() => {});
    }
    return { skipped: true, reason: 'error', error: error?.message || String(error || '未知错误') };
  } finally {
    ipProxyAutoSyncRunning = false;
  }
}

async function maybeSwitchIpProxyAfterAutoRunRoundSuccess(payload = {}) {
  if (typeof switchIpProxy !== 'function') {
    return null;
  }
  const successfulRuns = Number(payload?.successfulRuns) || 0;
  if (successfulRuns <= 0) {
    return null;
  }

  const state = await getState();
  if (!state?.ipProxyEnabled) {
    return null;
  }

  const mode = typeof normalizeIpProxyMode === 'function'
    ? normalizeIpProxyMode(state?.ipProxyMode)
    : String(state?.ipProxyMode || 'account').trim().toLowerCase();
  const provider = typeof normalizeIpProxyProviderValue === 'function'
    ? normalizeIpProxyProviderValue(state?.ipProxyService)
    : String(state?.ipProxyService || DEFAULT_IP_PROXY_SERVICE).trim().toLowerCase();
  const threshold = typeof resolveIpProxyAutoSwitchThreshold === 'function'
    ? resolveIpProxyAutoSwitchThreshold(state)
    : Math.max(1, Math.min(500, Number(state?.ipProxyPoolTargetCount) || 20));
  if (successfulRuns % threshold !== 0) {
    return null;
  }

  const candidateCount = resolveIpProxyCandidateCountForAutoSwitch(state, mode, provider);
  if (candidateCount <= 1) {
    await addLog(
      `任务切换阈值命中（成功 ${successfulRuns} 轮 / 阈值 ${threshold}），但当前仅 ${candidateCount} 条可切换代理，已跳过自动切换。`,
      'info'
    );
    return {
      skipped: true,
      reason: 'insufficient_candidates',
      candidateCount,
      threshold,
      successfulRuns,
    };
  }

  const switchResult = await switchIpProxy('next', {
    mode,
    state,
    forceRefresh: mode === 'api',
    maxItems: typeof resolveIpProxyPoolTargetCountForMode === 'function'
      ? resolveIpProxyPoolTargetCountForMode(state, mode)
      : undefined,
  });
  const display = String(switchResult?.display || '').trim();
  const routingApplied = Boolean(switchResult?.proxyRouting?.applied);
  await addLog(
    routingApplied
      ? `任务切换阈值命中（成功 ${successfulRuns} 轮 / 阈值 ${threshold}），已自动切换代理：${display || '已切换到下一条'}。`
      : `任务切换阈值命中（成功 ${successfulRuns} 轮 / 阈值 ${threshold}），已尝试自动切换代理，但连通性仍异常。`,
    routingApplied ? 'ok' : 'warn'
  );
  return switchResult;
}

function resolveGpcHelperBaseUrl(apiUrl = '') {
  if (self.GoPayUtils?.normalizeGpcHelperBaseUrl) {
    return self.GoPayUtils.normalizeGpcHelperBaseUrl(apiUrl || DEFAULT_GPC_HELPER_API_URL);
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

function buildGpcApiKeyBalanceRequestUrl(apiUrl = '') {
  if (self.GoPayUtils?.buildGpcApiKeyBalanceUrl) {
    return self.GoPayUtils.buildGpcApiKeyBalanceUrl(apiUrl);
  }
  if (self.GoPayUtils?.buildGpcCardBalanceUrl) {
    return self.GoPayUtils.buildGpcCardBalanceUrl(apiUrl);
  }
  const baseUrl = resolveGpcHelperBaseUrl(apiUrl);
  if (!baseUrl) {
    return '';
  }
  return `${baseUrl}/api/gp/balance`;
}

function buildGpcApiKeyHeaders(apiKey = '', extraHeaders = {}) {
  if (self.GoPayUtils?.buildGpcApiKeyHeaders) {
    return self.GoPayUtils.buildGpcApiKeyHeaders(apiKey, extraHeaders);
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

function formatGpcApiKeyBalancePayload(payload = {}) {
  if (self.GoPayUtils?.formatGpcBalancePayload) {
    return self.GoPayUtils.formatGpcBalancePayload(payload);
  }
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const remaining = payload.remaining_uses ?? payload.remainingUses ?? payload.balance ?? payload.remaining;
  const total = payload.total_uses ?? payload.totalUses;
  const used = payload.used_uses ?? payload.usedUses;
  const status = String(payload.card_status || payload.cardStatus || payload.status || '').trim();
  return [
    remaining !== undefined && remaining !== null && String(remaining).trim() !== ''
      ? (total !== undefined && total !== null && String(total).trim() !== '' ? `余额 ${remaining}/${total}` : `余额 ${remaining}`)
      : '',
    used !== undefined && used !== null && String(used).trim() !== '' ? `已用 ${used}` : '',
    status ? `状态 ${status}` : '',
  ].filter(Boolean).join('，');
}

async function refreshGpcApiKeyBalance(state = {}, options = {}) {
  const apiUrl = resolveGpcHelperBaseUrl(state?.gopayHelperApiUrl || DEFAULT_GPC_HELPER_API_URL);
  const apiKey = String(
    state?.gopayHelperApiKey
    || state?.gpcApiKey
    || state?.apiKey
    || ''
  ).trim();
  if (!apiUrl) {
    throw new Error('缺少 GPC API 地址。');
  }
  if (!apiKey) {
    throw new Error('缺少 GPC API Key。');
  }
  const requestUrl = buildGpcApiKeyBalanceRequestUrl(apiUrl);
  if (!requestUrl) {
    throw new Error('缺少 GPC API 地址。');
  }

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: buildGpcApiKeyHeaders(apiKey, { Accept: 'application/json' }),
  });
  const rawText = await response.text();
  let payload = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = { raw: rawText };
  }
  const balancePayload = self.GoPayUtils?.unwrapGpcResponse
    ? self.GoPayUtils.unwrapGpcResponse(payload)
    : (payload?.data && typeof payload === 'object' ? payload.data : payload);
  const balanceData = balancePayload && typeof balancePayload === 'object' && !Array.isArray(balancePayload)
    ? balancePayload
    : {};
  const remainingUses = self.GoPayUtils?.getGpcBalanceRemainingUses
    ? self.GoPayUtils.getGpcBalanceRemainingUses(balanceData)
    : Math.max(0, Number(balanceData.remaining_uses ?? balanceData.remainingUses ?? balanceData.balance ?? balanceData.remaining) || 0);
  const autoModeEnabled = self.GoPayUtils?.isGpcAutoModeEnabled
    ? self.GoPayUtils.isGpcAutoModeEnabled(balanceData)
    : Boolean(balanceData.auto_mode_enabled ?? balanceData.autoModeEnabled);
  const apiKeyStatus = self.GoPayUtils?.getGpcApiKeyStatus
    ? self.GoPayUtils.getGpcApiKeyStatus(balanceData)
    : String(balanceData.status || balanceData.card_status || balanceData.cardStatus || '').trim();
  const balanceText = formatGpcApiKeyBalancePayload(payload) || rawText || '未知';
  const updates = {
    gopayHelperBalance: balanceText,
    gopayHelperBalancePayload: Object.keys(balanceData).length > 0 ? balanceData : { raw: String(balancePayload || '') },
    gopayHelperBalanceUpdatedAt: Date.now(),
    gopayHelperBalanceError: '',
    gopayHelperRemainingUses: Math.max(0, Number(remainingUses) || 0),
    gopayHelperAutoModeEnabled: Boolean(autoModeEnabled),
    gopayHelperApiKeyStatus: apiKeyStatus,
  };
  const flowId = String(balancePayload?.flow_id || balancePayload?.flowId || '').trim();
  if (flowId) {
    updates.gopayHelperFlowId = flowId;
  }

  const unifiedOk = self.GoPayUtils?.isGpcUnifiedResponseOk
    ? self.GoPayUtils.isGpcUnifiedResponseOk(payload)
    : true;
  if (!response.ok || payload?.ok === false || !unifiedOk) {
    const detail = self.GoPayUtils?.extractGpcResponseErrorDetail
      ? self.GoPayUtils.extractGpcResponseErrorDetail(payload, response.status)
      : (payload?.data?.detail || payload?.error || payload?.message || payload?.detail || `HTTP ${response.status}`);
    const errorUpdates = { ...updates, gopayHelperBalanceError: String(detail || '余额查询失败') };
    await setPersistentSettings(errorUpdates);
    broadcastDataUpdate(errorUpdates);
    throw new Error(String(detail || '余额查询失败'));
  }

  await setPersistentSettings(updates);
  broadcastDataUpdate(updates);
  const reason = String(options?.reason || '').trim();
  await addLog(
    reason === 'round_success'
      ? `GPC 余额已更新：${balanceText}`
      : `GPC 余额查询成功：${balanceText}`,
    'info'
  );
  return {
    balance: balanceText,
    payload,
    data: updates.gopayHelperBalancePayload,
    remainingUses: updates.gopayHelperRemainingUses,
    autoModeEnabled: updates.gopayHelperAutoModeEnabled,
    apiKeyStatus: updates.gopayHelperApiKeyStatus,
    updatedAt: updates.gopayHelperBalanceUpdatedAt,
  };
}

const refreshGpcCardBalance = refreshGpcApiKeyBalance;

const autoRunController = self.MultiPageBackgroundAutoRunController?.createAutoRunController({
  addLog,
  appendAccountRunRecord: (...args) => appendAndBroadcastAccountRunRecord(...args),
  AUTO_RUN_MAX_RETRIES_PER_ROUND,
  AUTO_RUN_RETRY_DELAY_MS,
  AUTO_RUN_TIMER_KIND_BEFORE_RETRY,
  AUTO_RUN_TIMER_KIND_BETWEEN_ROUNDS,
  broadcastAutoRunStatus,
  broadcastStopToContentScripts,
  cancelPendingCommands,
  clearStopRequest: () => clearStopRequest(),
  createAutoRunSessionId: () => createAutoRunSessionId(),
  ensureHotmailMailboxReadyForAutoRunRound: (...args) => ensureHotmailMailboxReadyForAutoRunRound(...args),
  getAutoRunStatusPayload,
  getErrorMessage,
  getFirstUnfinishedStep,
  getPendingAutoRunTimerPlan,
  getRunningSteps,
  getState,
  getStopRequested: () => stopRequested,
  hasSavedProgress,
  isAddPhoneAuthFailure,
  isPhoneSmsPlatformRateLimitFailure,
  isPlusCheckoutNonFreeTrialFailure,
  isGpcTaskEndedFailure,
  isRestartCurrentAttemptError,
  isStep4Route405RecoveryLimitFailure,
  isSignupUserAlreadyExistsFailure,
  isStopError,
  launchAutoRunTimerPlan,
  normalizeAutoRunFallbackThreadIntervalMinutes,
  onAutoRunRoundSuccess: (payload = {}) => maybeSwitchIpProxyAfterAutoRunRoundSuccess(payload),
  persistAutoRunTimerPlan,
  resetState,
  runAutoSequenceFromStep: (...args) => runAutoSequenceFromStep(...args),
  runtime: {
    get: () => ({
      autoRunActive,
      autoRunCurrentRun,
      autoRunTotalRuns,
      autoRunAttemptRun,
      autoRunSessionId,
    }),
    set: (updates = {}) => {
      if (updates.autoRunActive !== undefined) autoRunActive = Boolean(updates.autoRunActive);
      if (updates.autoRunCurrentRun !== undefined) autoRunCurrentRun = Number(updates.autoRunCurrentRun) || 0;
      if (updates.autoRunTotalRuns !== undefined) autoRunTotalRuns = Number(updates.autoRunTotalRuns) || 0;
      if (updates.autoRunAttemptRun !== undefined) autoRunAttemptRun = Number(updates.autoRunAttemptRun) || 0;
      if (updates.autoRunSessionId !== undefined) autoRunSessionId = normalizeAutoRunSessionId(updates.autoRunSessionId);
    },
  },
  setState,
  sleepWithStop,
  throwIfAutoRunSessionStopped: (sessionId) => throwIfAutoRunSessionStopped(sessionId),
  waitForRunningStepsToFinish,
  throwIfStopped: () => throwIfStopped(),
  chrome,
});

async function resumeAutoRunIfWaitingForEmail(options = {}) {
  const { silent = false } = options;
  const state = await getState();
  if (!state.email || !isAutoRunPausedState(state)) {
    return false;
  }

  if (resumeWaiter) {
    if (!silent) {
      await addLog('邮箱已就绪，自动继续后续步骤...', 'info');
    }
    resumeWaiter.resolve();
    resumeWaiter = null;
    return true;
  }

  return false;
}

function shouldStopIcloudAutoFetchRetries(error) {
  if (!error) {
    return false;
  }

  if (error.code === 'ICLOUD_TRANSIENT_CONTEXT') {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  if (message.includes('请先在新打开的 icloud 页面中完成登录')) {
    return true;
  }
  return message.includes('网络/上下文波动')
    || message.includes('could not validate icloud session')
    || message.includes('status 421')
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message.includes('cors')
    || message.includes('address space')
    || message.includes('timed out')
    || message.includes('timeout');
}

function shouldStopEmailAutoFetchRetries(generator, error) {
  if (generator === 'icloud' && shouldStopIcloudAutoFetchRetries(error)) {
    return true;
  }
  const message = String(error?.message || '');
  if (generator === 'cloudflare' && /域名/.test(message)) {
    return true;
  }
  return generator === CLOUDFLARE_TEMP_EMAIL_GENERATOR && /(服务地址|Admin Auth|域名)/.test(message);
}

async function ensureAutoEmailReady(targetRun, totalRuns, attemptRuns) {
  const currentState = await getState();
  if (isHotmailProvider(currentState)) {
    const account = await ensureHotmailAccountForFlow({
      allowAllocate: true,
      markUsed: true,
      preferredAccountId: null,
    });
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：已分配 Hotmail 账号 ${account.email}（第 ${attemptRuns} 次尝试）===`, 'ok');
    return account.email;
  }

  if (isLuckmailProvider(currentState)) {
    const purchase = await ensureLuckmailPurchaseForFlow({ allowReuse: true });
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：LuckMail 邮箱已就绪：${purchase.email_address}（第 ${attemptRuns} 次尝试）===`, 'ok');
    return purchase.email_address;
  }

  if (isGeneratedAliasProvider(currentState)) {
    if (currentState.mailProvider === GMAIL_PROVIDER) {
      if (!currentState.emailPrefix) {
        throw new Error('Gmail 原邮箱未设置，请先在侧边栏填写。');
      }
      await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：Gmail +tag 模式已启用，将在步骤 3 自动生成邮箱（第 ${attemptRuns} 次尝试）===`, 'info');
      return null;
    }
    if (!currentState.emailPrefix) {
      throw new Error('2925 邮箱前缀未设置，请先在侧边栏填写。');
    }
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：2925 模式已启用，将在步骤 3 自动生成邮箱（第 ${attemptRuns} 次尝试）===`, 'info');
    return null;
  }

  if (currentState.email) {
    return currentState.email;
  }

  if (isCustomMailProvider(currentState)) {
    const poolSize = getCustomMailProviderPool(currentState).length;
    if (poolSize > 0) {
      const queuedEmail = getCustomMailProviderPoolEmailForRun(currentState, targetRun);
      if (!queuedEmail) {
        throw new Error(`自定义邮箱号池第 ${targetRun} 个邮箱不存在，请检查号池数量是否与自动轮数一致。`);
      }
      await setEmailState(queuedEmail);
      await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：自定义邮箱号池已就绪：${queuedEmail}（第 ${attemptRuns} 次尝试；第 4/8 步仍需手动输入验证码）===`, 'ok');
      return queuedEmail;
    }
  }

  if (isCustomEmailPoolGenerator(currentState)) {
    const queuedEmail = getCustomEmailPoolEmailForRun(currentState, targetRun);
    if (!queuedEmail) {
      const poolSize = getCustomEmailPool(currentState).length;
      throw new Error(
        poolSize > 0
          ? `自定义邮箱池第 ${targetRun} 个邮箱不存在，请检查邮箱池数量是否与自动轮数一致。`
          : '自定义邮箱池为空，请先至少填写 1 个邮箱。'
      );
    }
    await setEmailState(queuedEmail);
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：自定义邮箱池已就绪：${queuedEmail}（第 ${attemptRuns} 次尝试）===`, 'ok');
    return queuedEmail;
  }

  if (shouldUseCustomRegistrationEmail(currentState)) {
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮已暂停：请先填写自定义注册邮箱，然后继续 ===`, 'warn');
    await broadcastAutoRunStatus('waiting_email', {
      currentRun: targetRun,
      totalRuns,
      attemptRun: attemptRuns,
    });

    await waitForResume();

    const resumedState = await getState();
    if (!resumedState.email) {
      throw new Error('无法继续：当前没有注册邮箱。');
    }
    return resumedState.email;
  }

  const generator = normalizeEmailGenerator(currentState.emailGenerator);
  const generatorLabel = getEmailGeneratorLabel(generator);
  let lastError = null;
  let attemptedFetches = 0;
  for (let attempt = 1; attempt <= EMAIL_FETCH_MAX_ATTEMPTS; attempt++) {
    attemptedFetches = attempt;
    try {
      if (attempt > 1) {
        await addLog(`${generatorLabel}：正在进行第 ${attempt}/${EMAIL_FETCH_MAX_ATTEMPTS} 次自动获取重试...`, 'warn');
      }
      const generatedEmail = await fetchGeneratedEmail(currentState, {
        generateNew: generator !== 'icloud' || normalizeIcloudFetchMode(currentState.icloudFetchMode) === 'always_new',
        generator,
      });
      await addLog(
        `=== 目标 ${targetRun}/${totalRuns} 轮：${generatorLabel}已就绪：${generatedEmail}（第 ${attemptRuns} 次尝试，第 ${attempt}/${EMAIL_FETCH_MAX_ATTEMPTS} 次获取）===`,
        'ok'
      );
      return generatedEmail;
    } catch (err) {
      lastError = err;
      await addLog(`${generatorLabel}自动获取失败（${attempt}/${EMAIL_FETCH_MAX_ATTEMPTS}）：${err.message}`, 'warn');
      if (generator === 'icloud' && shouldStopIcloudAutoFetchRetries(err)) {
        await addLog('iCloud：检测到会话/网络异常，本轮将停止重复重试。请先确认 iCloud 页面已登录，再点击“我已登录”或手动粘贴邮箱继续。', 'warn');
      }
      if (shouldStopEmailAutoFetchRetries(generator, err)) {
        break;
      }
    }
  }

  const totalAttempts = Math.max(1, attemptedFetches);
  await addLog(`${generatorLabel}自动获取已连续失败 ${totalAttempts} 次：${lastError?.message || '未知错误'}`, 'error');
  await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮已暂停：请先自动获取邮箱或手动粘贴邮箱，然后继续 ===`, 'warn');
  await broadcastAutoRunStatus('waiting_email', {
    currentRun: targetRun,
    totalRuns,
    attemptRun: attemptRuns,
  });

  await waitForResume();

  const resumedState = await getState();
  if (!resumedState.email) {
    throw new Error('无法继续：当前没有邮箱地址。');
  }
  return resumedState.email;
}

async function ensureAutoEmailReady(targetRun, totalRuns, attemptRuns) {
  const currentState = await getState();
  if (isHotmailProvider(currentState)) {
    const account = await ensureHotmailAccountForFlow({
      allowAllocate: true,
      markUsed: true,
      preferredAccountId: null,
    });
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：已分配 Hotmail 账号 ${account.email}（第 ${attemptRuns} 次尝试）===`, 'ok');
    return account.email;
  }

  if (isLuckmailProvider(currentState)) {
    const purchase = await ensureLuckmailPurchaseForFlow({ allowReuse: true });
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：LuckMail 邮箱已就绪：${purchase.email_address}（第 ${attemptRuns} 次尝试）===`, 'ok');
    return purchase.email_address;
  }

  if (isGeneratedAliasProvider(currentState)) {
    if (isReusableGeneratedAliasEmail(currentState)) {
      await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：当前已复用 ${currentState.email}，将直接继续执行（第 ${attemptRuns} 次尝试）===`, 'info');
      return currentState.email;
    }

    let managedAliasState = currentState;
    if (
      String(currentState.mailProvider || '').trim().toLowerCase() === '2925'
      && Boolean(currentState.mail2925UseAccountPool)
    ) {
      const account = await ensureMail2925AccountForFlow({
        allowAllocate: true,
        preferredAccountId: currentState.currentMail2925AccountId || null,
        markUsed: true,
      });
      managedAliasState = {
        ...(await getState()),
        currentMail2925AccountId: account.id,
      };
      await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：已分配 2925 账号 ${account.email}（第 ${attemptRuns} 次尝试）===`, 'ok');
    }

    const baseEmail = getManagedAliasBaseEmail(managedAliasState);
    if (!baseEmail && !managedAliasState.email) {
      const baseLabel = currentState.mailProvider === GMAIL_PROVIDER ? 'Gmail 原邮箱' : '2925 基邮箱';
      throw new Error(`${baseLabel}未设置，请先填写，或直接在“注册邮箱”中手动填写完整邮箱。`);
    }

    await addLog(
      `=== 目标 ${targetRun}/${totalRuns} 轮：${currentState.mailProvider === GMAIL_PROVIDER ? 'Gmail +tag' : '2925'} 模式已启用，将在步骤 3 自动生成邮箱（第 ${attemptRuns} 次尝试）===`,
      'info'
    );
    return null;
  }

  if (currentState.email) {
    return currentState.email;
  }

  if (isCustomMailProvider(currentState)) {
    const poolSize = getCustomMailProviderPool(currentState).length;
    if (poolSize > 0) {
      const queuedEmail = getCustomMailProviderPoolEmailForRun(currentState, targetRun);
      if (!queuedEmail) {
        throw new Error(`自定义邮箱号池第 ${targetRun} 个邮箱不存在，请检查号池数量是否与自动轮数一致。`);
      }
      await setEmailState(queuedEmail);
      await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：自定义邮箱号池已就绪：${queuedEmail}（第 ${attemptRuns} 次尝试；第 4/8 步仍需手动输入验证码）===`, 'ok');
      return queuedEmail;
    }
  }

  if (isCustomEmailPoolGenerator(currentState)) {
    const queuedEmail = getCustomEmailPoolEmailForRun(currentState, targetRun);
    if (!queuedEmail) {
      const poolSize = getCustomEmailPool(currentState).length;
      throw new Error(
        poolSize > 0
          ? `自定义邮箱池第 ${targetRun} 个邮箱不存在，请检查邮箱池数量是否与自动轮数一致。`
          : '自定义邮箱池为空，请先至少填写 1 个邮箱。'
      );
    }
    await setEmailState(queuedEmail);
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：自定义邮箱池已就绪：${queuedEmail}（第 ${attemptRuns} 次尝试）===`, 'ok');
    return queuedEmail;
  }

  if (shouldUseCustomRegistrationEmail(currentState)) {
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮已暂停：请先填写自定义注册邮箱，然后继续 ===`, 'warn');
    await broadcastAutoRunStatus('waiting_email', {
      currentRun: targetRun,
      totalRuns,
      attemptRun: attemptRuns,
    });

    await waitForResume();

    const resumedState = await getState();
    if (!resumedState.email) {
      throw new Error('无法继续：当前没有注册邮箱。');
    }
    return resumedState.email;
  }

  const generator = normalizeEmailGenerator(currentState.emailGenerator);
  const generatorLabel = getEmailGeneratorLabel(generator);
  let lastError = null;
  let attemptedFetches = 0;
  for (let attempt = 1; attempt <= EMAIL_FETCH_MAX_ATTEMPTS; attempt++) {
    attemptedFetches = attempt;
    try {
      if (attempt > 1) {
        await addLog(`${generatorLabel}：正在进行第 ${attempt}/${EMAIL_FETCH_MAX_ATTEMPTS} 次自动获取重试...`, 'warn');
      }
      const generatedEmail = await fetchGeneratedEmail(currentState, {
        generateNew: generator !== 'icloud' || normalizeIcloudFetchMode(currentState.icloudFetchMode) === 'always_new',
        generator,
      });
      await addLog(
        `=== 目标 ${targetRun}/${totalRuns} 轮：${generatorLabel}已就绪：${generatedEmail}（第 ${attemptRuns} 次尝试，第 ${attempt}/${EMAIL_FETCH_MAX_ATTEMPTS} 次获取）===`,
        'ok'
      );
      return generatedEmail;
    } catch (err) {
      lastError = err;
      await addLog(`${generatorLabel}自动获取失败（${attempt}/${EMAIL_FETCH_MAX_ATTEMPTS}）：${err.message}`, 'warn');
      if (generator === 'icloud' && shouldStopIcloudAutoFetchRetries(err)) {
        await addLog('iCloud：检测到会话/网络异常，本轮将停止重复重试。请先确认 iCloud 页面已登录，再点击“我已登录”或手动粘贴邮箱继续。', 'warn');
      }
      if (shouldStopEmailAutoFetchRetries(generator, err)) {
        break;
      }
    }
  }

  const totalAttempts = Math.max(1, attemptedFetches);
  await addLog(`${generatorLabel}自动获取已连续失败 ${totalAttempts} 次：${lastError?.message || '未知错误'}`, 'error');
  await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮已暂停：请先自动获取邮箱或手动粘贴邮箱，然后继续 ===`, 'warn');
  await broadcastAutoRunStatus('waiting_email', {
    currentRun: targetRun,
    totalRuns,
    attemptRun: attemptRuns,
  });

  await waitForResume();

  const resumedState = await getState();
  if (!resumedState.email) {
    throw new Error('无法继续：当前没有邮箱地址。');
  }
  return resumedState.email;
}

async function runAutoSequenceFromStep(startStep, context = {}) {
  const { targetRun, totalRuns, attemptRuns, continued = false } = context;
  let postStep7RestartCount = 0;
  let goPayCheckoutRestartCount = 0;
  let gpcCheckoutRestartCount = 0;
  let step4RestartCount = 0;
  let currentStartStep = startStep;
  let continueCurrentAttempt = continued;
  const resolvedSignupMethod = await ensureResolvedSignupMethodForRun();

  while (true) {

  if (continueCurrentAttempt) {
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：继续当前进度，从步骤 ${startStep} 开始（第 ${attemptRuns} 次尝试）===`, 'info');
  } else {
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：第 ${attemptRuns} 次尝试，阶段 1，打开官网并进入密码页 ===`, 'info');
  }

  if (currentStartStep <= 1) {
    await executeStepAndWait(1, AUTO_STEP_DELAYS[1]);
  }

  if (currentStartStep <= 2) {
    if (resolvedSignupMethod === SIGNUP_METHOD_PHONE) {
      await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：本轮注册方式为手机号注册，将跳过邮箱预获取 ===`, 'info');
    } else {
      await ensureAutoEmailReady(targetRun, totalRuns, attemptRuns);
    }
    await executeStepAndWait(2, AUTO_STEP_DELAYS[2]);
  }

  let restartFromStep1WithCurrentEmail = false;

  if (currentStartStep <= 3) {
    const latestState = await getState();
    const step3Status = latestState.stepStatuses?.[3] || 'pending';
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：阶段 2，填写密码、验证、登录并完成授权（第 ${attemptRuns} 次尝试）===`, 'info');
    await broadcastAutoRunStatus('running', {
      currentRun: targetRun,
      totalRuns,
      attemptRun: attemptRuns,
    });
    if (isStepDoneStatus(step3Status)) {
      await addLog(`自动运行：步骤 3 当前状态为 ${step3Status}，将直接继续后续流程。`, 'info');
    } else {
      try {
        await executeStepAndWait(3, AUTO_STEP_DELAYS[3]);
      } catch (err) {
        if (isStopError(err)) {
          throw err;
        }
        if (isSignupPhonePasswordMismatchFailure(err)) {
          step4RestartCount += 1;
          await restartSignupPhonePasswordMismatchAttemptFromStep(3, step4RestartCount, err);
          currentStartStep = 1;
          continueCurrentAttempt = true;
          restartFromStep1WithCurrentEmail = true;
          continue;
        }
        throw err;
      }
    }
  } else {
    await addLog(`=== 目标 ${targetRun}/${totalRuns} 轮：继续执行剩余流程（第 ${attemptRuns} 次尝试）===`, 'info');
  }

  if (restartFromStep1WithCurrentEmail) {
    continue;
  }

  const signupTabId = await getTabId('signup-page');
  if (signupTabId) {
    await chrome.tabs.update(signupTabId, { active: true });
  }

  let step = Math.max(currentStartStep, 4);
  while (step <= (typeof getLastStepIdForState === 'function'
    ? getLastStepIdForState(await getState())
    : (typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10))) {
    const latestState = await getState();
    if (typeof getStepDefinitionForState === 'function' && !getStepDefinitionForState(step, latestState)) {
      step += 1;
      continue;
    }
    const currentStatus = latestState.stepStatuses?.[step] || 'pending';
    if (isStepDoneStatus(currentStatus)) {
      await addLog(`自动运行：步骤 ${step} 当前状态为 ${currentStatus}，将直接继续后续流程。`, 'info');
      step += 1;
      continue;
    }
    try {
      await executeStepAndWait(step, AUTO_STEP_DELAYS[step]);
      step += 1;
    } catch (err) {
      if (isStopError(err)) {
        throw err;
      }

      const stepExecutionKey = typeof getStepExecutionKeyForState === 'function'
        ? getStepExecutionKeyForState(step, latestState)
        : '';
      const isGpcCheckoutStep = normalizePlusPaymentMethod(latestState?.plusPaymentMethod) === PLUS_PAYMENT_METHOD_GPC_HELPER
        || String(latestState?.plusCheckoutSource || '').trim() === PLUS_PAYMENT_METHOD_GPC_HELPER;
      if (isGpcCheckoutStep
        && (stepExecutionKey === 'plus-checkout-create' || stepExecutionKey === 'plus-checkout-billing')
        && isGpcCheckoutRestartRequiredFailure(err)) {
        gpcCheckoutRestartCount += 1;
        await addLog(
          `步骤 ${step}：检测到 GPC 任务失败/卡住，准备回到步骤 6 重新创建 GPC 任务（第 ${gpcCheckoutRestartCount} 次）。原因：${getErrorMessage(err)}`,
          'warn'
        );
        await invalidateDownstreamAfterStepRestart(5, {
          logLabel: `步骤 ${step} GPC 任务失败后准备回到步骤 6 重试（第 ${gpcCheckoutRestartCount} 次）`,
        });
        step = 6;
        continue;
      }

      if (step === 8 && isGoPayCheckoutRestartRequiredFailure(err)) {
        goPayCheckoutRestartCount += 1;
        if (goPayCheckoutRestartCount > 3) {
          await addLog(`步骤 8：GoPay Checkout 已连续重建 ${goPayCheckoutRestartCount - 1} 次仍失败，停止自动重试。原因：${getErrorMessage(err)}`, 'error');
          throw err;
        }
        await addLog(
          `步骤 8：检测到 GoPay 支付页失效/卡死，准备关闭旧页并回到步骤 6 重新创建 Checkout（第 ${goPayCheckoutRestartCount}/3 次）。原因：${getErrorMessage(err)}`,
          'warn'
        );
        await invalidateDownstreamAfterStepRestart(5, {
          logLabel: `步骤 8 GoPay 支付页失效后准备回到步骤 6 重试（第 ${goPayCheckoutRestartCount}/3 次）`,
        });
        step = 6;
        continue;
      }

      if (step === 4) {
        if (isSignupUserAlreadyExistsFailure(err)) {
          throw err;
        }
        if (isMail2925ThreadTerminatedError(err)) {
          await addLog(`步骤 4：2925 已切换账号并要求结束当前尝试：${getErrorMessage(err)}`, 'warn');
          throw err;
        }
        step4RestartCount += 1;
        const isPhoneResendBanned = typeof phoneVerificationHelpers !== 'undefined'
          && typeof phoneVerificationHelpers?.isPhoneResendBannedNumberError === 'function'
          && phoneVerificationHelpers.isPhoneResendBannedNumberError(err);
        if (isSignupPhonePasswordMismatchFailure(err) || isPhoneResendBanned) {
          await restartSignupPhonePasswordMismatchAttemptFromStep(4, step4RestartCount, err);
        } else {
          const preservedState = await getState();
          const preservedEmail = String(preservedState.email || '').trim();
          const preservedPassword = String(preservedState.password || '').trim();
          const emailSuffix = preservedEmail ? `当前邮箱：${preservedEmail}；` : '';
          await addLog(
            `步骤 4：执行失败，准备沿用当前邮箱回到步骤 1 重新开始（第 ${step4RestartCount} 次重开）。${emailSuffix}原因：${getErrorMessage(err)}`,
            'warn'
          );
          await invalidateDownstreamAfterStepRestart(1, {
            logLabel: `步骤 4 报错后准备回到步骤 1 沿用当前邮箱重试（第 ${step4RestartCount} 次重开）`,
          });
          const restorePayload = {};
          if (preservedEmail) restorePayload.email = preservedEmail;
          if (preservedPassword) restorePayload.password = preservedPassword;
          if (Object.keys(restorePayload).length) {
            await setState(restorePayload);
          }
        }
        currentStartStep = 1;
        continueCurrentAttempt = true;
        restartFromStep1WithCurrentEmail = true;
        break;
      }

      const restartDecision = await getPostStep6AutoRestartDecision(step, err);
      if (restartDecision.shouldRestart) {
        postStep7RestartCount += 1;
        const restartStep = restartDecision.restartStep
          || (typeof getAuthChainStartStepId === 'function'
            ? getAuthChainStartStepId(await getState())
            : FINAL_OAUTH_CHAIN_START_STEP);
        const resetAfterStep = Math.max(1, restartStep - 1);
        const authState = restartDecision.authState;
        const authStateLabel = authState?.state ? getLoginAuthStateLabel(authState.state) : '未知页面';
        const authStateSuffix = authState?.url
          ? `当前认证页：${authStateLabel}（${authState.url}）`
          : authState?.state
            ? `当前认证页：${authStateLabel}`
            : '未获取到认证页状态';
        await addLog(
          `步骤 ${step}：检测到报错且当前未进入 add-phone，正在回到步骤 ${restartStep} 重新开始授权流程（第 ${postStep7RestartCount} 次重开）。${authStateSuffix}；原因：${restartDecision.errorMessage || '未知错误'}`,
          'warn'
        );
        await invalidateDownstreamAfterStepRestart(resetAfterStep, {
          logLabel: `步骤 ${step} 报错后准备回到步骤 ${restartStep} 重试（第 ${postStep7RestartCount} 次重开）`,
        });
        step = restartStep;
        continue;
      }

      if (restartDecision.blockedByAddPhone) {
        const addPhoneUrl = restartDecision.authState?.url || 'https://auth.openai.com/add-phone';
        const authChainStartStep = typeof getAuthChainStartStepId === 'function'
          ? getAuthChainStartStepId(await getState())
          : FINAL_OAUTH_CHAIN_START_STEP;
        await addLog(`步骤 ${step}：检测到认证流程进入 add-phone（${addPhoneUrl}），停止自动回到步骤 ${authChainStartStep} 重开。`, 'warn');
      }
      throw err;
    }
  }

  if (restartFromStep1WithCurrentEmail) {
    continue;
  }

  break;
}
}

async function waitForResume() {
  throwIfStopped();
  const state = await getState();
  if (state.email) {
    await addLog('邮箱已就绪，自动继续后续步骤...', 'info');
    return;
  }

  return new Promise((resolve, reject) => {
    resumeWaiter = { resolve, reject };
  });
}

function createAutoRunRoundSummary(round) {
  return autoRunController.createAutoRunRoundSummary(round);
}

function normalizeAutoRunRoundSummary(summary, round) {
  return autoRunController.normalizeAutoRunRoundSummary(summary, round);
}

function buildAutoRunRoundSummaries(totalRuns, rawSummaries = []) {
  return autoRunController.buildAutoRunRoundSummaries(totalRuns, rawSummaries);
}

function serializeAutoRunRoundSummaries(totalRuns, roundSummaries = []) {
  return autoRunController.serializeAutoRunRoundSummaries(totalRuns, roundSummaries);
}

function getAutoRunRoundRetryCount(summary) {
  return autoRunController.getAutoRunRoundRetryCount(summary);
}

function formatAutoRunFailureReasons(reasons = []) {
  return autoRunController.formatAutoRunFailureReasons(reasons);
}

async function logAutoRunFinalSummary(totalRuns, roundSummaries = []) {
  return autoRunController.logAutoRunFinalSummary(totalRuns, roundSummaries);
}

async function skipAutoRunCountdown() {
  return autoRunController.skipAutoRunCountdown();
}

async function waitBetweenAutoRunRounds(targetRun, totalRuns, roundSummary, options = {}) {
  return autoRunController.waitBetweenAutoRunRounds(targetRun, totalRuns, roundSummary, options);
}

async function waitBeforeAutoRunRetry(targetRun, totalRuns, nextAttemptRun, options = {}) {
  return autoRunController.waitBeforeAutoRunRetry(targetRun, totalRuns, nextAttemptRun, options);
}

async function handleAutoRunLoopUnhandledError(error) {
  return autoRunController.handleAutoRunLoopUnhandledError(error);
}

function startAutoRunLoop(totalRuns, options = {}) {
  return autoRunController.startAutoRunLoop(totalRuns, options);
}

async function autoRunLoop(totalRuns, options = {}) {
  return autoRunController.autoRunLoop(totalRuns, options);
}

async function resumeAutoRun() {
  throwIfStopped();
  const state = await getState();
  if (!state.email) {
    await addLog('无法继续：当前没有邮箱地址，请先在侧边栏填写邮箱。', 'error');
    return false;
  }

  const resumedInMemory = await resumeAutoRunIfWaitingForEmail({ silent: true });
  if (resumedInMemory) {
    return true;
  }

  if (!isAutoRunPausedState(state)) {
    return false;
  }

  if (autoRunActive) {
    return false;
  }

  const totalRuns = state.autoRunTotalRuns || 1;
  const currentRun = state.autoRunCurrentRun || 1;
  const attemptRun = state.autoRunAttemptRun || 1;

  await addLog('检测到自动流程暂停上下文已丢失，正在从当前进度恢复自动运行...', 'warn');
  startAutoRunLoop(totalRuns, {
    autoRunSessionId: normalizeAutoRunSessionId(state.autoRunSessionId),
    autoRunSkipFailures: Boolean(state.autoRunSkipFailures),
    mode: 'continue',
    resumeCurrentRun: currentRun,
    resumeAttemptRun: attemptRun,
    resumeRoundSummaries: state.autoRunRoundSummaries,
  });
  return true;
}

// ============================================================
// Signup / OAuth Helpers
// ============================================================

const SIGNUP_ENTRY_URL = 'https://chatgpt.com/';
const SIGNUP_PAGE_INJECT_FILES = ['content/utils.js', 'content/operation-delay.js', 'content/auth-page-recovery.js', 'content/phone-country-utils.js', 'content/phone-auth.js', 'content/signup-page.js'];
const panelBridge = self.MultiPageBackgroundPanelBridge?.createPanelBridge({
  chrome,
  addLog,
  closeConflictingTabsForSource,
  ensureContentScriptReadyOnTab,
  getPanelMode,
  normalizeCodex2ApiUrl,
  normalizeSub2ApiUrl,
  rememberSourceLastUrl,
  sendToContentScript,
  sendToContentScriptResilient,
  waitForTabUrlFamily,
  DEFAULT_SUB2API_GROUP_NAME,
  SUB2API_STEP1_RESPONSE_TIMEOUT_MS,
});
const signupFlowHelpers = self.MultiPageSignupFlowHelpers?.createSignupFlowHelpers({
  addLog,
  buildGeneratedAliasEmail,
  chrome,
  ensureContentScriptReadyOnTab,
  ensureHotmailAccountForFlow,
  ensureMail2925AccountForFlow,
  ensureLuckmailPurchaseForFlow,
  fetchGeneratedEmail,
  getTabId,
  isGeneratedAliasProvider,
  isReusableGeneratedAliasEmail,
  isSignupEmailVerificationPageUrl,
  isSignupPhoneVerificationPageUrl: (rawUrl) => {
    const parsed = parseUrlSafely(rawUrl);
    return Boolean(parsed && isSignupPageHost(parsed.hostname) && /\/phone-verification(?:[/?#]|$)/i.test(parsed.pathname || ''));
  },
  isSignupProfilePageUrl: (rawUrl) => {
    const parsed = parseUrlSafely(rawUrl);
    return Boolean(parsed && isSignupPageHost(parsed.hostname) && /\/(?:create-account\/profile|u\/signup\/profile|signup\/profile)(?:[/?#]|$)/i.test(parsed.pathname || ''));
  },
  isRetryableContentScriptTransportError,
  isHotmailProvider,
  isLuckmailProvider,
  isSignupPasswordPageUrl,
  isTabAlive,
  reuseOrCreateTab,
  sendToContentScriptResilient,
  setEmailState,
  setState,
  SIGNUP_ENTRY_URL,
  SIGNUP_PAGE_INJECT_FILES,
  waitForTabStableComplete,
  waitForTabUrlMatch,
});
const verificationFlowHelpers = self.MultiPageBackgroundVerificationFlow?.createVerificationFlowHelpers({
  addLog,
  chrome,
  closeConflictingTabsForSource,
  CLOUDFLARE_TEMP_EMAIL_PROVIDER,
  CLOUD_MAIL_PROVIDER,
  completeStepFromBackground,
  confirmCustomVerificationStepBypassRequest: (step) => chrome.runtime.sendMessage({
    type: 'REQUEST_CUSTOM_VERIFICATION_BYPASS_CONFIRMATION',
    payload: { step },
  }),
  getHotmailVerificationPollConfig,
  getHotmailVerificationRequestTimestamp,
  handleMail2925LimitReachedError,
  getState,
  getTabId,
  HOTMAIL_PROVIDER,
  isMail2925LimitReachedError,
  isRetryableContentScriptTransportError,
  isStopError,
  LUCKMAIL_PROVIDER,
  MAIL_2925_VERIFICATION_INTERVAL_MS,
  MAIL_2925_VERIFICATION_MAX_ATTEMPTS,
  pollCloudflareTempEmailVerificationCode,
  pollCloudMailVerificationCode,
  pollHotmailVerificationCode,
  pollLuckmailVerificationCode,
  sendToContentScript,
  sendToContentScriptResilient,
  sendToMailContentScriptResilient,
  setState,
  setStepStatus,
  sleepWithStop,
  throwIfStopped,
  VERIFICATION_POLL_MAX_ROUNDS,
});
const phoneVerificationHelpers = self.MultiPageBackgroundPhoneVerification?.createPhoneVerificationHelpers({
  addLog,
  broadcastDataUpdate,
  DEFAULT_FIVE_SIM_BASE_URL,
  DEFAULT_FIVE_SIM_COUNTRY_ORDER,
  DEFAULT_FIVE_SIM_OPERATOR,
  DEFAULT_FIVE_SIM_PRODUCT,
  DEFAULT_NEX_SMS_BASE_URL,
  DEFAULT_NEX_SMS_COUNTRY_ORDER,
  DEFAULT_NEX_SMS_SERVICE_CODE,
  DEFAULT_HERO_SMS_BASE_URL,
  DEFAULT_HERO_SMS_REUSE_ENABLED,
  DEFAULT_PHONE_CODE_WAIT_SECONDS,
  DEFAULT_PHONE_CODE_TIMEOUT_WINDOWS,
  DEFAULT_PHONE_CODE_POLL_INTERVAL_SECONDS,
  DEFAULT_PHONE_CODE_POLL_ROUNDS,
  ensureStep8SignupPageReady,
  navigateAuthTabToAddPhone: async (tabId, options = {}) => {
    const visibleStep = Math.floor(Number(options.visibleStep || options.step) || 0) || 9;
    const requestedTimeoutMs = Number(options.timeoutMs);
    const timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
      ? requestedTimeoutMs
      : await getOAuthFlowStepTimeoutMs(30000, {
        step: visibleStep,
        actionLabel: 'direct add-phone navigation',
      });
    await chrome.tabs.update(tabId, { url: 'https://auth.openai.com/add-phone', active: true });
    await ensureStep8SignupPageReady(tabId, {
      timeoutMs,
      visibleStep,
      logStepKey: options.logStepKey || 'phone-verification',
      logMessage: options.logMessage || '步骤 9：认证页已失联，直接打开添加手机号页面后等待脚本恢复。',
    });
    return {
      addPhonePage: true,
      phoneVerificationPage: false,
      url: 'https://auth.openai.com/add-phone',
    };
  },
  generateRandomBirthday,
  generateRandomName,
  getOAuthFlowRemainingMs,
  getOAuthFlowStepTimeoutMs,
  getState,
  HERO_SMS_COUNTRY_ID,
  HERO_SMS_COUNTRY_LABEL,
  HERO_SMS_SERVICE_CODE,
  HERO_SMS_SERVICE_LABEL,
  sendToContentScript,
  sendToContentScriptResilient,
  setState,
  sleepWithStop,
  throwIfStopped,
  createFiveSimProvider: self.PhoneSmsFiveSimProvider?.createProvider,
});
const step1Executor = self.MultiPageBackgroundStep1?.createStep1Executor({
  addLog,
  completeStepFromBackground,
  openSignupEntryTab,
});
const step2Executor = self.MultiPageBackgroundStep2?.createStep2Executor({
  addLog,
  chrome,
  completeStepFromBackground,
  ensureContentScriptReadyOnTab,
  ensureSignupAuthEntryPageReady,
  ensureSignupEntryPageReady,
  ensureSignupPostEmailPageReadyInTab,
  ensureSignupPostIdentityPageReadyInTab: signupFlowHelpers.ensureSignupPostIdentityPageReadyInTab,
  getTabId,
  isTabAlive,
  phoneVerificationHelpers,
  resolveSignupMethod,
  resolveSignupEmailForFlow,
  sendToContentScriptResilient,
  SIGNUP_PAGE_INJECT_FILES,
});
const step3Executor = self.MultiPageBackgroundStep3?.createStep3Executor({
  addLog,
  chrome,
  ensureContentScriptReadyOnTab,
  generatePassword,
  getTabId,
  isTabAlive,
  resolveSignupMethod,
  sendToContentScript,
  setPasswordState,
  setState,
  SIGNUP_PAGE_INJECT_FILES,
});

async function ensureIcloudMailSessionForVerification(options = {}) {
  const flowState = options?.state || await getState().catch(() => ({}));
  const hostPreference = getConfiguredIcloudHostPreference(flowState)
    || normalizeIcloudHost(flowState?.preferredIcloudHost);
  return checkIcloudSession({
    ...(hostPreference ? { hostPreference } : {}),
    actionLabel: options?.actionLabel || '检查 iCloud 会话',
  });
}

const step4Executor = self.MultiPageBackgroundStep4?.createStep4Executor({
  addLog,
  chrome,
  completeStepFromBackground,
  confirmCustomVerificationStepBypass: verificationFlowHelpers.confirmCustomVerificationStepBypass,
  generateRandomBirthday,
  generateRandomName,
  ensureMail2925MailboxSession,
  ensureIcloudMailSession: ensureIcloudMailSessionForVerification,
  getMailConfig,
  getTabId,
  HOTMAIL_PROVIDER,
  isTabAlive,
  LUCKMAIL_PROVIDER,
  CLOUDFLARE_TEMP_EMAIL_PROVIDER,
  CLOUD_MAIL_PROVIDER,
  resolveVerificationStep: verificationFlowHelpers.resolveVerificationStep,
  reuseOrCreateTab,
  sendToContentScript,
  sendToContentScriptResilient,
  isRetryableContentScriptTransportError,
  shouldUseCustomRegistrationEmail,
  STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS,
  throwIfStopped,
  waitForTabStableComplete,
  phoneVerificationHelpers,
  resolveSignupMethod,
});
const step5Executor = self.MultiPageBackgroundStep5?.createStep5Executor({
  addLog,
  generateRandomBirthday,
  generateRandomName,
  sendToContentScript,
});
const step6Executor = self.MultiPageBackgroundStep6?.createStep6Executor({
  addLog,
  chrome,
  completeStepFromBackground,
  getErrorMessage,
  registrationSuccessWaitMs: STEP6_REGISTRATION_SUCCESS_WAIT_MS,
  sleepWithStop,
});
const step7Executor = self.MultiPageBackgroundStep7?.createStep7Executor({
  addLog,
  completeStepFromBackground,
  getErrorMessage,
  getLoginAuthStateLabel,
  getOAuthFlowStepTimeoutMs,
  getState,
  getTabId,
  isAddPhoneAuthFailure,
  isStep6RecoverableResult,
  isStep6SuccessResult,
  phoneVerificationHelpers,
  refreshOAuthUrlBeforeStep6,
  reuseOrCreateTab,
  sendToContentScriptResilient,
  startOAuthFlowTimeoutWindow,
  STEP6_MAX_ATTEMPTS,
  throwIfStopped,
});
const step8Executor = self.MultiPageBackgroundStep8?.createStep8Executor({
  addLog,
  chrome,
  CLOUDFLARE_TEMP_EMAIL_PROVIDER,
  CLOUD_MAIL_PROVIDER,
  completeStepFromBackground,
  confirmCustomVerificationStepBypass: verificationFlowHelpers.confirmCustomVerificationStepBypass,
  ensureMail2925MailboxSession,
  ensureIcloudMailSession: ensureIcloudMailSessionForVerification,
  ensureStep8VerificationPageReady,
  getOAuthFlowRemainingMs,
  getOAuthFlowStepTimeoutMs,
  getPanelMode,
  getMailConfig,
  getState,
  getTabId,
  HOTMAIL_PROVIDER,
  isTabAlive,
  isVerificationMailPollingError,
  LUCKMAIL_PROVIDER,
  resolveVerificationStep: verificationFlowHelpers.resolveVerificationStep,
  resolveSignupEmailForFlow,
  phoneVerificationHelpers,
  rerunStep7ForStep8Recovery: (...args) => rerunStep7ForStep8Recovery(...args),
  resolveSignupMethod,
  reuseOrCreateTab,
  sendToContentScriptResilient,
  setState,
  shouldUseCustomRegistrationEmail,
  sleepWithStop,
  STANDARD_MAIL_VERIFICATION_RESEND_INTERVAL_MS,
  STEP7_MAIL_POLLING_RECOVERY_MAX_ATTEMPTS,
  throwIfStopped,
});
const plusCheckoutCreateExecutor = self.MultiPageBackgroundPlusCheckoutCreate?.createPlusCheckoutCreateExecutor({
  addLog,
  chrome,
  completeStepFromBackground,
  ensureContentScriptReadyOnTabUntilStopped,
  fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  markCurrentRegistrationAccountUsed,
  registerTab,
  sendTabMessageUntilStopped,
  setState,
  sleepWithStop,
  throwIfStopped,
  waitForTabCompleteUntilStopped,
});
const plusCheckoutBillingExecutor = self.MultiPageBackgroundPlusCheckoutBilling?.createPlusCheckoutBillingExecutor({
  addLog,
  broadcastDataUpdate,
  chrome,
  completeStepFromBackground,
  ensureContentScriptReadyOnTabUntilStopped,
  fetch: typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  generateRandomName,
  getAddressSeedForCountry: self.MultiPageAddressSources?.getAddressSeedForCountry,
  getState,
  getTabId,
  isTabAlive,
  markCurrentRegistrationAccountUsed,
  sendTabMessageUntilStopped,
  setState,
  sleepWithStop,
  throwIfStopped,
  waitForTabCompleteUntilStopped,
  waitForTabUrlMatchUntilStopped,
  probeIpProxyExit,
});
const goPayManualConfirmExecutor = self.MultiPageBackgroundGoPayManualConfirm?.createGoPayManualConfirmExecutor({
  addLog,
  broadcastDataUpdate,
  chrome,
  getTabId,
  isTabAlive,
  registerTab,
  setState,
});
const payPalApproveExecutor = self.MultiPageBackgroundPayPalApprove?.createPayPalApproveExecutor({
  addLog,
  chrome,
  completeStepFromBackground,
  ensureContentScriptReadyOnTabUntilStopped,
  getTabId,
  isTabAlive,
  sendTabMessageUntilStopped,
  setState,
  sleepWithStop,
  waitForTabCompleteUntilStopped,
  waitForTabUrlMatchUntilStopped,
});
const goPayApproveExecutor = self.MultiPageBackgroundGoPayApprove?.createGoPayApproveExecutor({
  addLog,
  chrome,
  completeStepFromBackground,
  ensureContentScriptReadyOnTabUntilStopped,
  getTabId,
  isTabAlive,
  registerTab,
  sendTabMessageUntilStopped,
  setState,
  sleepWithStop,
  waitForTabCompleteUntilStopped,
  clickWithDebugger,
  requestGoPayOtpInput: (payload = {}) => chrome.runtime.sendMessage({
    type: 'REQUEST_GOPAY_OTP_INPUT',
    payload,
  }),
});
const plusReturnConfirmExecutor = self.MultiPageBackgroundPlusReturnConfirm?.createPlusReturnConfirmExecutor({
  addLog,
  completeStepFromBackground,
  getTabId,
  isTabAlive,
  setState,
  sleepWithStop,
  waitForTabUrlMatchUntilStopped,
});
const step10Executor = self.MultiPageBackgroundStep10?.createStep10Executor({
  addLog,
  chrome,
  closeConflictingTabsForSource,
  completeStepFromBackground,
  ensureContentScriptReadyOnTab,
  getPanelMode,
  getTabId,
  isLocalhostOAuthCallbackUrl,
  isTabAlive,
  normalizeCodex2ApiUrl,
  normalizeSub2ApiUrl,
  rememberSourceLastUrl,
  reuseOrCreateTab,
  sendToContentScript,
  sendToContentScriptResilient,
  shouldBypassStep9ForLocalCpa,
  SUB2API_STEP9_RESPONSE_TIMEOUT_MS,
});
const stepExecutorsByKey = {
  'open-chatgpt': () => step1Executor.executeStep1(),
  'submit-signup-email': (state) => step2Executor.executeStep2(state),
  'fill-password': (state) => step3Executor.executeStep3(state),
  'fetch-signup-code': (state) => step4Executor.executeStep4(state),
  'fill-profile': (state) => step5Executor.executeStep5(state),
  'wait-registration-success': (state) => step6Executor.executeStep6(state),
  'plus-checkout-create': (state) => plusCheckoutCreateExecutor.executePlusCheckoutCreate(state),
  'plus-checkout-billing': (state) => plusCheckoutBillingExecutor.executePlusCheckoutBilling(state),
  'gopay-subscription-confirm': (state) => goPayManualConfirmExecutor.executeGoPayManualConfirm(state),
  'paypal-approve': (state) => normalizePlusPaymentMethod(state?.plusPaymentMethod) === PLUS_PAYMENT_METHOD_GOPAY
    ? goPayApproveExecutor.executeGoPayApprove(state)
    : payPalApproveExecutor.executePayPalApprove(state),
  'plus-checkout-return': (state) => plusReturnConfirmExecutor.executePlusReturnConfirm(state),
  'oauth-login': (state) => step7Executor.executeStep7(state),
  'fetch-login-code': (state) => step8Executor.executeStep8(state),
  'confirm-oauth': (state) => step9Executor.executeStep9(state),
  'platform-verify': (state) => executeStep10(state),
};
const messageRouter = self.MultiPageBackgroundMessageRouter?.createMessageRouter({
  addLog,
  appendAccountRunRecord: (...args) => appendAndBroadcastAccountRunRecord(...args),
  batchUpdateLuckmailPurchases,
  buildLocalhostCleanupPrefix,
  buildLuckmailSessionSettingsPayload,
  buildPersistentSettingsPayload,
  broadcastDataUpdate,
  applyIpProxySettingsFromState,
  cancelScheduledAutoRun,
  checkIcloudSession,
  clearAccountRunHistory: (...args) => clearAndBroadcastAccountRunHistory(...args),
  deleteAccountRunHistoryRecords: (...args) => deleteAndBroadcastAccountRunHistoryRecords(...args),
  clearAutoRunTimerAlarm,
  clearFreeReusablePhoneActivation,
  clearLuckmailRuntimeState,
  clearStopRequest,
  closeLocalhostCallbackTabs,
  closeTabsByUrlPrefix,
  completeStepFromBackground,
  deleteHotmailAccount,
  deleteHotmailAccounts,
  deleteIcloudAlias,
  deleteUsedIcloudAliases,
  findPayPalAccount,
  disableUsedLuckmailPurchases,
  doesStepUseCompletionSignal,
  ensureMail2925MailboxSession,
  ensureManualInteractionAllowed,
  executeStep,
  executeStepViaCompletionSignal,
  exportSettingsBundle,
  fetchGeneratedEmail,
  refreshGpcCardBalance,
  finalizePhoneActivationAfterSuccessfulFlow,
  finalizeStep3Completion: async () => {
    const currentState = await getState();
    const signupTabId = await getTabId('signup-page');
    return signupFlowHelpers.finalizeSignupPasswordSubmitInTab(
      signupTabId,
      currentState.password || currentState.customPassword || '',
      3
    );
  },
  finalizeIcloudAliasAfterSuccessfulFlow,
  findHotmailAccount,
  flushCommand,
  getCurrentLuckmailPurchase,
  getPendingAutoRunTimerPlan,
  getSourceLabel,
  getState,
  getStepDefinitionForState,
  getStepIdsForState,
  getLastStepIdForState,
  normalizeSignupMethod,
  canUsePhoneSignup,
  resolveSignupMethod,
  getTabId,
  getStopRequested: () => stopRequested,
  handleCloudflareSecurityBlocked,
  handleAutoRunLoopUnhandledError,
  importSettingsBundle,
  invalidateDownstreamAfterStepRestart,
  isCloudflareSecurityBlockedError: isTerminalSecurityBlockedError,
  isAutoRunLockedState,
  isHotmailProvider,
  isLocalhostOAuthCallbackUrl,
  isLuckmailProvider,
  isStopError,
  isTabAlive,
  launchAutoRunTimerPlan,
  ensureIpProxyAutoSyncAlarm,
  clearIpProxyAutoSyncAlarm,
  runIpProxyAutoSync,
  listIcloudAliases,
  listLuckmailPurchasesForManagement,
  markCurrentCustomEmailPoolEntryUsed,
  markCurrentRegistrationAccountUsed,
  getCurrentMail2925Account,
  normalizeHotmailAccounts,
  normalizeMail2925Accounts,
  normalizePayPalAccounts,
  normalizeRunCount,
  AUTO_RUN_TIMER_KIND_SCHEDULED_START,
  notifyStepComplete,
  notifyStepError,
  patchHotmailAccount,
  patchMail2925Account,
  registerTab,
  requestStop,
  probeIpProxyExit,
  resetState,
  resumeAutoRun,
  scheduleAutoRun,
  selectLuckmailPurchase,
  switchIpProxy,
  changeIpProxyExit,
  setCurrentPayPalAccount,
  setCurrentHotmailAccount,
  setCurrentMail2925Account,
  setContributionMode,
  setEmailState,
  setEmailStateSilently,
  setFreeReusablePhoneActivation,
  setSignupPhoneState,
  setSignupPhoneStateSilently,
  setIcloudAliasPreservedState,
  setIcloudAliasUsedState,
  setLuckmailPurchaseDisabledState,
  setLuckmailPurchasePreservedState,
  setLuckmailPurchaseUsedState,
  setPersistentSettings,
  setState,
  setStepStatus,
  skipAutoRunCountdown,
  skipStep,
  startContributionFlow: (...args) => contributionOAuthManager?.startContributionFlow?.(...args),
  startAutoRunLoop,
  pollContributionStatus: (...args) => contributionOAuthManager?.pollContributionStatus?.(...args),
  syncHotmailAccounts,
  syncPayPalAccounts,
  deleteMail2925Account,
  deleteMail2925Accounts,
  testHotmailAccountMailAccess,
  upsertPayPalAccount,
  upsertMail2925Account,
  upsertHotmailAccount,
  verifyHotmailAccount,
});

function buildStepRegistry(definitions = []) {
  return self.MultiPageBackgroundStepRegistry?.createStepRegistry(
    definitions.map((definition) => ({
      ...definition,
      execute: stepExecutorsByKey[definition.key],
    }))
  );
}

const normalStepRegistry = buildStepRegistry(NORMAL_STEP_DEFINITIONS);
const plusPayPalStepRegistry = buildStepRegistry(PLUS_PAYPAL_STEP_DEFINITIONS);
const plusGoPayStepRegistry = buildStepRegistry(PLUS_GOPAY_STEP_DEFINITIONS);
const plusGpcStepRegistry = buildStepRegistry(PLUS_GPC_STEP_DEFINITIONS);

function getStepRegistryForState(state = {}) {
  if (!isPlusModeState(state)) {
    return normalStepRegistry;
  }
  const paymentMethod = normalizePlusPaymentMethod(state?.plusPaymentMethod);
  if (paymentMethod === PLUS_PAYMENT_METHOD_GPC_HELPER) {
    return plusGpcStepRegistry;
  }
  return paymentMethod === PLUS_PAYMENT_METHOD_GOPAY ? plusGoPayStepRegistry : plusPayPalStepRegistry;
}

async function requestOAuthUrlFromPanel(state, options = {}) {
  return panelBridge.requestOAuthUrlFromPanel(state, options);
}

async function requestCpaOAuthUrl(state, options = {}) {
  return panelBridge.requestCpaOAuthUrl(state, options);
}

async function requestSub2ApiOAuthUrl(state, options = {}) {
  return panelBridge.requestSub2ApiOAuthUrl(state, options);
}

async function openSignupEntryTab(step = 1) {
  return signupFlowHelpers.openSignupEntryTab(step);
}

async function ensureSignupEntryPageReady(step = 1) {
  return signupFlowHelpers.ensureSignupEntryPageReady(step);
}

async function ensureSignupAuthEntryPageReady(step = 1) {
  return signupFlowHelpers.ensureSignupEntryPageReady(step);
}

async function ensureSignupPasswordPageReadyInTab(tabId, step = 2, options = {}) {
  return signupFlowHelpers.ensureSignupPasswordPageReadyInTab(tabId, step, options);
}

async function ensureSignupPostEmailPageReadyInTab(tabId, step = 2, options = {}) {
  return signupFlowHelpers.ensureSignupPostEmailPageReadyInTab(tabId, step, options);
}

async function resolveSignupEmailForFlow(state) {
  return signupFlowHelpers.resolveSignupEmailForFlow(state);
}

// ============================================================
// Step 1: Open ChatGPT homepage
// ============================================================

async function executeStep1() {
  return step1Executor.executeStep1();
}

// ============================================================
// Step 2: Click signup, fill email, continue to password page
// ============================================================

async function executeStep2(state) {
  return step2Executor.executeStep2(state);
}

// ============================================================
// Step 3: Fill Password (via signup-page.js)
// ============================================================

async function executeStep3(state) {
  return step3Executor.executeStep3(state);
}

// ============================================================
// Step 4: Get Signup Verification Code (qq-mail.js polls, then fills in signup-page.js)
// ============================================================

function getMailConfig(state) {
  const provider = state.mailProvider || 'qq';
  if (provider === 'custom') {
    return { provider: 'custom', label: '自定义邮箱' };
  }
  if (provider === HOTMAIL_PROVIDER) {
    return { provider: HOTMAIL_PROVIDER, label: 'Hotmail（API对接/本地助手）' };
  }
  if (provider === ICLOUD_PROVIDER) {
    const configuredHost = getConfiguredIcloudHostPreference(state)
      || normalizeIcloudHost(state?.preferredIcloudHost)
      || 'icloud.com';
    const targetMailboxType = normalizeIcloudTargetMailboxType(state?.icloudTargetMailboxType);
    const useForwardMailbox = targetMailboxType === 'forward-mailbox';
    if (useForwardMailbox) {
      const forwardProvider = normalizeIcloudForwardMailProvider(state?.icloudForwardMailProvider);
      const forwardConfig = getSharedIcloudForwardMailConfig(forwardProvider);
      return {
        ...forwardConfig,
        label: `iCloud 转发（${forwardConfig.label}）`,
        icloudForwarding: true,
      };
    }
    const loginUrl = getIcloudLoginUrlForHost(configuredHost) || 'https://www.icloud.com/';
    const mailUrl = getIcloudMailUrlForHost(configuredHost) || loginUrl;
    return {
      source: 'icloud-mail',
      url: mailUrl,
      label: 'iCloud 邮箱',
      navigateOnReuse: true,
    };
  }
  if (provider === GMAIL_PROVIDER) {
    return {
      source: 'gmail-mail',
      url: 'https://mail.google.com/mail/u/0/#inbox',
      label: 'Gmail 邮箱',
      inject: ['content/activation-utils.js', 'content/utils.js', 'content/gmail-mail.js'],
      injectSource: 'gmail-mail',
    };
  }
  if (provider === LUCKMAIL_PROVIDER) {
    return { provider: LUCKMAIL_PROVIDER, label: 'LuckMail（API 购邮）' };
  }
  if (provider === CLOUDFLARE_TEMP_EMAIL_PROVIDER) {
    return { provider: CLOUDFLARE_TEMP_EMAIL_PROVIDER, label: 'Cloudflare Temp Email' };
  }
  if (provider === 'cloudmail') {
    return { provider: 'cloudmail', label: 'Cloud Mail' };
  }
  if (provider === '163') {
    return { source: 'mail-163', url: 'https://mail.163.com/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D', label: '163 邮箱' };
  }
  if (provider === '163-vip') {
    return { source: 'mail-163', url: 'https://webmail.vip.163.com/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D', label: '163 VIP 邮箱' };
  }
  if (provider === '126') {
    return { source: 'mail-163', url: 'https://mail.126.com/js6/main.jsp?df=mail163_letter#module=mbox.ListModule%7C%7B%22fid%22%3A1%2C%22order%22%3A%22date%22%2C%22desc%22%3Atrue%7D', label: '126 邮箱' };
  }
  if (provider === 'inbucket') {
    const host = normalizeInbucketOrigin(state.inbucketHost);
    const mailbox = (state.inbucketMailbox || '').trim();
    if (!host) {
      return { error: 'Inbucket 主机地址为空或无效。' };
    }
    if (!mailbox) {
      return { error: 'Inbucket 邮箱名称为空。' };
    }
    return {
      source: 'inbucket-mail',
      url: `${host}/m/${encodeURIComponent(mailbox)}/`,
      label: `Inbucket 邮箱（${mailbox}）`,
      navigateOnReuse: true,
      inject: ['content/activation-utils.js', 'content/utils.js', 'content/inbucket-mail.js'],
      injectSource: 'inbucket-mail',
    };
  }
  if (provider === '2925') {
    return {
      provider: '2925',
      source: 'mail-2925',
      url: 'https://2925.com/#/mailList',
      label: '2925 邮箱',
      inject: ['content/utils.js', 'content/operation-delay.js', 'content/mail-2925.js'],
      injectSource: 'mail-2925',
    };
  }
  return { source: 'qq-mail', url: 'https://wx.mail.qq.com/', label: 'QQ 邮箱' };
}

function normalizeInbucketOrigin(rawValue) {
  const value = (rawValue || '').trim();
  if (!value) return '';

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) ? value : `https://${value}`;

  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch {
    return '';
  }
}

function getVerificationCodeStateKey(step) {
  return verificationFlowHelpers.getVerificationCodeStateKey(step);
}

function getVerificationCodeLabel(step) {
  return verificationFlowHelpers.getVerificationCodeLabel(step);
}

async function confirmCustomVerificationStepBypass(step) {
  return verificationFlowHelpers.confirmCustomVerificationStepBypass(step);
}

function getVerificationPollPayload(step, state, overrides = {}) {
  return verificationFlowHelpers.getVerificationPollPayload(step, state, overrides);
}

async function requestVerificationCodeResend(step) {
  return verificationFlowHelpers.requestVerificationCodeResend(step);
}

async function pollFreshVerificationCode(step, state, mail, pollOverrides = {}) {
  return verificationFlowHelpers.pollFreshVerificationCode(step, state, mail, pollOverrides);
}

async function pollFreshVerificationCodeWithResendInterval(step, state, mail, pollOverrides = {}) {
  return verificationFlowHelpers.pollFreshVerificationCodeWithResendInterval(step, state, mail, pollOverrides);
}

async function submitVerificationCode(step, code) {
  return verificationFlowHelpers.submitVerificationCode(step, code);
}

async function resolveVerificationStep(step, state, mail, options = {}) {
  return verificationFlowHelpers.resolveVerificationStep(step, state, mail, options);
}

async function executeStep4(state) {
  return step4Executor.executeStep4(state);
}

// ============================================================
// Step 5: Fill Name & Birthday (via signup-page.js)
// ============================================================

async function executeStep5(state) {
  return step5Executor.executeStep5(state);
}

// ============================================================
// Step 7: Login and ensure the auth page reaches the login verification page
// ============================================================

async function refreshOAuthUrlBeforeStep6(state, options = {}) {
  const visibleStep = Number(options.visibleStep) || Number(state?.visibleStep) || 7;
  if (state?.contributionModeExpected && !state?.contributionMode) {
    throw new Error(`步骤 ${visibleStep}：当前自动流程预期使用贡献模式，但运行态 contributionMode 已丢失，已阻止回退到普通 CPA / SUB2API / Codex2API 链路。请重新进入贡献模式后再点击自动。`);
  }
  if (state?.contributionMode && contributionOAuthManager?.startContributionFlow) {
    await addLog('contributionMode=true，走公开贡献接口，正在申请 OAuth 登录地址...', 'info', {
      step: visibleStep,
      stepKey: 'oauth-login',
    });
    const contributionState = await contributionOAuthManager.startContributionFlow({
      nickname: state.contributionNickname || '',
      openAuthTab: false,
      stateOverride: state,
    });
    const oauthUrl = String(contributionState?.contributionAuthUrl || '').trim();
    if (!oauthUrl) {
      throw new Error('贡献模式未返回可用的登录地址，请稍后重试。');
    }
    await handleStepData(1, { oauthUrl });
    return oauthUrl;
  }
  await addLog(`contributionMode=false，走普通 CPA / SUB2API / Codex2API 链路（当前面板：${getPanelModeLabel(state)}），正在刷新 OAuth 登录地址...`, 'info', {
    step: visibleStep,
    stepKey: 'oauth-login',
  });
  console.log(LOG_PREFIX, '[refreshOAuthUrlBeforeStep6] requesting fresh OAuth directly from panel');
  const refreshResult = await requestOAuthUrlFromPanel(state, { logLabel: `步骤 ${visibleStep}` });
  await handleStepData(1, refreshResult);

  if (!refreshResult?.oauthUrl) {
    throw new Error('刷新 OAuth 链接后仍未拿到可用链接。');
  }

  return refreshResult.oauthUrl;
}

function buildOAuthFlowTimeoutError(step, actionLabel = '后续授权流程', state = {}) {
  const restartStep = typeof getAuthChainStartStepId === 'function'
    ? getAuthChainStartStepId(state)
    : FINAL_OAUTH_CHAIN_START_STEP;
  return new Error(
    `步骤 ${step}：从拿到 OAuth 登录地址开始，${Math.round(OAUTH_FLOW_TIMEOUT_MS / 60000)} 分钟内未完成${actionLabel}，结束当前链路，准备从步骤 ${restartStep} 重新开始。`
  );
}

function normalizeOAuthFlowDeadlineAt(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.floor(numeric);
}

function normalizeOAuthFlowSourceUrl(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

async function startOAuthFlowTimeoutWindow(options = {}) {
  const step = Number(options.step) || 7;
  const state = options.state || await getState();
  if (state?.oauthFlowTimeoutEnabled === false) {
    await setState({
      oauthFlowDeadlineAt: null,
      oauthFlowDeadlineSourceUrl: null,
    });
    await addLog(`步骤 ${step}：已拿到新的 OAuth 登录地址，授权后链总超时已关闭，仅保留各步骤本地等待超时。`, 'info');
    return null;
  }

  const deadlineAt = Date.now() + OAUTH_FLOW_TIMEOUT_MS;
  await setState({
    oauthFlowDeadlineAt: deadlineAt,
    oauthFlowDeadlineSourceUrl: normalizeOAuthFlowSourceUrl(options.oauthUrl),
  });
  await addLog(`步骤 ${step}：已拿到新的 OAuth 登录地址，开始 ${Math.round(OAUTH_FLOW_TIMEOUT_MS / 60000)} 分钟倒计时。`, 'info');
  return deadlineAt;
}

async function getOAuthFlowRemainingMs(options = {}) {
  const step = Number(options.step) || 7;
  const actionLabel = String(options.actionLabel || '后续授权流程').trim() || '后续授权流程';
  const state = options.state || await getState();
  if (state?.oauthFlowTimeoutEnabled === false) {
    return null;
  }

  const deadlineAt = normalizeOAuthFlowDeadlineAt(state?.oauthFlowDeadlineAt);
  const deadlineSourceUrl = normalizeOAuthFlowSourceUrl(state?.oauthFlowDeadlineSourceUrl);
  const currentOauthUrl = normalizeOAuthFlowSourceUrl(options.oauthUrl !== undefined ? options.oauthUrl : state?.oauthUrl);
  if (!deadlineAt) {
    return null;
  }

  if (deadlineSourceUrl && currentOauthUrl && deadlineSourceUrl !== currentOauthUrl) {
    console.warn(LOG_PREFIX, '[oauth-flow] ignoring stale deadline due to oauth url mismatch', {
      step,
      actionLabel,
      deadlineSourceUrl,
      currentOauthUrl,
    });
    return null;
  }

  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw buildOAuthFlowTimeoutError(step, actionLabel, state);
  }

  return remainingMs;
}

async function getOAuthFlowStepTimeoutMs(defaultTimeoutMs, options = {}) {
  const normalizedDefault = Math.max(1000, Number(defaultTimeoutMs) || 1000);
  const reserveMs = Math.max(0, Number(options.reserveMs) || 0);
  const remainingMs = await getOAuthFlowRemainingMs(options);
  if (remainingMs === null) {
    return normalizedDefault;
  }

  const budgetMs = remainingMs - reserveMs;
  if (budgetMs <= 0) {
    const stateForError = options.state || await getState();
    throw buildOAuthFlowTimeoutError(
      Number(options.step) || 7,
      String(options.actionLabel || '后续授权流程').trim() || '后续授权流程',
      stateForError
    );
  }

  return Math.max(1000, Math.min(normalizedDefault, budgetMs));
}

function isStep6SuccessResult(result) {
  return result?.step6Outcome === 'success';
}

function isStep6RecoverableResult(result) {
  return result?.step6Outcome === 'recoverable';
}

function isAddPhoneAuthUrl(url) {
  return /https:\/\/auth\.openai\.com\/(?:add-phone|phone-verification)(?:[/?#]|$)/i.test(String(url || '').trim());
}

function isAddPhoneAuthState(authState = {}) {
  return authState?.state === 'add_phone_page'
    || authState?.state === 'phone_verification_page'
    || Boolean(authState?.addPhonePage)
    || Boolean(authState?.phoneVerificationPage)
    || isAddPhoneAuthUrl(authState?.url);
}

async function getPostStep6AutoRestartDecision(step, error) {
  const resolveStepKey = (stepId, state) => {
    if (typeof getStepExecutionKeyForState === 'function') {
      return getStepExecutionKeyForState(stepId, state);
    }
    return String(
      typeof getStepDefinitionForState === 'function'
        ? (getStepDefinitionForState(stepId, state)?.key || '')
        : ''
    ).trim();
  };
  const findStepIdByKeyForState = (targetKey, state = {}) => {
    const normalizedKey = String(targetKey || '').trim();
    if (!normalizedKey) {
      return null;
    }
    const stepIds = typeof getStepIdsForState === 'function'
      ? getStepIdsForState(state)
      : [];
    for (const stepId of stepIds) {
      if (resolveStepKey(stepId, state) === normalizedKey) {
        return Number(stepId);
      }
    }
    return null;
  };
  const isPlatformVerifyTransientRetryError = (errorMessage = '') => {
    const normalizedMessage = String(errorMessage || '');
    const mentionsTokenExchange = /auth\.openai\.com\/oauth\/token|token\s*exchange|token_exchange_user_error/i.test(normalizedMessage);
    const hasTransientNetworkSignal = /connect:\s*connection refused|failed to fetch|i\/o timeout|context deadline exceeded|eof|connection reset by peer/i.test(normalizedMessage);
    const hasTransientTokenExchangeSignal = /token_exchange_user_error|invalid request\.?\s*please try again later/i.test(normalizedMessage);
    return mentionsTokenExchange && (hasTransientNetworkSignal || hasTransientTokenExchangeSignal);
  };
  const isPhoneVerificationLocalFailure = (errorMessage = '') => {
    const normalizedMessage = String(errorMessage || '');
    if (isPhoneSmsPlatformRateLimitFailure(normalizedMessage)) {
      return false;
    }
    return /HeroSMS|phone verification did not succeed|number replacements|sms_timeout_after_resend|phone number is already linked|add-phone keeps rejecting current number|接码|手机号|手机验证码|步骤\s*9.*(?:手机号|验证码)|Step\s*9.*phone verification/i.test(normalizedMessage);
  };

  const normalizedStep = Number(step);
  const errorMessage = getErrorMessage(error);
  const shouldForceRestartFromStep7 = /restart step 7 with a new number/i.test(errorMessage);
  const latestState = await getState();
  const authChainStartStep = typeof getAuthChainStartStepId === 'function'
    ? getAuthChainStartStepId(latestState)
    : FINAL_OAUTH_CHAIN_START_STEP;
  const lastStepId = typeof getLastStepIdForState === 'function'
    ? getLastStepIdForState(latestState)
    : (typeof LAST_STEP_ID === 'number' ? LAST_STEP_ID : 10);
  const currentStepKey = resolveStepKey(normalizedStep, latestState);
  const confirmOauthStep = findStepIdByKeyForState('confirm-oauth', latestState);
  const shouldRetryFromConfirmStep = currentStepKey === 'platform-verify'
    && Number.isFinite(confirmOauthStep)
    && confirmOauthStep > 0
    && confirmOauthStep < normalizedStep
    && isPlatformVerifyTransientRetryError(errorMessage);
  const restartAnchorStep = shouldRetryFromConfirmStep ? confirmOauthStep : authChainStartStep;
  if (isPhoneSmsPlatformRateLimitFailure(errorMessage)) {
    return {
      shouldRestart: false,
      blockedByAddPhone: false,
      forcedByPhoneVerificationTimeout: false,
      restartStep: authChainStartStep,
      errorMessage,
      authState: null,
    };
  }

  if (!Number.isFinite(normalizedStep) || normalizedStep < authChainStartStep || normalizedStep > lastStepId) {
    return {
      shouldRestart: false,
      blockedByAddPhone: false,
      forcedByPhoneVerificationTimeout: false,
      restartStep: authChainStartStep,
      errorMessage,
      authState: null,
    };
  }

  if (isPhoneVerificationLocalFailure(errorMessage)) {
    return {
      shouldRestart: false,
      blockedByAddPhone: true,
      forcedByPhoneVerificationTimeout: false,
      restartStep: authChainStartStep,
      errorMessage,
      authState: null,
    };
  }

  if (shouldForceRestartFromStep7) {
    return {
      shouldRestart: true,
      blockedByAddPhone: false,
      forcedByPhoneVerificationTimeout: true,
      restartStep: authChainStartStep,
      errorMessage,
      authState: null,
    };
  }

  if (isAddPhoneAuthFailure(error) || isAddPhoneAuthUrl(errorMessage)) {
    return {
      shouldRestart: false,
      blockedByAddPhone: true,
      forcedByPhoneVerificationTimeout: false,
      restartStep: authChainStartStep,
      errorMessage,
      authState: null,
    };
  }

  let authState = null;
  try {
    authState = await getLoginAuthStateFromContent({
      logMessage: `步骤 ${normalizedStep}：正在确认当前认证页状态，以决定是否回到步骤 ${restartAnchorStep} 重开...`,
    });
  } catch (inspectError) {
    console.warn(LOG_PREFIX, '[AutoRun] failed to inspect login auth state after post-step6 error', {
      step: normalizedStep,
      sourceError: errorMessage,
      inspectError: inspectError?.message || inspectError,
    });
  }

  if (isAddPhoneAuthState(authState) && !isPhoneSmsPlatformRateLimitFailure(errorMessage)) {
    return {
      shouldRestart: false,
      blockedByAddPhone: true,
      forcedByPhoneVerificationTimeout: false,
      restartStep: authChainStartStep,
      errorMessage,
      authState,
    };
  }

  return {
    shouldRestart: true,
    blockedByAddPhone: false,
    forcedByPhoneVerificationTimeout: false,
    restartStep: restartAnchorStep,
    errorMessage,
    authState,
  };
}

async function getLoginAuthStateFromContent(options = {}) {
  const visibleStep = Math.floor(Number(options.visibleStep || options.logStep || options.step) || 0);
  const logStep = visibleStep > 0 ? visibleStep : null;
  const { logMessage = '认证页正在切换，等待页面重新就绪后继续确认验证码页状态...' } = options;
  const result = await sendToContentScriptResilient(
    'signup-page',
    {
      type: 'GET_LOGIN_AUTH_STATE',
      source: 'background',
      payload: {},
    },
    {
      timeoutMs: options.timeoutMs ?? 15000,
      retryDelayMs: options.retryDelayMs ?? 600,
      responseTimeoutMs: options.responseTimeoutMs ?? (options.timeoutMs ?? 15000),
      logMessage,
      logStep,
      logStepKey: options.logStepKey || '',
    }
  );

  if (result?.error) {
    throw new Error(result.error);
  }

  return result || {};
}

async function ensureStep8VerificationPageReady(options = {}) {
  const visibleStep = Number(options.visibleStep) || 8;
  const authLoginStep = Number(options.authLoginStep) || (visibleStep >= 11 ? 10 : 7);
  const inspectState = async (overrides = {}) => getLoginAuthStateFromContent({
    ...options,
    ...overrides,
  });
  let pageState = await inspectState();
  if (
    pageState.state === 'verification_page'
    || pageState.state === 'oauth_consent_page'
    || (options.allowPhoneVerificationPage && pageState.state === 'phone_verification_page')
    || (options.allowAddEmailPage && pageState.state === 'add_email_page')
  ) {
    return pageState;
  }

  if (pageState.maxCheckAttemptsBlocked) {
    throw new Error(`${CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX}${CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE}`);
  }

  if (pageState.state === 'login_timeout_error_page') {
    let recovered = false;
    try {
      const recoverPayload = {
        flow: 'login',
        logLabel: `步骤 ${visibleStep}：检测到登录超时报错，正在点击“重试”恢复当前页面`,
        step: visibleStep,
        timeoutMs: 12000,
      };
      const recoverMessage = {
        type: 'RECOVER_AUTH_RETRY_PAGE',
        source: 'background',
        payload: recoverPayload,
      };
      let recoverResult = null;
      const recoverTimeoutMs = 15000;
      if (typeof sendToContentScriptResilient === 'function') {
        recoverResult = await sendToContentScriptResilient(
          'signup-page',
          recoverMessage,
          {
            timeoutMs: recoverTimeoutMs,
            responseTimeoutMs: recoverTimeoutMs,
            retryDelayMs: 700,
            logMessage: '认证页进入重试/超时报错状态，正在尝试点击“重试”恢复...',
            logStep: visibleStep,
            logStepKey: 'fetch-login-code',
          }
        );
      } else if (typeof sendToContentScript === 'function') {
        recoverResult = await sendToContentScript('signup-page', recoverMessage, {
          responseTimeoutMs: recoverTimeoutMs,
        });
      }

      if (recoverResult?.error) {
        throw new Error(recoverResult.error);
      }
      recovered = Boolean(recoverResult?.recovered || Number(recoverResult?.clickCount) > 0);
      if (recovered && typeof addLog === 'function') {
        await addLog('认证页已点击“重试”，正在重新确认验证码页状态...', 'warn', {
          step: visibleStep,
          stepKey: 'fetch-login-code',
        });
      }
    } catch (recoverError) {
      const recoverMessage = getErrorMessage(recoverError);
      if (/^CF_SECURITY_BLOCKED::/i.test(recoverMessage)) {
        throw recoverError;
      }
      if (typeof addLog === 'function') {
        await addLog(`认证页“重试”恢复失败：${recoverMessage}`, 'warn', {
          step: visibleStep,
          stepKey: 'fetch-login-code',
        });
      }
    }

    if (recovered) {
      pageState = await inspectState({
        timeoutMs: 10000,
        responseTimeoutMs: 10000,
        retryDelayMs: 500,
        logMessage: '认证页恢复后，正在确认验证码页是否可继续...',
        logStepKey: 'fetch-login-code',
      });
      if (
        pageState.state === 'verification_page'
        || pageState.state === 'oauth_consent_page'
        || (options.allowPhoneVerificationPage && pageState.state === 'phone_verification_page')
        || (options.allowAddEmailPage && pageState.state === 'add_email_page')
      ) {
        return pageState;
      }
      if (pageState.maxCheckAttemptsBlocked) {
        throw new Error(`${CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX}${CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE}`);
      }
      if (pageState.state === 'add_phone_page' || pageState.state === 'phone_verification_page') {
        const urlPart = pageState.url ? ` URL: ${pageState.url}` : '';
        throw new Error(`步骤 ${visibleStep}：当前认证页进入手机号页面，当前流程无法继续自动授权。${urlPart}`.trim());
      }
    }

    const urlPart = pageState.url ? ` URL: ${pageState.url}` : '';
    throw new Error(`STEP8_RESTART_STEP7::步骤 ${visibleStep}：当前认证页进入登录超时报错页，请回到步骤 ${authLoginStep} 重新开始。${urlPart}`.trim());
  }

  if (pageState.state === 'add_phone_page' || pageState.state === 'phone_verification_page') {
    const urlPart = pageState.url ? ` URL: ${pageState.url}` : '';
    throw new Error(`步骤 ${visibleStep}：当前认证页进入手机号页面，当前流程无法继续自动授权。${urlPart}`.trim());
  }

  const stateLabel = getLoginAuthStateLabel(pageState.state);
  const urlPart = pageState.url ? ` URL: ${pageState.url}` : '';
  throw new Error(`当前未进入登录验证码页面，请先重新完成步骤 ${authLoginStep}。当前状态：${stateLabel}.${urlPart}`.trim());
}

async function rerunStep7ForStep8Recovery(options = {}) {
  const {
    logMessage = '正在回到授权登录步骤，重新发起登录验证码流程...',
    logStep = null,
    logStepKey = 'fetch-login-code',
    postStepDelayMs = 3000,
  } = options;

  throwIfStopped();
  const initialState = await getState();
  const authLoginStep = typeof getAuthChainStartStepId === 'function'
    ? getAuthChainStartStepId(initialState)
    : FINAL_OAUTH_CHAIN_START_STEP;
  await addLog(logMessage, 'warn', {
    step: logStep,
    stepKey: logStepKey,
  });
  await setStepStatus(authLoginStep, 'running');
  await addLog('开始执行', 'info', { step: authLoginStep });

  try {
    await step7Executor.executeStep7({
      ...initialState,
      visibleStep: authLoginStep,
    });
  } catch (err) {
    const latestState = await getState();
    if (isStopError(err)) {
      await setStepStatus(authLoginStep, 'stopped');
      await addLog('已被用户停止', 'warn', { step: authLoginStep });
      await appendManualAccountRunRecordIfNeeded(`step${authLoginStep}_stopped`, latestState, getErrorMessage(err));
      throw err;
    }
    if (isTerminalSecurityBlockedError(err)) {
      await handleCloudflareSecurityBlocked(err);
      throw new Error(STOP_ERROR_MESSAGE);
    }
    await setStepStatus(authLoginStep, 'failed');
    await addLog(`失败：${getErrorMessage(err)}`, 'error', { step: authLoginStep });
    await appendManualAccountRunRecordIfNeeded(`step${authLoginStep}_failed`, latestState, getErrorMessage(err));
    throw err;
  }

  if (postStepDelayMs > 0) {
    await sleepWithStop(postStepDelayMs);
  }
}

async function executeStep6(state = null) {
  return step6Executor.executeStep6(state || await getState());
}

// ============================================================
// Step 7: Refresh OAuth and log in
// ============================================================

async function executeStep7(state) {
  return step7Executor.executeStep7(state);
}

// ============================================================
// Step 8: Poll login verification mail and submit the login code
// ============================================================

async function executeStep8(state) {
  return step8Executor.executeStep8(state);
}

// ============================================================
// Step 9: 完成 OAuth（自动点击 + localhost 回调监听）
// ============================================================

let webNavListener = null;
let webNavCommittedListener = null;
let step8TabUpdatedListener = null;
let step8PendingReject = null;
const STEP8_CLICK_EFFECT_TIMEOUT_MS = 15000;
const STEP8_CLICK_RETRY_DELAY_MS = 500;
const STEP8_READY_WAIT_TIMEOUT_MS = 180000;
const STEP8_MAX_ROUNDS = 5;
const STEP8_STRATEGIES = [
  { mode: 'content', strategy: 'requestSubmit', label: 'form.requestSubmit' },
  { mode: 'debugger', label: 'debugger click' },
  { mode: 'content', strategy: 'nativeClick', label: 'element.click' },
  { mode: 'content', strategy: 'dispatchClick', label: 'dispatch click' },
  { mode: 'debugger', label: 'debugger click retry' },
];

function setWebNavListener(listener) {
  webNavListener = listener;
}

function getWebNavListener() {
  return webNavListener;
}

function setWebNavCommittedListener(listener) {
  webNavCommittedListener = listener;
}

function getWebNavCommittedListener() {
  return webNavCommittedListener;
}

function setStep8TabUpdatedListener(listener) {
  step8TabUpdatedListener = listener;
}

function getStep8TabUpdatedListener() {
  return step8TabUpdatedListener;
}

function setStep8PendingReject(handler) {
  step8PendingReject = handler;
}

function cleanupStep8NavigationListeners() {
  if (webNavListener) {
    chrome.webNavigation.onBeforeNavigate.removeListener(webNavListener);
    webNavListener = null;
  }
  if (webNavCommittedListener) {
    chrome.webNavigation.onCommitted.removeListener(webNavCommittedListener);
    webNavCommittedListener = null;
  }
  if (step8TabUpdatedListener) {
    chrome.tabs.onUpdated.removeListener(step8TabUpdatedListener);
    step8TabUpdatedListener = null;
  }
}

function rejectPendingStep8(error) {
  if (!step8PendingReject) return;
  const reject = step8PendingReject;
  step8PendingReject = null;
  reject(error);
}

function throwIfStep8SettledOrStopped(isSettled = false) {
  if (isSettled || stopRequested) {
    throw new Error(STOP_ERROR_MESSAGE);
  }
}

function isStep9AuthCallbackWaitPageUrl(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    const hostname = String(parsed.hostname || '').toLowerCase();
    if (!['auth.openai.com', 'auth0.openai.com', 'accounts.openai.com'].includes(hostname)) {
      return false;
    }
    const pathname = String(parsed.pathname || '');
    return /\/api\/oauth\/oauth2\/auth(?:[/?#]|$)/i.test(pathname)
      || /\/oauth\/oauth2\/auth(?:[/?#]|$)/i.test(pathname);
  } catch {
    return false;
  }
}

async function shouldDeferStep9CallbackTimeout(details = {}) {
  const tabId = details?.tabId;
  if (!Number.isInteger(tabId)) return false;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  return isStep9AuthCallbackWaitPageUrl(tab?.url || '');
}

async function ensureStep8SignupPageReady(tabId, options = {}) {
  const visibleStep = Math.floor(Number(options.visibleStep || options.logStep || options.step) || 0);
  await ensureContentScriptReadyOnTab('signup-page', tabId, {
    inject: SIGNUP_PAGE_INJECT_FILES,
    injectSource: 'signup-page',
    timeoutMs: options.timeoutMs ?? 15000,
    retryDelayMs: options.retryDelayMs ?? 600,
    logMessage: options.logMessage || '',
    logStep: visibleStep > 0 ? visibleStep : null,
    logStepKey: options.logStepKey || '',
  });
}

async function getStep8PageState(tabId, responseTimeoutMs = 1500, visibleStep = 9) {
  try {
    const result = await sendTabMessageWithTimeout(tabId, 'signup-page', {
      type: 'STEP8_GET_STATE',
      source: 'background',
      payload: { visibleStep },
    }, responseTimeoutMs);
    if (result?.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (err) {
    if (isRetryableContentScriptTransportError(err)) {
      return null;
    }
    throw err;
  }
}

async function waitForStep8Ready(tabId, timeoutMs = STEP8_READY_WAIT_TIMEOUT_MS, options = {}) {
  const visibleStep = Math.floor(Number(options.visibleStep) || 0) || 9;
  const start = Date.now();
  let recovered = false;

  while (Date.now() - start < timeoutMs) {
    throwIfStopped();
    const pageState = await getStep8PageState(tabId, 1500, visibleStep);
    if (pageState?.maxCheckAttemptsBlocked) {
      throw new Error(`${CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX}${CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE}`);
    }
    if (pageState?.addPhonePage || pageState?.phoneVerificationPage) {
      const latestState = await getState();
      if (!Boolean(latestState?.phoneVerificationEnabled)) {
        const urlPart = pageState?.url ? ` URL: ${pageState.url}` : '';
        throw new Error(
          pageState?.phoneVerificationPage
            ? `步骤 ${visibleStep}：当前认证页进入手机验证码页，但未开启接码功能，无法继续自动授权。${urlPart}`.trim()
            : `步骤 ${visibleStep}：当前认证页进入手机号页面，但未开启接码功能，无法继续自动授权。${urlPart}`.trim()
        );
      }
      await phoneVerificationHelpers.completePhoneVerificationFlow(tabId, pageState, { visibleStep });
      recovered = false;
      await sleepWithStop(250);
      continue;
    }
    if (pageState?.addPhonePage) {
      throw new Error(`步骤 ${visibleStep}：认证页进入了手机号页面，当前不是 OAuth 同意页，无法继续自动授权。`);
    }
    if (pageState?.retryPage) {
      const retryUrl = String(pageState?.url || '').trim();
      const consentLikeRetry = Boolean(
        pageState?.consentReady
        || pageState?.consentPage
        || /\/sign-in-with-chatgpt\/[^/?#]+\/consent(?:[/?#]|$)/i.test(retryUrl)
      );
      if (!consentLikeRetry) {
        throw new Error(`步骤 ${visibleStep}：当前认证页已进入重试页，当前流程将直接报错。URL: ${pageState.url || 'unknown'}`);
      }
    }
    if (pageState?.consentReady) {
      return pageState;
    }
    if (pageState === null && !recovered) {
      recovered = true;
      await ensureStep8SignupPageReady(tabId, {
        timeoutMs: Math.min(10000, timeoutMs),
        visibleStep,
        logStepKey: 'confirm-oauth',
        logMessage: '认证页内容脚本已失联，正在等待页面重新就绪...',
      });
      continue;
    }
    recovered = false;
    await sleepWithStop(250);
  }

  throw new Error(`步骤 ${visibleStep}：长时间未进入 OAuth 同意页，无法定位“继续”按钮。`);
}

async function prepareStep8DebuggerClick(tabId, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const responseTimeoutMs = options.responseTimeoutMs ?? timeoutMs;
  const visibleStep = Math.floor(Number(options.visibleStep) || 0) || 9;
  await ensureStep8SignupPageReady(tabId, {
    timeoutMs,
    visibleStep,
    logStepKey: 'confirm-oauth',
    logMessage: '认证页内容脚本已失联，正在恢复后继续定位按钮...',
  });
  const result = await sendToContentScriptResilient('signup-page', {
    type: 'STEP8_FIND_AND_CLICK',
    source: 'background',
    payload: { visibleStep },
  }, {
    timeoutMs,
    responseTimeoutMs,
    retryDelayMs: 600,
    logMessage: '认证页正在切换，等待 OAuth 同意页按钮重新就绪...',
    logStep: visibleStep,
    logStepKey: 'confirm-oauth',
  });

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}

async function triggerStep8ContentStrategy(tabId, strategy, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const responseTimeoutMs = options.responseTimeoutMs ?? timeoutMs;
  const visibleStep = Math.floor(Number(options.visibleStep) || 0) || 9;
  await ensureStep8SignupPageReady(tabId, {
    timeoutMs,
    visibleStep,
    logStepKey: 'confirm-oauth',
    logMessage: '认证页内容脚本已失联，正在恢复后继续点击“继续”按钮...',
  });
  const result = await sendToContentScriptResilient('signup-page', {
    type: 'STEP8_TRIGGER_CONTINUE',
    source: 'background',
    payload: {
      visibleStep,
      strategy,
      findTimeoutMs: 4000,
      enabledTimeoutMs: 3000,
    },
  }, {
    timeoutMs,
    responseTimeoutMs,
    retryDelayMs: 600,
    logMessage: '认证页正在切换，等待“继续”按钮重新就绪...',
    logStep: visibleStep,
    logStepKey: 'confirm-oauth',
  });

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}

async function recoverAuthRetryPageOnTab(tabId, payload = {}, options = {}) {
  const readyTimeoutMs = options.readyTimeoutMs ?? 15000;
  const timeoutMs = options.timeoutMs ?? 15000;
  const responseTimeoutMs = options.responseTimeoutMs ?? timeoutMs;
  const visibleStep = Math.floor(Number(options.visibleStep || payload?.visibleStep || payload?.step) || 0) || 9;
  await ensureStep8SignupPageReady(tabId, {
    timeoutMs: readyTimeoutMs,
    retryDelayMs: options.retryDelayMs ?? 600,
    visibleStep,
    logStepKey: 'confirm-oauth',
    logMessage: options.readyLogMessage || '认证页内容脚本已失联，正在恢复后继续处理重试页...',
  });
  const result = await sendToContentScriptResilient('signup-page', {
    type: 'RECOVER_AUTH_RETRY_PAGE',
    source: 'background',
    payload,
  }, {
    timeoutMs,
    responseTimeoutMs,
    retryDelayMs: options.retryDelayMs ?? 600,
    logMessage: options.logMessage || '认证页正在切换，等待“重试”按钮重新就绪...',
    logStep: visibleStep,
    logStepKey: 'confirm-oauth',
  });

  if (result?.error) {
    throw new Error(result.error);
  }

  return result;
}

async function reloadStep8ConsentPage(tabId, timeoutMs = 30000, options = {}) {
  const visibleStep = Math.floor(Number(options.visibleStep) || 0) || 9;
  if (!Number.isInteger(tabId)) {
    throw new Error(`步骤 ${visibleStep}：缺少有效的认证页标签页，无法刷新后重试。`);
  }

  await chrome.tabs.update(tabId, { active: true }).catch(() => { });

  await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`步骤 ${visibleStep}：刷新认证页后等待页面完成加载超时。`));
    }, timeoutMs);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status !== 'complete') return;
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.reload(tabId, { bypassCache: false }).catch((err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      reject(err);
    });
  });

  await ensureStep8SignupPageReady(tabId, {
    timeoutMs: Math.min(15000, timeoutMs),
    visibleStep,
    logStepKey: 'confirm-oauth',
    logMessage: '认证页刷新后内容脚本尚未就绪，正在等待页面恢复...',
  });
}

async function waitForStep8ClickEffect(tabId, baselineUrl, timeoutMs = STEP8_CLICK_EFFECT_TIMEOUT_MS, options = {}) {
  const visibleStep = Math.floor(Number(options.visibleStep) || 0) || 9;
  const start = Date.now();
  let recovered = false;

  while (Date.now() - start < timeoutMs) {
    throwIfStopped();

    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      throw new Error(`步骤 ${visibleStep}：认证页面标签页已关闭，无法继续自动授权。`);
    }

    if (baselineUrl && typeof tab.url === 'string' && tab.url !== baselineUrl) {
      return { progressed: true, reason: 'url_changed', url: tab.url };
    }

    const pageState = await getStep8PageState(tabId, 1500, visibleStep);
    if (pageState?.maxCheckAttemptsBlocked) {
      throw new Error(`${CLOUDFLARE_SECURITY_BLOCK_ERROR_PREFIX}${CLOUDFLARE_SECURITY_BLOCK_USER_MESSAGE}`);
    }
    if (pageState?.addPhonePage) {
      throw new Error(`步骤 ${visibleStep}：点击“继续”后页面跳到了手机号页面，当前流程无法继续自动授权。`);
    }
    if (pageState?.retryPage) {
      const retryUrl = String(pageState?.url || baselineUrl || '').trim();
      const consentLikeRetry = Boolean(
        pageState?.consentReady
        || pageState?.consentPage
        || /\/sign-in-with-chatgpt\/[^/?#]+\/consent(?:[/?#]|$)/i.test(retryUrl)
      );
      if (!consentLikeRetry) {
        throw new Error(`步骤 ${visibleStep}：点击“继续”后页面进入认证页重试页，当前流程将直接报错。URL: ${pageState.url || baselineUrl || 'unknown'}`);
      }
    }
    if (pageState === null) {
      if (!recovered) {
        recovered = true;
        await ensureStep8SignupPageReady(tabId, {
          timeoutMs: Math.max(1000, Math.min(8000, timeoutMs)),
          visibleStep,
          logStepKey: 'confirm-oauth',
          logMessage: '点击后认证页正在重载，正在等待内容脚本重新就绪...',
        }).catch(() => null);
        continue;
      }
      await sleepWithStop(200);
      continue;
    }
    recovered = false;

    if (pageState?.consentPage === false && !pageState?.verificationPage) {
      return {
        progressed: true,
        reason: 'left_consent_page',
        url: pageState.url || baselineUrl || '',
      };
    }

    await sleepWithStop(200);
  }

  return { progressed: false, reason: 'no_effect' };
}

function getStep8EffectLabel(effect) {
  switch (effect?.reason) {
    case 'url_changed':
      return `URL 已变化：${effect.url}`;
    case 'page_reloading':
      return '页面正在跳转或重载';
    case 'left_consent_page':
      return `页面已离开 OAuth 同意页：${effect.url || 'unknown'}`;
    default:
      return '页面仍停留在 OAuth 同意页';
  }
}

function isStep9OAuthLocalhostTimeoutError(error, visibleStep = 9) {
  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }
  if (!/从拿到 OAuth 登录地址开始/.test(message)) {
    return false;
  }
  if (!/localhost 回调|OAuth localhost 回调/i.test(message)) {
    return false;
  }
  const normalizedStep = Number(visibleStep);
  if (Number.isFinite(normalizedStep) && normalizedStep > 0) {
    const stepPrefix = new RegExp(`步骤\\s*${normalizedStep}\\s*：`);
    if (!stepPrefix.test(message)) {
      return false;
    }
  }
  return true;
}

async function recoverOAuthLocalhostTimeout(details = {}) {
  const {
    error,
    state,
    visibleStep = 9,
  } = details;

  if (!isStep9OAuthLocalhostTimeoutError(error, visibleStep)) {
    return null;
  }

  const authLoginStep = typeof getAuthChainStartStepId === 'function'
    ? getAuthChainStartStepId(state || {})
    : FINAL_OAUTH_CHAIN_START_STEP;
  const loginCodeStep = Number(visibleStep) >= 12 ? 11 : 8;

  await addLog(
    `检测到 OAuth localhost 回调等待窗口已过期，正在复核认证页并回到步骤 ${authLoginStep} 重拉授权链路。`,
    'warn',
    { step: visibleStep, stepKey: 'confirm-oauth' }
  );

  let authState = null;
  try {
    authState = await getLoginAuthStateFromContent({
      timeoutMs: 10000,
      responseTimeoutMs: 10000,
      visibleStep,
      logMessage: '正在复核认证页状态，确认是否可自动恢复 localhost 回调链路...',
      logStepKey: 'confirm-oauth',
    });
  } catch (inspectError) {
    await addLog(
      `复核认证页状态失败（${getErrorMessage(inspectError)}），将先尝试按步骤 ${loginCodeStep} 收尾恢复。`,
      'warn',
      { step: visibleStep, stepKey: 'confirm-oauth' }
    );
  }

  if (isAddPhoneAuthState(authState)) {
    const stateLabel = getLoginAuthStateLabel(authState.state);
    await addLog(
      `当前认证页为 ${stateLabel}，将直接回到步骤 ${authLoginStep} 重新拉起授权链路，避免验证码/OAuth 恢复冲突。`,
      'warn',
      { step: visibleStep, stepKey: 'confirm-oauth' }
    );
  } else if (authState && authState.state && !['verification_page', 'oauth_consent_page'].includes(authState.state)) {
    const stateLabel = getLoginAuthStateLabel(authState.state);
    await addLog(
      `当前认证页为 ${stateLabel}，不满足快速恢复条件，将回到步骤 ${authLoginStep} 重开授权链路。`,
      'warn',
      { step: visibleStep, stepKey: 'confirm-oauth' }
    );
  }

  const latestState = await getState();
  if (!step7Executor?.executeStep7 || !step8Executor?.executeStep8) {
    return null;
  }

  await addLog(
    `正在自动重开步骤 ${authLoginStep} -> ${loginCodeStep}，恢复到可继续捕获 localhost 回调的状态。`,
    'warn',
    { step: visibleStep, stepKey: 'confirm-oauth' }
  );
  await step7Executor.executeStep7({
    ...latestState,
    visibleStep: authLoginStep,
  });

  const stateAfterStep7 = await getState();
  await step8Executor.executeStep8({
    ...stateAfterStep7,
    visibleStep: loginCodeStep,
  });

  const recoveredState = await getState();
  const oauthUrl = String(recoveredState?.oauthUrl || state?.oauthUrl || '').trim();
  if (oauthUrl && typeof startOAuthFlowTimeoutWindow === 'function') {
    await startOAuthFlowTimeoutWindow({
      step: Number(visibleStep) || 9,
      oauthUrl,
    });
  }

  await setState({
    localhostUrl: null,
  });

  await addLog(
    `已恢复到步骤 ${authLoginStep} -> ${loginCodeStep} 收尾状态，并刷新 OAuth localhost 回调等待窗口，准备重试当前步骤。`,
    'warn',
    { step: visibleStep, stepKey: 'confirm-oauth' }
  );
  return await getState();
}

const step9Executor = self.MultiPageBackgroundStep9?.createStep9Executor({
  addLog,
  chrome,
  cleanupStep8NavigationListeners,
  clickWithDebugger,
  completeStepFromBackground,
  ensureStep8SignupPageReady,
  getOAuthFlowStepTimeoutMs,
  getStep8CallbackUrlFromNavigation,
  getStep8CallbackUrlFromTabUpdate,
  getStep8EffectLabel,
  getTabId,
  getWebNavCommittedListener,
  getWebNavListener,
  getStep8TabUpdatedListener,
  isTabAlive,
  prepareStep8DebuggerClick,
  recoverOAuthLocalhostTimeout,
  reloadStep8ConsentPage,
  reuseOrCreateTab,
  setStep8PendingReject,
  setStep8TabUpdatedListener,
  setWebNavCommittedListener,
  setWebNavListener,
  shouldDeferStep9CallbackTimeout,
  sleepWithStop,
  STEP8_CLICK_RETRY_DELAY_MS,
  STEP8_MAX_ROUNDS,
  STEP8_READY_WAIT_TIMEOUT_MS,
  STEP8_STRATEGIES,
  throwIfStep8SettledOrStopped,
  triggerStep8ContentStrategy,
  waitForStep8ClickEffect,
  waitForStep8Ready,
});

async function executeStep9(state) {
  return step9Executor.executeStep9(state);
}

// ============================================================
// Step 10: 平台回调验证
// ============================================================

async function executeContributionStep10(state) {
  const platformVerifyStep = typeof getStepIdByKeyForState === 'function'
    ? (getStepIdByKeyForState('platform-verify', state) || 10)
    : 10;
  const confirmOauthStep = typeof getStepIdByKeyForState === 'function'
    ? (getStepIdByKeyForState('confirm-oauth', state) || 9)
    : 9;
  const authLoginStep = typeof getStepIdByKeyForState === 'function'
    ? (getStepIdByKeyForState('oauth-login', state) || 7)
    : 7;
  if (state.localhostUrl && !isLocalhostOAuthCallbackUrl(state.localhostUrl)) {
    throw new Error(`步骤 ${confirmOauthStep} 捕获到的 localhost OAuth 回调地址无效，请重新执行步骤 ${confirmOauthStep}。`);
  }
  if (!state.localhostUrl) {
    throw new Error(`缺少 localhost 回调地址，请先完成步骤 ${confirmOauthStep}。`);
  }
  if (!state.contributionSessionId) {
    throw new Error(`缺少贡献会话信息，请重新从步骤 ${authLoginStep} 开始。`);
  }
  if (!contributionOAuthManager?.pollContributionStatus) {
    throw new Error(`贡献 OAuth 流程尚未接入，无法完成贡献模式的步骤 ${platformVerifyStep}。`);
  }

  await addLog('贡献模式正在提交回调并等待最终结果...', 'info', {
    step: platformVerifyStep,
    stepKey: 'platform-verify',
  });

  let latestState = await getState();
  const callbackUrl = latestState.localhostUrl || state.localhostUrl;

  if (!latestState.contributionCallbackUrl && contributionOAuthManager?.handleCapturedCallback) {
    latestState = await contributionOAuthManager.handleCapturedCallback(callbackUrl, {
      source: 'step10',
    });
  } else {
    latestState = await contributionOAuthManager.pollContributionStatus({
      reason: 'step10_initial',
      stateOverride: latestState,
    });
  }

  const timeoutMs = typeof getOAuthFlowStepTimeoutMs === 'function'
    ? await getOAuthFlowStepTimeoutMs(120000, {
      step: platformVerifyStep,
      actionLabel: '贡献流程最终结果',
    })
    : 120000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = String(latestState.contributionStatus || '').trim().toLowerCase();
    if (contributionOAuthManager?.isContributionFinalStatus?.(status)) {
      if (status === 'auto_approved') {
        await addLog(`贡献流程已结束，最终状态：${latestState.contributionStatusMessage || status}`, 'ok', {
          step: platformVerifyStep,
          stepKey: 'platform-verify',
        });
        await completeStepFromBackground(platformVerifyStep, {
          contributionStatus: status,
          contributionStatusMessage: latestState.contributionStatusMessage || '',
          localhostUrl: callbackUrl,
        });
        return;
      }
      throw new Error(latestState.contributionStatusMessage || '贡献流程失败。');
    }

    await sleepWithStop(2500);
    latestState = await contributionOAuthManager.pollContributionStatus({
      reason: 'step10_wait_final',
      stateOverride: latestState,
    });
  }

  throw new Error(`步骤 ${platformVerifyStep}：等待贡献流程最终结果超时。`);
}

async function executeStep10(state) {
  const platformVerifyStep = typeof getStepIdByKeyForState === 'function'
    ? (getStepIdByKeyForState('platform-verify', state || {}) || 10)
    : 10;
  if (state?.contributionModeExpected && !state?.contributionMode) {
    throw new Error(`步骤 ${platformVerifyStep}：当前自动流程预期使用贡献模式，但运行态 contributionMode 已丢失，已阻止回退到普通 CPA / SUB2API / Codex2API 提交。请重新进入贡献模式后再点击自动。`);
  }
  if (state?.contributionMode) {
    return executeContributionStep10(state);
  }
  return step10Executor.executeStep10(state);
}

// ============================================================
// Open Side Panel on extension icon click
// ============================================================

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_RUN_TIMER_ALARM_NAME) {
    launchAutoRunTimerPlan('alarm').catch((err) => {
      console.error(LOG_PREFIX, 'Failed to resume auto run from timer alarm:', err);
    });
    return;
  }
  if (alarm.name === IP_PROXY_AUTO_SYNC_ALARM_NAME) {
    runIpProxyAutoSync('alarm').catch((err) => {
      console.error(LOG_PREFIX, 'Failed to run IP proxy auto sync alarm:', err);
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  restoreAutoRunTimerIfNeeded().catch((err) => {
    console.error(LOG_PREFIX, 'Failed to restore auto run timer on startup:', err);
  });
  if (IP_PROXY_INIT_AUTO_APPLY) {
    ensureIpProxySettingsAppliedFromCurrentState({
      skipExitProbe: !IP_PROXY_INIT_ENABLE_EXIT_PROBE,
      suppressAuthRebind: IP_PROXY_INIT_SUPPRESS_AUTH_REBIND,
    }).catch((err) => {
      console.error(LOG_PREFIX, 'Failed to restore IP proxy settings on startup:', err);
    });
  }
  ensureIpProxyAutoSyncAlarm().catch((err) => {
    console.error(LOG_PREFIX, 'Failed to restore IP proxy auto sync alarm on startup:', err);
  });
});

chrome.runtime.onInstalled.addListener(() => {
  restoreAutoRunTimerIfNeeded().catch((err) => {
    console.error(LOG_PREFIX, 'Failed to restore auto run timer on install/update:', err);
  });
  if (IP_PROXY_INIT_AUTO_APPLY) {
    ensureIpProxySettingsAppliedFromCurrentState({
      skipExitProbe: !IP_PROXY_INIT_ENABLE_EXIT_PROBE,
      suppressAuthRebind: IP_PROXY_INIT_SUPPRESS_AUTH_REBIND,
    }).catch((err) => {
      console.error(LOG_PREFIX, 'Failed to restore IP proxy settings on install/update:', err);
    });
  }
  ensureIpProxyAutoSyncAlarm().catch((err) => {
    console.error(LOG_PREFIX, 'Failed to restore IP proxy auto sync alarm on install/update:', err);
  });
});

restoreAutoRunTimerIfNeeded().catch((err) => {
  console.error(LOG_PREFIX, 'Failed to restore auto run timer:', err);
});
if (IP_PROXY_INIT_AUTO_APPLY) {
  ensureIpProxySettingsAppliedFromCurrentState({
    skipExitProbe: !IP_PROXY_INIT_ENABLE_EXIT_PROBE,
    suppressAuthRebind: IP_PROXY_INIT_SUPPRESS_AUTH_REBIND,
  }).catch((err) => {
    console.error(LOG_PREFIX, 'Failed to restore IP proxy settings:', err);
  });
}
ensureIpProxyAutoSyncAlarm().catch((err) => {
  console.error(LOG_PREFIX, 'Failed to restore IP proxy auto sync alarm:', err);
});
