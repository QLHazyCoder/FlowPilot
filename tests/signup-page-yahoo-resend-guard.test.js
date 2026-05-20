const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('signup page keeps resend capability available for yahoo foreground refresh flow', () => {
  const source = fs.readFileSync('content/signup-page.js', 'utf8');
  assert.match(source, /async function resendVerificationCode\(step, timeout = 45000\)/);
  assert.match(source, /simulateClick\(action\);/);
  assert.doesNotMatch(source, /getCurrentMailProviderFromSession/);
  assert.doesNotMatch(source, /Yahoo 模式禁止在认证页重新发送验证码/);
});
