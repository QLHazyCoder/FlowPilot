const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('shared/source-registry.js', 'utf8');

function loadRegistry() {
  const globalScope = {};
  const api = new Function('self', `${source}; return self.MultiPageSourceRegistry;`)(globalScope);
  return api.createSourceRegistry();
}

test('source registry detects yahoo mail source and driver commands', () => {
  const registry = loadRegistry();
  assert.equal(registry.detectSourceFromLocation({
    url: 'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX',
    hostname: 'mail.yahoo.com',
  }), 'yahoo-mail');
  assert.equal(registry.driverAcceptsCommand('yahoo-mail', 'YAHOO_CHECK_TOP_MESSAGE'), true);
  assert.equal(registry.driverAcceptsCommand('yahoo-mail', 'YAHOO_CREATE_TEMP_ALIAS'), true);
  assert.equal(registry.driverAcceptsCommand('yahoo-mail', 'YAHOO_LOGIN_WITH_CREDENTIALS'), true);
});

test('source registry matches yahoo mail url family and blocks child-frame ready reports', () => {
  const registry = loadRegistry();
  assert.equal(registry.matchesSourceUrlFamily(
    'yahoo-mail',
    'https://mail.yahoo.com/n/inbox/all?listFilter=ALL_INBOX',
    ''
  ), true);
  assert.equal(registry.matchesSourceUrlFamily('yahoo-mail', 'https://login.yahoo.com/account/challenge/password', ''), true);
  assert.equal(registry.detectSourceFromLocation({
    url: 'https://guce.yahoo.com/consent',
    hostname: 'guce.yahoo.com',
  }), 'yahoo-mail');
  assert.equal(registry.shouldReportReadyForFrame('yahoo-mail', true), false);
});
