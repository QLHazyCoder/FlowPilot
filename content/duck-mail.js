// content/duck-mail.js - Content script for DuckDuckGo Email Protection autofill settings

console.log('[MultiPage:duck-mail] Content script loaded on', location.href);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'FETCH_DUCK_EMAIL') return;

  resetStopState();
  fetchDuckEmail(message.payload).then((result) => {
    sendResponse(result);
  }).catch((err) => {
    if (isStopError(err)) {
      log('Duck Mail: Stopped by user.', 'warn');
      sendResponse({ stopped: true, error: err.message });
      return;
    }
    sendResponse({ error: err.message });
  });

  return true;
});

async function fetchDuckEmail(payload = {}) {
  const {
    generateNew = true,
    baselineEmail = '',
  } = payload;

  log(`Duck Mail: ${generateNew ? 'Generating' : 'Reading'} private address...`);

  await waitForElement(
    'input.AutofillSettingsPanel__PrivateDuckAddressValue, button.AutofillSettingsPanel__GeneratorButton',
    15000
  );

  const GENERATE_BUTTON_PATTERN = /generate\s+private\s+duck\s+address|new\s+private\s+duck\s+address|generate\s+new|new\s+address|生成.*duck.*地址|生成.*私有.*地址|生成.*地址|新.*地址/i;
  const DUCK_EMAIL_PATTERN = /([a-z0-9._%+-]+@duck\.com)/i;
  const ADDRESS_VALUE_SELECTORS = [
    'input.AutofillSettingsPanel__PrivateDuckAddressValue',
    'input[class*="PrivateDuckAddressValue"]',
    'input[data-testid*="PrivateDuckAddressValue"]',
    'input[value*="@duck.com" i]',
  ];

  const normalizeDuckEmail = (value) => {
    const match = String(value || '').trim().match(DUCK_EMAIL_PATTERN);
    return match ? match[1].toLowerCase() : '';
  };
  const getAddressInputs = () => {
    const seen = new Set();
    return ADDRESS_VALUE_SELECTORS
      .flatMap((selector) => Array.from(document.querySelectorAll(selector) || []))
      .filter((element) => {
        if (!element || seen.has(element)) {
          return false;
        }
        seen.add(element);
        return true;
      });
  };
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
    const candidates = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector) || []));
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
    for (const input of getAddressInputs()) {
      const candidates = [
        input?.value,
        input?.getAttribute?.('value'),
        input?.textContent,
        input?.innerText,
        input?.getAttribute?.('aria-label'),
        input?.getAttribute?.('title'),
      ];
      for (const candidate of candidates) {
        const email = normalizeDuckEmail(candidate);
        if (email) {
          return email;
        }
      }
    }
    return '';
  };
  const waitForVisibleEmail = async (attemptLimit = 12) => {
    for (let i = 0; i < attemptLimit; i++) {
      const visibleEmail = readEmail();
      if (visibleEmail) {
        return visibleEmail;
      }
      await sleep(150);
    }
    return '';
  };
  const waitForEmailValue = async (previousValues = []) => {
    const blockedValues = new Set(
      (Array.isArray(previousValues) ? previousValues : [previousValues])
        .map((value) => normalizeDuckEmail(value))
        .filter(Boolean)
    );
    let stableCandidate = '';
    let stableCount = 0;

    for (let i = 0; i < 100; i++) {
      const nextValue = readEmail();
      if (nextValue && !blockedValues.has(nextValue)) {
        if (nextValue === stableCandidate) {
          stableCount += 1;
        } else {
          stableCandidate = nextValue;
          stableCount = 1;
        }
        if (stableCount >= 2) {
          return nextValue;
        }
      } else {
        stableCandidate = '';
        stableCount = 0;
      }
      await sleep(150);
    }
    throw new Error('Timed out waiting for Duck address to change.');
  };

  const knownBaselineEmail = normalizeDuckEmail(baselineEmail);
  let currentEmail = readEmail();
  if (!currentEmail) {
    currentEmail = await waitForVisibleEmail(generateNew ? (knownBaselineEmail ? 12 : 30) : 20);
  }

  if (currentEmail && !generateNew) {
    log(`Duck Mail: Found existing address ${currentEmail}`);
    return { email: currentEmail, generated: false };
  }

  const generatorButton = getGeneratorButton();
  if (!generatorButton) {
    if (generateNew) {
      throw new Error('"Generate new Duck address" button not found (page structure, copy, or login state may have changed).');
    }
    if (currentEmail) {
      log(`Duck Mail: Generate button not found, reusing existing address ${currentEmail}`, 'warn');
      return { email: currentEmail, generated: false };
    }
    throw new Error('Duck private address generate button not found.');
  }

  const comparisonEmails = [currentEmail, knownBaselineEmail].filter(Boolean);
  if (!currentEmail && knownBaselineEmail) {
    log(`Duck Mail: Current address not yet displayed, using known baseline ${knownBaselineEmail} as comparison baseline.`, 'warn');
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    await humanPause(500, 1300);
    await window.CodexOperationDelay.performOperationWithDelay(
      {
        stepKey: 'fetch-signup-code',
        kind: 'click',
        label: 'duck-generate-address',
      },
      async () => {
        if (typeof simulateClick === 'function') {
          simulateClick(generatorButton);
        } else {
          generatorButton.click();
        }
      }
    );
    log(`Duck Mail: Clicked "Generate Duck Private Address" button (${attempt}/2)`);

    try {
      const nextEmail = await waitForEmailValue(comparisonEmails);
      log(`Duck Mail: Address ready ${nextEmail}`, 'ok');
      return { email: nextEmail, generated: true };
    } catch (err) {
      if (attempt >= 2) {
        throw err;
      }
      log('Duck Mail: Address did not change after first generation, retrying...', 'warn');
      await sleep(800);
    }
  }

  throw new Error('Failed to generate Duck address.');
}
