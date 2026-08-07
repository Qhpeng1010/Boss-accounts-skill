#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { scenarios } from '../modules/boss-ledger/execution/scenarios/capability-scenarios.mjs';
import { validatePageSpec } from './lib/boss-ledger-page-spec.mjs';

const root = process.cwd();
const requested = process.argv.find((arg) => arg.startsWith('--scenario='))?.split('=')[1];
const selected = requested ? scenarios.filter((scenario) => scenario.id === requested) : scenarios;

if (!selected.length) {
  console.error(`Unknown capability scenario: ${requested}`);
  process.exit(2);
}

function run(label, script, args) {
  const result = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${label} failed.`);
}

function pageDesign(spec, scenario) {
  const combinations = spec.metadata.validatedCombinations?.length
    ? `- Validated combinations: ${spec.metadata.validatedCombinations.map((id) => `\`${id}\``).join('、')}\n`
    : '';
  const rejected = spec.metadata.family === 'form'
    ? '未选择不满足字段规模或流程依赖的其他表单承载方式。'
    : spec.metadata.family === 'detail'
      ? '未选择会破坏信息边界或上下文的其他详情承载方式。'
      : spec.metadata.family === 'dashboard'
        ? '未选择会引入逐条查询、分页或行操作的列表方案。'
        : '未选择不满足信息层级和操作边界的其他列表组合。';
  return `# Page Design: ${spec.metadata.pageName}

## Routing

- System: Boss Ledger
- Family: \`${spec.metadata.family}\`
    - Rule template: \`${spec.metadata.templateId}\`
- Runtime mode: \`${spec.metadata.executionMode}\`
${combinations}- Selection reason: ${spec.metadata.selectionReason}
- Rejected candidates: ${rejected}
- Capabilities: ${spec.content.capabilities.join('、')}

## Assumptions

${spec.metadata.assumptions.map((assumption) => `- ${assumption}`).join('\n')}

## Rule References

${spec.metadata.ruleRefs.map((ruleId) => `- \`${ruleId}\``).join('\n')}

## Scenario

- Capability scenario: ${scenario.id}
- Acceptance focus: ${scenario.title}
`;
}

try {
  for (const scenario of selected) {
    const { spec } = scenario;
    const errors = validatePageSpec(spec, { root });
    if (errors.length) throw new Error(`${scenario.id}: ${errors.join(' | ')}`);
    const changeDir = resolve(root, 'changes', spec.metadata.changeId);
    const changeRelative = `changes/${spec.metadata.changeId}`;
    if (!existsSync(changeDir)) mkdirSync(changeDir, { recursive: true });
    writeFileSync(resolve(changeDir, 'page-spec.json'), `${JSON.stringify(spec, null, 2)}\n`);
    writeFileSync(resolve(changeDir, 'page-design.md'), pageDesign(spec, scenario));
    run(`${scenario.id}: rules`, 'scripts/read-boss-ledger-rules.mjs', [changeRelative, spec.metadata.templateId]);
    run(`${scenario.id}: build`, 'scripts/build-boss-ledger-page-spec.mjs', [`${changeRelative}/page-spec.json`]);
    console.log(`capability-scenario: materialized (${scenario.id})`);
  }
  console.log(`boss-ledger-capability-scenarios: materialized ${selected.length} scenario(s)`);
} catch (error) {
  console.error(`boss-ledger-capability-scenarios: failed\n- ${error.message}`);
  process.exit(1);
}
