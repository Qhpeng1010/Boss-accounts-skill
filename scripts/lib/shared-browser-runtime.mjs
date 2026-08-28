import { createHash } from 'node:crypto';
import { cpSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

export const sharedRuntimeDirectory = (root) => resolve(root, 'modules/shared/browser-runtime/vendor');
export const sharedRuntimeDependencies = Object.freeze([
  '@ant-design/charts',
  '@ant-design/icons',
  'antd',
  'dayjs',
  'lodash',
  'react',
  'react-dom'
]);

export function pageNeedsCharts(spec) {
  return spec?.metadata?.family === 'dashboard' && Array.isArray(spec?.dashboard?.charts) && spec.dashboard.charts.length > 0;
}

export function readRuntimeManifest(root) {
  const path = resolve(sharedRuntimeDirectory(root), 'runtime-manifest.json');
  if (!existsSync(path)) throw new Error('Shared browser runtime is missing. Run `npm ci && npm run build:runtime`.');
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function runtimeFilesForSpec(root, spec) {
  const manifest = readRuntimeManifest(root);
  return [...manifest.baseFiles, ...(pageNeedsCharts(spec) ? manifest.dashboardFiles : [])];
}

export function assertSharedBrowserRuntime(root, spec) {
  const runtimeDir = sharedRuntimeDirectory(root);
  const manifest = readRuntimeManifest(root);
  const failures = [];
  for (const name of [...manifest.baseFiles, ...manifest.dashboardFiles]) {
    const path = resolve(runtimeDir, name);
    if (!existsSync(path)) {
      failures.push(`missing ${name}`);
      continue;
    }
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (manifest.hashes?.[name] !== actual) failures.push(`hash mismatch ${name}`);
  }
  if (failures.length) throw new Error(`Shared browser runtime is stale: ${failures.join(', ')}. Run \`npm run build:runtime\`.`);
  return manifest;
}

function installRuntimeFile(source, target, portable) {
  if (portable) {
    cpSync(source, target);
    return;
  }
  try {
    linkSync(source, target);
  } catch (error) {
    const unsupported = new Set(['EACCES', 'ENOSYS', 'ENOTSUP', 'EPERM', 'EXDEV']);
    if (!unsupported.has(error?.code)) throw error;
    cpSync(source, target);
  }
}

export function installPageVendor(root, changeDir, spec, { portable = false } = {}) {
  assertSharedBrowserRuntime(root, spec);
  const source = sharedRuntimeDirectory(root);
  const target = resolve(changeDir, 'vendor');
  let targetExists = existsSync(target);
  if (!targetExists) {
    try {
      lstatSync(target);
      targetExists = true;
    } catch {
      targetExists = false;
    }
  }
  if (targetExists) rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const name of runtimeFilesForSpec(root, spec)) {
    installRuntimeFile(resolve(source, name), resolve(target, name), portable);
  }
  installRuntimeFile(
    resolve(source, 'runtime-manifest.json'),
    resolve(target, 'runtime-manifest.json'),
    portable
  );
}

export function verifyPageVendor(root, changeDir, spec) {
  assertSharedBrowserRuntime(root, spec);
  const source = sharedRuntimeDirectory(root);
  const target = resolve(changeDir, 'vendor');
  if (!existsSync(target)) return ['vendor is missing'];
  if (lstatSync(target).isSymbolicLink()) return ['vendor must be a packaged directory, not a symbolic link'];
  const failures = [];
  for (const name of runtimeFilesForSpec(root, spec)) {
    const actual = resolve(target, name);
    const expected = resolve(source, name);
    if (!existsSync(actual)) {
      failures.push(`vendor/${name} is missing`);
      continue;
    }
    if (!readFileSync(actual).equals(readFileSync(expected))) failures.push(`vendor/${name} differs from the shared runtime`);
  }
  return failures;
}

export function renderBossLedgerPreview(template, spec) {
  const marker = '  <!-- boss:optional-runtime -->';
  if (!template.includes(marker)) throw new Error('Boss Ledger preview template is missing the optional runtime marker.');
  const optional = pageNeedsCharts(spec)
    ? '  <script src="./vendor/lodash.min.js"></script>\n  <script src="./vendor/ant-design-charts.min.js"></script>'
    : '';
  return template.replace(marker, optional);
}
