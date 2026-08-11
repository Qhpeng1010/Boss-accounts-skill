import { compileListWorkbench } from './boss-ledger-list-workbench-recipe.mjs';
import { compileStructuredWizard, parseStructuredWizardRequest } from './boss-ledger-wizard-recipe.mjs';

const BASIC_CAPABILITIES = [
  'form.simple', 'form.groups', 'form.steps', 'form.stickyActions', 'form.review', 'form.sideGuide', 'form.upload', 'form.reviewTable', 'form.returnSource', 'form.resultSummary', 'form.resultFeedback', 'form.sourceList',
  'query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'table.refresh', 'table.columnSettings', 'table.confirmAction', 'table.deleteAction', 'detail.drawer', 'detail.drawerTable', 'table.editAction', 'table.batchAction', 'table.expandable', 'table.export', 'table.columnOrder'
];

const ADVANCED_CAPABILITIES = BASIC_CAPABILITIES.map((capability) => capability === 'query.basic' ? 'query.advanced' : capability);
const SIMPLE_BASIC_CAPABILITIES = [
  'form.simple', 'form.returnSource', 'form.sourceList',
  ...BASIC_CAPABILITIES.filter((capability) => capability.startsWith('table.') || capability.startsWith('detail.') || capability === 'query.basic')
];
const SIMPLE_ADVANCED_CAPABILITIES = SIMPLE_BASIC_CAPABILITIES.map((capability) => capability === 'query.basic' ? 'query.advanced' : capability);

function createRecord(table, form) {
  const rowKey = table.rowKey;
  const defaultRecord = { ...(table.primaryAction?.createRecord || {}), [rowKey]: table.primaryAction?.createRecord?.[rowKey] || 'R003' };
  const formFields = form.steps.flatMap((step) => step.fields || []);
  return { defaultRecord, fieldMap: Object.fromEntries(formFields.map((field) => [field.key, field.label])) };
}

export function compileLinkedListWizard({ rawRequest, changeId }) {
  const listSpec = compileListWorkbench({ rawRequest, changeId });
  const formSpec = compileStructuredWizard({ rawRequest, changeId });
  const parsedWizard = parseStructuredWizardRequest(rawRequest);
  const sourceList = structuredClone(listSpec.list);
  const { defaultRecord, fieldMap } = createRecord(sourceList.table, formSpec.form);
  sourceList.table.primaryAction = {
    key: 'create',
    label: parsedWizard.pageName,
    workflowTarget: 'form',
    createRecord: defaultRecord
  };

  const advanced = sourceList.query.fields.length > 6;
  const capabilities = advanced ? ADVANCED_CAPABILITIES : BASIC_CAPABILITIES;
  const combination = advanced ? 'form.steps-source-list-advanced' : 'form.steps-source-list-basic';
  const pageName = listSpec.metadata.pageName;
  const sourceRuleRefs = [...new Set([...listSpec.metadata.ruleRefs, ...formSpec.metadata.ruleRefs])];

  return {
    ...formSpec,
    metadata: {
      ...formSpec.metadata,
      pageName,
      validatedCombinations: [combination],
      selectionReason: `${pageName}从查询列表发起新增配置，提交后回到保留查询上下文的来源列表。`,
      assumptions: [
        ...formSpec.metadata.assumptions,
        '提交成功后将新记录置于来源列表首行，查询条件、分页和列表操作上下文保持不变。'
      ],
      ruleRefs: sourceRuleRefs
    },
    content: { capabilities },
    form: {
      ...formSpec.form,
      sourceList,
      submit: {
        ...formSpec.form.submit,
        success: {
          ...formSpec.form.submit.success,
          actionType: 'return-source',
          actionLabel: '返回列表查看',
          ...(parsedWizard.continueCreate ? { secondaryAction: { label: '继续新增' } } : {})
        }
      }
    },
    workflow: { source: 'list', recordFieldLabels: fieldMap }
  };
}

export function compileLinkedListPageForm({ rawRequest, changeId }) {
  const listSpec = compileListWorkbench({ rawRequest, changeId });
  const sourceList = structuredClone(listSpec.list);
  const createFields = sourceList.table.primaryAction?.form?.fields;
  if (!createFields?.length) throw new Error('完整表单流程需要明确新增字段。');
  const entityName = listSpec.metadata.pageName.replace(/(?:管理)?查询$/, '') || listSpec.metadata.pageName;
  const pageName = `新增${entityName}`;
  const { defaultRecord, fieldMap } = createRecord(sourceList.table, { steps: [{ fields: createFields }] });
  sourceList.table.primaryAction = {
    key: 'create',
    label: pageName,
    workflowTarget: 'form',
    createRecord: defaultRecord
  };
  const advanced = sourceList.query.fields.length > 6;
  return {
    schemaVersion: 1,
    ui: { system: 'boss-ledger', runtime: 'react-antd-page-spec', rendererVersion: 1 },
    metadata: {
      changeId,
      pageName: listSpec.metadata.pageName,
      family: 'form',
      templateId: 'form.page-simple',
      executionMode: 'shadow',
      validatedCombinations: [advanced ? 'form.page-source-list-advanced' : 'form.page-source-list-basic'],
      request: listSpec.metadata.request,
      selectionReason: `${listSpec.metadata.pageName}从查询列表发起全页新增表单，提交后回到保留查询上下文的来源列表。`,
      assumptions: [
        '当前为客户端交互原型，不调用真实业务服务。',
        '未单独声明可选性的新增字段按必填处理。',
        '提交成功后将新记录置于来源列表首行，查询条件、分页和列表操作上下文保持不变。'
      ],
      ruleRefs: [...new Set([...listSpec.metadata.ruleRefs, 'BL-TPL-003', 'BL-TPL-006', 'BL-TPL-019', 'BL-TPL-021', 'BL-INT-006', 'BL-INT-017'])]
    },
    shell: { activePrimaryKey: 'workspace' },
    content: { capabilities: advanced ? SIMPLE_ADVANCED_CAPABILITIES : SIMPLE_BASIC_CAPABILITIES },
    form: {
      presentation: 'page',
      sectionTitle: '基本信息',
      fields: createFields,
      sourceList,
      submit: {
        primaryLabel: '提交',
        cancelLabel: '取消',
        confirm: { title: `确认提交${pageName}`, description: '请确认信息填写无误后提交。' },
        success: { title: `${pageName}完成`, message: `${pageName}已提交完成。`, actionType: 'return-source', actionLabel: '返回列表查看' }
      }
    },
    workflow: { source: 'list', recordFieldLabels: fieldMap }
  };
}
