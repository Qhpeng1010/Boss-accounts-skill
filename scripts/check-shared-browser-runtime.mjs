#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertSharedBrowserRuntime, sharedRuntimeDependencies } from './lib/shared-browser-runtime.mjs';

try {
  const root = process.cwd();
  const manifest = assertSharedBrowserRuntime(root);
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const declared = packageJson.devDependencies || {};
  for (const name of sharedRuntimeDependencies) {
    if (packageJson.dependencies?.[name]) throw new Error(`${name} must be declared as a development dependency`);
    const version = declared[name];
    if (!version) throw new Error(`${name} is missing from package.json`);
    if (manifest.dependencies?.[name] !== version) throw new Error(`${name} runtime version does not match package.json`);
  }
  const unexpected = Object.keys(manifest.dependencies || {}).filter((name) => !sharedRuntimeDependencies.includes(name));
  if (unexpected.length) throw new Error(`unexpected runtime dependencies: ${unexpected.join(', ')}`);
  console.log('shared-browser-runtime: pass');
  console.log(`- dependencies: ${Object.keys(manifest.dependencies || {}).length}`);
  console.log(`- selected icons: ${manifest.icons?.length || 0}`);
  console.log(`- base files: ${manifest.baseFiles?.length || 0}`);
  console.log(`- dashboard-only files: ${manifest.dashboardFiles?.length || 0}`);
} catch (error) {
  console.error(`shared-browser-runtime: failed\n- ${error.message}`);
  process.exit(1);
}
