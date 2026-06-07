const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadGpcUtils() {
  const source = fs.readFileSync('gpc-utils.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.GpcUtils;`)(globalScope);
}

test('GPC utils keeps supported Plus payment methods distinct and normalizes legacy values', () => {
  const api = loadGpcUtils();
  assert.equal(api.normalizePlusPaymentMethod('paypal-hosted'), 'paypal-hosted');
  assert.equal(api.normalizePlusPaymentMethod('paypal_direct'), 'paypal-hosted');
  assert.equal(api.normalizePlusPaymentMethod('none'), 'none');
  assert.equal(api.normalizePlusPaymentMethod('no-payment'), 'none');
  assert.equal(api.normalizePlusPaymentMethod('gpc-helper'), 'gpc-helper');
  assert.equal(api.normalizePlusPaymentMethod('plus-auto'), 'plus-auto');
  assert.equal(api.normalizePlusPaymentMethod('pix'), 'plus-auto');
  assert.equal(api.normalizePlusPaymentMethod('pixplus'), 'plus-auto');
  assert.equal(api.normalizePlusPaymentMethod('gopay'), 'paypal');
  assert.equal(api.normalizePlusPaymentMethod('unknown'), 'paypal');
});

test('GPC utils normalizes Auto base URL and cdk, and builds Auto API URLs', () => {
  const api = loadGpcUtils();
  assert.equal(api.DEFAULT_AUTO_BASE_URL, 'https://auto.1iiu.com');
  assert.equal(api.PLUS_PAYMENT_METHOD_AUTO, 'plus-auto');
  assert.equal(api.normalizeAutoBaseUrl(''), 'https://auto.1iiu.com');
  assert.equal(api.normalizeAutoBaseUrl('https://auto.1iiu.com/'), 'https://auto.1iiu.com');
  assert.equal(api.normalizeAutoBaseUrl('not a url'), 'https://auto.1iiu.com');
  assert.equal(api.normalizeAutoBaseUrl('https://custom.example.com/base/'), 'https://custom.example.com/base');
  assert.equal(api.normalizeAutoCdk(' QZ-aB12-Cd34-Ef56 '), 'QZ-aB12-Cd34-Ef56');
  assert.equal(
    api.buildAutoApiUrl('https://auto.1iiu.com', '/api/v1/redeem'),
    'https://auto.1iiu.com/api/v1/redeem'
  );
  assert.equal(
    api.buildAutoApiUrl('', 'api/v1/orders/12'),
    'https://auto.1iiu.com/api/v1/orders/12'
  );
});

test('GPC utils builds card balance URLs from portal endpoints', () => {
  const api = loadGpcUtils();
  assert.equal(api.DEFAULT_GPC_BASE_URL, 'https://gpc.qlhazycoder.top');
  assert.equal(api.normalizeGpcBaseUrl(''), 'https://gpc.qlhazycoder.top');
  assert.equal(api.normalizeGpcBaseUrl('https://example.com/api/web/card/balance'), 'https://gpc.qlhazycoder.top');
  assert.equal(
    api.buildGpcApiUrl('', '/api/checkout/start'),
    'https://gpc.qlhazycoder.top/api/checkout/start'
  );
  assert.equal(
    api.buildGpcCardBalanceUrl('https://gpc.qlhazycoder.top/api/web/card/balance'),
    'https://gpc.qlhazycoder.top/api/web/card/balance'
  );
  assert.equal(
    api.buildGpcCardBalanceUrl('https://gpc.qlhazycoder.top/api/web/card/balance?card_key=old', ' gpc-6c9f1a32-45734795-914e6f00 '),
    'https://gpc.qlhazycoder.top/api/web/card/balance?card_key=GPC-6C9F1A32-45734795-914E6F00'
  );
  assert.equal(api.normalizeGpcCardKey(' gpc-6c9f1a32-45734795-914e6f00 '), 'GPC-6C9F1A32-45734795-914E6F00');
  assert.equal(api.isGpcCardKeyFormat('GPC-6C9F1A32-45734795-914E6F00'), true);
  assert.equal(api.isGpcCardKeyFormat('card-key-1'), false);
});

test('GPC utils formats balance and maps linked-account errors', () => {
  const api = loadGpcUtils();
  assert.equal(
    api.formatGpcBalancePayload({ remaining_uses: 12, status: 'active', used_uses: 2, flow_id: 'flow_1' }),
    '余额 12，已用 2，状态 active，flow_id flow_1'
  );
  assert.equal(
    api.formatGpcBalancePayload({
      code: 200,
      message: 'ok',
      data: { remaining_uses: 0, total_uses: 3, used_uses: 3, status: 'active', auto_mode_enabled: false },
    }),
    '余额 0/3，已用 3，状态 active'
  );
  assert.equal(
    api.formatGpcBalancePayload({
      code: 200,
      message: 'ok',
      data: { remaining_uses: 998, total_uses: 1000, used_uses: 2, status: 'active', auto_mode_enabled: true },
    }),
    '余额 998/1000，已用 2，状态 active'
  );
  assert.equal(api.getGpcBalanceRemainingUses({ data: { remaining_uses: 998 } }), 998);
  assert.equal(api.getGpcCardStatus({ data: { status: 'active' } }), 'active');
  assert.deepEqual(
    api.unwrapGpcResponse({ code: 200, message: 'ok', data: { remaining_uses: 1 } }),
    { remaining_uses: 1 }
  );
  assert.equal(
    api.extractGpcResponseErrorDetail({ errors: [{ loc: ['query', 'card_key'], msg: 'Field required' }] }, 422),
    'query.card_key: Field required'
  );
  assert.equal(
    api.extractGpcResponseErrorDetail({
      code: 400,
      message: 'invalid_param',
      data: { detail: '手机号不能为空', fields: [{ field: 'phone_number', message: '必填' }] },
    }, 400),
    '手机号不能为空'
  );
  assert.equal(
    api.extractGpcResponseErrorDetail({
      code: 400,
      message: 'invalid_param',
      data: { fields: [{ field: 'phone_number', message: '必填' }] },
    }, 400),
    'phone_number: 必填'
  );
  assert.equal(
    api.extractGpcResponseErrorDetail({ error_messages: ['account already linked'] }, 406),
    '账号已经绑定订阅，需要手动解绑'
  );
});
