const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('confirm-oauth and platform-verify stay free of operation delay gate calls', () => {
  for (const file of [
    'flows/openai/background/steps/confirm-oauth.js',
    'flows/openai/background/steps/platform-verify.js',
    'background/panel-bridge.js',
    'flows/openai/content/sub2api-panel.js',
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

test('platform-verify stays background-completed instead of signal-waited', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const backgroundCompletedSet = source.match(/AUTO_RUN_BACKGROUND_COMPLETED_STEP_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
  const completionSignalSet = source.match(/STEP_COMPLETION_SIGNAL_STEP_KEYS\s*=\s*new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';

  assert.match(backgroundCompletedSet, /'platform-verify'/, 'platform-verify should be completed by its background executor');
  assert.doesNotMatch(
    completionSignalSet,
    /'platform-verify'/,
    'platform-verify must not wait for a completion signal because background completion does not carry the generated token'
  );
});
