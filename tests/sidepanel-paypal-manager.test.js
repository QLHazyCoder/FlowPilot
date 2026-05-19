const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('sidepanel loads reusable form dialog and paypal manager before sidepanel bootstrap', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const formDialogIndex = html.indexOf('<script src="form-dialog.js"></script>');
  const editableListPickerIndex = html.indexOf('<script src="editable-list-picker.js"></script>');
  const managerIndex = html.indexOf('<script src="paypal-manager.js"></script>');
  const sidepanelIndex = html.indexOf('<script src="sidepanel.js"></script>');

  assert.notEqual(formDialogIndex, -1);
  assert.notEqual(editableListPickerIndex, -1);
  assert.notEqual(managerIndex, -1);
  assert.notEqual(sidepanelIndex, -1);
  assert.ok(formDialogIndex < editableListPickerIndex);
  assert.ok(editableListPickerIndex < managerIndex);
  assert.ok(managerIndex < sidepanelIndex);
});

test('sidepanel html contains paypal select and GoPay controls', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const plusAccountAccessStrategyIndex = html.indexOf('id="row-plus-account-access-strategy"');
  const plusPaymentMethodIndex = html.indexOf('id="row-plus-payment-method"');

  assert.match(html, /id="row-plus-payment-method"/);
  assert.match(html, /id="row-plus-account-access-strategy"/);
  assert.notEqual(plusAccountAccessStrategyIndex, -1);
  assert.notEqual(plusPaymentMethodIndex, -1);
  assert.ok(plusAccountAccessStrategyIndex < plusPaymentMethodIndex);
  assert.match(html, /id="select-plus-payment-method"/);
  assert.match(html, /id="row-paypal-account"/);
  assert.match(html, /id="select-paypal-account"/);
  assert.match(html, /id="paypal-account-picker"/);
  assert.match(html, /id="btn-paypal-account-menu"/);
  assert.match(html, /id="paypal-account-menu"/);
  assert.match(html, /id="btn-add-paypal-account"/);
  assert.match(html, /id="row-gopay-phone"/);
  assert.match(html, /id="input-gopay-phone"/);
  assert.match(html, /id="row-gopay-otp"/);
  assert.match(html, /id="input-gopay-otp"/);
  assert.match(html, /id="row-gopay-pin"/);
  assert.match(html, /id="input-gopay-pin"/);
  assert.match(html, /id="shared-form-modal"/);
});

test('paypal account dialog masks the login account field for recording', () => {
  const source = fs.readFileSync('sidepanel/paypal-manager.js', 'utf8');

  assert.match(source, /label:\s*'PayPal 账号'[\s\S]*masked:\s*true/);
  assert.match(source, /showPasswordLabel:\s*'显示 PayPal 账号'/);
  assert.match(source, /hidePasswordLabel:\s*'隐藏 PayPal 账号'/);
});

test('paypal manager saves a paypal account and selects it immediately', async () => {
  const source = fs.readFileSync('sidepanel/paypal-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelPayPalManager;`)(windowObject);

  let latestState = {
    paypalAccounts: [],
    currentPayPalAccountId: null,
    paypalEmail: '',
    paypalPassword: '',
  };
  const events = [];
  const clickHandlers = {};
  const changeHandlers = {};
  const selectNode = {
    innerHTML: '',
    value: '',
    disabled: false,
    addEventListener(type, handler) {
      changeHandlers[type] = handler;
    },
  };
  const addButton = {
    disabled: false,
    addEventListener(type, handler) {
      clickHandlers[type] = handler;
    },
  };

  const manager = api.createPayPalManager({
    state: {
      getLatestState: () => latestState,
      syncLatestState(updates) {
        latestState = { ...latestState, ...updates };
      },
    },
    dom: {
      btnAddPayPalAccount: addButton,
      selectPayPalAccount: selectNode,
    },
    helpers: {
      escapeHtml: (value) => String(value || ''),
      getPayPalAccounts: (state) => Array.isArray(state?.paypalAccounts) ? state.paypalAccounts : [],
      openFormDialog: async () => ({ email: 'user@example.com', password: 'secret' }),
      showToast(message, tone) {
        events.push({ type: 'toast', message, tone });
      },
    },
    runtime: {
      sendMessage: async (message) => {
        events.push({ type: 'message', message });
        if (message.type === 'UPSERT_PAYPAL_ACCOUNT') {
          return {
            ok: true,
            account: {
              id: 'pp-1',
              email: 'user@example.com',
              password: 'secret',
            },
          };
        }
        if (message.type === 'SELECT_PAYPAL_ACCOUNT') {
          return {
            ok: true,
            account: {
              id: 'pp-1',
              email: 'user@example.com',
              password: 'secret',
            },
          };
        }
        throw new Error(`unexpected message ${message.type}`);
      },
    },
    paypalUtils: {
      upsertPayPalAccountInList(accounts, nextAccount) {
        const list = Array.isArray(accounts) ? accounts.slice() : [];
        const existingIndex = list.findIndex((account) => account.id === nextAccount.id);
        if (existingIndex >= 0) {
          list[existingIndex] = nextAccount;
          return list;
        }
        list.push(nextAccount);
        return list;
      },
    },
  });

  manager.bindPayPalEvents();
  manager.renderPayPalAccounts();

  assert.match(selectNode.innerHTML, /请先添加 PayPal 账号/);
  clickHandlers.click();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepStrictEqual(
    events.filter((event) => event.type === 'message').map((event) => event.message.type),
    ['UPSERT_PAYPAL_ACCOUNT', 'SELECT_PAYPAL_ACCOUNT']
  );
  assert.equal(latestState.currentPayPalAccountId, 'pp-1');
  assert.equal(latestState.paypalEmail, 'user@example.com');
  assert.equal(latestState.paypalPassword, 'secret');
  assert.equal(selectNode.value, 'pp-1');
  assert.equal(selectNode.disabled, false);
  assert.match(events.at(-1)?.message || '', /已保存 PayPal 账号/);
});

test('paypal manager uses editable picker and deletes obsolete account', async () => {
  const source = fs.readFileSync('sidepanel/paypal-manager.js', 'utf8');
  const windowObject = {};
  const api = new Function('window', `${source}; return window.SidepanelPayPalManager;`)(windowObject);

  let latestState = {
    paypalAccounts: [
      { id: 'pp-1', email: 'old@example.com', password: 'old-secret' },
      { id: 'pp-2', email: 'next@example.com', password: 'next-secret' },
    ],
    currentPayPalAccountId: 'pp-1',
    paypalEmail: 'old@example.com',
    paypalPassword: 'old-secret',
  };
  const events = [];
  const renderCalls = [];
  let pickerConfig = null;
  const selectNode = {
    value: '',
    addEventListener() {},
  };

  const manager = api.createPayPalManager({
    state: {
      getLatestState: () => latestState,
      syncLatestState(updates) {
        latestState = { ...latestState, ...updates };
      },
    },
    dom: {
      btnAddPayPalAccount: { disabled: false, addEventListener() {} },
      btnPayPalAccountMenu: {},
      payPalAccountCurrent: {},
      payPalAccountMenu: {},
      payPalAccountPickerRoot: {},
      selectPayPalAccount: selectNode,
    },
    helpers: {
      editableListPicker: {
        createEditableListPicker(config) {
          pickerConfig = config;
          return {
            render(items, selectedValue) {
              renderCalls.push({ items, selectedValue });
              selectNode.value = selectedValue;
            },
          };
        },
      },
      escapeHtml: (value) => String(value || ''),
      getPayPalAccounts: (state) => Array.isArray(state?.paypalAccounts) ? state.paypalAccounts : [],
      openFormDialog: async () => null,
      showToast(message, tone) {
        events.push({ type: 'toast', message, tone });
      },
    },
    runtime: {
      sendMessage: async (message) => {
        events.push({ type: 'message', message });
        if (message.type === 'SAVE_SETTING') {
          return { ok: true };
        }
        throw new Error(`unexpected message ${message.type}`);
      },
    },
  });

  manager.renderPayPalAccounts();
  assert.equal(renderCalls.at(-1).selectedValue, 'pp-1');
  assert.equal(pickerConfig.getItemLabel(latestState.paypalAccounts[0]), 'old@example.com');

  await pickerConfig.onDelete('pp-1');

  const saveMessage = events.find((event) => event.type === 'message')?.message;
  assert.equal(saveMessage.type, 'SAVE_SETTING');
  assert.deepEqual(
    saveMessage.payload.paypalAccounts.map((account) => account.id),
    ['pp-2']
  );
  assert.equal(saveMessage.payload.currentPayPalAccountId, 'pp-2');
  assert.equal(latestState.currentPayPalAccountId, 'pp-2');
  assert.equal(latestState.paypalEmail, 'next@example.com');
  assert.match(events.at(-1)?.message || '', /已删除 PayPal 账号：old@example\.com/);
});
