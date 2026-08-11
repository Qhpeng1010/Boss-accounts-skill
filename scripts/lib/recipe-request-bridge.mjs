/**
 * Normalize common business wording before a parameterized recipe parses it.
 * This is intentionally lexical and conservative: it may expose an existing
 * recipe, but it never invents fields, actions, or unsupported capabilities.
 */
export function normalizeRecipeRequest(rawRequest) {
  return String(rawRequest || '')
    // A line break normally separates requirement sections, not fields in one section.
    .replace(/\\[rn]/g, '；')
    .replace(/\r?\n/g, '；')
    .replace(/\s*；+\s*/g, '；')
    .replace(/\s+/g, ' ')
    .replace(/(?:检索|搜索|过滤|筛查)条件/g, '查询条件')
    .replace(/(?:检索|搜索|过滤|筛查)字段/g, '查询字段')
    .replace(/(^|[，,、；])条件(?=[：:])/g, '$1查询条件')
    .replace(/(?:表格|结果|返回)字段/g, '列表字段')
    .replace(/(^|[，,、；])(?:table\s*)?列表(?=[：:])/gi, '$1列表字段')
    .replace(/(^|；)列字段/g, '$1列表字段')
    .replace(/(?:展示列|显示列|结果列)/g, '列表字段')
    .replace(/(?:结果|表格)(?:中|里)?(?:展示|显示|列出)/g, '列表展示')
    .replace(/(?:按|根据)([^。；，,]+?)(?:检索|搜索|过滤|筛查)/g, '按$1查询')
    .replace(/(?:打开|进入|查看)记录明细/g, '查看详情')
    .replace(/(?:打开|进入|查看)(?:该|任一|每条)?记录详情/g, '查看详情')
    .replace(/查看详情信息/g, '查看详情')
    .trim();
}

export function bridgeChangedRequest(rawRequest) {
  const normalized = normalizeRecipeRequest(rawRequest);
  return { normalized, changed: normalized !== String(rawRequest || '').trim() };
}
