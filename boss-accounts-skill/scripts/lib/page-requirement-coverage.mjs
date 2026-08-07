function compact(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s`'"“”‘’：:，,。；;（）()【】\[\]]+/g, '')
    .trim();
}

function sectionRequest(rawRequest) {
  return String(rawRequest || '')
    .replace(/\\[rn]/g, '；')
    .replace(/\r?\n/g, '；')
    .replace(/\s*；+\s*/g, '；')
    .trim();
}

function splitFields(value) {
  return String(value || '')
    .replace(/(开业时间)(?=门店状态)/g, '$1、')
    .replace(/[。；;]+$/g, '')
    .split(/[、，,；;]|和/)
    .map((field) => field.replace(/^(?:按|根据|填写|输入|修改|展示|显示|包括)/, '').trim())
    .filter((field) => field && !/^(?:保存|提交|关闭|确认|并|后)/.test(field))
    .filter((field) => {
      const value = field.replace(/\s+/g, '');
      return !/^共\d+(?:个查询条件|列|个字段|个项)$/.test(value)
        && !/^以上\d+(?:个字段|个项)$/.test(value)
        && !/^(?:以上|上述|前述)(?:字段|信息|内容)?(?:均)?(?:为)?必填$/.test(value);
    });
}

function matchClause(request, expressions) {
  for (const expression of expressions) {
    const match = request.match(expression);
    if (match) return match[1];
  }
  return '';
}

function extractQueryFields(request) {
  return splitFields(matchClause(request, [
    /(?:支持|可以|可)?(?:按|根据)([^。；]+?)(?:查询|筛选)/,
    /(?:查询|筛选)条件(?:包括|为|有|：|:)\s*([^。；]+)/,
    /(?:查询|筛选)字段(?:包括|为|有|：|:)\s*([^。；]+)/
  ]));
}

function extractColumns(request) {
  const clause = matchClause(request, [
    /列表(?:展示|显示|字段|列)(?:包括|为|有|：|:)?([^。；]+)/,
    /(?:列表字段|列字段)(?:包括|为|有|：|:)?([^。；]+)/
  ]);
  return splitFields(clause
    .replace(/(?:、|，|,)?操作[（(][^）)]*[）)]/g, '')
    .replace(/([^、，,；;（）()]+)[（(][^）)]*(?:switch|开关)[^）)]*[）)]/gi, '$1'))
    .filter((label) => !/^操作/.test(label));
}

function extractViews(request) {
  const clause = matchClause(request, [/列表(?:可)?切换(?:为|是|：|:)\s*([^。；]+)/]);
  return splitFields(clause).map((item) => {
    const match = item.match(/^(.+?)[（(](\d+)[）)]$/);
    return { label: (match?.[1] || item).trim(), ...(match ? { count: Number(match[2]) } : {}) };
  });
}

function extractOperations(request) {
  const clause = matchClause(request, [/操作[（(]([^）)]+)[）)]/]);
  const inline = splitFields(clause);
  const explicit = [
    [/查看详情|点击任一[^。；]*详情/, '查看'],
    [/编辑|修改/, '编辑'],
    [/删除/, '删除']
  ].filter(([pattern]) => pattern.test(request)).map(([, label]) => label);
  return [...new Set([...inline, ...explicit])];
}

function extractCreateFields(request) {
  const clauses = [
    /新增[\s\S]*?基础信息[（(]([^）)]+)[）)]/,
    /新增[^。；]*?[（(]([^）)]+)[）)]/,
    /新增[\s\S]*?(?:填写|输入)([^。；]*?)(?=(?:保存|提交|确认|关闭)|[。；]|$)/
  ];
  return splitFields(matchClause(request, clauses));
}

function extractStepFields(request) {
  const fields = [];
  const expression = /第[一二三四五六七八九十\d]+步\s*[：:]\s*([^。；]+)/g;
  for (const match of request.matchAll(expression)) {
    if (/^(?:预览|复核|确认|提交)/.test(match[1].trim())) continue;
    fields.push(...splitFields(match[1]));
  }
  return fields;
}

function labelSet(items) {
  return new Set(items.map(compact).filter(Boolean));
}

function includesLabel(actual, expected) {
  const target = compact(expected);
  return [...actual].some((label) => label === target || label.includes(target) || target.includes(label));
}

function missingLabels(expected, actual) {
  return expected.filter((label) => !includesLabel(actual, label));
}

function fieldsFrom(container) {
  return Array.isArray(container?.fields) ? container.fields.map((field) => field?.label).filter(Boolean) : [];
}

function collectFormFieldLabels(spec) {
  const labels = [];
  const table = spec.list?.table;
  labels.push(...fieldsFrom(table?.primaryAction?.form));
  for (const action of table?.rowActions || []) labels.push(...fieldsFrom(action.form));
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (Array.isArray(node.fields)) labels.push(...node.fields.map((field) => field?.label).filter(Boolean));
    Object.values(node).forEach(visit);
  };
  visit(spec.form);
  return labels;
}

function collectCreateFieldLabels(spec) {
  const list = spec.list || spec.form?.sourceList;
  const primary = fieldsFrom(list?.table?.primaryAction?.form);
  if (primary.length) return primary;
  const labels = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (Array.isArray(node.fields)) labels.push(...node.fields.map((field) => field?.label).filter(Boolean));
    Object.values(node).forEach(visit);
  };
  visit(spec.form);
  return labels;
}

function createIsPresent(spec) {
  const list = spec.list || spec.form?.sourceList;
  return Boolean(list?.table?.primaryAction || spec.form);
}

function findMenuItem(items, key) {
  for (const item of items || []) {
    if (item?.key === key) return item;
    const matched = findMenuItem(item?.children, key);
    if (matched) return matched;
  }
  return null;
}

function shellPrimaryLabel(shell = {}) {
  if (typeof shell.primaryNav === 'string') return shell.primaryNav;
  if (!Array.isArray(shell.primaryNav)) return '';
  return shell.primaryNav.find((item) => item?.key === shell.activePrimaryKey)?.label || '';
}

function shellSideLabel(shell = {}) {
  if (typeof shell.sideNav === 'string') return shell.sideNav;
  const menus = shell.sideMenusByPrimary?.[shell.activePrimaryKey] || [];
  return findMenuItem(menus, shell.selectedMenuKey)?.label || '';
}

// Keep requirement extraction shared by recipe compilers and coverage checks.
export function parseListRequirement(rawRequest) {
  const request = sectionRequest(rawRequest);
  return {
    request,
    queryFields: extractQueryFields(request),
    columns: extractColumns(request),
    views: extractViews(request),
    operations: extractOperations(request),
    createFields: extractCreateFields(request),
    stepFields: extractStepFields(request),
    primaryNav: request.match(/一级菜单(?:为|是|：|:)\s*([^，,。；]+)/)?.[1]?.trim(),
    sideNav: request.match(/二级菜单(?:为|是|：|:)\s*([^，,。；]+)/)?.[1]?.trim()
  };
}

export function analyzeRequirementCoverage(spec, options = {}) {
  const requirement = parseListRequirement(options.request || spec?.metadata?.request);
  const { request } = requirement;
  const errors = [];
  if (!request) {
    return { errors: ['metadata.request 缺失，无法执行需求覆盖校验。'], coverage: null };
  }

  const { queryFields, columns, views, operations, createFields, stepFields, primaryNav, sideNav } = requirement;

  const actualList = spec.list || spec.form?.sourceList;
  const actualQuery = labelSet((actualList?.query?.fields || []).map((field) => field.label));
  const actualColumns = labelSet((actualList?.table?.columns || []).filter((column) => column.key !== 'actions').map((column) => column.label));
  const actualViews = labelSet((actualList?.table?.views || []).map((view) => view.label));
  const actualActions = labelSet([
    ...(actualList?.table?.rowActions || []).map((action) => action.label),
    ...(actualList?.table?.drawerDetail ? ['查看'] : [])
  ]);
  const actualForms = labelSet(collectFormFieldLabels(spec));
  const actualCreateForms = labelSet(collectCreateFieldLabels(spec));

  const missingQuery = missingLabels(queryFields, actualQuery);
  const missingColumns = missingLabels(columns, actualColumns);
  const missingViews = missingLabels(views.map((view) => view.label), actualViews);
  const missingOperations = missingLabels(operations, actualActions);
  const missingCreateFields = missingLabels(createFields, actualCreateForms);
  const missingStepFields = missingLabels(stepFields, actualForms);

  if (primaryNav && compact(shellPrimaryLabel(spec.shell)) !== compact(primaryNav)) errors.push(`一级菜单未覆盖：${primaryNav}`);
  if (sideNav && compact(shellSideLabel(spec.shell)) !== compact(sideNav)) errors.push(`二级菜单未覆盖：${sideNav}`);
  if (missingQuery.length) errors.push(`查询条件未覆盖：${missingQuery.join('、')}`);
  if (missingColumns.length) errors.push(`列表字段未覆盖：${missingColumns.join('、')}`);
  if (missingViews.length) errors.push(`列表切换未覆盖：${missingViews.join('、')}`);
  if (missingOperations.length) errors.push(`列表操作未覆盖：${missingOperations.join('、')}`);
  if (missingCreateFields.length) errors.push(`新增字段未覆盖：${missingCreateFields.join('、')}`);
  if (missingStepFields.length) errors.push(`步骤字段未覆盖：${missingStepFields.join('、')}`);

  const createRequested = createFields.length > 0 || /新增(?:账户|门店|规则|记录|按钮|操作|页面|表单)/.test(request);
  if (createRequested && !createIsPresent(spec)) errors.push('新增入口未覆盖。');
  if (columns.length && !/空状态|无数据|暂无数据/.test(request) && !(actualList?.table?.rows || []).length) {
    errors.push('列表缺少可供人工验收的示例数据。');
  }
  for (const expected of views) {
    if (expected.count === undefined) continue;
    const actual = (actualList?.table?.views || []).find((view) => compact(view.label) === compact(expected.label));
    if (actual && Number(actual.count) !== expected.count) errors.push(`列表切换数量不一致：${expected.label} 应为 ${expected.count}。`);
  }

  return {
    errors,
    coverage: {
      queryFields: queryFields.length,
      columns: columns.length,
      views: views.length,
      operations: operations.length,
      createFields: createFields.length,
      stepFields: stepFields.length
    }
  };
}
