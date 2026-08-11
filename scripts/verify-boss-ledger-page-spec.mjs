#!/usr/bin/env node
// rule-assertion: delivery.derived-artifacts
// rule-assertion: delivery.static-preflight
// rule-assertion: delivery.human-review-record
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertChangeSpecPath,
  generatedPreviewApp,
  pageSpecHash,
  readJson,
  validatePageSpec
} from './lib/boss-ledger-page-spec.mjs';

const specArg = process.argv.find((arg) => arg.endsWith('page-spec.json'));
const flexible = process.argv.includes('--flexible');
if (process.argv.includes('--browser')) {
  console.error('Browser automatic acceptance is retired for Boss Ledger. Review preview.html manually.');
  process.exit(2);
}
if (!specArg) {
  console.error('Usage: node scripts/verify-boss-ledger-page-spec.mjs changes/{change-id}/page-spec.json');
  process.exit(2);
}

function run(root, label, args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', stdio: 'inherit', timeout: 30_000 });
  if (result.error?.code === 'ETIMEDOUT') throw new Error(`${label} exceeded 30000ms.`);
  if (result.error || result.status !== 0) throw new Error(`${label} failed.`);
}

function runWarning(root, label, args) {
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', stdio: 'inherit', timeout: 30_000 });
  if (result.error || result.status !== 0) {
    console.warn(`page-spec-precheck-warning: ${label} did not pass; flexible natural-generation delivery continues.`);
    return false;
  }
  return true;
}

function hash(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

try {
  const root = process.cwd();
  const specPath = assertChangeSpecPath(root, specArg);
  const changeDir = dirname(specPath);
  const spec = readJson(specPath);
  const errors = validatePageSpec(spec, { root, strictGovernance: !flexible });
  if (errors.length) throw new Error(errors.join('\n'));
  const releaseManifestArgs = [resolve(root, 'scripts/verify-boss-ledger-release-manifest.mjs')];
  if (flexible) runWarning(root, 'release-manifest', releaseManifestArgs);
  else run(root, 'release-manifest', releaseManifestArgs);

  const appPath = resolve(changeDir, 'preview-app.js');
  if (!existsSync(appPath) || readFileSync(appPath, 'utf8') !== generatedPreviewApp(spec)) {
    throw new Error('preview-app.js is stale or was edited; rebuild from page-spec.json.');
  }
  const recordPath = resolve(changeDir, 'page-spec-build.json');
  if (!existsSync(recordPath)) throw new Error('page-spec-build.json is missing; rebuild the Page Spec.');
  const record = readJson(recordPath);
  if (record.pageSpecHash !== pageSpecHash(spec)) throw new Error('page-spec-build.json does not match page-spec.json.');
  for (const [file, expected] of Object.entries(record.generated || {})) {
    const absolute = resolve(changeDir, file);
    if (!existsSync(absolute) || hash(absolute) !== expected) throw new Error(`Derived artifact drift detected: ${file}.`);
  }
  const reviewPath = resolve(changeDir, 'review.md');
  if (!existsSync(reviewPath)) throw new Error('review.md is missing; rebuild to create the human acceptance record.');
  const review = readFileSync(reviewPath, 'utf8');
  const hasStaticSection = review.includes('## 静态预检') || review.includes('## 自动预检');
  const hasHumanSection = /## (?:人工验收|验收场景|人工验收场景)/.test(review);
  if (!hasStaticSection || !hasHumanSection) {
    throw new Error('review.md must distinguish static preflight from human acceptance.');
  }

  run(root, 'canonical-static-preflight', [
    resolve(root, 'scripts/verify-boss-ledger-page-runtime.mjs'),
    resolve(changeDir, 'preview.html'),
    ...(flexible ? ['--flexible'] : [])
  ]);
  console.log(`page-spec-precheck: pass (${relative(root, specPath)})`);
  console.log('- static preflight: passed');
  console.log('- human acceptance: required through preview.html and review.md.');
} catch (error) {
  console.error(`page-spec-precheck: failed\n- ${error.message}`);
  process.exit(1);
}
