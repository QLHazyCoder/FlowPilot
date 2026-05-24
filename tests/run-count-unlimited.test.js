const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      parenDepth += 1;
    } else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        signatureEnded = true;
      }
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }
  if (braceStart < 0) {
    throw new Error(`missing body for function ${name}`);
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }

  return source.slice(start, end);
}

test('sidepanel run count input no longer hardcodes max=50', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const inputTag = html.match(/<input type="number" id="input-run-count"[^>]+>/);

  assert.ok(inputTag, 'run count input should exist');
  assert.doesNotMatch(inputTag[0], /\smax="50"/);
});

test('sidepanel getRunCountValue no longer clamps run count to 50', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const bundle = extractFunction(source, 'getRunCountValue');

  const api = new Function(`
const inputRunCount = { value: '88' };
${bundle}
return {
  getRunCountValue,
  setValue(value) {
    inputRunCount.value = value;
  },
};
`)();

  assert.equal(api.getRunCountValue(), 88);
  api.setValue('0');
  assert.equal(api.getRunCountValue(), 1);
});

test('sidepanel idle auto-run status does not reset manual run count input', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const bundle = [
    extractFunction(source, 'hasOwnStateValue'),
    extractFunction(source, 'readAutoRunStateValue'),
    extractFunction(source, 'syncAutoRunState'),
    extractFunction(source, 'isAutoRunLockedPhase'),
    extractFunction(source, 'isAutoRunPausedPhase'),
    extractFunction(source, 'applyAutoRunStatus'),
  ].join('\n');

  const api = new Function(`
let currentAutoRun = {
  autoRunning: false,
  phase: 'idle',
  currentRun: 0,
  totalRuns: 1,
  attemptRun: 0,
  countdownAt: null,
  countdownTitle: '',
  countdownNote: '',
};
let lockedRunCount = 0;
const inputRunCount = { value: '8', disabled: false };
const btnAutoRun = { disabled: false, innerHTML: '' };
const btnFetchEmail = { disabled: false };
const inputEmail = { disabled: false };
const inputAutoSkipFailures = { disabled: false };
const autoContinueBar = { style: { display: '' } };

function setSettingsCardLocked() {}
function setFreePhoneReuseControlsLocked() {}
function getAutoRunLabel() { return ''; }
function getLockedRunCountFromEmailPool() { return lockedRunCount; }
function isCustomMailProvider() { return false; }
function usesCustomEmailPoolGenerator() { return false; }
function setDefaultAutoRunButton() {}
function updateFallbackThreadIntervalInputState() {}
function syncAutoRunCountdownTicker() {}
function updateStopButtonState() {}
function getStepStatuses() { return {}; }
function updateConfigMenuControls() {}
function renderContributionMode() {}

${bundle}

return {
  applyAutoRunStatus,
  getValue() {
    return inputRunCount.value;
  },
  isDisabled() {
    return inputRunCount.disabled;
  },
  setValue(value) {
    inputRunCount.value = value;
  },
  setLockedRunCount(value) {
    lockedRunCount = value;
  },
};
`)();

  api.applyAutoRunStatus({ autoRunning: false, autoRunPhase: 'idle', autoRunTotalRuns: 1 });
  assert.equal(api.getValue(), '8');
  assert.equal(api.isDisabled(), false);

  api.applyAutoRunStatus({ autoRunPhase: 'running', autoRunTotalRuns: 4 });
  assert.equal(api.getValue(), '4');
  assert.equal(api.isDisabled(), true);

  api.setValue('9');
  api.setLockedRunCount(2);
  api.applyAutoRunStatus({ autoRunning: false, autoRunPhase: 'idle', autoRunTotalRuns: 1 });
  assert.equal(api.getValue(), '2');
  assert.equal(api.isDisabled(), true);
});

test('sidepanel pending auto-run start ignores stale active run count sync', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const bundle = [
    extractFunction(source, 'hasOwnStateValue'),
    extractFunction(source, 'readAutoRunStateValue'),
    extractFunction(source, 'normalizePendingAutoRunStartRunCount'),
    extractFunction(source, 'registerPendingAutoRunStartRunCount'),
    extractFunction(source, 'clearPendingAutoRunStartRunCount'),
    extractFunction(source, 'getPendingAutoRunStartRunCount'),
    extractFunction(source, 'getAutoRunSourceTotalRuns'),
    extractFunction(source, 'syncAutoRunState'),
    extractFunction(source, 'isAutoRunLockedPhase'),
    extractFunction(source, 'isAutoRunPausedPhase'),
    extractFunction(source, 'isAutoRunSourceSyncPhase'),
    extractFunction(source, 'shouldSyncRunCountFromAutoRunSource'),
    extractFunction(source, 'applyAutoRunStatus'),
  ].join('\n');

  const api = new Function(`
let currentAutoRun = {
  autoRunning: false,
  phase: 'idle',
  currentRun: 0,
  totalRuns: 1,
  attemptRun: 0,
  countdownAt: null,
  countdownTitle: '',
  countdownNote: '',
};
let pendingAutoRunStartTotalRuns = 0;
let pendingAutoRunStartExpiresAt = 0;
const inputRunCount = { value: '20', disabled: false };
const btnAutoRun = { disabled: false, innerHTML: '' };
const btnFetchEmail = { disabled: false };
const inputEmail = { disabled: false };
const inputAutoSkipFailures = { disabled: false };
const autoContinueBar = { style: { display: '' } };

function setSettingsCardLocked() {}
function setFreePhoneReuseControlsLocked() {}
function getAutoRunLabel() { return ''; }
function getLockedRunCountFromEmailPool() { return 0; }
function isCustomMailProvider() { return false; }
function usesCustomEmailPoolGenerator() { return false; }
function setDefaultAutoRunButton() {}
function updateFallbackThreadIntervalInputState() {}
function syncAutoRunCountdownTicker() {}
function updateStopButtonState() {}
function getStepStatuses() { return {}; }
function updateConfigMenuControls() {}
function renderContributionMode() {}

${bundle}

return {
  applyAutoRunStatus,
  registerPendingAutoRunStartRunCount,
  getValue() {
    return inputRunCount.value;
  },
  getPending() {
    return pendingAutoRunStartTotalRuns;
  },
};
`)();

  api.registerPendingAutoRunStartRunCount(20);
  api.applyAutoRunStatus({ autoRunning: true, autoRunPhase: 'running', autoRunTotalRuns: 1 });
  assert.equal(api.getValue(), '20');
  assert.equal(api.getPending(), 20);

  api.applyAutoRunStatus({ autoRunning: true, autoRunPhase: 'running', autoRunTotalRuns: 20 });
  assert.equal(api.getValue(), '20');
  assert.equal(api.getPending(), 0);
});

test('background normalizeRunCount no longer clamps values to 50', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const bundle = extractFunction(source, 'normalizeRunCount');

  const api = new Function(`
${bundle}
return { normalizeRunCount };
`)();

  assert.equal(api.normalizeRunCount(88), 88);
  assert.equal(api.normalizeRunCount('120'), 120);
  assert.equal(api.normalizeRunCount(0), 1);
  assert.equal(api.normalizeRunCount('bad'), 1);
});
