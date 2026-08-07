#!/usr/bin/env node
// rule-assertion: canonical.shell
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generatedPreviewApp, readJson, validatePageSpec } from './lib/boss-ledger-page-spec.mjs';
import { renderBossLedgerPreview, verifyPageVendor } from './lib/shared-browser-runtime.mjs';

const args = process.argv.slice(2);
const previewArg = args.find((arg) => !arg.startsWith('--'));
const flexible = args.includes('--flexible');
if (!previewArg) {
  console.error('Usage: node scripts/verify-boss-ledger-page-runtime.mjs changes/{change-id}/preview.html');
  process.exit(2);
}

const root = process.cwd();
const previewPath = resolve(root, previewArg);
const changeDir = dirname(previewPath);
const templateDir = resolve(root, 'modules/boss-ledger/shell');
const pageSpecPath = resolve(changeDir, 'page-spec.json');
const rendererDir = resolve(root, 'modules/boss-ledger/execution/renderer');
const themeDir = resolve(root, 'modules/boss-ledger/execution/theme');
const failures = [];

if (!existsSync(pageSpecPath)) {
  console.error('Page Spec runtime verification requires page-spec.json. Legacy preview packages are no longer supported.');
  process.exit(2);
}
let spec;
try {
  spec = readJson(pageSpecPath);
} catch (error) {
  console.error(`Page Spec runtime verification could not read page-spec.json: ${error.message}`);
  process.exit(2);
}

const rulesManifestPath = resolve(changeDir, 'rules-read.md');
if (!existsSync(rulesManifestPath)) {
  failures.push('rules-read.md is missing; run scripts/read-boss-ledger-rules.mjs before implementation');
} else {
  const manifest = readFileSync(rulesManifestPath, 'utf8');
  const mandatoryRuleFiles = [
    'modules/boss-ledger/director-rules/README.md',
    'modules/boss-ledger/director-rules/01-visual-constitution.md',
    'modules/boss-ledger/director-rules/02-template-application-rules.md',
    'modules/boss-ledger/director-rules/03-interaction-acceptance-rules.md',
    'modules/boss-ledger/execution/rule-template-registry.json',
    'modules/boss-ledger/execution/generation-policy.json',
    'modules/boss-ledger/execution/theme/theme-tokens.json',
    'modules/boss-ledger/execution/context-packs/core.md',
    'modules/boss-ledger/execution/context-packs/index.md',
    'modules/boss-ledger/business-rules.md',
  ];
  const manifestRows = [...manifest.matchAll(/^- ((?:specs|modules)\/[^\s]+) \([^\n]*sha256:([a-f0-9]+)\)$/gm)];
  const manifestHashes = new Map(manifestRows.map((match) => [match[1], match[2]]));
  for (const file of mandatoryRuleFiles) {
    const filePath = resolve(root, file);
    if (!existsSync(filePath)) {
      failures.push(`current rule file is missing: ${file}`);
      continue;
    }
    const hash = createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16);
    if (manifestHashes.get(file) !== hash) {
      failures.push(`rules-read.md is stale or does not prove the current ${file} was read; rerun scripts/read-boss-ledger-rules.mjs`);
    }
  }
  const selectedTemplateMatch = manifest.match(/^- Rule template: `?([^`\n]+)`?$/m);
  const selectedTemplate = selectedTemplateMatch?.[1]?.trim();
  const registryPath = 'modules/boss-ledger/execution/rule-template-registry.json';
  const registry = existsSync(resolve(root, registryPath)) ? JSON.parse(readFileSync(resolve(root, registryPath), 'utf8')) : null;
  if (!selectedTemplate || !(registry?.templates || []).some((template) => template.id === selectedTemplate)) {
    failures.push('rules-read.md must name a current Rule template from rule-template-registry.json');
  }
  const selectedPackMatch = manifest.match(/^- Selected rule pack: (modules\/boss-ledger\/execution\/context-packs\/[^\n]+)$/m);
  const selectedPack = selectedPackMatch?.[1]?.trim();
  if (!selectedPack || !manifestHashes.has(selectedPack)) {
    failures.push('rules-read.md must include the selected family Rule Pack and its current hash');
  }
  for (const [file, recordedHash] of manifestHashes) {
    const filePath = resolve(root, file);
    if (!existsSync(filePath)) {
      failures.push(`rules-read.md names a missing rule file: ${file}`);
      continue;
    }
    const currentHash = createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16);
    if (recordedHash !== currentHash) {
      failures.push(`rules-read.md contains a stale hash for ${file}; rerun scripts/read-boss-ledger-rules.mjs`);
    }
  }
  if (manifestRows.length < mandatoryRuleFiles.length) {
    failures.push('rules-read.md must include all required Director Rules, rule registry, and generated Context Pack hashes');
  }
  if (!/Fixed Shell: renderer-owned; it is not a business template input\./.test(manifest)
      || !/Director artifacts freshness: verified before this record was created\./.test(manifest)) {
    failures.push('rules-read.md must explicitly confirm the fixed Shell boundary and fresh generated Director artifacts');
  }
}

function sameFile(actual, expected, label) {
  if (!existsSync(actual)) return failures.push(`${label} is missing`);
  if (!existsSync(expected)) return failures.push(`canonical ${label} is missing`);
  if (!readFileSync(actual).equals(readFileSync(expected))) failures.push(`${label} differs from the canonical shell asset`);
}

function sameContent(actual, expected, label) {
  if (!existsSync(actual)) return failures.push(`${label} is missing`);
  if (readFileSync(actual, 'utf8') !== expected) failures.push(`${label} differs from the generated canonical content`);
}

sameContent(
  previewPath,
  renderBossLedgerPreview(readFileSync(resolve(rendererDir, 'page-spec-preview.template.html'), 'utf8'), spec),
  'preview.html'
);
sameFile(resolve(changeDir, 'shell-runtime.js'), resolve(templateDir, 'shell-runtime.js'), 'shell-runtime.js');
sameFile(resolve(changeDir, 'shell.css'), resolve(templateDir, 'shell.css'), 'shell.css');
sameFile(resolve(changeDir, 'content-base.css'), resolve(templateDir, 'content-base.css'), 'content-base.css');
sameFile(resolve(changeDir, 'theme.css'), resolve(themeDir, 'theme.css'), 'theme.css');
sameFile(resolve(changeDir, 'theme.js'), resolve(themeDir, 'theme.js'), 'theme.js');
sameFile(resolve(changeDir, 'assets/boss-logo.svg'), resolve(root, 'modules/boss-ledger/assets/boss-logo.svg'), 'assets/boss-logo.svg');
try {
  verifyPageVendor(root, changeDir, spec).forEach((failure) => failures.push(failure));
} catch (error) {
  failures.push(error.message);
}

const businessCssPath = resolve(changeDir, 'business.css');
const appPath = resolve(changeDir, 'preview-app.js');
if (!existsSync(businessCssPath)) failures.push('business.css is missing');
if (!existsSync(appPath)) failures.push('preview-app.js is missing');
sameFile(resolve(changeDir, 'page-spec-runtime.js'), resolve(rendererDir, 'page-spec-runtime.js'), 'page-spec-runtime.js');
sameFile(businessCssPath, resolve(rendererDir, 'page-spec-business.css'), 'business.css');
try {
  const specErrors = validatePageSpec(spec, { root, strictGovernance: !flexible });
  specErrors.forEach((error) => failures.push(`page-spec: ${error}`));
  if (existsSync(appPath) && readFileSync(appPath, 'utf8') !== generatedPreviewApp(spec)) {
    failures.push('preview-app.js is not the exact derived output of page-spec.json');
  }
} catch (error) {
  failures.push(`page-spec: ${error.message}`);
}

if (failures.length) {
  console.error('canonical-shell: failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('canonical-shell: pass');
const validation = spawnSync(process.execPath, [resolve(root, 'scripts/validate-boss-ledger-preview.mjs'), previewPath], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe'
});
process.stdout.write(validation.stdout || '');
process.stderr.write(validation.stderr || '');
process.exit(validation.status ?? 1);
