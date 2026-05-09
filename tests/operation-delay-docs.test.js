const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

for (const file of ['README.md', 'docs/使用教程/使用教程.md']) {
  test(`${file} documents operation delay`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /操作间延迟/);
    assert.match(source, /默认开启/);
    assert.match(source, /2\s*秒/);
    assert.match(source, /分格|OTP|验证码/);
    assert.match(source, /邮箱|短信|轮询/);
    assert.match(source, /confirm-oauth|platform-verify/);
  });
}
