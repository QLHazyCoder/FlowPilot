const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('sidepanel password inputs expose visibility toggles', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const passwordInputIds = Array.from(
    html.matchAll(/<input\b[^>]*type="password"[^>]*id="([^"]+)"/g),
    (match) => match[1]
  );
  const legacyToggleIds = new Map([
    ['input-vps-url', 'btn-toggle-vps-url'],
    ['input-vps-password', 'btn-toggle-vps-password'],
    ['input-ip-proxy-username', 'btn-toggle-ip-proxy-username'],
    ['input-ip-proxy-password', 'btn-toggle-ip-proxy-password'],
    ['input-ip-proxy-api-url', 'btn-toggle-ip-proxy-api-url'],
    ['input-password', 'btn-toggle-password'],
  ]);

  assert.ok(passwordInputIds.length > 0);
  for (const inputId of passwordInputIds) {
    const hasDataToggle = html.includes(`data-password-toggle="${inputId}"`);
    const legacyToggleId = legacyToggleIds.get(inputId);
    const hasLegacyToggle = legacyToggleId ? html.includes(`id="${legacyToggleId}"`) : false;
    assert.equal(
      hasDataToggle || hasLegacyToggle,
      true,
      `${inputId} should have a visibility toggle button`
    );
  }
});

test('shared form dialog adds visibility toggles for password fields', () => {
  const source = fs.readFileSync('sidepanel/form-dialog.js', 'utf8');

  assert.match(source, /field\.type === 'password' \|\| field\.masked === true/);
  assert.match(source, /shouldMaskInput[\s\S]*data-input-with-icon/);
  assert.match(source, /syncPasswordToggleButton\(toggleButton,\s*input,\s*labels\)/);
  assert.match(source, /input\.type = input\.type === 'password' \? 'text' : 'password'/);
});

test('sidepanel masks video-sensitive settings with reusable visibility controls', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  [
    'input-sub2api-url',
    'input-sub2api-email',
    'input-codex2api-url',
    'input-kiro-rs-url',
    'input-email',
    'input-hotmail-email',
    'input-mail2925-email',
    'input-ip-proxy-host',
    'input-signup-phone',
  ].forEach((inputId) => {
    assert.match(source, new RegExp(`'${inputId}'`));
  });

  assert.match(source, /function installPrivacyMaskControls/);
  assert.match(source, /installPrivacyMaskControls\(\);\s*bindPasswordVisibilityToggles\(\);/);
});

test('sidepanel masks bulk text areas with an eye toggle', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
  const css = fs.readFileSync('sidepanel/sidepanel.css', 'utf8');

  [
    'input-custom-mail-provider-pool',
    'input-custom-email-pool-import',
    'input-hotmail-import',
    'input-mail2925-import',
    'input-ip-proxy-account-list',
  ].forEach((textareaId) => {
    assert.match(source, new RegExp(`'${textareaId}'`));
  });

  assert.match(source, /data-privacy-textarea-toggle/);
  assert.match(css, /-webkit-text-security:\s*disc/);
});
