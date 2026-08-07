#!/usr/bin/env node
// rule-assertion: contract.regression
// rule-assertion: visual.standalone-page-title
// rule-assertion: visual.guided-simple-layout
// rule-assertion: interaction.simple-page-actions
// rule-assertion: visual.result-composition
// rule-assertion: contract.result-composition
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { normalizeListSummaryPresentation, readJson, validatePageSpec } from './lib/boss-ledger-page-spec.mjs';
import { scenarios } from '../modules/boss-ledger/execution/scenarios/capability-scenarios.mjs';

const root = process.cwd();
const fixtureRoot = resolve(root, 'modules/boss-ledger/execution/fixtures');
const failures = [];
let passed = 0;

for (const name of readdirSync(resolve(fixtureRoot, 'valid')).filter((file) => file.endsWith('.json'))) {
  const errors = validatePageSpec(readJson(resolve(fixtureRoot, 'valid', name)), { root });
  if (errors.length) failures.push(`${name}: expected valid, received ${errors.join(' | ')}`);
  else passed += 1;
}

for (const name of readdirSync(resolve(fixtureRoot, 'invalid')).filter((file) => file.endsWith('.json'))) {
  const testCase = readJson(resolve(fixtureRoot, 'invalid', name));
  const errors = validatePageSpec(testCase.spec, { root });
  if (!errors.includes(testCase.expectedError)) failures.push(`${basename(name)}: expected error '${testCase.expectedError}', received ${errors.join(' | ')}`);
  else passed += 1;
}

const scenarioSpec = (id) => {
  const scenario = scenarios.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Capability scenario is missing: ${id}`);
  return scenario.spec;
};
const merchantPilot = scenarioSpec('11-settlement-rule-management');
const settlementForm = scenarioSpec('03-merchant-settlement-config');
const splitRuleQuery = scenarioSpec('06-split-rule-query');
const drawerCreateList = scenarioSpec('17-merchant-service-config-drawer-create');
const cardSummaryList = scenarioSpec('08-settlement-bill-statistics');
const dashboard = scenarioSpec('19-operation-dashboard');
const groupedDetail = scenarioSpec('14-merchant-settlement-long-detail');
const groupedDrawerDetail = scenarioSpec('13-split-record-drawer');
const contactModal = scenarioSpec('01-contact-create');
const guidedForm = scenarioSpec('02-settlement-account-change');
const uploadWizard = scenarioSpec('05-settlement-import');
const simplePageForm = readJson(resolve(fixtureRoot, 'valid/simple-page-form.json'));
const runtimeSource = readFileSync(resolve(root, 'modules/boss-ledger/execution/renderer/page-spec-runtime.js'), 'utf8');
const businessCssSource = readFileSync(resolve(root, 'modules/boss-ledger/execution/renderer/page-spec-business.css'), 'utf8');
const contentBaseCssSource = readFileSync(resolve(root, 'modules/boss-ledger/shell/content-base.css'), 'utf8');
const shellCssSource = readFileSync(resolve(root, 'modules/boss-ledger/shell/shell.css'), 'utf8');
const shellRuntimeSource = readFileSync(resolve(root, 'modules/boss-ledger/shell/shell-runtime.js'), 'utf8');
const buildSource = readFileSync(resolve(root, 'scripts/build-boss-ledger-page-spec.mjs'), 'utf8');
const previewValidatorSource = readFileSync(resolve(root, 'scripts/validate-boss-ledger-preview.mjs'), 'utf8');
const normalizedTimeInitialValues = runtimeSource.match(/initialValues\[field\.key\] = initialValueForField\(field\);/g) || [];
if (!runtimeSource.includes("function initialValueForField(field, sourceValue = field.default)")
  || !runtimeSource.includes("field.control === 'time'")
  || normalizedTimeInitialValues.length < 2
  || !runtimeSource.includes('initialValueForField(field, initialValues[field.key])')) {
  failures.push('time-initial-values: page, step and drawer forms must normalize raw date and time defaults before passing them to Ant Design controls.');
} else {
  passed += 1;
}
if (!runtimeSource.includes('const primaryNav = Array.isArray(shell.primaryNav)')
  || !runtimeSource.includes("typeof shell.primaryNav === 'string' && shell.primaryNav.trim()")
  || !runtimeSource.includes("label: shell.primaryNav.trim()")) {
  failures.push('shell-primary-nav-normalization: the runtime must normalize a requested primary navigation label into an array before the Shell renders it.');
} else {
  passed += 1;
}
if (!runtimeSource.includes('function selectedMenuGroupKey(items, selectedKey)')
  || !runtimeSource.includes('const inferredOpenMenuKey = selectedMenuGroupKey(sideMenusByPrimary[primaryKey], selectedMenuKey)')
  || !runtimeSource.includes('inferredOpenMenuKey ? [inferredOpenMenuKey]')) {
  failures.push('shell-secondary-menu-defaults: the runtime must infer the open secondary menu group from the selected child route.');
} else {
  passed += 1;
}
const twoItemCardSummary = {
  ...merchantPilot,
  metadata: {
    ...merchantPilot.metadata,
    templateId: 'list.card-summary',
    selectionReason: '主要任务是查询和处理一组记录；结果区使用 3 至 5 项重要统计卡片辅助整体扫描。'
  },
  content: { ...merchantPilot.content, capabilities: [...merchantPilot.content.capabilities, 'statistics.cards'] },
  list: {
    ...merchantPilot.list,
    statistics: {
      items: [
        { key: 'total', label: '商品总数量', value: 12, unit: '条' },
        { key: 'shipped', label: '已发货数量', value: 8, unit: '条' }
      ]
    }
  }
};
const normalizedTwoItemCardSummary = normalizeListSummaryPresentation(twoItemCardSummary, { root });
if (!normalizedTwoItemCardSummary.changed
  || normalizedTwoItemCardSummary.kind !== 'inline'
  || normalizedTwoItemCardSummary.spec.metadata.templateId !== 'list.inline-summary'
  || normalizedTwoItemCardSummary.spec.list.summary?.items.length !== 2
  || normalizedTwoItemCardSummary.spec.list.statistics
  || !normalizedTwoItemCardSummary.spec.content.capabilities.includes('summary.inline')
  || normalizedTwoItemCardSummary.spec.content.capabilities.includes('statistics.cards')
  || validatePageSpec(normalizedTwoItemCardSummary.spec, { root }).length) {
  failures.push('list-summary-reconciliation: a two-item card summary must normalize into a valid inline summary list.');
} else {
  passed += 1;
}
if (normalizeListSummaryPresentation(cardSummaryList, { root }).changed) {
  failures.push('list-summary-reconciliation: a valid three-to-five-item card summary must remain unchanged.');
} else {
  passed += 1;
}
const extendedFieldControls = JSON.parse(JSON.stringify(merchantPilot));
extendedFieldControls.list.query.fields = [
  { key: 'merchantKeyword', label: '商户名称', control: 'auto-complete', options: [{ label: '华北商户', value: '华北商户' }] },
  { key: 'region', label: '经营区域', control: 'cascader', options: [{ label: '华北', value: 'north', children: [{ label: '北京', value: 'beijing' }] }] },
  { key: 'category', label: '经营类目', control: 'tree-select', options: [{ label: '零售', value: 'retail', children: [{ label: '商超', value: 'supermarket' }] }] },
  { key: 'cutoffTime', label: '截单时间', control: 'time', format: 'HH:mm' },
  { key: 'serviceChannels', label: '服务渠道', control: 'checkbox', options: [{ label: '线上', value: 'online' }, { label: '线下', value: 'offline' }] }
];
if (validatePageSpec(extendedFieldControls, { root }).length) {
  failures.push('extended-field-controls: AutoComplete, Cascader, TreeSelect, TimePicker and Checkbox.Group must be valid Page Spec controls.');
} else {
  passed += 1;
}
const multipleDateRanges = JSON.parse(JSON.stringify(merchantPilot));
multipleDateRanges.list.query.fields = [
  { key: 'createdAt', label: '创建时间', control: 'date-range', showPresets: false },
  { key: 'completedAt', label: '完成时间', control: 'date-range' },
  ...multipleDateRanges.list.query.fields.slice(1)
];
const invalidDatePresetDeclaration = JSON.parse(JSON.stringify(multipleDateRanges));
invalidDatePresetDeclaration.list.query.fields[0].showPresets = 'false';
if (validatePageSpec(multipleDateRanges, { root }).length
  || !validatePageSpec(invalidDatePresetDeclaration, { root }).includes('list.query.fields[0].showPresets must be a boolean.')
  || !runtimeSource.includes('function firstQueryDateRangeField(query)')
  || !runtimeSource.includes('return firstDateRange?.key === field?.key && field?.showPresets !== false;')
  || !runtimeSource.includes('queryItem(field, form, showDatePresets)')
  || !runtimeSource.includes('field.key === datePresetFieldKey')) {
  failures.push('query-date-presets: only the first date-range query field may show presets; showPresets: false must use the standard RangePicker and later date ranges must not inherit presets.');
} else {
  passed += 1;
}
const transferForm = JSON.parse(JSON.stringify(readJson(resolve(fixtureRoot, 'valid/grouped-form.json'))));
transferForm.form.groups[1] = {
  ...transferForm.form.groups[1],
  container: 'card',
  fields: [{
    key: 'serviceScope',
    label: '服务范围',
    control: 'transfer',
    options: [{ label: '线上收款', value: 'online' }, { label: '线下收款', value: 'offline' }]
  }]
};
if (validatePageSpec(transferForm, { root }).length) {
  failures.push('transfer-and-group-card: Transfer fields and independently framed form groups must be valid Page Spec structures.');
} else {
  passed += 1;
}
const tagAndDropdownList = JSON.parse(JSON.stringify(merchantPilot));
tagAndDropdownList.content.capabilities.push('table.export');
tagAndDropdownList.list.table.columns.push({
  key: 'splitMode',
  label: '分账模式',
  format: 'tag',
  tagMap: { system: { label: '系统商户', color: 'orange' } }
});
tagAndDropdownList.list.table.rows = tagAndDropdownList.list.table.rows.map((row) => ({ ...row, splitMode: 'system' }));
tagAndDropdownList.list.table.secondaryActions = [{
  key: 'more',
  label: '更多操作',
  type: 'dropdown',
  items: [{ key: 'export', label: '导出结果', type: 'export' }]
}];
if (validatePageSpec(tagAndDropdownList, { root }).length) {
  failures.push('tag-and-dropdown: Tag columns and grouped secondary table actions must be valid Page Spec structures.');
} else {
  passed += 1;
}
const directCases = [
  [
    'flat-secondary-menu',
    {
      ...merchantPilot,
      shell: {
        activePrimaryKey: 'merchant',
        selectedMenuKey: 'merchant-query',
        sideMenusByPrimary: { merchant: [{ key: 'merchant-query', label: '商户查询' }] }
      }
    },
    'shell.sideMenusByPrimary.merchant[0].children must be a non-empty array.'
  ],
  [
    'missing-assumptions',
    { ...merchantPilot, metadata: { ...merchantPilot.metadata, assumptions: [] } },
    'metadata.assumptions must be a non-empty string array.'
  ],
  [
    'hideable-operation-column',
    { ...merchantPilot, list: { ...merchantPilot.list, table: { ...merchantPilot.list.table, columns: merchantPilot.list.table.columns.map((column) => column.key === 'actions' ? { ...column, hideable: true } : column) } } },
    'Operation columns must declare hideable=false.'
  ],
  [
    'drawer-detail-without-capability',
    { ...merchantPilot, content: { ...merchantPilot.content, capabilities: merchantPilot.content.capabilities.filter((capability) => capability !== 'detail.drawer') } },
    'Detail row actions require detail.drawer.'
  ],
  [
    'state-change-without-impact',
    { ...splitRuleQuery, list: { ...splitRuleQuery.list, table: { ...splitRuleQuery.list.table, rowActions: splitRuleQuery.list.table.rowActions.map((action) => action.key === 'disable' ? { ...action, confirm: { ...action.confirm, impact: '' } } : action) } } },
    'list.table.rowActions[1].confirm.impact is required.'
  ],
  [
    'form-failure-without-recovery-verification',
    {
      ...settlementForm,
      form: {
        ...settlementForm.form,
        verification: undefined,
        submit: {
          ...settlementForm.form.submit,
          failure: {
            trigger: { field: 'merchantNo', value: 'M-FAIL' },
            message: '保存失败。',
            recovery: '请修正商户编号后重新保存。'
          }
        }
      }
    },
    'form.submit.failure requires form.verification.validValues for recovery regression.'
  ],
  [
    'mode-override',
    { ...merchantPilot, metadata: { ...merchantPilot.metadata, executionMode: 'shadow', validatedCombinations: ['form.grouped'] } },
    'metadata.executionMode must equal policy mode page-spec-default for list.regular.'
  ],
  [
    'shadow-without-validated-combination',
    { ...settlementForm, metadata: { ...settlementForm.metadata, validatedCombinations: undefined } },
    'shadow Page Spec must declare non-empty unique metadata.validatedCombinations.'
  ],
  [
    'shadow-with-wrong-combination',
    { ...settlementForm, metadata: { ...settlementForm.metadata, validatedCombinations: ['form.guided-simple'] } },
    'metadata.validatedCombinations must reference verified policy combinations for the selected family and template.'
  ],
  [
    'simple-page-form-in-modal',
    { ...simplePageForm, form: { ...simplePageForm.form, presentation: 'modal' } },
    'form.page-simple requires simple fields in a page presentation.'
  ],
  [
    'simple-page-form-with-sticky-actions',
    { ...simplePageForm, content: { ...simplePageForm.content, capabilities: [...simplePageForm.content.capabilities, 'form.stickyActions'] }, form: { ...simplePageForm.form, stickyActions: true } },
    'form.page-simple uses inline actions and cannot declare form.stickyActions.'
  ],
  [
    'guided-form-with-sticky-actions',
    { ...guidedForm, content: { ...guidedForm.content, capabilities: [...guidedForm.content.capabilities, 'form.stickyActions'] }, form: { ...guidedForm.form, stickyActions: true } },
    'form.guided-simple uses inline actions and cannot declare form.stickyActions.'
  ],
  [
    'workflow-result-summary-without-capability',
    { ...uploadWizard, content: { ...uploadWizard.content, capabilities: uploadWizard.content.capabilities.filter((capability) => capability !== 'form.resultSummary') } },
    'form.submit.success.summary requires form.resultSummary.'
  ],
  [
    'modal-form-over-six-fields',
    {
      ...contactModal,
      form: {
        ...contactModal.form,
        fields: [...contactModal.form.fields,
          { key: 'department', label: '所属部门', control: 'input' },
          { key: 'agentName', label: '代理名称', control: 'input' },
          { key: 'role', label: '业务角色', control: 'input' }
        ]
      }
    },
    'Modal forms support at most 6 fields; use a Drawer form.'
  ],
  [
    'non-wizard-guide',
    { ...settlementForm, form: { ...settlementForm.form, wizardGuide: { title: '不应出现', text: '分组表单不能使用 Wizard 引导区。' } } },
    'form.wizardGuide is reserved for form.staged-flow step forms.'
  ],
  [
    'default-list-with-shadow-summary',
    { ...merchantPilot, content: { ...merchantPilot.content, capabilities: [...merchantPilot.content.capabilities, 'summary.inline'] }, list: { ...merchantPilot.list, summary: { items: [{ key: 'count', label: '商户数', value: 4 }] } } },
    'list.regular cannot use inline summary or statistics cards.'
  ],
  [
    'standalone-drawer-template-is-not-a-route',
    { ...simplePageForm, metadata: { ...simplePageForm.metadata, templateId: 'form.drawer-simple' }, form: { ...simplePageForm.form, presentation: 'drawer' } },
    'metadata.templateId is invalid.'
  ],
  [
    'dashboard-missing-ranking',
    { ...dashboard, dashboard: { ...dashboard.dashboard, charts: dashboard.dashboard.charts.filter((chart) => chart.role !== 'ranking') } },
    'dashboard.charts requires at least one ranking chart.'
  ],
  [
    'dashboard-cannot-carry-a-list',
    { ...dashboard, list: drawerCreateList.list },
    'dashboard Page Spec cannot declare list.'
  ]
];

if (runtimeSource.includes("h('h2', { className: 'boss-form-title' }, spec.metadata.pageName)")) {
  failures.push('standalone-form-page-title: independent form pages must not render a duplicate page heading.');
} else {
  passed += 1;
}

if (runtimeSource.includes("h('h2', { className: 'boss-detail-title' }, spec.metadata.pageName)")) {
  failures.push('standalone-detail-page-title: independent detail pages must not render a duplicate page heading.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("['form.page-simple', 'form.guided-simple'].includes(spec.metadata.templateId)")
  || !runtimeSource.includes('boss-inline-form-actions')
  || !runtimeSource.includes('function BusinessGuide')
  || !runtimeSource.includes("src: './assets/guided-form-default.png'")) {
  failures.push('simple-form-runtime: simple pages must use inline actions and guided forms must render the default business illustration.');
} else {
  passed += 1;
}

if (!businessCssSource.includes('width: min(100%, 1200px)')
  || !businessCssSource.includes('padding-inline: 16px')
  || !businessCssSource.includes('justify-content: flex-start')
  || !businessCssSource.includes('gap: 16px')
  || !businessCssSource.includes('--boss-form-label-width: 136px')
  || !businessCssSource.includes('--boss-form-control-offset: var(--boss-form-label-width)')
  || !businessCssSource.includes('margin-left: var(--boss-form-control-offset)')
  || !runtimeSource.includes("labelCol: useSideLabel ? { flex: '136px' } : undefined")
  || !businessCssSource.includes('.boss-full-page-form.boss-inline-action-page { padding-bottom: 16px; }')
  || !buildSource.includes("resolve(changeDir, 'assets/guided-form-default.png')")) {
  failures.push('guided-form-layout: guided forms must use the 1200px layout with 16px insets, input-aligned inline actions, and a generated default illustration asset.');
} else {
  passed += 1;
}

const completedPageResult = "if (completed) return h('div', { className: 'boss-content-stack' }, h('section', { className: 'boss-result-page' }, formBody));";
if (!runtimeSource.includes('function renderWorkflowResult')
  || !runtimeSource.includes('function ResultSummary')
  || !runtimeSource.includes('function ResultFeedback')
  || !runtimeSource.includes(completedPageResult)
  || !businessCssSource.includes('.boss-result-summary-panel')
  || !businessCssSource.includes('.boss-result-feedback')
  || !businessCssSource.includes('grid-template-columns: repeat(2, minmax(0, 1fr))')) {
  failures.push('workflow-result-composition: results must leave form guides, use the official Result structure, and support optional summary and feedback regions.');
} else {
  passed += 1;
}

if (!businessCssSource.includes('.boss-result-page { flex: 1 1 auto; min-height: 100%;')
  || !shellCssSource.includes('.boss-shell-content-body { flex: 1 1 0; min-height: 0;')
  || !businessCssSource.includes('.boss-content-stack { flex: 1 1 auto;')) {
  failures.push('result-full-content-area: success Result surfaces must fill the Shell content body and center their content in that available space.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("className: 'boss-confirm-modal',\n        centered: true,")
  || !runtimeSource.includes("h(Modal, { open: true, centered: true,")
  || !shellCssSource.includes('.boss-shell-footer { height: 32px; min-height: 32px; max-height: 32px; margin: 12px 0 0; flex: 0 0 32px; position: static; display: flex; align-items: center; justify-content: center;')
  || !contentBaseCssSource.includes('.ant-modal-wrap { display: flex; align-items: center; justify-content: center; }')
  || !contentBaseCssSource.includes('.ant-modal-wrap .ant-modal { top: 0; margin: 0 auto; padding-bottom: 0; }')) {
  failures.push('modal-and-footer-separation: Modal and confirmation dialogs must be vertically centered, and the Footer must remain a distinct bottom region.');
} else {
  passed += 1;
}

if (!shellRuntimeSource.includes('const openTab = (tab) =>')
  || !shellRuntimeSource.includes('renderContent?.({ activeTabKey, activeTab, activePrimaryKey, selectedMenuKey, tabs, openTab, closeTab })')
  || !runtimeSource.includes('function LinkedWorkflowPage({ spec, activeTabKey, rootTabKey, tabs, openTab, closeTab })')
  || !runtimeSource.includes('const workflowTabKey = `${rootTabKey}--create`;')
  || !runtimeSource.includes('onStartWorkflow: openWorkflow')
  || !runtimeSource.includes('closeTab?.(workflowTabKey);')) {
  failures.push('source-list-workflow-tabs: full-page and staged create workflows must open in a closable Shell Tab while preserving the source list tab.');
} else {
  passed += 1;
}

if (!previewValidatorSource.includes("pageSpec?.metadata?.family === 'list'")
  || !previewValidatorSource.includes('function hasExactCssClassSelector')) {
  failures.push('query-list-validator-scope: list-only inset checks must use the Page Spec family and exact CSS class selectors.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("const DEFAULT_QUERY_DATE_PRESETS = ['今日', '近 7 日', '近 30 日']")
  || !runtimeSource.includes('function firstQueryDateRangeField(query)')
  || !runtimeSource.includes('function usesQueryDatePresets(query, field)')
  || !runtimeSource.includes('field?.showPresets !== false')
  || !runtimeSource.includes('function queryRowTops')
  || !runtimeSource.includes("'data-boss-query-measurement': 'actual-row-count'")
  || runtimeSource.includes('collapseThreshold')
  || !businessCssSource.includes('.boss-query-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));')
  || !businessCssSource.includes('.boss-query-date-range-field { grid-column: 1 / -1;')
  || !businessCssSource.includes('.boss-query-actions { display: flex; grid-column: 3; justify-self: end;')
  || !businessCssSource.includes('  .boss-query-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
  || !businessCssSource.includes('  .boss-query-grid { grid-template-columns: minmax(0, 1fr); column-gap: 0; row-gap: 16px; }')
  || !businessCssSource.includes('.boss-query-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: flex-start; column-gap: 24px; row-gap: 16px;')
  || !businessCssSource.includes('.boss-query-field .ant-form-item { margin-bottom: 0; }')
  || !contentBaseCssSource.includes('.boss-query-field .ant-form-item { margin-bottom: 0; }')
  || !businessCssSource.includes('width: max-content; min-width: 320px;')
  || !runtimeSource.includes('const selected = isSameQueryDateRange(value, range);')
  || !runtimeSource.includes("boss-query-date-preset${selected ? ' is-selected' : ''}")
  || !businessCssSource.includes('.boss-query-date-preset.is-selected')
  || !businessCssSource.includes('background: var(--boss-selected-bg) !important;')
  || !businessCssSource.includes('.boss-query-grid.is-measuring { visibility: visible; }')
  || !contentBaseCssSource.includes('.boss-query-grid.is-measuring { visibility: visible; }')
  ) {
  failures.push('adaptive-query-layout: query lists must use responsive 3/2/1 grid columns with content-sized Labels and same-column controls, reserve unused final-row columns, limit optional default date shortcuts to the first date-range field, show one active shortcut with the primary-derived selection background, use a dedicated date row only when shortcuts are shown, measure actual-row overflow without field-count thresholds, and keep conditions visible while recalculating.');
} else {
  passed += 1;
}

if (!businessCssSource.includes('.boss-full-page-form { min-height: 100%; padding-bottom: 64px; display: flex; flex-direction: column; }')
  || !previewValidatorSource.includes('padding-bottom\\s*:\\s*64px')) {
  failures.push('full-page-scroll-safety: full-page forms must reserve a 64px scroll-safe area so their final group and fields remain visible above the fixed action area.');
} else {
  passed += 1;
}

if (!runtimeSource.includes('const tableMinimumWidth = columns.reduce')
  || !runtimeSource.includes('scroll: { x: tableSpec.scrollX || tableMinimumWidth }')
  || !businessCssSource.includes('.boss-result-module { width: 100%; min-width: 0; max-width: 100%;')
  || !businessCssSource.includes('.boss-table-body { width: 100%; min-width: 0; max-width: 100%; overflow-x: auto; overflow-y: hidden; }')
  || !contentBaseCssSource.includes('.boss-table-body { width: 100%; min-width: 0; max-width: 100%; overflow-x: auto; overflow-y: hidden; }')) {
  failures.push('contained-table-layout: result modules must constrain Table width and place any wide-table scroll inside the Table body.');
} else {
  passed += 1;
}

if (!runtimeSource.includes('AutoComplete,')
  || !runtimeSource.includes('Cascader,')
  || !runtimeSource.includes('TimePicker,')
  || !runtimeSource.includes('TreeSelect,')
  || !runtimeSource.includes("field.control === 'auto-complete'")
  || !runtimeSource.includes("field.control === 'cascader'")
  || !runtimeSource.includes("field.control === 'tree-select'")
  || !runtimeSource.includes("field.control === 'time'")
  || !runtimeSource.includes("field.control === 'checkbox'")
  || !runtimeSource.includes('children: normalizeOptions(option.children)')) {
  failures.push('extended-field-control-runtime: the five new Page Spec controls must render real Ant Design components and preserve nested options.');
} else {
  passed += 1;
}

if (!runtimeSource.includes('Card,')
  || !runtimeSource.includes('Divider,')
  || !runtimeSource.includes('Dropdown,')
  || !runtimeSource.includes('Tag,')
  || !runtimeSource.includes('Transfer,')
  || !runtimeSource.includes("field.control === 'transfer'")
  || !runtimeSource.includes("action.type === 'dropdown'")
  || !runtimeSource.includes("column.format === 'tag'")
  || !runtimeSource.includes("section.container === 'card'")
  || !runtimeSource.includes('h(Divider,')) {
  failures.push('extended-business-component-runtime: Transfer, Dropdown, Tag, Divider and Card must render as real Ant Design components for their declared business use.');
} else {
  passed += 1;
}

if (!runtimeSource.includes('function resolveStatusDisplay(value, statusMap)')
  || !runtimeSource.includes("if (typeof mapped === 'string') return { label: String(value ?? '-'), status: mapped };")
  || !businessCssSource.includes('.boss-form-module, .boss-detail-module { flex: 1 0 auto; min-height: 480px; padding: 16px; border-radius: var(--boss-card-radius); overflow: hidden; }')
  || !businessCssSource.includes('.boss-wizard-page { min-height: calc(100vh - 188px); background: var(--boss-container); padding: 24px 32px 72px; border-radius: var(--boss-card-radius); overflow: hidden; }')) {
  failures.push('status-and-tab-surface-resilience: status cells must always render a text label and new Tab task surfaces must retain their upper-left task radius.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("spec.metadata.templateId === 'form.grouped-page' && section.container !== 'plain'")
  || !runtimeSource.includes('boss-grouped-form-module')
  || !businessCssSource.includes('.boss-grouped-form-module { min-height: 100%; padding: 0; background: var(--boss-page-bg); }')
  || !businessCssSource.includes('.boss-grouped-form-module .boss-form-section-card { border: 0;')
  || !businessCssSource.includes('.boss-grouped-form-module .boss-form-section-card .ant-card-head { min-height: auto; padding: 20px 20px 0; border-bottom: 0; }')
  || !businessCssSource.includes('.boss-grouped-form-module .boss-form-section-card .ant-card-body { padding: 20px; }')
  || settlementForm.form.groups.some((group) => group.container === 'card')) {
  failures.push('grouped-form-surface: grouped page forms must use separated white business surfaces with 20px module spacing, no outer border, and no title divider.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("const groupedDetailSurfaces = detail.presentation === 'page' && !detail.tabs && (detail.groups || []).length > 1;")
  || !runtimeSource.includes("className: 'boss-detail-section boss-detail-section-card'")
  || !runtimeSource.includes("' boss-grouped-detail-module'")
  || !businessCssSource.includes('.boss-grouped-detail-module { min-height: 100%; padding: 16px 0; background: var(--boss-page-bg); }')
  || !businessCssSource.includes('.boss-grouped-detail-module .boss-detail-section-card { border-color: var(--boss-divider);')
  || groupedDetail.detail.anchors
  || groupedDetail.metadata?.validatedCombinations?.[0] !== 'detail.grouped-basic'
  || validatePageSpec(groupedDetail, { root }).length) {
  failures.push('grouped-detail-surface: multi-group standalone details must use separate white group surfaces on the neutral workspace without default anchor navigation.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("boss-drawer-detail${detailSpec.groups.length > 1 ? ' boss-drawer-grouped-detail' : ''}")
  || !runtimeSource.includes("boss-drawer-detail${detail.groups.length > 1 ? ' boss-drawer-grouped-detail' : ''}")
  || !businessCssSource.includes('.boss-drawer-grouped-detail .boss-detail-section + .boss-detail-section { margin-top: 28px; }')
  || !businessCssSource.includes('.boss-drawer-grouped-detail .ant-table-wrapper { max-width: 100%; overflow-x: auto; }')
  || groupedDrawerDetail.list.table.drawerDetail.groups.length !== 3
  || groupedDrawerDetail.list.table.drawerDetail.groups[1]?.title !== '支付信息'
  || !groupedDrawerDetail.list.table.drawerDetail.groups[2]?.table
  || validatePageSpec(groupedDrawerDetail, { root }).length) {
  failures.push('grouped-drawer-detail: two-to-three concise information groups and one short detail table must render inside a single Drawer surface without nested Cards.');
} else {
  passed += 1;
}

if (!runtimeSource.includes("'data-boss-query-summary': 'inline'")
  || !runtimeSource.includes("'查询统计：'")
  || !runtimeSource.includes('boss-result-summary-inline-divider')
  || !businessCssSource.includes('.boss-result-summary-inline-value { color: var(--boss-primary);')
  || !businessCssSource.includes('.boss-result-summary-inline-divider { padding-inline: 12px; color: var(--boss-border); }')
  || !previewValidatorSource.includes('boss-result-summary-prefix')) {
  failures.push('inline-summary-presentation: simple query statistics must show the 查询统计 prefix, primary-colored values, and light-gray separators.');
} else {
  passed += 1;
}

for (const [name, spec, expectedError] of directCases) {
  const errors = validatePageSpec(spec, { root });
  if (!errors.includes(expectedError)) failures.push(`${name}: expected error '${expectedError}', received ${errors.join(' | ')}`);
  else passed += 1;
}

const flexibleShadowSpec = {
  ...settlementForm,
  metadata: { ...settlementForm.metadata, validatedCombinations: undefined }
};
const strictShadowErrors = validatePageSpec(flexibleShadowSpec, { root });
const flexibleShadowErrors = validatePageSpec(flexibleShadowSpec, { root, strictGovernance: false });
if (!strictShadowErrors.includes('shadow Page Spec must declare non-empty unique metadata.validatedCombinations.') || flexibleShadowErrors.length) {
  failures.push(`flexible-governance: strict mode must reject missing validated combinations while natural-generation mode accepts the structurally valid spec; flexible errors: ${flexibleShadowErrors.join(' | ')}`);
} else {
  passed += 1;
}

if (failures.length) {
  console.error('page-spec-contract-tests: failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('page-spec-contract-tests: pass');
console.log(`- cases: ${passed}`);
