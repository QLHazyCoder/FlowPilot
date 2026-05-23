const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadGeneratedEmailHelpersApi() {
  const localPartHelpersSource = fs.readFileSync('background/email-local-part-helpers.js', 'utf8');
  const source = fs.readFileSync('background/generated-email-helpers.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${localPartHelpersSource}; ${source}; return self.MultiPageGeneratedEmailHelpers;`)(globalScope);
}

test('background imports generated email helper module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /importScripts\([\s\S]*'background\/email-local-part-helpers\.js'/);
  assert.match(source, /importScripts\([\s\S]*'background\/generated-email-helpers\.js'/);
});

test('generated email helper module exposes a factory', () => {
  const api = loadGeneratedEmailHelpersApi();

  assert.equal(typeof api?.createGeneratedEmailHelpers, 'function');
});

test('generated email helper falls back to normal generator when 2925 is in receive mode', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const events = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build alias in receive mode');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getState: async () => ({
      mailProvider: '2925',
      mail2925Mode: 'receive',
      emailGenerator: 'duck',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate 2925 account in receive mode');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: (_provider, mail2925Mode) => mail2925Mode === 'provide',
    reuseOrCreateTab: async () => {},
    sendToContentScript: async (_source, message) => {
      events.push(message.type);
      return { email: 'duck@example.com', generated: true };
    },
    setEmailState: async (email) => {
      events.push(['email', email]);
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    mailProvider: '2925',
    mail2925Mode: 'receive',
    emailGenerator: 'duck',
  }, {
    mailProvider: '2925',
    mail2925Mode: 'receive',
    generator: 'duck',
  });

  assert.equal(email, 'duck@example.com');
  assert.deepStrictEqual(events, [
    'FETCH_DUCK_EMAIL',
    ['email', 'duck@example.com'],
  ]);
});

test('generated email helper forwards the previous email to Duck generation as a comparison baseline', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const requests = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build alias');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getRegistrationEmailBaseline: (state, options = {}) => options.preferredEmail || options.fallbackEmail || state.email,
    getState: async () => ({
      email: 'Previous@Duck.com',
      emailGenerator: 'duck',
      mailProvider: 'gmail',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate 2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async (_source, message) => {
      requests.push(message);
      return { email: 'fresh@duck.com', generated: true };
    },
    setEmailState: async () => {},
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    email: 'Previous@Duck.com',
    emailGenerator: 'duck',
    mailProvider: 'gmail',
  }, {
    generator: 'duck',
    generateNew: true,
  });

  assert.equal(email, 'fresh@duck.com');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].type, 'FETCH_DUCK_EMAIL');
  assert.deepEqual(requests[0].payload, {
    generateNew: true,
    baselineEmail: 'previous@duck.com',
  });
});

test('generated email helper prefers current UI email over preserved runtime baseline for Duck generation', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const requests = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build alias');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getRegistrationEmailBaseline: (state, options = {}) => (
      String(options.preferredEmail || '').trim()
      || String(state?.registrationEmailState?.previous || '').trim()
      || String(options.fallbackEmail || '').trim()
    ),
    getState: async () => ({
      email: '',
      registrationEmailState: {
        current: '',
        previous: 'preserved@duck.com',
        source: 'generated:duck',
        updatedAt: 1,
      },
      emailGenerator: 'duck',
      mailProvider: 'gmail',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate 2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async (_source, message) => {
      requests.push(message);
      return { email: 'fresh@duck.com', generated: true };
    },
    setEmailState: async () => {},
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    email: '',
    registrationEmailState: {
      current: '',
      previous: 'preserved@duck.com',
      source: 'generated:duck',
      updatedAt: 1,
    },
    emailGenerator: 'duck',
    mailProvider: 'gmail',
  }, {
    generator: 'duck',
    generateNew: true,
    currentEmail: 'visible@duck.com',
  });

  assert.equal(email, 'fresh@duck.com');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].payload, {
    generateNew: true,
    baselineEmail: 'visible@duck.com',
  });
});

test('generated email helper preserves phone identity through the shared persistence helper during Duck add-email generation', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const persistCalls = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build alias');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getRegistrationEmailBaseline: () => '',
    getState: async () => ({}),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate 2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    persistRegistrationEmailState: async (state, email, options) => {
      persistCalls.push({ state, email, options });
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => ({ email: 'fresh@duck.com', generated: true }),
    setEmailState: async () => {
      throw new Error('preserveAccountIdentity should use shared persistence helper');
    },
    throwIfStopped: () => {},
  });

  const state = {
    email: '',
    emailGenerator: 'duck',
    mailProvider: 'gmail',
    accountIdentifierType: 'phone',
    accountIdentifier: '+447780579093',
    signupPhoneNumber: '+447780579093',
    signupPhoneCompletedActivation: {
      activationId: 'done-1',
      phoneNumber: '+447780579093',
    },
  };
  const email = await helpers.fetchGeneratedEmail(state, {
    generator: 'duck',
    preserveAccountIdentity: true,
  });

  assert.equal(email, 'fresh@duck.com');
  assert.equal(persistCalls.length, 1);
  assert.equal(persistCalls[0].email, 'fresh@duck.com');
  assert.equal(persistCalls[0].options.source, 'generated:duck');
  assert.equal(persistCalls[0].options.preserveAccountIdentity, true);
  assert.equal(persistCalls[0].state.accountIdentifierType, 'phone');
  assert.equal(persistCalls[0].state.signupPhoneNumber, '+447780579093');
});

test('generated email helper can read the requested address from custom email pool', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const events = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build alias');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    CUSTOM_EMAIL_POOL_GENERATOR: 'custom-pool',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getCustomEmailPoolEmail: (state, targetRun) => state.customEmailPool?.[targetRun - 1] || '',
    getState: async () => ({
      customEmailPool: ['first@example.com', 'second@example.com'],
      emailGenerator: 'custom-pool',
      mailProvider: 'gmail',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate 2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => {
      throw new Error('should not open duck tab');
    },
    setEmailState: async (email) => {
      events.push(['email', email]);
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    customEmailPool: ['first@example.com', 'second@example.com'],
    emailGenerator: 'custom-pool',
    mailProvider: 'gmail',
  }, {
    generator: 'custom-pool',
    poolIndex: 1,
  });

  assert.equal(email, 'second@example.com');
  assert.deepStrictEqual(events, [
    ['email', 'second@example.com'],
  ]);
});

test('generated email helper respects runtime generator overrides when deciding alias flow', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const aliasStates = [];
  const savedEmails = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: (state) => {
      aliasStates.push({ ...state });
      return 'base+tag@gmail.com';
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    CUSTOM_EMAIL_POOL_GENERATOR: 'custom-pool',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getCustomEmailPoolEmail: () => '',
    getState: async () => ({
      mailProvider: '163',
      emailGenerator: 'duck',
      gmailBaseEmail: '',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate mail2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: (stateOrProvider, mail2925Mode) => {
      const provider = typeof stateOrProvider === 'string'
        ? stateOrProvider
        : stateOrProvider?.mailProvider;
      const generator = typeof stateOrProvider === 'string'
        ? ''
        : stateOrProvider?.emailGenerator;
      return String(provider || '').trim().toLowerCase() === 'gmail'
        && String(generator || '').trim().toLowerCase() !== 'custom-pool'
        && String(mail2925Mode || '').trim().toLowerCase() !== 'receive';
    },
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => {
      throw new Error('should not use duck generator');
    },
    setEmailState: async (email) => {
      savedEmails.push(email);
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    mailProvider: '163',
    emailGenerator: 'duck',
  }, {
    generator: 'gmail-alias',
    mailProvider: 'gmail',
    gmailBaseEmail: 'base@gmail.com',
  });

  assert.equal(email, 'base+tag@gmail.com');
  assert.deepEqual(savedEmails, ['base+tag@gmail.com']);
  assert.equal(aliasStates.length, 1);
  assert.equal(aliasStates[0].mailProvider, 'gmail');
  assert.equal(aliasStates[0].emailGenerator, 'gmail-alias');
  assert.equal(aliasStates[0].gmailBaseEmail, 'base@gmail.com');
});

test('generated email helper uses the regular temp email domain when random subdomain mode is disabled', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const requests = [];
  const savedEmails = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build managed alias');
    },
    buildCloudflareTempEmailHeaders: () => ({ 'x-admin-auth': 'admin-secret' }),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async (url, options = {}) => {
      requests.push({
        url,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : null,
      });
      return {
        ok: true,
        text: async () => JSON.stringify({ address: 'user@mail.example.com' }),
      };
    },
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: (payload) => payload.address,
    getCloudflareTempEmailConfig: () => ({
      baseUrl: 'https://temp.example.com',
      adminAuth: 'admin-secret',
      customAuth: '',
      useRandomSubdomain: false,
      domain: 'mail.example.com',
    }),
    getState: async () => ({
      mailProvider: '163',
      emailGenerator: 'cloudflare-temp-email',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate mail2925 account');
    },
    joinCloudflareTempEmailUrl: (baseUrl, path) => `${baseUrl}${path}`,
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: (value) => String(value || '').trim().toLowerCase(),
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => {
      throw new Error('should not use duck generator');
    },
    setEmailState: async (email) => {
      savedEmails.push(email);
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    emailGenerator: 'cloudflare-temp-email',
  }, {
    generator: 'cloudflare-temp-email',
  });

  assert.equal(email, 'user@mail.example.com');
  assert.deepEqual(savedEmails, ['user@mail.example.com']);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://temp.example.com/admin/new_address');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, {
    enablePrefix: true,
    enableRandomSubdomain: false,
    name: requests[0].body.name,
    domain: 'mail.example.com',
  });
  assert.match(requests[0].body.name, /^[a-z]+[0-9]{17}$/);
});

test('generated email helper requests random subdomain creation while preserving the returned address', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const requests = [];
  const savedEmails = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build managed alias');
    },
    buildCloudflareTempEmailHeaders: () => ({ 'x-admin-auth': 'admin-secret' }),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async (url, options = {}) => {
      requests.push({
        url,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : null,
      });
      return {
        ok: true,
        text: async () => JSON.stringify({ address: 'user@a1b2c3d4.example.com' }),
      };
    },
    fetchIcloudHideMyEmail: async () => {
      throw new Error('should not use icloud generator');
    },
    getCloudflareTempEmailAddressFromResponse: (payload) => payload.address,
    getCloudflareTempEmailConfig: () => ({
      baseUrl: 'https://temp.example.com',
      adminAuth: 'admin-secret',
      customAuth: '',
      useRandomSubdomain: true,
      domain: 'mail.example.com',
    }),
    getState: async () => ({
      mailProvider: '163',
      emailGenerator: 'cloudflare-temp-email',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate mail2925 account');
    },
    joinCloudflareTempEmailUrl: (baseUrl, path) => `${baseUrl}${path}`,
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: (value) => String(value || '').trim().toLowerCase(),
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => {
      throw new Error('should not use duck generator');
    },
    setEmailState: async (email) => {
      savedEmails.push(email);
    },
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    emailGenerator: 'cloudflare-temp-email',
  }, {
    generator: 'cloudflare-temp-email',
    localPart: 'user',
  });

  assert.equal(email, 'user@a1b2c3d4.example.com');
  assert.deepEqual(savedEmails, ['user@a1b2c3d4.example.com']);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://temp.example.com/admin/new_address');
  assert.equal(requests[0].method, 'POST');
  assert.deepEqual(requests[0].body, {
    enablePrefix: true,
    enableRandomSubdomain: true,
    name: 'user',
    domain: 'mail.example.com',
  });
});

test('generated email helper honors iCloud always-new fetch mode', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const icloudOptions = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build managed alias');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async (options) => {
      icloudOptions.push(options);
      return 'fresh@icloud.example.com';
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getState: async () => ({
      emailGenerator: 'icloud',
      icloudFetchMode: 'always_new',
      mailProvider: 'gmail',
    }),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate mail2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => {
      throw new Error('should not use duck generator');
    },
    setEmailState: async () => {},
    throwIfStopped: () => {},
  });

  const email = await helpers.fetchGeneratedEmail({
    emailGenerator: 'icloud',
    icloudFetchMode: 'always_new',
    mailProvider: 'gmail',
  }, {
    generator: 'icloud',
  });

  assert.equal(email, 'fresh@icloud.example.com');
  assert.equal(icloudOptions.length, 1);
  assert.equal(icloudOptions[0].generateNew, true);
  assert.equal(icloudOptions[0].preserveAccountIdentity, false);
  assert.equal(icloudOptions[0].source, 'generated:icloud');
  assert.equal(icloudOptions[0].state.emailGenerator, 'icloud');
});

test('generated email helper forwards preserve identity context to the iCloud generator', async () => {
  const api = loadGeneratedEmailHelpersApi();
  const icloudOptions = [];

  const helpers = api.createGeneratedEmailHelpers({
    addLog: async () => {},
    buildGeneratedAliasEmail: () => {
      throw new Error('should not build managed alias');
    },
    buildCloudflareTempEmailHeaders: () => ({}),
    CLOUDFLARE_TEMP_EMAIL_GENERATOR: 'cloudflare-temp-email',
    DUCK_AUTOFILL_URL: 'https://duckduckgo.com/email',
    fetch: async () => ({ ok: true, text: async () => '{}' }),
    fetchIcloudHideMyEmail: async (options) => {
      icloudOptions.push(options);
      return 'fresh@icloud.example.com';
    },
    getCloudflareTempEmailAddressFromResponse: () => '',
    getCloudflareTempEmailConfig: () => ({ baseUrl: '', adminAuth: '', domain: '' }),
    getState: async () => ({}),
    ensureMail2925AccountForFlow: async () => {
      throw new Error('should not allocate mail2925 account');
    },
    joinCloudflareTempEmailUrl: () => '',
    normalizeCloudflareDomain: () => '',
    normalizeCloudflareTempEmailAddress: () => '',
    normalizeEmailGenerator: (value) => String(value || '').trim().toLowerCase(),
    isGeneratedAliasProvider: () => false,
    reuseOrCreateTab: async () => {},
    sendToContentScript: async () => {
      throw new Error('should not use duck generator');
    },
    setEmailState: async () => {},
    throwIfStopped: () => {},
  });

  const state = {
    emailGenerator: 'icloud',
    icloudFetchMode: 'always_new',
    mailProvider: 'gmail',
    accountIdentifierType: 'phone',
    accountIdentifier: '+447780579093',
    signupPhoneNumber: '+447780579093',
  };
  const email = await helpers.fetchGeneratedEmail(state, {
    generator: 'icloud',
    preserveAccountIdentity: true,
  });

  assert.equal(email, 'fresh@icloud.example.com');
  assert.equal(icloudOptions.length, 1);
  assert.equal(icloudOptions[0].generateNew, true);
  assert.equal(icloudOptions[0].preserveAccountIdentity, true);
  assert.equal(icloudOptions[0].source, 'generated:icloud');
  assert.equal(icloudOptions[0].state.accountIdentifierType, 'phone');
  assert.equal(icloudOptions[0].state.signupPhoneNumber, '+447780579093');
  assert.equal(icloudOptions[0].state.emailGenerator, 'icloud');
});
