#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createTestMcpReceipt } from './test-support/boss-ledger-mcp-receipt.mjs';

const root = process.cwd();
const request = '创建老板管账结算规则查询列表。查询条件：规则名称。列表字段：规则编号、规则名称。';
const changeDir = mkdtempSync(resolve(root, 'changes/.mcp-evidence-test-'));
const changeArg = relative(root, changeDir);
const receipts = [];

function run(args, env = process.env) {
  return spawnSync(process.execPath, [resolve(root, 'scripts/read-boss-ledger-rules.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
    env
  });
}

try {
  const missing = run([changeArg, 'list.regular']);
  if (missing.status === 0 || !missing.stderr.includes('Design MCP receipt is required')) {
    throw new Error('Local rule preflight did not stop when Design MCP evidence was missing.');
  }
  if (existsSync(resolve(changeDir, 'rules-read.md'))) throw new Error('Missing MCP evidence still produced rules-read.md.');

  const receipt = createTestMcpReceipt(request, 'list');
  receipts.push(receipt);
  const valid = run([changeArg, 'list.regular', '--mcp-receipt', receipt.path, '--request', request]);
  if (valid.status !== 0) throw new Error(valid.stderr || valid.stdout || 'Valid MCP receipt was rejected.');
  if (!existsSync(resolve(changeDir, 'mcp-context-receipt.json')) || !existsSync(resolve(changeDir, 'rules-read.md'))) {
    throw new Error('Validated MCP evidence was not copied into the Change.');
  }

  const wrongFamily = createTestMcpReceipt(request, 'form');
  receipts.push(wrongFamily);
  const rejected = run([changeArg, 'list.regular', '--mcp-receipt', wrongFamily.path, '--request', request]);
  if (rejected.status === 0 || !rejected.stderr.includes('family must equal list')) {
    throw new Error('A Design MCP receipt for the wrong family was accepted.');
  }
  console.log('boss-ledger-mcp-evidence: pass');
} catch (error) {
  console.error(`boss-ledger-mcp-evidence: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(changeDir, { recursive: true, force: true });
  receipts.forEach((receipt) => receipt.cleanup());
}
