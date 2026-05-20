const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');
const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map((marker) => source.indexOf(marker)).find((index) => index >= 0);
  if (start < 0) throw new Error(`missing function ${name}`);

  let parenDepth = 0;
  let signatureEnded = false;
  let braceStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) signatureEnded = true;
    } else if (ch === '{' && signatureEnded) {
      braceStart = i;
      break;
    }
  }

  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end += 1;
        break;
      }
    }
  }
  return source.slice(start, end);
}

test('sidepanel exposes yahoo provider and generator options', () => {
  assert.match(html, /<option value="yahoo">Yahoo 邮箱 \(mail\.yahoo\.com\) 请把默认邮箱页面设置为ALL<\/option>/);
  assert.match(html, /<option value="yahoo">Yahoo 临时邮箱<\/option>/);
  assert.match(html, /<script src="\.\.\/yahoo-utils\.js"><\/script>/);
});

test('getSelectedEmailGenerator returns yahoo', () => {
  const bundle = extractFunction('getSelectedEmailGenerator');
  const api = new Function(`
const selectEmailGenerator = { value: 'yahoo' };
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const YAHOO_GENERATOR = 'yahoo';
${bundle}
return { getSelectedEmailGenerator };
`)();

  assert.equal(api.getSelectedEmailGenerator(), 'yahoo');
});

test('getEmailGeneratorUiCopy returns yahoo copy', () => {
  const bundle = extractFunction('getEmailGeneratorUiCopy');
  const api = new Function(`
const GMAIL_ALIAS_GENERATOR = 'gmail-alias';
const CUSTOM_EMAIL_POOL_GENERATOR = 'custom-pool';
const YAHOO_GENERATOR = 'yahoo';
function getSelectedEmailGenerator() { return 'yahoo'; }
function getCustomMailProviderUiCopy() { return null; }
${bundle}
return { getEmailGeneratorUiCopy };
`)();

  assert.deepEqual(api.getEmailGeneratorUiCopy(), {
    buttonLabel: '创建别名',
    placeholder: '点击创建 Yahoo 临时邮箱，或手动粘贴邮箱',
    successVerb: '创建',
    label: 'Yahoo 临时邮箱',
  });
});

test('sidepanel contains yahoo login config and hint copy', () => {
  assert.match(source, /\[YAHOO_PROVIDER\]: \{\s*label: 'Yahoo 邮箱',\s*url: 'https:\/\/mail\.yahoo\.com\/n\/inbox\/priority'/);
  assert.match(source, /Yahoo 需要先手动登录/);
  assert.match(source, /type: 'OPEN_MAIL_PROVIDER_LOGIN'/);
  assert.match(source, /provider: selectMailProvider\?\.value \|\| latestState\?\.mailProvider/);
});

test('sidepanel shows yahoo mailbox credential rows in the mail provider block', () => {
  assert.match(html, /id="row-yahoo-mail-email"/);
  assert.match(html, /id="input-yahoo-mail-email"/);
  assert.match(html, /id="row-yahoo-mail-password"/);
  assert.match(html, /id="input-yahoo-mail-password"/);
  assert.match(source, /yahooMailEmail: inputYahooMailEmail\?\.value\.trim\(\) \|\| ''/);
  assert.match(source, /yahooMailPassword: inputYahooMailPassword\?\.value \|\| ''/);
  assert.match(source, /rowYahooMailEmail\.style\.display = \(useYahooProvider \|\| selectedGenerator === yahooGenerator\) \? '' : 'none';/);
});
