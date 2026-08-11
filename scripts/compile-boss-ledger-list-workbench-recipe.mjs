#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { resolveResources } from './resolve-resources.mjs';
import { compileListWorkbench, parseListWorkbenchRequest } from './lib/boss-ledger-list-workbench-recipe.mjs';
import { normalizeRecipeRequest } from './lib/recipe-request-bridge.mjs';
import { readRecipeRouteContext } from './lib/recipe-route-context.mjs';
import { runTimedNode, writeGenerationReport } from './lib/generation-performance.mjs';

const root = process.cwd();
const args = process.argv.slice(2);

function arg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

function pageDesign(spec) {
  const { metadata, content } = spec;
  return `# ${metadata.pageName} 页面设计

## 需求

- 使用列表工作台参数化配方生成。
- 列表保留查询上下文，按需求组合详情、新增、编辑和删除动作。

## 页面方案

- 选用查询列表工作台。
- 详情、新增、编辑和删除均服务于当前列表记录，不创建独立业务入口。
- 删除使用官方确认弹窗，确认后从当前客户端列表移除。

## Routing

- Family: \`${metadata.family}\`
- Rule template: \`${metadata.templateId}\`
- Runtime mode: \`${metadata.executionMode}\`
- Selection reason: ${metadata.selectionReason}
- Rejected candidates: 统计列表、独立详情页和分阶段流程不符合当前查询与处理任务。
- Capabilities: ${content.capabilities.join('、')}

## Assumptions

${metadata.assumptions.map((assumption) => `- ${assumption}`).join('\n')}

## Rule References

${metadata.ruleRefs.map((rule) => `- \`${rule}\``).join('\n')}
`;
}

function requirement(spec) {
  return `# ${spec.metadata.pageName} 需求说明\n\n${spec.metadata.request}\n\n## 生成边界\n\n- 本页面由列表工作台参数化配方生成。\n- 静态预检通过后，预览交由人工验收。\n`;
}

function review(spec) {
  return `# ${spec.metadata.pageName} 验收记录\n\n## 静态预检\n\n- [x] Page Spec 契约、固定 Shell、组件引用、文案和响应式规则已通过。\n- [x] 列表工作台候选组合已通过静态预检。\n\n## 人工验收\n\n- 预览：\`preview.html\`\n- [ ] 查询、重置、分页和列表字段符合需求。\n- [ ] 详情抽屉关闭后保留列表上下文。\n- [ ] 新增和编辑抽屉保存后正确关闭并更新列表。\n- [ ] 删除二次确认说明对象、影响和不可撤销结果，确认后移除当前记录。\n\n## 结论\n\n- 状态：待人工验收\n- 记录：静态预检已通过；完整组合仍待人工打开预览确认。\n`;
}

try {
  const started = Date.now();
  const request = arg('--request');
  const changeArg = arg('--change');
  if (!request || !changeArg || args.length !== 4) {
    throw new Error('Usage: node scripts/compile-boss-ledger-list-workbench-recipe.mjs --request "<业务需求>" --change changes/{change-id}');
  }
  const normalizedRequest = normalizeRecipeRequest(request);
  const routedContext = readRecipeRouteContext(request);
  const rawRoute = routedContext || resolveResources(request, 'generate');
  const route = rawRoute.status === 'resolved' && ['query-list', 'inline-summary-list', 'card-summary-list'].includes(rawRoute.intent)
    ? rawRoute
    : routedContext || resolveResources(normalizedRequest, 'generate');
  const expectedResources = [
    'modules/boss-ledger/execution/context-packs/core.md',
    'modules/boss-ledger/execution/context-packs/index.md',
    'modules/boss-ledger/execution/context-packs/list.md'
  ];
  if (route.status !== 'resolved' || route.module !== 'boss-ledger' || !['query-list', 'inline-summary-list', 'card-summary-list'].includes(route.intent)) {
    throw new Error('该需求未唯一命中老板管账的查询列表配方。');
  }
  if (JSON.stringify(route.resources) !== JSON.stringify(expectedResources)) {
    throw new Error('列表工作台配方只能读取 Boss Ledger 的核心、索引和列表规则包。');
  }
  const changeDir = resolve(root, changeArg);
  const changesRoot = resolve(root, 'changes');
  if (!changeDir.startsWith(`${changesRoot}/`) || existsSync(changeDir)) throw new Error('Change 必须是不存在的 changes/ 子目录。');
  const changeId = basename(changeDir);
  const compileStarted = Date.now();
  const spec = compileListWorkbench({ rawRequest: normalizedRequest, changeId });
  const timings = { compileMs: Date.now() - compileStarted };
  timings.prepareMs = runTimedNode(root, 'fast preparation', 'scripts/prepare-boss-ledger-page-spec.mjs', [changeArg, spec.metadata.templateId]);
  writeFileSync(resolve(changeDir, 'requirement.md'), requirement(spec));
  writeFileSync(resolve(changeDir, 'page-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  writeFileSync(resolve(changeDir, 'page-design.md'), pageDesign(spec));
  timings.coverageMs = runTimedNode(root, 'requirement coverage', 'scripts/check-page-requirement-coverage.mjs', ['--system', 'boss-ledger', '--spec', `${changeArg}/page-spec.json`]);
  timings.checkMs = runTimedNode(root, 'page-spec contract', 'scripts/check-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  timings.buildMs = runTimedNode(root, 'page build', 'scripts/build-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  timings.verifyMs = runTimedNode(root, 'static preflight', 'scripts/verify-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  writeFileSync(resolve(changeDir, 'review.md'), review(spec));
  timings.recipeTotalMs = Date.now() - started;
  timings.totalMs = timings.recipeTotalMs;
  writeGenerationReport(changeDir, { system: 'boss-ledger', recipeName: 'list-workbench', outcome: 'generated', fallbackReason: null, timings });
  console.log(`boss-ledger-list-workbench-recipe: pass (${relative(root, changeDir)})`);
  console.log(`- elapsed: ${Date.now() - started}ms`);
  console.log('- route: list workbench with requested operations');
  console.log('- acceptance: static preflight passed; human review remains required');
} catch (error) {
  console.error(`boss-ledger-list-workbench-recipe: failed\n- ${error.message}`);
  process.exit(1);
}
