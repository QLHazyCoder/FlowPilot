const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { readSourceRegistryBundle } = require('./helpers/script-bundles.js');

function loadSourceRegistry() {
  const globalScope = {};
  new Function('self', `${readSourceRegistryBundle()}; return self;`)(globalScope);
  return globalScope.MultiPageSourceRegistry.createSourceRegistry();
}

test('background imports shared source registry module', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(source, /core\/flow-kernel\/flow-registry\.js/);
  assert.match(source, /core\/flow-kernel\/settings-schema\.js/);
  assert.match(source, /core\/flow-kernel\/source-registry\.js/);
  assert.match(source, /shared\/kiro-timeouts\.js/);
});

test('manifest loads shared source registry before content utils in static bundles', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  for (const entry of manifest.content_scripts || []) {
    const scripts = Array.isArray(entry.js) ? entry.js : [];
    if (!scripts.includes('content/utils.js')) continue;
    assert.ok(scripts.includes('core/flow-kernel/source-registry.js'));
    assert.ok(
      scripts.indexOf('core/flow-kernel/source-registry.js') < scripts.indexOf('content/utils.js'),
      'core/flow-kernel/source-registry.js must load before content/utils.js'
    );
  }
});

test('manifest no longer ships a static Kiro content bundle', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const hasStaticKiroBundle = (manifest.content_scripts || []).some((entry) => {
    const scripts = Array.isArray(entry.js) ? entry.js : [];
    return scripts.includes('flows/kiro/content/register-page.js')
      || scripts.includes('flows/kiro/content/desktop-authorize-page.js');
  });

  assert.equal(hasStaticKiroBundle, false);
});

test('background injects shared Kiro timeout module before Kiro content scripts', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(
    source,
    /const KIRO_REGISTER_INJECT_FILES = \['flows\/openai\/index\.js', 'flows\/kiro\/index\.js', 'flows\/grok\/index\.js', 'flows\/index\.js', 'core\/flow-kernel\/flow-registry\.js', 'core\/flow-kernel\/source-registry\.js', 'shared\/kiro-timeouts\.js', 'content\/utils\.js', 'flows\/kiro\/content\/register-page\.js'\];/
  );
  assert.match(
    source,
    /const KIRO_DESKTOP_AUTHORIZE_INJECT_FILES = \['flows\/openai\/index\.js', 'flows\/kiro\/index\.js', 'flows\/grok\/index\.js', 'flows\/index\.js', 'core\/flow-kernel\/flow-registry\.js', 'core\/flow-kernel\/source-registry\.js', 'shared\/kiro-timeouts\.js', 'content\/utils\.js', 'flows\/kiro\/content\/desktop-authorize-page\.js'\];/
  );
});

test('background injects canonical Grok content bundle', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  assert.match(
    source,
    /const GROK_REGISTER_INJECT_FILES = \['flows\/openai\/index\.js', 'flows\/kiro\/index\.js', 'flows\/grok\/index\.js', 'flows\/index\.js', 'core\/flow-kernel\/flow-registry\.js', 'core\/flow-kernel\/source-registry\.js', 'content\/utils\.js', 'flows\/grok\/content\/register-page\.js'\];/
  );
});

test('shared source registry exposes canonical Kiro sources and drivers', () => {
  const registry = loadSourceRegistry();

  assert.equal(registry.resolveCanonicalSource('openai-auth'), 'openai-auth');
  assert.deepEqual(registry.getSourceKeys('openai-auth'), ['openai-auth']);
  assert.equal(registry.resolveCanonicalSource('signup-page'), 'signup-page');
  assert.equal(registry.getSourceLabel('openai-auth'), '认证页');

  assert.equal(
    registry.detectSourceFromLocation({
      url: 'https://auth.openai.com/create-account',
      hostname: 'auth.openai.com',
    }),
    'openai-auth'
  );
  assert.equal(
    registry.detectSourceFromLocation({
      url: 'https://app.kiro.dev/signin',
      hostname: 'app.kiro.dev',
    }),
    'kiro-register-page'
  );
  assert.equal(
    registry.detectSourceFromLocation({
      injectedSource: 'kiro-desktop-authorize',
      url: 'https://signin.aws/register',
      hostname: 'signin.aws',
    }),
    'kiro-desktop-authorize'
  );
  assert.equal(
    registry.detectSourceFromLocation({
      url: 'https://accounts.x.ai/sign-up?redirect=grok-com',
      hostname: 'accounts.x.ai',
    }),
    'grok-register-page'
  );
  assert.equal(
    registry.detectSourceFromLocation({
      url: 'https://example.com/',
      hostname: 'example.com',
    }),
    'unknown-source'
  );

  assert.equal(
    registry.matchesSourceUrlFamily(
      'kiro-register-page',
      'https://app.kiro.dev/signin',
      'https://app.kiro.dev/signin'
    ),
    true
  );
  assert.equal(
    registry.matchesSourceUrlFamily(
      'kiro-register-page',
      'https://signin.aws/register',
      'https://app.kiro.dev/signin'
    ),
    true
  );
  assert.equal(
    registry.matchesSourceUrlFamily(
      'kiro-desktop-authorize',
      'https://profile.aws/complete',
      'https://signin.aws/register'
    ),
    true
  );
  assert.equal(
    registry.matchesSourceUrlFamily(
      'kiro-desktop-authorize',
      'https://oidc.us-east-1.amazonaws.com/authorize',
      'https://view.awsapps.com/start'
    ),
    true
  );

  assert.equal(
    registry.matchesSourceUrlFamily(
      'grok-register-page',
      'https://grok.com/',
      'https://accounts.x.ai/sign-up'
    ),
    true
  );

  assert.equal(registry.shouldReportReadyForFrame('mail-163', true), false);
  assert.equal(registry.shouldReportReadyForFrame('kiro-register-page', true), false);
  assert.equal(registry.shouldReportReadyForFrame('kiro-desktop-authorize', true), false);
  assert.equal(registry.getCleanupOwnerSource('oauth-localhost-callback'), 'openai-auth');

  assert.equal(registry.driverAcceptsCommand('openai-auth', 'submit-signup-email'), true);
  assert.equal(registry.driverAcceptsCommand('content/platform-panel', 'platform-verify'), true);
  assert.equal(registry.driverAcceptsCommand('openai-auth', 'platform-verify'), false);
  assert.equal(registry.driverAcceptsCommand('flows/kiro/content/register-page', 'kiro-submit-password'), true);
  assert.equal(registry.driverAcceptsCommand('flows/kiro/content/desktop-authorize-page', 'kiro-complete-desktop-authorize'), true);
  assert.equal(registry.driverAcceptsCommand('flows/kiro/background/register-runner', 'kiro-open-register-page'), true);
  assert.equal(registry.driverAcceptsCommand('flows/kiro/background/desktop-authorize-runner', 'kiro-start-desktop-authorize'), true);
  assert.equal(registry.driverAcceptsCommand('flows/kiro/background/publisher-kiro-rs', 'kiro-upload-credential'), true);
});
