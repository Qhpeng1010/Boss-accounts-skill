#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileStructuredWizard, parseStructuredWizardRequest } from './lib/boss-ledger-wizard-recipe.mjs';

const root = process.cwd();
const request = '做一个老板管账的页面，可以点击新增分账规则进行配置，分账规则页面分为3步，带交互，可上一步下一步最后提交。第一步：规则名称、规则类型、规则渠道、渠道下级、生效日期。第二步：分账方、手续费、预计到账金额、预计扣账金额。第三步：预览页面。落地页展示完成，可以继续新增，也可以返回列表查看。';
const changeId = `20260730-wizard-recipe-test-${randomBytes(4).toString('hex')}`;
const changeArg = `changes/${changeId}`;
const changeDir = resolve(root, changeArg);

try {
  const parsed = parseStructuredWizardRequest(request);
  if (parsed.steps.length !== 3 || !parsed.steps[2].review || !parsed.returnsToSource || !parsed.continueCreate) {
    throw new Error('Structured wizard request did not retain its workflow shape and result actions.');
  }
  const compiled = compileStructuredWizard({ rawRequest: request, changeId });
  const firstLabels = compiled.form.steps[0].fields.map((field) => field.label);
  const secondLabels = compiled.form.steps[1].fields.map((field) => field.label);
  if (JSON.stringify(firstLabels) !== JSON.stringify(['规则名称', '规则类型', '规则渠道', '渠道下级', '生效日期'])) {
    throw new Error('First-step fields were not compiled from the natural-language field list.');
  }
  if (JSON.stringify(secondLabels) !== JSON.stringify(['分账方', '手续费', '预计到账金额', '预计扣账金额'])) {
    throw new Error('Second-step fields were not compiled from the natural-language field list.');
  }
  if (compiled.form.steps[0].fields[4].control !== 'date' || compiled.form.steps[1].fields.slice(1).some((field) => field.control !== 'number')) {
    throw new Error('Field control inference did not apply the recipe catalog.');
  }
  const result = spawnSync(process.execPath, [resolve(root, 'scripts/compile-boss-ledger-wizard-recipe.mjs'), '--request', request, '--change', changeArg], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Recipe compiler failed.');
  if (!existsSync(resolve(changeDir, 'preview.html')) || !existsSync(resolve(changeDir, 'review.md'))) {
    throw new Error('Recipe compiler did not produce the preview and human review record.');
  }
  if (!readFileSync(resolve(changeDir, 'review.md'), 'utf8').includes('静态预检已通过')) {
    throw new Error('Recipe compiler did not record the completed static preflight for human review.');
  }
  const spec = JSON.parse(readFileSync(resolve(changeDir, 'page-spec.json'), 'utf8'));
  if (spec.metadata.validatedCombinations[0] !== 'form.steps-return-source') {
    throw new Error('Recipe compiler did not select the verified return-source combination.');
  }
  console.log('boss-ledger-wizard-recipe: pass');
} catch (error) {
  console.error(`boss-ledger-wizard-recipe: failed\n- ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(changeDir, { recursive: true, force: true });
}
