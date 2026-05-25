const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
  let start = source.indexOf(`async function ${name}(`);
  if (start === -1) {
    start = source.indexOf(`function ${name}(`);
  }
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let signatureEnded = false;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
      bodyStart = i;
      break;
    }
  }
  let braceDepth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') braceDepth += 1;
    if (ch === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('sidepanel splits shared auto-run controls from openai oauth controls', () => {
  assert.doesNotMatch(html, /id="row-operation-delay-settings"/);
  assert.doesNotMatch(html, /id="input-operation-delay-enabled"/);
  assert.doesNotMatch(html, /id="row-auto-delay-settings"/);
  assert.doesNotMatch(html, /id="input-auto-delay-enabled"/);
  assert.doesNotMatch(html, /id="input-auto-delay-minutes"/);

  const step6CookieIndex = html.indexOf('id="row-step6-cookie-settings"');
  const sharedAutoRunIndex = html.indexOf('id="row-shared-auto-run"');
  const threadIntervalIndex = html.indexOf('id="row-auto-run-thread-interval"');
  const stepRangeIndex = html.indexOf('id="row-step-execution-range"');
  const oauthDisplayIndex = html.indexOf('id="row-oauth-display"');
  const oauthCallbackIndex = html.indexOf('id="row-oauth-callback"');
  const settingsActionsIndex = html.indexOf('id="row-settings-actions"');

  assert.notEqual(step6CookieIndex, -1);
  assert.notEqual(sharedAutoRunIndex, -1);
  assert.notEqual(threadIntervalIndex, -1);
  assert.doesNotMatch(html, /id="row-oauth-flow-timeout"/);
  assert.doesNotMatch(html, /id="input-oauth-flow-timeout-enabled"/);
  assert.notEqual(stepRangeIndex, -1);
  assert.notEqual(oauthDisplayIndex, -1);
  assert.notEqual(oauthCallbackIndex, -1);
  assert.notEqual(settingsActionsIndex, -1);
  assert.ok(sharedAutoRunIndex > step6CookieIndex, 'shared auto-run should render below the openai step6 cookie row');
  assert.ok(threadIntervalIndex > sharedAutoRunIndex, 'thread interval should be part of the shared auto-run block');
  assert.ok(stepRangeIndex > threadIntervalIndex, 'step execution range should render below shared thread interval');
  assert.ok(stepRangeIndex < oauthDisplayIndex, 'step execution range should stay above oauth runtime display');
  assert.ok(oauthCallbackIndex > oauthDisplayIndex, 'openai callback row should follow the oauth display');
  assert.ok(settingsActionsIndex > oauthCallbackIndex, 'save settings action should live outside the callback row');
});

test('sidepanel operation delay state is always normalized back to enabled', () => {
  const harness = new Function(`
    let latestState = { operationDelayEnabled: false };
    function syncLatestState(nextState) {
      latestState = { ...(latestState || {}), ...(nextState || {}) };
    }
    ${extractFunction('normalizeOperationDelayEnabled')}
    ${extractFunction('applyOperationDelayState')}
    return {
      normalizeOperationDelayEnabled,
      applyOperationDelayState,
      getLatestState: () => latestState,
    };
  `)();

  assert.equal(harness.normalizeOperationDelayEnabled(undefined), true);
  assert.equal(harness.normalizeOperationDelayEnabled(false), true);
  assert.equal(harness.normalizeOperationDelayEnabled(true), true);

  harness.applyOperationDelayState({ operationDelayEnabled: false });
  assert.equal(harness.getLatestState().operationDelayEnabled, true);
});
