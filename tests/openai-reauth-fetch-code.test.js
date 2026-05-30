'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STEP_PATH = path.join(
  __dirname,
  '..',
  'flows',
  'openai-reauth',
  'background',
  'steps',
  'fetch-reauth-code.js'
);

function loadStepModule() {
  const source = fs.readFileSync(STEP_PATH, 'utf-8');
  const sandbox = { self: {}, globalThis: {}, console, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.self.MultiPageOpenAiReauthFetchCodeStep;
}

function buildDeps(overrides = {}) {
  const calls = {
    log: [],
    poll: [],
    resilient: [],
    complete: [],
    sleep: [],
  };

  let stopped = false;
  const stopAfter = overrides.stopAfter || null;
  let pollInvokeCount = 0;

  const deps = {
    addLog: async (message, level, options) => {
      calls.log.push({ message, level, options });
    },
    completeNodeFromBackground: async (nodeId, payload) => {
      calls.complete.push({ nodeId, payload });
    },
    pollFlowVerificationCode: async (options) => {
      pollInvokeCount += 1;
      calls.poll.push(options);
      const handler = overrides.pollHandler;
      if (typeof handler === 'function') {
        return handler(options, pollInvokeCount);
      }
      return { code: '654321' };
    },
    sendToContentScriptResilient: async (target, message, options) => {
      calls.resilient.push({ target, message, options });
      const handler = overrides.resilientHandler;
      if (typeof handler === 'function') {
        return handler(target, message, options);
      }
      return {};
    },
    throwIfStopped: () => {
      if (stopped) {
        const err = new Error('已被用户停止');
        throw err;
      }
    },
    sleepWithStop: overrides.sleepWithStop || (async (ms) => {
      calls.sleep.push(ms);
      if (stopAfter && calls.sleep.length >= stopAfter) {
        stopped = true;
        const err = new Error('已被用户停止');
        throw err;
      }
    }),
    maxResendRequests: overrides.maxResendRequests ?? 2,
    resendIntervalMs: overrides.resendIntervalMs ?? 10,
  };

  return { deps, calls, setStopped: (value) => { stopped = Boolean(value); } };
}

test('executeFetchReauthCode 缺少邮箱抛错', async () => {
  const mod = loadStepModule();
  const { deps } = buildDeps();
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await assert.rejects(
    () => executeFetchReauthCode({}),
    /缺少邮箱地址/
  );
});

test('executeFetchReauthCode skipReauthVerificationStep 跳过轮询直接 complete', async () => {
  const mod = loadStepModule();
  const { deps, calls } = buildDeps();
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await executeFetchReauthCode({
    reauthEmail: 'demo@2925.com',
    skipReauthVerificationStep: true,
  });

  assert.equal(calls.poll.length, 0);
  assert.equal(calls.resilient.length, 0);
  assert.equal(calls.complete.length, 1);
  assert.equal(calls.complete[0].nodeId, 'fetch-reauth-code');
  assert.equal(calls.complete[0].payload.skipReauthVerificationStep, true);
});

test('executeFetchReauthCode 首轮 poll 成功 → 不触发 resend，直接 FILL_CODE + complete', async () => {
  const mod = loadStepModule();
  const { deps, calls } = buildDeps({
    pollHandler: async () => ({ code: '123456' }),
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await executeFetchReauthCode({
    reauthEmail: 'demo@2925.com',
    mailProvider: '2925',
  });

  assert.equal(calls.poll.length, 1);
  // 首轮不应有 resend
  const resendCalls = calls.resilient.filter(
    (c) => c.message?.type === 'RESEND_VERIFICATION_CODE'
  );
  assert.equal(resendCalls.length, 0);
  // FILL_CODE 调用一次
  const fillCalls = calls.resilient.filter((c) => c.message?.type === 'FILL_CODE');
  assert.equal(fillCalls.length, 1);
  assert.equal(fillCalls[0].message.payload.code, '123456');
  assert.equal(calls.complete.length, 1);
  assert.equal(calls.complete[0].payload.reauthVerificationCode, '123456');
});

test('executeFetchReauthCode 第一轮失败 → 调 RESEND_VERIFICATION_CODE → 第二轮成功', async () => {
  const mod = loadStepModule();
  let pollAttempt = 0;
  const { deps, calls } = buildDeps({
    pollHandler: async () => {
      pollAttempt += 1;
      if (pollAttempt === 1) {
        throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
      }
      return { code: '999000' };
    },
    maxResendRequests: 3,
    resendIntervalMs: 5,
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await executeFetchReauthCode({
    reauthEmail: 'demo@2925.com',
    mailProvider: '2925',
  });

  assert.equal(calls.poll.length, 2);
  const resendCalls = calls.resilient.filter(
    (c) => c.message?.type === 'RESEND_VERIFICATION_CODE'
  );
  assert.equal(resendCalls.length, 1);
  assert.equal(resendCalls[0].message.step, 3);

  const fillCalls = calls.resilient.filter((c) => c.message?.type === 'FILL_CODE');
  assert.equal(fillCalls.length, 1);
  assert.equal(fillCalls[0].message.payload.code, '999000');
  assert.equal(calls.complete.length, 1);
});

test('executeFetchReauthCode 所有轮 poll 均失败 → 抛出最后一个 error', async () => {
  const mod = loadStepModule();
  const { deps, calls } = buildDeps({
    pollHandler: async () => {
      throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
    },
    maxResendRequests: 2,
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await assert.rejects(
    () => executeFetchReauthCode({
      reauthEmail: 'demo@2925.com',
      mailProvider: '2925',
    }),
    /未取到/
  );

  // 总轮数 = maxResendRequests + 1 = 3
  assert.equal(calls.poll.length, 3);
  const resendCalls = calls.resilient.filter(
    (c) => c.message?.type === 'RESEND_VERIFICATION_CODE'
  );
  assert.equal(resendCalls.length, 2);
  assert.equal(calls.complete.length, 0);
});

test('executeFetchReauthCode RESEND 调用本身失败时不中断主轮询', async () => {
  const mod = loadStepModule();
  let pollAttempt = 0;
  let resendAttempt = 0;
  const { deps, calls } = buildDeps({
    pollHandler: async () => {
      pollAttempt += 1;
      if (pollAttempt === 1) {
        throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
      }
      return { code: '777888' };
    },
    resilientHandler: async (target, message) => {
      if (message?.type === 'RESEND_VERIFICATION_CODE') {
        resendAttempt += 1;
        return { error: 'mock resend failed' };
      }
      return {};
    },
    maxResendRequests: 2,
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await executeFetchReauthCode({
    reauthEmail: 'demo@2925.com',
    mailProvider: '2925',
  });

  assert.equal(resendAttempt, 1);
  assert.equal(calls.poll.length, 2);
  const fillCalls = calls.resilient.filter((c) => c.message?.type === 'FILL_CODE');
  assert.equal(fillCalls.length, 1);
});

test('executeFetchReauthCode 在 stop 信号下立刻终止，不继续 resend / poll', async () => {
  const mod = loadStepModule();
  let pollAttempt = 0;
  const { deps, calls } = buildDeps({
    pollHandler: async () => {
      pollAttempt += 1;
      throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
    },
    // sleepWithStop 第一次就抛 stop
    sleepWithStop: async () => {
      const err = new Error('已被用户停止');
      throw err;
    },
    maxResendRequests: 3,
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await assert.rejects(
    () => executeFetchReauthCode({
      reauthEmail: 'demo@2925.com',
      mailProvider: '2925',
    }),
    /已被用户停止/
  );

  // 仅第一轮 poll，之后 sleep 抛 stop，第二轮 poll 不会被调用
  assert.equal(pollAttempt, 1);
});

test('executeFetchReauthCode 2925 时 payloadOverrides.maxAttempts = 6（缩短单轮 poll）', async () => {
  const mod = loadStepModule();
  const { deps, calls } = buildDeps({
    pollHandler: async () => ({ code: '111222' }),
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await executeFetchReauthCode({
    reauthEmail: 'demo@2925.com',
    mailProvider: '2925',
  });

  assert.equal(calls.poll.length, 1);
  const pollOptions = calls.poll[0];
  assert.equal(pollOptions.payloadOverrides?.maxAttempts, 6);
  assert.equal(mod.MAIL_2925_POLL_MAX_ATTEMPTS, 6);
});

test('executeFetchReauthCode 非 2925 provider 不强制覆盖 maxAttempts', async () => {
  const mod = loadStepModule();
  const { deps, calls } = buildDeps({
    pollHandler: async () => ({ code: '333444' }),
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await executeFetchReauthCode({
    reauthEmail: 'demo@hotmail.com',
    mailProvider: 'hotmail-api',
  });

  assert.equal(calls.poll.length, 1);
  const pollOptions = calls.poll[0];
  assert.equal(pollOptions.payloadOverrides?.maxAttempts, undefined);
});

test('executeFetchReauthCode FILL_CODE 返回 error → throw 并不调 completeNode', async () => {
  const mod = loadStepModule();
  const { deps, calls } = buildDeps({
    pollHandler: async () => ({ code: '555666' }),
    resilientHandler: async (target, message) => {
      if (message?.type === 'FILL_CODE') {
        return { error: '未找到验证码输入框。' };
      }
      return {};
    },
    maxResendRequests: 0,
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await assert.rejects(
    () => executeFetchReauthCode({
      reauthEmail: 'demo@2925.com',
      mailProvider: '2925',
    }),
    /未找到验证码输入框/
  );

  assert.equal(calls.complete.length, 0);
});

test('executeFetchReauthCode RESEND 中收到 stop 信号 → 立刻抛 stop', async () => {
  const mod = loadStepModule();
  let pollAttempt = 0;
  const { deps } = buildDeps({
    pollHandler: async () => {
      pollAttempt += 1;
      if (pollAttempt === 1) {
        throw new Error('邮箱轮询完成，但未取到 OAuth 验证码。');
      }
      return { code: '111111' };
    },
    resilientHandler: async (target, message) => {
      if (message?.type === 'RESEND_VERIFICATION_CODE') {
        throw new Error('已被用户停止');
      }
      return {};
    },
    maxResendRequests: 2,
  });
  const { executeFetchReauthCode } = mod.createFetchReauthCodeExecutor(deps);
  await assert.rejects(
    () => executeFetchReauthCode({
      reauthEmail: 'demo@2925.com',
      mailProvider: '2925',
    }),
    /已被用户停止/
  );

  // 只跑一次 poll，resend 抛 stop 后直接外抛，不进入第二轮 poll
  assert.equal(pollAttempt, 1);
});
