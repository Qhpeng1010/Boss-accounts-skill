#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeRequirementCoverage } from './lib/page-requirement-coverage.mjs';

const args = process.argv.slice(2);
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';
const specArg = arg('--spec');
const system = arg('--system');

if (!specArg || system !== 'boss-ledger') {
  console.error('Usage: node scripts/check-page-requirement-coverage.mjs --system boss-ledger --spec changes/{change-id}/page-spec.json');
  process.exit(2);
}

try {
  const spec = JSON.parse(readFileSync(resolve(process.cwd(), specArg), 'utf8'));
  if (spec.ui?.system !== system) throw new Error(`页面系统不匹配：期望 ${system}，实际 ${spec.ui?.system || '<missing>'}。`);
  const result = analyzeRequirementCoverage(spec);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  const summary = Object.entries(result.coverage).map(([key, value]) => `${key}=${value}`).join(', ');
  console.log(`requirement-coverage: pass (${specArg})`);
  console.log(`- ${summary}`);
} catch (error) {
  for (const message of String(error.message || error).split('\n')) console.error(`FAIL: ${message}`);
  process.exit(1);
}
