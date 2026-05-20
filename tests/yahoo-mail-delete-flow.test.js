const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('content/yahoo-mail.js', 'utf8');

test('yahoo alias delete flow still exists for disposable alias management', () => {
  assert.match(source, /function clickDeleteForAliasItem\(/);
  assert.match(source, /const beforeCount = aliases\.length/);
  assert.match(source, /currentAliases\.length < beforeCount/);
});

test('yahoo verification flow no longer deletes inbox mails', () => {
  assert.doesNotMatch(source, /async function deleteMailRow\(/);
  assert.doesNotMatch(source, /async function deleteOldVerificationRows\(/);
  assert.doesNotMatch(source, /删除已排除验证码/);
});
