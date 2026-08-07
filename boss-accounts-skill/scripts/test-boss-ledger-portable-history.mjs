#!/usr/bin/env node
import { existsSync, lstatSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const request = '创建老板管账结算规则查询列表。查询条件：规则名称、规则状态。列表字段：规则编号、规则名称、规则状态。';
let generatedChange;

try {
  const generated = spawnSync(process.execPath, [resolve(root, 'scripts/generate-page.mjs'), '--request', request, '--recipe', 'auto'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (generated.error || generated.status !== 0) throw new Error(generated.stderr || generated.stdout || 'Fast generation failed.');
  const result = JSON.parse(generated.stdout);
  if (result.status !== 'generated') throw new Error('Fast generation did not produce a Change.');
  generatedChange = resolve(root, result.change);
  const vendor = resolve(generatedChange, 'vendor');
  if (!existsSync(vendor) || lstatSync(vendor).isSymbolicLink()) {
    throw new Error('Generated Change vendor must be a packaged directory.');
  }
  const rebuild = spawnSync(process.execPath, [resolve(root, 'scripts/rebuild-boss-ledger-history.mjs'), '--strict'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000
  });
  if (rebuild.error || rebuild.status !== 0) throw new Error(rebuild.stderr || rebuild.stdout || 'Historical rebuild failed.');
  if (!rebuild.stdout.includes(`historical-page: pass (${result.change}/page-spec.json)`)) {
    throw new Error('Historical rebuild did not process the generated Change.');
  }
  console.log('boss-ledger-portable-history: pass');
} catch (error) {
  console.error(`boss-ledger-portable-history: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  if (generatedChange) rmSync(generatedChange, { recursive: true, force: true });
}
