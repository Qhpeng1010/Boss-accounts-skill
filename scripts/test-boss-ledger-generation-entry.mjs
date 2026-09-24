#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyBossLedgerGeneration } from './lib/boss-ledger-generation-entry.mjs';

const root = process.cwd();
const request = '做一个老板管账的页面，可以点击新增分账规则进行配置，分账规则页面分为3步，带交互，可上一步下一步最后提交。第一步：规则名称、规则类型、规则渠道、渠道下级、生效日期。第二步：分账方、手续费、预计到账金额、预计扣账金额。第三步：预览页面。落地页展示完成，可以继续新增，也可以返回列表查看。';
const flexibleRequest = '老板管账结算规则页面。检索条件：规则名称、规则状态。结果字段：规则编号、规则名称、规则状态。打开记录明细。';
const linkedTabRequest = '创建老板管账的分账规则查询页面。查询条件：规则名称、规则状态。列表字段：规则编号、规则名称、规则状态。支持新增，新增使用新标签页，填写规则名称、规则状态，提交后展示成功页并返回列表。';
const linkedImplicitTabRequest = '创建老板管账的渠道联系人查询页面。查询条件：姓名、手机号、所属渠道。列表展示：姓名、手机号、所属渠道。支持新增，点击新增后，填写姓名、手机号、所属渠道，提交后返回列表';
const groupedPageRequest = '创建老板管账的商户查询页面。查询条件：商户名称、商户编号。列表字段：商户编号、商户名称、操作（编辑、查看详情）。点击新增按钮后在新标签页打开，新增商户有3个模块信息：商户基本信息、法人信息、经营资质信息。';
const defaultRecipeRequest = '创建老板管账结算规则查询列表。查询条件：规则名称、规则状态。列表字段：规则编号、规则名称、规则状态。';
let generatedChangeDir;
let defaultGeneratedChangeDir;

try {
  const fast = classifyBossLedgerGeneration(request);
  if (fast.status !== 'fast' || fast.recipe !== 'structured-wizard' || fast.route?.intent !== 'wizard') {
    throw new Error('Structured staged workflow did not select the verified fast recipe.');
  }
  const flexible = classifyBossLedgerGeneration(flexibleRequest);
  if (flexible.status !== 'fast' || flexible.recipe !== 'list-workbench' || flexible.channel !== 'flexible') {
    throw new Error('Flexible Boss Ledger wording did not use the semantic bridge channel.');
  }
  if (!flexible.inputRequest?.includes('查询条件') || !flexible.inputRequest?.includes('列表字段')) {
    throw new Error('Flexible Boss Ledger wording was not normalized into the recipe contract.');
  }
  const linkedTab = classifyBossLedgerGeneration(linkedTabRequest);
  if (linkedTab.status !== 'fast' || linkedTab.recipe !== 'linked-list-page-form') {
    throw new Error('New-tab create wording did not select the linked page-form recipe.');
  }
  const linkedImplicitTab = classifyBossLedgerGeneration(linkedImplicitTabRequest);
  if (linkedImplicitTab.status !== 'fast' || linkedImplicitTab.recipe !== 'linked-list-page-form') {
    throw new Error('List create-and-return wording without an explicit tab label did not select the linked page-form recipe.');
  }
  const groupedPage = classifyBossLedgerGeneration(groupedPageRequest);
  if (groupedPage.status !== 'fallback' || groupedPage.decision !== 'natural-generation' || !groupedPage.reason?.includes('多个业务信息分组')) {
    throw new Error('A grouped full-page form was incorrectly compressed into the simple page-form recipe.');
  }

  const fallback = classifyBossLedgerGeneration('运营人员登记渠道联系人，填写姓名、手机号码和所属渠道后保存。');
  if (fallback.status !== 'clarify' || !fallback.question?.includes('页面类型')) {
    throw new Error('A standalone request without a page intent did not ask for the missing intent.');
  }
  const missingFields = classifyBossLedgerGeneration('创建老板管账的结算规则查询列表。');
  if (missingFields.status !== 'clarify' || !missingFields.question?.includes('查询条件') || !missingFields.question?.includes('列表')) {
    throw new Error('Missing Boss Ledger list fields did not produce a targeted clarification.');
  }
  const missingService = classifyBossLedgerGeneration('做一个查询列表页面。');
  if (missingService.status !== 'clarify' || !missingService.question?.includes('查询条件')) {
    throw new Error('A standalone list request without fields did not produce a targeted clarification.');
  }
  const naturalGeneration = classifyBossLedgerGeneration('做一个老板管账渠道联系人独立表单，填写姓名、手机号和所属渠道。');
  if (naturalGeneration.status !== 'fallback' || naturalGeneration.decision !== 'natural-generation' || naturalGeneration.stage !== 'recipe') {
    throw new Error('A clear non-recipe request did not continue to controlled natural-language generation.');
  }
  const blocked = classifyBossLedgerGeneration('做一个老板管账空状态页面。');
  if (blocked.status !== 'blocked' || blocked.decision !== 'blocked' || blocked.stage !== 'capability') {
    throw new Error('An unavailable Boss Ledger capability was not distinguished from a recipe miss.');
  }

  const result = spawnSync(process.execPath, [resolve(root, 'scripts/generate-boss-ledger-page.mjs'), '--request', request, '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (result.error?.code === 'ETIMEDOUT' || result.status !== 0) throw new Error(result.stderr || result.stdout || 'Generation entry failed.');
  const delivered = JSON.parse(result.stdout);
  if (delivered.status !== 'generated' || delivered.recipe !== 'structured-wizard') {
    throw new Error('Generation entry did not report the recipe-generated delivery.');
  }
  if (!/^changes\/\d{8}-[a-z0-9-]+$/.test(delivered.change)) {
    throw new Error(`Generation entry allocated an invalid Change id: ${delivered.change}`);
  }
  generatedChangeDir = resolve(root, delivered.change);
  if (!existsSync(resolve(generatedChangeDir, 'preview.html')) || !existsSync(resolve(generatedChangeDir, 'review.md'))) {
    throw new Error('Generation entry did not produce the preview and human review record.');
  }
  const review = readFileSync(resolve(generatedChangeDir, 'review.md'), 'utf8');
  if (!review.includes('静态预检已通过') || review.includes('浏览器自动验收')) {
    throw new Error('Generation entry did not preserve the manual-acceptance boundary.');
  }

  const defaultGenerated = spawnSync(process.execPath, [resolve(root, 'scripts/generate-page.mjs'), '--request', defaultRecipeRequest], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (defaultGenerated.error?.code === 'ETIMEDOUT' || defaultGenerated.status !== 0) {
    throw new Error(defaultGenerated.stderr || defaultGenerated.stdout || 'Default recipe selection failed.');
  }
  const defaultResult = JSON.parse(defaultGenerated.stdout);
  if (defaultResult.status !== 'generated' || defaultResult.recipeName !== 'list-workbench') {
    throw new Error('The unified entry did not automatically select the list workbench recipe.');
  }
  defaultGeneratedChangeDir = resolve(root, defaultResult.change);
  if (!existsSync(resolve(defaultGeneratedChangeDir, 'preview.html'))) {
    throw new Error('Automatic recipe selection did not produce a preview.');
  }
  console.log('boss-ledger-generation-entry: pass');
} catch (error) {
  console.error(`boss-ledger-generation-entry: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  if (generatedChangeDir) rmSync(generatedChangeDir, { recursive: true, force: true });
  if (defaultGeneratedChangeDir) rmSync(defaultGeneratedChangeDir, { recursive: true, force: true });
}
