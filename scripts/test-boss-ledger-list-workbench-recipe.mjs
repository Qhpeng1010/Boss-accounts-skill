#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyBossLedgerGeneration } from './lib/boss-ledger-generation-entry.mjs';
import { compileListWorkbench, parseListWorkbenchRequest } from './lib/boss-ledger-list-workbench-recipe.mjs';
import { validatePageSpec } from './lib/boss-ledger-page-spec.mjs';

const root = process.cwd();
const request = `创建老板管账的分账规则管理列表页。

支持按规则名称、规则编号、商户编号、商户名称、规则状态、分账渠道、创建时间、更新时间、生效日期和失效日期查询，共 10 个查询条件。列表展示规则编号、规则名称、商户名称、商户编号、规则类型、分账渠道、渠道下级、规则状态、创建时间、更新时间、生效日期、失效日期、分账方式、分账周期、手续费率、待分账金额、预计到账金额、预计扣账金额、创建人和最后修改人，共 20 列。

点击新增规则，在右侧抽屉填写规则名称、商户名称、商户编号、规则类型、分账渠道、渠道下级、规则状态、生效日期、分账方式和手续费率。以上字段均必填，保存后关闭抽屉并把新记录显示在列表首行。

点击编辑，在右侧抽屉修改以上 10 个字段，保存后关闭抽屉并更新当前记录。

点击任一记录查看详情，在右侧抽屉只读展示完整规则信息，关闭后保留原列表和查询条件。

每条记录提供删除操作，删除前必须二次确认，确认后从列表移除并反馈删除成功。

不需要批量操作，默认每页 20 条。`;
const changeId = `20260803-list-workbench-test-${randomBytes(4).toString('hex')}`;
const changeArg = `changes/${changeId}`;
const changeDir = resolve(root, changeArg);
const merchantChangeId = `20260806-merchant-list-expression-test-${randomBytes(4).toString('hex')}`;
const merchantChangeArg = `changes/${merchantChangeId}`;
const merchantChangeDir = resolve(root, merchantChangeArg);
const basicRequest = '创建老板管账的结算规则查询列表页。查询条件包括创建时间区间、规则名称和规则状态。列表展示规则编号、规则名称、商户名称、规则状态和创建时间。';
const inlineSummaryRequest = '创建老板管账的结算规则查询页面。查询条件包括规则名称、商户编号、规则状态和创建时间。列表展示规则编号、规则名称、商户编号、规则状态、待结算金额、创建时间和操作。在结果工具栏左侧展示 2 项简单统计：规则总数、待处理规则数。支持新增规则、导出和查看详情。';
const genericTwoItemSummaryRequest = '创建老板管账的商品查询页面。查询条件包括商品名称、商品编号和商品状态。列表展示商品编号、商品名称、商品状态和创建时间。页面顶部展示 2 项统计：商品总数量、已发货数量。支持查看详情。';
const cardSummaryRequest = '创建老板管账的结算账单查询页面。查询条件包括账单编号、商户名称、结算状态和结算日期。列表展示账单编号、商户名称、结算金额、手续费、到账金额、结算状态、结算日期和操作。在列表结果区展示 4 项重要统计：账单总数、结算总金额、已结算金额、待结算金额。支持新增账单、导出、刷新和查看详情。';
const structuredProductRequest = `创建老板管账的【日本报备商品查询】页面。

查询条件：
- 商品名称
- 商品编号
- 商品类型
- 商品发货状态
- 商品上架日期

列表字段：
- 商品名称
- 商品编号
- 商品类型
- 商品发货状态
- 商品上架日期
- 操作

展示4项统计：
- 商品总数量
- 商品已发货数量
- 商品运输中数量
- 商品代发数量

操作：
- 新增商品：使用抽屉表单，填写商品名称、商品编号、商品类型、商品发货状态、商品上架日期。
- 查看详情：使用详情抽屉，保留列表查询条件和分页上下文，只读展示商品完整信息。`;
const literalLineBreakProductRequest = structuredProductRequest.replace(/\n/g, '\\n');
const normalizedNaturalRequest = `创建一个页面，老板管账商户查询页面
条件：注册时间、代理名称、部门名称、商户名称、商户编号、业务角色、首笔交易时间
table列表：注册时间、商户编号、商户名称、商户简称、部门名称、直属代理、业务角色`;
const merchantRequest = `做一个老板管账的商户查询列表页面。
一级菜单：商户管理；二级菜单：商户查询。
查询条件：商户编号、商户名称、商户状态、所属行业。
列表字段：商户编号、商户名称、所属行业、签约时间、商户状态、操作（查看、编辑、删除）。
新增商户：基础信息（商户名称、商户简称、所属行业、联系人姓名、联系人手机号、商户状态）。`;
const customActionRequest = merchantRequest.replace('查看、编辑、删除', '查看、编辑、删除、渠道绑定');

try {
  const classified = classifyBossLedgerGeneration(request);
  if (classified.status !== 'fast' || classified.recipe !== 'list-workbench') {
    throw new Error('The unified generation entry did not select the list workbench recipe.');
  }
  const parsed = parseListWorkbenchRequest(request);
  if (parsed.pageName !== '分账规则管理') throw new Error('List page name was not parsed.');
  const bracketed = parseListWorkbenchRequest(request.replace('创建老板管账的分账规则管理列表页', '创建老板管账的【分账规则管理】列表页'));
  if (bracketed.pageName !== '分账规则管理') throw new Error('Decorative page-name brackets were not normalized.');
  if (JSON.stringify(parsed.queryLabels) !== JSON.stringify(['规则名称', '规则编号', '商户编号', '商户名称', '规则状态', '分账渠道', '创建时间', '更新时间', '生效日期', '失效日期'])) {
    throw new Error('Query fields were not parsed from the request.');
  }
  if (parsed.columnLabels.length !== 20 || parsed.columnLabels.at(-1) !== '最后修改人') {
    throw new Error('Table fields were not parsed from the request.');
  }
  if (!parsed.operations.detail || !parsed.operations.create || !parsed.operations.edit || !parsed.operations.delete) {
    throw new Error('The list workbench did not retain all four requested operations.');
  }
  if (parsed.formLabels.length !== 10 || parsed.formLabels.at(-1) !== '手续费率') {
    throw new Error('The list workbench did not expand the edit field reference to the create fields.');
  }
  const basic = parseListWorkbenchRequest(basicRequest);
  if (basic.queryLabels.length !== 3 || basic.columnLabels.length !== 5 || Object.keys(basic.operations).length !== 0) {
    throw new Error('A basic list request using “查询条件包括” was not parsed without optional row operations.');
  }
  const basicClassified = classifyBossLedgerGeneration(basicRequest);
  if (basicClassified.status !== 'fast' || basicClassified.recipe !== 'list-workbench') {
    throw new Error('A basic list request using “查询条件包括” did not select the list workbench recipe.');
  }
  const inlineSummary = parseListWorkbenchRequest(inlineSummaryRequest);
  if (inlineSummary.summary?.kind !== 'inline' || inlineSummary.summary.labels.length !== 2) {
    throw new Error('An explicitly declared two-item toolbar summary was not parsed.');
  }
  const inlineSummaryCompiled = compileListWorkbench({ rawRequest: inlineSummaryRequest, changeId });
  if (inlineSummaryCompiled.metadata.templateId !== 'list.inline-summary' || !inlineSummaryCompiled.content.capabilities.includes('summary.inline') || inlineSummaryCompiled.list.summary?.items.length !== 2) {
    throw new Error('A two-item toolbar summary did not compile as an inline-summary list.');
  }
  const genericTwoItemSummary = parseListWorkbenchRequest(genericTwoItemSummaryRequest);
  if (genericTwoItemSummary.summary?.kind !== 'inline' || genericTwoItemSummary.summary.labels.length !== 2) {
    throw new Error('A generic two-item statistic request was not normalized into a toolbar summary.');
  }
  const genericTwoItemSummaryCompiled = compileListWorkbench({ rawRequest: genericTwoItemSummaryRequest, changeId });
  if (genericTwoItemSummaryCompiled.metadata.templateId !== 'list.inline-summary' || genericTwoItemSummaryCompiled.list.summary?.items.length !== 2 || genericTwoItemSummaryCompiled.list.statistics?.items?.length) {
    throw new Error('A generic two-item statistic request was not compiled as an inline-only summary.');
  }
  const cardSummary = parseListWorkbenchRequest(cardSummaryRequest);
  if (cardSummary.summary?.kind !== 'cards' || cardSummary.summary.labels.length !== 4) {
    throw new Error('An explicitly declared four-item result summary was not parsed.');
  }
  const cardSummaryCompiled = compileListWorkbench({ rawRequest: cardSummaryRequest, changeId });
  if (cardSummaryCompiled.metadata.templateId !== 'list.card-summary' || cardSummaryCompiled.metadata.executionMode !== 'page-spec-default' || !cardSummaryCompiled.content.capabilities.includes('statistics.cards') || cardSummaryCompiled.list.statistics?.items.length !== 4) {
    throw new Error('A four-item result summary did not compile as a statistics-card list.');
  }
  if (!cardSummaryCompiled.list.table.secondaryActions?.some((action) => action.type === 'export') || !cardSummaryCompiled.list.table.tools.includes('refresh')) {
    throw new Error('Requested export and refresh actions were not preserved in the list toolbar.');
  }
  const structuredProduct = parseListWorkbenchRequest(structuredProductRequest);
  if (structuredProduct.queryLabels.length !== 5 || structuredProduct.columnLabels.length !== 5 || structuredProduct.summary?.kind !== 'cards' || structuredProduct.summary.labels.length !== 4) {
    throw new Error('A structured bullet-list request was not parsed into isolated query, table, and statistics fields.');
  }
  const structuredProductCompiled = compileListWorkbench({ rawRequest: structuredProductRequest, changeId });
  if (validatePageSpec(structuredProductCompiled, { root }).length) {
    throw new Error('A structured bullet-list request did not produce a contract-valid page specification.');
  }
  if (new Set(structuredProductCompiled.list.table.columns.map((column) => column.key)).size !== structuredProductCompiled.list.table.columns.length) {
    throw new Error('A structured bullet-list request produced duplicate table field identifiers.');
  }
  if (structuredProductCompiled.list.table.rows.some((row) => row[structuredProductCompiled.list.table.rowKey] === 0) || structuredProductCompiled.list.table.rows[0][structuredProductCompiled.list.table.rowKey] === structuredProductCompiled.list.table.rows[1][structuredProductCompiled.list.table.rowKey]) {
    throw new Error('A structured bullet-list request produced non-unique table row keys.');
  }
  const literalLineBreakProduct = parseListWorkbenchRequest(literalLineBreakProductRequest);
  if (literalLineBreakProduct.queryLabels.length !== 5 || literalLineBreakProduct.columnLabels.length !== 5 || literalLineBreakProduct.summary?.kind !== 'cards' || literalLineBreakProduct.summary.labels.length !== 4) {
    throw new Error('A structured request containing literal line-break text was not normalized into isolated fields.');
  }
  const literalLineBreakProductCompiled = compileListWorkbench({ rawRequest: literalLineBreakProductRequest, changeId });
  if (new Set(literalLineBreakProductCompiled.list.table.columns.map((column) => column.key)).size !== literalLineBreakProductCompiled.list.table.columns.length || validatePageSpec(literalLineBreakProductCompiled, { root }).length) {
    throw new Error('A structured request containing literal line-break text produced an invalid list specification.');
  }
  const normalizedNatural = parseListWorkbenchRequest(normalizedNaturalRequest);
  if (normalizedNatural.pageName !== '商户查询' || normalizedNatural.queryLabels.length !== 7 || normalizedNatural.columnLabels.length !== 7) {
    throw new Error('Natural condition and table section headers were not normalized into a list workbench request.');
  }
  const normalizedNaturalClassified = classifyBossLedgerGeneration(normalizedNaturalRequest);
  if (normalizedNaturalClassified.status !== 'fast' || normalizedNaturalClassified.recipe !== 'list-workbench') {
    throw new Error('A normalized natural-language list request did not select the list workbench recipe.');
  }
  const merchant = parseListWorkbenchRequest(merchantRequest);
  if (merchant.primaryNav !== '商户管理' || merchant.sideNav !== '商户查询' || !merchant.operations.detail || merchant.formLabels.length !== 6 || merchant.formLabels.at(-1) !== '商户状态') {
    throw new Error('A standard merchant list request did not preserve menus, view action, or create fields.');
  }
  const merchantCompiled = compileListWorkbench({ rawRequest: merchantRequest, changeId });
  if (validatePageSpec(merchantCompiled, { root }).length || merchantCompiled.shell.primaryNav?.[0]?.label !== '商户管理' || merchantCompiled.shell.sideMenusByPrimary?.['requested-primary']?.[0]?.children?.[0]?.label !== '商户查询' || !merchantCompiled.list.table.rowActions?.some((action) => action.label === '查看')) {
    throw new Error('A standard merchant list request did not compile into a valid and complete list page.');
  }
  const merchantResult = spawnSync(process.execPath, [resolve(root, 'scripts/compile-boss-ledger-list-workbench-recipe.mjs'), '--request', merchantRequest, '--change', merchantChangeArg], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (merchantResult.status !== 0 || !existsSync(resolve(merchantChangeDir, 'preview.html'))) {
    throw new Error(merchantResult.stderr || merchantResult.stdout || 'A standard merchant list request failed static generation.');
  }
  const customAction = classifyBossLedgerGeneration(customActionRequest);
  if (customAction.status !== 'fallback' || customAction.decision !== 'natural-generation') {
    throw new Error('A clear list request with an unregistered custom action did not continue to controlled natural-language generation.');
  }

  const compiled = compileListWorkbench({ rawRequest: request, changeId });
  if (!compiled.content.capabilities.includes('query.advanced') || compiled.content.capabilities.includes('query.basic')) {
    throw new Error('More than six query fields must use advanced query mode.');
  }
  if (!compiled.content.capabilities.includes('table.columnSettings') || !compiled.list.table.tools?.includes('settings')) {
    throw new Error('Every list workbench must declare the fixed column-settings control.');
  }
  if (compiled.list.query.defaultExpanded !== false || Object.hasOwn(compiled.list.query, 'collapseThreshold') || compiled.list.query.fields.filter((field) => field.advanced).length !== 4) {
    throw new Error('Advanced query fields did not receive declarative primary/secondary grouping.');
  }
  if (!compiled.list.table.drawerDetail || compiled.list.table.primaryAction?.form?.fields.length !== 10) {
    throw new Error('The list workbench did not compile detail and create drawers.');
  }
  const compiledColumns = new Map(compiled.list.table.columns.map((column) => [column.label, column]));
  const formFields = compiled.list.table.primaryAction.form.fields;
  if (formFields.some((field) => compiledColumns.get(field.label)?.key !== field.key)) {
    throw new Error('Create/edit fields do not share stable keys with their table columns.');
  }
  if (compiledColumns.get('费率类型')?.format || compiledColumns.get('手续费率')?.format !== 'amount') {
    throw new Error('Rate type and numeric rate columns were classified incorrectly.');
  }
  if (compiled.list.table.rows.some((row) => Object.values(row).some((value) => String(value).includes('NaN')))) {
    throw new Error('Sample rows contain NaN text instead of typed values.');
  }
  const actions = compiled.list.table.rowActions || [];
  if (!actions.some((action) => action.type === 'edit') || !actions.some((action) => action.type === 'delete')) {
    throw new Error('The list workbench did not compile edit and delete row actions.');
  }
  const deleteAction = actions.find((action) => action.type === 'delete');
  if (deleteAction.confirm?.reversible !== false || !deleteAction.confirm?.successMessage) {
    throw new Error('Delete confirmation is missing irreversible impact or success feedback.');
  }

  const result = spawnSync(process.execPath, [resolve(root, 'scripts/compile-boss-ledger-list-workbench-recipe.mjs'), '--request', request, '--change', changeArg], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'List workbench compiler failed.');
  if (!existsSync(resolve(changeDir, 'preview.html')) || !existsSync(resolve(changeDir, 'review.md'))) {
    throw new Error('List workbench compiler did not produce preview and review artifacts.');
  }
  const spec = JSON.parse(readFileSync(resolve(changeDir, 'page-spec.json'), 'utf8'));
  if (!spec.content.capabilities.includes('table.deleteAction') || !spec.list.table.rowActions.some((action) => action.type === 'delete')) {
    throw new Error('Generated Page Spec does not expose the delete action.');
  }
  const review = readFileSync(resolve(changeDir, 'review.md'), 'utf8');
  if (!review.includes('静态预检已通过') || review.includes('浏览器自动验收')) {
    throw new Error('List workbench review record crossed the manual-acceptance boundary.');
  }
  console.log('boss-ledger-list-workbench-recipe: pass');
} catch (error) {
  console.error(`boss-ledger-list-workbench-recipe: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(changeDir, { recursive: true, force: true });
  rmSync(merchantChangeDir, { recursive: true, force: true });
}
