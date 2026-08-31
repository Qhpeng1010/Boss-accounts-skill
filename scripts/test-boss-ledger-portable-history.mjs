#!/usr/bin/env node
import { existsSync, lstatSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const request = '创建老板管账结算规则查询列表。查询条件：规则名称、规则状态。列表字段：规则编号、规则名称、规则状态。';
let generatedChange;

function sharesStorage(left, right) {
  const leftStat = statSync(left);
  const rightStat = statSync(right);
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

function assertVendorMode(vendor, mode) {
  if (!existsSync(vendor) || lstatSync(vendor).isSymbolicLink()) {
    throw new Error('Generated Change vendor must be a real directory.');
  }
  const sharedFile = resolve(root, 'modules/shared/browser-runtime/vendor/antd.min.js');
  const pageFile = resolve(vendor, 'antd.min.js');
  const linked = sharesStorage(sharedFile, pageFile);
  if (mode === 'linked' && !linked) throw new Error('Default Change vendor must reuse shared files through hard links.');
  if (mode === 'portable' && linked) throw new Error('Portable Change vendor must contain independent file copies.');
}

try {
  const generated = spawnSync(process.execPath, [resolve(root, 'scripts/generate-page.mjs'), '--request', request, '--recipe', 'auto'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (generated.error || generated.status !== 0) throw new Error(generated.stderr || generated.stdout || 'Fast generation failed.');
  const awaiting = JSON.parse(generated.stdout);
  if (awaiting.status !== 'awaiting-mcp' || !awaiting.routeContext || !awaiting.commands?.fast) {
    throw new Error('Fast generation did not stop at the MCP gate.');
  }
  const executed = spawnSync(process.execPath, [
    resolve(root, 'scripts/generate-boss-ledger-page.mjs'),
    '--request', request,
    '--route-context', awaiting.routeContext,
    '--mcp-verified',
    '--json'
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (executed.error || executed.status !== 0) throw new Error(executed.stderr || executed.stdout || 'Gated fast execution failed.');
  const result = JSON.parse(executed.stdout);
  if (result.status !== 'generated') throw new Error('Gated fast execution did not produce a Change.');
  generatedChange = resolve(root, result.change);
  const vendor = resolve(generatedChange, 'vendor');
  assertVendorMode(vendor, 'linked');
  const rebuild = spawnSync(process.execPath, [resolve(root, 'scripts/rebuild-boss-ledger-history.mjs'), '--strict'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000
  });
  if (rebuild.error || rebuild.status !== 0) throw new Error(rebuild.stderr || rebuild.stdout || 'Historical rebuild failed.');
  if (!rebuild.stdout.includes(`historical-page: pass (${result.change}/page-spec.json)`)) {
    throw new Error('Historical rebuild did not process the generated Change.');
  }
  assertVendorMode(vendor, 'linked');
  const portable = spawnSync(process.execPath, [
    resolve(root, 'scripts/build-boss-ledger-page-spec.mjs'),
    `${result.change}/page-spec.json`,
    '--portable'
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (portable.error || portable.status !== 0) throw new Error(portable.stderr || portable.stdout || 'Portable rebuild failed.');
  assertVendorMode(vendor, 'portable');
  const portableVerify = spawnSync(process.execPath, [
    resolve(root, 'scripts/verify-boss-ledger-page-spec.mjs'),
    `${result.change}/page-spec.json`
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (portableVerify.error || portableVerify.status !== 0) {
    throw new Error(portableVerify.stderr || portableVerify.stdout || 'Portable verification failed.');
  }
  console.log('boss-ledger-portable-history: pass');
} catch (error) {
  console.error(`boss-ledger-portable-history: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  if (generatedChange) rmSync(generatedChange, { recursive: true, force: true });
}
