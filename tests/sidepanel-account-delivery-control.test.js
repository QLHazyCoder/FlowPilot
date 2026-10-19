const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const CONTROL_PATH = 'sidepanel/account-delivery-control.js';

function createAccountDeliveryApi() {
  const definitions = {
    oauth: {
      id: 'oauth',
      label: 'Metadata OAuth',
      description: 'OAuth description from metadata',
    },
    session: {
      id: 'session',
      label: 'Metadata Session',
      description: 'Session description from metadata',
    },
    agent_identity: {
      id: 'agent_identity',
      label: 'Metadata Agent Identity',
      description: 'Agent Identity description from metadata',
    },
  };

  return {
    getAccountDeliveryModeDefinition(modeId) {
      return definitions[String(modeId || '').trim()] || null;
    },
    getAccountDeliveryModeOptions(modeIds = []) {
      return modeIds.map((modeId) => definitions[modeId]).filter(Boolean);
    },
    normalizeAccountDeliveryMode(modeId, fallback = 'oauth') {
      return definitions[modeId]?.id || definitions[fallback]?.id || 'oauth';
    },
  };
}

function loadControlApi() {
  assert.equal(
    fs.existsSync(CONTROL_PATH),
    true,
    `${CONTROL_PATH} should expose the account delivery control`
  );
  const source = fs.readFileSync(CONTROL_PATH, 'utf8');
  const windowObject = {
    MultiPageOpenAiAccountDelivery: createAccountDeliveryApi(),
  };
  new Function('window', source)(windowObject);
  return windowObject.SidepanelAccountDeliveryControl;
}

function createHarness(onChange = () => {}) {
  const listeners = new Map();
  const row = {
    style: {
      display: 'none',
    },
  };
  const select = {
    attributes: {},
    disabled: false,
    options: [],
    ownerDocument: {
      createElement(tagName) {
        return {
          tagName: String(tagName || '').toUpperCase(),
          textContent: '',
          value: '',
        };
      },
    },
    value: '',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) {
        listeners.delete(type);
      }
    },
    replaceChildren(...children) {
      this.options = children;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    dispatchChange(value) {
      this.value = value;
      listeners.get('change')?.({
        currentTarget: this,
        target: this,
      });
    },
  };
  const caption = {
    textContent: '',
  };
  const api = loadControlApi();
  const control = api.createAccountDeliveryControl({
    row,
    select,
    caption,
    onChange,
  });

  return {
    caption,
    control,
    row,
    select,
  };
}

function createCapabilityState(overrides = {}) {
  return {
    availableAccountDeliveryModes: ['oauth', 'session'],
    canEditAccountDeliveryMode: true,
    canShowAccountDeliveryControl: true,
    effectiveAccountDeliveryMode: 'session',
    effectiveTargetId: 'cpa',
    ...overrides,
  };
}

test('account delivery control renders capability options through shared metadata', () => {
  const { caption, control, row, select } = createHarness();

  control.render(createCapabilityState());

  assert.equal(row.style.display, '');
  assert.deepEqual(
    select.options.map((option) => [option.value, option.textContent]),
    [
      ['oauth', 'Metadata OAuth'],
      ['session', 'Metadata Session'],
    ]
  );
  assert.equal(select.value, 'session');
  assert.equal(select.disabled, false);
  assert.equal(select.attributes['aria-disabled'], 'false');
  assert.equal(caption.textContent, 'Session description from metadata');
});

test('account delivery control hides targets with only one delivery mode', () => {
  const { control, row, select } = createHarness();

  control.render(createCapabilityState({
    availableAccountDeliveryModes: ['oauth'],
    canEditAccountDeliveryMode: false,
    canShowAccountDeliveryControl: false,
    effectiveAccountDeliveryMode: 'oauth',
    effectiveTargetId: 'webchat',
  }));

  assert.equal(row.style.display, 'none');
  assert.equal(select.disabled, true);
  assert.deepEqual(select.options.map((option) => option.value), ['oauth']);
});

test('account delivery control remains visible but disabled while settings are locked', () => {
  const { control, row, select } = createHarness();

  control.render(createCapabilityState({
    canEditAccountDeliveryMode: false,
  }));

  assert.equal(row.style.display, '');
  assert.equal(select.disabled, true);
  assert.equal(select.attributes['aria-disabled'], 'true');
});

test('account delivery control hides unavailable delivery capability', () => {
  const { control, row, select } = createHarness();

  control.render(createCapabilityState({
    availableAccountDeliveryModes: ['oauth'],
    canEditAccountDeliveryMode: false,
    canShowAccountDeliveryControl: false,
    effectiveAccountDeliveryMode: 'oauth',
    runtimeLocks: {
      settingsMenuLocked: true,
    },
  }));

  assert.equal(row.style.display, 'none');
  assert.equal(select.disabled, true);
});

test('account delivery change payload keeps the target rendered when the event fired', () => {
  const changes = [];
  const { control, select } = createHarness((change) => {
    changes.push(change);
  });

  control.render(createCapabilityState({
    effectiveTargetId: 'cpa',
  }));
  select.dispatchChange('session');
  control.render(createCapabilityState({
    availableAccountDeliveryModes: ['oauth', 'session', 'agent_identity'],
    effectiveAccountDeliveryMode: 'agent_identity',
    effectiveTargetId: 'sub2api',
  }));
  select.dispatchChange('agent_identity');

  assert.deepEqual(changes, [
    {
      accountDeliveryMode: 'session',
      targetId: 'cpa',
    },
    {
      accountDeliveryMode: 'agent_identity',
      targetId: 'sub2api',
    },
  ]);

  control.destroy();
  select.dispatchChange('oauth');
  assert.equal(changes.length, 2);
});
