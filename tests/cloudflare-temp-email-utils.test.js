const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCloudflareTempEmailHeaders,
  getCloudflareTempEmailAddressFromResponse,
  normalizeCloudflareTempEmailBaseUrl,
  normalizeCloudflareTempEmailDomain,
  normalizeCloudflareTempEmailDomains,
  normalizeCloudflareTempEmailMailApiMessages,
} = require('../cloudflare-temp-email-utils.js');
const {
  pickVerificationMessageWithTimeFallback,
} = require('../hotmail-utils.js');

test('normalizeCloudflareTempEmailBaseUrl normalizes host and preserves path', () => {
  assert.equal(
    normalizeCloudflareTempEmailBaseUrl('temp.example.com/api/'),
    'https://temp.example.com/api'
  );
  assert.equal(
    normalizeCloudflareTempEmailBaseUrl('http://127.0.0.1:8787'),
    'http://127.0.0.1:8787'
  );
  assert.equal(normalizeCloudflareTempEmailBaseUrl('::::'), '');
});

test('normalizeCloudflareTempEmailDomain and domains de-duplicate valid entries', () => {
  assert.equal(normalizeCloudflareTempEmailDomain('@Mail.Example.com'), 'mail.example.com');
  assert.equal(normalizeCloudflareTempEmailDomain('not-a-domain'), '');
  assert.deepEqual(
    normalizeCloudflareTempEmailDomains(['mail.example.com', 'MAIL.EXAMPLE.COM', 'bad-value']),
    ['mail.example.com']
  );
});

test('buildCloudflareTempEmailHeaders includes auth headers and content type when needed', () => {
  assert.deepEqual(
    buildCloudflareTempEmailHeaders(
      {
        adminAuth: 'admin-secret',
        customAuth: 'site-secret',
      },
      { json: true }
    ),
    {
      'x-admin-auth': 'admin-secret',
      'x-custom-auth': 'site-secret',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  );
});

test('normalizeCloudflareTempEmailMailApiMessages extracts sender, subject, code, and address from raw mime', () => {
  const messages = normalizeCloudflareTempEmailMailApiMessages({
    data: [
      {
        id: 'mail-1',
        address: 'user@example.com',
        original_recipient: 'Forwarded.User@Duck.com',
        created_at: '2026-04-13T09:15:00.000Z',
        raw: [
          'From: OpenAI <noreply@tm.openai.com>',
          'Subject: =?UTF-8?B?T3BlbkFJIHZlcmlmaWNhdGlvbiBjb2Rl?=',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          'Your verification code is 654321.',
        ].join('\r\n'),
      },
    ],
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'mail-1');
  assert.equal(messages[0].address, 'user@example.com');
  assert.equal(messages[0].originalRecipient, 'forwarded.user@duck.com');
  assert.equal(messages[0].subject, 'OpenAI verification code');
  assert.equal(messages[0].from.emailAddress.address, 'OpenAI <noreply@tm.openai.com>');
  assert.match(messages[0].bodyPreview, /654321/);
});

test('normalizeCloudflareTempEmailMailApiMessages decodes multipart quoted printable html bodies', () => {
  const messages = normalizeCloudflareTempEmailMailApiMessages([
    {
      id: 'mail-2',
      address: 'user@example.com',
      received_at: '2026-04-13T09:20:00.000Z',
      source: [
        'From: ChatGPT <noreply@tm.openai.com>',
        'Subject: Login code',
        'Content-Type: multipart/alternative; boundary="abc123"',
        '',
        '--abc123',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        '<p>Your login code is <strong>112233</strong>.</p>',
        '--abc123--',
      ].join('\r\n'),
    },
  ]);

  assert.equal(messages.length, 1);
  assert.match(messages[0].bodyPreview, /112233/);
  assert.equal(messages[0].subject, 'Login code');
});

test('normalizeCloudflareTempEmailMailApiMessages supports nested CFTE rows with structured AWS html mail', () => {
  const messages = normalizeCloudflareTempEmailMailApiMessages({
    data: {
      results: [
        {
          _id: 'aws-mail-1',
          to: [{ address: 'tmpjjwk205m0h@edu.email.qlhazycoder.tech' }],
          from: {
            emailAddress: {
              address: 'no-reply@signin.aws',
            },
          },
          title: '验证您的 AWS 构建者 ID 电子邮件地址',
          body_html: [
            '<html><body>',
            '<p>验证码</p>',
            '<p style="background-color:#F3F3F3">248680</p>',
            '</body></html>',
          ].join(''),
          createdAt: '2026-05-22T09:41:00.000Z',
        },
      ],
    },
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'aws-mail-1');
  assert.equal(messages[0].address, 'tmpjjwk205m0h@edu.email.qlhazycoder.tech');
  assert.equal(messages[0].from.emailAddress.address, 'no-reply@signin.aws');
  assert.equal(messages[0].subject, '验证您的 AWS 构建者 ID 电子邮件地址');
  assert.match(messages[0].bodyPreview, /248680/);
  assert.doesNotMatch(messages[0].bodyPreview, /<p/);
});

test('normalized CFTE AWS Builder ID mail matches Kiro verification rules', () => {
  const messages = normalizeCloudflareTempEmailMailApiMessages({
    data: {
      results: [
        {
          id: 'aws-mail-2',
          to: { address: 'tmpjjwk205m0h@edu.email.qlhazycoder.tech' },
          from: { address: 'no-reply@signin.aws' },
          subject: '验证您的 AWS 构建者 ID 电子邮件地址',
          html: '<div>验证码</div><div>248680</div>',
          receivedAt: '2026-05-22T09:41:00.000Z',
        },
      ],
    },
  });

  const result = pickVerificationMessageWithTimeFallback(messages, {
    afterTimestamp: Date.UTC(2026, 4, 22, 9, 40, 0),
    senderFilters: ['no-reply@signin.aws', 'aws'],
    subjectFilters: ['aws builder id', 'verification', '验证码', 'code', 'aws'],
    requiredKeywords: ['verification', '验证码', 'code', 'aws'],
    codePatterns: [
      { source: '(?:verification\\s*code|验证码|Your code is|code is)[：:\\s]*(\\d{6})', flags: 'gi' },
      { source: '^\\s*(\\d{6})\\s*$', flags: 'gm' },
      { source: '>\\s*(\\d{6})\\s*<', flags: 'g' },
    ],
    excludeCodes: [],
  });

  assert.equal(result.match?.message.id, 'aws-mail-2');
  assert.equal(result.match?.code, '248680');
});

test('getCloudflareTempEmailAddressFromResponse supports direct and nested response shapes', () => {
  assert.equal(getCloudflareTempEmailAddressFromResponse({ address: 'one@example.com' }), 'one@example.com');
  assert.equal(getCloudflareTempEmailAddressFromResponse({ data: { address: 'two@example.com' } }), 'two@example.com');
});
