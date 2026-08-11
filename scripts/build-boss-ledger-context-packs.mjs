#!/usr/bin/env node
// rule-assertion: design.template-compilation
// rule-assertion: visual.theme-compilation
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const checkOnly = process.argv.includes('--check');
const rulesRoot = resolve(root, 'modules/boss-ledger/director-rules');
const registryPath = resolve(root, 'modules/boss-ledger/execution/rule-template-registry.json');
const policyPath = resolve(root, 'modules/boss-ledger/execution/generation-policy.json');
const contextRoot = resolve(root, 'modules/boss-ledger/execution/context-packs');
const themeRoot = resolve(root, 'modules/boss-ledger/execution/theme');
const ruleFiles = [
  '01-visual-constitution.md',
  '02-template-application-rules.md',
  '03-interaction-acceptance-rules.md'
];
function readText(file) {
  return readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function ruleCatalog() {
  const entries = new Map();
  ruleFiles.forEach((file) => {
    const source = readText(resolve(rulesRoot, file));
    const matcher = /^\*\*(BL-(?:VIS|TPL|INT)-\d{3})\*\*\s+(.+)$/gm;
    for (const match of source.matchAll(matcher)) entries.set(match[1], match[2].trim());
  });
  return entries;
}

function section(source, heading) {
  const start = source.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`Missing Director Rule section: ${heading}`);
  const next = source.indexOf('\n## ', start + heading.length + 3);
  return source.slice(start, next < 0 ? source.length : next);
}

function tableRows(source, heading) {
  const lines = section(source, heading)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  if (lines.length < 3) throw new Error(`${heading} must contain a Markdown table.`);
  return lines.slice(2).map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()));
}

function codeValue(value, label) {
  const match = String(value).match(/`([^`]+)`/);
  if (!match) throw new Error(`${label} must use an inline code value.`);
  return match[1].trim();
}

function ruleIds(value) {
  return [...new Set(String(value).match(/BL-(?:VIS|TPL|INT)-\d{3}/g) || [])];
}

function buildRegistry(templateRules) {
  const templates = tableRows(templateRules, '可编译逻辑模板目录').map((row) => {
    if (row.length !== 5) throw new Error('每个逻辑模板必须包含模板 ID、页面族、页面方案、选择条件和规则引用。');
    const [idCell, familyCell, title, selection, rules] = row;
    const id = codeValue(idCell, '模板 ID');
    const family = codeValue(familyCell, `${id} 页面族`);
    const ids = ruleIds(rules);
    if (!title || !selection || !ids.length) throw new Error(`${id} 缺少页面方案、选择条件或规则引用。`);
    return { id, family, title, selection, ruleIds: ids };
  });
  const duplicate = templates.find((template, index) => templates.findIndex((candidate) => candidate.id === template.id) !== index);
  if (duplicate) throw new Error(`重复的逻辑模板 ID: ${duplicate.id}`);

  const coreRows = tableRows(templateRules, '可编译公共规则包');
  const core = coreRows.find((row) => codeValue(row[0], '规则包') === 'core');
  if (!core || core.length !== 2) throw new Error('可编译公共规则包必须包含唯一的 core 行。');
  const coreRuleIds = ruleIds(core[1]);
  if (!coreRuleIds.length) throw new Error('core 规则包缺少规则引用。');

  const sourceHash = createHash('sha256').update(templateRules).digest('hex').slice(0, 12);
  return {
    schemaVersion: 1,
    system: 'boss-ledger',
    source: 'modules/boss-ledger/director-rules/02-template-application-rules.md',
    templateVersion: `rules-${sourceHash}`,
    core: { title: '固定运行边界', ruleIds: coreRuleIds },
    templates
  };
}

function buildTheme(visualRules) {
  const tokens = Object.fromEntries(tableRows(visualRules, '可编译主题 Token').map((row) => {
    if (row.length !== 3) throw new Error('每个主题 Token 必须包含 Token、值和用途。');
    return [codeValue(row[0], '主题 Token'), codeValue(row[1], `${codeValue(row[0], '主题 Token')} 值`)];
  }));
  const required = [
    'colorPrimary', 'colorPrimaryHover', 'colorPrimaryActive', 'colorLink', 'colorLinkHover',
    'colorPageBackground', 'colorContainer', 'colorTopInfoBar', 'colorSelectedBackground',
    'colorStatisticBackground', 'colorToolBackground', 'colorBorder', 'colorDivider',
    'colorTabDivider', 'colorSiderDivider', 'colorTabInactiveBackground', 'colorTextPrimary',
    'colorTextSecondary', 'colorTextTertiary', 'colorTextDisabled', 'colorShellText',
    'colorShellSecondary', 'colorShellMuted', 'colorFooterText', 'fontFamily', 'fontSize',
    'borderRadius', 'cardBorderRadius', 'modalBorderRadius', 'drawerBorderRadius', 'navigationShadow'
  ];
  const missing = required.filter((key) => !tokens[key]);
  if (missing.length) throw new Error(`视觉宪法缺少主题 Token: ${missing.join(', ')}`);
  const sourceHash = createHash('sha256').update(visualRules).digest('hex').slice(0, 12);
  return {
    schemaVersion: 1,
    system: 'boss-ledger',
    source: 'modules/boss-ledger/director-rules/01-visual-constitution.md',
    themeVersion: `rules-${sourceHash}`,
    tokens
  };
}

function themeCss(theme) {
  const tokens = theme.tokens;
  const variables = {
    '--boss-primary': tokens.colorPrimary,
    '--boss-primary-hover': tokens.colorPrimaryHover,
    '--boss-primary-active': tokens.colorPrimaryActive,
    '--boss-link': tokens.colorLink,
    '--boss-link-hover': tokens.colorLinkHover,
    '--boss-page-bg': tokens.colorPageBackground,
    '--boss-container': tokens.colorContainer,
    '--boss-topbar': tokens.colorTopInfoBar,
    '--boss-selected-bg': tokens.colorSelectedBackground,
    '--boss-statistic-bg': tokens.colorStatisticBackground,
    '--boss-tool-bg': tokens.colorToolBackground,
    '--boss-border': tokens.colorBorder,
    '--boss-divider': tokens.colorDivider,
    '--boss-tab-divider': tokens.colorTabDivider,
    '--boss-sider-divider': tokens.colorSiderDivider,
    '--boss-tab-inactive-bg': tokens.colorTabInactiveBackground,
    '--boss-text': tokens.colorShellText,
    '--boss-secondary': tokens.colorShellSecondary,
    '--boss-tertiary': tokens.colorTextTertiary,
    '--boss-disabled': tokens.colorTextDisabled,
    '--boss-shell-muted': tokens.colorShellMuted,
    '--boss-footer': tokens.colorFooterText,
    '--boss-font-family': tokens.fontFamily,
    '--boss-font-size': `${tokens.fontSize}px`,
    '--boss-radius-control': `${tokens.borderRadius}px`,
    '--boss-card-radius': tokens.cardBorderRadius,
    '--boss-modal-radius': tokens.modalBorderRadius,
    '--boss-drawer-radius': `${tokens.drawerBorderRadius}px`,
    '--boss-navigation-shadow': tokens.navigationShadow
  };
  return `/* Generated from director-rules/01-visual-constitution.md. Do not edit. */\n:root {\n${Object.entries(variables).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}\n`;
}

function themeRuntime(theme) {
  const tokens = theme.tokens;
  const antTokens = {
    colorPrimary: tokens.colorPrimary,
    colorPrimaryHover: tokens.colorPrimaryHover,
    colorPrimaryActive: tokens.colorPrimaryActive,
    colorLink: tokens.colorLink,
    colorLinkHover: tokens.colorLinkHover,
    colorBgLayout: tokens.colorPageBackground,
    colorBgContainer: tokens.colorContainer,
    colorBorder: tokens.colorBorder,
    colorText: tokens.colorTextPrimary,
    colorTextSecondary: tokens.colorTextSecondary,
    colorSuccess: tokens.colorSuccess,
    colorWarning: tokens.colorWarning,
    colorError: tokens.colorError,
    colorInfo: tokens.colorInfo,
    borderRadius: Number(tokens.borderRadius),
    fontFamily: tokens.fontFamily,
    fontSize: Number(tokens.fontSize)
  };
  return `/* Generated from director-rules/01-visual-constitution.md. Do not edit. */\n(function installBossLedgerTheme(global) {\n  global.BossLedgerTheme = Object.freeze(${JSON.stringify({ version: theme.themeVersion, tokens, antTokens }, null, 2)});\n})(window);\n`;
}

function ruleLines(ids, rules) {
  return ids.map((id) => {
    const text = rules.get(id);
    if (!text) throw new Error(`Unknown Director Rule ID: ${id}`);
    return `- \`${id}\` ${text}`;
  });
}

function policyFamily(policy, id) {
  return (policy.families || []).find((family) => family.id === id);
}

function familyLabel(id) {
  return {
    list: '查询列表',
    form: '表单',
    detail: '详情',
    result: '结果',
    dashboard: '首页',
    'empty-state': '页面状态'
  }[id] || id;
}

function packFile(id) {
  return id === 'empty-state' ? 'state.md' : `${id}.md`;
}

function familyPack(id, templates, policy, rules) {
  const current = policyFamily(policy, id);
  const availability = current ? `${current.availability} / ${current.mode}` : 'not registered';
  const allowed = current?.capabilities?.length ? current.capabilities.map((capability) => `\`${capability}\``).join('、') : '当前没有可生成能力';
  return `# 老板管账${familyLabel(id)}规则包

> 由导演规则编译。请勿直接编辑。

## 当前策略

- 页面族：\`${id}\`
- 状态：${availability}
- 已开放能力：${allowed}

## 可选方案

${templates.map((template) => `### ${template.title}\n\n- 规则模板：\`${template.id}\`\n- 适用条件：${template.selection}\n- 规则：\n${ruleLines(template.ruleIds, rules).join('\n')}`).join('\n\n')}
`;
}

function corePack(registry, rules) {
  return `# 老板管账核心规则包

> 由导演规则编译。请勿直接编辑。

${ruleLines(registry.core.ruleIds, rules).join('\n')}

## 交付边界

- 在 Page Spec 和 \`page-design.md\` 中记录已选规则模板、运行模式、能力、排除的候选方案、假设和 Rule ID。
- 只能使用生成策略当前允许的能力。
- 将 Loading、空数据、错误、权限、校验、成功和危险操作视为显式业务状态。
`;
}

function indexPack(registry, policy) {
  const rows = registry.templates.map((template) => {
    const family = policyFamily(policy, template.family);
    const status = family ? `${family.availability} / ${family.mode}` : 'not registered';
    return `| ${template.title} | \`${template.id}\` | \`${template.family}\` | ${status} | ${template.selection} |`;
  });
  return `# 老板管账规则模板索引

> 由导演规则和生成策略自动生成。请勿直接编辑。

规则模板是选择规则，不是设计截图或布局实现。每个页面需求读取核心规则包和恰好一个所选页面族规则包。

| 页面方案 | 规则模板 ID | 页面族 | 当前状态 | 选择条件 |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

## 选择边界

- 每个页面需求选择一个主规则模板。
- 结果或页面状态通常是所选主页面族中的流转或状态，不是第二个页面入口。
- 生成策略是可用性和已批准组合的最终权威。
`;
}

function contextOutputs(registry, policy, rules) {
  const outputs = new Map();
  outputs.set('core.md', corePack(registry, rules));
  outputs.set('index.md', indexPack(registry, policy));
  const byFamily = new Map();
  registry.templates.forEach((template) => {
    const templates = byFamily.get(template.family) || [];
    templates.push(template);
    byFamily.set(template.family, templates);
  });
  for (const [family, templates] of byFamily) outputs.set(packFile(family), familyPack(family, templates, policy, rules));
  return outputs;
}

function writeGenerated(file, content, stale) {
  const normalized = `${content.trim()}\n`;
  if (!existsSync(file) || readText(file) !== normalized) stale.push(file);
  if (!checkOnly) writeFileSync(file, normalized);
}

try {
  const visualRules = readText(resolve(rulesRoot, '01-visual-constitution.md'));
  const templateRules = readText(resolve(rulesRoot, '02-template-application-rules.md'));
  const rules = ruleCatalog();
  const registry = buildRegistry(templateRules);
  const theme = buildTheme(visualRules);
  const policy = readJson(policyPath);
  if (policy.system !== 'boss-ledger') throw new Error('Boss Ledger generation policy must declare system=boss-ledger.');
  [...registry.core.ruleIds, ...registry.templates.flatMap((template) => template.ruleIds)].forEach((id) => {
    if (!rules.has(id)) throw new Error(`Generated template registry references unknown Director Rule ID: ${id}`);
  });

  const stale = [];
  if (!checkOnly) mkdirSync(themeRoot, { recursive: true });
  writeGenerated(registryPath, JSON.stringify(registry, null, 2), stale);
  writeGenerated(resolve(themeRoot, 'theme-tokens.json'), JSON.stringify(theme, null, 2), stale);
  writeGenerated(resolve(themeRoot, 'theme.css'), themeCss(theme), stale);
  writeGenerated(resolve(themeRoot, 'theme.js'), themeRuntime(theme), stale);
  for (const [name, content] of contextOutputs(registry, policy, rules)) {
    writeGenerated(resolve(contextRoot, name), content, stale);
  }
  if (checkOnly && stale.length) {
    throw new Error(`Generated Director artifacts are stale: ${stale.map((file) => file.replace(`${root}/`, '')).join(', ')}. Run node scripts/build-boss-ledger-context-packs.mjs.`);
  }
  console.log(`boss-ledger-director-artifacts: ${checkOnly ? 'pass' : 'generated'}`);
  console.log(`- templates: ${registry.templates.length}`);
  console.log(`- context packs: ${contextOutputs(registry, policy, rules).size}`);
  console.log('- theme artifacts: 3');
} catch (error) {
  console.error(`boss-ledger-director-artifacts: failed\n- ${error.message}`);
  process.exit(1);
}
