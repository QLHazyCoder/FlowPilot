const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function extractPollEmailHandler(source) {
  const start = source.indexOf("message.type === 'POLL_EMAIL'");
  assert.notEqual(start, -1, 'missing POLL_EMAIL handler');
  const nextHandler = source.indexOf("message.type === '", start + 1);
  return nextHandler === -1 ? source.slice(start) : source.slice(start, nextHandler);
}

function extractFunction(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map((marker) => source.indexOf(marker)).find((index) => index >= 0);
  assert.notEqual(start, -1, `missing function ${name}`);
  let signatureDepth = 0;
  let signatureEnded = false;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') signatureDepth += 1;
    if (ch === ')') {
      signatureDepth -= 1;
      if (signatureDepth === 0) signatureEnded = true;
    }
    if (ch === '{' && signatureEnded) {
      bodyStart = i;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `missing body for ${name}`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated function ${name}`);
}

test('mail polling handlers and cleanup handlers are not wrapped by operation delay', () => {
  const protectedFunctions = {
    'content/mail-163.js': ['handlePollEmail', 'returnToInbox', 'openMailAndGetMessageText', 'deleteEmail', 'refreshInbox'],
    'content/qq-mail.js': ['handlePollEmail', 'refreshInbox'],
    'content/icloud-mail.js': ['openMailItemAndRead', 'refreshInbox', 'handlePollEmail'],
    'content/mail-2925.js': ['handlePollEmail', 'openMailAndGetMessageText', 'deleteCurrentMailboxEmail', 'openMailAndDeleteAfterRead', 'deleteAllMailboxEmails', 'refreshInbox'],
    'content/gmail-mail.js': ['refreshInbox', 'openRowAndGetMessageText', 'handlePollEmail'],
    'content/inbucket-mail.js': ['refreshMailbox', 'openMailboxEntry', 'deleteCurrentMailboxMessage', 'handlePollEmail'],
  };

  for (const [file, functionNames] of Object.entries(protectedFunctions)) {
    const source = fs.readFileSync(file, 'utf8');
    const pollHandler = extractPollEmailHandler(source);
    assert.doesNotMatch(pollHandler, /performOperationWithDelay\(/, `${file} POLL_EMAIL handler must stay delay-free`);

    for (const functionName of functionNames) {
      const functionBody = extractFunction(source, functionName);
      assert.doesNotMatch(functionBody, /performOperationWithDelay\(/, `${file} ${functionName} must stay delay-free`);
    }
  }

  const mail2925Source = fs.readFileSync('content/mail-2925.js', 'utf8');
  const deleteAllStart = mail2925Source.indexOf("message.type === 'DELETE_ALL_EMAILS'");
  assert.notEqual(deleteAllStart, -1, 'missing DELETE_ALL_EMAILS handler');
  const deleteAllBlock = mail2925Source.slice(deleteAllStart, mail2925Source.indexOf('return false;', deleteAllStart));
  assert.doesNotMatch(deleteAllBlock, /performOperationWithDelay\(/, '2925 cleanup must stay delay-free');
});

test('mail polling bundles do not load operation delay module', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  for (const file of ['content/mail-163.js', 'content/qq-mail.js', 'content/icloud-mail.js']) {
    const bundle = manifest.content_scripts.find((entry) => entry.js.includes(file))?.js || [];
    assert.equal(bundle.includes('content/operation-delay.js'), false, `${file} bundle must not include operation delay`);
  }
});

test('WhatsApp code reader remains polling-only and delay-free', () => {
  const source = fs.readFileSync('content/whatsapp-flow.js', 'utf8');
  assert.doesNotMatch(source, /performOperationWithDelay\(/);
});
