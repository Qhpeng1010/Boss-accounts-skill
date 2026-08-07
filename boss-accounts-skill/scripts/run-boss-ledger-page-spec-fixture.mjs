#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtureArg = process.argv.find((arg) => arg.endsWith('.json'));
if (!fixtureArg) {
  console.error('Usage: node scripts/run-boss-ledger-page-spec-fixture.mjs modules/boss-ledger/execution/fixtures/valid/{fixture}.json');
  process.exit(2);
}

const root = process.cwd();
const fixturePath = resolve(root, fixtureArg);
const fixtureRoot = resolve(root, 'modules/boss-ledger/execution/fixtures/valid');
if (!fixturePath.startsWith(`${fixtureRoot}/`)) {
  console.error('Fixture must be under modules/boss-ledger/execution/fixtures/valid/.');
  process.exit(2);
}

const changeId = `20260728-page-spec-fixture-${randomBytes(4).toString('hex')}`;
const changeDir = resolve(root, 'changes', changeId);
mkdirSync(changeDir);
try {
  const spec = JSON.parse(readFileSync(fixturePath, 'utf8'));
  spec.metadata.changeId = changeId;
  writeFileSync(resolve(changeDir, 'page-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  const shadowEvidence = spec.metadata.validatedCombinations?.length ? `- Validated combinations: ${spec.metadata.validatedCombinations.map((id) => `\`${id}\``).join('、')}\n` : '';
  writeFileSync(resolve(changeDir, 'page-design.md'), `# Page Design: ${spec.metadata.pageName}\n\n## Routing\n\n- System: Boss Ledger\n- Family: \`${spec.metadata.family}\`\n- Rule template: \`${spec.metadata.templateId}\`\n- Runtime mode: \`${spec.metadata.executionMode}\`\n${shadowEvidence}- Selection reason: ${spec.metadata.selectionReason}\n- Rejected candidates: Fixture only validates the selected family boundary.\n- Capabilities: ${spec.content.capabilities.join('、')}\n\n## Assumptions\n\n${spec.metadata.assumptions.map((assumption) => `- ${assumption}`).join('\n')}\n\n## Rule References\n\n${spec.metadata.ruleRefs.map((ruleId) => `- \`${ruleId}\``).join('\n')}\n`);

  const run = (label, script, args) => {
    const result = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${label} failed.`);
  };
  const changeRelative = `changes/${changeId}`;
  run('rules', 'scripts/read-boss-ledger-rules.mjs', [changeRelative, spec.metadata.templateId]);
  run('build', 'scripts/build-boss-ledger-page-spec.mjs', [`${changeRelative}/page-spec.json`]);
  run('verify', 'scripts/verify-boss-ledger-page-spec.mjs', [`${changeRelative}/page-spec.json`]);
  console.log(`page-spec-fixture: pass (${basename(fixturePath)})`);
} catch (error) {
  console.error(`page-spec-fixture: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(changeDir, { recursive: true, force: true });
}
