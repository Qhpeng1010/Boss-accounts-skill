#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function routeBusiness(rawRequest) {
  if (!String(rawRequest || '').trim()) return { status: 'clarify', question: '请提供老板管账页面需求。' };
  return {
    status: 'routed',
    module: 'boss-ledger',
    name: '老板管账',
    confidence: 'high',
    matches: ['Boss-accounts-skill'],
    domain: 'modules/boss-ledger/DOMAIN.md',
    contract: 'modules/boss-ledger/domain.json'
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = routeBusiness(readArg('--request'));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'routed' ? 0 : 2;
}
