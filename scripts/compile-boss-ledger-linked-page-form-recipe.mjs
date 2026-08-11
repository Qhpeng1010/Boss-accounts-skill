#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { resolveResources } from './resolve-resources.mjs';
import { compileLinkedListPageForm } from './lib/boss-ledger-linked-workflow-recipe.mjs';
import { readRecipeRouteContext } from './lib/recipe-route-context.mjs';
import { runTimedNode, writeGenerationReport } from './lib/generation-performance.mjs';

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';
try {
  const started = Date.now();
  const request = arg('--request');
  const changeArg = arg('--change');
  if (!request || !changeArg || args.length !== 4) throw new Error('Usage: node scripts/compile-boss-ledger-linked-page-form-recipe.mjs --request "<业务需求>" --change changes/{change-id}');
  const route = readRecipeRouteContext(request) || resolveResources(request, 'generate');
  if (route.module !== 'boss-ledger') throw new Error('该需求不属于老板管账。');
  const changeDir = resolve(root, changeArg);
  if (!changeDir.startsWith(`${resolve(root, 'changes')}/`) || existsSync(changeDir)) throw new Error('Change 必须是不存在的 changes/ 子目录。');
  const compileStarted = Date.now();
  const spec = compileLinkedListPageForm({ rawRequest: request, changeId: basename(changeDir) });
  const timings = { compileMs: Date.now() - compileStarted };
  timings.prepareMs = runTimedNode(root, 'fast preparation', 'scripts/prepare-boss-ledger-page-spec.mjs', [changeArg, 'form.page-simple']);
  writeFileSync(resolve(changeDir, 'requirement.md'), `# ${spec.metadata.pageName} 需求说明\n\n${spec.metadata.request}\n\n- 本页面由查询列表与全页新增表单的受控组合生成。\n`);
  writeFileSync(resolve(changeDir, 'page-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
  writeFileSync(resolve(changeDir, 'page-design.md'), `# ${spec.metadata.pageName} 页面设计\n\n## Routing\n\n- Family: \`${spec.metadata.family}\`\n- Rule template: \`${spec.metadata.templateId}\`\n- Runtime mode: \`${spec.metadata.executionMode}\`\n- Validated combinations: ${spec.metadata.validatedCombinations.map((id) => `\`${id}\``).join('、')}\n- Selection reason: ${spec.metadata.selectionReason}\n- Rejected candidates: 独立列表或独立表单不能覆盖新增和回写列表的完整路径。\n- Capabilities: ${spec.content.capabilities.join('、')}\n\n## Assumptions\n\n${spec.metadata.assumptions.map((item) => `- ${item}`).join('\n')}\n\n## Rule References\n\n${spec.metadata.ruleRefs.map((item) => `- \`${item}\``).join('\n')}\n`);
  timings.coverageMs = runTimedNode(root, 'requirement coverage', 'scripts/check-page-requirement-coverage.mjs', ['--system', 'boss-ledger', '--spec', `${changeArg}/page-spec.json`]);
  timings.checkMs = runTimedNode(root, 'page-spec contract', 'scripts/check-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  timings.buildMs = runTimedNode(root, 'page build', 'scripts/build-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  timings.verifyMs = runTimedNode(root, 'static preflight', 'scripts/verify-boss-ledger-page-spec.mjs', [`${changeArg}/page-spec.json`]);
  writeFileSync(resolve(changeDir, 'review.md'), `# ${spec.metadata.pageName} 验收记录\n\n## 静态预检\n\n- [x] 页面规格、固定 Shell 和完整链路已通过静态预检。\n\n## 人工验收\n\n- [ ] 从列表进入全页表单，提交后返回原列表并显示新记录。\n\n## 结论\n\n- 状态：待人工验收\n`);
  timings.recipeTotalMs = Date.now() - started;
  timings.totalMs = timings.recipeTotalMs;
  writeGenerationReport(changeDir, { system: 'boss-ledger', recipeName: 'linked-list-page-form', outcome: 'generated', fallbackReason: null, timings });
  console.log(`boss-ledger-linked-page-form-recipe: pass (${relative(root, changeDir)})`);
} catch (error) {
  console.error(`boss-ledger-linked-page-form-recipe: failed\n- ${error.message}`);
  process.exit(1);
}
