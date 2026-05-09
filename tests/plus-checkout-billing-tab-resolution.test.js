const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function loadPlusCheckoutBillingModule() {
  const source = fs.readFileSync('background/steps/fill-plus-checkout.js', 'utf8');
  const globalScope = {};
  return new Function('self', `${source}; return self.MultiPageBackgroundPlusCheckoutBilling;`)(globalScope);
}

function createAddressSeed() {
  return {
    countryCode: 'DE',
    query: 'Berlin Mitte',
    suggestionIndex: 1,
    fallback: {
      address1: 'Unter den Linden',
      city: 'Berlin',
      region: 'Berlin',
      postalCode: '10117',
    },
  };
}

function createAuAddressSeed() {
  return {
    countryCode: 'AU',
    query: 'Sydney NSW',
    suggestionIndex: 1,
    fallback: {
      address1: 'George Street',
      city: 'Sydney',
      region: 'New South Wales',
      postalCode: '2000',
    },
  };
}

function createIdAddressSeed() {
  return {
    countryCode: 'ID',
    query: 'Jakarta Indonesia',
    suggestionIndex: 1,
    fallback: {
      address1: 'Jalan M.H. Thamrin No. 1',
      city: 'Jakarta',
      region: 'DKI Jakarta',
      postalCode: '10310',
    },
  };
}

function createKrAddressSeed() {
  return {
    countryCode: 'KR',
    query: 'Seoul Jung-gu',
    suggestionIndex: 1,
    fallback: {
      address1: 'Sejong-daero 110',
      city: 'Jung-gu',
      region: 'Seoul',
      postalCode: '04524',
    },
  };
}

function createSuccessfulBillingResult() {
  return {
    countryText: 'Germany',
    structuredAddress: {
      address1: 'Unter den Linden',
      city: 'Berlin',
      postalCode: '10117',
    },
  };
}

function createExecutorHarness({
  frames,
  stateByFrame,
  readyByFrame = {},
  fetchImpl = null,
  getAddressSeedForCountry = () => createAddressSeed(),
  getState = null,
  markCurrentRegistrationAccountUsed = async () => {},
  probeIpProxyExit = null,
  onSetState = null,
  sleepWithStop = null,
  submitRedirectUrl = 'https://www.paypal.com/checkoutnow',
}) {
  const api = loadPlusCheckoutBillingModule();
  const events = {
    completed: [],
    ensuredTabs: [],
    injectedAllFrames: false,
    logs: [],
    messages: [],
    sleeps: [],
    states: [],
    waitedUrls: [],
  };
  const checkoutTab = {
    id: 42,
    url: 'https://chatgpt.com/checkout/openai_ie/cs_test',
    status: 'complete',
  };

  const executor = api.createPlusCheckoutBillingExecutor({
    addLog: async (message, level = 'info') => events.logs.push({ message, level }),
    chrome: {
      tabs: {
        get: async (tabId) => (tabId === checkoutTab.id ? checkoutTab : null),
        query: async (queryInfo) => {
          if (queryInfo.active && queryInfo.currentWindow) {
            return [checkoutTab];
          }
          if (queryInfo.url === 'https://chatgpt.com/checkout/*') {
            return [checkoutTab];
          }
          return [];
        },
        sendMessage: async (tabId, message, options = {}) => {
          const frameId = Number.isInteger(options.frameId) ? options.frameId : 0;
          events.messages.push({ tabId, message, frameId });
          const hasConfiguredState = Object.prototype.hasOwnProperty.call(stateByFrame, frameId);
          if (message.type === 'PING') {
            if (readyByFrame[frameId] === false) {
              throw new Error('No receiving end');
            }
            return { ok: true, source: 'plus-checkout' };
          }
          if (readyByFrame[frameId] === false && !hasConfiguredState) {
            throw new Error('No receiving end');
          }
          if (message.type === 'PLUS_CHECKOUT_GET_STATE') {
            return stateByFrame[frameId] || { hasPayPal: false, paypalCandidates: [] };
          }
          if (message.type === 'PLUS_CHECKOUT_CLICK_SUBSCRIBE') {
            checkoutTab.url = submitRedirectUrl;
          }
          return createSuccessfulBillingResult();
        },
      },
      scripting: {
        executeScript: async (details) => {
          if (details.target?.allFrames) {
            events.injectedAllFrames = true;
          }
        },
      },
      webNavigation: {
        getAllFrames: async () => frames,
      },
    },
    completeStepFromBackground: async (step, payload) => events.completed.push({ step, payload }),
    ensureContentScriptReadyOnTabUntilStopped: async (source, tabId) => events.ensuredTabs.push({ source, tabId }),
    fetch: fetchImpl,
    generateRandomName: () => ({ firstName: 'Ada', lastName: 'Lovelace' }),
    getAddressSeedForCountry,
    getState: typeof getState === 'function' ? getState : async () => ({}),
    getTabId: async () => null,
    isTabAlive: async () => false,
    markCurrentRegistrationAccountUsed,
    setState: async (updates) => {
      events.states.push(updates);
      if (typeof onSetState === 'function') {
        await onSetState(updates, events);
      }
    },
    sleepWithStop: sleepWithStop || (async (ms) => events.sleeps.push(ms)),
    waitForTabCompleteUntilStopped: async () => checkoutTab,
    waitForTabUrlMatchUntilStopped: async (tabId, matcher) => {
      events.waitedUrls.push({ tabId });
      assert.equal(matcher(submitRedirectUrl), true);
      return { id: tabId, url: submitRedirectUrl };
    },
    ...(typeof probeIpProxyExit === 'function' ? { probeIpProxyExit } : {}),
  });

  return { checkoutTab, events, executor };
}

test('Plus checkout billing stops before PayPal when today due amount is non-zero', async () => {
  const markCalls = [];
  const { events, executor } = createExecutorHarness({
    frames: [{ frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' }],
    stateByFrame: {
      0: {
        hasPayPal: true,
        paypalCandidates: [{ tag: 'button', text: 'PayPal' }],
        billingFieldsVisible: true,
        hasSubscribeButton: true,
        checkoutAmountSummary: {
          hasTodayDue: true,
          amount: 19.33,
          isZero: false,
          rawAmount: '€19.33',
        },
      },
    },
    markCurrentRegistrationAccountUsed: async (state, options) => {
      markCalls.push({ state, options });
      return { updated: true };
    },
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling({ email: 'paid@example.com' }),
    /PLUS_CHECKOUT_NON_FREE_TRIAL::/
  );

  assert.equal(events.messages.some((entry) => entry.message.type === 'PLUS_CHECKOUT_CLICK_SUBSCRIBE'), false);
  assert.equal(events.completed.length, 0);
  assert.equal(markCalls.length, 1);
  assert.equal(markCalls[0].state.email, 'paid@example.com');
  assert.equal(events.logs.some((entry) => /今日应付金额不是 0/.test(entry.message)), true);
});

test('Plus checkout billing uses the current checkout tab when step 6 did not register one', async () => {
  const { checkoutTab, events, executor } = createExecutorHarness({
    frames: [{ frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' }],
    stateByFrame: {
      0: {
        hasPayPal: true,
        paypalCandidates: [{ tag: 'button', text: 'PayPal' }],
        billingFieldsVisible: true,
        hasSubscribeButton: true,
      },
    },
  });

  await executor.executePlusCheckoutBilling({});

  assert.deepEqual(events.ensuredTabs[0], { source: 'plus-checkout', tabId: checkoutTab.id });
  assert.equal(events.messages.some((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_PAYPAL' && entry.frameId === 0), true);
  assert.equal(events.messages.some((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS' && entry.frameId === 0), true);
  assert.equal(events.messages.some((entry) => entry.message.type === 'PLUS_CHECKOUT_CLICK_SUBSCRIBE' && entry.frameId === 0), true);
  assert.equal(events.completed[0].step, 7);
  assert.equal(events.states.some((updates) => updates.plusCheckoutTabId === checkoutTab.id), true);
  assert.equal(events.logs.some((entry) => /当前已在 Plus Checkout 页面/.test(entry.message)), true);
});

test('Plus checkout billing sends the billing command to the iframe that contains PayPal', async () => {
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, paypalCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: true, paypalCandidates: [{ tag: 'button', text: 'PayPal' }] },
      8: { hasPayPal: false, paypalCandidates: [], billingFieldsVisible: true },
    },
  });

  await executor.executePlusCheckoutBilling({});

  const selectMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_PAYPAL');
  const fillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  const subscribeMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_CLICK_SUBSCRIBE');
  assert.equal(selectMessage.frameId, 7);
  assert.equal(fillMessage.frameId, 8);
  assert.equal(subscribeMessage.frameId, 0);
  assert.equal(events.logs.some((entry) => /checkout iframe/.test(entry.message)), true);
  assert.equal(events.completed[0].step, 7);
});

test('Plus checkout billing uses proxy exit country for GoPay address when available', async () => {
  const requestedCountries = [];
  const fetchRequests = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_llc/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, hasGoPay: false, paypalCandidates: [], gopayCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: false, hasGoPay: true, gopayCandidates: [{ tag: 'button', text: 'GoPay' }] },
      8: {
        hasPayPal: false,
        hasGoPay: false,
        paypalCandidates: [],
        gopayCandidates: [],
        billingFieldsVisible: true,
        countryText: 'United States',
      },
    },
    getAddressSeedForCountry: (countryValue) => {
      requestedCountries.push(countryValue);
      return countryValue === 'JP' ? {
        countryCode: 'JP',
        query: 'Tokyo Marunouchi',
        suggestionIndex: 1,
        fallback: {
          address1: 'Marunouchi 1-1',
          city: 'Chiyoda-ku',
          region: 'Tokyo',
          postalCode: '100-0005',
        },
      } : createIdAddressSeed();
    },
    fetchImpl: async (url, init) => {
      fetchRequests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          address: {
            Address: 'トウキョウト, チヨダク, マルノウチ, 1-1',
            Trans_Address: 'Marunouchi 1-1, Chiyoda-ku, Tokyo',
            City: 'Tokyo',
            State: 'Tokyo',
            Zip_Code: '100-0005',
          },
        }),
      };
    },
    submitRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/session#/gopay-tokenization/linking',
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gopay',
    plusCheckoutCountry: 'ID',
    ipProxyAppliedExitRegion: 'JP',
  });

  const fillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(requestedCountries[0], 'JP');
  assert.equal(fillMessage.message.payload.addressSeed.countryCode, 'JP');
  assert.equal(fillMessage.message.payload.addressSeed.source, 'meiguodizhi');
  assert.deepEqual(JSON.parse(fetchRequests[0].init.body), {
    city: 'Chiyoda-ku',
    path: '/jp-address',
    method: 'refresh',
  });
  assert.equal(events.logs.some((entry) => /GoPay 账单地址将按当前代理出口地区 JP/.test(entry.message)), true);
});

test('Plus checkout billing refreshes stale GoPay proxy country before filling address', async () => {
  const requestedCountries = [];
  const probeCalls = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_llc/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, hasGoPay: false, paypalCandidates: [], gopayCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: false, hasGoPay: true, gopayCandidates: [{ tag: 'button', text: 'GoPay' }] },
      8: {
        hasPayPal: false,
        hasGoPay: false,
        paypalCandidates: [],
        gopayCandidates: [],
        billingFieldsVisible: true,
        countryText: 'Indonesia',
      },
    },
    getAddressSeedForCountry: (countryValue) => {
      requestedCountries.push(countryValue);
      return countryValue === 'JP' ? {
        countryCode: 'JP',
        query: 'Tokyo Chiyoda-ku',
        suggestionIndex: 1,
        fallback: {
          address1: 'Marunouchi 1-1',
          city: 'Chiyoda-ku',
          region: 'Tokyo',
          postalCode: '100-0005',
        },
      } : createKrAddressSeed();
    },
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ status: 'error' }),
    }),
    probeIpProxyExit: async (options) => {
      probeCalls.push(options);
      return {
        proxyRouting: {
          exitRegion: 'JP',
          exitIp: '203.0.113.8',
          exitSource: 'page_context',
          exitEndpoint: 'https://ipinfo.io/json',
        },
      };
    },
    submitRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/session#/gopay-tokenization/linking',
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gopay',
    plusCheckoutCountry: 'ID',
    ipProxyAppliedExitRegion: 'KR',
  });

  const fillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(probeCalls.length, 1);
  assert.equal(probeCalls[0].detectWhenDisabled, true);
  assert.equal(requestedCountries[0], 'JP');
  assert.equal(fillMessage.message.payload.addressSeed.countryCode, 'JP');
  assert.equal(events.logs.some((entry) => entry.message.includes('当前代理出口复测结果：JP / 203.0.113.8')), true);
  assert.equal(events.logs.some((entry) => /GoPay 账单地址将按当前代理出口地区 JP/.test(entry.message)), true);
  assert.equal(events.logs.some((entry) => /GoPay 账单地址将按当前代理出口地区 KR/.test(entry.message)), false);
});

test('Plus checkout billing refuses to reuse stale GoPay proxy country when refresh has no region', async () => {
  const requestedCountries = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_llc/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, hasGoPay: false, paypalCandidates: [], gopayCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: false, hasGoPay: true, gopayCandidates: [{ tag: 'button', text: 'GoPay' }] },
      8: {
        hasPayPal: false,
        hasGoPay: false,
        paypalCandidates: [],
        gopayCandidates: [],
        billingFieldsVisible: true,
        countryText: 'Indonesia',
      },
    },
    getAddressSeedForCountry: (countryValue) => {
      requestedCountries.push(countryValue);
      return createKrAddressSeed();
    },
    probeIpProxyExit: async () => ({
      proxyRouting: {
        reason: 'disabled_probe_only',
        exitIp: '203.0.113.9',
        exitRegion: '',
        exitError: 'missing_region',
      },
    }),
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling({
      plusPaymentMethod: 'gopay',
      plusCheckoutCountry: 'ID',
      ipProxyAppliedExitRegion: 'KR',
    }),
    /本次复测没有拿到国家码/
  );

  assert.equal(requestedCountries.length, 0);
  assert.equal(events.logs.some((entry) => /已清空旧出口地区 KR/.test(entry.message)), true);
  assert.equal(events.logs.some((entry) => /GoPay 账单地址将按当前代理出口地区 KR/.test(entry.message)), false);
});

test('Plus checkout billing normalizes legacy Korean postal code for GoPay address', async () => {
  const requestedCountries = [];
  const fetchRequests = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_llc/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, hasGoPay: false, paypalCandidates: [], gopayCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: false, hasGoPay: true, gopayCandidates: [{ tag: 'button', text: 'GoPay' }] },
      8: {
        hasPayPal: false,
        hasGoPay: false,
        paypalCandidates: [],
        gopayCandidates: [],
        billingFieldsVisible: true,
        countryText: 'United States',
      },
    },
    getAddressSeedForCountry: (countryValue) => {
      requestedCountries.push(countryValue);
      return countryValue === 'KR' ? createKrAddressSeed() : createIdAddressSeed();
    },
    fetchImpl: async (url, init) => {
      fetchRequests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          address: {
            Address: '서울특별시 중구 세종대로 110',
            Trans_Address: 'Sejong-daero 110, Jung-gu, Seoul',
            City: 'Jung-gu',
            State: 'Seoul',
            Zip_Code: '150-300',
          },
        }),
      };
    },
    submitRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/session#/gopay-tokenization/linking',
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gopay',
    plusCheckoutCountry: 'ID',
    ipProxyAppliedExitRegion: 'KR',
  });

  const fillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(requestedCountries[0], 'KR');
  assert.equal(fillMessage.message.payload.addressSeed.countryCode, 'KR');
  assert.equal(fillMessage.message.payload.addressSeed.source, 'meiguodizhi');
  assert.equal(fillMessage.message.payload.addressSeed.fallback.address1, 'Sejong-daero 110, Jung-gu, Seoul');
  assert.equal(fillMessage.message.payload.addressSeed.fallback.postalCode, '04524');
  assert.match(fillMessage.message.payload.addressSeed.fallback.postalCode, /^\d{5}$/);
  assert.deepEqual(JSON.parse(fetchRequests[0].init.body), {
    city: 'Jung-gu',
    path: '/kr-address',
    method: 'refresh',
  });
  assert.equal(events.logs.some((entry) => /GoPay 账单地址将按当前代理出口地区 KR/.test(entry.message)), true);
});

test('Plus checkout billing selects GoPay and waits for a GoPay redirect', async () => {
  const { checkoutTab, events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, hasGoPay: false, paypalCandidates: [], gopayCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: false, hasGoPay: true, gopayCandidates: [{ tag: 'button', text: 'GoPay' }] },
      8: {
        hasPayPal: false,
        hasGoPay: false,
        paypalCandidates: [],
        gopayCandidates: [],
        billingFieldsVisible: true,
        countryText: 'Indonesia',
      },
    },
    getAddressSeedForCountry: () => createIdAddressSeed(),
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({ status: 'error' }),
    }),
    submitRedirectUrl: 'https://gopay.co.id/payment/session',
  });

  await executor.executePlusCheckoutBilling({ plusPaymentMethod: 'gopay' });

  const selectMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_GOPAY');
  const paypalSelectMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_PAYPAL');
  const fillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  const subscribeMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_CLICK_SUBSCRIBE');
  assert.equal(selectMessage.frameId, 7);
  assert.equal(selectMessage.message.payload.paymentMethod, 'gopay');
  assert.equal(paypalSelectMessage, undefined);
  assert.equal(fillMessage.message.payload.addressSeed.countryCode, 'ID');
  assert.equal(subscribeMessage.message.payload.paymentMethod, 'gopay');
  assert.equal(checkoutTab.url, 'https://gopay.co.id/payment/session');
  assert.equal(events.completed[0].step, 7);
});

test('Plus checkout billing still inspects a frame when ping readiness is stale', async () => {
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: {
        hasPayPal: true,
        paypalCandidates: [{ tag: 'button', text: 'PayPal' }],
        hasSubscribeButton: true,
      },
      7: { hasPayPal: false, paypalCandidates: [] },
      8: { hasPayPal: false, paypalCandidates: [], billingFieldsVisible: true },
    },
    readyByFrame: {
      0: false,
    },
  });

  await executor.executePlusCheckoutBilling({});

  const selectMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_PAYPAL');
  assert.equal(selectMessage.frameId, 0);
  assert.equal(events.completed[0].step, 7);
});

test('Plus checkout billing uses the autocomplete iframe for address suggestions when Stripe splits it out', async () => {
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
      { frameId: 9, url: 'https://js.stripe.com/v3/elements-inner-autocompl.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, paypalCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: true, paypalCandidates: [{ tag: 'button', text: 'PayPal' }] },
      8: { hasPayPal: false, paypalCandidates: [], billingFieldsVisible: true },
      9: { hasPayPal: false, paypalCandidates: [] },
    },
  });

  await executor.executePlusCheckoutBilling({});

  const fillQueryMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_ADDRESS_QUERY');
  const suggestionMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_ADDRESS_SUGGESTION');
  const ensureAddressMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_ENSURE_BILLING_ADDRESS');
  const combinedFillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(fillQueryMessage.frameId, 8);
  assert.equal(suggestionMessage.frameId, 9);
  assert.equal(ensureAddressMessage.frameId, 8);
  assert.equal(combinedFillMessage, undefined);
  assert.equal(events.logs.some((entry) => /Google 地址推荐/.test(entry.message)), true);
  assert.equal(events.completed[0].step, 7);
});

test('Plus checkout billing skips Google autocomplete when meiguodizhi returns a complete address', async () => {
  const fetchRequests = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
      { frameId: 9, url: 'https://js.stripe.com/v3/elements-inner-autocompl.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, paypalCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: true, paypalCandidates: [{ tag: 'button', text: 'PayPal' }] },
      8: { hasPayPal: false, paypalCandidates: [], billingFieldsVisible: true },
      9: { hasPayPal: false, paypalCandidates: [] },
    },
    fetchImpl: async (url, init) => {
      fetchRequests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          address: {
            Address: 'Rosa-Luxemburg-Strasse 40',
            City: 'Berlin',
            State: 'Berlin',
            Zip_Code: '69081',
          },
        }),
      };
    },
  });

  await executor.executePlusCheckoutBilling({});

  const fillQueryMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_ADDRESS_QUERY');
  const suggestionMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_SELECT_ADDRESS_SUGGESTION');
  const ensureAddressMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_ENSURE_BILLING_ADDRESS');
  const combinedFillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(fillQueryMessage, undefined);
  assert.equal(suggestionMessage, undefined);
  assert.equal(ensureAddressMessage, undefined);
  assert.equal(combinedFillMessage.frameId, 8);
  assert.equal(combinedFillMessage.message.payload.addressSeed.skipAutocomplete, true);
  assert.equal(combinedFillMessage.message.payload.addressSeed.source, 'meiguodizhi');
  assert.equal(combinedFillMessage.message.payload.addressSeed.fallback.address1, 'Rosa-Luxemburg-Strasse 40');
  assert.equal(combinedFillMessage.message.payload.addressSeed.fallback.city, 'Berlin');
  assert.equal(combinedFillMessage.message.payload.addressSeed.fallback.postalCode, '69081');
  assert.equal(fetchRequests.length, 1);
  assert.equal(fetchRequests[0].url, 'https://www.meiguodizhi.com/api/v1/dz');
  assert.deepEqual(JSON.parse(fetchRequests[0].init.body), {
    city: 'Berlin',
    path: '/de-address',
    method: 'refresh',
  });
  assert.equal(events.completed[0].step, 7);
});

test('Plus checkout billing uses the detected checkout country before choosing an address seed', async () => {
  const requestedCountries = [];
  const fetchRequests = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, paypalCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: true, paypalCandidates: [{ tag: 'button', text: 'PayPal' }] },
      8: {
        hasPayPal: false,
        paypalCandidates: [],
        billingFieldsVisible: true,
        countryText: 'Australia',
      },
    },
    getAddressSeedForCountry: (countryValue) => {
      requestedCountries.push(countryValue);
      return /australia|au/i.test(String(countryValue || '')) ? createAuAddressSeed() : createAddressSeed();
    },
    fetchImpl: async (url, init) => {
      fetchRequests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          address: {
            Address: '98 Ocean Street',
            City: 'Sydney South',
            State: 'New South Wales',
            Zip_Code: '2000',
          },
        }),
      };
    },
  });

  await executor.executePlusCheckoutBilling({ plusCheckoutCountry: 'DE' });

  const combinedFillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(requestedCountries[0], 'AU');
  assert.equal(combinedFillMessage.message.payload.addressSeed.countryCode, 'AU');
  assert.equal(combinedFillMessage.message.payload.addressSeed.fallback.region, 'New South Wales');
  assert.deepEqual(JSON.parse(fetchRequests[0].init.body), {
    city: 'Sydney',
    path: '/au-address',
    method: 'refresh',
  });
});

test('Plus checkout billing uses meiguodizhi country paths for localized countries without local seeds', async () => {
  const fetchRequests = [];
  const { events, executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
      { frameId: 8, url: 'https://js.stripe.com/v3/elements-inner-address.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, paypalCandidates: [], hasSubscribeButton: true },
      7: { hasPayPal: true, paypalCandidates: [{ tag: 'button', text: 'PayPal' }] },
      8: {
        hasPayPal: false,
        paypalCandidates: [],
        billingFieldsVisible: true,
        countryText: '日本',
      },
    },
    fetchImpl: async (url, init) => {
      fetchRequests.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          address: {
            Address: 'トウキョウト, ミナトク, シバダイモン, 10-4',
            Trans_Address: '10-4, Shiba Daimon 2-chome, Minato-ku, Tokyo',
            City: 'Tokyo',
            State: 'Tokyo',
            Zip_Code: '105-0012',
          },
        }),
      };
    },
  });

  await executor.executePlusCheckoutBilling({ plusCheckoutCountry: 'DE' });

  const combinedFillMessage = events.messages.find((entry) => entry.message.type === 'PLUS_CHECKOUT_FILL_BILLING_ADDRESS');
  assert.equal(combinedFillMessage.message.payload.addressSeed.countryCode, 'JP');
  assert.equal(combinedFillMessage.message.payload.addressSeed.source, 'meiguodizhi');
  assert.equal(combinedFillMessage.message.payload.addressSeed.fallback.address1, '10-4, Shiba Daimon 2-chome, Minato-ku, Tokyo');
  assert.deepEqual(JSON.parse(fetchRequests[0].init.body), {
    city: 'Tokyo',
    path: '/jp-address',
    method: 'refresh',
  });
});

test('Plus checkout billing reports when the payment iframe exists but cannot receive the content script', async () => {
  const { executor } = createExecutorHarness({
    frames: [
      { frameId: 0, url: 'https://chatgpt.com/checkout/openai_ie/cs_test' },
      { frameId: 7, url: 'https://js.stripe.com/v3/elements-inner-payment.html' },
    ],
    stateByFrame: {
      0: { hasPayPal: false, paypalCandidates: [], hasSubscribeButton: true },
    },
    readyByFrame: {
      7: false,
    },
  });

  await assert.rejects(
    executor.executePlusCheckoutBilling({}),
    /已定位到 PayPal 所在 iframe（frameId=7），但账单脚本无法注入该 iframe/
  );
});


function createGpcTaskResponse(data) {
  return {
    code: 200,
    message: 'ok',
    data: {
      task_id: 'task_123',
      phone_mode: 'manual',
      status_text: data.status === 'completed' ? '充值完成' : (data.status === 'otp_ready' ? '等待 PIN' : '处理中'),
      api_input_deadline_at: data.api_input_deadline_at ?? new Date(Date.now() + 60000).toISOString(),
      ...data,
    },
  };
}

test('GPC billing polls queue task, submits WhatsApp OTP then PIN, and waits until completed', async () => {
  const fetchCalls = [];
  let currentState = {
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: '',
  };
  let pollCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    getState: async () => currentState,
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_123') {
        pollCount += 1;
        if (pollCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ status: 'active', remote_stage: 'whatsapp_otp_wait', api_waiting_for: 'otp' }),
          };
        }
        if (pollCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ status: 'otp_ready', status_text: '等待 PIN', remote_stage: 'otp_ready', api_waiting_for: 'pin' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ status: 'completed', status_text: '充值完成', remote_stage: 'completed' }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_123/otp')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ status: 'otp_ready', status_text: '等待 PIN', remote_stage: 'otp_ready', api_waiting_for: 'pin' }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_123/pin')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ status: 'active', status_text: '处理中', remote_stage: 'payment_processing' }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  const run = executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_123',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/api/gp/tasks/task_old/otp',
    gopayHelperPin: '654321',
    gopayHelperApiKey: 'gpc_billing_123',
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  const pending = events.states.find((state) => state.plusManualConfirmationMethod === 'gopay-otp');
  assert.ok(pending);
  currentState = {
    plusManualConfirmationPending: false,
    plusManualConfirmationRequestId: pending.plusManualConfirmationRequestId,
    gopayHelperResolvedOtp: '123456',
  };

  await run;

  assert.equal(fetchCalls[0].url, 'https://gpc.qlhazycoder.top/api/gp/tasks/task_123');
  assert.equal(fetchCalls[0].options.headers['X-API-Key'], 'gpc_billing_123');
  const otpCall = fetchCalls.find((call) => call.url.endsWith('/api/gp/tasks/task_123/otp'));
  const pinCall = fetchCalls.find((call) => call.url.endsWith('/api/gp/tasks/task_123/pin'));
  assert.deepEqual(JSON.parse(otpCall.options.body), { otp: '123456' });
  assert.equal(otpCall.options.headers['X-API-Key'], 'gpc_billing_123');
  assert.deepEqual(JSON.parse(pinCall.options.body), { pin: '654321' });
  assert.equal(pinCall.options.headers['X-API-Key'], 'gpc_billing_123');
  assert.ok(fetchCalls.findIndex((call) => call.url.endsWith('/api/gp/tasks/task_123/pin')) < fetchCalls.length - 1);
  assert.equal(events.states.some((state) => state.gopayHelperTaskId === 'task_123' && state.gopayHelperTaskStatus === 'completed'), true);
  assert.equal(events.logs.some((entry) => entry.message === '步骤 7：GPC 任务状态：等待 WhatsApp OTP'), true);
  assert.equal(events.logs.some((entry) => /whatsapp_otp_wait/.test(entry.message)), false);
  assert.equal(events.completed[0].step, 7);
  assert.equal(events.completed[0].payload.plusCheckoutSource, 'gpc-helper');
  assert.ok(events.sleeps.includes(3000));
});


test('GPC billing auto mode only polls until completed without OTP or PIN submission', async () => {
  const fetchCalls = [];
  let pollCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_auto') {
        pollCount += 1;
        if (pollCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ task_id: 'task_auto', phone_mode: 'auto', status: 'queued', status_text: '排队中', api_waiting_for: '' }),
          };
        }
        if (pollCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ task_id: 'task_auto', phone_mode: 'auto', status: 'active', status_text: '处理中', remote_stage: 'auto_otp_wait', api_waiting_for: 'auto_otp' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_auto', phone_mode: 'auto', status: 'completed', status_text: '充值完成', remote_stage: 'completed', api_waiting_for: '' }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_auto',
    gopayHelperPhoneMode: 'auto',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperApiKey: 'gpc_auto',
  });

  assert.equal(fetchCalls.length, 3);
  assert.equal(fetchCalls.some((call) => /\/api\/gp\/tasks\/task_auto\/(otp|pin)$/.test(call.url)), false);
  assert.equal(events.logs.some((entry) => entry.message === '步骤 7：GPC 任务状态：等待自动 OTP'), true);
  assert.equal(events.logs.some((entry) => /auto_otp_wait/.test(entry.message)), false);
  assert.equal(events.states.some((state) => state.plusManualConfirmationMethod === 'gopay-otp'), false);
  assert.equal(events.states.some((state) => state.gopayHelperTaskId === 'task_auto' && state.gopayHelperPhoneMode === 'auto' && state.gopayHelperTaskStatus === 'completed'), true);
  assert.equal(events.completed[0].step, 7);
  assert.equal(events.completed[0].payload.plusCheckoutSource, 'gpc-helper');
});

test('GPC billing logs checkout order stage in Chinese', async () => {
  let pollCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url) => {
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_stage') {
        pollCount += 1;
        if (pollCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({
              task_id: 'task_stage',
              phone_mode: 'auto',
              status: 'active',
              status_text: '处理中',
              remote_stage: 'checkout_order_start',
              api_waiting_for: '',
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({
            task_id: 'task_stage',
            phone_mode: 'auto',
            status: 'completed',
            status_text: '充值完成',
            remote_stage: 'completed',
            api_waiting_for: '',
          }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_stage',
    gopayHelperPhoneMode: 'auto',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperApiKey: 'gpc_auto',
  });

  assert.equal(events.logs.some((entry) => entry.message === '步骤 7：GPC 任务状态：创建订单'), true);
  assert.equal(events.logs.some((entry) => /checkout_order_start/.test(entry.message)), false);
});

test('GPC billing fails repeated checkout stage as stale so auto-run can recreate task', async () => {
  const originalNow = Date.now;
  let now = 1710000000000;
  const fetchCalls = [];
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    sleepWithStop: async (ms) => {
      events.sleeps.push(ms);
      now += ms;
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_stale') {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({
            task_id: 'task_stale',
            phone_mode: 'auto',
            status: 'active',
            status_text: '处理中',
            remote_stage: 'checkout_order_start',
            api_waiting_for: '',
          }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_stale/stop')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({
            task_id: 'task_stale',
            status: 'discarded',
            status_text: '已停止',
          }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  Date.now = () => now;
  try {
    await assert.rejects(
      () => executor.executePlusCheckoutBilling({
        plusPaymentMethod: 'gpc-helper',
        plusCheckoutSource: 'gpc-helper',
        gopayHelperTaskId: 'task_stale',
        gopayHelperPhoneMode: 'auto',
        gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
        gopayHelperApiKey: 'gpc_auto',
        gopayHelperTaskStaleSeconds: 15,
      }),
      /GPC_TASK_ENDED::GPC 任务状态超过 15 秒无进展（创建订单），请重新创建任务。/
    );
  } finally {
    Date.now = originalNow;
  }

  assert.equal(fetchCalls.some((call) => call.url.endsWith('/api/gp/tasks/task_stale/stop')), true);
  assert.equal(events.logs.some((entry) => entry.message === '步骤 7：GPC 任务状态：创建订单'), true);
});

test('GPC billing reads SMS OTP from local helper for sms_otp_wait', async () => {
  const fetchCalls = [];
  let pollCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.startsWith('http://127.0.0.1:18767/latest-otp')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, otp: '654321', message_id: 'sms-1' }),
        };
      }
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_sms') {
        pollCount += 1;
        if (pollCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ task_id: 'task_sms', status: 'active', remote_stage: 'sms_otp_wait', api_waiting_for: 'otp' }),
          };
        }
        if (pollCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ task_id: 'task_sms', status: 'otp_ready', remote_stage: 'otp_ready', api_waiting_for: 'pin' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_sms', status: 'completed', remote_stage: 'completed' }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_sms/otp')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_sms', status: 'otp_ready', remote_stage: 'otp_ready', api_waiting_for: 'pin' }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_sms/pin')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_sms', status: 'active', remote_stage: 'payment_processing' }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_sms',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperPin: '654321',
    gopayHelperApiKey: 'gpc_sms',
    gopayHelperOtpChannel: 'sms',
    gopayHelperLocalSmsHelperEnabled: true,
    gopayHelperLocalSmsHelperUrl: 'http://127.0.0.1:18767',
    gopayHelperCountryCode: '+86',
    gopayHelperPhoneNumber: '13800138000',
    gopayHelperOrderCreatedAt: 1710000000000,
  });

  assert.equal(events.states.some((state) => state.plusManualConfirmationMethod === 'gopay-otp'), false);
  assert.equal(events.states.some((state) => state.gopayHelperResolvedOtp === '654321'), true);
  const helperUrl = new URL(fetchCalls[1].url);
  assert.equal(helperUrl.origin + helperUrl.pathname, 'http://127.0.0.1:18767/latest-otp');
  assert.equal(helperUrl.searchParams.get('task_id'), 'task_sms');
  assert.equal(helperUrl.searchParams.get('reference_id'), 'task_sms');
  assert.equal(helperUrl.searchParams.get('phone'), '+8613800138000');
  assert.equal(helperUrl.searchParams.get('consume'), '1');
  assert.equal(helperUrl.searchParams.get('after_ms'), '1710000000000');
  assert.deepEqual(JSON.parse(fetchCalls.find((call) => call.url.endsWith('/api/gp/tasks/task_sms/otp')).options.body), {
    otp: '654321',
  });
  assert.equal(events.completed[0].step, 7);
});

test('GPC billing can read WhatsApp OTP from local helper when enabled', async () => {
  const fetchCalls = [];
  let pollCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.startsWith('http://127.0.0.1:18767/latest-otp')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, otp: '765432', message_id: 'wa-1' }),
        };
      }
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_wa') {
        pollCount += 1;
        if (pollCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ task_id: 'task_wa', status: 'active', remote_stage: 'whatsapp_otp_wait', api_waiting_for: 'otp' }),
          };
        }
        if (pollCount === 2) {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({ task_id: 'task_wa', status: 'otp_ready', remote_stage: 'otp_ready', api_waiting_for: 'pin' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_wa', status: 'completed', remote_stage: 'completed' }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_wa/otp')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_wa', status: 'otp_ready', remote_stage: 'otp_ready', api_waiting_for: 'pin' }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_wa/pin')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_wa', status: 'active', remote_stage: 'payment_processing' }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_wa',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperPin: '654321',
    gopayHelperApiKey: 'gpc_wa',
    gopayHelperOtpChannel: 'whatsapp',
    gopayHelperLocalSmsHelperEnabled: true,
    gopayHelperLocalSmsHelperUrl: 'http://127.0.0.1:18767',
    gopayHelperCountryCode: '+86',
    gopayHelperPhoneNumber: '18984829950',
  });

  assert.equal(events.states.some((state) => state.plusManualConfirmationMethod === 'gopay-otp'), false);
  assert.equal(events.states.some((state) => state.gopayHelperResolvedOtp === '765432'), true);
  const helperUrl = new URL(fetchCalls.find((call) => call.url.startsWith('http://127.0.0.1:18767/latest-otp')).url);
  assert.equal(helperUrl.searchParams.get('phone'), '+8618984829950');
  assert.equal(helperUrl.searchParams.get('consume'), '1');
  assert.deepEqual(JSON.parse(fetchCalls.find((call) => call.url.endsWith('/api/gp/tasks/task_wa/otp')).options.body), {
    otp: '765432',
  });
  assert.equal(events.completed[0].step, 7);
});


test('GPC billing helper mode does not open OTP dialog when helper has no code and task times out', async () => {
  const fetchCalls = [];
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.startsWith('http://127.0.0.1:18767/latest-otp')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, status: 'waiting', otp: '', message: '未查询到验证码' }),
        };
      }
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_timeout') {
        const queryCount = fetchCalls.filter((call) => call.url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_timeout').length;
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse(queryCount === 1
            ? {
              task_id: 'task_timeout',
              status: 'active',
              remote_stage: 'whatsapp_otp_wait',
              api_waiting_for: 'otp',
            }
            : {
              task_id: 'task_timeout',
              status: 'failed',
              status_text: '充值失败',
              remote_stage: 'api_otp_timeout',
              error_message: '等待 OTP 超过 60 秒，任务已超时',
            }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling({
      plusPaymentMethod: 'gpc-helper',
      plusCheckoutSource: 'gpc-helper',
      gopayHelperTaskId: 'task_timeout',
      gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
      gopayHelperPin: '654321',
      gopayHelperApiKey: 'gpc_timeout',
      gopayHelperOtpChannel: 'whatsapp',
      gopayHelperLocalSmsHelperEnabled: true,
      gopayHelperLocalSmsHelperUrl: 'http://127.0.0.1:18767',
      gopayHelperPhoneNumber: '+8613800138000',
    }),
    /GPC_TASK_ENDED::等待 OTP 超过 60 秒，任务已超时/
  );

  assert.equal(events.states.some((state) => state.plusManualConfirmationMethod === 'gopay-otp'), false);
  assert.equal(fetchCalls.some((call) => call.url.endsWith('/api/gp/tasks/task_timeout/otp')), false);
  assert.equal(fetchCalls.some((call) => call.url.endsWith('/api/gp/tasks/task_timeout/stop')), false);
  assert.ok(events.sleeps.includes(3000));
});

test('GPC billing helper mode requests newer OTP after invalid OTP error', async () => {
  const fetchCalls = [];
  let taskPollCount = 0;
  let helperCallCount = 0;
  let otpPostCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.startsWith('http://127.0.0.1:18767/latest-otp')) {
        helperCallCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, otp: helperCallCount === 1 ? '111111' : '222222', message_id: `sms-${helperCallCount}` }),
        };
      }
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_retry') {
        taskPollCount += 1;
        if (taskPollCount === 1) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_retry', status: 'active', remote_stage: 'sms_otp_wait', api_waiting_for: 'otp' }) };
        }
        if (taskPollCount === 2) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_retry', status: 'active', remote_stage: 'sms_otp_wait', api_waiting_for: 'otp', last_input_error: 'OTP 校验失败，请重新输入正确的 OTP', otp_invalid_count: 1 }) };
        }
        if (taskPollCount === 3) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_retry', status: 'otp_ready', remote_stage: 'otp_ready', api_waiting_for: 'pin' }) };
        }
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_retry', status: 'completed', remote_stage: 'completed' }) };
      }
      if (url.endsWith('/api/gp/tasks/task_retry/otp')) {
        otpPostCount += 1;
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_retry', status: 'active', remote_stage: 'otp_submitted_local' }) };
      }
      if (url.endsWith('/api/gp/tasks/task_retry/pin')) {
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_retry', status: 'active', remote_stage: 'payment_processing' }) };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_retry',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperPin: '654321',
    gopayHelperApiKey: 'gpc_retry',
    gopayHelperOtpChannel: 'sms',
    gopayHelperLocalSmsHelperEnabled: true,
    gopayHelperLocalSmsHelperUrl: 'http://127.0.0.1:18767',
    gopayHelperPhoneNumber: '+8613800138000',
    gopayHelperOrderCreatedAt: 1710000000000,
  });

  const otpBodies = fetchCalls
    .filter((call) => call.url.endsWith('/api/gp/tasks/task_retry/otp'))
    .map((call) => JSON.parse(call.options.body));
  assert.deepEqual(otpBodies, [{ otp: '111111' }, { otp: '222222' }]);
  assert.equal(otpPostCount, 2);
  const helperUrls = fetchCalls.filter((call) => call.url.startsWith('http://127.0.0.1:18767/latest-otp')).map((call) => new URL(call.url));
  assert.equal(helperUrls.length, 2);
  assert.equal(helperUrls[0].searchParams.get('phone'), '+8613800138000');
  assert.equal(helperUrls[0].searchParams.get('consume'), '1');
  assert.equal(helperUrls[0].searchParams.get('after_ms'), '1710000000000');
  assert.equal(helperUrls[1].searchParams.get('phone'), '+8613800138000');
  assert.equal(helperUrls[1].searchParams.get('consume'), '1');
  assert.ok(Number(helperUrls[1].searchParams.get('after_ms')) > 1710000000000);
  assert.equal(events.logs.some((entry) => /OTP 校验失败/.test(entry.message)), true);
  assert.equal(events.completed[0].step, 7);
});

test('GPC billing manual OTP wrong input opens next dialog only after previous one closes', async () => {
  const fetchCalls = [];
  let currentState = {
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: '',
  };
  let pendingDialogCount = 0;
  let pollCount = 0;
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    getState: async () => currentState,
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_manual_retry') {
        pollCount += 1;
        if (pollCount === 1) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_manual_retry', status: 'active', remote_stage: 'whatsapp_otp_wait', api_waiting_for: 'otp' }) };
        }
        if (pollCount === 2) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_manual_retry', status: 'active', remote_stage: 'whatsapp_otp_wait', api_waiting_for: 'otp', last_input_error: 'OTP 校验失败，请重新输入正确的 OTP', otp_invalid_count: 1 }) };
        }
        if (pollCount === 3) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_manual_retry', status: 'otp_ready', remote_stage: 'otp_ready', api_waiting_for: 'pin' }) };
        }
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_manual_retry', status: 'completed', remote_stage: 'completed' }) };
      }
      if (url.endsWith('/api/gp/tasks/task_manual_retry/otp')) {
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_manual_retry', status: 'active', remote_stage: 'otp_submitted_local' }) };
      }
      if (url.endsWith('/api/gp/tasks/task_manual_retry/pin')) {
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_manual_retry', status: 'active', remote_stage: 'payment_processing' }) };
      }
      throw new Error(`unexpected url: ${url}`);
    },
    onSetState: async (updates) => {
      if (updates?.plusManualConfirmationMethod !== 'gopay-otp') {
        return;
      }
      pendingDialogCount += 1;
      const resolvedOtp = pendingDialogCount === 1 ? '111111' : '222222';
      setTimeout(() => {
        currentState = {
          plusManualConfirmationPending: false,
          plusManualConfirmationRequestId: updates.plusManualConfirmationRequestId,
          gopayHelperResolvedOtp: resolvedOtp,
        };
      }, 0);
    },
  });

  const run = executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_manual_retry',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperPin: '654321',
    gopayHelperApiKey: 'gpc_manual_retry',
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  const firstPending = events.states.find((state) => state.plusManualConfirmationMethod === 'gopay-otp');
  assert.ok(firstPending);
  assert.equal(events.states.filter((state) => state.plusManualConfirmationMethod === 'gopay-otp').length, 1);
  await new Promise((resolve) => setTimeout(resolve, 650));
  const pendingDialogs = events.states.filter((state) => state.plusManualConfirmationMethod === 'gopay-otp');
  assert.equal(pendingDialogs.length, 2);
  assert.notEqual(pendingDialogs[1].plusManualConfirmationRequestId, firstPending.plusManualConfirmationRequestId);
  assert.match(pendingDialogs[1].plusManualConfirmationMessage, /OTP 校验失败/);
  await run;
  const otpBodies = fetchCalls
    .filter((call) => call.url.endsWith('/api/gp/tasks/task_manual_retry/otp'))
    .map((call) => JSON.parse(call.options.body));
  assert.deepEqual(otpBodies, [{ otp: '111111' }, { otp: '222222' }]);
  assert.equal(events.completed[0].step, 7);
});

test('GPC billing manual OTP cancel stops task and ends current round', async () => {
  const fetchCalls = [];
  let currentState = {
    plusManualConfirmationPending: true,
    plusManualConfirmationRequestId: '',
  };
  const { events, executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    getState: async () => currentState,
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_cancel') {
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_cancel', status: 'active', remote_stage: 'whatsapp_otp_wait', api_waiting_for: 'otp' }) };
      }
      if (url.endsWith('/api/gp/tasks/task_cancel/stop')) {
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_cancel', status: 'discarded', status_text: '已停止' }) };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  const run = executor.executePlusCheckoutBilling({
    plusPaymentMethod: 'gpc-helper',
    plusCheckoutSource: 'gpc-helper',
    gopayHelperTaskId: 'task_cancel',
    gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
    gopayHelperPin: '654321',
    gopayHelperApiKey: 'gpc_cancel',
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  const pending = events.states.find((state) => state.plusManualConfirmationMethod === 'gopay-otp');
  assert.ok(pending);
  currentState = {
    plusManualConfirmationPending: false,
    plusManualConfirmationRequestId: pending.plusManualConfirmationRequestId,
    gopayHelperResolvedOtp: '',
  };

  await assert.rejects(run, /GPC_TASK_ENDED::OTP 输入已取消，已结束当前 GPC 任务。/);
  const stopCall = fetchCalls.find((call) => call.url.endsWith('/api/gp/tasks/task_cancel/stop'));
  assert.ok(stopCall);
  assert.equal(stopCall.options.headers['X-API-Key'], 'gpc_cancel');
  assert.equal(events.completed.length, 0);
});

test('GPC billing PIN failure ends task without retrying PIN', async () => {
  const fetchCalls = [];
  let pollCount = 0;
  const { executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_pin_failed') {
        pollCount += 1;
        if (pollCount === 1) {
          return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_pin_failed', status: 'otp_ready', status_text: '等待 PIN', remote_stage: 'otp_ready', api_waiting_for: 'pin' }) };
        }
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_pin_failed', status: 'failed', status_text: '充值失败', remote_stage: 'gopay_validate_pin', failure_stage: 'gopay_validate_pin', failure_detail: 'PIN 校验失败', error_message: 'GoPay PIN validation failed' }) };
      }
      if (url.endsWith('/api/gp/tasks/task_pin_failed/pin')) {
        return { ok: true, status: 200, json: async () => createGpcTaskResponse({ task_id: 'task_pin_failed', status: 'active', remote_stage: 'pin_submitted_local' }) };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling({
      plusPaymentMethod: 'gpc-helper',
      plusCheckoutSource: 'gpc-helper',
      gopayHelperTaskId: 'task_pin_failed',
      gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
      gopayHelperPin: '654321',
      gopayHelperApiKey: 'gpc_pin_failed',
    }),
    /GPC_TASK_ENDED::GoPay PIN validation failed（gopay_validate_pin）/
  );

  assert.equal(fetchCalls.filter((call) => call.url.endsWith('/api/gp/tasks/task_pin_failed/pin')).length, 1);
  assert.equal(fetchCalls.some((call) => call.url.endsWith('/api/gp/tasks/task_pin_failed/stop')), false);
});

for (const terminalStatus of ['failed', 'expired', 'discarded']) {
  test(`GPC billing throws readable error for terminal ${terminalStatus} task`, async () => {
    const fetchCalls = [];
    const { executor } = createExecutorHarness({
      frames: [],
      stateByFrame: {},
      fetchImpl: async (url, options = {}) => {
        fetchCalls.push({ url, options });
        if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_bad') {
          return {
            ok: true,
            status: 200,
            json: async () => createGpcTaskResponse({
              task_id: 'task_bad',
              status: terminalStatus,
              status_text: terminalStatus,
              error_message: '用户可读失败原因',
            }),
          };
        }
        throw new Error(`unexpected url: ${url}`);
      },
    });

    await assert.rejects(
      () => executor.executePlusCheckoutBilling({
        plusPaymentMethod: 'gpc-helper',
        plusCheckoutSource: 'gpc-helper',
        gopayHelperTaskId: 'task_bad',
        gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
        gopayHelperPin: '654321',
        gopayHelperApiKey: 'gpc_bad',
      }),
      /GPC_TASK_ENDED::用户可读失败原因/
    );

    assert.equal(fetchCalls.some((call) => call.url.endsWith('/api/gp/tasks/task_bad/stop')), false);
  });
}

test('GPC billing stops task best-effort when flow is interrupted before terminal state', async () => {
  const fetchCalls = [];
  const { executor } = createExecutorHarness({
    frames: [],
    stateByFrame: {},
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url === 'https://gpc.qlhazycoder.top/api/gp/tasks/task_stop') {
        return {
          ok: false,
          status: 500,
          json: async () => ({ code: 500, message: 'server_error', data: { detail: '临时失败' } }),
        };
      }
      if (url.endsWith('/api/gp/tasks/task_stop/stop')) {
        return {
          ok: true,
          status: 200,
          json: async () => createGpcTaskResponse({ task_id: 'task_stop', status: 'discarded', status_text: '已停止' }),
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  await assert.rejects(
    () => executor.executePlusCheckoutBilling({
      plusPaymentMethod: 'gpc-helper',
      plusCheckoutSource: 'gpc-helper',
      gopayHelperTaskId: 'task_stop',
      gopayHelperApiUrl: 'https://gpc.qlhazycoder.top/',
      gopayHelperPin: '654321',
      gopayHelperApiKey: 'gpc_stop',
    }),
    /临时失败/
  );

  const stopCall = fetchCalls.find((call) => call.url.endsWith('/api/gp/tasks/task_stop/stop'));
  assert.ok(stopCall);
  assert.deepEqual(JSON.parse(stopCall.options.body), {});
  assert.equal(stopCall.options.headers['X-API-Key'], 'gpc_stop');
});
