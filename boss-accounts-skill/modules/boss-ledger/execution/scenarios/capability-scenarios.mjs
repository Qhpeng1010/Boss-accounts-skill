const ruleRefs = {
  form: ['BL-TPL-003', 'BL-TPL-005', 'BL-INT-005', 'BL-INT-006'],
  simplePageForm: ['BL-TPL-003', 'BL-TPL-005', 'BL-TPL-019', 'BL-INT-005', 'BL-INT-006', 'BL-INT-016'],
  wizard: ['BL-TPL-003', 'BL-TPL-007', 'BL-INT-005', 'BL-INT-006', 'BL-INT-007'],
  list: ['BL-TPL-001', 'BL-TPL-010', 'BL-INT-003', 'BL-INT-008'],
  detail: ['BL-TPL-003', 'BL-TPL-009', 'BL-INT-004'],
  dashboard: ['BL-TPL-002', 'BL-TPL-020', 'BL-INT-001', 'BL-INT-015']
};

function metadata({ changeId, pageName, family, templateId, executionMode, validatedCombinations, request, selectionReason, assumptions, refs }) {
  return {
    changeId,
    pageName,
    family,
    templateId,
    executionMode,
    ...(validatedCombinations ? { validatedCombinations } : {}),
    request,
    selectionReason,
    assumptions: ['当前为客户端交互原型，不调用真实业务服务。', ...assumptions],
    ruleRefs: refs
  };
}

function base({ changeId, pageName, family, templateId, executionMode, validatedCombinations, request, selectionReason, assumptions = [], refs, capabilities, body }) {
  return {
    schemaVersion: 1,
    metadata: metadata({ changeId, pageName, family, templateId, executionMode, validatedCombinations, request, selectionReason, assumptions, refs }),
    ui: { system: 'boss-ledger', runtime: 'react-antd-page-spec', rendererVersion: 1 },
    shell: { activePrimaryKey: family === 'detail' ? 'merchant' : family === 'dashboard' ? 'home' : 'workspace' },
    content: { capabilities },
    ...body
  };
}

const statusMap = {
  active: { label: '生效中', status: 'success' },
  pending: { label: '待生效', status: 'processing' },
  disabled: { label: '已失效', status: 'default' },
  pendingReview: { label: '待审核', status: 'processing' },
  approved: { label: '已通过', status: 'success' },
  rejected: { label: '已驳回', status: 'error' },
  paid: { label: '已打款', status: 'success' },
  failed: { label: '打款失败', status: 'error' }
};

const ruleColumns = [
  { key: 'ruleNo', label: '规则编号', width: 100, hideable: false },
  { key: 'ruleName', label: '规则名称', width: 180 },
  { key: 'merchantNo', label: '商户编号', width: 130 },
  { key: 'channel', label: '分账渠道', width: 120 },
  { key: 'status', label: '规则状态', width: 100, format: 'status', statusMap },
  { key: 'pendingAmount', label: '待分账金额', width: 140, format: 'amount', unit: '元' },
  { key: 'createdAt', label: '创建时间', width: 180 },
  { key: 'actions', label: '操作', width: 150, hideable: false }
];

const ruleRows = [
  { ruleNo: 'R001', ruleName: '连锁门店分润', merchantNo: '10080048989', channel: '线上收单', status: 'active', pendingAmount: 12860.32, createdAt: '2026-07-16 11:35:22' },
  { ruleNo: 'R002', ruleName: '联合运营', merchantNo: '10080048990', channel: '联营渠道', status: 'active', pendingAmount: 9820, createdAt: '2026-07-15 16:20:10' },
  { ruleNo: 'R003', ruleName: '收单按月', merchantNo: '10080048991', channel: '线上收单', status: 'pending', pendingAmount: 7610.5, createdAt: '2026-07-15 09:35:22' }
];

export const scenarios = [
  {
    id: '01-contact-create',
    title: '普通信息收集',
    spec: base({
      changeId: '20260729-capability-01-contact-create', pageName: '登记渠道联系人', family: 'form', templateId: 'form.modal-simple', executionMode: 'shadow', validatedCombinations: ['form.modal-simple'],
      request: '运营人员登记渠道联系人，校验必填项和 11 位手机号码后保存。', selectionReason: '四个相互独立字段，使用短表单 Modal。', assumptions: ['保存成功仅显示客户端反馈。'], refs: ruleRefs.form,
      capabilities: ['form.simple'],
      body: { form: { presentation: 'modal', fields: [
        { key: 'contactName', label: '联系人姓名', control: 'input', required: true },
        { key: 'mobile', label: '手机号码', control: 'input', required: true, pattern: '^\\d{11}$', patternMessage: '请输入 11 位手机号码' },
        { key: 'channel', label: '所属渠道', control: 'select', required: true, options: [{ label: '线上收单', value: 'online' }, { label: '联营渠道', value: 'partner' }, { label: '直营网点', value: 'direct' }] },
        { key: 'remark', label: '备注', control: 'textarea', rows: 3 }
      ], submit: { primaryLabel: '保 存', cancelLabel: '取 消', success: { title: '保存成功', message: '渠道联系人已保存。' } } } }
    })
  },
  {
    id: '16-contact-create-page',
    title: '独立简单表单页',
    spec: base({
      changeId: '20260730-capability-16-contact-create-page', pageName: '登记渠道联系人', family: 'form', templateId: 'form.page-simple', executionMode: 'shadow', validatedCombinations: ['form.page-simple'],
      request: '运营人员从独立菜单进入登记渠道联系人页面，校验必填项和 11 位手机号码后保存。', selectionReason: '页面从独立任务入口进入，没有需要保留的来源上下文；四个字段相互独立，使用独立简单表单页。', assumptions: ['保存成功仅显示客户端反馈。'], refs: ruleRefs.simplePageForm,
      capabilities: ['form.simple'],
      body: { form: { presentation: 'page', fields: [
        { key: 'contactName', label: '联系人姓名', control: 'input', required: true },
        { key: 'mobile', label: '手机号码', control: 'input', required: true, pattern: '^\\d{11}$', patternMessage: '请输入 11 位手机号码' },
        { key: 'channel', label: '所属渠道', control: 'select', required: true, options: [{ label: '线上收单', value: 'online' }, { label: '联营渠道', value: 'partner' }, { label: '直营网点', value: 'direct' }] },
        { key: 'remark', label: '备注', control: 'textarea', rows: 3 }
      ], submit: { primaryLabel: '保 存', cancelLabel: '取 消', success: { title: '保存成功', message: '渠道联系人已保存。' } } } }
    })
  },
  {
    id: '02-settlement-account-change',
    title: '普通表单加右侧说明',
    spec: base({
      changeId: '20260729-capability-02-settlement-account-change', pageName: '变更结算银行卡', family: 'form', templateId: 'form.guided-simple', executionMode: 'shadow', validatedCombinations: ['form.guided-simple'],
      request: '商户管理员变更结算银行卡，并在桌面端查看资金操作提示。', selectionReason: '单阶段资金账户填写，需要明确业务影响提示，使用带默认插图的引导式简单表单。', assumptions: ['桌面端展示默认引导插图，窄屏隐藏整个引导区而不隐藏提交动作。'], refs: [...ruleRefs.form, 'BL-TPL-008', 'BL-VIS-020', 'BL-INT-016'],
      capabilities: ['form.simple', 'form.sideGuide'],
      body: { form: { presentation: 'page', sideGuide: { title: '结算账户变更', text: '此操作会影响后续自动结算，请确认账户信息无误后提交。' }, fields: [
        { key: 'accountType', label: '账户类型', control: 'select', required: true, options: [{ label: '对公账户', value: 'corporate' }, { label: '对私账户', value: 'personal' }] },
        { key: 'legalCard', label: '法人结算卡', control: 'input', required: true },
        { key: 'accountName', label: '账户名称', control: 'input', required: true },
        { key: 'bankName', label: '银行账户开户行', control: 'input' },
        { key: 'bankAccount', label: '银行账户号码', control: 'input', required: true, pattern: '^\\d{10,19}$', patternMessage: '请输入 10 至 19 位数字' }
      ], submit: { primaryLabel: '提 交', cancelLabel: '取 消', success: { title: '提交成功', message: '结算账户变更申请已提交。' } } } }
    })
  },
  {
    id: '03-merchant-settlement-config',
    title: '分组配置表单',
    spec: base({
      changeId: '20260729-capability-03-merchant-settlement-config', pageName: '配置商户结算信息', family: 'form', templateId: 'form.grouped-page', executionMode: 'shadow', validatedCombinations: ['form.grouped'],
      request: '财务人员按商户基本信息、收款账户和结算周期三组配置商户结算信息。', selectionReason: '字段较多且必须按三个语义信息组核对，使用分组全页表单。', refs: [...ruleRefs.form, 'BL-TPL-007'],
      capabilities: ['form.groups', 'form.stickyActions'],
      body: { form: { presentation: 'page', stickyActions: true, groups: [
        { key: 'merchant', title: '商户基本信息', fields: [{ key: 'merchantNo', label: '商户编号', control: 'input', required: true }, { key: 'merchantName', label: '商户名称', control: 'input', required: true }, { key: 'industry', label: '所属行业', control: 'select', required: true, options: [{ label: '零售', value: 'retail' }, { label: '科技', value: 'technology' }] }] },
        { key: 'account', title: '收款账户', fields: [{ key: 'accountType', label: '账户类型', control: 'select', required: true, options: [{ label: '对公账户', value: 'corporate' }, { label: '对私账户', value: 'personal' }] }, { key: 'accountName', label: '账户名称', control: 'input', required: true }, { key: 'bankName', label: '开户行', control: 'input' }, { key: 'bankAccount', label: '银行账户号码', control: 'input', required: true, pattern: '^\\d{10,19}$', patternMessage: '请输入 10 至 19 位数字' }] },
        { key: 'settlement', title: '结算周期', fields: [{ key: 'cycle', label: '结算周期', control: 'select', required: true, options: [{ label: 'T+1', value: 't1' }, { label: 'T+7', value: 't7' }] }, { key: 'method', label: '结算方式', control: 'select', required: true, options: [{ label: '自动结算', value: 'auto' }, { label: '人工结算', value: 'manual' }] }, { key: 'feeRate', label: '手续费率', control: 'number', required: true, min: 0, max: 100, precision: 2 }] }
      ], submit: { primaryLabel: '保 存', cancelLabel: '取 消', success: { title: '保存成功', message: '商户结算信息已保存。' } } } }
    })
  },
  {
    id: '04-settlement-account-wizard',
    title: '分阶段账户变更',
    spec: base({
      changeId: '20260729-capability-04-settlement-account-wizard', pageName: '变更商户结算账户', family: 'form', templateId: 'form.staged-flow', executionMode: 'shadow', validatedCombinations: ['form.steps-return-source'],
      request: '运营人员分三步变更商户结算账户，最终成功后返回列表。', selectionReason: '第二步依赖变更方式，提交前需完整只读确认，使用步骤流程。', refs: ruleRefs.wizard,
      capabilities: ['form.steps', 'form.review', 'form.stickyActions', 'form.returnSource'],
      body: { form: { presentation: 'page', stickyActions: true, steps: [
        { key: 'method', title: '选择变更方式', description: '确认本次变更范围', fields: [{ key: 'changeMode', label: '变更方式', control: 'radio', required: true, default: 'changePerson', options: [{ label: '仅变更卡号', value: 'cardOnly' }, { label: '变更结算人', value: 'changePerson' }] }] },
        { key: 'account', title: '填写账户信息', description: '校验新的收款账户', fields: [{ key: 'accountType', label: '账户类型', control: 'select', required: true, options: [{ label: '对公账户', value: 'corporate' }, { label: '对私账户', value: 'personal' }] }, { key: 'legalCard', label: '法人结算卡', control: 'input', required: true }, { key: 'accountName', label: '账户名称', control: 'input', required: true }, { key: 'bankName', label: '开户行', control: 'input' }, { key: 'bankAccount', label: '银行账户号码', control: 'input', required: true, pattern: '^\\d{10,19}$', patternMessage: '请输入 10 至 19 位数字' }] },
        { key: 'review', title: '确认提交', description: '只读核对全部变更信息', review: true }
      ], wizardGuide: { alt: '结算账户变更引导', title: '按步骤完成账户变更', text: '请先确认变更方式，再填写收款账户并完成提交前核对。' }, submit: { primaryLabel: '提 交', confirm: { title: '确认提交', description: '确认提交本次结算账户变更吗？' }, success: { title: '账户变更完成', message: '商户结算账户已完成变更。', actionLabel: '返回列表', actionType: 'return-source' } }, verification: { validValues: { changeMode: 'changePerson', accountType: 'corporate', legalCard: '6222021234567890123', accountName: '杭州星云商贸有限公司', bankName: '招商银行杭州分行', bankAccount: '6222021234567890123' } } } }
    })
  },
  {
    id: '05-settlement-import',
    title: '上传、复核和完成',
    spec: base({
      changeId: '20260729-capability-05-settlement-import', pageName: '导入商户结算名单', family: 'form', templateId: 'form.staged-flow', executionMode: 'shadow', validatedCombinations: ['form.upload-review'],
      request: '财务人员上传一个 xlsx 文件，查看解析结果后确认导入并获得结果反馈。', selectionReason: '上传、解析、复核与提交有明确前后依赖，使用上传复核步骤流程。', refs: [...ruleRefs.wizard, 'BL-TPL-021', 'BL-VIS-021', 'BL-INT-017'],
      capabilities: ['form.steps', 'form.review', 'form.stickyActions', 'form.upload', 'form.reviewTable', 'form.resultSummary', 'form.resultFeedback'],
      body: { form: { presentation: 'page', stickyActions: true, steps: [
        { key: 'upload', title: '上传文件', description: '上传一个结算名单文件', fields: [{ key: 'file', label: '结算名单', control: 'upload', required: true, accept: '.xlsx', maxCount: 1, uploadLabel: '选择 Excel 文件', requiredMessage: '请上传 xlsx 文件' }] },
        { key: 'review', title: '解析复核', description: '核对解析出的结算记录', review: true, previewTable: { rowKey: 'merchantNo', columns: [{ key: 'merchantNo', label: '商户编号' }, { key: 'merchantName', label: '商户名称' }, { key: 'account', label: '结算账户' }, { key: 'status', label: '结算状态', format: 'status', statusMap: { pending: { label: '待生效', status: 'processing' } } }], rows: [{ merchantNo: '10001', merchantName: '杭州星云商贸有限公司', account: '6222021234567890123', status: 'pending' }, { merchantNo: '10002', merchantName: '上海锦程科技有限公司', account: '6222029876543210987', status: 'pending' }] } },
        { key: 'complete', title: '确认导入', description: '确认无误后完成导入', review: true }
      ], wizardGuide: { alt: '结算名单导入引导', title: '上传后请核对解析结果', text: '仅支持一个 xlsx 文件；确认名单与账户无误后再提交导入。' }, submit: { primaryLabel: '确认导入', confirm: { title: '确认导入', description: '确认导入 2 条商户结算记录吗？' }, success: { title: '导入完成', message: '成功导入 2 条记录。', actionLabel: '继续导入', summary: { items: [{ key: 'total', label: '提交记录', value: 2, unit: ' 条' }, { key: 'success', label: '导入成功', value: 2, unit: ' 条' }, { key: 'failed', label: '导入失败', value: 0, unit: ' 条' }, { key: 'pending', label: '待生效', value: 2, unit: ' 条' }] }, feedback: { question: '本次导入体验感觉如何？' } } } } }
    })
  },
  {
    id: '06-split-rule-query',
    title: '列表加简单操作',
    spec: base({
      changeId: '20260729-capability-06-split-rule-query', pageName: '分账规则查询', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '运营人员按规则创建时间、规则名称、商户编号、分账渠道、规则类型和规则状态查询分账规则，并可修改或失效。', selectionReason: '以定位和处理记录集合为主要任务，使用常规查询列表。', refs: [...ruleRefs.list, 'BL-INT-010'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'table.confirmAction', 'table.editAction'],
      body: { list: { query: { fields: [{ key: 'createdAt', label: '规则创建时间', control: 'date-range', presets: ['今日', '近 7 日', '近 30 日'] }, { key: 'ruleName', label: '规则名称', control: 'input' }, { key: 'merchantNo', label: '商户编号', control: 'input' }, { key: 'channel', label: '分账渠道', control: 'select', options: [{ label: '线上收单', value: 'online' }, { label: '联营渠道', value: 'partner' }, { label: '直营网点', value: 'direct' }] }, { key: 'ruleType', label: '规则类型', control: 'select', options: [{ label: '按比例分账', value: 'percentage' }, { label: '固定金额分账', value: 'fixed' }] }, { key: 'status', label: '规则状态', control: 'select', options: [{ label: '生效中', value: 'active' }, { label: '待生效', value: 'pending' }, { label: '已失效', value: 'disabled' }] }] }, table: { rowKey: 'ruleNo', sectionTitle: '分账规则列表', columns: ruleColumns, rows: ruleRows, pagination: { page: 1, pageSize: 20, total: 3 }, rowActions: [
        { key: 'edit', label: '修改', type: 'edit', form: { title: '修改分账规则', primaryLabel: '保 存', successMessage: '分账规则已更新。', fields: [{ key: 'ruleName', label: '规则名称', control: 'input', required: true }, { key: 'channel', label: '分账渠道', control: 'select', required: true, options: [{ label: '线上收单', value: '线上收单' }, { label: '联营渠道', value: '联营渠道' }] }] } },
        { key: 'disable', label: '失效', type: 'confirm-state-change', danger: true, visibleWhen: { field: 'status', equals: 'active' }, confirm: { title: '确认使规则失效', description: '确认使当前分账规则失效？', impact: '失效后该规则不再参与后续分账。', reversible: false, successMessage: '分账规则已失效。' }, effect: { field: 'status', value: 'disabled' } }
      ] } } }
    })
  },
  {
    id: '07-settlement-rule-advanced',
    title: '高级查询、工具栏和列设置',
    spec: base({
      changeId: '20260729-capability-07-settlement-rule-advanced', pageName: '结算规则查询', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '财务人员以高级条件查询结算规则，并使用新增、批量配置、导出、刷新和可排序列设置。', selectionReason: '主要工作仍是多条件定位与处理规则集合，使用高级查询列表。', refs: [...ruleRefs.list, 'BL-TPL-016'],
      capabilities: ['query.advanced', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'table.refresh', 'table.columnSettings', 'table.columnOrder', 'table.export', 'table.editAction', 'table.confirmAction', 'list.drawerCreate'],
      body: { list: { query: { defaultExpanded: false, fields: [
        { key: 'createdAt', label: '创建时间', control: 'date-range', presets: ['今日', '近 7 日', '近 30 日'] }, { key: 'ruleName', label: '规则名称', control: 'input' }, { key: 'merchantNo', label: '商户编号', control: 'input' }, { key: 'status', label: '规则状态', control: 'select', advanced: true, options: [{ label: '生效中', value: 'active' }, { label: '待生效', value: 'pending' }, { label: '已失效', value: 'disabled' }] }, { key: 'channel', label: '分账渠道', control: 'select', advanced: true, options: [{ label: '线上收单', value: '线上收单' }, { label: '联营渠道', value: '联营渠道' }, { label: '直营网点', value: '直营网点' }] }, { key: 'ruleNo', label: '规则编号', control: 'input', advanced: true }
      ] }, table: { rowKey: 'ruleNo', sectionTitle: '结算规则列表', tools: ['refresh', 'settings'], columnSettings: { allowOrder: true }, primaryAction: { key: 'create', label: '新增规则', createRecord: { ruleNo: 'R009', merchantNo: '10080048997', channel: '线上收单', status: 'pending', pendingAmount: 0, createdAt: '2026-07-29 10:00:00' }, form: { title: '新增结算规则', primaryLabel: '保 存', successMessage: '结算规则已新增。', fields: [{ key: 'ruleName', label: '规则名称', control: 'input', required: true }] } }, secondaryActions: [{ key: 'batchConfig', label: '批量配置' }, { key: 'export', label: '导出', type: 'export' }], columns: ruleColumns, rows: [...ruleRows, { ruleNo: 'R004', ruleName: '全部按月', merchantNo: '10080048992', channel: '直营网点', status: 'pending', pendingAmount: 4280, createdAt: '2026-07-14 12:32:00' }, { ruleNo: 'R005', ruleName: '月周期收单', merchantNo: '10080048993', channel: '线上收单', status: 'active', pendingAmount: 3860.06, createdAt: '2026-07-14 11:35:22' }, { ruleNo: 'R006', ruleName: '实时交易', merchantNo: '10080048994', channel: '联营渠道', status: 'active', pendingAmount: 3570.18, createdAt: '2026-07-13 18:45:11' }, { ruleNo: 'R007', ruleName: '订单金额比例', merchantNo: '10080048995', channel: '直营网点', status: 'disabled', pendingAmount: 0, createdAt: '2026-07-13 11:35:22' }, { ruleNo: 'R008', ruleName: '直营网点保底分成', merchantNo: '10080048996', channel: '联营渠道', status: 'active', pendingAmount: 1210.8, createdAt: '2026-07-12 10:18:04' }], pagination: { page: 1, pageSize: 20, total: 8 }, rowActions: [{ key: 'edit', label: '修改', type: 'edit', form: { title: '修改结算规则', primaryLabel: '保 存', successMessage: '结算规则已更新。', fields: [{ key: 'ruleName', label: '规则名称', control: 'input', required: true }] } }, { key: 'disable', label: '失效', type: 'confirm-state-change', danger: true, visibleWhen: { field: 'status', equals: 'active' }, confirm: { title: '确认使规则失效', description: '确认使当前结算规则失效？', impact: '失效后该规则不再参与后续结算。', reversible: false, successMessage: '结算规则已失效。' }, effect: { field: 'status', value: 'disabled' } }] } } }
    })
  },
  {
    id: '08-settlement-bill-statistics',
    title: '列表统计',
    spec: base({
      changeId: '20260729-capability-08-settlement-bill-statistics', pageName: '结算单查询', family: 'list', templateId: 'list.card-summary', executionMode: 'page-spec-default',
      request: '财务人员查询结算单并查看本期结算和打款统计。', selectionReason: '列表任务前需要四项高优先级统计，使用统计卡片查询列表。', refs: [...ruleRefs.list, 'BL-TPL-011'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'statistics.cards'],
      body: { list: { query: { fields: [{ key: 'settlementDate', label: '结算日期', control: 'date' }, { key: 'statementNo', label: '结算单号', control: 'input' }, { key: 'merchantName', label: '商户名称', control: 'input' }, { key: 'status', label: '结算状态', control: 'select', options: [{ label: '已打款', value: 'paid' }, { label: '打款失败', value: 'failed' }] }] }, statistics: { items: [{ key: 'count', label: '本期结算笔数', value: 128, unit: '笔' }, { key: 'payable', label: '应付总金额', value: 2865400, precision: 2, unit: '元' }, { key: 'paid', label: '实打款总金额', value: 2798600, precision: 2, unit: '元' }, { key: 'failed', label: '打款失败', value: 3, unit: '笔' }] }, table: { rowKey: 'statementNo', sectionTitle: '结算单列表', columns: [{ key: 'statementNo', label: '结算单号', width: 150 }, { key: 'merchantName', label: '商户名称', width: 220 }, { key: 'payable', label: '应付金额', format: 'amount', unit: '元', width: 150 }, { key: 'paidAmount', label: '实打款金额', format: 'amount', unit: '元', width: 150 }, { key: 'status', label: '结算状态', format: 'status', statusMap, width: 120 }], rows: [{ statementNo: 'JS001', merchantName: '杭州星云商贸有限公司', payable: 120000, paidAmount: 118800, status: 'paid' }, { statementNo: 'JS002', merchantName: '上海锦程科技有限公司', payable: 98500, paidAmount: 0, status: 'failed' }, { statementNo: 'JS003', merchantName: '广州启明商贸有限公司', payable: 76200, paidAmount: 76200, status: 'paid' }], pagination: { page: 1, pageSize: 20, total: 3 } } } }
    })
  },
  {
    id: '09-settlement-rule-batch-review',
    title: '批量操作',
    spec: base({
      changeId: '20260729-capability-09-settlement-rule-batch-review', pageName: '待审核结算规则', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '运营人员查询待审核结算规则，选择记录后批量通过或批量驳回。', selectionReason: '记录审核是列表中的原子批量处理任务，使用带勾选的查询列表。', refs: [...ruleRefs.list, 'BL-TPL-015', 'BL-INT-002', 'BL-INT-010'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.batchAction'],
      body: { list: { query: { fields: [{ key: 'ruleName', label: '规则名称', control: 'input' }, { key: 'status', label: '审核状态', control: 'select', options: [{ label: '待审核', value: 'pendingReview' }, { label: '已通过', value: 'approved' }, { label: '已驳回', value: 'rejected' }] }] }, table: { rowKey: 'ruleNo', sectionTitle: '待审核规则', rowSelection: true, columns: [{ key: 'ruleNo', label: '规则编号', width: 100 }, { key: 'ruleName', label: '规则名称', width: 220 }, { key: 'merchantName', label: '商户名称', width: 220 }, { key: 'status', label: '审核状态', format: 'status', statusMap, width: 120 }, { key: 'createdAt', label: '创建时间', width: 180 }], rows: [{ ruleNo: 'R001', ruleName: '华东直营网点结算', merchantName: '杭州星云商贸有限公司', status: 'pendingReview', createdAt: '2026-07-16 11:35:22' }, { ruleNo: 'R002', ruleName: '联营渠道月度分润', merchantName: '上海锦程科技有限公司', status: 'pendingReview', createdAt: '2026-07-15 16:20:10' }, { ruleNo: 'R003', ruleName: '渠道服务费抵扣', merchantName: '广州启明商贸有限公司', status: 'approved', createdAt: '2026-07-14 09:35:22' }], batchActions: [{ key: 'approve', label: '批量通过', effect: { field: 'status', value: 'approved' }, confirm: { title: '确认批量通过', description: '确认通过所选结算规则？', impact: '所选规则将进入生效准备状态。', successMessage: '所选结算规则已通过。' } }, { key: 'reject', label: '批量驳回', danger: true, effect: { field: 'status', value: 'rejected' }, confirm: { title: '确认批量驳回', description: '确认驳回所选结算规则？', impact: '所选规则需重新修改后再提交审核。', reversible: false, successMessage: '所选结算规则已驳回。' } }], pagination: { page: 1, pageSize: 20, total: 3 } } } }
    })
  },
  {
    id: '10-settlement-batch-expand',
    title: '父表展开子表',
    spec: base({
      changeId: '20260729-capability-10-settlement-batch-expand', pageName: '结算批次查询', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '财务人员查询结算批次，按需展开查看批次下的商户明细。', selectionReason: '父记录与少量直接子记录需要就地比对，使用可展开查询列表。', refs: [...ruleRefs.list, 'BL-TPL-015'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'table.expandable'],
      body: { list: { query: { fields: [{ key: 'batchNo', label: '结算批次号', control: 'input' }, { key: 'status', label: '批次状态', control: 'select', options: [{ label: '已完成', value: 'completed' }, { label: '处理中', value: 'processing' }] }] }, table: { rowKey: 'batchNo', sectionTitle: '结算批次列表', columns: [{ key: 'batchNo', label: '批次号', width: 120 }, { key: 'period', label: '结算周期', width: 260 }, { key: 'merchantCount', label: '商户数量', width: 110 }, { key: 'payable', label: '应付总金额', format: 'amount', unit: '元', width: 150 }, { key: 'status', label: '批次状态', format: 'status', width: 120, statusMap: { completed: { label: '已完成', status: 'success' }, processing: { label: '处理中', status: 'processing' } } }], rows: [{ batchNo: 'B001', period: '2026-07-01 至 2026-07-07', merchantCount: 2, payable: 218500, status: 'completed', merchantDetails: [{ merchantName: '杭州星云商贸有限公司', amount: 120000, status: 'paid' }, { merchantName: '上海锦程科技有限公司', amount: 98500, status: 'paid' }] }], expandable: { childTable: { rowsSource: 'merchantDetails', rowKey: 'merchantName', columns: [{ key: 'merchantName', label: '商户名称' }, { key: 'amount', label: '应付金额', format: 'amount', unit: '元' }, { key: 'status', label: '结算状态', format: 'status', statusMap }] } }, pagination: { page: 1, pageSize: 20, total: 1 } } } }
    })
  },
  {
    id: '11-settlement-rule-management',
    title: '列表内新增与详情抽屉',
    spec: base({
      changeId: '20260729-capability-11-settlement-rule-management', pageName: '结算规则管理', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '运营人员在结算规则列表中新增规则并从行内打开只读详情。', selectionReason: '新增字段少、详情短且都必须保留当前列表上下文，使用 Drawer 组合。', refs: [...ruleRefs.list, 'BL-TPL-012', 'BL-TPL-013', 'BL-INT-004'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'list.drawerCreate', 'detail.drawer'],
      body: { list: { query: { fields: [{ key: 'ruleName', label: '规则名称', control: 'input' }, { key: 'status', label: '规则状态', control: 'select', options: [{ label: '生效中', value: 'active' }, { label: '待生效', value: 'pending' }] }] }, table: { rowKey: 'ruleNo', sectionTitle: '结算规则列表', primaryAction: { key: 'create', label: '新增规则', createRecord: { ruleNo: 'R003' }, form: { title: '新增结算规则', primaryLabel: '保 存', successMessage: '结算规则已新增。', fields: [{ key: 'ruleName', label: '规则名称', control: 'input', required: true }, { key: 'merchantName', label: '商户名称', control: 'input', required: true }, { key: 'status', label: '规则状态', control: 'select', required: true, options: [{ label: '生效中', value: 'active' }, { label: '待生效', value: 'pending' }] }] } }, columns: [{ key: 'ruleNo', label: '规则编号', width: 120, hideable: false }, { key: 'ruleName', label: '规则名称', width: 220 }, { key: 'merchantName', label: '商户名称', width: 240 }, { key: 'status', label: '规则状态', format: 'status', statusMap, width: 120 }, { key: 'actions', label: '操作', width: 100, hideable: false }], drawerDetail: { title: '结算规则详情', closeLabel: '关 闭', groups: [{ key: 'basic', title: '基本信息', fields: [{ key: 'ruleNo', label: '规则编号', source: 'ruleNo' }, { key: 'ruleName', label: '规则名称', source: 'ruleName' }, { key: 'merchantName', label: '商户名称', source: 'merchantName' }, { key: 'status', label: '规则状态', source: 'status', format: 'status', statusMap }] }] }, rowActions: [{ key: 'detail', label: '详情', type: 'detail' }], rows: [{ ruleNo: 'R001', ruleName: '华东直营网点结算', merchantName: '杭州星云商贸有限公司', status: 'active' }, { ruleNo: 'R002', ruleName: '联营渠道月度分润', merchantName: '上海锦程科技有限公司', status: 'pending' }], pagination: { page: 1, pageSize: 20, total: 2 } } } }
    })
  },
  {
    id: '12-settlement-quick-detail',
    title: '快速详情弹窗',
    spec: base({
      changeId: '20260729-capability-12-settlement-quick-detail', pageName: '结算单详情', family: 'detail', templateId: 'detail.record', executionMode: 'shadow', validatedCombinations: ['detail.modal-quick'],
      request: '运营人员快速查看一笔结算单的关键信息。', selectionReason: '信息量很小且只需关闭，使用快速详情 Modal。', refs: ruleRefs.detail,
      capabilities: ['detail.groups', 'detail.modal'],
      body: { detail: { presentation: 'modal', width: 640, closeLabel: '关 闭', groups: [{ key: 'basic', title: '结算单信息', fields: [{ key: 'statementNo', label: '结算单号', value: 'JS20260716001' }, { key: 'merchantName', label: '商户名称', value: '杭州星云商贸有限公司', span: 2 }, { key: 'settlementDate', label: '结算日期', value: '2026-07-16' }, { key: 'payable', label: '应付金额', value: 120000, format: 'amount', unit: '元' }, { key: 'paidAmount', label: '实打款金额', value: 118800, format: 'amount', unit: '元' }, { key: 'status', label: '结算状态', value: '已打款', format: 'status', status: 'success' }] }] } }
    })
  },
  {
    id: '13-split-record-drawer',
    title: '抽屉内分组详情和退款明细',
    spec: base({
      changeId: '20260729-capability-13-split-record-drawer', pageName: '分账记录查询', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '运营人员从分账记录列表打开 Drawer，连续查看订单信息、支付信息和两条退款明细。', selectionReason: '一条来源记录需连续核对两组信息并查看有限退款明细，使用抽屉内分组详情。', refs: [...ruleRefs.list, 'BL-VIS-014', 'BL-TPL-013', 'BL-INT-004'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'detail.drawer', 'detail.drawerTable'],
      body: { list: { query: { fields: [{ key: 'batchNo', label: '分账批次号', control: 'input' }] }, table: { rowKey: 'batchNo', sectionTitle: '分账记录列表', columns: [{ key: 'batchNo', label: '分账批次号', width: 260 }, { key: 'merchantName', label: '商户简称', width: 220 }, { key: 'status', label: '分账状态', format: 'status', width: 120, statusMap: { partial: { label: '部分成功', status: 'processing' } } }, { key: 'totalAmount', label: '分账总金额', hidden: true }, { key: 'receivedAmount', label: '到账总金额', hidden: true }, { key: 'mode', label: '分账方式', hidden: true }, { key: 'count', label: '分账到账笔数', hidden: true }, { key: 'operator', label: '操作员', hidden: true }, { key: 'createdAt', label: '分账发起时间', hidden: true }, { key: 'actions', label: '操作', width: 100, hideable: false }], drawerDetail: { title: '分账记录详情', closeLabel: '我知道了', groups: [{ key: 'order', title: '订单信息', fields: [{ key: 'merchantName', label: '商户简称', source: 'merchantName' }, { key: 'status', label: '分账状态', source: 'status', format: 'status', statusMap: { partial: { label: '部分成功', status: 'processing' } } }, { key: 'totalAmount', label: '分账总金额', source: 'totalAmount', format: 'amount', unit: '元' }, { key: 'batchNo', label: '分账批次号', source: 'batchNo', span: 2 }] }, { key: 'payment', title: '支付信息', fields: [{ key: 'receivedAmount', label: '到账总金额', source: 'receivedAmount', format: 'amount', unit: '元' }, { key: 'mode', label: '分账方式', source: 'mode' }, { key: 'count', label: '分账到账笔数', source: 'count' }, { key: 'operator', label: '操作员', source: 'operator' }, { key: 'createdAt', label: '分账发起时间', source: 'createdAt', span: 2 }] }, { key: 'refund', title: '退款信息', table: { rowsSource: 'refunds', rowKey: 'requestNo', columns: [{ key: 'requestedAt', label: '退款请求时间' }, { key: 'requestNo', label: '退款请求号' }, { key: 'completedAt', label: '退款完成时间' }, { key: 'amount', label: '退款金额', format: 'amount', unit: '元' }, { key: 'description', label: '退款说明' }, { key: 'remark', label: '账备注' }, { key: 'status', label: '退款状态', format: 'status', statusMap: { success: { label: '成功', status: 'success' }, failed: { label: '失败', status: 'error' } } }] } }] }, rowActions: [{ key: 'detail', label: '详情', type: 'detail' }], rows: [{ batchNo: '1320250529180001984748592271', merchantName: '签约名10080028707', status: 'partial', totalAmount: 766651.38, receivedAmount: 6654.98, mode: '自动', count: '2 笔', operator: '杨小雨', createdAt: '2025-05-29 18:00:02', refunds: [{ requestedAt: '2025-05-29 18:08:21', requestNo: '10082983398', completedAt: '2025-05-29 18:09:10', amount: 26293.99, description: '-', remark: '-', status: 'success' }, { requestedAt: '2025-05-29 18:12:45', requestNo: '10082983400', completedAt: '2025-05-29 18:13:21', amount: 2332.87, description: '余额不足', remark: '余额不足', status: 'failed' }] }], pagination: { page: 1, pageSize: 20, total: 1 } } } }
    })
  },
  {
    id: '14-merchant-settlement-long-detail',
    title: '长详情页分组承载',
    spec: base({
      changeId: '20260729-capability-14-merchant-settlement-long-detail', pageName: '渠道结算配置详情', family: 'detail', templateId: 'detail.record', executionMode: 'shadow', validatedCombinations: ['detail.grouped-basic'],
      request: '财务人员查看杭州星云商贸有限公司的七组渠道结算配置，并按业务信息组完成只读核对。', selectionReason: '多个独立业务信息组需要连续核对，使用分组独立详情页。', refs: ruleRefs.detail,
      capabilities: ['detail.groups'],
      body: { detail: { presentation: 'page', groups: [
        { key: 'basic', title: '基本信息', fields: [{ key: 'merchantNo', label: '商户编号', value: 'M10080028707' }, { key: 'merchantName', label: '商户名称', value: '杭州星云商贸有限公司' }, { key: 'status', label: '配置状态', value: '生效中', format: 'status', status: 'success' }, { key: 'createdAt', label: '创建时间', value: '2026-07-16 11:35:22' }] },
        { key: 'subject', title: '商户主体', fields: [{ key: 'subjectType', label: '主体类型', value: '企业' }, { key: 'creditCode', label: '统一社会信用代码', value: '91330100MA2AXXXX' }, { key: 'legalName', label: '法人姓名', value: '王小明' }, { key: 'mobile', label: '联系人电话', value: '13800138000' }] },
        { key: 'account', title: '收款账户', fields: [{ key: 'accountName', label: '账户名称', value: '杭州星云商贸有限公司' }, { key: 'bank', label: '开户行', value: '招商银行杭州分行' }, { key: 'accountNo', label: '银行账号', value: '6222********7890' }, { key: 'accountStatus', label: '账户状态', value: '已核验', format: 'status', status: 'success' }] },
        { key: 'settlement', title: '结算周期与分账规则', fields: [{ key: 'cycle', label: '结算周期', value: 'T+1' }, { key: 'splitMode', label: '分账方式', value: '自动' }, { key: 'ratio', label: '分账比例', value: '30%' }] },
        { key: 'rate', title: '费率配置', fields: [{ key: 'serviceRate', label: '服务费率', value: '0.38%' }, { key: 'feeRate', label: '手续费率', value: '0.20%' }, { key: 'effectiveAt', label: '生效日期', value: '2026-07-01' }] },
        { key: 'approval', title: '审批记录', fields: [{ key: 'approver', label: '审批人', value: '李敏' }, { key: 'opinion', label: '审批意见', value: '同意' }, { key: 'approvedAt', label: '审批时间', value: '2026-07-15 16:20:10' }] },
        { key: 'log', title: '操作日志', fields: [{ key: 'operator', label: '操作人', value: '张华' }, { key: 'operation', label: '操作内容', value: '创建结算配置' }, { key: 'operatedAt', label: '操作时间', value: '2026-07-15 10:05:22' }] }
      ] } }
    })
  },
  {
    id: '15-settlement-account-tabs',
    title: '分组标签详情和指标',
    spec: base({
      changeId: '20260729-capability-15-settlement-account-tabs', pageName: '结算账户详情', family: 'detail', templateId: 'detail.record', executionMode: 'shadow', validatedCombinations: ['detail.tabs-metrics'],
      request: '财务人员查看结算账户的三个指标，并按标签查看基本信息、结算配置和资金流水。', selectionReason: '指标需置顶且详情按三个等价内容组切换，使用指标加 Tabs 详情。', refs: ruleRefs.detail,
      capabilities: ['detail.groups', 'detail.metrics', 'detail.embeddedTable', 'detail.tabs'],
      body: { detail: { presentation: 'page', metrics: [{ key: 'balance', label: '账户余额', value: 286540, precision: 2, unit: '元' }, { key: 'available', label: '可用余额', value: 265400, precision: 2, unit: '元' }, { key: 'frozen', label: '冻结金额', value: 21140, precision: 2, unit: '元' }], tabs: [{ key: 'basic', label: '基本信息', groupKeys: ['basic'] }, { key: 'config', label: '结算配置', groupKeys: ['config'] }, { key: 'flows', label: '资金流水', groupKeys: ['flows'] }], groups: [
        { key: 'basic', title: '基本信息', fields: [{ key: 'accountName', label: '账户名称', value: '杭州星云结算账户' }, { key: 'merchantName', label: '商户名称', value: '杭州星云商贸有限公司' }, { key: 'status', label: '账户状态', value: '正常', format: 'status', status: 'success' }, { key: 'openedAt', label: '开户时间', value: '2025-01-15 09:20:00' }] },
        { key: 'config', title: '结算配置', fields: [{ key: 'cycle', label: '结算周期', value: 'T+1' }, { key: 'method', label: '结算方式', value: '自动结算' }, { key: 'feeRate', label: '手续费率', value: '0.20%' }] },
        { key: 'flows', title: '资金流水', table: { rowKey: 'flowNo', columns: [{ key: 'flowNo', label: '流水号' }, { key: 'createdAt', label: '发生时间' }, { key: 'amount', label: '金额', format: 'amount', unit: '元' }, { key: 'status', label: '状态', format: 'status', statusMap: { incoming: { label: '入账成功', status: 'success' }, outgoing: { label: '出账成功', status: 'success' }, frozen: { label: '冻结中', status: 'processing' } } }], rows: [{ flowNo: 'LS001', createdAt: '2026-07-16 10:12:05', amount: 120000, status: 'incoming' }, { flowNo: 'LS002', createdAt: '2026-07-16 11:32:18', amount: 118800, status: 'outgoing' }, { flowNo: 'LS003', createdAt: '2026-07-16 14:20:33', amount: 21140, status: 'frozen' }] } }
      ] } }
    })
  },
  {
    id: '17-merchant-service-config-drawer-create',
    title: '列表内较长新增 Drawer',
    spec: base({
      changeId: '20260730-capability-17-merchant-service-config-drawer-create', pageName: '商户服务配置查询', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '运营人员查询商户服务配置，并在保留列表上下文的前提下新建 9 字段服务配置。', selectionReason: '任务从列表内发起，关闭后应回到原查询结果；9 个相互独立字段需要更多纵向空间，使用列表内新增 Drawer。', refs: [...ruleRefs.list, 'BL-TPL-005', 'BL-TPL-012', 'BL-INT-004'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'list.drawerCreate'],
      body: { list: { query: { fields: [
        { key: 'merchantName', label: '商户名称', control: 'input' },
        { key: 'serviceStatus', label: '服务状态', control: 'select', options: [{ label: '启用', value: 'active' }, { label: '停用', value: 'disabled' }] }
      ] }, table: { rowKey: 'configNo', sectionTitle: '商户服务配置列表', primaryAction: {
        key: 'create', label: '新增配置', createRecord: { configNo: 'C003', serviceStatus: 'active', createdAt: '2026-07-30 10:00:00' }, form: {
          title: '新增商户服务配置', primaryLabel: '保 存', successMessage: '商户服务配置已新增。', fields: [
            { key: 'merchantNo', label: '商户编号', control: 'input', required: true },
            { key: 'merchantName', label: '商户名称', control: 'input', required: true },
            { key: 'serviceType', label: '服务类型', control: 'select', required: true, options: [{ label: '线上收单', value: 'online' }, { label: '分账服务', value: 'split' }] },
            { key: 'businessRole', label: '业务角色', control: 'select', required: true, options: [{ label: '主商户', value: 'primary' }, { label: '服务商', value: 'provider' }] },
            { key: 'billingMode', label: '计费方式', control: 'select', required: true, options: [{ label: '按笔计费', value: 'per-transaction' }, { label: '按月计费', value: 'monthly' }] },
            { key: 'rate', label: '费率', control: 'number', required: true, min: 0, max: 100, precision: 2 },
            { key: 'effectiveAt', label: '启用日期', control: 'date', required: true },
            { key: 'accountManager', label: '客户经理', control: 'input' },
            { key: 'remark', label: '备注', control: 'textarea', rows: 3 }
          ]
        }
      }, columns: [
        { key: 'configNo', label: '配置编号', width: 120, hideable: false }, { key: 'merchantNo', label: '商户编号', width: 140 }, { key: 'merchantName', label: '商户名称', width: 220 }, { key: 'serviceType', label: '服务类型', width: 140 }, { key: 'serviceStatus', label: '服务状态', width: 120, format: 'status', statusMap }, { key: 'createdAt', label: '创建时间', width: 180 }
      ], rows: [
        { configNo: 'C001', merchantNo: 'M10001', merchantName: '杭州星云商贸有限公司', serviceType: '线上收单', serviceStatus: 'active', createdAt: '2026-07-16 11:35:22' },
        { configNo: 'C002', merchantNo: 'M10002', merchantName: '上海锦程科技有限公司', serviceType: '分账服务', serviceStatus: 'disabled', createdAt: '2026-07-15 16:20:10' }
      ], pagination: { page: 1, pageSize: 20, total: 2 } } } }
    })
  },
  {
    id: '18-transaction-inline-summary',
    title: '行内汇总查询列表',
    spec: base({
      changeId: '20260730-capability-18-transaction-inline-summary', pageName: '交易查询', family: 'list', templateId: 'list.inline-summary', executionMode: 'page-spec-default',
      request: '财务人员查询交易记录，并在结果工具区快速核对交易总金额和交易总笔数。', selectionReason: '主要工作仍是查询记录；仅有两项轻量指标且服务于结果工具区扫描，使用行内汇总查询列表。', refs: [...ruleRefs.list, 'BL-TPL-011'],
      capabilities: ['query.basic', 'summary.inline', 'table.flat', 'table.pagination', 'table.status', 'table.amount'],
      body: { list: { query: { fields: [
        { key: 'tradedAt', label: '交易日期', control: 'date-range' }, { key: 'merchantNo', label: '商户编号', control: 'input' }, { key: 'status', label: '交易状态', control: 'select', options: [{ label: '成功', value: 'success' }, { label: '失败', value: 'failed' }] }
      ] }, summary: { items: [{ key: 'amount', label: '交易总金额', value: '920.00', suffix: ' 元' }, { key: 'count', label: '交易总笔数', value: 240, suffix: ' 笔' }] }, table: { rowKey: 'tradeNo', columns: [
        { key: 'tradeNo', label: '交易流水号', width: 180, hideable: false }, { key: 'merchantNo', label: '商户编号', width: 140 }, { key: 'amount', label: '交易金额', width: 140, format: 'amount', unit: '元' }, { key: 'status', label: '交易状态', width: 120, format: 'status', statusMap: { success: { label: '成功', status: 'success' }, failed: { label: '失败', status: 'error' } } }, { key: 'tradedAt', label: '交易时间', width: 180 }
      ], rows: [
        { tradeNo: 'T001', merchantNo: 'M10001', amount: 320, status: 'success', tradedAt: '2026-07-30 09:20:00' },
        { tradeNo: 'T002', merchantNo: 'M10002', amount: 260, status: 'success', tradedAt: '2026-07-30 10:05:00' },
        { tradeNo: 'T003', merchantNo: 'M10003', amount: 340, status: 'failed', tradedAt: '2026-07-30 11:32:00' }
      ], pagination: { page: 1, pageSize: 20, total: 3 } } } }
    })
  },
  {
    id: '19-operation-dashboard',
    title: '经营概览 Dashboard',
    spec: base({
      changeId: '20260730-capability-19-operation-dashboard', pageName: '经营概览', family: 'dashboard', templateId: 'dashboard.overview', executionMode: 'page-spec-default',
      request: '财务负责人在一个页面中监控当日交易、结算和渠道分布趋势，而不是逐条查询记录。', selectionReason: '主要任务是跨记录监控业务健康度、分布和趋势，使用经营概览 Dashboard。', refs: ruleRefs.dashboard,
      capabilities: ['dashboard.scope', 'dashboard.metrics', 'dashboard.distribution', 'dashboard.trend', 'dashboard.ranking'],
      body: { dashboard: { scope: { statusText: '当前展示所选统计范围的交易与结算数据。', initialValues: { range: 'today', branch: 'all' }, fields: [
        { key: 'range', label: '统计周期', control: 'select', options: [{ label: '今日', value: 'today' }, { label: '近 7 日', value: 'seven-days' }, { label: '近 30 日', value: 'thirty-days' }] },
        { key: 'branch', label: '直营网点', control: 'select', options: [{ label: '全部', value: 'all' }, { label: '华东直营网点', value: 'east' }, { label: '华南直营网点', value: 'south' }] },
        { key: 'businessLine', label: '业务线', control: 'select', options: [{ label: '全部', value: 'all' }, { label: '线上收单', value: 'online' }, { label: '分账服务', value: 'split' }] }
      ] }, metrics: [
        { key: 'tradeAmount', label: '交易总额', value: 2865400, precision: 2, unit: '元' }, { key: 'tradeCount', label: '交易笔数', value: 128, unit: '笔' }, { key: 'settlementAmount', label: '结算总额', value: 2798600, precision: 2, unit: '元' }, { key: 'failedCount', label: '失败笔数', value: 3, unit: '笔' }
      ], charts: [
        { key: 'channelDistribution', title: '交易渠道分布', role: 'distribution', type: 'pie', angleField: 'amount', colorField: 'channel', data: [{ channel: '线上收单', amount: 1520000 }, { channel: '联营渠道', amount: 864000 }, { channel: '直营网点', amount: 480000 }] },
        { key: 'tradeTrend', title: '近 7 日交易趋势', role: 'trend', type: 'line', xField: 'date', yField: 'amount', data: [{ date: '07-24', amount: 320000 }, { date: '07-25', amount: 410000 }, { date: '07-26', amount: 360000 }, { date: '07-27', amount: 420000 }, { date: '07-28', amount: 390000 }, { date: '07-29', amount: 440000 }, { date: '07-30', amount: 520000 }] },
        { key: 'splitTrend', title: '近 7 日分账趋势', role: 'trend', type: 'line', xField: 'date', yField: 'amount', data: [{ date: '07-24', amount: 290000 }, { date: '07-25', amount: 350000 }, { date: '07-26', amount: 320000 }, { date: '07-27', amount: 375000 }, { date: '07-28', amount: 330000 }, { date: '07-29', amount: 385000 }, { date: '07-30', amount: 450000 }] },
        { key: 'incomeRanking', title: '收入来源排行', role: 'ranking', type: 'bar', xField: 'amount', yField: 'source', data: [{ source: '线上收单', amount: 1280000 }, { source: '联营渠道', amount: 760000 }, { source: '直营网点', amount: 520000 }] }
      ] } }
    })
  },
  {
    id: '20-service-scope-component-form',
    title: '服务范围配置与复杂表单控件',
    spec: base({
      changeId: '20260805-capability-20-service-scope-component-form', pageName: '商户服务范围配置', family: 'form', templateId: 'form.grouped-page', executionMode: 'shadow', validatedCombinations: ['form.grouped'],
      request: '商户运营人员按商户归属、服务权限和结算安排配置商户服务范围，完成后保存。', selectionReason: '八项配置字段分属三个需要分别核对的信息组，使用分组全页表单并固定提交操作。', assumptions: ['可选服务和结算渠道为示例数据，保存后仅显示客户端反馈。'], refs: [...ruleRefs.form, 'BL-TPL-007'],
      capabilities: ['form.groups', 'form.stickyActions'],
      body: { form: { presentation: 'page', stickyActions: true, groups: [
        { key: 'merchant', title: '商户归属', fields: [
          { key: 'merchantName', label: '商户名称', control: 'auto-complete', required: true, options: [{ label: '杭州星云商贸有限公司', value: '杭州星云商贸有限公司' }, { label: '上海锦程科技有限公司', value: '上海锦程科技有限公司' }] },
          { key: 'region', label: '经营区域', control: 'cascader', required: true, showSearch: true, options: [{ label: '浙江省', value: 'zhejiang', children: [{ label: '杭州市', value: 'hangzhou', children: [{ label: '西湖区', value: 'xihu' }, { label: '滨江区', value: 'binjiang' }] }] }, { label: '上海市', value: 'shanghai', children: [{ label: '浦东新区', value: 'pudong' }] }] },
          { key: 'daySettlement', label: '日间结算', control: 'switch', default: true, checkedLabel: '开启', uncheckedLabel: '关闭' }
        ] },
        { key: 'service', title: '服务权限', container: 'card', fields: [
          { key: 'categories', label: '可经营类目', control: 'tree-select', required: true, treeCheckable: true, options: [{ label: '零售', value: 'retail', children: [{ label: '商超', value: 'supermarket' }, { label: '便利店', value: 'convenience' }] }, { label: '餐饮', value: 'food', children: [{ label: '正餐', value: 'dining' }, { label: '快餐', value: 'fast-food' }] }] },
          { key: 'services', label: '可用服务', control: 'checkbox', required: true, default: ['online'], options: [{ label: '线上收单', value: 'online' }, { label: '线下收单', value: 'offline' }, { label: '分账服务', value: 'split' }, { label: '结算服务', value: 'settlement' }] },
          { key: 'settlementChannels', label: '可结算渠道', control: 'transfer', required: true, default: ['online'], titles: ['待选择', '已选择'], showSearch: true, options: [{ label: '线上收单', value: 'online' }, { label: '联营渠道', value: 'partner' }, { label: '直营网点', value: 'direct' }, { label: '跨境收款', value: 'cross-border' }] }
        ] },
        { key: 'schedule', title: '结算安排', fields: [
          { key: 'cutoffTime', label: '每日清算截点', control: 'time', required: true, default: '18:00', format: 'HH:mm' },
          { key: 'effectiveAt', label: '生效日期', control: 'date', required: true }
        ] }
      ], submit: { primaryLabel: '保 存', cancelLabel: '取 消', success: { title: '保存成功', message: '商户服务范围配置已保存。' } } } }
    })
  },
  {
    id: '21-split-rule-tag-dropdown',
    title: '分类标签与更多操作查询列表',
    spec: base({
      changeId: '20260805-capability-21-split-rule-tag-dropdown', pageName: '分账规则查询', family: 'list', templateId: 'list.regular', executionMode: 'page-spec-default',
      request: '运营人员查询、核对并维护分账规则；通过分类标签识别分账模式，并将导入、导出和刷新归入更多操作。', selectionReason: '核心任务是筛选并维护记录集合，分类信息服务于表格扫描，使用常规查询列表。', assumptions: ['导入、导出和刷新仅模拟客户端操作，不调用真实服务。'], refs: [...ruleRefs.list, 'BL-INT-010'],
      capabilities: ['query.basic', 'table.flat', 'table.pagination', 'table.status', 'table.amount', 'table.export', 'table.confirmAction', 'table.editAction', 'list.drawerCreate'],
      body: { list: { query: { fields: [
        { key: 'ruleName', label: '规则名称', control: 'input' },
        { key: 'merchantNo', label: '商户编号', control: 'input' },
        { key: 'channel', label: '分账渠道', control: 'select', options: [{ label: '线上收单', value: '线上收单' }, { label: '联营渠道', value: '联营渠道' }, { label: '直营网点', value: '直营网点' }] },
        { key: 'status', label: '规则状态', control: 'select', options: [{ label: '生效中', value: 'active' }, { label: '待生效', value: 'pending' }, { label: '已失效', value: 'disabled' }] }
      ] }, table: { rowKey: 'ruleNo', sectionTitle: '分账规则列表', primaryAction: { key: 'create', label: '新增规则', createRecord: { ruleNo: 'R005', status: 'pending', splitMode: 'standard', pendingAmount: 0, createdAt: '2026-08-05 12:00:00' }, form: { title: '新增分账规则', primaryLabel: '保 存', successMessage: '分账规则已新增。', fields: [
        { key: 'ruleName', label: '规则名称', control: 'input', required: true },
        { key: 'merchantName', label: '商户名称', control: 'input', required: true },
        { key: 'merchantNo', label: '商户编号', control: 'input', required: true },
        { key: 'channel', label: '分账渠道', control: 'select', required: true, options: [{ label: '线上收单', value: '线上收单' }, { label: '联营渠道', value: '联营渠道' }, { label: '直营网点', value: '直营网点' }] },
        { key: 'splitMode', label: '分账模式', control: 'select', required: true, options: [{ label: '系统商户', value: 'system' }, { label: '标准商户', value: 'standard' }, { label: '易宝支付', value: 'yeepay' }, { label: '企业付款', value: 'enterprise' }] }
      ] } }, secondaryActions: [{ key: 'more', label: '更多操作', type: 'dropdown', items: [{ key: 'import', label: '导入规则' }, { key: 'export', label: '导出结果', type: 'export' }, { key: 'refresh', label: '刷新列表' }] }], columns: [
        { key: 'ruleNo', label: '规则编号', width: 110, hideable: false },
        { key: 'ruleName', label: '规则名称', width: 170 },
        { key: 'merchantName', label: '商户名称', width: 190 },
        { key: 'merchantNo', label: '商户编号', width: 140 },
        { key: 'channel', label: '分账渠道', width: 120 },
        { key: 'status', label: '规则状态', width: 100, format: 'status', statusMap },
        { key: 'splitMode', label: '分账模式', width: 120, format: 'tag', tagMap: { system: { label: '系统商户', color: 'orange' }, standard: { label: '标准商户', color: 'blue' }, yeepay: { label: '易宝支付', color: 'cyan' }, enterprise: { label: '企业付款', color: 'purple' } } },
        { key: 'pendingAmount', label: '待分账金额', width: 140, format: 'amount', unit: '元' },
        { key: 'createdAt', label: '创建时间', width: 180 },
        { key: 'actions', label: '操作', width: 150, hideable: false }
      ], rows: [
        { ruleNo: 'R001', ruleName: '连锁门店分润', merchantName: '杭州星云商贸有限公司', merchantNo: 'M10080048989', channel: '线上收单', status: 'active', splitMode: 'system', pendingAmount: 12860.32, createdAt: '2026-08-05 11:35:22' },
        { ruleNo: 'R002', ruleName: '联合运营', merchantName: '上海锦程科技有限公司', merchantNo: 'M10080048990', channel: '联营渠道', status: 'pending', splitMode: 'standard', pendingAmount: 9820, createdAt: '2026-08-04 16:20:10' },
        { ruleNo: 'R003', ruleName: '直营网点分账', merchantName: '北京跃升贸易有限公司', merchantNo: 'M10080048991', channel: '直营网点', status: 'active', splitMode: 'yeepay', pendingAmount: 7610.5, createdAt: '2026-08-03 09:35:22' },
        { ruleNo: 'R004', ruleName: '企业付款结算', merchantName: '深圳迅达服务有限公司', merchantNo: 'M10080048992', channel: '线上收单', status: 'disabled', splitMode: 'enterprise', pendingAmount: 0, createdAt: '2026-08-02 14:10:00' }
      ], pagination: { page: 1, pageSize: 20, total: 4 }, rowActions: [
        { key: 'edit', label: '修改', type: 'edit', form: { title: '修改分账规则', primaryLabel: '保 存', successMessage: '分账规则已更新。', fields: [{ key: 'ruleName', label: '规则名称', control: 'input', required: true }, { key: 'channel', label: '分账渠道', control: 'select', required: true, options: [{ label: '线上收单', value: '线上收单' }, { label: '联营渠道', value: '联营渠道' }, { label: '直营网点', value: '直营网点' }] }] } },
        { key: 'disable', label: '失效', type: 'confirm-state-change', danger: true, visibleWhen: { field: 'status', equals: 'active' }, confirm: { title: '确认使规则失效', description: '确认使当前分账规则失效？', impact: '失效后该规则不再参与后续分账。', reversible: false, successMessage: '分账规则已失效。' }, effect: { field: 'status', value: 'disabled' } }
      ] } } }
    })
  }
];
