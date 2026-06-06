const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('phone-sms/providers/custom-url.js', 'utf8');
const api = new Function('self', `${source}; return self.PhoneSmsCustomUrlProvider;`)({});

function createTextResponse(payload, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  };
}

test('custom-url parses the phone----url pool, skipping malformed lines', () => {
  const pool = api.parseSmsPool([
    '16292387346----https://app.yuntl.cc/apisms/abc',
    '  16292387347 ---- https://app.yuntl.cc/apisms/def  ',
    'missing-separator-line',
    '12345----not-a-url',
    '16292387346----https://app.yuntl.cc/apisms/abc',
  ].join('\n'));
  assert.equal(pool.length, 2);
  assert.deepEqual(pool[0], { phoneNumber: '16292387346', codeUrl: 'https://app.yuntl.cc/apisms/abc' });
  assert.equal(pool[1].phoneNumber, '16292387347');
});

test('custom-url extracts 6-digit code from body, ignoring expiry date noise', () => {
  // 实测「暂无短信」格式
  assert.equal(api.extractVerificationCode('暂无短信|链接到期时间2026-07-01 23:59:59，续费请提前联系客服'), '');
  assert.equal(api.isNoSmsResponse('暂无短信|链接到期时间2026-07-01 23:59:59'), true);
  // 含验证码
  assert.equal(api.extractVerificationCode('您的验证码是 123456，请勿泄露|到期2026-07-01'), '123456');
  assert.equal(api.isNoSmsResponse('您的验证码是 123456|到期2026-07-01'), false);
  // JSON 兜底
  assert.equal(api.extractVerificationCode('{"code":"654321","msg":"ok"}'), '654321');
});

test('custom-url requestActivation walks the pool in order and advances the cursor', async () => {
  const setStateCalls = [];
  const provider = api.createProvider({
    setState: async (patch) => { setStateCalls.push(patch); },
    addLog: async () => {},
  });
  const state = {
    customUrlSmsPool: '111----https://a.test/1\n222----https://a.test/2\n333----https://a.test/3',
    customUrlSmsPoolCursor: 0,
  };

  const first = await provider.requestActivation(state, {});
  assert.equal(first.phoneNumber, '111');
  assert.equal(first.codeUrl, 'https://a.test/1');
  assert.equal(first.provider, 'custom-url');
  assert.equal(setStateCalls[0].customUrlSmsPoolCursor, 1);

  // 模拟游标推进
  const second = await provider.requestActivation({ ...state, customUrlSmsPoolCursor: 1 }, {});
  assert.equal(second.phoneNumber, '222');
  assert.equal(setStateCalls[1].customUrlSmsPoolCursor, 2);

  // 用完一圈后从头复用
  const wrap = await provider.requestActivation({ ...state, customUrlSmsPoolCursor: 3 }, {});
  assert.equal(wrap.phoneNumber, '111', '游标超出长度应回到第一个');
});

test('custom-url requestActivation throws when the pool is empty', async () => {
  const provider = api.createProvider({ setState: async () => {} });
  await assert.rejects(
    () => provider.requestActivation({ customUrlSmsPool: '' }, {}),
    /号码池为空/,
  );
});

test('custom-url pollActivationCode returns the code once SMS arrives', async () => {
  const responses = [
    '暂无短信|到期2026-07-01',
    '暂无短信|到期2026-07-01',
    '【ChatGPT】验证码 246810，10分钟内有效|到期2026-07-01',
  ];
  let index = 0;
  const provider = api.createProvider({
    fetchImpl: async () => createTextResponse(responses[Math.min(index++, responses.length - 1)]),
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });
  const code = await provider.pollActivationCode(
    {},
    { phoneNumber: '111', codeUrl: 'https://a.test/1' },
    { timeoutMs: 60000, intervalMs: 1 },
  );
  assert.equal(code, '246810');
  assert.equal(index, 3, '应轮询到第 3 次才拿到码');
});

test('custom-url pollActivationCode times out when no code arrives', async () => {
  const provider = api.createProvider({
    fetchImpl: async () => createTextResponse('暂无短信|到期2026-07-01'),
    sleepWithStop: async () => {},
    throwIfStopped: () => {},
  });
  await assert.rejects(
    () => provider.pollActivationCode(
      {},
      { phoneNumber: '111', codeUrl: 'https://a.test/1' },
      { timeoutMs: 10, intervalMs: 1, maxRounds: 2 },
    ),
    /PHONE_CODE_TIMEOUT::/,
  );
});

test('custom-url lifecycle hooks are no-ops and require no country selection', async () => {
  const provider = api.createProvider({});
  assert.equal(provider.capabilities.requiresCountrySelection, false);
  assert.equal(await provider.cancelActivation({}, {}), '');
  assert.equal(await provider.banActivation({}, {}), '');
  assert.equal(await provider.finishActivation({}, {}), '');
  assert.deepEqual(provider.resolveCountryCandidates(), []);
});
