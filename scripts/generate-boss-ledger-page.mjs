#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyBossLedgerGeneration } from './lib/boss-ledger-generation-entry.mjs';
import { recipeRouteEnvironment } from './lib/recipe-route-context.mjs';
import { readGenerationReport, writeGenerationReport } from './lib/generation-performance.mjs';

const root = process.cwd();
const args = process.argv.slice(2);

function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

function todayShanghai() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('');
}

function slugFromRequest(request) {
  const knownSlugs = [
    [/退款审核规则/, 'refund-review-rule'],
    [/分账规则/, 'split-rule'],
    [/结算账户/, 'settlement-account'],
    [/渠道联系人/, 'channel-contact'],
    [/商户结算/, 'merchant-settlement'],
    [/导入.*名单/, 'settlement-import']
  ];
  return knownSlugs.find(([pattern]) => pattern.test(request))?.[1] || 'boss-ledger-page';
}

function isValidChangeArg(value) {
  return /^changes\/\d{8}-[a-z0-9-]+$/.test(value || '');
}

function allocateChange(request, requestedChange) {
  const requested = String(requestedChange || '').trim();
  if (isValidChangeArg(requested) && !existsSync(resolve(root, requested))) return requested;

  const base = `changes/${todayShanghai()}-${slugFromRequest(request)}`;
  let candidate = base;
  let suffix = 2;
  while (existsSync(resolve(root, candidate))) candidate = `${base}-${suffix++}`;
  return candidate;
}

function print(result, json) {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  console.log(`boss-ledger-generation-entry: ${result.status}`);
  console.log(`- ${result.reason}`);
  if (result.question) console.log(`- question: ${result.question}`);
  if (result.pageName) console.log(`- page: ${result.pageName}`);
  if (result.change) console.log(`- change: ${result.change}`);
  if (result.preview) console.log(`- preview: ${result.preview}`);
  if (result.recipeName) console.log(`- recipe: ${result.recipeName}`);
  if (result.fallbackReason) console.log(`- fallback: ${result.fallbackReason}`);
  if (Number.isInteger(result.elapsedMs)) console.log(`- elapsed: ${result.elapsedMs}ms`);
  if (result.next) console.log(`- next: ${result.next}`);
}

function generate(result, request, change, resolvedRoute) {
  const compiler = result.recipe === 'list-workbench'
    ? 'scripts/compile-boss-ledger-list-workbench-recipe.mjs'
    : result.recipe === 'linked-list-wizard'
      ? 'scripts/compile-boss-ledger-linked-workflow-recipe.mjs'
      : result.recipe === 'linked-list-page-form'
        ? 'scripts/compile-boss-ledger-linked-page-form-recipe.mjs'
    : 'scripts/compile-boss-ledger-wizard-recipe.mjs';
  const command = [resolve(root, compiler), '--request', request, '--change', change];
  const executed = spawnSync(process.execPath, command, {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    env: recipeRouteEnvironment(request, resolvedRoute)
  });
  if (executed.error?.code === 'ETIMEDOUT') throw new Error('快速生成超过 30 秒。');
  if (executed.error || executed.status !== 0) throw new Error(executed.stderr || executed.stdout || '快速生成失败。');
  const stageReport = readGenerationReport(resolve(root, change));
  if (!stageReport) throw new Error('快速生成未写入阶段耗时报告。');
  return {
    ...result,
    status: 'generated',
    change,
    preview: `${change}/preview.html`,
    review: `${change}/review.md`,
    checks: 'passed',
    humanAcceptance: 'pending',
    stageReport,
    next: '静态预检已完成，打开 preview.html 进行人工验收。'
  };
}

export function generateBossLedgerPage({ request, requestedChange = '', route = null, timingContext = {} }) {
  const startedAt = timingContext.startedAt || Date.now();
  const classifyStarted = Date.now();
  const decision = classifyBossLedgerGeneration(request, { route });
  const baseTimings = {
    routeMs: timingContext.routeMs || 0,
    classifyMs: Date.now() - classifyStarted
  };
  if (decision.status !== 'fast') {
    const timings = { ...baseTimings, totalMs: Date.now() - startedAt };
    return {
      ...decision,
      recipeName: null,
      outcome: decision.status,
      fallbackReason: decision.reason,
      timings,
      elapsedMs: timings.totalMs
    };
  }
  const change = allocateChange(request, requestedChange);
  const inputRequest = decision.inputRequest || request;
  const delivered = generate({ ...decision, requestedChange }, inputRequest, change, route);
  const timings = {
    ...baseTimings,
    ...delivered.stageReport.timings,
    totalMs: Date.now() - startedAt
  };
  const result = {
    ...delivered,
    recipeName: decision.recipe,
    outcome: 'generated',
    fallbackReason: null,
    timings,
    elapsedMs: timings.totalMs
  };
  delete result.stageReport;
  writeGenerationReport(resolve(root, change), {
    system: 'boss-ledger',
    recipeName: result.recipeName,
    outcome: result.outcome,
    fallbackReason: result.fallbackReason,
    reason: result.reason,
    timings
  });
  return result;
}

function main() {
  const request = arg('--request');
  const requestedChange = arg('--change');
  const json = args.includes('--json');
  if (!request) throw new Error('Usage: node scripts/generate-boss-ledger-page.mjs --request "<业务需求>" [--change changes/<change-id>] [--json]');

  print(generateBossLedgerPage({ request, requestedChange }), json);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(`boss-ledger-generation-entry: failed\n- ${error.message}`);
    process.exitCode = 1;
  }
}
