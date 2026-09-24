#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'SKILL.md', 'README.md', 'agents/openai.yaml', 'package.json', 'package-lock.json',
  'modules/shared/product.md', 'modules/shared/browser-runtime/README.md', 'modules/shared/browser-runtime/vendor/runtime-manifest.json',
  'modules/boss-ledger/domain.json', 'modules/boss-ledger/business-rules.md',
  'modules/boss-ledger/director-rules/01-visual-constitution.md',
  'modules/boss-ledger/director-rules/02-template-application-rules.md',
  'modules/boss-ledger/director-rules/03-interaction-acceptance-rules.md',
  'scripts/route-business.mjs', 'scripts/resolve-resources.mjs', 'scripts/generate-page.mjs',
  'scripts/generate-boss-ledger-page.mjs', 'scripts/build-boss-ledger-page-spec.mjs',
  'scripts/verify-boss-ledger-page-spec.mjs', 'scripts/rebuild-boss-ledger-history.mjs'
];
const missing = requiredFiles.filter((file) => !existsSync(resolve(root, file)));
const errors = [];
const domain = JSON.parse(readFileSync(resolve(root, 'modules/boss-ledger/domain.json'), 'utf8'));
if (domain.module !== 'boss-ledger') errors.push('domain module must be boss-ledger');
for (const resource of Object.values(domain.adapter?.resources || {}).flat()) {
  if (!resource.endsWith('.md') || !existsSync(resolve(root, resource))) errors.push(`missing adapter Markdown resource: ${resource}`);
}
const execution = domain.adapter?.execution || {};
for (const resource of [execution.policy, execution.templateRegistry, execution.contextIndex, execution.schema, execution.releaseManifest, execution.coreContext, ...Object.values(execution.familyContexts || {})].filter(Boolean)) {
  if (!existsSync(resolve(root, resource))) errors.push(`missing execution resource: ${resource}`);
}
for (const command of [execution.scaffoldCommand, execution.checkCommand, execution.buildCommand, execution.verifyCommand, ...Object.values(domain.adapter?.commands?.generate || {})]) {
  const match = String(command || '').match(/node\s+(scripts\/[^\s]+)/);
  if (match && !existsSync(resolve(root, match[1]))) errors.push(`missing command script: ${match[1]}`);
}
function collectText(relativePath) {
  const absolute = resolve(root, relativePath);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [relativePath];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relativePath}/${entry.name}`;
    return entry.isDirectory() ? collectText(child) : [child];
  });
}
const crossServiceRefs = collectText('scripts')
  .concat(['SKILL.md', 'README.md'])
  .filter((file) => /\.(?:md|mjs|js)$/.test(file))
  .filter((file) => !file.endsWith('check-boss-accounts-skill-integrity.mjs'))
  .filter((file) => /\b(?:easy-account|open-platform)\b/.test(readFileSync(resolve(root, file), 'utf8')));
if (crossServiceRefs.length) errors.push(`cross-service references: ${crossServiceRefs.join(', ')}`);

if (missing.length || errors.length) {
  console.error('boss-accounts-skill-integrity: failed');
  missing.forEach((file) => console.error(`- missing: ${file}`));
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('boss-accounts-skill-integrity: pass');
console.log(`- required paths: ${requiredFiles.length}`);
console.log('- scope: Boss Ledger only');
