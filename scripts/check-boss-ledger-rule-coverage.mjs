#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const matrixPath = resolve(root, 'modules/boss-ledger/execution/rule-assertions.json');
const ruleFiles = ['01-visual-constitution.md', '02-template-application-rules.md', '03-interaction-acceptance-rules.md'];
const failures = [];

if (!existsSync(matrixPath)) {
  console.error('boss-ledger-rule-coverage: failed');
  console.error('- rule-assertions.json is missing.');
  process.exit(1);
}

const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
const ruleSource = ruleFiles.map((file) => readFileSync(resolve(root, 'modules/boss-ledger/director-rules', file), 'utf8')).join('\n');
const knownRules = new Set(ruleSource.match(/BL-(?:VIS|TPL|INT)-\d{3}/g) || []);
const required = matrix.requiredRuleIds || [];
const coverage = matrix.coverage || [];

if (matrix.system !== 'boss-ledger') failures.push('matrix.system must be boss-ledger');
if (matrix.scope !== 'release-critical') failures.push('matrix.scope must be release-critical');
if (new Set(required).size !== required.length) failures.push('requiredRuleIds must be unique');
required.forEach((ruleId) => { if (!knownRules.has(ruleId)) failures.push(`unknown required Rule ID: ${ruleId}`); });

const coverageByRule = new Map();
coverage.forEach((entry) => {
  if (!knownRules.has(entry.ruleId)) failures.push(`coverage references unknown Rule ID: ${entry.ruleId}`);
  if (coverageByRule.has(entry.ruleId)) failures.push(`duplicate coverage entry: ${entry.ruleId}`);
  coverageByRule.set(entry.ruleId, entry);
  if (!Array.isArray(entry.assertions) || entry.assertions.length === 0) {
    failures.push(`${entry.ruleId}: at least one assertion is required`);
    return;
  }
  entry.assertions.forEach((assertion) => {
    if (!assertion?.id || !assertion?.source) {
      failures.push(`${entry.ruleId}: assertion requires id and source`);
      return;
    }
    const sourcePath = resolve(root, assertion.source);
    if (!existsSync(sourcePath)) {
      failures.push(`${entry.ruleId}: missing assertion source ${assertion.source}`);
      return;
    }
    if (!readFileSync(sourcePath, 'utf8').includes(`rule-assertion: ${assertion.id}`)) {
      failures.push(`${entry.ruleId}: ${assertion.source} does not declare rule-assertion: ${assertion.id}`);
    }
  });
});

required.forEach((ruleId) => { if (!coverageByRule.has(ruleId)) failures.push(`release-critical Rule ID is not covered: ${ruleId}`); });
coverageByRule.forEach((_, ruleId) => { if (!required.includes(ruleId)) failures.push(`coverage includes non-critical Rule ID: ${ruleId}`); });

if (failures.length) {
  console.error('boss-ledger-rule-coverage: failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('boss-ledger-rule-coverage: pass');
console.log(`- release-critical rules: ${required.length}`);
console.log(`- linked assertions: ${coverage.reduce((count, entry) => count + entry.assertions.length, 0)}`);
