import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const GENERATION_REPORT_FILE = 'generation-report.json';

export function runTimedNode(root, label, script, scriptArgs, { stdio = 'inherit', timeoutMs = 30_000 } = {}) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [resolve(root, script), ...scriptArgs], {
    cwd: root,
    encoding: 'utf8',
    stdio,
    timeout: timeoutMs
  });
  const elapsedMs = Date.now() - started;
  if (result.error?.code === 'ETIMEDOUT') throw new Error(`${label} exceeded ${timeoutMs}ms.`);
  if (result.error || result.status !== 0) throw new Error(`${label} failed.`);
  return elapsedMs;
}

export function readGenerationReport(changeDir) {
  const reportPath = resolve(changeDir, GENERATION_REPORT_FILE);
  return existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
}

export function writeGenerationReport(changeDir, report) {
  const normalized = {
    schemaVersion: 1,
    ...report,
    recordedAt: new Date().toISOString()
  };
  writeFileSync(resolve(changeDir, GENERATION_REPORT_FILE), `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}
