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

test('sidepanel exposes one operation delay switch in the existing settings surface', () => {
  assert.match(html, /id="row-operation-delay-settings"/);
  assert.match(html, /id="input-operation-delay-enabled"/);
  assert.match(html, /操作间延迟/);
  assert.match(html, /2\s*秒/);
  assert.match(html, /id="row-operation-delay-settings"[\s\S]{0,900}输入[\s\S]{0,900}选择[\s\S]{0,900}点击[\s\S]{0,900}提交[\s\S]{0,900}继续[\s\S]{0,900}授权/);
});

test('sidepanel owns operation delay toggle feedback exactly once', () => {
  assert.match(source, /inputOperationDelayEnabled/);
  assert.match(source, /operationDelayEnabled/);
  assert.match(source, /appendLog\(\{[\s\S]*操作间延迟/);
  assert.doesNotMatch(source, /operationDelayEnabled[\s\S]{0,240}addLog\(/);
});

test('sidepanel operation delay restore and save failure contracts are explicit', () => {
  assert.match(source, /normalizeOperationDelayEnabled/);
  assert.match(source, /lastConfirmedOperationDelayEnabled/);
  assert.match(source, /操作间延迟设置读取失败/);
  assert.match(source, /操作间延迟设置保存失败/);
  assert.match(source, /inputOperationDelayEnabled\.checked\s*=\s*lastConfirmedOperationDelayEnabled/);
  assert.match(source, /typeof\s+applyOperationDelayState\s*===\s*['"]function['"]/);
});

test('sidepanel syncs operation delay DATA_UPDATED without becoming the success-log owner', () => {
  assert.match(source, /message\.payload\.operationDelayEnabled\s*!==\s*undefined[\s\S]{0,240}applyOperationDelayState\(message\.payload\)/);
});

function loadOperationDelaySidepanelHarness() {
  const runtimeMessages = [];
  const logs = [];
  const inputOperationDelayEnabled = { checked: true, disabled: false };

  const chrome = {
    runtime: {
      sendMessage: async (message) => {
        runtimeMessages.push(message);
        return { ok: true, state: { operationDelayEnabled: message.payload.operationDelayEnabled } };
      },
    },
  };

  const harness = new Function('chrome', 'appendLog', 'inputOperationDelayEnabled', 'initialLatestState', `
    let latestState = initialLatestState;
    let lastConfirmedOperationDelayEnabled = true;
    function syncLatestState(nextState) {
      latestState = { ...(latestState || {}), ...(nextState || {}) };
    }
    ${extractFunction('normalizeOperationDelayEnabled')}
    ${extractFunction('appendOperationDelayLog')}
    ${extractFunction('applyOperationDelayState')}
    ${extractFunction('persistOperationDelayToggle')}
    return {
      applyOperationDelayState,
      persistOperationDelayToggle,
      getLatestState: () => latestState,
      getLastConfirmedOperationDelayEnabled: () => lastConfirmedOperationDelayEnabled,
      setLastConfirmedOperationDelayEnabled: (value) => { lastConfirmedOperationDelayEnabled = value; },
    };
  `)(chrome, (entry) => logs.push(entry), inputOperationDelayEnabled, { operationDelayEnabled: true });

  return { chrome, harness, inputOperationDelayEnabled, logs, runtimeMessages };
}

test('operation delay switch logs once, defaults restore failures to enabled, and rolls back save failures', async () => {
  const { chrome, harness: helpers, inputOperationDelayEnabled: input, logs, runtimeMessages: sentMessages } = loadOperationDelaySidepanelHarness();

  helpers.applyOperationDelayState({ operationDelayEnabled: false });
  assert.equal(input.checked, false);
  assert.equal(helpers.getLatestState().operationDelayEnabled, false);

  helpers.applyOperationDelayState({ operationDelayEnabled: undefined }, { restoreFailed: true });
  assert.equal(input.checked, true);
  assert.equal(helpers.getLatestState().operationDelayEnabled, true);
  assert.equal(logs.filter((entry) => entry.level === 'warn').length, 1);

  logs.length = 0;
  input.checked = false;
  await helpers.persistOperationDelayToggle();
  assert.equal(sentMessages.at(-1).payload.operationDelayEnabled, false);
  assert.equal(logs.length, 1);
  assert.match(logs[0].message, /关闭|off/i);

  sentMessages.length = 0;
  chrome.runtime.sendMessage = async () => { throw new Error('network down'); };
  logs.length = 0;
  input.checked = true;
  helpers.setLastConfirmedOperationDelayEnabled(false);
  await assert.rejects(() => helpers.persistOperationDelayToggle(), /network down/);
  assert.equal(input.checked, false);
  assert.equal(logs.filter((entry) => entry.level === 'error').length, 1);
});
