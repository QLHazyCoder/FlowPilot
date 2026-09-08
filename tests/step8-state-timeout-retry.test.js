const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('background.js', 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) {
    throw new Error(`missing function ${name}`);
  }

  const braceStart = source.indexOf('{', start);
  let depth = 0;
  let end = braceStart;
  for (; end < source.length; end++) {
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

const bundle = [
  extractFunction('isRetryableContentScriptTransportError'),
].join('\n');

const api = new Function(`${bundle}; return { isRetryableContentScriptTransportError };`)();

assert.strictEqual(
  api.isRetryableContentScriptTransportError(new Error('Content script on openai-auth did not respond in 2s. Try refreshing the tab and retry.')),
  true,
  'Step 8 状态探测短超时应被视为可重试错误'
);

assert.strictEqual(
  api.isRetryableContentScriptTransportError(new Error('Content script on openai-auth did not respond in 30s. Try refreshing the tab and retry.')),
  true,
  '普通内容脚本超时也应沿用可重试分支'
);

assert.strictEqual(
  api.isRetryableContentScriptTransportError(new Error('认证页 内容脚本 1 秒内未响应，请刷新页面后重试。')),
  true,
  '中文内容脚本超时也应沿用可重试分支'
);

assert.strictEqual(
  api.isRetryableContentScriptTransportError(new Error('认证页 页面刚完成跳转或刷新，内容脚本还没有重新接回；扩展已自动重试，但仍未恢复。请重试当前步骤。')),
  true,
  '页面跳转后的规范化传输错误应继续由当前节点恢复'
);

assert.strictEqual(
  api.isRetryableContentScriptTransportError(new Error('按钮不存在')),
  false,
  '真实业务错误不应被误判为可重试传输错误'
);

assert.strictEqual(
  api.isRetryableContentScriptTransportError(new Error('TypeError: Failed to fetch')),
  true,
  'Failed to fetch 应进入可重试传输错误分支'
);

console.log('step8 state timeout retry tests passed');
