(function installBossLedgerPageSpecRuntime(global) {
  const React = global.React;
  const ReactDOM = global.ReactDOM;
  const antd = global.antd;
  const icons = global.icons || global.antdIcons || global.AntDesignIcons || {};
  const Charts = global.Charts || {};
  const h = React.createElement;
  const theme = global.BossLedgerTheme;
  if (!theme?.antTokens) throw new Error('Boss Ledger generated theme is missing. Rebuild Director artifacts before rendering.');

  const {
    App: AntApp,
    Alert,
    AutoComplete,
    Badge,
    Button,
    Card,
    Cascader,
    Checkbox,
    ConfigProvider,
    DatePicker,
    Descriptions,
    Divider,
    Dropdown,
    Drawer,
    Empty,
    Form,
    Input,
    InputNumber,
    Modal,
    Pagination,
    Popover,
    Radio,
    Result,
    Select,
    Space,
    Spin,
    Statistic,
    Steps,
    Switch,
    Table,
    Tabs,
    Tag,
    TimePicker,
    Tooltip,
    Transfer,
    TreeSelect,
    Upload,
    message
  } = antd;

  const {
    DownOutlined,
    CloseOutlined,
    ReloadOutlined,
    SettingOutlined,
    UploadOutlined,
    UpOutlined
  } = icons;

  function selectedMenuGroupKey(items, selectedKey) {
    for (const item of items || []) {
      if ((item.children || []).some((child) => child.key === selectedKey || selectedMenuGroupKey([child], selectedKey))) return item.key;
    }
    return null;
  }

  function defaultShellConfig(spec) {
    const pageName = spec.metadata.pageName;
    const pageKey = 'page-spec-current';
    const shell = spec.shell || {};
    const primaryKey = shell.activePrimaryKey || 'workspace';
    const defaultPrimaryNav = [
      { key: 'home', label: '首页', route: '/home' },
      { key: 'merchant', label: '商户管理', route: '/merchant' },
      { key: 'workspace', label: '业务管理', route: '/workspace' },
      { key: 'system', label: '系统管理', route: '/system' }
    ];
    const primaryNav = Array.isArray(shell.primaryNav)
      ? shell.primaryNav
      : typeof shell.primaryNav === 'string' && shell.primaryNav.trim()
        ? [{ key: primaryKey, label: shell.primaryNav.trim(), route: `/${primaryKey}` }]
        : defaultPrimaryNav;
    const sideMenusByPrimary = shell.sideMenusByPrimary || {
      home: [{ key: 'home-group', label: '首页', icon: 'HomeOutlined', children: [{ key: 'dashboard', label: '经营概览', route: '/home/dashboard' }] }],
      merchant: [{ key: 'merchant-group', label: '商户管理', icon: 'TeamOutlined', children: [{ key: pageKey, label: pageName, route: `/merchant/${pageKey}`, closable: false }] }],
      workspace: [{ key: 'business-group', label: '业务管理', icon: 'AppstoreOutlined', children: [{ key: pageKey, label: pageName, route: `/workspace/${pageKey}`, closable: false }] }],
      system: [{ key: 'system-group', label: '系统管理', icon: 'SettingOutlined', children: [{ key: pageKey, label: pageName, route: `/system/${pageKey}`, closable: false }] }]
    };
    const selectedMenuKey = shell.selectedMenuKey || pageKey;
    const inferredOpenMenuKey = selectedMenuGroupKey(sideMenusByPrimary[primaryKey], selectedMenuKey);
    return {
      topbar: shell.topbar || {
        left: '上次登录时间：2026-07-28 09:18:32　登录 IP：10.24.18.66',
        right: 'Boss Ledger　帮助中心　消息'
      },
      logoSrc: './assets/boss-logo.svg',
      primaryNav,
      sideMenusByPrimary,
      tabs: shell.tabs || [{ key: pageKey, label: pageName, route: `/${primaryKey}/${pageKey}`, closable: false }],
      activePrimaryKey: primaryKey,
      selectedMenuKey,
      openMenuKeys: shell.openMenuKeys || (inferredOpenMenuKey ? [inferredOpenMenuKey] : [`${primaryKey === 'workspace' ? 'business' : primaryKey}-group`]),
      activeTabKey: shell.activeTabKey || pageKey,
      footerText: shell.footerText
    };
  }

  function normalizeOptions(options) {
    return (options || []).map((option) => ({
      label: option.label,
      value: option.value,
      ...(Array.isArray(option.children) && option.children.length ? { children: normalizeOptions(option.children) } : {})
    }));
  }

  function transferOptions(options) {
    return (options || []).flatMap((option) => [
      { key: String(option.value), title: option.label, disabled: Boolean(option.disabled) },
      ...transferOptions(option.children)
    ]);
  }

  const DEFAULT_QUERY_DATE_PRESETS = ['今日', '近 7 日', '近 30 日'];

  function queryDatePresets(field) {
    const presets = Array.isArray(field?.presets) && field.presets.length ? field.presets : DEFAULT_QUERY_DATE_PRESETS;
    return presets.map((preset) => typeof preset === 'string' ? { key: preset, label: preset } : preset).filter((preset) => preset?.label);
  }

  function queryDateRangeForPreset(preset) {
    if (typeof global.dayjs !== 'function') return undefined;
    const today = global.dayjs();
    const label = typeof preset === 'string' ? preset : preset?.label;
    if (label === '昨日') {
      const yesterday = today.subtract(1, 'day');
      return [yesterday.startOf('day'), yesterday.endOf('day')];
    }
    if (label === '近 3 日') return [today.subtract(2, 'day').startOf('day'), today.endOf('day')];
    if (label === '近 7 日') return [today.subtract(6, 'day').startOf('day'), today.endOf('day')];
    if (label === '近 30 日') return [today.subtract(29, 'day').startOf('day'), today.endOf('day')];
    return [today.startOf('day'), today.endOf('day')];
  }

  function firstQueryDateRangeField(query) {
    return (query?.fields || []).find((field) => field.control === 'date-range');
  }

  function usesQueryDatePresets(query, field) {
    const firstDateRange = firstQueryDateRangeField(query);
    return firstDateRange?.key === field?.key && field?.showPresets !== false;
  }

  function queryInitialValues(query) {
    const values = { ...(query?.initialValues || {}) };
    const firstDateRange = firstQueryDateRangeField(query);
    if (firstDateRange && usesQueryDatePresets(query, firstDateRange) && values[firstDateRange.key] === undefined) {
      values[firstDateRange.key] = queryDateRangeForPreset(firstDateRange.defaultPreset || queryDatePresets(firstDateRange)[0]);
    }
    return values;
  }

  function isSameQueryDateRange(value, expected) {
    if (!Array.isArray(value) || !Array.isArray(expected) || value.length !== 2 || expected.length !== 2) return false;
    return value[0]?.isSame?.(expected[0], 'day') && value[1]?.isSame?.(expected[1], 'day');
  }

  function QueryDateRangeControl({ field, form }) {
    const value = Form.useWatch(field.key, form);
    const presets = queryDatePresets(field);
    return h('div', { className: 'boss-query-date-range-control' },
      h(Form.Item, { name: field.key, noStyle: true }, h(DatePicker.RangePicker, {
        className: 'boss-query-date-range-picker',
        placeholder: ['开始日期', '结束日期']
      })),
      h('div', { className: 'boss-query-date-presets', 'aria-label': `${field.label}快捷选择` }, ...presets.map((preset) => {
        const range = queryDateRangeForPreset(preset);
        const selected = isSameQueryDateRange(value, range);
        return h(Button, {
          key: preset.key || preset.label,
          type: 'text',
          className: `boss-query-date-preset${selected ? ' is-selected' : ''}`,
          onClick: () => form.setFieldsValue({ [field.key]: range })
        }, preset.label);
      })));
  }

  function queryItem(field, form, showDatePresets) {
    const className = `boss-query-field${showDatePresets ? ' boss-query-date-range-field' : ''}`;
    const data = {
      key: field.key,
      className,
      'data-boss-query-row': 'field',
      'data-boss-query-key': field.key,
      'data-boss-query-control': field.control
    };
    if (showDatePresets) {
      return h('div', data, h(Form.Item, { label: field.label }, h(QueryDateRangeControl, { field, form })));
    }
    return h('div', data, h(Form.Item, { name: field.key, label: field.label }, controlForField(field)));
  }

  function queryRowTops(container) {
    if (!container) return [];
    return [...new Set([...container.querySelectorAll('[data-boss-query-row]')].map((node) => node.offsetTop))].sort((left, right) => left - right);
  }

  function queryFieldKeysWithinRows(container, rowTops, limit) {
    if (!container || !rowTops.length) return [];
    const maximumTop = rowTops[Math.min(limit - 1, rowTops.length - 1)];
    return [...container.querySelectorAll('[data-boss-query-row="field"]')]
      .filter((node) => node.offsetTop <= maximumTop)
      .map((node) => node.dataset.bossQueryKey)
      .filter(Boolean);
  }

  function controlForField(field) {
    const common = { placeholder: field.placeholder || (['select', 'auto-complete', 'cascader', 'tree-select', 'radio'].includes(field.control) ? `请选择${field.label}` : `请输入${field.label}`) };
    if (field.control === 'select') return h(Select, { ...common, allowClear: true, options: normalizeOptions(field.options) });
    if (field.control === 'auto-complete') return h(AutoComplete, { ...common, allowClear: true, options: normalizeOptions(field.options) });
    if (field.control === 'cascader') return h(Cascader, { ...common, style: { width: '100%' }, allowClear: true, options: normalizeOptions(field.options), multiple: Boolean(field.multiple), showSearch: field.showSearch !== false });
    if (field.control === 'tree-select') return h(TreeSelect, { ...common, style: { width: '100%' }, allowClear: true, treeData: normalizeOptions(field.options), treeCheckable: Boolean(field.treeCheckable), multiple: Boolean(field.multiple || field.treeCheckable), showSearch: field.showSearch !== false });
    if (field.control === 'date') return h(DatePicker, { style: { width: '100%' }, placeholder: field.placeholder || `请选择${field.label}` });
    if (field.control === 'date-range') return h(DatePicker.RangePicker, { style: { width: '100%' }, placeholder: ['开始日期', '结束日期'] });
    if (field.control === 'time') return h(TimePicker, { style: { width: '100%' }, placeholder: field.placeholder || `请选择${field.label}`, format: field.format });
    if (field.control === 'number') return h(InputNumber, { ...common, style: { width: '100%' }, min: field.min, max: field.max, precision: field.precision });
    if (field.control === 'textarea') return h(Input.TextArea, { ...common, rows: field.rows || 4, maxLength: field.maxLength, showCount: Boolean(field.maxLength) });
    if (field.control === 'radio') return h(Radio.Group, { options: normalizeOptions(field.options) });
    if (field.control === 'checkbox') {
      if (Array.isArray(field.options) && field.options.length) return h(Checkbox.Group, { options: normalizeOptions(field.options) });
      return h(Checkbox, null, field.checkedLabel || '是');
    }
    if (field.control === 'transfer') return h(Transfer, {
      dataSource: transferOptions(field.options),
      titles: field.titles || ['待选', '已选'],
      showSearch: Boolean(field.showSearch),
      oneWay: Boolean(field.oneWay),
      pagination: Boolean(field.pagination),
      render: (item) => item.title
    });
    if (field.control === 'switch') return h(Switch, { checkedChildren: field.checkedLabel || '是', unCheckedChildren: field.uncheckedLabel || '否' });
    if (field.control === 'upload') return h(Upload, {
      accept: field.accept || '.xlsx',
      maxCount: field.maxCount || 1,
      beforeUpload: () => false,
      showUploadList: true
    }, h(Button, { icon: h(UploadOutlined) }, field.uploadLabel || '选择文件'));
    return h(Input, { ...common, maxLength: field.maxLength });
  }

  function formRules(field) {
    const rules = [];
    if (field.required) rules.push({ required: true, message: field.requiredMessage || `请填写${field.label}` });
    if (field.pattern) rules.push({ pattern: new RegExp(field.pattern), message: field.patternMessage || `${field.label}格式不正确` });
    if (field.minLength) rules.push({ min: field.minLength, message: `${field.label}至少${field.minLength}个字符` });
    if (field.maxLength) rules.push({ max: field.maxLength, message: `${field.label}最多${field.maxLength}个字符` });
    return rules;
  }

  function resolveFormLayout(formSpec, fields) {
    const presentation = formSpec?.presentation || 'page';
    const fieldCount = Array.isArray(fields) ? fields.length : 0;
    const isDrawer = presentation === 'drawer';
    const useSideLabel = !isDrawer && fieldCount <= 6;
    const useSingleColumn = isDrawer ? fieldCount <= 8 : useSideLabel;
    return {
      layout: useSideLabel ? 'horizontal' : 'vertical',
      labelCol: useSideLabel ? { flex: '136px' } : undefined,
      className: useSideLabel ? 'boss-horizontal-form' : 'boss-vertical-form',
      fieldsClassName: useSingleColumn ? 'boss-form-stack' : ''
    };
  }

  function initialValueForField(field, sourceValue = field.default) {
    const value = sourceValue;
    if (!['date', 'date-range', 'time'].includes(field.control) || typeof global.dayjs !== 'function') return value;
    const normalize = (candidate) => {
      if (candidate === undefined || candidate === null || typeof candidate?.isValid === 'function') return candidate;
      if (field.control === 'time' && typeof candidate === 'string' && /^\d{2}:\d{2}(?::\d{2})?$/.test(candidate)) {
        return global.dayjs(`1970-01-01T${candidate.length === 5 ? `${candidate}:00` : candidate}`);
      }
      return global.dayjs(candidate);
    };
    return field.control === 'date-range' && Array.isArray(value) ? value.map(normalize) : normalize(value);
  }

  function ResultSummary({ summary }) {
    const items = summary?.items || [];
    if (!items.length) return null;
    return h('div', { className: 'boss-result-summary-panel' }, ...items.map((item) => h('div', { key: item.key, className: 'boss-result-summary-item' },
      h('span', { className: 'boss-result-summary-label' }, item.label),
      h('span', { className: 'boss-result-summary-value' }, `${item.value}${item.unit || ''}`))));
  }

  function BusinessGuide({ guide }) {
    return h('aside', { className: 'boss-form-side-guide' },
      React.createElement('img', { className: 'boss-form-side-guide-image', src: './assets/guided-form-default.png', alt: '老板管账业务引导插图' }),
      h('div', { className: 'boss-form-side-guide-title' }, guide.title),
      h('div', { className: 'boss-form-side-guide-text' }, guide.text));
  }

  function ResultFeedback({ feedback }) {
    const [selected, setSelected] = React.useState(null);
    const defaults = [
      { key: 'very-dissatisfied', label: '非常不满意', icon: 'FrownOutlined' },
      { key: 'dissatisfied', label: '不满意', icon: 'FrownOutlined' },
      { key: 'neutral', label: '一般', icon: 'MehOutlined' },
      { key: 'satisfied', label: '满意', icon: 'SmileOutlined' },
      { key: 'very-satisfied', label: '非常满意', icon: 'SmileOutlined' }
    ];
    const options = feedback?.options?.length ? feedback.options : defaults;
    return h('div', { className: 'boss-result-feedback' },
      h('div', { className: 'boss-result-feedback-question' }, feedback.question || '本次操作体验感觉如何？'),
      h('div', { className: 'boss-result-feedback-options', role: 'group', 'aria-label': feedback.question || '结果体验反馈' }, ...options.map((option, index) => {
        const Icon = icons[option.icon || defaults[index % defaults.length].icon] || icons.InfoCircleOutlined;
        return h(Button, {
          key: option.key || option.value || option.label,
          type: 'text',
          className: `boss-result-feedback-option${selected === (option.key || option.value || option.label) ? ' is-selected' : ''}`,
          'aria-pressed': selected === (option.key || option.value || option.label),
          onClick: () => { setSelected(option.key || option.value || option.label); message.success('感谢您的反馈'); }
        }, Icon ? h(Icon) : null, h('span', null, option.label));
      })));
  }

  function renderWorkflowResult({ status = 'success', title, description, actions, summary, feedback }) {
    const resultActions = (actions || []).filter(Boolean);
    return h(Result, {
      className: 'boss-workflow-result',
      status,
      title,
      subTitle: description,
      extra: h('div', { className: 'boss-result-extra' },
        h(ResultSummary, { summary }),
        resultActions.length ? h(Space, { className: 'boss-result-actions', wrap: true }, ...resultActions.map((action, index) => h(Button, {
          key: action.key || action.label,
          type: index === 0 ? 'primary' : 'default',
          onClick: action.onClick
        }, action.label))) : null,
        feedback ? h(ResultFeedback, { feedback }) : null)
    });
  }

  function renderFormSuccessResult(success, onPrimary, onSecondary) {
    return renderWorkflowResult({
      status: 'success',
      title: success.title || '提交成功',
      description: success.message,
      summary: success.summary,
      feedback: success.feedback,
      actions: [
        { key: 'primary', label: success.actionLabel || '返回填写', onClick: onPrimary },
        success.secondaryAction ? { key: 'secondary', label: success.secondaryAction.label, onClick: onSecondary } : null
      ]
    });
  }

  function formItem(field, options) {
    return h('div', { key: field.key, className: field.span === 2 ? 'boss-form-span-2' : '' },
      h(Form.Item, {
        name: field.key,
        label: field.label,
        rules: formRules(field),
        valuePropName: field.control === 'switch' || (field.control === 'checkbox' && !field.options?.length) ? 'checked' : field.control === 'upload' ? 'fileList' : field.control === 'transfer' ? 'targetKeys' : 'value',
        getValueFromEvent: field.control === 'upload' ? (event) => Array.isArray(event) ? event : event?.fileList : field.control === 'transfer' ? (targetKeys) => targetKeys : undefined,
        extra: field.help
      }, controlForField(field)));
  }

  function matchesQuery(row, field, value) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return true;
    const source = row[field.filterKey || field.key];
    if (field.control === 'date-range') {
      const sourceTime = Date.parse(source);
      if (Number.isNaN(sourceTime)) return false;
      const [start, end] = Array.isArray(value) ? value : [];
      const startTime = start?.startOf ? start.startOf('day').valueOf() : start ? Date.parse(start) : null;
      const endTime = end?.endOf ? end.endOf('day').valueOf() : end ? Date.parse(end) : null;
      if (startTime !== null && !Number.isNaN(startTime) && sourceTime < startTime) return false;
      if (endTime !== null && !Number.isNaN(endTime) && sourceTime > endTime) return false;
      return true;
    }
    if (['select', 'radio', 'switch', 'tree-select'].includes(field.control)) {
      const sourceValues = Array.isArray(source) ? source : [source];
      return sourceValues.includes(value);
    }
    if (['checkbox', 'cascader'].includes(field.control)) {
      const selectedValues = Array.isArray(value) ? value.flat(Infinity) : [value];
      const sourceValues = Array.isArray(source) ? source.flat(Infinity) : [source];
      return selectedValues.some((selected) => sourceValues.includes(selected));
    }
    return String(source ?? '').toLowerCase().includes(String(value).toLowerCase());
  }

  function formatAmount(value, column) {
    const number = Number(value || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: column.precision ?? 2,
      maximumFractionDigits: column.precision ?? 2
    });
    return `${number}${column.unit ? ` ${column.unit}` : ''}`;
  }

  function boundDetailValue(field, row) {
    const value = row?.[field.source];
    if (field.format === 'status') {
      const status = resolveStatusDisplay(value, field.statusMap);
      return h(Badge, { status: status.status || 'default', text: status.label });
    }
    if (field.format === 'tag') {
      const tag = field.tagMap?.[value] || { label: String(value ?? '-') };
      return h(Tag, { color: tag.color }, tag.label);
    }
    if (field.format === 'amount') return formatAmount(value, field);
    return String(value ?? '-');
  }

  function WorkflowDrawer({ open, workflow, initialValues, onClose, onSave }) {
    const [drawerForm] = Form.useForm();
    const drawerLayout = resolveFormLayout({ presentation: 'drawer' }, workflow?.fields || []);
    React.useEffect(() => {
      if (open) {
        const normalizedValues = Object.fromEntries((workflow?.fields || [])
          .filter((field) => Object.hasOwn(initialValues || {}, field.key))
          .map((field) => [field.key, initialValueForField(field, initialValues[field.key])]));
        drawerForm.setFieldsValue(normalizedValues);
      }
    }, [drawerForm, initialValues, open]);
    const submit = async () => {
      const values = await drawerForm.validateFields();
      onSave(values);
      drawerForm.resetFields();
    };
    return h(Drawer, {
      open,
      title: workflow?.title,
      width: workflow?.width || 640,
      rootClassName: 'boss-drawer-form',
      closeIcon: false,
      onClose,
      extra: React.createElement(Button, { type: 'text', icon: h(CloseOutlined), 'aria-label': '关闭表单', onClick: onClose }),
      footer: h('div', { className: 'boss-drawer-footer-actions' },
        h(Button, { onClick: onClose }, workflow?.cancelLabel || '取 消'),
        h(Button, { type: 'primary', onClick: submit }, workflow?.primaryLabel || '保 存'))
    }, h(Form, { form: drawerForm, layout: drawerLayout.layout, labelCol: drawerLayout.labelCol, className: drawerLayout.className, 'data-boss-form-layout': drawerLayout.layout }, h('div', { className: `boss-drawer-form-fields boss-form-grid ${drawerLayout.fieldsClassName}` }, ...(workflow?.fields || []).map((field) => formItem(field)))));
  }

  function resolveStatusDisplay(value, statusMap) {
    const mapped = statusMap?.[value];
    if (typeof mapped === 'string') return { label: String(value ?? '-'), status: mapped };
    return {
      label: typeof mapped?.label === 'string' && mapped.label.trim() ? mapped.label : String(value ?? '-'),
      status: mapped?.status || 'default'
    };
  }

  function dataColumns(columns) {
    return (columns || []).map((column) => {
      const resolved = { key: column.key, dataIndex: column.key, title: column.label, width: column.width, ellipsis: column.ellipsis !== false };
      if (column.format === 'amount') {
        resolved.align = 'right';
        resolved.render = (value) => formatAmount(value, column);
      }
      if (column.format === 'status') {
        resolved.render = (value) => {
          const status = resolveStatusDisplay(value, column.statusMap);
          return h(Badge, { status: status.status || 'default', text: status.label });
        };
      }
      if (column.format === 'tag') {
        resolved.render = (value) => {
          const tag = column.tagMap?.[value] || { label: String(value ?? '-') };
          return h(Tag, { color: tag.color }, tag.label);
        };
      }
      return resolved;
    });
  }

  function ListPage({ spec, onStartWorkflow, createdRecord }) {
    const list = spec.list;
    const tableSpec = list.table;
    const queryFields = list.query.fields || [];
    const firstDateRangeField = firstQueryDateRangeField(list.query);
    const datePresetFieldKey = usesQueryDatePresets(list.query, firstDateRangeField)
      ? firstDateRangeField.key
      : null;
    const queryInitial = React.useMemo(() => queryInitialValues(list.query), [list.query]);
    const hasSecondaryQueryFields = queryFields.some((field) => field.advanced);
    const [form] = Form.useForm();
    const [applied, setApplied] = React.useState({});
    const [rows, setRows] = React.useState(() => tableSpec.rows);
    const createdRecordRef = React.useRef(null);
    const [loading, setLoading] = React.useState(false);
    const [failed, setFailed] = React.useState(false);
    const [queryCollapsed, setQueryCollapsed] = React.useState(false);
    const [queryHasOverflow, setQueryHasOverflow] = React.useState(false);
    const [queryLayoutReady, setQueryLayoutReady] = React.useState(false);
    const [collapsedQueryKeys, setCollapsedQueryKeys] = React.useState(() => queryFields.map((field) => field.key));
    const queryLayoutRef = React.useRef(null);
    const queryInitialLayoutRef = React.useRef(true);
    const [page, setPage] = React.useState(tableSpec.pagination.page || 1);
    const [detailRow, setDetailRow] = React.useState(null);
    const [workflow, setWorkflow] = React.useState(null);
    const [selectedKeys, setSelectedKeys] = React.useState([]);
    const [draggingKey, setDraggingKey] = React.useState(null);
    const initialColumnKeys = tableSpec.columns.map((column) => column.key);
    const optionalColumns = tableSpec.columns.filter((column) => column.key !== 'actions' && column.hideable !== false);
    const [visibleKeys, setVisibleKeys] = React.useState(() => tableSpec.columns.filter((column) => column.hidden !== true).map((column) => column.key));
    const [columnOrder, setColumnOrder] = React.useState(initialColumnKeys);

    React.useEffect(() => {
      if (!createdRecord || createdRecordRef.current === createdRecord) return;
      createdRecordRef.current = createdRecord;
      setRows((current) => [createdRecord, ...current]);
      setPage(1);
    }, [createdRecord, tableSpec.rowKey]);

    const visibleQueryFields = queryLayoutReady && queryHasOverflow && queryCollapsed
      ? queryFields.filter((field) => collapsedQueryKeys.includes(field.key))
      : queryFields;
    const filteredRows = React.useMemo(() => rows.filter((row) => queryFields.every((field) => matchesQuery(row, field, applied[field.key]))), [applied, queryFields, rows]);
    const pageSize = tableSpec.pagination.pageSize;
    const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

    const runQuery = (values) => {
      setLoading(true);
      setFailed(false);
      setPage(1);
      global.setTimeout(() => {
        const trigger = spec.states?.error?.trigger;
        setFailed(Boolean(trigger && values[trigger.field] === trigger.value));
        setApplied(values);
        setLoading(false);
      }, spec.states?.loading?.delayMs || 220);
    };
    const reset = () => {
      form.resetFields();
      setApplied({});
      setFailed(false);
      setPage(1);
      setSelectedKeys([]);
    };

    React.useLayoutEffect(() => {
      if (queryLayoutReady) return undefined;
      const defer = global.requestAnimationFrame || ((callback) => global.setTimeout(callback, 0));
      const cancelDeferred = global.cancelAnimationFrame || global.clearTimeout;
      const frame = defer(() => {
        const container = queryLayoutRef.current;
        const rowTops = queryRowTops(container);
        const hasOverflow = rowTops.length > 2;
        const isInitialLayout = queryInitialLayoutRef.current;
        const primaryKeys = queryFields.filter((field) => !field.advanced).map((field) => field.key);
        const twoLineKeys = queryFieldKeysWithinRows(container, rowTops, 2);
        const fallbackKeys = primaryKeys.length ? primaryKeys : twoLineKeys;
        setQueryHasOverflow(hasOverflow);
        setCollapsedQueryKeys((current) => {
          const currentKeys = current.filter((key) => queryFields.some((field) => field.key === key));
          return isInitialLayout || !currentKeys.length ? fallbackKeys : currentKeys;
        });
        setQueryCollapsed((current) => {
          if (!hasOverflow) return false;
          if (isInitialLayout && hasSecondaryQueryFields && list.query.defaultExpanded !== true) return true;
          return current;
        });
        queryInitialLayoutRef.current = false;
        setQueryLayoutReady(true);
      });
      return () => cancelDeferred(frame);
    }, [hasSecondaryQueryFields, list.query.defaultExpanded, queryFields, queryLayoutReady]);

    React.useEffect(() => {
      const container = queryLayoutRef.current;
      if (!container) return undefined;
      let width = container.clientWidth;
      const remeasure = () => {
        queryInitialLayoutRef.current = false;
        setQueryLayoutReady(false);
      };
      if (typeof global.ResizeObserver === 'function') {
        const observer = new global.ResizeObserver((entries) => {
          const nextWidth = Math.round(entries[0]?.contentRect?.width || container.clientWidth);
          if (Math.abs(nextWidth - width) < 1) return;
          width = nextWidth;
          remeasure();
        });
        observer.observe(container);
        return () => observer.disconnect();
      }
      global.addEventListener?.('resize', remeasure);
      return () => global.removeEventListener?.('resize', remeasure);
    }, []);

    React.useLayoutEffect(() => {
      if (!queryLayoutReady || !queryHasOverflow || !queryCollapsed) return;
      const container = queryLayoutRef.current;
      if (queryRowTops(container).length <= 2) return;
      const candidate = [...(container?.querySelectorAll('[data-boss-query-row="field"]') || [])]
        .reverse()
        .find((node) => node.dataset.bossQueryControl !== 'date-range');
      const key = candidate?.dataset.bossQueryKey;
      if (!key) return;
      setCollapsedQueryKeys((current) => current.length > 1 ? current.filter((fieldKey) => fieldKey !== key) : current);
    }, [collapsedQueryKeys, queryCollapsed, queryHasOverflow, queryLayoutReady]);

    const toggleQuery = () => {
      if (!queryCollapsed) {
        const primaryKeys = queryFields.filter((field) => !field.advanced).map((field) => field.key);
        if (primaryKeys.length) setCollapsedQueryKeys(primaryKeys);
      }
      setQueryCollapsed((current) => !current);
    };
    const updateRows = (keys, effect) => setRows((current) => current.map((row) => keys.includes(row[tableSpec.rowKey]) ? { ...row, [effect.field]: effect.value } : row));
    const removeRows = (keys) => setRows((current) => current.filter((row) => !keys.includes(row[tableSpec.rowKey])));
    const confirmAction = (action, affectedRows, onOk) => {
      const confirm = action.confirm;
      if (!confirm) return onOk();
      Modal.confirm({
        className: 'boss-confirm-modal',
        centered: true,
        title: confirm.title,
        content: h('div', { className: 'boss-confirm-content' },
          h('div', null, confirm.description),
          h('div', { className: 'boss-confirm-impact' }, confirm.impact),
          affectedRows?.length ? h('div', { className: 'boss-confirm-impact' }, `已选择 ${affectedRows.length} 条记录`) : null,
          confirm.reversible === false ? h('div', { className: 'boss-confirm-risk' }, '此操作不可撤销') : null),
        width: 416,
        okText: '确 定',
        cancelText: '取 消',
        okButtonProps: { className: 'boss-confirm-button' },
        onOk
      });
    };
    const exportRows = () => {
      const exportColumns = tableSpec.columns.filter((column) => column.key !== 'actions');
      const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [exportColumns.map((column) => escape(column.label)), ...filteredRows.map((row) => exportColumns.map((column) => escape(row[column.key])))]
        .map((line) => line.join(',')).join('\n');
      const link = global.document.createElement('a');
      link.href = global.URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' }));
      link.download = `${spec.metadata.pageName}.csv`;
      link.click();
      global.URL.revokeObjectURL(link.href);
      message.success('导出文件已生成');
    };
    const reorderColumn = (sourceKey, targetKey) => {
      if (!sourceKey || sourceKey === targetKey) return;
      setColumnOrder((current) => {
        const next = current.filter((key) => key !== sourceKey);
        next.splice(Math.max(next.indexOf(targetKey), 0), 0, sourceKey);
        return next;
      });
    };

    const orderedColumns = columnOrder.map((key) => tableSpec.columns.find((column) => column.key === key)).filter(Boolean);
    const columns = orderedColumns.filter((column) => visibleKeys.includes(column.key) || column.key === 'actions').map((column) => {
      if (column.key !== 'actions') return dataColumns([column])[0];
      return {
        key: column.key,
        dataIndex: column.key,
        title: column.label,
        width: column.width,
        fixed: 'right',
        ellipsis: false,
        render: (_, row) => h(Space, { size: 4 }, ...(tableSpec.rowActions || [])
          .filter((action) => !action.visibleWhen || row[action.visibleWhen.field] === action.visibleWhen.equals)
          .map((action) => h(Button, {
            key: action.key,
            type: 'link',
            size: 'small',
            danger: Boolean(action.danger),
            onClick: () => {
              if (action.type === 'detail') setDetailRow(row);
              else if (action.type === 'edit') setWorkflow({ kind: 'edit', action, row });
              else if (action.type === 'confirm-state-change') confirmAction(action, [row], () => {
                updateRows([row[tableSpec.rowKey]], action.effect);
                message.success(action.confirm.successMessage);
              });
              else if (action.type === 'delete') confirmAction(action, [row], () => {
                removeRows([row[tableSpec.rowKey]]);
                message.success(action.confirm.successMessage);
              });
              else if (action.confirm) confirmAction(action, [row], () => message.success(`${action.label}成功`));
              else message.success(`${action.label}：${row[tableSpec.rowKey]}`);
            }
          }, action.label)))
      };
    });

    const settingsContent = h('div', { className: 'boss-column-settings' },
      h('div', { className: 'boss-column-settings-header' },
        h('strong', null, '列设置'),
        h(Button, { type: 'link', size: 'small', onClick: () => { setVisibleKeys(tableSpec.columns.filter((column) => column.hidden !== true).map((column) => column.key)); setColumnOrder(initialColumnKeys); } }, '恢复默认')),
      h('div', { className: 'boss-column-settings-list' }, ...optionalColumns.map((column) => h('div', {
        key: column.key,
        className: 'boss-column-setting-row',
        draggable: Boolean(tableSpec.columnSettings?.allowOrder),
        onDragStart: () => setDraggingKey(column.key),
        onDragOver: (event) => event.preventDefault(),
        onDrop: () => { reorderColumn(draggingKey, column.key); setDraggingKey(null); }
      },
      tableSpec.columnSettings?.allowOrder ? h('span', { className: 'boss-column-drag-handle', 'aria-label': '拖拽排序' }, '::') : null,
      h(Checkbox, { checked: visibleKeys.includes(column.key), onChange: (event) => setVisibleKeys((current) => event.target.checked ? [...new Set(current.concat(column.key))] : current.filter((key) => key !== column.key)) }, column.label)))));

    const summary = list.summary?.items?.length ? h('div', { className: 'boss-result-summary-inline', 'data-boss-query-summary': 'inline' },
      h('span', { className: 'boss-result-summary-prefix' }, '查询统计：'),
      ...list.summary.items.flatMap((item, index) => [
        index ? h('span', { key: `${item.key}-divider`, className: 'boss-result-summary-inline-divider', 'aria-hidden': true }, '|') : null,
        h('span', { key: item.key, className: 'boss-result-summary-inline-item' },
          h('span', { className: 'boss-result-summary-inline-label' }, item.label),
          h('strong', { className: 'boss-result-summary-inline-value' }, item.value),
          item.suffix ? h('span', { className: 'boss-result-summary-inline-suffix' }, String(item.suffix).trim()) : null)
      ])) : h('div', { className: 'boss-result-title' }, tableSpec.sectionTitle || '查询结果');
    const statistics = list.statistics?.items?.length ? h('div', { className: 'boss-result-summary', style: { '--boss-summary-columns': list.statistics.items.length } }, ...list.statistics.items.map((item) => h(Card, { key: item.key, size: 'small', bordered: false, className: 'boss-statistic-card' }, h(Statistic, { title: item.label, value: item.value, precision: item.precision, suffix: item.unit })))) : null;
    const toolbarTools = [];
    const runSecondaryAction = (action) => action.type === 'export' ? exportRows() : message.success(`${action.label}操作已触发`);
    (tableSpec.secondaryActions || []).forEach((action) => {
      if (action.type === 'dropdown') {
        const items = (action.items || []).map((item) => ({
          key: item.key,
          label: item.label,
          danger: Boolean(item.danger),
          onClick: () => runSecondaryAction(item)
        }));
        toolbarTools.push(h(Dropdown, { key: action.key, menu: { items }, trigger: ['click'] }, h(Button, { icon: h(DownOutlined) }, action.label)));
      } else {
        toolbarTools.push(h(Button, { key: action.key, onClick: () => runSecondaryAction(action) }, action.label));
      }
    });
    if (tableSpec.primaryAction) toolbarTools.push(h(Button, {
      key: tableSpec.primaryAction.key,
      type: 'primary',
      onClick: () => tableSpec.primaryAction.workflowTarget === 'form' && onStartWorkflow
        ? onStartWorkflow()
        : setWorkflow({ kind: 'create', action: tableSpec.primaryAction, row: tableSpec.primaryAction.createRecord || {} })
    }, tableSpec.primaryAction.label));
    if ((tableSpec.tools || []).includes('refresh')) toolbarTools.push(h(Tooltip, { key: 'refresh', title: '刷新' }, h(Button, { icon: h(ReloadOutlined), 'aria-label': '刷新', onClick: () => runQuery(form.getFieldsValue()) })));
    // Column settings are a fixed list affordance, so it remains the final toolbar tool for every query list.
    toolbarTools.push(h(Popover, { key: 'settings', title: null, content: settingsContent, trigger: 'click', placement: 'bottomRight' }, h(Tooltip, { title: '列设置' }, h(Button, { className: 'boss-column-setting-button', icon: h(SettingOutlined), 'aria-label': '列设置' }))));
    const batchBar = selectedKeys.length ? h('div', { className: 'boss-batch-toolbar' }, h('span', null, `已选择 ${selectedKeys.length} 项`), ...(tableSpec.batchActions || []).map((action) => h(Button, { key: action.key, danger: Boolean(action.danger), onClick: () => confirmAction(action, selectedKeys, () => { updateRows(selectedKeys, action.effect); setSelectedKeys([]); message.success(action.confirm?.successMessage || `${action.label}成功`); }) }, action.label))) : null;
    const emptyText = failed ? h(Result, { className: 'boss-error-state', status: 'error', title: spec.states?.error?.title || '数据加载失败', subTitle: spec.states?.error?.description || '请检查查询条件后重试。', extra: h(Button, { type: 'primary', onClick: () => runQuery(form.getFieldsValue()) }, '重新加载') }) : h(Empty, { description: spec.states?.empty?.description || '未查询到符合条件的数据' });
    const detailSpec = tableSpec.drawerDetail;
    const detailDrawer = detailSpec ? h(Drawer, {
      open: Boolean(detailRow), title: detailSpec.title, width: detailSpec.width || 808, closeIcon: false, onClose: () => setDetailRow(null),
      extra: h(Button, { type: 'text', icon: h(CloseOutlined), 'aria-label': '关闭详情', onClick: () => setDetailRow(null) }),
      footer: h('div', { className: 'boss-drawer-footer-actions' }, h(Button, { onClick: () => setDetailRow(null) }, detailSpec.closeLabel))
    }, detailRow ? h('div', { className: `boss-drawer-detail${detailSpec.groups.length > 1 ? ' boss-drawer-grouped-detail' : ''}` }, ...detailSpec.groups.map((group) => h('div', { key: group.key, className: 'boss-detail-section' },
      h('div', { className: 'boss-section-title' }, group.title),
      group.fields ? h(Descriptions, { column: group.columns || 3, size: 'small', items: group.fields.map((field) => ({ key: field.key, label: field.label, span: field.span || 1, children: boundDetailValue(field, detailRow) })) }) : null,
      group.table ? h(Table, { rowKey: group.table.rowKey, columns: dataColumns(group.table.columns), dataSource: group.table.rowsSource ? detailRow[group.table.rowsSource] || [] : group.table.rows || [], pagination: false, size: 'small' }) : null))) : null) : null;
    const workflowDrawer = workflow ? h(WorkflowDrawer, {
      open: true,
      workflow: workflow.action.form,
      initialValues: workflow.row,
      onClose: () => setWorkflow(null),
      onSave: (values) => {
        if (workflow.kind === 'create') setRows((current) => [{ ...workflow.row, ...values }, ...current]);
        else setRows((current) => current.map((row) => row[tableSpec.rowKey] === workflow.row[tableSpec.rowKey] ? { ...row, ...values } : row));
        message.success(workflow.action.form.successMessage);
        setWorkflow(null);
      }
    }) : null;
    const tableMinimumWidth = columns.reduce((total, column) => total + (Number(column.width) || 140), tableSpec.rowSelection ? 48 : 0);
    const tableProps = {
      rowKey: tableSpec.rowKey,
      columns,
      dataSource: failed ? [] : pagedRows,
      loading,
      pagination: false,
      scroll: { x: tableSpec.scrollX || tableMinimumWidth },
      locale: { emptyText }
    };
    if (tableSpec.rowSelection) tableProps.rowSelection = { selectedRowKeys: selectedKeys, onChange: setSelectedKeys };
    if (tableSpec.expandable) {
      const child = tableSpec.expandable.childTable;
      tableProps.expandable = { expandedRowRender: (row) => h(Table, { className: 'boss-child-table', rowKey: child.rowKey, columns: dataColumns(child.columns), dataSource: row[child.rowsSource] || [], pagination: false, size: 'small' }) };
    }
    return h(React.Fragment, null,
      h('div', { className: 'boss-content-stack' },
        h('section', { className: 'boss-query-module', 'data-boss-query-layout': 'adaptive' }, h(Form, { form, layout: 'horizontal', onFinish: runQuery, initialValues: queryInitial }, h('div', {
          ref: queryLayoutRef,
          className: `boss-query-grid${queryLayoutReady ? '' : ' is-measuring'}`,
          'data-boss-query-measurement': 'actual-row-count'
        },
        ...visibleQueryFields.map((field) => queryItem(field, form, field.key === datePresetFieldKey)),
        h('div', { className: 'boss-query-actions', 'data-boss-query-row': 'actions' }, queryLayoutReady && queryHasOverflow ? h(Button, { type: 'text', className: 'boss-query-expand-button', icon: queryCollapsed ? h(DownOutlined) : h(UpOutlined), onClick: toggleQuery }, queryCollapsed ? '展开' : '收起') : null, h(Button, { onClick: reset }, '重置'), h(Button, { type: 'primary', htmlType: 'submit' }, '查询'))))),
        h('section', { className: 'boss-result-module' }, statistics, h('div', { className: 'boss-result-toolbar' }, h('div', { className: 'boss-result-toolbar-left' }, summary), h('div', { className: 'boss-result-toolbar-right' }, ...toolbarTools)), batchBar, h('div', { className: 'boss-table-body' }, h(Table, tableProps)), h('div', { className: 'boss-table-pagination' }, h(Pagination, { current: page, pageSize, total: failed ? 0 : filteredRows.length, showSizeChanger: false, showTotal: (total) => `共 ${total} 条`, onChange: setPage })))),
      detailDrawer,
      workflowDrawer);
  }

  function WizardFormPage({ spec, onReturnSource }) {
    const formSpec = spec.form;
    const wizardSteps = [...formSpec.steps];
    const [form] = Form.useForm();
    const [step, setStep] = React.useState(0);
    const [submitting, setSubmitting] = React.useState(false);
    const [completed, setCompleted] = React.useState(false);
    const [submitError, setSubmitError] = React.useState(null);
    const [submittedValues, setSubmittedValues] = React.useState(null);
    const allFields = wizardSteps.flatMap((item) => item.fields || []);
    const initialValues = {};
    allFields.forEach((field) => { if (Object.hasOwn(field, 'default')) initialValues[field.key] = initialValueForField(field); });
    const currentStep = wizardSteps[step];
    const currentFields = currentStep.fields || [];
    const formLayout = resolveFormLayout(formSpec, currentFields);

    const next = async () => {
      await form.validateFields(currentFields.map((field) => field.key));
      setStep((value) => Math.min(value + 1, wizardSteps.length - 1));
    };
    const submit = async () => {
      await form.validateFields();
      const confirmation = formSpec.submit.confirm || {};
      Modal.confirm({
        className: 'boss-confirm-modal',
        centered: true,
        title: confirmation.title || '提交确认',
        content: confirmation.description || '确认提交当前配置吗？提交后将进入后续流程。',
        width: 416,
        okText: '提 交',
        cancelText: '取 消',
        okButtonProps: { className: 'boss-confirm-button' },
        onOk: () => new Promise((resolveSubmit) => {
          const values = form.getFieldsValue(true);
          setSubmitError(null);
          setSubmitting(true);
          global.setTimeout(() => {
            const failure = formSpec.submit.failure;
            if (failure && values[failure.trigger.field] === failure.trigger.value) {
              setSubmitting(false);
              setSubmitError(failure);
              resolveSubmit();
              return;
            }
            setSubmitting(false);
            setSubmittedValues(values);
            setCompleted(true);
            message.success(formSpec.submit.success.message);
            resolveSubmit();
          }, formSpec.submit.delayMs || 260);
        })
      });
    };

    if (completed) {
      const returnSource = formSpec.submit.success.actionType === 'return-source';
      return h('div', { className: 'boss-content-stack' }, h('section', { className: 'boss-result-page' }, renderFormSuccessResult(formSpec.submit.success, () => {
          if (returnSource) {
            if (onReturnSource) onReturnSource(submittedValues || {});
            else message.info('已返回来源列表');
            return;
          }
          setCompleted(false); setSubmitError(null); form.resetFields(); setStep(0);
        }, () => { setCompleted(false); setSubmitError(null); form.resetFields(); setStep(0); })));
    }

    return h('div', { className: 'boss-wizard-page', 'data-boss-wizard-template': 'fixed' },
      h('div', { className: 'wizard-content-frame' },
        h(Steps, { current: step, items: wizardSteps.map((item) => ({ title: item.title, description: item.description })), className: 'boss-wizard-steps' }),
        h('div', { className: 'wizard-body-grid' },
          h('section', { className: 'wizard-form-pane' }, h(Form, { form, layout: formLayout.layout, labelCol: formLayout.labelCol, className: formLayout.className, 'data-boss-form-layout': formLayout.layout, initialValues },
            currentStep.review && currentStep.previewTable
              ? h(Table, { className: 'boss-wizard-preview-table', rowKey: currentStep.previewTable.rowKey, columns: dataColumns(currentStep.previewTable.columns), dataSource: currentStep.previewTable.rows || [], pagination: false, size: 'small' })
              : currentStep.review
                ? h(Descriptions, { column: 2, size: 'small', items: Object.entries(form.getFieldsValue(true)).map(([key, value]) => ({ key, label: allFields.find((field) => field.key === key)?.label || key, children: Array.isArray(value) ? `${value.length} 个文件` : String(value ?? '-') })) })
              : h('div', { className: `wizard-field-grid ${formLayout.fieldsClassName}` }, ...currentFields.map((field) => formItem(field))),
            submitError ? h(Alert, { className: 'boss-form-submit-error', type: 'error', showIcon: true, message: submitError.message, description: submitError.recovery }) : null)),
          h('aside', { className: 'wizard-guide-pane' },
            React.createElement('img', { className: 'wizard-guide-image', src: './assets/wizard-guide.png', alt: formSpec.wizardGuide.alt || '流程引导' }),
            h('div', { className: 'wizard-guide-title' }, formSpec.wizardGuide.title),
            h('div', { className: 'wizard-guide-text' }, formSpec.wizardGuide.text)))),
      h('div', { className: 'wizard-action-bar' },
        h(Button, { disabled: step === 0, onClick: () => setStep((value) => Math.max(value - 1, 0)) }, '上一步'),
        step < wizardSteps.length - 1
          ? h(Button, { type: 'primary', onClick: next }, '下一步')
          : h(Button, { type: 'primary', loading: submitting, onClick: submit }, formSpec.submit.primaryLabel || '提 交')));
  }

  function FormPage({ spec, onReturnSource }) {
    const formSpec = spec.form;
    if (formSpec.steps) return h(WizardFormPage, { spec, onReturnSource });
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = React.useState(false);
    const [completed, setCompleted] = React.useState(false);
    const [submitError, setSubmitError] = React.useState(null);
    const [submittedValues, setSubmittedValues] = React.useState(null);
    const sections = formSpec.groups || [{ key: 'main', title: formSpec.sectionTitle, fields: formSpec.fields }];
    const initialValues = {};
    const allFields = formSpec.fields || (formSpec.groups ? formSpec.groups.flatMap((group) => group.fields || []) : []);
    const formLayout = resolveFormLayout(formSpec, allFields);
    allFields.forEach((field) => { if (Object.hasOwn(field, 'default')) initialValues[field.key] = initialValueForField(field); });
    const submit = async () => {
      const values = await form.validateFields();
      setSubmitError(null);
      setSubmitting(true);
      global.setTimeout(() => {
        const failure = formSpec.submit.failure;
        if (failure && values[failure.trigger.field] === failure.trigger.value) {
          setSubmitting(false);
          setSubmitError(failure);
          return;
        }
        setSubmitting(false);
        setSubmittedValues(values);
        setCompleted(true);
        message.success(formSpec.submit.success.message);
      }, formSpec.submit.delayMs || 260);
    };

    const closeOrReset = () => { setCompleted(false); setSubmitError(null); form.resetFields(); };
    const presentation = formSpec.presentation || 'page';
    const usesInlinePageActions = presentation === 'page' && ['form.page-simple', 'form.guided-simple'].includes(spec.metadata.templateId);
    const pageActions = h('div', {
      className: `boss-form-actions ${usesInlinePageActions ? 'boss-inline-form-actions' : presentation === 'page' ? 'boss-full-page-action-bar' : formSpec.stickyActions ? 'is-sticky' : ''}`,
      'data-boss-form-action-mode': usesInlinePageActions ? 'inline' : presentation === 'page' ? 'fixed' : undefined,
      'data-boss-full-page-action-bar': presentation === 'page' && !usesInlinePageActions ? true : undefined
    }, ...(usesInlinePageActions
      ? [h(Button, { key: 'submit', type: 'primary', loading: submitting, onClick: submit }, formSpec.submit.primaryLabel), h(Button, { key: 'secondary', onClick: () => form.resetFields() }, formSpec.submit.cancelLabel || '取 消')]
      : [h(Button, { key: 'secondary', onClick: () => form.resetFields() }, formSpec.submit.cancelLabel || '取 消'), h(Button, { key: 'submit', type: 'primary', loading: submitting, onClick: submit }, formSpec.submit.primaryLabel)]));
    const floatingActions = [h(Button, { key: 'secondary', onClick: closeOrReset }, formSpec.submit.cancelLabel || '取 消'), h(Button, { key: 'submit', type: 'primary', loading: submitting, onClick: submit }, formSpec.submit.primaryLabel)];
    const formBody = completed
      ? renderFormSuccessResult(formSpec.submit.success, () => {
        if (formSpec.submit.success.actionType === 'return-source' && onReturnSource) onReturnSource(submittedValues || {});
        else closeOrReset();
      }, closeOrReset)
      : h(Form, { form, layout: formLayout.layout, labelCol: formLayout.labelCol, initialValues, className: formLayout.className, 'data-boss-form-layout': formLayout.layout },
        ...(sections || []).map((section) => {
          const fields = h('div', { className: `boss-form-grid ${formLayout.fieldsClassName}` }, ...(section.fields || []).map((field) => formItem(field)));
          const useCard = section.container === 'card' || (spec.metadata.templateId === 'form.grouped-page' && section.container !== 'plain');
          if (useCard) return h(Card, { key: section.key, size: 'small', className: 'boss-form-section boss-form-section-card', title: section.title || undefined }, fields);
          return h('section', { key: section.key, className: 'boss-form-section' }, section.title ? h(Divider, { orientation: 'left', plain: true, className: 'boss-form-section-divider' }, section.title) : null, fields);
        }),
        submitError ? h(Alert, { className: 'boss-form-submit-error', type: 'error', showIcon: true, message: submitError.message, description: submitError.recovery }) : null,
        presentation === 'page' ? pageActions : null);
    if (presentation === 'modal') return h('div', { className: 'boss-content-stack' }, h(Modal, { open: true, centered: true, title: spec.metadata.pageName, width: formSpec.width || 500, closable: true, onCancel: closeOrReset, footer: completed ? null : floatingActions }, formBody));
    if (presentation === 'drawer') return h('div', { className: 'boss-content-stack' }, h(Drawer, { open: true, title: spec.metadata.pageName, width: formSpec.width || 640, rootClassName: 'boss-drawer-form', closeIcon: false, onClose: closeOrReset, extra: React.createElement(Button, { type: 'text', icon: h(CloseOutlined), 'aria-label': '关闭表单', onClick: closeOrReset }), footer: completed ? null : h('div', { className: 'boss-drawer-footer-actions' }, ...floatingActions) }, formBody));
    if (completed) return h('div', { className: 'boss-content-stack' }, h('section', { className: 'boss-result-page' }, formBody));
    const groupedPageClass = spec.metadata.templateId === 'form.grouped-page' ? ' boss-grouped-form-module' : '';
    return h('div', { className: 'boss-content-stack' }, h('section', { className: `boss-form-module boss-full-page-form${usesInlinePageActions ? ' boss-inline-action-page' : ''}${groupedPageClass}` }, formSpec.sideGuide ? h('div', { className: 'boss-guided-form-layout' }, h('div', { className: 'boss-guided-form-main' }, formBody), h(BusinessGuide, { guide: formSpec.sideGuide })) : formBody));
  }

  function detailItems(fields) {
    return (fields || []).map((field) => ({
      key: field.key,
      label: field.label,
      span: field.span || 1,
      children: field.format === 'status'
        ? h(Badge, { status: field.status || 'default', text: field.value })
        : field.format === 'amount'
          ? formatAmount(field.value, field)
          : field.format === 'tag'
            ? h(Tag, { color: field.tagMap?.[field.value]?.color }, field.tagMap?.[field.value]?.label || String(field.value ?? '-'))
          : String(field.value ?? '-')
    }));
  }

  function DetailPage({ spec }) {
    const detail = spec.detail;
    const [open, setOpen] = React.useState(true);
    const groupedDetailSurfaces = detail.presentation === 'page' && !detail.tabs && (detail.groups || []).length > 1;
    const groupView = (group) => {
      const content = h(React.Fragment, null,
        group.fields ? h(Descriptions, { column: group.columns || 3, size: 'small', items: detailItems(group.fields) }) : null,
        group.table ? h(Table, { rowKey: group.table.rowKey, columns: dataColumns(group.table.columns), dataSource: group.table.rows, pagination: false, size: 'small' }) : null);
      if (groupedDetailSurfaces) return h(Card, { key: group.key, id: `detail-${group.key}`, size: 'small', className: 'boss-detail-section boss-detail-section-card', title: group.title }, content);
      return h('div', { key: group.key, id: `detail-${group.key}`, className: 'boss-detail-section' }, h('div', { className: 'boss-section-title' }, group.title), content);
    };
    const groupedContent = detail.tabs ? h(Tabs, { items: detail.tabs.map((tab) => ({ key: tab.key, label: tab.label, children: tab.groupKeys.map((key) => groupView(detail.groups.find((group) => group.key === key))) })) }) : detail.groups.map(groupView);
    const body = h(React.Fragment, null,
      detail.metrics?.length ? h('div', { className: 'boss-detail-metrics', style: { '--boss-metric-columns': detail.metrics.length } }, ...detail.metrics.map((metric) => h('div', { key: metric.key, className: 'boss-detail-metric' }, h(Statistic, { title: metric.label, value: metric.value, suffix: metric.unit, precision: metric.precision })))) : null,
      detail.anchors && !groupedDetailSurfaces ? h('div', { className: 'boss-detail-with-anchors' }, h('nav', { className: 'boss-detail-anchors', 'aria-label': '详情目录' }, ...detail.groups.map((group) => h('a', { key: group.key, href: `#detail-${group.key}` }, group.title))), h('div', { className: 'boss-detail-anchor-content' }, groupedContent)) : groupedContent);
    if (detail.presentation === 'modal') return h('div', { className: 'boss-content-stack' }, h(Modal, { open, centered: true, title: spec.metadata.pageName, onCancel: () => setOpen(false), footer: h(Button, { onClick: () => setOpen(false) }, detail.closeLabel || '关 闭'), width: detail.width || 640 }, body));
    if (detail.presentation === 'drawer') return h('div', { className: 'boss-content-stack' }, h(Drawer, { open, title: spec.metadata.pageName, width: detail.width || 808, closeIcon: false, onClose: () => setOpen(false), extra: React.createElement(Button, { type: 'text', icon: h(CloseOutlined), 'aria-label': '关闭详情', onClick: () => setOpen(false) }), footer: h('div', { className: 'boss-drawer-footer-actions' }, h(Button, { onClick: () => setOpen(false) }, detail.closeLabel || '我知道了')) }, h('div', { className: `boss-drawer-detail${detail.groups.length > 1 ? ' boss-drawer-grouped-detail' : ''}` }, body)));
    return h('div', { className: 'boss-content-stack' }, h('section', { className: `boss-detail-module${groupedDetailSurfaces ? ' boss-grouped-detail-module' : ''}` }, body));
  }

  function ResultPage({ spec }) {
    const result = spec.result;
    return h('div', { className: 'boss-content-stack' }, h('section', { className: 'boss-result-page' }, renderWorkflowResult({
      status: result.status,
      title: result.title,
      description: result.description,
      summary: result.summary,
      feedback: result.feedback,
      actions: result.actions.map((action) => ({ ...action, onClick: () => message.info(action.feedback || action.label) }))
    })));
  }

  function DashboardChart({ chart }) {
    const ChartComponent = {
      line: Charts.Line,
      column: Charts.Column,
      pie: Charts.Pie,
      bar: Charts.Bar
    }[chart.type];
    const shared = {
      data: chart.data,
      autoFit: true,
      height: chart.height || 260,
      animation: false,
      tooltip: { shared: chart.type !== 'pie' },
      legend: chart.legend === false ? false : { position: 'bottom' }
    };
    let config = shared;
    if (chart.type === 'pie') {
      config = { ...shared, angleField: chart.angleField, colorField: chart.colorField, radius: 0.82, innerRadius: 0.58, label: false };
    } else {
      config = { ...shared, xField: chart.xField, yField: chart.yField, seriesField: chart.seriesField };
    }
    return h('section', { className: `boss-dashboard-chart boss-dashboard-chart-${chart.role}`, 'aria-label': chart.title },
      h('h3', { className: 'boss-dashboard-chart-title' }, chart.title),
      ChartComponent ? h(ChartComponent, config) : h(Empty, { description: '图表组件未加载' }));
  }

  function DashboardPage({ spec }) {
    const dashboard = spec.dashboard;
    const [form] = Form.useForm();
    const [scope, setScope] = React.useState(dashboard.scope.initialValues || {});
    const applyScope = (values) => {
      setScope(values);
      message.success('统计范围已更新');
    };
    return h('div', { className: 'boss-content-stack boss-dashboard-page' },
      h('section', { className: 'boss-dashboard-scope' },
        h(Form, { form, layout: 'horizontal', initialValues: dashboard.scope.initialValues || {}, onFinish: applyScope },
          h('div', { className: 'boss-dashboard-scope-grid' },
            ...(dashboard.scope.fields || []).map((field) => h(Form.Item, { key: field.key, name: field.key, label: field.label }, controlForField(field))),
            h('div', { className: 'boss-dashboard-scope-actions' }, h(Button, { onClick: () => { form.resetFields(); setScope(dashboard.scope.initialValues || {}); } }, '重 置'), h(Button, { type: 'primary', htmlType: 'submit' }, '更 新'))))),
      h('section', { className: 'boss-dashboard-metrics', style: { '--boss-dashboard-metric-columns': dashboard.metrics.length } },
        ...dashboard.metrics.map((metric) => h('div', { key: metric.key, className: 'boss-dashboard-metric' }, h(Statistic, { title: metric.label, value: metric.value, precision: metric.precision, suffix: metric.unit })))),
      h('section', { className: 'boss-dashboard-charts' },
        ...dashboard.charts.map((chart) => h(DashboardChart, { key: chart.key, chart }))),
      h('span', { className: 'boss-dashboard-scope-status', 'aria-live': 'polite', 'data-dashboard-scope': JSON.stringify(scope) }, dashboard.scope.statusText || '当前展示所选统计范围的数据'));
  }

  function sourceRecordFromValues(spec, values) {
    const sourceList = spec.form.sourceList;
    const table = sourceList.table;
    const record = { ...(table.primaryAction?.createRecord || {}) };
    const labels = spec.workflow?.recordFieldLabels || {};
    const columnsByLabel = new Map(table.columns.map((column) => [column.label, column.key]));
    Object.entries(labels).forEach(([fieldKey, label]) => {
      const columnKey = columnsByLabel.get(label);
      if (columnKey && values[fieldKey] !== undefined) record[columnKey] = values[fieldKey];
    });
    if (!record[table.rowKey]) record[table.rowKey] = `R${String(table.rows.length + 1).padStart(3, '0')}`;
    return record;
  }

  function LinkedWorkflowPage({ spec, activeTabKey, rootTabKey, tabs, openTab, closeTab }) {
    const [createdRecord, setCreatedRecord] = React.useState(null);
    const sourceSpec = React.useMemo(() => ({ ...spec, list: spec.form.sourceList }), [spec]);
    const workflowTabKey = `${rootTabKey}--create`;
    const workflowOpen = (tabs || []).some((tab) => tab.key === workflowTabKey);
    const openWorkflow = () => openTab?.({
      key: workflowTabKey,
      label: spec.form.title || spec.metadata.pageName,
      route: `/workflow/${workflowTabKey}`,
      closable: true
    });
    return h(React.Fragment, null,
      h('div', { style: { display: activeTabKey === rootTabKey ? 'block' : 'none' } }, h(ListPage, {
        spec: sourceSpec,
        createdRecord,
        onStartWorkflow: openWorkflow
      })),
      workflowOpen ? h('div', { style: { display: activeTabKey === workflowTabKey ? 'block' : 'none' } }, h(FormPage, {
        spec,
        onReturnSource: (values) => {
          setCreatedRecord(sourceRecordFromValues(spec, values));
          closeTab?.(workflowTabKey);
        }
      })) : null);
  }

  function BusinessPage({ spec, activeTabKey, rootTabKey, tabs, openTab, closeTab }) {
    if (spec.metadata.family === 'list') return h(ListPage, { spec });
    if (spec.metadata.family === 'form' && spec.form?.sourceList) return h(LinkedWorkflowPage, { spec, activeTabKey, rootTabKey, tabs, openTab, closeTab });
    if (spec.metadata.family === 'form') return h(FormPage, { spec });
    if (spec.metadata.family === 'detail') return h(DetailPage, { spec });
    if (spec.metadata.family === 'result') return h(ResultPage, { spec });
    if (spec.metadata.family === 'dashboard') return h(DashboardPage, { spec });
    return h(Empty, { description: '当前页面族尚未开放' });
  }

  function mount(spec) {
    const shellConfig = defaultShellConfig(spec);
    const renderContent = (shellContext) => h(BusinessPage, { spec, rootTabKey: shellConfig.activeTabKey, ...shellContext });
    ReactDOM.createRoot(document.getElementById('root')).render(
      h(ConfigProvider, {
        locale: antd.locales?.zh_CN,
        theme: {
          token: theme.antTokens
        }
      }, h(AntApp, null, h(BossLedgerShell, { config: shellConfig, renderContent }))));
  }

  global.BossLedgerPageSpecRuntime = { mount };
})(window);
