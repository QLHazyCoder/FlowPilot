const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports logging/status module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /core\/flow-kernel\/logging-status\.js/);
});

test('logging/status module exposes a factory', () => {
  const source = fs.readFileSync('core/flow-kernel/logging-status.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundLoggingStatus;`)(globalScope);

  assert.equal(typeof api?.createLoggingStatus, 'function');
});

test('logging/status add-phone detection ignores step 2 phone-entry switch failures', () => {
  const source = fs.readFileSync('core/flow-kernel/logging-status.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundLoggingStatus;`)(globalScope);

  const loggingStatus = api.createLoggingStatus({
    chrome: { runtime: { sendMessage() { return Promise.resolve(); } } },
    DEFAULT_STATE: { stepStatuses: {} },
    getState: async () => ({ stepStatuses: {} }),
    isRecoverableStep9AuthFailure: () => false,
    LOG_PREFIX: '[test]',
    setState: async () => {},
    STOP_ERROR_MESSAGE: 'stopped',
  });

  assert.equal(
    loggingStatus.isAddPhoneAuthFailure('Step 2: the signup dialog is still in phone entry mode and has not switched back to email entry. URL: https://chatgpt.com/'),
    false
  );
  assert.equal(
    loggingStatus.isAddPhoneAuthFailure('https://auth.openai.com/add-phone'),
    false
  );
  assert.equal(
    loggingStatus.isAddPhoneAuthFailure('Step 8: verification submitted but the auth flow entered the phone number page. URL: https://auth.openai.com/add-phone'),
    true
  );
  assert.equal(
    loggingStatus.isAddPhoneAuthFailure('Step 9: auth page entered phone verification page. URL: https://auth.openai.com/phone-verification'),
    true
  );
  assert.equal(loggingStatus.getLoginAuthStateLabel('phone_verification_page'), '手机验证码页');
  assert.equal(loggingStatus.getLoginAuthStateLabel('add_email_page'), '添加邮箱页');
  assert.equal(loggingStatus.getLoginAuthStateLabel('oauth_consent_page'), 'OAuth 授权页');
  assert.equal(loggingStatus.getLoginAuthStateLabel('choose_account_page'), 'OpenAI choose account page');
  assert.equal(
    loggingStatus.isKiroProxyFailure('Kiro 注册页出现 AWS 请求异常，通常是当前代理 IP 或出口区域异常，请先切换代理后再重试。'),
    true
  );
  assert.equal(
    loggingStatus.isKiroProxyFailure('Kiro 注册页返回 403（CloudFront 拒绝请求），通常是当前代理 IP 或区域触发了 AWS 风控，请更换代理后重试。'),
    true
  );
  assert.equal(
    loggingStatus.isKiroProxyFailure('步骤 2：邮箱已提交，当前已进入姓名页。'),
    false
  );
});
