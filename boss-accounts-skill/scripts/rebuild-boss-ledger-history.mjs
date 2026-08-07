#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const changesRoot = resolve(root, 'changes');

function historySpecs() {
  if (!existsSync(changesRoot)) return [];
  return readdirSync(changesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(changesRoot, entry.name, 'page-spec.json'))
    .filter((specPath) => existsSync(specPath))
    .sort();
}

function run(label, script, specPath) {
  const relativeSpec = relative(root, specPath);
  const result = spawnSync(process.execPath, [resolve(root, script), relativeSpec, ...(strict ? [] : ['--flexible'])], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 30_000
  });
  if (result.error?.code === 'ETIMEDOUT') throw new Error(`${label} timed out: ${relativeSpec}`);
  if (result.error || result.status !== 0) throw new Error(`${label} failed: ${relativeSpec}`);
}

const specs = historySpecs();
const failures = [];
for (const specPath of specs) {
  try {
    run('rebuild', 'scripts/build-boss-ledger-page-spec.mjs', specPath);
    run('static preflight', 'scripts/verify-boss-ledger-page-spec.mjs', specPath);
    console.log(`historical-page: pass (${relative(root, specPath)})`);
  } catch (error) {
    failures.push(error.message);
  }
}

if (failures.length) {
  console.error('boss-ledger-history-rebuild: failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('boss-ledger-history-rebuild: pass');
console.log(`- rebuilt pages: ${specs.length}`);
console.log(`- governance: ${strict ? 'strict' : 'flexible static preflight'}`);
