#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyBossLedgerGeneration } from './lib/boss-ledger-generation-entry.mjs';
import { compileLinkedListPageForm, compileLinkedListWizard } from './lib/boss-ledger-linked-workflow-recipe.mjs';
import { validatePageSpec } from './lib/boss-ledger-page-spec.mjs';
import { createTestMcpReceipt, testMcpEnvironment } from './test-support/boss-ledger-mcp-receipt.mjs';

const root = process.cwd();
const request = `创建老板管账的分账规则查询列表页面。

查询条件：规则名称、规则类型、规则渠道、生效日期。
列表字段：规则编号、规则名称、规则类型、规则渠道、渠道下级、生效日期、规则状态、预计到账金额。

点击新增分账规则进行配置，页面分为3步，带交互，可上一步、下一步、最后提交。
第一步：规则名称、规则类型、规则渠道、渠道下级、生效日期。
第二步：分账方、手续费、预计到账金额、预计扣账金额。
第三步：预览页面。
完成后可以继续新增，也可以返回列表查看。`;
const changeId = `20260806-linked-workflow-test-${randomBytes(4).toString('hex')}`;
const changeArg = `changes/${changeId}`;
const changeDir = resolve(root, changeArg);
const pageFormChangeId = `20260806-linked-page-form-test-${randomBytes(4).toString('hex')}`;
const pageFormChangeArg = `changes/${pageFormChangeId}`;
const pageFormChangeDir = resolve(root, pageFormChangeArg);
const pageFormRequest = '创建老板管账的商户查询列表页面。查询条件：商户名称、商户编号、商户状态。列表字段：商户编号、商户名称、商户状态、创建时间。点击新增商户，使用全页表单填写商户名称、商户编号、商户状态，提交后返回列表查看。';
const colonPrefixedRequest = request.replace('创建老板管账的分账规则查询列表页面。', '老板管账：创建一个分账查询页面。');
const groupedRequest = `生成一个“商户结算账户开通管理”页面。

页面首页为开通申请查询列表，查询条件：申请日期、商户名称、申请状态、结算主体。列表字段：申请单号、商户名称、结算主体、收款账户、申请时间、申请状态。右上角提供“新建申请”按钮。

点击“新建申请”后，在新标签页打开全页录入流程，顶部常驻三步步骤条：

第一步：分为“商户基本信息”和“经营资质信息”两个分组，填写商户名称、统一社会信用代码、经营地址、联系人、营业执照、法人信息。
第二步：分为“收款账户信息”和“结算规则”两个分组，填写开户名称、开户银行、银行卡号、账户类型、结算周期、手续费承担方、到账通知方式。
第三步：分为“材料复核”和“提交确认”两个分组，核验营业执照、法人身份、银行卡材料，并确认协议与风险提示后提交。

支持保存草稿、上一步、下一步和提交申请；关闭录入标签后保留原查询列表的筛选和分页状态。`;
const receipts = [];

try {
  const decision = classifyBossLedgerGeneration(request);
  if (decision.status !== 'fast' || decision.recipe !== 'linked-list-wizard') throw new Error('Linked list-to-wizard request did not select the workflow recipe.');
  const incomplete = classifyBossLedgerGeneration('老板管账创建一个分账查询的页面，可以点击新增分账规则进行配置。分账规则页面分为3步，可上一步下一步最后提交。第一步：规则名称。第二步：分账方。第三步：预览页面。完成后返回列表查看。');
  if (incomplete.status !== 'clarify' || !incomplete.question?.includes('查询条件')) throw new Error('A linked workflow without list fields did not request the missing list contract.');
  const spec = compileLinkedListWizard({ rawRequest: request, changeId });
  if (validatePageSpec(spec, { root }).length) throw new Error(`Linked workflow Page Spec is invalid: ${validatePageSpec(spec, { root }).join('; ')}`);
  if (spec.metadata.pageName !== '分账规则查询') throw new Error(`Linked workflow title is invalid: ${spec.metadata.pageName}`);
  const colonPrefixedSpec = compileLinkedListWizard({ rawRequest: colonPrefixedRequest, changeId });
  if (colonPrefixedSpec.metadata.pageName !== '分账查询') throw new Error(`Colon-prefixed title is invalid: ${colonPrefixedSpec.metadata.pageName}`);
  if (!spec.form.sourceList || spec.form.sourceList.table.primaryAction?.workflowTarget !== 'form') throw new Error('Source-list create action was not linked to the full-page workflow.');
  if (spec.form.submit.success.actionType !== 'return-source' || !spec.content.capabilities.includes('form.sourceList')) throw new Error('Workflow result does not return to its source list.');
  const groupedDecision = classifyBossLedgerGeneration(groupedRequest);
  if (groupedDecision.status !== 'fast' || groupedDecision.recipe !== 'linked-list-wizard' || groupedDecision.route.template !== 'form.staged-grouped-flow') throw new Error('Linked grouped workflow request did not select the grouped workflow recipe.');
  const groupedSpec = compileLinkedListWizard({ rawRequest: groupedRequest, changeId });
  const groupedErrors = validatePageSpec(groupedSpec, { root });
  if (groupedErrors.length) throw new Error(`Linked grouped workflow Page Spec is invalid: ${groupedErrors.join('; ')}`);
  if (groupedSpec.metadata.templateId !== 'form.staged-grouped-flow' || groupedSpec.metadata.validatedCombinations[0] !== 'form.steps-grouped-source-list-basic') throw new Error('Linked grouped workflow did not declare the verified grouped source-list combination.');
  if (!groupedSpec.form.sourceList || groupedSpec.form.sourceList.table.primaryAction?.workflowTarget !== 'form') throw new Error('Grouped workflow source-list create action was not linked to the full-page workflow.');
  if (groupedSpec.form.steps.length !== 3 || groupedSpec.form.steps.some((step) => !Array.isArray(step.groups) || step.groups.length !== 2)) throw new Error('Grouped workflow did not preserve three steps with two business groups each.');
  if (!groupedSpec.content.capabilities.includes('form.stepGroups') || groupedSpec.form.submit.success.actionType !== 'return-source') throw new Error('Grouped workflow is missing grouped-step or source-return capabilities.');
  const pageFormDecision = classifyBossLedgerGeneration(pageFormRequest);
  if (pageFormDecision.status !== 'fast' || pageFormDecision.recipe !== 'linked-list-page-form') throw new Error('Linked list-to-page-form request did not select the workflow recipe.');
  const pageForm = compileLinkedListPageForm({ rawRequest: pageFormRequest, changeId });
  if (validatePageSpec(pageForm, { root }).length) throw new Error(`Linked page form Page Spec is invalid: ${validatePageSpec(pageForm, { root }).join('; ')}`);
  const workflowReceipt = createTestMcpReceipt(request, 'form');
  receipts.push(workflowReceipt);
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/compile-boss-ledger-linked-workflow-recipe.mjs'), '--request', request, '--change', changeArg], { cwd: root, encoding: 'utf8', timeout: 30_000, env: testMcpEnvironment(workflowReceipt, spec.metadata.request) });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Linked workflow compiler failed.');
  if (!existsSync(resolve(changeDir, 'preview.html')) || !existsSync(resolve(changeDir, 'review.md'))) throw new Error('Linked workflow compiler did not produce preview and review artifacts.');
  const workflowReport = JSON.parse(readFileSync(resolve(changeDir, 'generation-report.json'), 'utf8'));
  if (workflowReport.recipeName !== 'linked-list-wizard' || !Number.isInteger(workflowReport.timings.totalMs)) throw new Error('Linked workflow compiler did not persist timing data.');
  const app = readFileSync(resolve(changeDir, 'page-spec-runtime.js'), 'utf8');
  if (!app.includes('LinkedWorkflowPage') || !app.includes('sourceRecordFromValues')) throw new Error('Preview runtime does not include the linked workflow behavior.');
  const pageFormReceipt = createTestMcpReceipt(pageFormRequest, 'form');
  receipts.push(pageFormReceipt);
  const pageFormResult = spawnSync(process.execPath, [resolve(root, 'scripts/compile-boss-ledger-linked-page-form-recipe.mjs'), '--request', pageFormRequest, '--change', pageFormChangeArg], { cwd: root, encoding: 'utf8', timeout: 30_000, env: testMcpEnvironment(pageFormReceipt, pageForm.metadata.request) });
  if (pageFormResult.status !== 0) throw new Error(pageFormResult.stderr || pageFormResult.stdout || 'Linked page-form compiler failed.');
  if (!existsSync(resolve(pageFormChangeDir, 'preview.html')) || !existsSync(resolve(pageFormChangeDir, 'review.md'))) throw new Error('Linked page-form compiler did not produce preview and review artifacts.');
  const pageFormReport = JSON.parse(readFileSync(resolve(pageFormChangeDir, 'generation-report.json'), 'utf8'));
  if (pageFormReport.recipeName !== 'linked-list-page-form' || !Number.isInteger(pageFormReport.timings.totalMs)) throw new Error('Linked page-form compiler did not persist timing data.');
  console.log('boss-ledger-linked-workflow-recipe: pass');
} catch (error) {
  console.error(`boss-ledger-linked-workflow-recipe: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(changeDir, { recursive: true, force: true });
  rmSync(pageFormChangeDir, { recursive: true, force: true });
  receipts.forEach((receipt) => receipt.cleanup());
}
