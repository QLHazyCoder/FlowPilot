const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('flows/openai/background/steps/fill-profile.js', 'utf8');
const globalScope = {};
const api = new Function('self', `${source}; return self.MultiPageBackgroundStep5;`)(globalScope);

test('step 5 forwards generated profile data and relies on completion signal flow', async () => {
  const events = {
    logs: [],
    messages: [],
    states: [],
  };

  const executor = api.createStep5Executor({
    addLog: async (message, level) => {
      events.logs.push({ message, level: level || 'info' });
    },
    generateRandomBirthday: () => ({ year: 2003, month: 6, day: 19 }),
    generateRandomName: () => ({ firstName: 'Test', lastName: 'User' }),
    setState: async (patch) => {
      events.states.push(patch);
    },
    sendToContentScript: async (source, message) => {
      events.messages.push({ source, message });
      return { accepted: true };
    },
  });

  await executor.executeStep5();

  assert.deepStrictEqual(events.messages, [
    {
      source: 'openai-auth',
      message: {
        type: 'EXECUTE_NODE',
        nodeId: 'fill-profile',
        step: 5,
        source: 'background',
        payload: {
          firstName: 'Test',
          lastName: 'User',
          year: 2003,
          month: 6,
          day: 19,
        },
      },
    },
  ]);
  assert.deepStrictEqual(events.states, [
    {
      step5ProfilePayload: {
        firstName: 'Test',
        lastName: 'User',
        year: 2003,
        month: 6,
        day: 19,
      },
      step5ProfileRecoveryCount: 0,
    },
  ]);
  assert.ok(events.logs.some(({ message }) => /Test User/.test(message)));
});
