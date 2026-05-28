'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const OAUTH_CLIENT_PATH = path.join(__dirname, '..', 'flows', 'openai-reauth', 'background', 'oauth-client.js');

function loadOAuthClientModule() {
  const source = fs.readFileSync(OAUTH_CLIENT_PATH, 'utf-8');
  const sandbox = {
    self: {},
    globalThis: {},
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    fetch: globalThis.fetch,
    URL,
    URLSearchParams,
    Uint8Array,
    Buffer,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    console,
  };
  sandbox.self.crypto = globalThis.crypto;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthOAuthClient;
}

test('PKCE RFC 7636 已知向量验证', async () => {
  const mod = loadOAuthClientModule();
  const knownVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const bytes = await mod.sha256Bytes(knownVerifier);
  const actual = mod.base64UrlEncode(bytes);
  assert.equal(actual, expected, '已知向量应通过 RFC 7636 验证');
});

test('generatePkcePair 返回合规的 verifier 和 challenge', async () => {
  const mod = loadOAuthClientModule();
  const { codeVerifier, codeChallenge } = await mod.generatePkcePair();
  assert.match(codeVerifier, /^[A-Za-z0-9\-._~]{43,128}$/, 'verifier 字符集和长度合规');
  assert.match(codeChallenge, /^[A-Za-z0-9_-]{43}$/, 'challenge 是 43 字符 base64url 无填充');
});

test('generateState 返回 64 字符 hex', () => {
  const mod = loadOAuthClientModule();
  const s = mod.generateState();
  assert.match(s, /^[0-9a-f]{64}$/);
});

test('buildAuthorizeUrl 重建用户给的示例链接', () => {
  const mod = loadOAuthClientModule();
  const url = mod.buildAuthorizeUrl({
    codeChallenge: 'xu7USQwZr4TDQWbZPOmqmkzwB5bbuTzHK0Z3AToSF9Y',
    state: '17cd69f25d8fc9253b6850031c465cc57dc6badd7943f6306444b37c3ce565b7',
  });
  const expected = 'https://auth.openai.com/oauth/authorize?client_id=app_EMoamEEZ73f0CkXaXp7hrann&code_challenge=xu7USQwZr4TDQWbZPOmqmkzwB5bbuTzHK0Z3AToSF9Y&code_challenge_method=S256&codex_cli_simplified_flow=true&id_token_add_organizations=true&redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback&response_type=code&scope=openid+profile+email+offline_access&state=17cd69f25d8fc9253b6850031c465cc57dc6badd7943f6306444b37c3ce565b7';
  assert.equal(url, expected);
});

test('buildAuthorizeUrl 缺少参数时抛错', () => {
  const mod = loadOAuthClientModule();
  assert.throws(() => mod.buildAuthorizeUrl({ codeChallenge: 'x' }), /state/);
  assert.throws(() => mod.buildAuthorizeUrl({ state: 'y' }), /codeChallenge/);
});

test('parseCallbackUrl 成功路径', () => {
  const mod = loadOAuthClientModule();
  const result = mod.parseCallbackUrl(
    'http://localhost:1455/auth/callback?code=abc123&state=xyz',
    'xyz'
  );
  assert.equal(result.code, 'abc123');
  assert.equal(result.state, 'xyz');
  assert.equal(result.error, undefined);
});

test('parseCallbackUrl state 不匹配时返回 error', () => {
  const mod = loadOAuthClientModule();
  const result = mod.parseCallbackUrl(
    'http://localhost:1455/auth/callback?code=abc&state=actual',
    'expected'
  );
  assert.ok(result.error.includes('state'));
});

test('parseCallbackUrl 拒绝非法 URL 路径与端口', () => {
  const mod = loadOAuthClientModule();
  assert.equal(mod.parseCallbackUrl('http://localhost:1455/other?code=x&state=y', 'y'), null);
  assert.equal(mod.parseCallbackUrl('http://localhost:9999/auth/callback?code=x&state=y', 'y'), null);
  assert.equal(mod.parseCallbackUrl('http://evil.com/auth/callback?code=x&state=y', 'y'), null);
});

test('parseCallbackUrl error_description 优先', () => {
  const mod = loadOAuthClientModule();
  const result = mod.parseCallbackUrl(
    'http://localhost:1455/auth/callback?error=access_denied&error_description=user_canceled&state=y',
    'y'
  );
  assert.equal(result.error, 'user_canceled');
  assert.equal(result.code, undefined);
});

test('exchangeAuthorizationCode 用 fake fetch 验证请求体与字段抽取', async () => {
  const mod = loadOAuthClientModule();
  let capturedUrl = '';
  let capturedBody = '';
  let capturedHeaders = null;
  const fakeFetch = async (url, options) => {
    capturedUrl = url;
    capturedBody = options.body;
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        access_token: 'tok_access',
        refresh_token: 'tok_refresh',
        id_token: 'tok_id',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    };
  };
  const result = await mod.exchangeAuthorizationCode({
    code: 'code_value',
    codeVerifier: 'verifier_value',
    fetchImpl: fakeFetch,
  });
  assert.equal(capturedUrl, 'https://auth.openai.com/oauth/token');
  assert.equal(capturedHeaders['Content-Type'], 'application/x-www-form-urlencoded');
  const params = new URLSearchParams(capturedBody);
  assert.equal(params.get('grant_type'), 'authorization_code');
  assert.equal(params.get('client_id'), 'app_EMoamEEZ73f0CkXaXp7hrann');
  assert.equal(params.get('code'), 'code_value');
  assert.equal(params.get('code_verifier'), 'verifier_value');
  assert.equal(params.get('redirect_uri'), 'http://localhost:1455/auth/callback');
  assert.equal(result.accessToken, 'tok_access');
  assert.equal(result.refreshToken, 'tok_refresh');
  assert.equal(result.idToken, 'tok_id');
  assert.equal(result.expiresIn, 3600);
});

test('exchangeAuthorizationCode 失败响应抛出详细错误', async () => {
  const mod = loadOAuthClientModule();
  const fakeFetch = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'code expired' }),
  });
  await assert.rejects(
    () => mod.exchangeAuthorizationCode({ code: 'c', codeVerifier: 'v', fetchImpl: fakeFetch }),
    /code expired|invalid_grant/
  );
});

test('exchangeAuthorizationCode 缺少 access_token 时抛错', async () => {
  const mod = loadOAuthClientModule();
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ refresh_token: 'r' }),
  });
  await assert.rejects(
    () => mod.exchangeAuthorizationCode({ code: 'c', codeVerifier: 'v', fetchImpl: fakeFetch }),
    /access_token|refresh_token/
  );
});

test('decodeJwtPayload 能解码示例 id_token', () => {
  const mod = loadOAuthClientModule();
  const samplePayload = { email: 'foo@bar.com', exp: 1779903020 };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'none' }), 'utf-8').toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(samplePayload), 'utf-8').toString('base64url');
  const jwt = `${headerB64}.${payloadB64}.sig`;
  const decoded = mod.decodeJwtPayload(jwt);
  assert.deepEqual(decoded, samplePayload);
});

test('buildUpdatedAccount 保留原账号外层字段，仅替换 credentials', () => {
  const mod = loadOAuthClientModule();
  const idPayload = {
    email: 'ranger@2925.com',
    'https://api.openai.com/auth': {
      chatgpt_account_id: 'acct_123',
      chatgpt_user_id: 'user_456',
      chatgpt_plan_type: 'plus',
      organizations: [
        { id: 'org-x', is_default: false },
        { id: 'org-default', is_default: true },
      ],
    },
    'https://api.openai.com/profile': { email: 'ranger@2925.com', email_verified: true },
  };
  const idTokenJwt = [
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
    Buffer.from(JSON.stringify(idPayload)).toString('base64url'),
    'sig',
  ].join('.');
  const original = {
    name: 'ranger@2925.com',
    platform: 'openai',
    type: 'oauth',
    credentials: { email: 'ranger@2925.com', client_id: 'old', refresh_token: 'old-refresh' },
    extra: { email: 'ranger@2925.com' },
    concurrency: 3,
    priority: 3,
  };
  const updated = mod.buildUpdatedAccount(original, {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    idToken: idTokenJwt,
    expiresIn: 3600,
  });
  assert.equal(updated.name, 'ranger@2925.com');
  assert.equal(updated.concurrency, 3);
  assert.equal(updated.credentials.access_token, 'new-access');
  assert.equal(updated.credentials.refresh_token, 'new-refresh');
  assert.equal(updated.credentials.id_token, idTokenJwt);
  assert.equal(updated.credentials.chatgpt_account_id, 'acct_123');
  assert.equal(updated.credentials.organization_id, 'org-default');
  assert.equal(updated.credentials.plan_type, 'plus');
  assert.equal(updated.credentials.client_id, 'app_EMoamEEZ73f0CkXaXp7hrann');
  assert.ok(updated.credentials.expires_at > Math.floor(Date.now() / 1000));
});
