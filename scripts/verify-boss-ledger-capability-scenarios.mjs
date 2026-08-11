#!/usr/bin/env node
// rule-assertion: scenario.static-capability
// rule-assertion: scenario.static-dashboard
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { scenarios } from '../modules/boss-ledger/execution/scenarios/capability-scenarios.mjs';
import { generatedPreviewApp, pageSpecHash, readJson, validatePageSpec } from './lib/boss-ledger-page-spec.mjs';

const root = process.cwd();
const requested = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
const requestedIds = process.argv.find((arg) => arg.startsWith('--scenarios='))?.split('=')[1]?.split(',').filter(Boolean);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function changeDir(scenario) {
  return resolve(root, 'changes', scenario.spec.metadata.changeId);
}

function verifyScenarioArtifacts(scenario) {
  const dir = changeDir(scenario);
  const specPath = resolve(dir, 'page-spec.json');
  const previewApp = resolve(dir, 'preview-app.js');
  const buildPath = resolve(dir, 'page-spec-build.json');
  const errors = validatePageSpec(scenario.spec, { root });
  assert(errors.length === 0, `${scenario.id}: source contract failed: ${errors.join(' | ')}`);
  assert(existsSync(specPath) && existsSync(previewApp) && existsSync(buildPath), `${scenario.id}: delivery artifacts are missing.`);
  const builtSpec = readJson(specPath);
  assert(pageSpecHash(builtSpec) === pageSpecHash(scenario.spec), `${scenario.id}: materialized page spec is stale.`);
  assert(readFileSync(previewApp, 'utf8') === generatedPreviewApp(builtSpec), `${scenario.id}: preview application is stale.`);
  const record = readJson(buildPath);
  assert(record.pageSpecHash === pageSpecHash(builtSpec), `${scenario.id}: build record does not match the Page Spec.`);
  for (const [file, expected] of Object.entries(record.generated || {})) {
    const target = resolve(dir, file);
    assert(existsSync(target) && fileHash(target) === expected, `${scenario.id}: generated artifact drift in ${file}.`);
  }
}

const selectedScenarios = requestedIds?.length
  ? scenarios.filter((scenario) => requestedIds.includes(scenario.id))
  : requested ? scenarios.filter((scenario) => scenario.id === requested) : scenarios;
if (!selectedScenarios.length) {
  console.error(`Unknown capability scenario: ${requested || requestedIds?.join(',')}`);
  process.exit(2);
}

try {
  for (const scenario of selectedScenarios) {
    verifyScenarioArtifacts(scenario);
    console.log(`capability-scenario: pass (${scenario.id}, static)`);
  }
  console.log(`boss-ledger-capability-scenarios: pass (${selectedScenarios.length} scenarios, static)`);
  console.log('- visual and interaction acceptance: reviewed manually through each preview.html.');
} catch (error) {
  console.error(`boss-ledger-capability-scenarios: failed\n- ${error.message}`);
  process.exitCode = 1;
}
