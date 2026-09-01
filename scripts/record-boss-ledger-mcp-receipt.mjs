#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mcpReceiptSummary, validateMcpReceipt } from './lib/boss-ledger-mcp-evidence.mjs';

const args = process.argv.slice(2);
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';
const input = arg('--input');
const output = arg('--output');
const request = arg('--request');
const family = arg('--family');

if (!input || !output || !request || !family) {
  console.error('Usage: node scripts/record-boss-ledger-mcp-receipt.mjs --input <raw-receipt.json> --output <receipt.json> --request "<original request>" --family <family>');
  process.exit(2);
}

try {
  const root = process.cwd();
  const parsed = JSON.parse(readFileSync(resolve(root, input), 'utf8'));
  const stagingPath = resolve(root, output);
  const validated = validateMcpReceipt(parsed, { serviceId: 'boss-ledger', family, request });
  mkdirSync(dirname(stagingPath), { recursive: true });
  writeFileSync(stagingPath, `${JSON.stringify(mcpReceiptSummary(validated), null, 2)}\n`);
  console.log(`boss-ledger-mcp-receipt: pass (${stagingPath})`);
  console.log(`- service: ${validated.serviceId}`);
  console.log(`- family: ${validated.family}`);
  console.log(`- verified packages: ${validated.acceptedPackages.length}`);
} catch (error) {
  console.error(`boss-ledger-mcp-receipt: failed\n- ${error.message}`);
  process.exit(1);
}
