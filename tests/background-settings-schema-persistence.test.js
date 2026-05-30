const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readFlowRegistryBundle } = require('./helpers/script-bundles.js');

const flowRegistrySource = readFlowRegistryBundle();
const settingsSchemaSource = fs.readFileSync('core/flow-kernel/settings-schema.js', 'utf8');
const backgroundSource = fs.readFileSync('background.js', 'utf8');
const DEFAULT_MADAO_BASE_URL_FOR_TEST = 'http://127.0.0.1:7822';
const DEFAULT_MADAO_MODE_FOR_TEST = 'routing_plan';

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => backgroundSource.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < backgroundSource.length; i += 1) {
    const ch = backgroundSource[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < backgroundSource.length; end += 1) {
    const ch = backgroundSource[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return backgroundSource.slice(start, end);
}

function buildHarness(extra = '') {
  return new Function(`
const self = {};
${flowRegistrySource}
${settingsSchemaSource}
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const DEFAULT_SUB2API_GROUP_NAMES = ['codex', 'openai-plus'];
const SETTINGS_SCHEMA_VIEW_KEYS = Object.freeze([
  'activeFlowId',
  'targetId',
  'vpsUrl',
  'vpsPassword',
  'localCpaStep9Mode',
  'sub2apiUrl',
  'sub2apiEmail',
  'sub2apiPassword',
  'sub2apiGroupName',
  'sub2apiGroupNames',
  'sub2apiAccountPriority',
  'sub2apiDefaultProxyName',
  'codex2apiUrl',
  'codex2apiAdminKey',
  'customPassword',
  'signupMethod',
  'phoneVerificationEnabled',
  'phoneSignupReloginAfterBindEmailEnabled',
  'plusModeEnabled',
  'plusPaymentMethod',
  'plusAccountAccessStrategy',
  'mailProvider',
  'customMailReceiveMode',
  'customMailHelperBaseUrl',
  'ipProxyEnabled',
  'ipProxyService',
  'ipProxyMode',
  'kiroRsUrl',
  'kiroRsKey',
  'openaiWebchatUrl',
  'openaiWebchatAdminKey',
  'openaiWebchatUploadEnabled',
  'stepExecutionRangeByFlow',
]);
const SETTINGS_SCHEMA_VIEW_KEY_SET = new Set(SETTINGS_SCHEMA_VIEW_KEYS);
const DEFAULT_MADAO_BASE_URL = 'http://127.0.0.1:7822';
const DEFAULT_MADAO_MODE = 'routing_plan';
const PERSISTED_SETTING_DEFAULTS = {
  activeFlowId: DEFAULT_ACTIVE_FLOW_ID,
  targetId: 'cpa',
  signupMethod: 'email',
  plusModeEnabled: false,
  plusPaymentMethod: 'paypal',
  plusAccountAccessStrategy: 'oauth',
  phoneVerificationEnabled: false,
  mailProvider: '163',
  customMailReceiveMode: 'manual',
  customMailHelperBaseUrl: 'http://127.0.0.1:17374',
  ipProxyEnabled: false,
  ipProxyService: '711proxy',
  ipProxyMode: 'account',
  kiroRsUrl: '',
  kiroRsKey: '',
  openaiWebchatUrl: '',
  openaiWebchatAdminKey: '',
  openaiWebchatUploadEnabled: false,
  openaiWebchatUploadStatus: '',
  openaiWebchatUploadedAt: 0,
  openaiWebchatUploadMessage: '',
  openaiWebchatTargetUrl: '',
  phoneSmsProvider: 'hero-sms',
  madaoBaseUrl: DEFAULT_MADAO_BASE_URL,
  madaoHttpSecret: '',
  madaoMode: DEFAULT_MADAO_MODE,
  madaoRoutingPlanId: '',
  madaoProviderId: '',
  madaoCountry: '',
  madaoOperator: '',
  madaoAutoPickCountry: true,
  madaoReusePhone: true,
  madaoMinPrice: '',
  madaoMaxPrice: '',
  stepExecutionRangeByFlow: {},
};
const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
const PERSISTED_SETTINGS_SCHEMA_KEYS = ['settingsSchemaVersion', 'settingsState'];
const LEGACY_AUTO_STEP_DELAY_KEYS = [];
const LEGACY_VERIFICATION_RESEND_COUNT_KEYS = [];
const PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH = 'oauth';
const PLUS_ACCOUNT_ACCESS_STRATEGY_SUB2API_CODEX_SESSION = 'sub2api_codex_session';
const PLUS_ACCOUNT_ACCESS_STRATEGY_CPA_CODEX_SESSION = 'cpa_codex_session';
const DEFAULT_PLUS_ACCOUNT_ACCESS_STRATEGY = PLUS_ACCOUNT_ACCESS_STRATEGY_OAUTH;
function isPlainObjectValue(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function normalizePanelMode(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'sub2api' || normalized === 'codex2api' ? normalized : 'cpa';
}
function normalizeSignupMethod(value = '') {
  return String(value || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function normalizePlusPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'gopay' || normalized === 'gpc-helper' ? normalized : 'paypal';
}
${extractFunction('normalizePlusAccountAccessStrategy')}
function normalizeSub2ApiGroupNames(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
}
function normalizeCloudflareDomains(value) { return Array.isArray(value) ? value : []; }
function normalizeCloudflareTempEmailDomains(value) { return Array.isArray(value) ? value : []; }
function normalizeCloudMailDomains(value) { return Array.isArray(value) ? value : []; }
function normalizeMailProvider(value = '') { return String(value || '163').trim().toLowerCase() || '163'; }
function normalizeCustomMailReceiveMode(value = '') { return String(value || '').trim().toLowerCase() === 'helper' ? 'helper' : 'manual'; }
function normalizeCustomMailHelperBaseUrl(value = '') {
  const trimmed = String(value || '').trim();
  const candidate = trimmed || 'http://127.0.0.1:17374';
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'http://127.0.0.1:17374';
    }
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/[/]+$/, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return (parsed.origin + path) || 'http://127.0.0.1:17374';
  } catch {
    return 'http://127.0.0.1:17374';
  }
}
function normalizeStepExecutionRangeByFlow(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function normalizePhoneSmsProvider(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === '5sim' || normalized === 'nexsms' || normalized === 'madao') {
    return normalized;
  }
  return 'hero-sms';
}
function normalizePhoneSmsProviderOrder(value = []) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\\r\\n,]+/);
  const seen = new Set();
  return source
    .map((entry) => normalizePhoneSmsProvider(entry))
    .filter((provider) => {
      if (!provider || seen.has(provider)) return false;
      seen.add(provider);
      return true;
    })
    .slice(0, 4);
}
function normalizeLocalHttpBaseUrl(value = '', fallback = DEFAULT_MADAO_BASE_URL) {
  const rawValue = String(value || fallback).trim();
  try {
    const parsed = new URL(rawValue);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return fallback;
    }
    return parsed.toString().replace(/\\/$/, '');
  } catch {
    return fallback;
  }
}
function normalizeMaDaoBaseUrl(value = '') {
  const normalized = normalizeLocalHttpBaseUrl(value, DEFAULT_MADAO_BASE_URL);
  try {
    const parsed = new URL(normalized);
    parsed.pathname = parsed.pathname.replace(/\\/api\\/(?:acquire|poll|release|routing\\/replace)$/i, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\\/$/, '');
  } catch {
    return DEFAULT_MADAO_BASE_URL;
  }
}
function normalizeMaDaoMode(value = '') { return String(value || '').trim().toLowerCase() === 'direct' ? 'direct' : DEFAULT_MADAO_MODE; }
function normalizeMaDaoIdentifier(value = '') { return String(value || '').trim(); }
function normalizeMaDaoProviderId(value = '') { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, ''); }
function normalizeMaDaoOperator(value = '') { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, ''); }
function normalizeMaDaoCountry(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const lowered = trimmed.toLowerCase();
  if (lowered === 'any' || lowered === 'local') return lowered;
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return lowered.replace(/[^a-z0-9_-]+/g, '');
}
function normalizeHeroSmsMaxPrice(value = '') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return String(Math.round(numeric * 10000) / 10000);
}
function normalizeMaDaoPrice(value = '') { return normalizeHeroSmsMaxPrice(value); }
function normalizeIpProxyProviderValue(value) { return String(value || '711proxy').trim() || '711proxy'; }
function normalizeIpProxyMode(value) { return String(value || 'account').trim() || 'account'; }
function normalizeIpProxyServiceProfiles(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function buildIpProxyServiceProfileFromState() {
  return {
    mode: 'account',
    apiUrl: '',
    accountList: '',
    accountSessionPrefix: '',
    accountLifeMinutes: '',
    poolTargetCount: '20',
    host: '',
    port: '',
    protocol: 'http',
    username: '',
    password: '',
    region: '',
  };
}
function normalizeIpProxyAccountList(value) { return String(value || ''); }
function normalizeIpProxyAccountSessionPrefix(value) { return String(value || ''); }
function normalizeIpProxyAccountLifeMinutes(value) { return String(value || ''); }
function normalizeIpProxyPoolTargetCount(value) { return String(value || '20'); }
function normalizeIpProxyPort(value) { return String(value || '').trim(); }
function normalizeIpProxyProtocol(value) { return String(value || 'http').trim() || 'http'; }
function resolveSignupMethod(state = {}) {
  const activeFlowId = String(state?.activeFlowId || DEFAULT_ACTIVE_FLOW_ID).trim().toLowerCase() || DEFAULT_ACTIVE_FLOW_ID;
  if (activeFlowId === 'kiro') {
    return 'email';
  }
  return String(state?.signupMethod || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function resolveLegacyAutoStepDelaySeconds() { return undefined; }
${extractFunction('normalizePersistentSettingValue')}
${extractFunction('getSettingsSchemaApi')}
${extractFunction('projectSettingsSchemaView')}
${extractFunction('setSettingsStatePatchValue')}
${extractFunction('mergeSettingsStatePatch')}
${extractFunction('buildSettingsStatePatchFromFlatUpdates')}
${extractFunction('buildPersistedSettingsStoragePayload')}
${extractFunction('buildPersistentSettingsPayload')}
${extractFunction('getPersistedSettings')}
${extractFunction('setPersistentSettings')}
${extra}
return {
  buildPersistentSettingsPayload,
  getPersistedSettings,
  setPersistentSettings,
  getRequestedKeys: typeof getRequestedKeys === 'function' ? getRequestedKeys : () => [],
  getPersistedWrites: typeof getPersistedWrites === 'function' ? getPersistedWrites : () => [],
  getRemovedKeys: typeof getRemovedKeys === 'function' ? getRemovedKeys : () => [],
};
`)();
}

test('buildPersistentSettingsPayload writes canonical settings schema into persisted payloads when defaults are materialized', () => {
  const api = buildHarness();

  const payload = api.buildPersistentSettingsPayload({
    activeFlowId: 'kiro',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'secret-key',
    openaiWebchatUrl: ' https://webchat.example.com/admin ',
    openaiWebchatAdminKey: ' webchat-key ',
    openaiWebchatUploadEnabled: true,
  }, { fillDefaults: true });

  assert.equal(payload.activeFlowId, 'kiro');
  assert.equal(payload.targetId, 'kiro-rs');
  assert.equal(payload.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(payload.kiroRsKey, 'secret-key');
  assert.equal(payload.openaiWebchatUrl, 'https://webchat.example.com/admin');
  assert.equal(payload.openaiWebchatAdminKey, 'webchat-key');
  assert.equal(payload.openaiWebchatUploadEnabled, false);
  assert.equal(payload.phoneSmsProvider, 'hero-sms');
  assert.equal(payload.madaoBaseUrl, DEFAULT_MADAO_BASE_URL_FOR_TEST);
  assert.equal(payload.madaoMode, DEFAULT_MADAO_MODE_FOR_TEST);
  assert.equal(payload.madaoOperator, '');
  assert.equal(payload.madaoAutoPickCountry, true);
  assert.equal(payload.madaoReusePhone, true);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'kiroRegion'), false);
  assert.equal(payload.settingsSchemaVersion, 5);
  assert.equal(payload.settingsState.activeFlowId, 'kiro');
  assert.equal(payload.settingsState.flows.kiro.selectedTargetId, 'kiro-rs');
  assert.equal(payload.settingsState.flows.openai.targets.webchat.baseUrl, 'https://webchat.example.com/admin');
  assert.equal(payload.settingsState.flows.openai.targets.webchat.apiKey, 'webchat-key');
  assert.equal(payload.settingsState.flows.openai.webchatUpload.enabled, false);
  assert.equal(
    payload.settingsState.flows.kiro.targets['kiro-rs'].baseUrl,
    'https://kiro.example.com/admin'
  );
});

test('buildPersistentSettingsPayload accepts schema-only input when requireKnownKeys is enabled', () => {
  const api = buildHarness();

  const payload = api.buildPersistentSettingsPayload({
    settingsSchemaVersion: 5,
    settingsState: {
      activeFlowId: 'kiro',
      services: {
        account: { customPassword: '' },
        email: { provider: '163' },
        proxy: { enabled: false, provider: '711proxy', mode: 'account' },
      },
      flows: {
        openai: {
          selectedTargetId: 'cpa',
          targets: {
            cpa: {
              vpsUrl: '',
              vpsPassword: '',
              localCpaStep9Mode: 'submit',
            },
            sub2api: {
              sub2apiUrl: '',
              sub2apiEmail: '',
              sub2apiPassword: '',
              sub2apiGroupName: 'codex',
              sub2apiGroupNames: ['codex', 'openai-plus'],
              sub2apiAccountPriority: 1,
              sub2apiDefaultProxyName: '',
            },
            codex2api: {
              codex2apiUrl: '',
              codex2apiAdminKey: '',
            },
          },
          signup: {
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            phoneSignupReloginAfterBindEmailEnabled: false,
          },
          plus: {
            plusModeEnabled: false,
            plusPaymentMethod: 'paypal',
            plusAccountAccessStrategy: 'oauth',
          },
          autoRun: {
            stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
          },
        },
        kiro: {
          selectedTargetId: 'kiro-rs',
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: 'schema-only-key',
            },
          },
          autoRun: {
            stepExecutionRange: { enabled: true, fromStep: 1, toStep: 9 },
          },
        },
      },
    },
  }, { requireKnownKeys: true });

  assert.equal(payload.activeFlowId, 'kiro');
  assert.equal(payload.targetId, 'kiro-rs');
  assert.equal(payload.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(payload.kiroRsKey, 'schema-only-key');
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'kiroRegion'), false);
  assert.equal(payload.settingsSchemaVersion, 5);
  assert.equal(payload.settingsState.flows.openai.plus.plusAccountAccessStrategy, 'oauth');
});

test('getPersistedSettings reads schema keys alongside legacy flat settings keys', async () => {
  const api = buildHarness(`
let requestedKeys = [];
const chrome = {
  storage: {
    local: {
      async get(keys) {
        requestedKeys = Array.isArray(keys) ? [...keys] : [];
        return {};
      },
    },
  },
};
function getRequestedKeys() {
  return requestedKeys;
}
`);

  const state = await api.getPersistedSettings();

  assert.ok(api.getRequestedKeys().includes('settingsSchemaVersion'));
  assert.ok(api.getRequestedKeys().includes('settingsState'));
  assert.ok(api.getRequestedKeys().includes('plusAccountAccessStrategy'));
  assert.equal(state.settingsSchemaVersion, 5);
  assert.equal(state.settingsState.activeFlowId, 'openai');
  assert.ok(api.getRequestedKeys().includes('madaoBaseUrl'));
  assert.ok(api.getRequestedKeys().includes('madaoMode'));
});

test('getPersistedSettings can project schema-only storage back into legacy flat settings', async () => {
  const api = buildHarness(`
const chrome = {
  storage: {
    local: {
      async get() {
        return {
          settingsSchemaVersion: 5,
          settingsState: {
            activeFlowId: 'kiro',
            services: {
              account: { customPassword: '' },
              email: { provider: 'hotmail' },
              proxy: { enabled: true, provider: '711proxy', mode: 'account' },
            },
            flows: {
              openai: {
                selectedTargetId: 'sub2api',
                targets: {
                  cpa: {
                    vpsUrl: '',
                    vpsPassword: '',
                    localCpaStep9Mode: 'submit',
                  },
                  sub2api: {
                    sub2apiUrl: '',
                    sub2apiEmail: '',
                    sub2apiPassword: '',
                    sub2apiGroupName: 'codex',
                    sub2apiGroupNames: ['codex', 'openai-plus'],
                    sub2apiAccountPriority: 1,
                    sub2apiDefaultProxyName: '',
                  },
                  codex2api: {
                    codex2apiUrl: '',
                    codex2apiAdminKey: '',
                  },
                },
                signup: {
                  signupMethod: 'email',
                  phoneVerificationEnabled: false,
                  phoneSignupReloginAfterBindEmailEnabled: false,
                },
                plus: {
                  plusModeEnabled: false,
                  plusPaymentMethod: 'paypal',
                  plusAccountAccessStrategy: 'sub2api_codex_session',
                },
                autoRun: {
                  stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
                },
              },
              kiro: {
                selectedTargetId: 'kiro-rs',
                targets: {
                  'kiro-rs': {
                    baseUrl: 'https://kiro.example.com/admin',
                    apiKey: 'stored-key',
                  },
                },
                autoRun: {
                  stepExecutionRange: { enabled: true, fromStep: 1, toStep: 9 },
                },
              },
            },
          },
        };
      },
    },
  },
};
`);

  const state = await api.getPersistedSettings();

  assert.equal(state.activeFlowId, 'kiro');
  assert.equal(state.targetId, 'kiro-rs');
  assert.equal(state.settingsState.flows.openai.selectedTargetId, 'sub2api');
  assert.equal(state.mailProvider, 'hotmail');
  assert.equal(state.ipProxyEnabled, true);
  assert.equal(state.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(state.kiroRsKey, 'stored-key');
  assert.equal(state.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'kiroRegion'), false);
  assert.deepEqual(state.stepExecutionRangeByFlow.kiro, {
    enabled: true,
    fromStep: 1,
    toStep: 9,
  });
});

test('setPersistentSettings materializes canonical schema keys for schema-only updates', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {};
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    settingsSchemaVersion: 5,
    settingsState: {
      activeFlowId: 'kiro',
      services: {
        account: { customPassword: '' },
        email: { provider: '163' },
        proxy: { enabled: false, provider: '711proxy', mode: 'account' },
      },
      flows: {
        openai: {
          selectedTargetId: 'cpa',
          targets: {
            cpa: {
              vpsUrl: '',
              vpsPassword: '',
              localCpaStep9Mode: 'submit',
            },
            sub2api: {
              sub2apiUrl: '',
              sub2apiEmail: '',
              sub2apiPassword: '',
              sub2apiGroupName: 'codex',
              sub2apiGroupNames: ['codex', 'openai-plus'],
              sub2apiAccountPriority: 1,
              sub2apiDefaultProxyName: '',
            },
            codex2api: {
              codex2apiUrl: '',
              codex2apiAdminKey: '',
            },
          },
          signup: {
            signupMethod: 'email',
            phoneVerificationEnabled: false,
            phoneSignupReloginAfterBindEmailEnabled: false,
          },
          plus: {
            plusModeEnabled: false,
            plusPaymentMethod: 'paypal',
            plusAccountAccessStrategy: 'sub2api_codex_session',
          },
          autoRun: {
            stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
          },
        },
        kiro: {
          selectedTargetId: 'kiro-rs',
          targets: {
            'kiro-rs': {
              baseUrl: 'https://kiro.example.com/admin',
              apiKey: 'nested-only-key',
            },
          },
          autoRun: {
            stepExecutionRange: { enabled: true, fromStep: 1, toStep: 9 },
          },
        },
      },
    },
  });

  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.activeFlowId, 'kiro');
  assert.equal(persisted.targetId, 'kiro-rs');
  assert.equal(persisted.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(persisted.kiroRsKey, 'nested-only-key');
  assert.equal(persisted.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(Object.prototype.hasOwnProperty.call(persisted, 'kiroRegion'), false);
  assert.equal(persisted.settingsSchemaVersion, 5);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'activeFlowId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'kiroRsUrl'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'kiroRsKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'kiroRegion'), false);
  assert.equal(write.settingsSchemaVersion, 5);
  assert.equal(write.settingsState.activeFlowId, 'kiro');
  assert.equal(write.settingsState.flows.openai.plus.plusAccountAccessStrategy, 'sub2api_codex_session');
  assert.equal(write.settingsState.flows.kiro.selectedTargetId, 'kiro-rs');
  assert.ok(api.getRemovedKeys().includes('kiroRsUrl'));
});

test('setPersistentSettings mirrors flat mail provider updates into canonical settingsState', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {
          settingsSchemaVersion: 5,
          settingsState: {
            activeFlowId: 'openai',
            services: {
              account: { customPassword: '' },
              email: { provider: '163' },
              proxy: { enabled: false, provider: '711proxy', mode: 'account' },
            },
            flows: {},
          },
        };
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    mailProvider: 'cloudflare-temp-email',
  });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.mailProvider, 'cloudflare-temp-email');
  assert.equal(persisted.settingsState.services.email.provider, 'cloudflare-temp-email');
  assert.equal(write.settingsState.services.email.provider, 'cloudflare-temp-email');
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'mailProvider'), false);
});

test('setPersistentSettings mirrors custom mail helper mode into canonical email settings', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {};
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    mailProvider: 'custom',
    customMailReceiveMode: 'helper',
    customMailHelperBaseUrl: 'http://127.0.0.1:17374/',
  });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.mailProvider, 'custom');
  assert.equal(persisted.customMailReceiveMode, 'helper');
  assert.equal(persisted.customMailHelperBaseUrl, 'http://127.0.0.1:17374');
  assert.equal(write.settingsState.services.email.provider, 'custom');
  assert.equal(write.settingsState.services.email.customReceiveMode, 'helper');
  assert.equal(write.settingsState.services.email.customHelperBaseUrl, 'http://127.0.0.1:17374');
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'customMailReceiveMode'), false);
});

test('buildPersistentSettingsPayload persists normalized MaDao flat settings outside canonical settingsState', () => {
  const api = buildHarness();

  const payload = api.buildPersistentSettingsPayload({
    phoneSmsProvider: 'MaDao',
    madaoBaseUrl: 'http://127.0.0.1:7822/api/acquire?x=1',
    madaoHttpSecret: ' secret-token ',
    madaoMode: 'direct',
    madaoRoutingPlanId: ' rp-openai ',
    madaoProviderId: ' Upstream A! ',
    madaoCountry: ' gb ',
    madaoOperator: ' Operator A! ',
    madaoAutoPickCountry: 0,
    madaoReusePhone: 1,
    madaoMinPrice: '0.123456',
    madaoMaxPrice: '-1',
  });

  assert.equal(payload.phoneSmsProvider, 'madao');
  assert.equal(payload.madaoBaseUrl, DEFAULT_MADAO_BASE_URL_FOR_TEST);
  assert.equal(payload.madaoHttpSecret, ' secret-token ');
  assert.equal(payload.madaoMode, 'direct');
  assert.equal(payload.madaoRoutingPlanId, 'rp-openai');
  assert.equal(payload.madaoProviderId, 'upstreama');
  assert.equal(payload.madaoCountry, 'GB');
  assert.equal(payload.madaoOperator, 'operatora');
  assert.equal(payload.madaoAutoPickCountry, false);
  assert.equal(payload.madaoReusePhone, true);
  assert.equal(payload.madaoMinPrice, '0.1235');
  assert.equal(payload.madaoMaxPrice, '');
  assert.equal(Object.prototype.hasOwnProperty.call(payload.settingsState || {}, 'madaoBaseUrl'), false);
});

test('setPersistentSettings mirrors flat schema updates without resetting other canonical settings', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        return {
          settingsSchemaVersion: 5,
          settingsState: {
            activeFlowId: 'openai',
            services: {
              account: { customPassword: 'old-password' },
              email: { provider: '163' },
              proxy: { enabled: false, provider: '711proxy', mode: 'account' },
            },
            flows: {
              openai: {
                selectedTargetId: 'cpa',
                targets: {
                  cpa: {
                    vpsUrl: 'https://old-cpa.example.com',
                    vpsPassword: 'old-vps-password',
                    localCpaStep9Mode: 'submit',
                  },
                  sub2api: {
                    sub2apiUrl: 'https://sub2api.example.com',
                    sub2apiEmail: 'owner@example.com',
                    sub2apiPassword: 'sub2api-secret',
                    sub2apiGroupName: 'kept-group',
                    sub2apiGroupNames: ['kept-group'],
                    sub2apiAccountPriority: 7,
                    sub2apiDefaultProxyName: 'proxy-a',
                  },
                  codex2api: {
                    codex2apiUrl: 'https://codex2api.example.com',
                    codex2apiAdminKey: 'codex-key',
                  },
                },
                signup: {
                  signupMethod: 'email',
                  phoneVerificationEnabled: false,
                  phoneSignupReloginAfterBindEmailEnabled: false,
                },
                plus: {
                  plusModeEnabled: false,
                  plusPaymentMethod: 'paypal',
                  plusAccountAccessStrategy: 'oauth',
                },
                autoRun: {
                  stepExecutionRange: { enabled: false, fromStep: 1, toStep: 11 },
                },
              },
              kiro: {
                selectedTargetId: 'kiro-rs',
                targets: {
                  'kiro-rs': {
                    baseUrl: 'https://kiro.example.com/admin',
                    apiKey: 'kiro-key',
                  },
                },
                autoRun: {
                  stepExecutionRange: { enabled: false, fromStep: 1, toStep: 9 },
                },
              },
            },
          },
        };
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    targetId: 'sub2api',
    mailProvider: 'cloudflare-temp-email',
    ipProxyEnabled: true,
    ipProxyMode: 'api',
    stepExecutionRangeByFlow: {
      openai: { enabled: true, fromStep: 2, toStep: 4 },
    },
  });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.targetId, 'sub2api');
  assert.equal(persisted.mailProvider, 'cloudflare-temp-email');
  assert.equal(persisted.ipProxyEnabled, true);
  assert.equal(persisted.ipProxyMode, 'api');
  assert.deepEqual(persisted.stepExecutionRangeByFlow.openai, {
    enabled: true,
    fromStep: 2,
    toStep: 4,
  });
  assert.equal(write.settingsState.flows.openai.selectedTargetId, 'sub2api');
  assert.equal(write.settingsState.services.email.provider, 'cloudflare-temp-email');
  assert.equal(write.settingsState.services.proxy.enabled, true);
  assert.equal(write.settingsState.services.proxy.mode, 'api');
  assert.deepEqual(write.settingsState.flows.openai.autoRun.stepExecutionRange, {
    enabled: true,
    fromStep: 2,
    toStep: 4,
  });
  assert.equal(write.settingsState.flows.openai.targets.sub2api.sub2apiUrl, 'https://sub2api.example.com');
  assert.equal(write.settingsState.flows.openai.targets.sub2api.sub2apiEmail, 'owner@example.com');
  assert.equal(write.settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'kiro-key');
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'mailProvider'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'panelMode'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(write, 'ipProxyMode'), false);
});

test('setPersistentSettings replace mode does not retain previous non-schema settings', async () => {
  const api = buildHarness(`
const persistedWrites = [];
const removedKeys = [];
const chrome = {
  storage: {
    local: {
      async get() {
        throw new Error('replace mode should not read existing settings');
      },
      async remove(keys) {
        removedKeys.push(...(Array.isArray(keys) ? keys : [keys]));
      },
      async set(payload) {
        persistedWrites.push(JSON.parse(JSON.stringify(payload)));
      },
    },
  },
};
function getPersistedWrites() {
  return persistedWrites;
}
function getRemovedKeys() {
  return removedKeys;
}
`);

  const persisted = await api.setPersistentSettings({
    activeFlowId: 'kiro',
    targetId: 'kiro-rs',
    mailProvider: 'hotmail',
    ipProxyEnabled: true,
    ipProxyMode: 'api',
    kiroRsUrl: 'https://kiro.example.com/admin',
    kiroRsKey: 'imported-key',
  }, { replaceExisting: true });
  const write = api.getPersistedWrites().at(-1);

  assert.equal(persisted.activeFlowId, 'kiro');
  assert.equal(persisted.targetId, 'kiro-rs');
  assert.equal(persisted.mailProvider, 'hotmail');
  assert.equal(persisted.ipProxyEnabled, true);
  assert.equal(persisted.ipProxyMode, 'api');
  assert.equal(persisted.kiroRsUrl, 'https://kiro.example.com/admin');
  assert.equal(persisted.kiroRsKey, 'imported-key');
  assert.equal(write.settingsState.activeFlowId, 'kiro');
  assert.equal(write.settingsState.services.email.provider, 'hotmail');
  assert.equal(write.settingsState.services.proxy.mode, 'api');
  assert.equal(write.settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'imported-key');
  assert.ok(api.getRemovedKeys().includes('settingsState'));
  assert.ok(api.getRemovedKeys().includes('mailProvider'));
  assert.ok(api.getRemovedKeys().includes('kiroRsKey'));
});
