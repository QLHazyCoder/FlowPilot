const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
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
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return source.slice(start, end);
}

test('importSettingsBundle normalizes unsupported capability flags before persisting imported settings', async () => {
  const api = new Function(`
const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
const DEFAULT_REGISTRATION_EMAIL_STATE = { emailHistory: [] };
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
const self = {
  MultiPageLegacySettingsImporter: {
    createSettingsImporter() {
      return {
        importSettings(settings = {}) {
          return { ...settings };
        },
      };
    },
  },
};
let persistedUpdates = null;
let stateUpdates = null;
let broadcastPayload = null;
let currentState = {
  activeFlowId: 'site-a',
  targetId: 'sub2api',
  signupMethod: 'phone',
  plusModeEnabled: false,
  stepStatuses: {},
};
async function ensureManualInteractionAllowed() {
  return currentState;
}
function buildPersistentSettingsPayload(settings = {}) {
  return { ...settings };
}
function validateModeSwitchState() {
  return {
    ok: false,
    errors: [{ code: 'panel_mode_unsupported', message: '当前 flow 不支持 SUB2API 面板模式。' }],
    normalizedUpdates: {
      targetId: 'cpa',
      plusModeEnabled: false,
      signupMethod: 'email',
    },
  };
}
function resolveSignupMethod(state = {}) {
  return String(state?.signupMethod || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function getSettingsSchemaApi() {
  return null;
}
async function setPersistentSettings(updates) {
  persistedUpdates = { ...updates };
}
async function setState(updates) {
  stateUpdates = { ...updates };
  currentState = { ...currentState, ...updates };
}
function broadcastDataUpdate(payload) {
  broadcastPayload = { ...payload };
}
async function getState() {
  return { ...currentState };
}
${extractFunction('importSettingsBundle')}
return {
  importSettingsBundle,
  getPersistedUpdates: () => persistedUpdates,
  getStateUpdates: () => stateUpdates,
  getBroadcastPayload: () => broadcastPayload,
};
`)();

  const result = await api.importSettingsBundle({
    schemaVersion: 1,
    settings: {
      targetId: 'sub2api',
      plusModeEnabled: true,
      signupMethod: 'phone',
    },
  });

  assert.deepEqual(api.getPersistedUpdates(), {
    targetId: 'cpa',
    plusModeEnabled: false,
    signupMethod: 'email',
  });
  assert.equal(api.getStateUpdates().targetId, 'cpa');
  assert.equal(api.getStateUpdates().plusModeEnabled, false);
  assert.equal(api.getStateUpdates().signupMethod, 'email');
  assert.equal(api.getBroadcastPayload().targetId, 'cpa');
  assert.equal(api.getBroadcastPayload().signupMethod, 'email');
  assert.equal(result.signupMethod, 'email');
});

test('importSettingsBundle routes legacy settings through the legacy importer before persisting', async () => {
  const api = new Function(`
const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
const DEFAULT_REGISTRATION_EMAIL_STATE = { emailHistory: [] };
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
let importerInput = null;
let persistedUpdates = null;
let currentState = {
  activeFlowId: 'openai',
  nodeStatuses: {},
};
const self = {
  MultiPageFlowRegistry: {
    DEFAULT_FLOW_ID: 'openai',
  },
  MultiPageLegacySettingsImporter: {
    createSettingsImporter() {
      return {
        importSettings(settings = {}) {
          importerInput = JSON.parse(JSON.stringify(settings));
          return {
            settingsSchemaVersion: 5,
            settingsState: {
              schemaVersion: 5,
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
                    cpa: { vpsUrl: '', vpsPassword: '', localCpaStep9Mode: 'submit' },
                    sub2api: {
                      sub2apiUrl: '',
                      sub2apiEmail: '',
                      sub2apiPassword: '',
                      sub2apiGroupName: 'codex',
                      sub2apiGroupNames: ['codex', 'openai-plus'],
                      sub2apiAccountPriority: 1,
                      sub2apiDefaultProxyName: '',
                    },
                    codex2api: { codex2apiUrl: '', codex2apiAdminKey: '' },
                  },
                  signup: {
                    signupMethod: 'email',
                    phoneSignupReloginAfterBindEmailEnabled: false,
                  },
                  plus: {
                    plusModeEnabled: false,
                    plusPaymentMethod: 'paypal',
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
                      apiKey: 'imported-key',
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
      };
    },
  },
};
async function ensureManualInteractionAllowed() {
  return currentState;
}
function buildPersistentSettingsPayload(settings = {}) {
  return {
    activeFlowId: settings.settingsState.activeFlowId,
    targetId: 'cpa',
    signupMethod: 'email',
    targetId: 'kiro-rs',
    kiroRsUrl: settings.settingsState.flows.kiro.targets['kiro-rs'].baseUrl,
    kiroRsKey: settings.settingsState.flows.kiro.targets['kiro-rs'].apiKey,
    settingsSchemaVersion: settings.settingsSchemaVersion,
    settingsState: settings.settingsState,
  };
}
function validateModeSwitchState() {
  return { normalizedUpdates: {} };
}
function resolveSignupMethod() {
  return 'email';
}
function getSettingsSchemaApi() {
  return null;
}
async function setPersistentSettings(updates) {
  persistedUpdates = { ...updates };
  return updates;
}
async function setState(updates) {
  currentState = { ...currentState, ...updates };
}
function broadcastDataUpdate() {}
async function getState() {
  return currentState;
}
${extractFunction('importSettingsBundle')}
return {
  importSettingsBundle,
  getImporterInput: () => importerInput,
  getPersistedUpdates: () => persistedUpdates,
};
`)();

  await api.importSettingsBundle({
    schemaVersion: 1,
    settings: {
      targetId: 'sub2api',
      kiroRuntime: {
        upload: {
          status: 'uploaded',
        },
      },
    },
  });

  assert.deepEqual(api.getImporterInput(), {
    targetId: 'sub2api',
    kiroRuntime: {
      upload: {
        status: 'uploaded',
      },
    },
  });
  assert.equal(api.getPersistedUpdates().activeFlowId, 'kiro');
  assert.equal(api.getPersistedUpdates().settingsSchemaVersion, 5);
  assert.equal(api.getPersistedUpdates().settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'imported-key');
});

test('importSettingsBundle keeps exported non-schema settings while applying legacy schema migration', async () => {
  const api = new Function(`
const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
const DEFAULT_REGISTRATION_EMAIL_STATE = { emailHistory: [] };
const DEFAULT_ACTIVE_FLOW_ID = 'openai';
let importerInput = null;
let payloadInput = null;
let persistedUpdates = null;
let persistOptions = null;
let currentState = {
  activeFlowId: 'openai',
  nodeStatuses: {},
};
const self = {
  MultiPageFlowRegistry: {
    DEFAULT_FLOW_ID: 'openai',
  },
  MultiPageLegacySettingsImporter: {
    createSettingsImporter() {
      return {
        importSettings(settings = {}) {
          importerInput = JSON.parse(JSON.stringify(settings));
          return {
            settingsSchemaVersion: 5,
            settingsState: {
              schemaVersion: 5,
              activeFlowId: 'kiro',
              services: {
                account: { customPassword: 'schema-password' },
                email: { provider: 'hotmail' },
                proxy: { enabled: true, provider: '711proxy', mode: 'api' },
              },
              flows: {
                openai: {
                  selectedTargetId: 'sub2api',
                  targets: {},
                  signup: {
                    signupMethod: 'email',
                    phoneSignupReloginAfterBindEmailEnabled: false,
                  },
                  plus: {
                    plusModeEnabled: false,
                    plusPaymentMethod: 'paypal',
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
                      apiKey: 'schema-key',
                    },
                  },
                  autoRun: {
                    stepExecutionRange: { enabled: true, fromStep: 2, toStep: 9 },
                  },
                },
              },
            },
          };
        },
      };
    },
  },
};
async function ensureManualInteractionAllowed() {
  return currentState;
}
function buildPersistentSettingsPayload(settings = {}) {
  payloadInput = JSON.parse(JSON.stringify(settings));
  return { ...settings };
}
function validateModeSwitchState() {
  return { normalizedUpdates: {} };
}
function resolveSignupMethod(state = {}) {
  return String(state?.signupMethod || '').trim().toLowerCase() === 'phone' ? 'phone' : 'email';
}
function getSettingsSchemaApi() {
  return null;
}
async function setPersistentSettings(updates, options = {}) {
  persistedUpdates = JSON.parse(JSON.stringify(updates));
  persistOptions = { ...options };
  return updates;
}
async function setState(updates) {
  currentState = { ...currentState, ...updates };
}
function broadcastDataUpdate() {}
async function getState() {
  return currentState;
}
${extractFunction('importSettingsBundle')}
return {
  importSettingsBundle,
  getImporterInput: () => importerInput,
  getPayloadInput: () => payloadInput,
  getPersistedUpdates: () => persistedUpdates,
  getPersistOptions: () => persistOptions,
};
`)();

  await api.importSettingsBundle({
    schemaVersion: 1,
    settings: {
      activeFlowId: 'openai',
      targetId: 'sub2api',
      cloudflareTempEmailBaseUrl: 'https://mail.example.com',
      cloudflareTempEmailAdminAuth: 'admin-secret',
      cloudMailToken: 'cloud-token',
      heroSmsApiKey: 'hero-key',
      phoneSmsProvider: 'madao',
      madaoBaseUrl: 'http://127.0.0.1:7822',
      madaoHttpSecret: 'madao-secret',
      madaoMode: 'routing_plan',
      madaoRoutingPlanId: 'rp-openai',
      madaoProviderId: 'upstream-a',
      madaoCountry: 'GB',
      madaoOperator: 'operator-a',
      madaoAutoPickCountry: false,
      madaoReusePhone: true,
      madaoMinPrice: '0.12',
      madaoMaxPrice: '0.45',
      hotmailAccounts: [
        { id: 'hotmail-1', email: 'owner@example.com', password: 'mail-pass' },
      ],
      ipProxyServiceProfiles: {
        '711proxy': {
          mode: 'api',
          apiUrl: 'https://proxy.example.com',
        },
      },
      paypalAccounts: [
        { id: 'paypal-1', email: 'paypal@example.com', password: 'paypal-pass' },
      ],
    },
  });

  assert.equal(api.getImporterInput().cloudflareTempEmailAdminAuth, 'admin-secret');
  assert.equal(api.getPayloadInput().settingsState.activeFlowId, 'kiro');
  assert.equal(api.getPayloadInput().cloudflareTempEmailBaseUrl, 'https://mail.example.com');
  assert.equal(api.getPayloadInput().cloudflareTempEmailAdminAuth, 'admin-secret');
  assert.equal(api.getPayloadInput().cloudMailToken, 'cloud-token');
  assert.equal(api.getPayloadInput().heroSmsApiKey, 'hero-key');
  assert.equal(api.getPayloadInput().phoneSmsProvider, 'madao');
  assert.equal(api.getPayloadInput().madaoBaseUrl, 'http://127.0.0.1:7822');
  assert.equal(api.getPayloadInput().madaoHttpSecret, 'madao-secret');
  assert.equal(api.getPayloadInput().madaoMode, 'routing_plan');
  assert.equal(api.getPayloadInput().madaoRoutingPlanId, 'rp-openai');
  assert.equal(api.getPayloadInput().madaoProviderId, 'upstream-a');
  assert.equal(api.getPayloadInput().madaoCountry, 'GB');
  assert.equal(api.getPayloadInput().madaoOperator, 'operator-a');
  assert.equal(api.getPayloadInput().madaoAutoPickCountry, false);
  assert.equal(api.getPayloadInput().madaoReusePhone, true);
  assert.equal(api.getPayloadInput().madaoMinPrice, '0.12');
  assert.equal(api.getPayloadInput().madaoMaxPrice, '0.45');
  assert.deepEqual(api.getPayloadInput().hotmailAccounts, [
    { id: 'hotmail-1', email: 'owner@example.com', password: 'mail-pass' },
  ]);
  assert.equal(api.getPayloadInput().ipProxyServiceProfiles['711proxy'].apiUrl, 'https://proxy.example.com');
  assert.equal(api.getPayloadInput().paypalAccounts[0].email, 'paypal@example.com');
  assert.equal(api.getPersistedUpdates().settingsState.flows.kiro.targets['kiro-rs'].apiKey, 'schema-key');
  assert.equal(api.getPersistedUpdates().cloudflareTempEmailAdminAuth, 'admin-secret');
  assert.equal(api.getPersistedUpdates().madaoRoutingPlanId, 'rp-openai');
  assert.deepEqual(api.getPersistOptions(), { replaceExisting: true });
});
