'use strict';

const assert = require('node:assert');
const test = require('node:test');
const fs = require('node:fs');

test('reauth result actions expose a disabled success-only JSON download button', () => {
  const html = fs.readFileSync('sidepanel/sidepanel.html', 'utf8');

  assert.match(html, /id="btn-reauth-download-result"[\s\S]*下载完整 JSON 文件/);
  assert.match(html, /id="btn-reauth-download-success-result"[\s\S]*只下载成功账号 JSON/);
  assert.ok(
    html.indexOf('id="btn-reauth-download-result"') < html.indexOf('id="btn-reauth-download-success-result"'),
    'success-only download button should sit next to the full JSON download button'
  );
  assert.match(
    html,
    /id="btn-reauth-download-success-result"[^>]*disabled/,
    'success-only download button must default to disabled before successful accounts exist'
  );
});

test('sidepanel enables success-only reauth download only when successful accounts exist', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  assert.match(source, /const btnReauthDownloadSuccessResult = document\.getElementById\('btn-reauth-download-success-result'\)/);
  assert.match(source, /function syncReauthResultActionButtons\(\)/);
  assert.match(source, /function hasReauthBatchResultJson\(\) {\s*return Boolean\(lastReauthBatchResult\?\.updatedFileJson\);/);
  assert.match(source, /function hasReauthSuccessOnlyBatchResultJson\(\)/);
  assert.match(source, /btnReauthDownloadSuccessResult\.disabled = !hasReauthSuccessOnlyBatchResultJson\(\)/);
  assert.match(source, /const usesBatchResultActions = isReauthFullDownloadActionVisible\(\) \|\| hasBatchJson/);
  assert.match(source, /const canCopy = usesBatchResultActions[\s\S]*\? hasBatchJson[\s\S]*: hasRenderedReauthResultValue\(\)/);
  assert.match(source, /btnReauthCopyResult\.disabled = !canCopy/);
  assert.match(source, /handleReauthBatchSuccessDownload/);
  assert.match(source, /generateBatchDownloadFileName\('success-only'\)/);
  assert.match(source, /btnReauthDownloadSuccessResult\?\.addEventListener\('click'/);
});

test('success-only and copy buttons follow the full JSON download button batch-result gate', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  assert.match(source, /function isReauthFullDownloadActionVisible\(\)/);
  assert.match(source, /const fullDownloadDisplay = btnReauthDownloadResult[\s\S]*btnReauthDownloadResult\.style\.display[\s\S]*btnReauthDownloadSuccessResult\.style\.display = fullDownloadDisplay/);
  assert.match(source, /if \(!hasReauthBatchResultJson\(\)\) {\s*setReauthCopyStatus\('暂无可下载的批量结果。', 'warn'\)/);
});

test('sidepanel refuses to copy or download reauth placeholders when no batch result exists', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  assert.match(source, /async function handleReauthBatchDownload\(\) {\s*const text = lastReauthBatchResult\?\.updatedFileJson \|\| '';/);
  assert.match(source, /setReauthCopyStatus\('暂无可复制的授权结果。', 'warn'\)/);
  assert.match(source, /const usesBatchResultActions = isReauthFullDownloadActionVisible\(\) \|\| hasReauthBatchResultJson\(\)/);
  assert.match(source, /hasRenderedReauthResultValue\(\) \? \(displayReauthResultAccount\?\.textContent \|\| ''\) : ''/);
});

test('sidepanel clears stale reauth batch result when a new account file is selected or a new batch starts', () => {
  const source = fs.readFileSync('sidepanel/sidepanel.js', 'utf8');

  assert.match(source, /lastReauthBatchResult = null;\s*lastReauthBatchProgress = null;\s*reauthBatchRunningLocal = false;\s*clearReauthAccountPicker\(\);\s*applyReauthBatchResult\(null\);\s*renderReauthResultAccount\(null\);/);
  assert.match(source, /reauthBatchRunningLocal = true;\s*applyReauthBatchResult\(null\);\s*applyReauthBatchProgress/);
});
