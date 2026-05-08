const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('confirm-oauth and platform-verify stay free of operation delay gate calls', () => {
  for (const file of [
    'background/steps/confirm-oauth.js',
    'background/steps/platform-verify.js',
    'background/panel-bridge.js',
    'content/sub2api-panel.js',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /performOperationWithDelay\(/, `${file} must not call the operation delay gate`);
    assert.doesNotMatch(source, /content\/operation-delay\.js/, `${file} must not inject operation delay`);
  }
});

test('operation delay gate names exactly the two excluded step keys', () => {
  const source = fs.readFileSync('content/operation-delay.js', 'utf8');
  assert.match(source, /confirm-oauth/);
  assert.match(source, /platform-verify/);
});
