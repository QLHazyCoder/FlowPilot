const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function assertOrdered(list, before, after) {
  assert.ok(list.includes(before), `missing ${before}`);
  assert.ok(list.includes(after), `missing ${after}`);
  assert.ok(list.indexOf(before) < list.indexOf(after), `${before} must load before ${after}`);
}

test('manifest loads operation delay after utils only for covered auth/provider bundles', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const authBundle = manifest.content_scripts.find((entry) => entry.js.includes('content/signup-page.js')).js;
  assertOrdered(authBundle, 'content/utils.js', 'content/operation-delay.js');
  assertOrdered(authBundle, 'content/operation-delay.js', 'content/auth-page-recovery.js');
  assertOrdered(authBundle, 'content/operation-delay.js', 'content/signup-page.js');

  const duckBundle = manifest.content_scripts.find((entry) => entry.js.includes('content/duck-mail.js')).js;
  assertOrdered(duckBundle, 'content/utils.js', 'content/operation-delay.js');
  assertOrdered(duckBundle, 'content/operation-delay.js', 'content/duck-mail.js');

  for (const pollingFile of ['content/qq-mail.js', 'content/mail-163.js', 'content/icloud-mail.js']) {
    const bundle = manifest.content_scripts.find((entry) => entry.js.includes(pollingFile))?.js || [];
    assert.equal(bundle.includes('content/operation-delay.js'), false, `${pollingFile} polling bundle must not load operation delay`);
  }
});

test('dynamic covered injections load operation delay after utils', () => {
  const expectations = [
    ['background.js', 'SIGNUP_PAGE_INJECT_FILES'],
    ['background/steps/create-plus-checkout.js', 'PLUS_CHECKOUT_INJECT_FILES'],
    ['background/steps/fill-plus-checkout.js', 'PLUS_CHECKOUT_INJECT_FILES'],
    ['background/steps/paypal-approve.js', 'PAYPAL_INJECT_FILES'],
    ['background/steps/gopay-approve.js', 'GOPAY_INJECT_FILES'],
    ['background/mail-2925-session.js', 'MAIL2925_INJECT'],
  ];
  for (const [file, constantName] of expectations) {
    const source = fs.readFileSync(file, 'utf8');
    const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*\\[([^\\]]+)\\]`));
    assert.ok(match, `missing ${constantName} in ${file}`);
    const block = match[1];
    assert.match(block, /'content\/utils\.js'[\s\S]*'content\/operation-delay\.js'/, `${file} must inject operation delay after utils`);
    if (constantName === 'SIGNUP_PAGE_INJECT_FILES') {
      assert.match(block, /'content\/operation-delay\.js'[\s\S]*'content\/auth-page-recovery\.js'/, 'auth recovery must load after operation delay');
    }
  }
});

test('2925 provider reuse path also injects operation delay', () => {
  const source = fs.readFileSync('background.js', 'utf8');
  const start = source.indexOf("if (provider === '2925')");
  assert.notEqual(start, -1, 'missing 2925 provider config');
  const end = source.indexOf("return { source: 'qq-mail'", start);
  const block = source.slice(start, end);
  assert.match(block, /inject:\s*\[[\s\S]*'content\/utils\.js'[\s\S]*'content\/operation-delay\.js'[\s\S]*'content\/mail-2925\.js'[\s\S]*\]/);
});

test('excluded platform verification paths do not load operation delay', () => {
  for (const file of ['background/steps/platform-verify.js', 'background/panel-bridge.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /content\/operation-delay\.js/);
  }
});
