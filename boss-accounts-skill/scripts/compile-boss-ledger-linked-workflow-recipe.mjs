#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { resolveResources } from './resolve-resources.mjs';
import { compileLinkedListWizard } from './lib/boss-ledger-linked-workflow-recipe.mjs';
import { readRecipeRouteContext } from './lib/recipe-route-context.mjs';
import { runTimedNode, writeGenerationReport } from './lib/generation-performance.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';

function requirement(spec) {
  return `# ${spec.metadata.pageName} 需求说明\n\n${spec.metadata.request}\n\n## 生成边界\n\n- 本页面由查询列表与分阶段配置流程的受控组合生成。\n- 静态预检通过后，预览交由人工验收。\n`;
}

function design(spec) {
  return `# ${spec.metadata.pageName} 页面设计\n\n## 需求\n\n- 从查询列表发起新增配置，完成后返回同一列表。\n- 列表查询条件、分页与操作上下文在流程往返时保持。\n\n## 页面方案\n\n- 选用查询列表串联分阶段配置流程。\n- 新增操作进入全页步骤配置；提交后显示完成反馈，并支持返回列表或继续新增。\n\n## Routing\n\n- Family: \`${spec.metadata.family}\`\n- Rule template: \`${spec.metadata.templateId}\`\n- Runtime mode: \`${spec.metadata.executionMode}\`\n- Validated combinations: ${spec.metadata.validatedCombinations.map((id) => `\`${id}\``).join('、')}\n- Selection reason: ${spec.metadata.selectionReason}\n- Rejected candidates: 独立列表或独立流程都不能覆盖新增、提交和回写列表的完整路径。\n- Capabilities: ${spec.content.capabilities.join('、')}\n\n## Assumptions\n\n${spec.metadata.assumptions.map((item) => `- ${item}`).join('\n')}\n\n## Rule References\n\n${spec.metadata.ruleRefs.map((item) => `- \`${item}\``).join('\n')}\n`;
}

function review(spec) {
  return `# ${spec.metadata.pageName} 验收记录\n\n## 静态预检\n\n- [x] 页面规格契约、固定 Shell、组件引用、文案和响应式规则已通过。\n- [x] 列表至流程、提交至列表的受控链路已通过静态预检。\n\n## 人工验收\n\n- 预览：\`preview.html\`\n- [ ] 查询、重置、分页与列表字段符合需求。\n- [ ] 从新增入口进入步骤流程，逐步校验、上一步和下一步符合预期。\n- [ ] 提交后可继续新增或返回原列表；返回后新记录展示在列表中且来源上下文保留。\n\n## 结论\n\n- 状态：待人工验收\n- 记录：静态预检已通过；完整交互仍待人工打开预览确认。\n`;
}

try {
  const started = Date.now();
  const request = arg('--request');
  const changeArg = arg('--change');
  const replace = args.includes('--replace');
  if (!request || !changeArg || args.length !== (replace ? 5 : 4)) throw new Error('Usage: node scripts/compile-boss-ledger-linked-workflow-recipe.mjs --request "<业务需求>" --change changes/{change-id} [--replace]');
  const route = readRecipeRouteContext(request) || resolveResources(request, 'generate');
  if (route.module !== 'boss-ledger') throw new Error('该需求不属于老板管账。');
  const changeDir = resolve(root, changeArg);
  const changesRoot = resolve(root, 'changes');
  if (!changeDir.startsWith(`${changesRoot}/`) || (existsSync(changeDir) && !replace)) throw new Error('Change 必须是不存在的 changes/ 子目录。');
  const compileStarted = Date.now();
  const spec = compileLinkedListWizard({ rawRequest: request, changeId: basename(changeDir) });
  const timings = { compileMs: Date.now() - compileStarted };
  timings.prepareMs = replace ? 0 : runTimedNode(root, 'fast preparation', 'scripts/prepare-boss-ledger-page-spec.mjs', [changeArg, 'form.staged-flow']);
  writeFileSync(resolve(changeDir, 'requirement.md'), requirement(spec));
  writeFileSync(resolve(changeDir, 'page-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  writeFileSync(resolve(changeDir, 'page-design.md'), design(spec));
  timings.coverageMs = runTimedNode(root, 'requirement coverage', 'scripts/check-page-requirement-coverage.mjs', ['--system', 'boss-ledger', '--spec', `${changeArg}/page-spec.json`]);
  timings.checkMs = runTimedNode(root, 'page-spec contract', 'scripts/check-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  timings.buildMs = runTimedNode(root, 'page build', 'scripts/build-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  timings.verifyMs = runTimedNode(root, 'static preflight', 'scripts/verify-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  writeFileSync(resolve(changeDir, 'review.md'), review(spec));
  timings.recipeTotalMs = Date.now() - started;
  timings.totalMs = timings.recipeTotalMs;
  writeGenerationReport(changeDir, { system: 'boss-ledger', recipeName: 'linked-list-wizard', outcome: 'generated', fallbackReason: null, timings });
  console.log(`boss-ledger-linked-workflow-recipe: pass (${relative(root, changeDir)})`);
  console.log('- route: source list -> full-page workflow -> source list');
  console.log('- acceptance: static preflight passed; human review remains required');
} catch (error) {
  console.error(`boss-ledger-linked-workflow-recipe: failed\n- ${error.message}`);
  process.exit(1);
}
