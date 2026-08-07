#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveResources } from './resolve-resources.mjs';

const root = process.cwd();
const changesRoot = resolve(root, 'changes');
const changeDir = mkdtempSync(resolve(changesRoot, '.fast-path-test-'));
const changeArg = relative(root, changeDir);
const ruleTemplate = 'list.regular';

function run(args) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/prepare-boss-ledger-page-spec.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Fast preparation failed.');
}

try {
  const skillSource = readFileSync(resolve(root, 'SKILL.md'), 'utf8');
  const agentSource = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
  if (!skillSource.includes('不得出现 `form.*`、`list.*`、`detail.*`')) {
    throw new Error('The business-facing delivery contract must forbid implementation template IDs.');
  }
  if (!skillSource.includes('页面方案只决策一次')) {
    throw new Error('The Boss Ledger fast path must require a single page-solution decision.');
  }
  if (!agentSource.includes('先读取 `SKILL.md`') || !agentSource.includes('只运行一次统一入口') || !agentSource.includes('不得再次路由')) {
    throw new Error('Project instructions must use the unified single-route generation entry.');
  }
  if (!agentSource.includes('通用技能或工具只能辅助执行已路由的方案')) {
    throw new Error('Project instructions must prevent generic skills from changing the routed Boss Ledger solution.');
  }
  const stagedRuleRequest = '做一个老板管账的页面。可以点击新增分账规则进行配置，分账规则页面分为3步，带交互，可上一步下一步最后提交。第一步：规则名称、规则类型、规则渠道、渠道下级、生效日期。第二步：分账方、手续费、预计到账金额、预计扣账金额。第三步：预览页面。落地页展示完成，可以继续新增，也可以返回列表查看。';
  const stagedRouted = resolveResources(stagedRuleRequest, 'generate');
  const expectedWorkflowResources = [
    'modules/boss-ledger/execution/context-packs/core.md',
    'modules/boss-ledger/execution/context-packs/index.md',
    'modules/boss-ledger/execution/context-packs/form.md',
    'modules/boss-ledger/execution/context-packs/list.md',
    'modules/boss-ledger/execution/context-packs/result.md'
  ];
  if (stagedRouted.intent !== 'wizard' || stagedRouted.template !== 'form.staged-flow') {
    throw new Error('A three-step rule configuration request did not resolve to the staged workflow.');
  }
  if (JSON.stringify(stagedRouted.resources) !== JSON.stringify(expectedWorkflowResources)) {
    throw new Error('A staged workflow request did not load the form, source-list, and result rule packs in one route.');
  }
  if (stagedRouted.matches.includes('列表') || stagedRouted.execution?.family !== 'form') {
    throw new Error('A return-to-list follow-up incorrectly overrode the staged workflow intent.');
  }
  const routed = resolveResources('创建老板管账的运营人员查询商户，支持高级查询、新增抽屉和详情抽屉', 'generate');
  if (routed.intent !== 'query-list' || !routed.commands?.prepare?.includes('prepare-boss-ledger-page-spec.mjs')) {
    throw new Error('A query-list request with a detail Drawer did not resolve to the fast preparation path.');
  }
  const statisticsRequest = '创建老板管账的结算单查询列表页。列表展示结算单号、商户名称、应付金额、实打款金额和结算状态。页面顶部展示四项统计：本期结算笔数 128 笔、应付总金额 2865400.00 元、实打款总金额 2798600.00 元、打款失败 3 笔。';
  const statisticsRouted = resolveResources(statisticsRequest, 'generate');
  if (statisticsRouted.intent !== 'card-summary-list' || statisticsRouted.template !== 'list.card-summary') {
    throw new Error('A list request with four top-level statistics did not resolve to the card-summary rule combination.');
  }
  if (routed.resources.some((resource) => resource.startsWith('modules/shared/') && resource !== 'modules/shared/product.md')) {
    throw new Error('Boss Ledger generation must not load shared design, template, frontend, or quality rules.');
  }
  if (!routed.commands?.scaffold?.includes('scaffold-boss-ledger-page-spec.mjs') || JSON.stringify(routed).includes('legacy')) {
    throw new Error('A Page Spec request exposed a retired compatibility path.');
  }
  const formRouted = resolveResources('创建老板管账的登记渠道联系人基础表单页', 'generate');
  if (formRouted.execution?.mode !== 'shadow' || !formRouted.commands?.scaffold?.includes('scaffold-boss-ledger-page-spec.mjs')) {
    throw new Error('A shadow Page Spec form did not resolve to the fixed Page Spec path.');
  }
  if (formRouted.resources.some((resource) => resource.startsWith('modules/shared/') && resource !== 'modules/shared/product.md') || JSON.stringify(formRouted).includes('legacy')) {
    throw new Error('A shadow Page Spec form loaded a retired compatibility path.');
  }
  const dashboardRouted = resolveResources('创建老板管账经营概览仪表盘', 'generate');
  if (dashboardRouted.execution?.availability !== 'available'
    || dashboardRouted.execution?.mode !== 'page-spec-default'
    || !dashboardRouted.commands?.prepare?.includes('prepare-boss-ledger-page-spec.mjs')
    || JSON.stringify(dashboardRouted).includes('legacy')) {
    throw new Error('A Dashboard page did not resolve to the current Page Spec path.');
  }
  // mkdtemp creates the private test directory; remove it so the production command owns creation.
  rmSync(changeDir, { recursive: true, force: true });
  run([changeArg, ruleTemplate]);
  const statePath = resolve(changeDir, 'generation-state.json');
  if (!existsSync(statePath) || !existsSync(resolve(changeDir, 'rules-read.md'))) throw new Error('Fast preparation did not create its recovery evidence.');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (state.status !== 'ready-for-page-spec') throw new Error(`Expected ready-for-page-spec, received ${state.status}.`);
  if (!['generation-policy', 'release-manifest', 'context-packs', 'rules-read'].every((name) => state.checkpoints.some((checkpoint) => checkpoint.name === name && checkpoint.status === 'pass'))) {
    throw new Error('Fast preparation did not record all required checkpoints.');
  }
  const checkpointCount = state.checkpoints.length;
  run([changeArg, ruleTemplate, '--resume']);
  const resumed = JSON.parse(readFileSync(statePath, 'utf8'));
  if (resumed.checkpoints.length !== checkpointCount) throw new Error('Resuming a prepared Change repeated completed preflight work.');
  console.log('boss-ledger-fast-path: pass');
} catch (error) {
  console.error(`boss-ledger-fast-path: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(changeDir, { recursive: true, force: true });
}
