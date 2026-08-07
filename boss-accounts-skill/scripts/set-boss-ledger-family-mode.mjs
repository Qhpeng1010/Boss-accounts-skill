#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const policyPath = resolve(root, 'modules/boss-ledger/execution/generation-policy.json');
const readArg = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const familyArg = readArg('--family');
const intentArg = readArg('--intent');
const modeArg = readArg('--mode');
const versionArg = readArg('--policy-version');
const checkOnly = process.argv.includes('--check');
const allowedModes = new Set(['shadow', 'page-spec-default', 'page-spec-only']);
const policy = JSON.parse(readFileSync(policyPath, 'utf8'));

if (checkOnly) {
  console.log(`Boss Ledger generation policy ${policy.policyVersion}`);
  policy.families.forEach((family) => {
    const overrides = Object.entries(family.intentModes || {}).map(([intent, mode]) => `${intent}=${mode}`).join(', ');
    console.log(`- ${family.id}: ${family.availability} / ${family.mode}${overrides ? ` (${overrides})` : ''}`);
  });
  process.exit(0);
}
if (!familyArg || !modeArg || !versionArg) {
  console.error('Usage: node scripts/set-boss-ledger-family-mode.mjs --family <id> [--intent <intent-id>] --mode <mode> --policy-version <new-version>');
  process.exit(2);
}
if (!allowedModes.has(modeArg)) {
  console.error(`Unsupported mode: ${modeArg}`);
  process.exit(2);
}
const family = policy.families.find((entry) => entry.id === familyArg);
if (!family) {
  console.error(`Unknown family: ${familyArg}`);
  process.exit(2);
}
if (modeArg !== 'page-spec-only' && family.availability !== 'available') {
  console.error(`${familyArg} is ${family.availability}; only its blocked Page Spec boundary may be configured.`);
  process.exit(1);
}
if (versionArg === policy.policyVersion) {
  console.error('A mode change requires a new policy version.');
  process.exit(1);
}
if (intentArg && !family.intents?.includes(intentArg)) {
  console.error(`${intentArg} is not an intent of ${familyArg}.`);
  process.exit(1);
}

const original = readFileSync(policyPath, 'utf8');
if (intentArg) {
  family.intentModes = { ...(family.intentModes || {}), [intentArg]: modeArg };
} else {
  family.mode = modeArg;
}
policy.policyVersion = versionArg;
writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
const check = spawnSync(process.execPath, [resolve(root, 'scripts/check-boss-ledger-generation-policy.mjs')], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (check.status !== 0) {
  writeFileSync(policyPath, original);
  console.error('Invalid policy update was rolled back.');
  process.exit(check.status || 1);
}
console.log(`Updated ${intentArg ? `${familyArg}/${intentArg}` : familyArg} to ${modeArg}.`);
console.log('Run refresh-boss-ledger-release-manifest.mjs and the full system gate before delivery.');
