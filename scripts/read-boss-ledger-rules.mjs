#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  loadMcpReceipt,
  MCP_GENERATION_REQUEST_ENV,
  MCP_ORIGINAL_REQUEST_ENV,
  mcpReceiptSummary,
  sha256
} from './lib/boss-ledger-mcp-evidence.mjs';

const args = process.argv.slice(2);
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';
const positional = [];
for (let index = 0; index < args.length; index += 1) {
  if (['--mcp-receipt', '--request'].includes(args[index])) {
    index += 1;
    continue;
  }
  positional.push(args[index]);
}
const [changeArg, ruleTemplate] = positional;

if (!changeArg || !ruleTemplate || positional.length !== 2) {
  console.error('Usage: node scripts/read-boss-ledger-rules.mjs changes/{change-id} {rule-template-id} --mcp-receipt <receipt.json>');
  process.exit(2);
}

try {
  const root = process.cwd();
  const changeDir = resolve(root, changeArg);
  if (!changeDir.startsWith(`${resolve(root, 'changes')}/`) || basename(changeDir) === 'changes') {
    throw new Error('Change directory must be a child of changes/.');
  }

  const registryPath = resolve(root, 'modules/boss-ledger/execution/rule-template-registry.json');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const selected = (registry.templates || []).find((template) => template.id === ruleTemplate);
  if (!selected) throw new Error(`Unknown Boss Ledger rule template: ${ruleTemplate}`);

  const existingReceiptPath = resolve(changeDir, 'mcp-context-receipt.json');
  const reusingChangeReceipt = !arg('--mcp-receipt') && !process.env.BOSS_LEDGER_MCP_RECEIPT && existsSync(existingReceiptPath);
  const evidence = loadMcpReceipt(root, arg('--mcp-receipt') || (existsSync(existingReceiptPath) ? existingReceiptPath : ''), {
    serviceId: 'boss-ledger',
    family: selected.family,
    ...(process.env[MCP_ORIGINAL_REQUEST_ENV] || arg('--request') ? { request: process.env[MCP_ORIGINAL_REQUEST_ENV] || arg('--request') } : {}),
    allowStale: reusingChangeReceipt
  });
  const summary = {
    ...mcpReceiptSummary(evidence.receipt),
    generationRequest: process.env[MCP_GENERATION_REQUEST_ENV] || arg('--request') || evidence.receipt.generationRequest || evidence.receipt.request
  };
  const normalized = `${JSON.stringify(summary, null, 2)}\n`;
  const evidenceDigest = sha256(normalized);
  mkdirSync(changeDir, { recursive: true });
  writeFileSync(resolve(changeDir, 'mcp-context-receipt.json'), normalized);

  const packageRows = evidence.receipt.acceptedPackages
    .map((entry) => `- \`package:${entry.packageId}\` (${entry.verificationCall.tool}: verified)`)
    .join('\n');
  const output = `# Boss Ledger MCP 上下文证据\n\n- Generated: ${new Date().toISOString()}\n- Service ID: \`boss-ledger\`\n- Family: \`${selected.family}\`\n- Rule template: \`${ruleTemplate}\`\n- Rule template title: ${selected.title}\n- Context tool: \`${evidence.receipt.contextCall.tool}\`\n- Evidence file: \`mcp-context-receipt.json\`\n- Evidence sha256: \`${evidenceDigest}\`\n- Fixed Shell: renderer-owned; it is not a business template input.\n\n本 Change 的设计与业务知识来自 Design MCP。以下知识包均已使用 \`knowledge_check_verification\` 的 \`package:<packageId>\` URI 逐一验证：\n\n${packageRows}\n\n本清单不读取或证明仓库内的 \`director-rules/\`、\`context-packs/\` 或其他知识正文副本。仓库仅提供策略、Schema、固定渲染器、Shell、主题运行时和静态预检。\n`;
  writeFileSync(resolve(changeDir, 'rules-read.md'), output);
  console.log(`Boss Ledger MCP context verified: ${resolve(changeDir, 'rules-read.md')}`);
  console.log(`- receipt: ${resolve(changeDir, 'mcp-context-receipt.json')}`);
  console.log(`- family: ${selected.family}`);
  console.log(`- verified packages: ${evidence.receipt.acceptedPackages.length}`);
} catch (error) {
  console.error(`Boss Ledger MCP preflight failed.\n- ${error.message}`);
  process.exit(1);
}
