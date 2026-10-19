const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

function extractFunction(name) {
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

test('new user guide prompt is only eligible before the one-time dismissal is set', () => {
  const bundle = [
    extractFunction('isPromptDismissed'),
    extractFunction('setPromptDismissed'),
    extractFunction('isNewUserGuidePromptDismissed'),
    extractFunction('setNewUserGuidePromptDismissed'),
    extractFunction('shouldPromptNewUserGuide'),
  ].join('\n');

  const api = new Function(`
const NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-new-user-guide-prompt-dismissed';
const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
const btnPortalTutorial = { disabled: false };
let latestState = {};
${bundle}
return {
  shouldPromptNewUserGuide,
  setDismissed(value) {
    setNewUserGuidePromptDismissed(value);
  },
  setButtonDisabled(value) {
    btnPortalTutorial.disabled = Boolean(value);
  },
};
`)();

  assert.equal(api.shouldPromptNewUserGuide(), true);

  api.setDismissed(true);
  assert.equal(api.shouldPromptNewUserGuide(), false);

  api.setDismissed(false);
  api.setButtonDisabled(true);
  assert.equal(api.shouldPromptNewUserGuide(), false);

  api.setButtonDisabled(false);
  assert.equal(api.shouldPromptNewUserGuide(), true);
});

test('new user guide prompt persists dismissal before awaiting the user choice and opens the official portal on confirm', async () => {
  const bundle = [
    extractFunction('isPromptDismissed'),
    extractFunction('setPromptDismissed'),
    extractFunction('isNewUserGuidePromptDismissed'),
    extractFunction('setNewUserGuidePromptDismissed'),
    extractFunction('shouldPromptNewUserGuide'),
    extractFunction('getPortalUrl'),
    extractFunction('openNewUserGuidePrompt'),
    extractFunction('maybeShowNewUserGuidePrompt'),
  ].join('\n');

  const api = new Function(`
const NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY = 'multipage-new-user-guide-prompt-dismissed';
const storage = new Map();
const localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
};
const btnPortalTutorial = { disabled: false };
const latestState = {};
const portalContentService = { portalUrl: 'https://flowpilot.qlhazycoder.top' };
const openedUrls = [];
let modalOptions = null;
let nextChoice = 'confirm';
function openExternalUrl(url) {
  openedUrls.push(url);
}
function openActionModal(options) {
  modalOptions = options;
  return Promise.resolve(nextChoice);
}
${bundle}
return {
  maybeShowNewUserGuidePrompt,
  getDismissed() {
    return localStorage.getItem(NEW_USER_GUIDE_PROMPT_DISMISSED_STORAGE_KEY);
  },
  getOpenedUrls() {
    return openedUrls.slice();
  },
  getModalOptions() {
    return modalOptions;
  },
  setNextChoice(choice) {
    nextChoice = choice;
  },
};
`)();

  const confirmed = await api.maybeShowNewUserGuidePrompt();
  const modalOptions = api.getModalOptions();

  assert.equal(confirmed, true);
  assert.equal(api.getDismissed(), '1');
  assert.deepStrictEqual(api.getOpenedUrls(), ['https://flowpilot.qlhazycoder.top']);
  assert.equal(modalOptions.title, '新手引导');
  assert.equal(modalOptions.alert.text, '本提示仅出现一次。');
  assert.deepStrictEqual(
    modalOptions.actions.map((item) => ({ id: item.id, label: item.label })),
    [
      { id: null, label: '取消' },
      { id: 'confirm', label: '查看引导' },
    ]
  );

  api.setNextChoice(null);
  const skipped = await api.maybeShowNewUserGuidePrompt();
  assert.equal(skipped, false);
  assert.deepStrictEqual(api.getOpenedUrls(), ['https://flowpilot.qlhazycoder.top']);
});
