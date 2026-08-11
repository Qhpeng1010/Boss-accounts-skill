import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const START_MARKER = '<!-- yeepay:page-design-evidence:start -->';
const END_MARKER = '<!-- yeepay:page-design-evidence:end -->';
const REJECTED_CANDIDATES = {
  list: ['独立表单方案', '独立详情方案', '结果反馈方案', '经营概览方案'],
  form: ['纯查询列表方案', '独立详情方案', '经营概览方案'],
  detail: ['查询列表方案', '表单方案', '结果反馈方案', '经营概览方案'],
  result: ['查询列表方案', '表单方案', '独立详情方案', '经营概览方案'],
  dashboard: ['查询列表方案', '表单方案', '独立详情方案', '结果反馈方案'],
  'empty-state': ['查询列表方案', '表单方案', '独立详情方案', '经营概览方案']
};

export function pageDesignEvidence(spec) {
  return {
    schemaVersion: 1,
    family: spec.metadata.family,
    templateId: spec.metadata.templateId.replace(/\.md$/, ''),
    executionMode: spec.metadata.executionMode,
    validatedCombinations: spec.metadata.validatedCombinations || [],
    selectionReason: spec.metadata.selectionReason,
    rejectedCandidates: REJECTED_CANDIDATES[spec.metadata.family] || ['与当前业务主任务不一致的其他页面方案'],
    capabilities: spec.content.capabilities,
    assumptions: spec.metadata.assumptions,
    ruleRefs: spec.metadata.ruleRefs
  };
}

export function renderPageDesignEvidence(spec) {
  return `${START_MARKER}\n## 结构化交付证据（构建自动同步）\n\n\`\`\`json\n${JSON.stringify(pageDesignEvidence(spec), null, 2)}\n\`\`\`\n${END_MARKER}`;
}

export function syncPageDesignEvidence(designPath, spec) {
  if (!existsSync(designPath)) {
    throw new Error('page-design.md is missing; write the business page design before build.');
  }
  const source = readFileSync(designPath, 'utf8');
  if (!source.trim()) throw new Error('page-design.md is empty; write the business page design before build.');

  const markerPattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}\\n?`, 'g');
  const authoredDesign = source.replace(markerPattern, '').trimEnd();
  const next = `${authoredDesign}\n\n${renderPageDesignEvidence(spec)}\n`;
  if (next !== source) writeFileSync(designPath, next);
  return { changed: next !== source, evidence: pageDesignEvidence(spec) };
}
