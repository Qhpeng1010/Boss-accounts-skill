import { normalizeRecipeRequest } from './recipe-request-bridge.mjs';
import { parseListRequirement } from './page-requirement-coverage.mjs';

const RULE_REFS = ['BL-TPL-001', 'BL-TPL-012', 'BL-TPL-013', 'BL-INT-002', 'BL-INT-004', 'BL-INT-010'];
const STATUS_OPTIONS = [
  { label: '生效中', value: 'active' },
  { label: '待生效', value: 'pending' },
  { label: '已失效', value: 'disabled' }
];
const STATUS_MAP = {
  active: { label: '生效中', status: 'success' },
  pending: { label: '待生效', status: 'processing' },
  disabled: { label: '已失效', status: 'default' },
  deleted: { label: '已删除', status: 'default' }
};

function normalize(value) {
  return String(value || '')
    .replace(/\\[rn]/g, '、')
    .replace(/\r?\n/g, '、')
    .replace(/\s+/g, ' ')
    .trim();
}

function fieldsFrom(value) {
  return normalize(value)
    .replace(/[。；;]+$/g, '')
    .split(/[、，,；;]|和/)
    .map((field) => field
      .replace(/^(?:[-*]\s*|\d+[.)]\s*)/, '')
      .replace(/^[：:]\s*/, '')
      .replace(/^(?:按|根据|填写|输入|修改|展示|显示|包括)/, '')
      .trim())
    .filter((field) => field && !/^(?:保存|提交|关闭|确认|并|后|操作)$/.test(field))
    .filter((field) => {
      const compact = field.replace(/\s+/g, '');
      return !/^共\d+(?:个查询条件|列|个字段|个项)$/.test(compact)
        && !/^以上\d+(?:个字段|个项)$/.test(compact);
    });
}

function summaryCount(value) {
  const normalized = String(value || '').trim();
  const named = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5 };
  return named[normalized] || Number(normalized);
}

function parseListSummary(request) {
  const patterns = [
    {
      kind: 'inline',
      expression: /(?:在)?结果工具栏左侧(?:展示|显示|提供)\s*([一二两12])\s*(?:项|个)?\s*(?:简单|轻量|行内)?(?:统计|指标|汇总)\s*[：:]\s*([^。；]+)/
    },
    {
      // One or two metrics are always rendered as the toolbar summary, even
      // when a request describes them generically as a page-top statistic.
      kind: 'inline',
      expression: /(?:(?:在)?(?:(?:页面|列表)?顶部|(?:列表)?结果(?:区|模块)?|查询结果(?:区|模块))\s*)?(?:展示|显示|提供)\s*([一二两12])\s*(?:项|个)?\s*(?:简单|轻量|行内)?(?:统计|指标|汇总)\s*[：:]\s*([^。；]+)/
    },
    {
      // Three to five metrics use statistic cards. The location is optional
      // because structured requests commonly use a bare "展示 4 项统计" header.
      kind: 'cards',
      expression: /(?:(?:在)?(?:(?:页面|列表)?顶部|(?:列表)?结果(?:区|模块)?|查询结果(?:区|模块))\s*)?(?:展示|显示|提供)\s*([三四五345])\s*(?:项|个)?\s*(?:重要)?(?:统计|指标|汇总)\s*[：:]\s*([^。；]+)/
    }
  ];
  for (const { kind, expression } of patterns) {
    const match = request.match(expression);
    if (!match) continue;
    const count = summaryCount(match[1]);
    const labels = fieldsFrom(match[2].split(/(?:、)?操作\s*[:：]/)[0]);
    if (labels.length !== count) throw new Error(`${kind === 'inline' ? '工具栏简单统计' : '统计卡片'}声明为 ${count} 项，但只识别到 ${labels.length} 项。`);
    return { kind, labels };
  }
  return null;
}

function sectionValue(request, headerPattern, nextHeaderPattern) {
  const header = request.match(headerPattern);
  if (!header || header.index === undefined) return '';
  const remainder = request.slice(header.index + header[0].length);
  const punctuationIndex = remainder.search(/[。；]/);
  const nextHeaderIndex = nextHeaderPattern ? remainder.search(nextHeaderPattern) : -1;
  const endIndex = [punctuationIndex, nextHeaderIndex].filter((index) => index >= 0).sort((left, right) => left - right)[0];
  return remainder.slice(0, endIndex === undefined ? undefined : endIndex).trim();
}

function fieldKey(label, index = 0) {
  const known = {
    规则编号: 'ruleNo', 规则名称: 'ruleName', 商户编号: 'merchantNo', 商户名称: 'merchantName',
    商户简称: 'merchantShortName', 规则状态: 'status', 状态: 'status', 创建时间: 'createdAt',
    更新时间: 'updatedAt', 生效日期: 'effectiveAt', 失效日期: 'expiresAt', 金额: 'amount', 手续费: 'fee',
    服务费率: 'serviceFeeRate', 手续费率: 'feeRate', 费率类型: 'feeType', 所属行业: 'industry',
    规则类型: 'ruleType', 分账渠道: 'splitChannel', 渠道下级: 'channelSubordinate', 分账方式: 'splitMethod',
    分账周期: 'splitCycle', 待分账金额: 'pendingAmount', 预计到账金额: 'expectedIncome', 预计扣账金额: 'expectedDeduction',
    创建人: 'createdBy', 最后修改人: 'updatedBy', 审核状态: 'reviewStatus', 配置状态: 'configStatus'
  };
  if (known[label]) return known[label];
  const hash = [...String(label)].reduce((value, character) => ((value * 31) + character.codePointAt(0)) >>> 0, 7);
  return `field${hash.toString(36) || index + 1}`;
}

function controlFor(label) {
  if (/状态/.test(label)) return { control: 'select', options: STATUS_OPTIONS };
  if (/日期|时间/.test(label)) return { control: 'date' };
  if (/类型|渠道|方式|角色/.test(label)) return { control: 'select', options: [{ label: '线上收单', value: 'online' }, { label: '联营渠道', value: 'partner' }] };
  if (/金额|手续费|服务费率|费率(?!类型)|比例|数量/.test(label)) return { control: 'number' };
  return { control: 'input' };
}

function columnFor(label, index) {
  const key = fieldKey(label, index);
  const column = { key, label, width: /名称|简称/.test(label) ? 200 : 140 };
  if (/状态/.test(label)) Object.assign(column, { format: 'status', statusMap: STATUS_MAP });
  if (/金额|手续费|服务费率|费率(?!类型)|比例|数量/.test(label)) Object.assign(column, { format: 'amount', unit: /费率|比例/.test(label) ? '%' : '元' });
  if (/编号/.test(label)) column.width = 140;
  return column;
}

function fieldFor(label, index, required = true) {
  return { key: fieldKey(label, index), label, required, ...controlFor(label) };
}

function sampleValue(column, rowIndex) {
  const values = {
    规则编号: ['R001', 'R002'], 规则名称: ['华东直营网点结算', '联营渠道月度分润'], 商户编号: ['10080048989', '10080048990'],
    商户名称: ['杭州星云商贸有限公司', '上海锦程科技有限公司'], 商户简称: ['杭州星云', '上海锦程'], 所属行业: ['零售', '科技服务'],
    费率类型: ['按比例', '按固定金额'], 规则状态: ['active', 'pending'], 配置状态: ['active', 'pending'], 审核状态: ['pending', 'active'],
    创建时间: ['2026-07-16 11:35:22', '2026-07-15 16:20:10'], 更新时间: ['2026-07-16 11:40:10', '2026-07-15 16:25:30'],
    生效日期: ['2026-07-16', '2026-07-15'], 失效日期: ['2027-07-16', '2027-07-15'], 服务费率: [0.38, 0.2], 手续费率: [0.12, 0.08],
    手续费: [120, 80], 金额: [12860.32, 9820], 待分账金额: [12860.32, 9820], 预计到账金额: [12600, 9600], 预计扣账金额: [260.32, 220],
    费率: [0.38, 0.2], 分账比例: [30, 25]
  };
  const value = values[column.label]?.[rowIndex];
  if (value !== undefined) return value;
  if (column.format === 'amount') return 0;
  return `${column.label}示例${rowIndex + 1}`;
}

function extractPageName(request) {
  const match = request.match(/老板管账(?:的)?([^，,。；]+?)(?:列表页|列表页面|页面)/)
    || request.match(/创建(?:老板管账(?:的|[：:])?)?(?:一个)?\s*([^。；]+?)(?:列表页|列表页面|列表|页面)/)
    || request.match(/创建老板管账的([^。；]+?)(?:列表页|列表页面|列表|页面)/)
    || request.match(/老板管账(?:的)?([^。；]+?)(?:列表页|列表页面|页面)/);
  return match
    ? match[1]
      .trim()
      .replace(/^[：:]\s*/, '')
      .replace(/^创建(?:一个)?\s*/, '')
      .replace(/的$/, '')
      .replace(/^【(.+)】$/, '$1')
    : '记录查询';
}

function extractFormLabels(request, action) {
  const expression = action === 'edit'
    ? /编辑[\s\S]*?(?:修改|填写)([^。；]*?)(?=(?:保存|提交|确认|关闭)|[。；]|$)/
    : /新增[\s\S]*?(?:填写|输入)([^。；]*?)(?=(?:保存|提交|确认|关闭)|[。；]|$)/;
  const match = request.match(expression);
  return match ? fieldsFrom(match[1]) : [];
}

export function parseListWorkbenchRequest(rawRequest) {
  const sourceRequest = normalize(rawRequest);
  const request = normalizeRecipeRequest(sourceRequest);
  const requirement = parseListRequirement(sourceRequest);
  if (!request) throw new Error('缺少业务需求。');
  const tableHeaderPattern = /(?:\btable\s*)?列表\s*(?:展示|显示|包括|为|有|字段|列|：|:)|(?:结果|表格)(?:列表|字段|列)\s*(?:展示|显示|包括|为|有|：|:)/i;
  const querySection = sectionValue(
    request,
    /(?:查询|筛选)?(?:条件|筛选项|查询项)\s*(?:包括|为|有|：|:)\s*/,
    tableHeaderPattern
  );
  const columnSection = sectionValue(
    request,
    tableHeaderPattern,
    /(?:页面顶部|在(?:列表)?结果(?:区|模块)?|结果工具栏|操作)\s*(?:展示|显示|提供|[:：])|(?:展示|显示|提供)\s*[一二两三四五1-5]\s*(?:项|个)?\s*(?:简单|轻量|行内|重要)?(?:统计|指标|汇总)\s*[:：]/
  );
  const queryMatch = request.match(/(?:支持|可以|可)?(?:按|根据)([^。；]+?)(?:查询|筛选)/)
    || request.match(/(?:查询|筛选)条件(?:包括|为|有|：|:)\s*([^。；]+)/)
    || request.match(/(?:查询|筛选)字段(?:包括|为|有|：|:)\s*([^。；]+)/);
  const columnMatch = request.match(/列表(?:展示|显示)([^。；]+)/);
  const queryLabels = fieldsFrom(querySection).length ? fieldsFrom(querySection) : (queryMatch ? fieldsFrom(queryMatch[1]) : []);
  const columnLabels = fieldsFrom(columnSection).length ? fieldsFrom(columnSection) : (columnMatch ? fieldsFrom(columnMatch[1]) : []);
  if (!queryLabels.length || !columnLabels.length) throw new Error('列表配方需要明确的查询条件和列表字段。');
  const summary = parseListSummary(request);

  const hasDetail = requirement.operations.includes('查看');
  const hasCreate = /新增/.test(request);
  const hasEdit = requirement.operations.includes('编辑');
  const hasDelete = requirement.operations.includes('删除');
  const hasExport = requirement.operations.includes('导出') || /导出/.test(request);
  const hasRefresh = requirement.operations.includes('刷新') || /刷新/.test(request);
  const customOperations = requirement.operations.filter((label) => !['查看', '编辑', '删除', '导出', '刷新'].includes(label));
  if (!hasDetail && !hasCreate && !hasEdit && !hasDelete) {
    const operations = hasExport || hasRefresh ? { export: hasExport, refresh: hasRefresh } : {};
    if (customOperations.length) operations.custom = customOperations;
    return { request, sourceRequest, pageName: extractPageName(request), queryLabels, columnLabels, summary, operations };
  }

  const columns = columnLabels.map((label, index) => columnFor(label, index));
  const editableLabels = [...new Set([
    ...(hasCreate ? (requirement.createFields.length ? requirement.createFields : extractFormLabels(request, 'create')) : []),
    ...(hasEdit ? extractFormLabels(request, 'edit') : [])
  ])];
  const fallbackEditable = columns.filter((column) => !/编号|创建时间|更新时间/.test(column.label)).map((column) => column.label);
  const formLabels = editableLabels.length ? editableLabels : fallbackEditable;
  return {
    request,
    sourceRequest,
    pageName: extractPageName(request),
    queryLabels,
    columnLabels,
    summary,
    operations: {
      detail: hasDetail,
      create: hasCreate,
      edit: hasEdit,
      delete: hasDelete,
      export: hasExport,
      refresh: hasRefresh,
      custom: customOperations
    },
    columns,
    formLabels,
    primaryNav: requirement.primaryNav,
    sideNav: requirement.sideNav
  };
}

function formSpec(parsed, kind) {
  const titlePrefix = kind === 'edit' ? '编辑' : '新增';
  return {
    title: `${titlePrefix}${parsed.pageName}`,
    primaryLabel: '保存',
    successMessage: `${parsed.pageName}${kind === 'edit' ? '已更新' : '已新增'}。`,
    fields: parsed.formLabels.map((label, index) => fieldFor(label, index))
  };
}

function shellFor(parsed) {
  if (!parsed.primaryNav && !parsed.sideNav) return { activePrimaryKey: 'workspace' };
  const primaryKey = 'requested-primary';
  const pageKey = 'page-spec-current';
  const primaryLabel = parsed.primaryNav || '业务管理';
  const sideLabel = parsed.sideNav || parsed.pageName;
  return {
    primaryNav: [{ key: primaryKey, label: primaryLabel, route: `/${primaryKey}` }],
    sideMenusByPrimary: {
      [primaryKey]: [{
        key: 'requested-group',
        label: primaryLabel,
        icon: 'AppstoreOutlined',
        children: [{ key: pageKey, label: sideLabel, route: `/${primaryKey}/${pageKey}`, closable: false }]
      }]
    },
    tabs: [{ key: pageKey, label: sideLabel, route: `/${primaryKey}/${pageKey}`, closable: false }],
    activePrimaryKey: primaryKey,
    selectedMenuKey: pageKey,
    openMenuKeys: ['requested-group'],
    activeTabKey: pageKey
  };
}

export function compileListWorkbench({ rawRequest, changeId }) {
  const parsed = parseListWorkbenchRequest(rawRequest);
  const isAdvancedQuery = parsed.queryLabels.length > 6;
  const query = parsed.queryLabels.map((label, index) => ({
    ...fieldFor(label, index, false),
    ...(isAdvancedQuery && index >= 6 ? { advanced: true } : {})
  }));
  const columns = parsed.columns || parsed.columnLabels.map((label, index) => columnFor(label, index));
  const rowKey = columns.find((column) => /编号/.test(column.label))?.key || columns[0].key;
  const rows = [0, 1].map((rowIndex) => Object.fromEntries(columns.map((column) => [column.key, sampleValue(column, rowIndex)])));
  const capabilities = [isAdvancedQuery ? 'query.advanced' : 'query.basic', 'table.flat', 'table.pagination', 'table.columnSettings'];
  if (parsed.summary?.kind === 'inline') capabilities.push('summary.inline');
  if (parsed.summary?.kind === 'cards') capabilities.push('statistics.cards');
  if (columns.some((column) => column.format === 'status')) capabilities.push('table.status');
  if (columns.some((column) => column.format === 'amount')) capabilities.push('table.amount');
  if (parsed.operations.detail) capabilities.push('detail.drawer');
  if (parsed.operations.create) capabilities.push('list.drawerCreate');
  if (parsed.operations.edit) capabilities.push('table.editAction');
  if (parsed.operations.delete) capabilities.push('table.confirmAction', 'table.deleteAction');
  if (parsed.operations.export) capabilities.push('table.export');
  if (parsed.operations.refresh) capabilities.push('table.refresh');

  const table = { rowKey, sectionTitle: `${parsed.pageName}列表`, tools: ['settings'], columns, rows, pagination: { page: 1, pageSize: 20, total: rows.length } };
  if (parsed.operations.refresh) table.tools.unshift('refresh');
  if (parsed.operations.export) table.secondaryActions = [{ key: 'export', label: '导出', type: 'export' }];
  if (parsed.operations.create) {
    table.primaryAction = { key: 'create', label: '新增', createRecord: { [rowKey]: 'R003' }, form: formSpec(parsed, 'create') };
  }
  const actions = [];
  if (parsed.operations.detail) actions.push({ key: 'detail', label: '查看', type: 'detail' });
  if (parsed.operations.edit) actions.push({ key: 'edit', label: '编辑', type: 'edit', form: formSpec(parsed, 'edit') });
  if (parsed.operations.delete) actions.push({
    key: 'delete', label: '删除', type: 'delete', danger: true,
    confirm: { title: `确认删除${parsed.pageName}`, description: '确认删除当前记录吗？', impact: '删除后该记录将从当前列表移除。', reversible: false, successMessage: '记录已删除。' }
  });
  if (actions.length) {
    table.columns = [...columns, { key: 'actions', label: '操作', width: 180, hideable: false }];
    table.rowActions = actions;
  }
  if (parsed.operations.detail) {
    table.drawerDetail = {
      title: `${parsed.pageName}详情`, closeLabel: '关闭',
      groups: [{ key: 'basic', title: '基本信息', fields: columns.map((column) => ({ key: column.key, label: column.label, source: column.key, ...(column.format === 'status' ? { format: 'status', statusMap: STATUS_MAP } : {}), ...(column.format === 'amount' ? { format: 'amount', unit: column.unit } : {}) })) }]
    };
  }

  const list = { query: { fields: query, ...(isAdvancedQuery ? { defaultExpanded: false } : {}) }, table };
  if (parsed.summary?.kind === 'inline') {
    list.summary = {
      items: parsed.summary.labels.map((label, index) => ({
        key: `summary${index + 1}`,
        label,
        value: 0,
        suffix: /金额|收入|扣账|手续费/.test(label) ? ' 元' : ' 条'
      }))
    };
  }
  if (parsed.summary?.kind === 'cards') {
    list.statistics = {
      items: parsed.summary.labels.map((label, index) => ({
        key: `statistic${index + 1}`,
        label,
        value: 0,
        unit: /金额|收入|扣账|手续费/.test(label) ? '元' : '条'
      }))
    };
  }

  const templateId = parsed.summary?.kind === 'inline'
    ? 'list.inline-summary'
    : parsed.summary?.kind === 'cards' ? 'list.card-summary' : 'list.regular';
  const selectionReason = parsed.summary?.kind === 'inline'
    ? '主要任务是查询和处理一组记录；结果工具栏左侧使用 1 至 2 项轻量统计辅助扫描。'
    : parsed.summary?.kind === 'cards'
      ? '主要任务是查询和处理一组记录；结果区使用 3 至 5 项重要统计卡片辅助整体扫描。'
      : '主要任务是查询和处理一组记录；详情、新增、编辑和删除按业务需求组合到同一列表工作台。';

  return {
    schemaVersion: 1,
    ui: { system: 'boss-ledger', runtime: 'react-antd-page-spec', rendererVersion: 1 },
    metadata: {
      changeId, pageName: parsed.pageName, family: 'list', templateId, executionMode: 'page-spec-default', request: parsed.sourceRequest,
      selectionReason,
      assumptions: ['当前为客户端交互原型，不调用真实业务服务。', '未提供样例数据时使用两条通用演示记录。', '删除为当前列表中的客户端移除，并提供不可撤销确认。'],
      ruleRefs: parsed.summary ? [...RULE_REFS, 'BL-TPL-011'] : RULE_REFS
    },
    shell: shellFor(parsed),
    content: { capabilities: [...new Set(capabilities)] },
    list
  };
}
