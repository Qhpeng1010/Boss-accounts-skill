const CHINESE_NUMBERS = new Map([
  ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5],
  ['六', 6], ['七', 7], ['八', 8], ['九', 9], ['十', 10]
]);

const RULE_REFS = ['BL-TPL-003', 'BL-TPL-006', 'BL-TPL-007', 'BL-TPL-021', 'BL-VIS-021', 'BL-INT-005', 'BL-INT-006', 'BL-INT-007', 'BL-INT-017'];

const SELECT_OPTIONS = {
  '规则类型': [['按比例分账', 'ratio'], ['按固定金额分账', 'fixed']],
  '规则渠道': [['线上收款', 'online'], ['线下收款', 'offline']],
  '渠道下级': [['华东直营网点', 'east'], ['华南直营网点', 'south'], ['全国直营门店', 'national']],
  '分账方': [['易宝支付服务有限公司', 'yeepay'], ['合作运营方', 'partner']]
};

function normalize(value) {
  return String(value || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseStepNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  return CHINESE_NUMBERS.get(value) || NaN;
}

function fieldsFrom(text) {
  return text
    .replace(/[。；;]+$/g, '')
    .split(/[、，,；;]/)
    .map((field) => field.replace(/^(?:填写|配置|设置)/, '').trim())
    .filter(Boolean);
}

function fieldControl(label) {
  if (SELECT_OPTIONS[label]) {
    return {
      control: 'select',
      options: SELECT_OPTIONS[label].map(([optionLabel, value]) => ({ label: optionLabel, value }))
    };
  }
  if (/日期|时间/.test(label)) return { control: 'date' };
  if (/金额|手续费|费率|比例|数量/.test(label)) return { control: 'number' };
  return { control: 'input' };
}

function stepTitle(index, fields, review) {
  if (review) return '预览并提交';
  if (fields.some((field) => /金额|手续费|费率|比例/.test(field))) return '金额配置';
  if (index === 1) return '基础信息';
  return `第${index}步配置`;
}

function pageNameFrom(request) {
  const matched = request.match(/新增\s*([^，。；\s]+?)\s*(?:进行配置|配置)/);
  return matched ? `新增${matched[1]}` : '分阶段配置';
}

function selectionReason(pageName) {
  return `${pageName}存在前后依赖，并且提交前需要复核，使用分阶段配置流程。`;
}

export function parseStructuredWizardRequest(rawRequest) {
  const request = normalize(rawRequest);
  if (!request) throw new Error('缺少业务需求。');
  const matches = [...request.matchAll(/第([一二三四五六七八九十\d]+)步\s*[：:]\s*([\s\S]*?)(?=(?:第[一二三四五六七八九十\d]+步\s*[：:]|落地页|要求\s*[：:]|$))/g)];
  if (matches.length < 2) throw new Error('仅支持至少两个带“第 N 步：”结构的流程需求。');

  const steps = matches.map((match) => ({
    index: parseStepNumber(match[1]),
    content: normalize(match[2])
  }));
  if (steps.some((step) => !Number.isInteger(step.index)) || steps.some((step, index) => step.index !== index + 1)) {
    throw new Error('步骤必须从“第一步”开始连续编号。');
  }

  const declaredCount = request.match(/(?:分为|共)\s*([一二三四五六七八九十\d]+)\s*步/);
  if (declaredCount && parseStepNumber(declaredCount[1]) !== steps.length) {
    throw new Error('声明的步骤数量与实际编号步骤数量不一致。');
  }

  const parsedSteps = steps.map((step) => {
    const parsedFields = fieldsFrom(step.content);
    // Completion notes may follow the review label in the same sentence.
    // The step still represents a read-only review when it begins with one.
    const review = /^(?:预览|复核|确认)/.test(parsedFields[0] || '');
    if (!review && parsedFields.length === 0) throw new Error(`第${step.index}步没有可生成的字段。`);
    return {
      key: review ? 'review' : `step${step.index}`,
      title: stepTitle(step.index, parsedFields, review),
      description: review ? '请核对全部规则信息，确认无误后提交。' : `填写${stepTitle(step.index, parsedFields, false)}所需信息。`,
      ...(review ? { review: true } : {
        fields: parsedFields.map((label, index) => ({
          key: `step${step.index}Field${index + 1}`,
          label,
          required: true,
          ...fieldControl(label)
        }))
      })
    };
  });
  if (!parsedSteps.some((step) => step.review)) throw new Error('流程必须包含预览、复核或确认步骤。');

  return {
    request,
    pageName: pageNameFrom(request),
    steps: parsedSteps,
    returnsToSource: /返回列表|返回.*查询|回到列表/.test(request),
    continueCreate: /继续新增|继续创建/.test(request)
  };
}

export function compileStructuredWizard({ rawRequest, changeId }) {
  const parsed = parseStructuredWizardRequest(rawRequest);
  const capabilities = ['form.steps', 'form.review', 'form.stickyActions'];
  const validatedCombinations = ['form.steps'];
  if (parsed.returnsToSource) {
    capabilities.push('form.returnSource');
    validatedCombinations[0] = 'form.steps-return-source';
  }
  const reason = selectionReason(parsed.pageName);
  const success = {
    title: `${parsed.pageName}完成`,
    message: `${parsed.pageName}已提交完成。`,
    ...(parsed.returnsToSource ? { actionType: 'return-source', actionLabel: '返回列表查看' } : { actionType: 'reset', actionLabel: '继续配置' }),
    ...(parsed.continueCreate ? { secondaryAction: { label: '继续新增' } } : {})
  };

  return {
    schemaVersion: 1,
    ui: { system: 'boss-ledger', runtime: 'react-antd-page-spec', rendererVersion: 1 },
    metadata: {
      changeId,
      pageName: parsed.pageName,
      family: 'form',
      templateId: 'form.staged-flow',
      executionMode: 'shadow',
      validatedCombinations,
      request: parsed.request,
      selectionReason: reason,
      assumptions: [
        '当前为客户端交互原型，不调用真实业务服务。',
        '需求未给出的下拉选项使用流程配方中的默认业务选项。',
        '未单独声明可选性的字段按必填处理。'
      ],
      ruleRefs: RULE_REFS
    },
    shell: { activePrimaryKey: 'workspace' },
    content: { capabilities },
    form: {
      presentation: 'page',
      wizardGuide: {
        title: parsed.pageName,
        text: '请按步骤完成配置，并在提交前核对规则与金额信息。'
      },
      steps: parsed.steps,
      stickyActions: true,
      submit: {
        primaryLabel: '提交',
        confirm: {
          title: `确认提交${parsed.pageName}`,
          description: '请确认流程信息填写无误后提交。'
        },
        success
      }
    }
  };
}
