const fs = require('node:fs');

const FLOW_DEFINITION_FILES = Object.freeze([
  'flows/openai/index.js',
  'flows/kiro/index.js',
  'flows/grok/index.js',
  'flows/index.js',
]);

const FLOW_WORKFLOW_FILES = Object.freeze([
  'flows/openai/workflow.js',
  'flows/kiro/workflow.js',
  'flows/grok/workflow.js',
]);

function readBundle(files = []) {
  return files
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join(';\n');
}

function readFlowRegistryBundle(extraFiles = []) {
  return readBundle([
    ...FLOW_DEFINITION_FILES,
    'core/flow-kernel/flow-registry.js',
    ...extraFiles,
  ]);
}

function readSourceRegistryBundle(extraFiles = []) {
  return readBundle([
    ...FLOW_DEFINITION_FILES,
    'core/flow-kernel/flow-registry.js',
    'core/flow-kernel/source-registry.js',
    ...extraFiles,
  ]);
}

function readStepDefinitionsBundle(extraFiles = []) {
  return readBundle([
    ...FLOW_DEFINITION_FILES,
    ...FLOW_WORKFLOW_FILES,
    'data/step-definitions.js',
    ...extraFiles,
  ]);
}

function readFlowCapabilitiesBundle(extraFiles = []) {
  return readBundle([
    ...FLOW_DEFINITION_FILES,
    'core/flow-kernel/flow-registry.js',
    'shared/contribution-registry.js',
    'core/flow-kernel/settings-schema.js',
    'core/flow-kernel/flow-capabilities.js',
    ...extraFiles,
  ]);
}

module.exports = {
  FLOW_DEFINITION_FILES,
  FLOW_WORKFLOW_FILES,
  readBundle,
  readFlowCapabilitiesBundle,
  readFlowRegistryBundle,
  readSourceRegistryBundle,
  readStepDefinitionsBundle,
};
