#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pageDesignEvidence, syncPageDesignEvidence } from './lib/boss-ledger-page-design-evidence.mjs';

const directory = mkdtempSync(resolve(tmpdir(), 'boss-ledger-design-evidence-'));
const designPath = resolve(directory, 'page-design.md');
const spec = {
  metadata: {
    family: 'list',
    templateId: 'list.regular',
    executionMode: 'page-spec-default',
    selectionReason: '主要任务是查询和处理记录。',
    assumptions: ['默认按最近更新时间倒序展示。'],
    ruleRefs: ['BL-TPL-001']
  },
  content: { capabilities: ['query.basic', 'table.basic'] }
};

try {
  writeFileSync(designPath, '# 规则管理页面设计\n\n页面采用查询区和结果表格。\n');
  const first = syncPageDesignEvidence(designPath, spec);
  assert.equal(first.changed, true);
  assert.deepEqual(first.evidence, pageDesignEvidence(spec));
  const once = readFileSync(designPath, 'utf8');
  assert.match(once, /结构化交付证据（构建自动同步）/);
  assert.match(once, /"selectionReason": "主要任务是查询和处理记录。"/);

  const second = syncPageDesignEvidence(designPath, spec);
  assert.equal(second.changed, false);
  assert.equal(readFileSync(designPath, 'utf8'), once);

  const updated = {
    ...spec,
    metadata: { ...spec.metadata, selectionReason: '主要任务是筛选并维护规则。' }
  };
  syncPageDesignEvidence(designPath, updated);
  const final = readFileSync(designPath, 'utf8');
  assert.equal((final.match(/yeepay:page-design-evidence:start/g) || []).length, 1);
  assert.doesNotMatch(final, /主要任务是查询和处理记录。/);
  assert.match(final, /主要任务是筛选并维护规则。/);
  console.log('boss-ledger-page-design-evidence: pass');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
