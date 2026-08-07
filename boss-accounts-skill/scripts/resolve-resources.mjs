#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { routeBusiness } from './route-business.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGES = new Set(['route', 'requirement', 'design', 'template', 'generate', 'review', 'all']);

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function scoreIntent(request, intent) {
  const matches = (intent.signals || []).filter((signal) => request.includes(normalize(signal)));
  const score = matches.reduce((total, signal) => total + normalize(signal).length, 0);
  const firstMatchIndex = matches.length ? Math.min(...matches.map((signal) => request.indexOf(normalize(signal)))) : Number.POSITIVE_INFINITY;
  return { intent, score, matches, firstMatchIndex };
}

function intentById(contract, id) {
  return contract.intents.find((intent) => intent.id === id);
}

function detectComposedIntents(rawRequest, contract) {
  const request = String(rawRequest || '');
  const detected = [];
  const add = (id) => {
    const intent = intentById(contract, id);
    if (intent && !detected.includes(intent)) detected.push(intent);
  };
  const hasListContract = /(?:查询条件|列表字段|查询列表|列表页面|列表页|返回[^，。；]*列表)/.test(request);
  const hasStagedFlow = /(?:第\s*[一二三四五六七八九十\d]+\s*步|分阶段|分步|上一步|下一步|预览(?:复核|确认))/.test(request);
  const hasSeparateFormFlow = /(?:(?:新增|新建|编辑|配置).{0,24}(?:新标签页|新\s*tab|独立页|独立页面|全页|分阶段|分步|步骤)|点击.{0,24}(?:新增|新建|编辑).{0,24}(?:进入|打开).{0,24}(?:配置|表单|页面))/i.test(request);
  const hasResultFlow = /(?:提交成功|成功反馈|成功页|结果页|返回(?:来源|列表)|继续新增)/.test(request);

  if (hasListContract) add('query-list');
  if (hasStagedFlow) add(intentById(contract, 'wizard') ? 'wizard' : 'form');
  else if (hasSeparateFormFlow && hasListContract) add(intentById(contract, 'form') ? 'form' : 'simple-page-form');
  if (hasResultFlow) add('result');
  return detected;
}

function choosePrimaryIntent(ranked, composed) {
  const staged = composed.find((intent) => intent.id === 'wizard');
  if (staged) return staged;
  return ranked[0]?.intent || composed[0] || null;
}

function unique(paths) {
  return [...new Set(paths)];
}

function readContract(route) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, route.contract), 'utf8'));
}

function existingMarkdown(paths) {
  const invalid = paths.filter((resource) => path.extname(resource) !== '.md' || !fs.existsSync(path.join(ROOT, resource)));
  if (invalid.length) throw new Error(`Invalid Markdown resources: ${invalid.join(', ')}`);
  return paths;
}

export function resolveResources(rawRequest, stage) {
  if (!STAGES.has(stage)) return { status: 'error', message: `Unsupported stage: ${stage || '<empty>'}` };

  const routed = routeBusiness(rawRequest);
  const route = routed.status === 'routed' ? { ...routed, request: rawRequest } : routed;
  if (route.status !== 'routed') return route;
  if (stage === 'route') return { ...route, resources: existingMarkdown([route.domain]) };

  const selection = selectIntent(route, rawRequest);
  if (selection.status !== 'resolved') return selection;
  if (stage === 'all') return resolveAll(route, selection);

  return resolveStage(route, selection, stage);
}

function selectIntent(route, rawRequest) {
  const contract = readContract(route);
  const request = normalize(rawRequest);
  const ranked = contract.intents
    .map((intent) => scoreIntent(request, intent))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.firstMatchIndex - b.firstMatchIndex);
  const composed = detectComposedIntents(rawRequest, contract);
  const selected = choosePrimaryIntent(ranked, composed);

  if (!selected) {
    return {
      status: 'clarify',
      module: route.module,
      question: `已识别为${route.name}，但还无法确定页面类型，请补充主要页面意图。`,
      candidates: contract.intents.map(({ id, pageType }) => ({ id, pageType }))
    };
  }

  const intents = unique([
    selected,
    ...composed
  ].map((intent) => intent.id)).map((id) => intentById(contract, id)).filter(Boolean);
  const selectedRank = ranked.find(({ intent }) => intent.id === selected.id);
  const intentMatches = Object.fromEntries(ranked.map(({ intent, matches }) => [intent.id, matches]));
  return {
    status: 'resolved',
    selected,
    intents,
    matches: selectedRank?.matches || [],
    intentMatches,
    composition: intents.length > 1
  };
}

function resolveStage(route, selection, stage) {
  const selected = selection.selected;
  const selectedIntents = selection.intents || [selected];
  const contract = readContract(route);
  const adapter = contract.adapter;
  if (!adapter?.resources) throw new Error(`${route.module}: domain contract is missing adapter.resources`);

  let resources = [...(adapter.resources[stage] || [])];
  const templateConfig = adapter.template;
  const selectedTemplateId = selected.templateId || selected.template || '';
  let selectedTemplates = [];
  if (templateConfig?.stages?.includes(stage)) {
    selectedTemplates = [
      ...(templateConfig.framework || []),
      selected.template,
      ...(templateConfig.supportingRules || [])
        .filter((rule) => (rule.signals || []).some((signal) => normalize(route.request).includes(normalize(signal))))
        .flatMap((rule) => rule.templates || [])
    ].filter(Boolean);
    resources.push(...selectedTemplates.map((template) => path.posix.join(templateConfig.directory, template)));
  }

  resources = existingMarkdown(unique(resources));
  const commandTemplates = adapter.commands?.[stage] || {};
  const businessTemplates = selectedTemplates.filter((template) => !(templateConfig?.framework || []).includes(template));
  const replacements = {
    '{module}': route.module,
    '{family}': selected.executionFamily || selected.id,
    '{template}': selectedTemplateId,
    '{templates}': selectedTemplates.length ? unique(businessTemplates).join(',') : selectedTemplateId
  };
  const commands = Object.fromEntries(Object.entries(commandTemplates).map(([name, command]) => {
    const resolved = Object.entries(replacements).reduce((value, [token, replacement]) => value.replaceAll(token, replacement), command);
    return [name, resolved.trim()];
  }));

  const execution = resolveExecution(rootPath(route), adapter.execution, selected, selectedTemplateId);
  if (execution && ['template', 'generate', 'review'].includes(stage)) {
    resources.push(...existingMarkdown(execution.resources));
    const relatedFamilyResources = unique(selectedIntents
      .map((intent) => intent.executionFamily || intent.id)
      .filter((family) => family !== execution.family)
      .map((family) => adapter.execution?.familyContexts?.[family])
      .filter(Boolean));
    resources.push(...existingMarkdown(relatedFamilyResources));
  }

  const families = unique(selectedIntents.map((intent) => intent.executionFamily || intent.id));

  return {
    status: 'resolved',
    module: route.module,
    intent: selected.id,
    pageType: selected.pageType,
    template: selectedTemplateId || null,
    ruleTemplate: selectedTemplateId || null,
    implementationMode: contract.implementationMode,
    assumption: route.assumption,
    matches: selection.matches,
    intents: selectedIntents.map(({ id, pageType, executionFamily, templateId }) => ({
      id,
      pageType,
      family: executionFamily || id,
      template: templateId || null,
      matches: selection.intentMatches?.[id] || []
    })),
    families,
    composition: selection.composition,
    resources: unique(resources),
    commands: execution && stage === 'generate'
      ? {
          prepare: commands.prepare,
          preflight: commands.preflight,
          scaffold: execution.scaffoldCommand,
          coverage: commands.coverage,
          check: execution.checkCommand,
          build: execution.buildCommand,
          verify: execution.verifyCommand
        }
      : commands,
    execution: execution ? { ...execution, relatedFamilies: families.filter((family) => family !== execution.family) } : execution
  };
}

function rootPath(route) {
  return route;
}

function resolveExecution(_route, executionConfig, selected, templateId) {
  if (!executionConfig) return null;
  const policyPath = path.join(ROOT, executionConfig.policy);
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (executionConfig.templateRegistry) {
    const registryPath = path.join(ROOT, executionConfig.templateRegistry);
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (!(registry.templates || []).some((template) => template.id === templateId)) {
      throw new Error(`${templateId || '<empty>'}: rule template is missing from ${executionConfig.templateRegistry}`);
    }
  }
  const familyId = selected.executionFamily || selected.id;
  const family = (policy.families || []).find((entry) => entry.id === familyId);
  if (!family) throw new Error(`${familyId}: execution family is missing from ${executionConfig.policy}`);
  const mode = family.intentModes?.[selected.id] || family.mode;
  const replace = (command) => String(command || '')
    .replaceAll('{family}', familyId)
    .replaceAll('{template}', templateId || '');
  return {
    system: policy.system,
    policyVersion: policy.policyVersion,
    family: familyId,
    availability: family.availability,
    mode,
    renderable: Boolean(executionConfig.familyContexts?.[familyId]),
    capabilities: family.capabilities || [],
    ruleRefs: family.ruleRefs || [],
    schema: executionConfig.schema,
    releaseManifest: executionConfig.releaseManifest,
    resources: [executionConfig.coreContext, executionConfig.contextIndex, executionConfig.familyContexts?.[familyId]].filter(Boolean),
    scaffoldCommand: replace(executionConfig.scaffoldCommand),
    checkCommand: replace(executionConfig.checkCommand),
    buildCommand: replace(executionConfig.buildCommand),
    verifyCommand: replace(executionConfig.verifyCommand)
  };
}

function resolveAll(route, selection) {
  const stages = {};
  ['requirement', 'design', 'template', 'generate', 'review'].forEach((stage) => {
    stages[stage] = resolveStage(route, selection, stage);
  });
  return {
    status: 'resolved',
    route,
    intent: selection.selected.id,
    pageType: selection.selected.pageType,
    template: selection.selected.templateId || selection.selected.template || null,
    stages,
    resources: unique(Object.values(stages).flatMap((stage) => stage.resources)),
    commands: stages.generate.commands
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = resolveResources(readArg('--request'), readArg('--stage'));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === 'resolved' || (readArg('--stage') === 'route' && result.status === 'routed') ? 0 : 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
