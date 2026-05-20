const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('kiro yahoo registration polling uses yahoo detail-capable command', () => {
  const source = fs.readFileSync('background/kiro/register-runner.js', 'utf8');

  assert.match(source, /async function pollYahooKiroVerificationCode\(/);
  assert.match(source, /if \(mail\.provider === 'yahoo'\) \{\s*return pollYahooKiroVerificationCode/);
  assert.match(source, /async function readKiroYahooTopMessageViaScripting\(/);
  assert.match(source, /chrome\.scripting\.executeScript/);
  assert.match(source, /后台 executeScript 直接读取 Yahoo 顶部 AWS\/Kiro 邮件行/);
  assert.match(source, /type: 'YAHOO_OPEN_TOP_MESSAGE'/);
  assert.match(source, /type: 'YAHOO_READ_CURRENT_MESSAGE_CODE'/);
  assert.match(source, /reloadIfSameUrl: true/);
});

test('kiro yahoo registration polling resends from kiro page after one minute without code', () => {
  const source = fs.readFileSync('background/kiro/register-runner.js', 'utf8');
  const contentSource = fs.readFileSync('content/kiro/register-page.js', 'utf8');

  assert.match(source, /KIRO_YAHOO_VERIFICATION_RESEND_INTERVAL_MS = 60 \* 1000/);
  assert.match(source, /KIRO_YAHOO_VERIFICATION_MAX_ATTEMPTS = 45/);
  assert.match(source, /async function resendKiroVerificationCodeFromRegisterPage\(/);
  assert.match(source, /type: 'KIRO_RESEND_VERIFICATION_CODE'/);
  assert.match(source, /Date\.now\(\) - lastKiroResendAt >= KIRO_YAHOO_VERIFICATION_RESEND_INTERVAL_MS/);
  assert.match(source, /await focusOrOpenMailTab\(mail\)/);
  assert.match(contentSource, /KIRO_RESEND_VERIFICATION_CODE/);
  assert.match(contentSource, /async function resendKiroVerificationCode\(/);
  assert.match(contentSource, /function findOtpResendButton\(/);
});

test('kiro yahoo desktop authorization polling uses yahoo detail-capable command', () => {
  const source = fs.readFileSync('background/kiro/desktop-authorize-runner.js', 'utf8');

  assert.match(source, /async function pollYahooKiroDesktopOtpCode\(/);
  assert.match(source, /if \(mail\.provider === 'yahoo'\) \{\s*return pollYahooKiroDesktopOtpCode/);
  assert.match(source, /type: 'YAHOO_CHECK_TOP_MESSAGE'/);
  assert.match(source, /type: 'YAHOO_OPEN_TOP_MESSAGE'/);
  assert.match(source, /type: 'YAHOO_READ_CURRENT_MESSAGE_CODE'/);
  assert.match(source, /reloadIfSameUrl: true/);
});
