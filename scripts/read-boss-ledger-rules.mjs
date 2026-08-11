#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const changeArg = process.argv[2];
const ruleTemplate = process.argv[3];
if (!changeArg || !ruleTemplate || process.argv.length !== 4) {
  console.error('Usage: node scripts/read-boss-ledger-rules.mjs changes/{change-id} {rule-template-id}');
  process.exit(2);
}

const root = process.cwd();
const cacheDir = resolve(root, '.cache/yeepay-skill');
const cachePath = resolve(cacheDir, 'rules-hashes.json');
mkdirSync(cacheDir, { recursive: true });
let hashCache = {};
try { hashCache = JSON.parse(readFileSync(cachePath, 'utf8')); } catch { hashCache = {}; }
const registryPath = 'modules/boss-ledger/execution/rule-template-registry.json';
const registry = JSON.parse(readFileSync(resolve(root, registryPath), 'utf8'));
const selected = (registry.templates || []).find((template) => template.id === ruleTemplate);
if (!selected) {
  console.error(`Unknown Boss Ledger rule template: ${ruleTemplate}`);
  process.exit(1);
}
const familyPack = selected.family === 'empty-state' ? 'state.md' : `${selected.family}.md`;
const files = [
  'modules/boss-ledger/director-rules/README.md',
  'modules/boss-ledger/director-rules/01-visual-constitution.md',
  'modules/boss-ledger/director-rules/02-template-application-rules.md',
  'modules/boss-ledger/director-rules/03-interaction-acceptance-rules.md',
  registryPath,
  'modules/boss-ledger/execution/generation-policy.json',
  'modules/boss-ledger/execution/theme/theme-tokens.json',
  'modules/boss-ledger/execution/context-packs/core.md',
  'modules/boss-ledger/execution/context-packs/index.md',
  `modules/boss-ledger/execution/context-packs/${familyPack}`,
  'modules/boss-ledger/business-rules.md'
];
const missing = files.filter(file => !existsSync(resolve(root, file)));
if (missing.length) {
  console.error(`Boss Ledger rule preflight failed. Missing: ${missing.join(', ')}`);
  process.exit(1);
}

const rows = files.map(file => {
  const absolute = resolve(root, file);
  const stat = statSync(absolute);
  const signature = `${stat.mtimeMs}:${stat.size}`;
  const cached = hashCache[file];
  if (cached?.signature === signature) {
    return `- ${file} (${cached.lines} lines, sha256:${cached.hash})`;
  }
  const content = readFileSync(absolute, 'utf8');
  const entry = { signature, lines: content.split(/\r?\n/).length - 1, hash: createHash('sha256').update(content).digest('hex').slice(0, 16) };
  hashCache[file] = entry;
  return `- ${file} (${entry.lines} lines, sha256:${entry.hash})`;
});
writeFileSync(cachePath, `${JSON.stringify(hashCache, null, 2)}\n`);
const output = `# Boss Ledger 规则读取清单\n\n- Generated: ${new Date().toISOString()}\n- Selected design: Boss Ledger\n- Rule template: \`${ruleTemplate}\`\n- Rule template title: ${selected.title}\n- Rule template family: \`${selected.family}\`\n- Selected rule pack: modules/boss-ledger/execution/context-packs/${familyPack}\n- Fixed Shell: renderer-owned; it is not a business template input.\n- Director artifacts freshness: verified before this record was created.\n\n本 Change 在写入业务内容前完整读取了以下规则、策略和生成规则包：\n\n${rows.join('\n')}\n\n实现约束：业务需求只能声明字段、操作、数据、状态和当前策略已开放的能力。固定渲染器读取由视觉宪法生成的主题，负责 React、Ant Design、CSS、Shell 和响应式实现；不得用 HTML、JavaScript、CSS、坐标或历史设计稿信息绕过规则。\n`;
const changeDir = resolve(root, changeArg);
if (!changeDir.startsWith(`${resolve(root, 'changes')}/`)) {
  console.error('Change directory must be a child of changes/.');
  process.exit(2);
}
writeFileSync(resolve(changeDir, 'rules-read.md'), output);
console.log(`Boss Ledger rules read: ${resolve(changeDir, 'rules-read.md')}`);
console.log(rows.join('\n'));
