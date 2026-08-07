#!/usr/bin/env node
import { assertChangeSpecPath, normalizeListSummaryPresentation, readJson, validatePageSpec } from './lib/boss-ledger-page-spec.mjs';

const specArg = process.argv.find((arg) => arg.endsWith('page-spec.json'));
const flexible = process.argv.includes('--flexible');
if (!specArg) {
  console.error('Usage: node scripts/check-boss-ledger-page-spec.mjs changes/{change-id}/page-spec.json');
  process.exit(2);
}

try {
  const root = process.cwd();
  const specPath = assertChangeSpecPath(root, specArg);
  const normalized = normalizeListSummaryPresentation(readJson(specPath), { root });
  const errors = validatePageSpec(normalized.spec, { root, strictGovernance: !flexible });
  if (errors.length) {
    errors.forEach((error) => console.error(`FAIL: ${error}`));
    process.exit(1);
  }
  console.log(`page-spec-contract: pass (${specArg})`);
  if (flexible) console.log('- governance: flexible natural-generation mode');
  if (normalized.changed) console.log(`- list summary normalized to ${normalized.kind} presentation during build.`);
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
}
