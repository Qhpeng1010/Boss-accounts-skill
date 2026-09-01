#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const specIndex = process.argv.indexOf('--spec');
const requestedSpec = specIndex >= 0 ? process.argv[specIndex + 1] : '';
const changesRoot = resolve(root, 'changes');

function historySpecs() {
  if (requestedSpec) {
    const specPath = resolve(root, requestedSpec);
    if (!specPath.startsWith(`${changesRoot}/`) || !specPath.endsWith('/page-spec.json') || !existsSync(specPath)) return [];
    return [specPath];
  }
  if (!existsSync(changesRoot)) return [];
  return readdirSync(changesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(changesRoot, entry.name, 'page-spec.json'))
    .filter((specPath) => existsSync(specPath))
    .sort();
}

function run(label, script, specPath, { args = [], governed = true } = {}) {
  const relativeSpec = relative(root, specPath);
  const result = spawnSync(process.execPath, [resolve(root, script), ...args, ...(governed && !strict ? ['--flexible'] : [])], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 30_000
  });
  if (result.error?.code === 'ETIMEDOUT') throw new Error(`${label} timed out: ${relativeSpec}`);
  if (result.error || result.status !== 0) throw new Error(`${label} failed: ${relativeSpec}`);
}

const specs = historySpecs();
if (requestedSpec && specs.length !== 1) {
  console.error(`boss-ledger-history-rebuild: failed\n- invalid --spec target: ${requestedSpec}`);
  process.exit(2);
}
const failures = [];
for (const specPath of specs) {
  try {
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    run('rules read', 'scripts/read-boss-ledger-rules.mjs', specPath, {
      args: [relative(root, specPath).replace(/\/page-spec\.json$/, ''), spec.metadata.templateId],
      governed: false
    });
    run('rebuild', 'scripts/build-boss-ledger-page-spec.mjs', specPath, { args: [relative(root, specPath)] });
    run('static preflight', 'scripts/verify-boss-ledger-page-spec.mjs', specPath, { args: [relative(root, specPath)] });
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
