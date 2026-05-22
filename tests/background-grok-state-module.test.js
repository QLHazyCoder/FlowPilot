const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadGrokStateApi() {
  const source = fs.readFileSync('flows/grok/background/state.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundGrokState;`)(globalScope);
}

test('grok state view projects canonical runtime state into legacy flat read fields', () => {
  const api = loadGrokStateApi();
  const view = api.buildStateView({
    runtimeState: {
      flowState: {
        openai: {
          preserved: true,
        },
        grok: {
          session: {
            registerTabId: 42,
            pageState: 'profile_entry',
            pageUrl: 'https://accounts.x.ai/sign-up',
          },
          register: {
            email: 'USER@EXAMPLE.COM',
            firstName: 'Ada',
            lastName: 'Lovelace',
            password: 'Secret123!',
            verificationRequestedAt: 1000,
            verificationCode: 'ABC123',
            status: 'verified',
            completedAt: 2000,
          },
          sso: {
            currentCookie: 'cookie-a',
            cookies: ['cookie-a', 'cookie-b', 'cookie-a'],
            extractedAt: 3000,
          },
        },
      },
    },
  });

  assert.equal(view.grokRegisterTabId, 42);
  assert.equal(view.grokPageState, 'profile_entry');
  assert.equal(view.grokEmail, 'user@example.com');
  assert.equal(view.grokFirstName, 'Ada');
  assert.equal(view.grokLastName, 'Lovelace');
  assert.equal(view.grokPassword, 'Secret123!');
  assert.equal(view.grokVerificationRequestedAt, 1000);
  assert.equal(view.grokVerificationCode, 'ABC123');
  assert.equal(view.grokRegisterStatus, 'verified');
  assert.equal(view.grokCompletedAt, 2000);
  assert.equal(view.grokSsoCookie, 'cookie-a');
  assert.deepEqual(view.grokSsoCookies, ['cookie-a', 'cookie-b']);
  assert.equal(view.grokSsoExtractedAt, 3000);
  assert.equal(view.runtimeState.flowState.openai.preserved, true);
  assert.equal(view.runtimeState.flowState.grok.register.email, 'user@example.com');
  assert.equal(view.flowState.grok.sso.currentCookie, 'cookie-a');
  assert.equal(view.flows.grok.sso.cookies.length, 2);
});

test('grok completion payloads update canonical runtime state and flat compatibility fields', () => {
  const api = loadGrokStateApi();
  const patch = api.applyNodeCompletionPayload({}, {
    grokEmail: 'GROK@EXAMPLE.COM',
    grokVerificationRequestedAt: 123,
    grokSsoCookie: 'cookie-z',
    grokSsoCookies: ['cookie-z', 'cookie-z', 'cookie-y'],
    grokCompletedAt: 456,
  });

  assert.equal(patch.grokEmail, 'grok@example.com');
  assert.equal(patch.grokVerificationRequestedAt, 123);
  assert.equal(patch.grokSsoCookie, 'cookie-z');
  assert.deepEqual(patch.grokSsoCookies, ['cookie-z', 'cookie-y']);
  assert.equal(patch.grokCompletedAt, 456);
  assert.equal(patch.grokSsoExtractedAt, 456);
  assert.equal(patch.runtimeState.flowState.grok.register.email, 'grok@example.com');
  assert.equal(patch.runtimeState.flowState.grok.sso.currentCookie, 'cookie-z');
});

test('grok fresh keep-state reset preserves SSO cookies but clears registration runtime', () => {
  const api = loadGrokStateApi();
  const patch = api.buildFreshKeepState({
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 42,
            pageState: 'profile_entry',
          },
          register: {
            email: 'grok@example.com',
            status: 'completed',
            completedAt: 1000,
          },
          sso: {
            currentCookie: 'cookie-a',
            cookies: ['cookie-a', 'cookie-b'],
            extractedAt: 2000,
          },
        },
      },
    },
  });

  assert.equal(patch.grokRegisterTabId, null);
  assert.equal(patch.grokPageState, '');
  assert.equal(patch.grokEmail, '');
  assert.equal(patch.grokRegisterStatus, '');
  assert.equal(patch.grokCompletedAt, 0);
  assert.equal(patch.grokSsoCookie, 'cookie-a');
  assert.deepEqual(patch.grokSsoCookies, ['cookie-a', 'cookie-b']);
  assert.equal(patch.grokSsoExtractedAt, 2000);
  assert.equal(patch.runtimeState.flowState.grok.register.email, '');
  assert.equal(patch.runtimeState.flowState.grok.sso.currentCookie, 'cookie-a');
});

test('grok downstream reset clears only the state owned by the restarted tail', () => {
  const api = loadGrokStateApi();
  const currentState = {
    runtimeState: {
      flowState: {
        grok: {
          session: {
            registerTabId: 7,
            pageState: 'signed_in',
            pageUrl: 'https://grok.com/',
            lastError: 'old-error',
          },
          register: {
            email: 'grok@example.com',
            status: 'completed',
            completedAt: 1000,
          },
          sso: {
            currentCookie: 'cookie-a',
            cookies: ['cookie-a'],
            extractedAt: 2000,
          },
        },
      },
    },
  };

  const profilePatch = api.buildDownstreamResetPatch('grok-submit-profile', currentState);
  assert.equal(profilePatch.grokEmail, 'grok@example.com');
  assert.equal(profilePatch.grokRegisterStatus, 'completed');
  assert.equal(profilePatch.grokSsoCookie, '');
  assert.deepEqual(profilePatch.grokSsoCookies, []);

  const emailPatch = api.buildDownstreamResetPatch('grok-submit-email', currentState);
  assert.equal(emailPatch.grokEmail, '');
  assert.equal(emailPatch.grokRegisterStatus, '');
  assert.equal(emailPatch.grokRegisterTabId, 7);
});
