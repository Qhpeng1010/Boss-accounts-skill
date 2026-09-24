#!/usr/bin/env node
import { resolveResources } from './resolve-resources.mjs';
import { generateBossLedgerPage } from './generate-boss-ledger-page.mjs';

const args = process.argv.slice(2);
const textOutput = args.includes('--text');
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';

function print(result) {
  if (!textOutput) return process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  console.log(`page-generation-entry: ${result.status}`);
  console.log(`- ${result.reason}`);
  if (result.question) console.log(`- question: ${result.question}`);
  if (result.recipeName) console.log(`- recipe: ${result.recipeName}`);
  if (result.fallbackReason) console.log(`- fallback: ${result.fallbackReason}`);
  if (result.change) console.log(`- change: ${result.change}`);
  if (result.preview) console.log(`- preview: ${result.preview}`);
  if (Number.isInteger(result.elapsedMs)) console.log(`- elapsed: ${result.elapsedMs}ms`);
}

function routeSummary(route) {
  return {
    module: route.module,
    intent: route.intent,
    pageType: route.pageType,
    template: route.template,
    family: route.execution?.family,
    availability: route.execution?.availability,
    mode: route.execution?.mode,
    renderable: route.execution?.renderable,
    intents: route.intents || [],
    families: route.families || [],
    composition: Boolean(route.composition)
  };
}

function contextQuestion(route) {
  if (route.intent === 'empty-state' && !route.composition) {
    return '空状态必须依附具体业务页面，请补充它属于哪个列表、表单、详情或看板页面，以及用户可执行的恢复操作。';
  }
  if (route.intent === 'result' && !route.composition) {
    return '结果反馈必须依附业务流程，请补充它由哪个操作触发，以及完成后返回哪里。';
  }
  return null;
}

function main() {
  const started = Date.now();
  const request = arg('--request');
  const requestedRecipeMode = arg('--recipe');
  // Recipe selection is an intent decision, not a wording opt-in. The
  // classifier proves whether the request matches a verified recipe and
  // falls back to controlled natural generation when it does not. Keep
  // --recipe off as an explicit escape hatch for diagnostics and callers
  // that intentionally need the natural-generation contract.
  const recipeMode = requestedRecipeMode || 'auto';
  if (args.includes('--json') && textOutput) throw new Error('--json and --text cannot be used together.');
  if (!request || !['off', 'auto'].includes(recipeMode)) {
    throw new Error('Usage: node scripts/generate-page.mjs --request "<business request>" [--recipe off|auto] [--text]');
  }

  const routeStarted = Date.now();
  const route = resolveResources(request, 'generate');
  const routeMs = Date.now() - routeStarted;
  if (route.status !== 'resolved') {
    const totalMs = Date.now() - started;
    return print({ status: route.status, outcome: route.status, recipeName: null, fallbackReason: route.question || '无法确定页面意图。', timings: { routeMs, totalMs }, elapsedMs: totalMs, reason: route.question || '无法确定页面意图。', question: route.question, candidates: route.candidates || [] });
  }

  const question = contextQuestion(route);
  if (question) {
    const totalMs = Date.now() - started;
    return print({ status: 'clarify', outcome: 'clarify', recipeName: null, fallbackReason: question, timings: { routeMs, totalMs }, elapsedMs: totalMs, route: routeSummary(route), reason: question, question });
  }
  if (route.execution?.renderable === false) {
    const totalMs = Date.now() - started;
    const reason = `“${route.pageType}”当前缺少可执行的规格与渲染器实现，无法生成可验收预览。`;
    return print({ status: 'blocked', outcome: 'blocked', recipeName: null, fallbackReason: reason, timings: { routeMs, totalMs }, elapsedMs: totalMs, route: routeSummary(route), reason });
  }

  let recipeAttempt;
  const recipeUnavailable = recipeMode === 'auto' && route.execution?.availability !== 'available';
  if (recipeMode === 'auto' && !recipeUnavailable) {
    recipeAttempt = generateBossLedgerPage({ request, route, timingContext: { startedAt: started, routeMs } });
    if (recipeAttempt?.status === 'generated') {
      return print({ ...recipeAttempt, route: routeSummary(route), reason: `${recipeAttempt.reason} 快速配方、构建和静态预检已在统一入口内完成。` });
    }
    if (recipeAttempt?.status === 'clarify' || recipeAttempt?.status === 'blocked') return print(recipeAttempt);
  }

  const totalMs = Date.now() - started;
  const warnings = [];
  if (route.composition) warnings.push('当前需求包含多个页面意图，已在同一次路由中合并所需规则资源。');
  if (route.execution?.availability !== 'available') warnings.push(`当前能力状态为 ${route.execution?.availability || 'unknown'}；自然语言生成继续执行，交付结果需人工验收。`);
  if (route.execution?.mode === 'legacy') warnings.push('当前登记运行模式为 legacy；自然语言生成使用宽松治理模式并要求人工验收。');
  print({
    status: 'natural-generation',
    outcome: 'natural-generation',
    recipeName: null,
    fallbackReason: recipeUnavailable ? `当前能力状态为 ${route.execution?.availability || 'unknown'}，严格配方未执行，已转入自然语言生成。` : recipeAttempt?.fallbackReason || recipeAttempt?.reason || null,
    route: routeSummary(route),
    resources: route.resources,
    commands: route.commands,
    warnings,
    ...(recipeAttempt ? { recipeAttempt: { status: recipeAttempt.status, reason: recipeAttempt.reason } } : {}),
    timings: { routeMs, ...(recipeAttempt?.timings?.classifyMs !== undefined ? { classifyMs: recipeAttempt.timings.classifyMs } : {}), totalMs },
    elapsedMs: totalMs,
    reason: '已完成单次路由。读取返回的最小规则资源后，用原始需求生成页面规格，再依次执行需求覆盖、契约、构建和静态预检。'
  });
}

try {
  main();
} catch (error) {
  print({ status: 'failed', outcome: 'failed', recipeName: null, fallbackReason: error.message, reason: error.message });
  process.exitCode = 1;
}
