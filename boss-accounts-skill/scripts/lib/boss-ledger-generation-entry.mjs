import { resolveResources } from '../resolve-resources.mjs';
import { parseListWorkbenchRequest } from './boss-ledger-list-workbench-recipe.mjs';
import { parseStructuredWizardRequest } from './boss-ledger-wizard-recipe.mjs';
import { normalizeRecipeRequest, bridgeChangedRequest } from './recipe-request-bridge.mjs';

function fallback(route, reason) {
  const routeNeedsClarification = route?.status === 'clarify';
  return {
    status: routeNeedsClarification ? 'clarify' : 'fallback',
    decision: routeNeedsClarification ? 'clarify' : 'natural-generation',
    stage: routeNeedsClarification ? 'route' : 'recipe',
    route: route?.status === 'resolved' ? {
      module: route.module,
      intent: route.intent,
      template: route.template,
      availability: route.execution?.availability || null
    } : null,
    reason,
    ...(routeNeedsClarification ? {
      question: route.question || reason,
      candidates: route.candidates || []
    } : {}),
    next: routeNeedsClarification
      ? '补充澄清问题后重新提交原始需求。'
      : '继续走受控自然语言生成，只读取该路由返回的最小规则资源。'
  };
}

function clarifyList(route, error) {
  if (!/需要明确的查询条件和列表字段/.test(error.message)) return fallback(route, `列表工作台未满足配方输入边界：${error.message}`);
  return {
    status: 'clarify',
    decision: 'clarify',
    stage: 'requirement',
    route: { module: route.module, intent: route.intent, template: route.template },
    reason: '已识别为老板管账查询列表，但配方缺少必要的业务字段。',
    question: '请补充两项信息：查询条件有哪些？列表需要展示哪些字段？如果需要详情、新增、编辑、删除、导出或统计，也请一并说明。',
    next: '补充后将重新进入列表工作台配方校验。'
  };
}

function clarifyWizard(route, error) {
  if (!/步骤必须|至少两个|没有可生成的字段|必须包含预览/.test(error.message)) return fallback(route, `步骤流程未满足已验证配方的输入边界：${error.message}`);
  return {
    status: 'clarify',
    decision: 'clarify',
    stage: 'requirement',
    route: { module: route.module, intent: route.intent, template: route.template },
    reason: '已识别为老板管账分阶段流程，但步骤信息还不完整。',
    question: '请补充连续编号的步骤、每一步字段，以及提交前是否需要预览或复核。',
    next: '补充后将重新进入分阶段流程配方校验。'
  };
}

function ensureRecipeOperations(parsed) {
  if (parsed.operations.custom?.length) {
    throw new Error(`查询列表配方未登记自定义操作：${parsed.operations.custom.join('、')}。`);
  }
}

/**
 * Classify a raw business request before an AI starts authoring a Page Spec.
 * Fast recipes must prove their own input shape; scenarios are never replayed
 * from a loose keyword match because that can silently discard business data.
 */
export function classifyBossLedgerGeneration(rawRequest, { route: resolvedRoute = null } = {}) {
  const request = String(rawRequest || '').trim();
  if (!request) return fallback(null, '缺少业务需求。');

  const bridged = bridgeChangedRequest(request);
  const rawRoute = resolvedRoute || resolveResources(request, 'generate');
  const normalizedRoute = resolvedRoute || (bridged.changed ? resolveResources(bridged.normalized, 'generate') : rawRoute);
  const route = rawRoute.status === 'resolved' && (rawRoute.intent === 'wizard' || ['query-list', 'inline-summary-list', 'card-summary-list'].includes(rawRoute.intent))
    ? rawRoute
    : normalizedRoute;
  if (route.status !== 'resolved') {
    return fallback(route, route.question || '无法唯一确定页面方案。');
  }
  if (route.module !== 'boss-ledger') {
    return { status: 'not-applicable', decision: 'route-mismatch', stage: 'route', reason: '当前请求不属于老板管账。' };
  }
  const linkedWorkflowSignal = /(?:查询\s*(?:列表|页面|的页面)|列表\s*(?:查询|页面)|从\s*列表|列表字段|查询条件)/.test(request)
    && /(?:第[一二三四五六七八九十\d]+步|分为\s*[一二三四五六七八九十\d]+步|上一步|下一步)/.test(request);
  if (linkedWorkflowSignal) {
    try {
      const parsedList = parseListWorkbenchRequest(request);
      ensureRecipeOperations(parsedList);
      const parsedWizard = parseStructuredWizardRequest(request);
      return {
        status: 'fast',
        decision: 'recipe-fast',
        stage: 'recipe',
        recipe: 'linked-list-wizard',
        pageName: parsedList.pageName,
        route: {
          module: route.module,
          intent: 'linked-list-wizard',
          template: 'form.staged-flow',
          resources: [
            'modules/boss-ledger/execution/context-packs/core.md',
            'modules/boss-ledger/execution/context-packs/index.md',
            'modules/boss-ledger/execution/context-packs/form.md'
          ]
        },
        reason: `${parsedList.pageName}同时包含查询列表和分阶段配置，命中已验证的完整业务流程配方。`,
        inputRequest: bridged.changed ? normalizeRecipeRequest(request) : request,
        channel: bridged.changed ? 'flexible' : 'fast'
      };
    } catch (error) {
      return clarifyList(route, error);
    }
  }
  const linkedPageFormSignal = /(?:查询\s*(?:列表|页面|的页面)|列表\s*(?:查询|页面)|从\s*列表|列表字段|查询条件)/.test(request)
    && /(?:全页(?:表单|配置|新增)|独立(?:表单|页面)|新增(?:到|至|使用|打开)?(?:新)?标签页|新标签页(?:新增|表单)?|新增页|新\s*tab|打开\s*新\s*tab|成功(?:页|结果页))/i.test(request);
  if (linkedPageFormSignal) {
    try {
      const parsed = parseListWorkbenchRequest(request);
      ensureRecipeOperations(parsed);
      if (!parsed.operations.create) throw new Error('完整表单流程需要明确新增操作和新增字段。');
      return {
        status: 'fast',
        decision: 'recipe-fast',
        stage: 'recipe',
        recipe: 'linked-list-page-form',
        pageName: parsed.pageName,
        route: {
          module: route.module,
          intent: 'linked-list-page-form',
          template: 'form.page-simple',
          resources: [
            'modules/boss-ledger/execution/context-packs/core.md',
            'modules/boss-ledger/execution/context-packs/index.md',
            'modules/boss-ledger/execution/context-packs/form.md'
          ]
        },
        reason: `${parsed.pageName}从查询列表发起全页新增表单，命中已验证的完整业务流程配方。`,
        inputRequest: bridged.changed ? normalizeRecipeRequest(request) : request,
        channel: bridged.changed ? 'flexible' : 'fast'
      };
    } catch (error) {
      return clarifyList(route, error);
    }
  }
  if (route.execution?.availability !== 'available') {
    return {
      status: 'blocked',
      decision: 'blocked',
      stage: 'capability',
      route: { intent: route.intent, template: route.template },
      reason: '当前页面能力尚未开放，不能生成替代页面。'
    };
  }
  if (route.intent !== 'wizard') {
    if (['query-list', 'inline-summary-list', 'card-summary-list'].includes(route.intent)) {
      try {
        const parsed = parseListWorkbenchRequest(request);
        ensureRecipeOperations(parsed);
        return {
          status: 'fast',
          decision: 'recipe-fast',
          stage: 'recipe',
          recipe: 'list-workbench',
          pageName: parsed.pageName,
          route: {
            module: route.module,
            intent: route.intent,
            template: route.template,
            resources: route.resources
          },
          reason: '需求明确了列表查询和可选行内操作，命中列表工作台参数化配方。',
          inputRequest: bridged.changed ? normalizeRecipeRequest(request) : request,
          channel: bridged.changed ? 'flexible' : 'fast'
        };
      } catch (error) {
        return clarifyList(route, error);
      }
    }
    return fallback(route, '未命中已验证的参数化配方。');
  }

  try {
    const parsed = parseStructuredWizardRequest(request);
    return {
      status: 'fast',
      decision: 'recipe-fast',
      stage: 'recipe',
      recipe: 'structured-wizard',
      pageName: parsed.pageName,
      route: {
        module: route.module,
        intent: route.intent,
        template: route.template,
        resources: route.resources
      },
      reason: '需求包含连续编号步骤、字段列表和预览/复核步骤，命中已验证的分阶段流程配方。',
      inputRequest: bridged.changed ? normalizeRecipeRequest(request) : request,
      channel: bridged.changed ? 'flexible' : 'fast'
    };
  } catch (error) {
    return clarifyWizard(route, error);
  }
}
