const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('background imports auto-run controller module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /background\/auto-run-controller\.js/);
  assert.match(source, /buildFreshAutoRunKeepState/);
});

test('auto-run controller module exposes a factory', () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};

  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);

  assert.equal(typeof api?.createAutoRunController, 'function');
});

test('auto-run account record status preserves the real failed node instead of parsing guidance text', () => {
  const source = fs.readFileSync('background/auto-run-controller.js', 'utf8');
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageBackgroundAutoRunController;`)(globalScope);
  const controller = api.createAutoRunController({});

  const state = {
    currentNodeId: 'fetch-login-code',
    nodeStatuses: {
      'submit-signup-email': 'completed',
      'oauth-login': 'completed',
      'fetch-login-code': 'failed',
    },
  };
  const error = new Error('缺少登录账号：请先完成步骤 2，或在侧栏填写账号后再执行当前步骤。');

  assert.equal(
    controller.resolveAutoRunAccountRecordStatus('failed', state, error),
    'node:fetch-login-code:failed'
  );

  error.failedNodeId = 'platform-verify';
  assert.equal(
    controller.resolveAutoRunAccountRecordStatus('failed', state, error),
    'node:platform-verify:failed'
  );
});


test('background treats account_deactivated as terminal for fetch-signup-code', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const blockStart = source.indexOf("if (nodeId === 'fetch-signup-code') {");
  assert.notEqual(blockStart, -1);
  const block = source.slice(blockStart, blockStart + 600);
  assert.match(block, /isSignupAccountDeactivatedFailure\(err\)/);
  assert.match(block, /throw err;/);
});
