const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let parenDepth = 0;
  let signatureEnded = false;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    } else if (ch === '{' && signatureEnded) {
      bodyStart = i;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('operationDelayEnabled defaults to enabled and strictly normalizes values', () => {
  const defaultsBlock = source.slice(
    source.indexOf('const PERSISTED_SETTING_DEFAULTS = {'),
    source.indexOf('const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);')
  );
  assert.match(defaultsBlock, /operationDelayEnabled:\s*true/);

  const api = new Function(`${extractFunction('normalizePersistentSettingValue')}; return { normalizePersistentSettingValue };`)();
  for (const value of [undefined, null, '', 0, 'false']) {
    assert.equal(api.normalizePersistentSettingValue('operationDelayEnabled', value), true);
  }
  assert.equal(api.normalizePersistentSettingValue('operationDelayEnabled', true), true);
  assert.equal(api.normalizePersistentSettingValue('operationDelayEnabled', false), false);
});

test('operationDelayEnabled is normalized through the background settings payload path', () => {
  const api = new Function(`
    const PERSISTED_SETTING_DEFAULTS = { operationDelayEnabled: true };
    const PERSISTED_SETTING_KEYS = Object.keys(PERSISTED_SETTING_DEFAULTS);
    function resolveLegacyAutoStepDelaySeconds() { return undefined; }
    ${extractFunction('normalizePersistentSettingValue')}
    ${extractFunction('buildPersistentSettingsPayload')}
    return { buildPersistentSettingsPayload };
  `)();

  assert.equal(api.buildPersistentSettingsPayload({}, { fillDefaults: true }).operationDelayEnabled, true);
  for (const value of [undefined, null, '', 0, 'false', true]) {
    assert.equal(api.buildPersistentSettingsPayload({ operationDelayEnabled: value }, { fillDefaults: true }).operationDelayEnabled, true);
  }
  assert.equal(api.buildPersistentSettingsPayload({ operationDelayEnabled: false }).operationDelayEnabled, false);
});
