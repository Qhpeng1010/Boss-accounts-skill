#!/usr/bin/env node
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const steps = [
  ['skill-integrity', 'scripts/check-boss-accounts-skill-integrity.mjs', []],
  ['generation-policy', 'scripts/check-boss-ledger-generation-policy.mjs', []],
  ['rule-coverage', 'scripts/check-boss-ledger-rule-coverage.mjs', []],
  ['release-manifest', 'scripts/verify-boss-ledger-release-manifest.mjs', []],
  ['contract-regression', 'scripts/test-boss-ledger-page-spec-contract.mjs', []],
  ['fast-path-regression', 'scripts/test-boss-ledger-fast-path.mjs', []],
  ['wizard-recipe-regression', 'scripts/test-boss-ledger-wizard-recipe.mjs', []],
  ['capability-scenario-materialization', 'scripts/materialize-boss-ledger-capability-scenarios.mjs', []],
  ['historical-page-rebuild', 'scripts/rebuild-boss-ledger-history.mjs', []],
  ['portable-history-regression', 'scripts/test-boss-ledger-portable-history.mjs', []],
  ['capability-scenarios-form', 'scripts/verify-boss-ledger-capability-scenarios.mjs', ['--scenarios=01-contact-create,16-contact-create-page,02-settlement-account-change,03-merchant-settlement-config']],
  ['capability-scenarios-workflow', 'scripts/verify-boss-ledger-capability-scenarios.mjs', ['--scenarios=04-settlement-account-wizard,05-settlement-import,06-split-rule-query']],
  ['capability-scenarios-list', 'scripts/verify-boss-ledger-capability-scenarios.mjs', ['--scenarios=07-settlement-rule-advanced,08-settlement-bill-statistics,09-settlement-rule-batch-review,17-merchant-service-config-drawer-create,18-transaction-inline-summary']],
  ['capability-scenarios-dashboard', 'scripts/verify-boss-ledger-capability-scenarios.mjs', ['--scenarios=19-operation-dashboard']],
  ['capability-scenarios-context', 'scripts/verify-boss-ledger-capability-scenarios.mjs', ['--scenarios=10-settlement-batch-expand,11-settlement-rule-management,12-settlement-quick-detail']],
  ['capability-scenarios-detail', 'scripts/verify-boss-ledger-capability-scenarios.mjs', ['--scenarios=13-split-record-drawer,14-merchant-settlement-long-detail,15-settlement-account-tabs']],
  ['form-fixture', 'scripts/run-boss-ledger-page-spec-fixture.mjs', ['modules/boss-ledger/execution/fixtures/valid/grouped-form.json']],
  ['simple-page-form-fixture', 'scripts/run-boss-ledger-page-spec-fixture.mjs', ['modules/boss-ledger/execution/fixtures/valid/simple-page-form.json']],
  ['staged-grouped-form-fixture', 'scripts/run-boss-ledger-page-spec-fixture.mjs', ['modules/boss-ledger/execution/fixtures/valid/staged-grouped-form.json']],
  ['detail-fixture', 'scripts/run-boss-ledger-page-spec-fixture.mjs', ['modules/boss-ledger/execution/fixtures/valid/grouped-detail.json']]
];

for (const [label, script, args] of steps) {
  const result = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`boss-ledger-page-spec-system: failed at ${label}`);
    process.exit(result.status || 1);
  }
}
console.log('boss-ledger-page-spec-system: pass (static)');
