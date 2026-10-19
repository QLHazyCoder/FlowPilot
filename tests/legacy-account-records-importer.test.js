const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const accountRunHistorySource = fs.readFileSync('background/account-run-history.js', 'utf8');
const accountRecordsImporterSource = fs.readFileSync('imports/legacy/account-records-importer.js', 'utf8');

function loadImporterApi() {
  const scope = {};
  return new Function('self', `
${accountRunHistorySource}
${accountRecordsImporterSource}
return self.MultiPageLegacyAccountRecordsImporter;
`)(scope);
}

test('legacy account records importer normalizes old history records into canonical record shape', () => {
  const importer = loadImporterApi();
  const importerApi = importer.createAccountRecordsImporter({
    getNodeIdByStepForState: () => '',
  });

  const records = importerApi.importAccountRecords([
    {
      email: 'LegacyUser@example.com',
      password: 'secret',
      status: 'success',
      recordedAt: '2026-04-17T00:12:00.000Z',
      plusModeEnabled: 1,
    },
    {
      phone: '+6612345',
      finalStatus: 'stopped',
      reason: '用户停止',
      failedStep: 7,
      flowId: 'kiro',
    },
  ]);

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    recordId: 'legacyuser@example.com',
    flowId: '',
    runId: '',
    accountIdentifierType: 'email',
    accountIdentifier: 'legacyuser@example.com',
    email: 'legacyuser@example.com',
    phoneNumber: '',
    password: 'secret',
    finalStatus: 'success',
    finishedAt: '2026-04-17T00:12:00.000Z',
    retryCount: 0,
    failureLabel: '流程完成',
    failureDetail: '',
    failedNodeId: '',
    failedStep: null,
    source: 'manual',
    autoRunContext: null,
    plusModeEnabled: true,
  });
  assert.equal(records[1].recordId, 'phone:+6612345');
  assert.equal(records[1].flowId, 'kiro');
  assert.equal(records[1].accountIdentifierType, 'phone');
  assert.equal(records[1].phoneNumber, '+6612345');
  assert.equal(records[1].finalStatus, 'stopped');
  assert.equal(records[1].failedStep, 7);
});
