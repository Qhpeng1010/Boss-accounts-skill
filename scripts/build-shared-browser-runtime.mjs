#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import { sharedRuntimeDependencies } from './lib/shared-browser-runtime.mjs';

const root = process.cwd();
const require = createRequire(import.meta.url);
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const outputDir = resolve(root, 'modules/shared/browser-runtime/vendor');

function packageRoot(name) {
  return dirname(require.resolve(`${name}/package.json`));
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function copyPackageFile(name, source, target) {
  const sourcePath = resolve(packageRoot(name), source);
  if (!existsSync(sourcePath)) throw new Error(`${name} does not provide ${source}`);
  cpSync(sourcePath, resolve(outputDir, target));
}

function collectIconNames(directory, result = new Set()) {
  if (!existsSync(directory)) return result;
  for (const name of readdirSync(directory)) {
    if (name === 'vendor') continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      collectIconNames(path, result);
      continue;
    }
    if (!['.js', '.mjs', '.json', '.md'].includes(extname(name))) continue;
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/\b[A-Z][A-Za-z0-9]+(?:Outlined|Filled|TwoTone)\b/g)) result.add(match[0]);
  }
  return result;
}

function collectIconNamesFromChangeSpecs(directory, result = new Set()) {
  if (!existsSync(directory)) return result;
  for (const name of readdirSync(directory)) {
    const specPath = join(directory, name, 'page-spec.json');
    if (!existsSync(specPath)) continue;
    const source = readFileSync(specPath, 'utf8');
    for (const match of source.matchAll(/\b[A-Z][A-Za-z0-9]+(?:Outlined|Filled|TwoTone)\b/g)) result.add(match[0]);
  }
  return result;
}

async function buildIcons() {
  const iconNames = [...new Set([
    ...collectIconNames(resolve(root, 'modules/boss-ledger')),
    ...collectIconNamesFromChangeSpecs(resolve(root, 'changes'))
  ])].sort();
  if (!iconNames.length) throw new Error('No Ant Design icon references were found.');
  const imports = iconNames.map((name) => `import ${name} from '@ant-design/icons/es/icons/${name}.js';`).join('\n');
  const entry = `${imports}\nconst selectedIcons = { ${iconNames.join(', ')} };\n`
    + 'globalThis.icons = Object.assign(globalThis.icons || {}, selectedIcons);\n'
    + 'globalThis.antdIcons = globalThis.icons;\n'
    + 'globalThis.AntDesignIcons = globalThis.icons;\n';

  await build({
    stdin: { contents: entry, resolveDir: root, sourcefile: 'selected-ant-design-icons.js' },
    outfile: resolve(outputDir, 'ant-design-icons.min.js'),
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    legalComments: 'none',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'browser-react-global',
      setup(context) {
        context.onResolve({ filter: /^react$/ }, () => ({ path: 'react-global', namespace: 'browser-global' }));
        context.onLoad({ filter: /.*/, namespace: 'browser-global' }, () => ({
          contents: 'module.exports = globalThis.React;',
          loader: 'js'
        }));
      }
    }]
  });
  return iconNames;
}

async function main() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  copyPackageFile('react', 'umd/react.production.min.js', 'react.production.min.js');
  copyPackageFile('react-dom', 'umd/react-dom.production.min.js', 'react-dom.production.min.js');
  copyPackageFile('dayjs', 'dayjs.min.js', 'dayjs.min.js');
  copyPackageFile('dayjs', 'locale/zh-cn.js', 'dayjs-zh-cn.js');
  copyPackageFile('antd', 'dist/reset.css', 'antd-reset.css');
  copyPackageFile('antd', 'dist/antd.min.js', 'antd.min.js');
  copyPackageFile('lodash', 'lodash.min.js', 'lodash.min.js');
  copyPackageFile('@ant-design/charts', 'dist/charts.min.js', 'ant-design-charts.min.js');
  const icons = await buildIcons();

  const files = readdirSync(outputDir).filter((name) => statSync(resolve(outputDir, name)).isFile()).sort();
  const declared = packageJson.devDependencies || {};
  const dependencies = Object.fromEntries(sharedRuntimeDependencies.map((name) => {
    if (!declared[name]) throw new Error(`${name} is missing from package.json`);
    const installed = JSON.parse(readFileSync(resolve(packageRoot(name), 'package.json'), 'utf8')).version;
    if (installed !== declared[name]) throw new Error(`${name} installed version ${installed} does not match package.json ${declared[name]}`);
    return [name, installed];
  }));
  const manifest = {
    schemaVersion: 1,
    source: 'package-lock.json',
    dependencies,
    icons,
    baseFiles: [
      'react.production.min.js',
      'react-dom.production.min.js',
      'dayjs.min.js',
      'dayjs-zh-cn.js',
      'antd-reset.css',
      'antd.min.js',
      'ant-design-icons.min.js'
    ],
    dashboardFiles: ['lodash.min.js', 'ant-design-charts.min.js'],
    hashes: Object.fromEntries(files.map((name) => [name, sha256(resolve(outputDir, name))]))
  };
  writeFileSync(resolve(outputDir, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`shared-browser-runtime: built (${relative(root, outputDir)})`);
  console.log(`- dependencies: ${Object.keys(dependencies).length}`);
  console.log(`- selected icons: ${icons.length}`);
  console.log(`- runtime files: ${files.length}`);
}

main().catch((error) => {
  console.error(`shared-browser-runtime: failed\n- ${error.message}`);
  process.exit(1);
});
