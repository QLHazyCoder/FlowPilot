// content/duck-mail.js - Content script for DuckDuckGo Email Protection autofill settings

console.log('[MultiPage:duck-mail] Content script loaded on', location.href);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'FETCH_DUCK_EMAIL') return;

  resetStopState();
  fetchDuckEmail(message.payload).then(result => {
    sendResponse(result);
  }).catch(err => {
    if (isStopError(err)) {
      log('Duck 邮箱：已被用户停止。', 'warn');
      sendResponse({ stopped: true, error: err.message });
      return;
    }
    sendResponse({ error: err.message });
  });

  return true;
});

async function fetchDuckEmail(payload = {}) {
  const { generateNew = true } = payload;

  log(`Duck 邮箱：正在${generateNew ? '生成' : '读取'}私有地址...`);

  await waitForElement(
    'input.AutofillSettingsPanel__PrivateDuckAddressValue, button.AutofillSettingsPanel__GeneratorButton',
    15000
  );

  const GENERATE_BUTTON_PATTERN = /generate\s+private\s+duck\s+address|new\s+private\s+duck\s+address|generate\s+new|new\s+address|生成.*duck.*地址|生成.*私有.*地址|生成.*地址|新.*地址/i;

  const getAddressInput = () => document.querySelector('input.AutofillSettingsPanel__PrivateDuckAddressValue');
  const getGeneratorButton = () => {
    const direct = document.querySelector('button.AutofillSettingsPanel__GeneratorButton');
    if (direct) return direct;

    const selectors = [
      'button[data-testid*="Generator"]',
      'button[class*="Generator"]',
      'button[aria-label*="duck" i]',
      'button[title*="duck" i]',
      '[role="button"]',
      'button',
    ];
    const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    return candidates.find((btn) => {
      const text = [
        btn.textContent,
        btn.getAttribute?.('aria-label'),
        btn.getAttribute?.('title'),
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return GENERATE_BUTTON_PATTERN.test(text);
    }) || null;
  };
  const readEmail = () => {
    const value = getAddressInput()?.value?.trim() || '';
    return value.includes('@duck.com') ? value : '';
  };

  const waitForEmailValue = async (previousValue = '') => {
    for (let i = 0; i < 100; i++) {
      const nextValue = readEmail();
      if (nextValue && nextValue !== previousValue) {
        return nextValue;
      }
      await sleep(150);
    }
    throw new Error('等待 Duck 地址出现超时。');
  };

  const currentEmail = readEmail();
  if (currentEmail && !generateNew) {
    log(`Duck 邮箱：已发现现有地址 ${currentEmail}`);
    return { email: currentEmail, generated: false };
  }

  const generatorButton = getGeneratorButton();
  if (!generatorButton) {
    if (generateNew) {
      throw new Error('未找到“生成新 Duck 地址”按钮（可能是页面文案/语言变化、未登录或页面结构更新）。');
    }
    if (currentEmail) {
      log(`Duck 邮箱：未找到生成按钮，复用现有地址 ${currentEmail}`, 'warn');
      return { email: currentEmail, generated: false };
    }
    throw new Error('未找到“生成 Duck 私有地址”按钮。');
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    await humanPause(500, 1300);
    await window.CodexOperationDelay.performOperationWithDelay({ stepKey: 'fetch-signup-code', kind: 'click', label: 'duck-generate-address' }, async () => {
      if (typeof simulateClick === 'function') {
        simulateClick(generatorButton);
      } else {
        generatorButton.click();
      }
    });
    log(`Duck 邮箱：已点击“生成 Duck 私有地址”按钮（${attempt}/2）`);

    try {
      const nextEmail = await waitForEmailValue(currentEmail);
      log(`Duck 邮箱：地址已就绪 ${nextEmail}`, 'ok');
      return { email: nextEmail, generated: true };
    } catch (err) {
      if (attempt >= 2) {
        throw err;
      }
      log('Duck 邮箱：首次生成后地址未变化，准备重试一次...', 'warn');
      await sleep(800);
    }
  }

  throw new Error('Duck 地址生成失败。');
}
