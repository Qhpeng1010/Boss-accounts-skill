#!/usr/bin/env node
// rule-assertion: delivery.release-manifest
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'modules/boss-ledger/execution/release-manifest.json');
if (!existsSync(manifestPath)) {
  console.error('release-manifest: failed');
  console.error('- Boss Ledger release manifest is missing.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const policy = JSON.parse(readFileSync(resolve(root, 'modules/boss-ledger/execution/generation-policy.json'), 'utf8'));
const failures = [];
if (manifest.system !== 'boss-ledger') failures.push('manifest system must be boss-ledger');
if (manifest.policyVersion !== policy.policyVersion) failures.push('manifest policyVersion does not match generation policy');
for (const [file, expected] of Object.entries(manifest.hashes || {})) {
  const absolute = resolve(root, file);
  if (!existsSync(absolute)) {
    failures.push(`missing bound file: ${file}`);
    continue;
  }
  const actual = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  if (actual !== expected) failures.push(`hash mismatch: ${file}`);
}
if (failures.length) {
  console.error('release-manifest: failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('release-manifest: pass');
console.log(`- release: ${manifest.releaseVersion}`);
console.log(`- bound files: ${Object.keys(manifest.hashes || {}).length}`);
