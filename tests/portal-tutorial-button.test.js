const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('sidepanel html keeps a single portal tutorial button in header', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');
  const matches = html.match(/id="btn-portal-tutorial"/g) || [];
  const headerEndIndex = html.indexOf('</header>');
  const adBarIndex = html.indexOf('id="auto-run-ad-bar"');
  const portalLayerIndex = html.indexOf('id="portal-update-layer"');
  const serviceIndex = html.indexOf('<script src="portal-content-update-service.js"></script>');
  const sidepanelIndex = html.indexOf('<script src="sidepanel.js"></script>');

  assert.equal(matches.length, 1);
  assert.match(html, /id="btn-portal-tutorial"[^>]*title="打开官网使用教程"/);
  assert.match(html, />使用教程<\/button>/);
  assert.notEqual(headerEndIndex, -1);
  assert.notEqual(adBarIndex, -1);
  assert.notEqual(portalLayerIndex, -1);
  assert.ok(headerEndIndex < adBarIndex);
  assert.ok(adBarIndex < portalLayerIndex);
  assert.match(html, /id="portal-update-layer"/);
  assert.match(html, /id="portal-update-hint"/);
  assert.match(html, /id="portal-update-hint-text"/);
  assert.match(html, /id="btn-dismiss-portal-update-hint"/);
  assert.notEqual(serviceIndex, -1);
  assert.notEqual(sidepanelIndex, -1);
  assert.ok(serviceIndex < sidepanelIndex);
});

test('sidepanel source opens the portal tutorial without account contribution actions', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  assert.match(source, /btnPortalTutorial\?\.addEventListener\('click'/);
  assert.match(source, /openExternalUrl\(getPortalTutorialUrl\(\)\)/);
  assert.doesNotMatch(source, /openContributionUploadPage/);
  assert.doesNotMatch(source, /SET_ACCOUNT_CONTRIBUTION_MODE/);
});
