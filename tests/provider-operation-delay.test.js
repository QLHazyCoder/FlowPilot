const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Duck address generation routes the generator click through operation delay', () => {
  const source = fs.readFileSync('content/duck-mail.js', 'utf8');
  assert.match(source, /performOperationWithDelay\([\s\S]*duck-generate-address/);
});

test('2925 session preparation routes through operation delay while cleanup stays delay-free', () => {
  const source = fs.readFileSync('content/mail-2925.js', 'utf8');
  assert.match(source, /ENSURE_MAIL2925_SESSION[\s\S]*performOperationWithDelay/);
  const deleteAllStart = source.indexOf("message.type === 'DELETE_ALL_EMAILS'");
  assert.notEqual(deleteAllStart, -1, 'missing DELETE_ALL_EMAILS handler');
  const deleteAllBlock = source.slice(deleteAllStart, source.indexOf('return false;', deleteAllStart));
  assert.doesNotMatch(deleteAllBlock, /performOperationWithDelay\(/);
});
