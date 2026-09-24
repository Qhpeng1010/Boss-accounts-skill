#!/usr/bin/env node
// rule-assertion: visual.component-integrity
// rule-assertion: visual.layout-density
// rule-assertion: static.preview-source
// rule-assertion: visual.guided-simple-layout
// rule-assertion: interaction.simple-page-actions
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const args = process.argv.slice(2);
const previewArg = args.find((arg) => !arg.startsWith('--'));

if (!previewArg) {
  console.error('Usage: node scripts/validate-boss-ledger-preview.mjs changes/{change-id}/preview.html');
  process.exit(2);
}

const previewPath = isAbsolute(previewArg) ? previewArg : resolve(process.cwd(), previewArg);
const rulesManifestPath = resolve(dirname(previewPath), 'rules-read.md');
const rulesManifest = existsSync(rulesManifestPath) ? readFileSync(rulesManifestPath, 'utf8') : '';
const selectedRuleTemplateMatch = rulesManifest.match(/^- Rule template: `?([^`\n]+)`?$/m);
const selectedTemplates = selectedRuleTemplateMatch ? [selectedRuleTemplateMatch[1].trim()] : [];
const usesTemplate = (templateId) => selectedTemplates.includes(templateId);
const pageSpecPath = resolve(dirname(previewPath), 'page-spec.json');
let pageSpec = null;
try { pageSpec = existsSync(pageSpecPath) ? JSON.parse(readFileSync(pageSpecPath, 'utf8')) : null; } catch { pageSpec = null; }

const result = {
  validate: [],
  charts: [],
  chineseCopy: [],
};

function pass(group, message) {
  result[group].push({ ok: true, message });
}

function fail(group, message) {
  result[group].push({ ok: false, message });
}

function groupStatus(group) {
  return result[group].every((item) => item.ok) ? 'pass' : 'failed';
}

function stripComments(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function hasExactCssClassSelector(selector, className) {
  return new RegExp(`\\.${className}(?=[\\s,{.:#>+~]|$)`).test(selector);
}

function hasNonZeroHorizontalPadding(source, classNames) {
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rulePattern.exec(source))) {
    if (!classNames.some((className) => hasExactCssClassSelector(match[1], className))) continue;
    const declarations = match[2];
    const explicit = declarations.match(/padding-(?:left|right|inline|inline-start|inline-end)\s*:\s*([^;]+)/gi) || [];
    if (explicit.some((declaration) => !/:\s*0(?:px)?(?:\s*!important)?\s*$/i.test(declaration.trim()))) return true;

    const shorthand = declarations.match(/(?:^|;)\s*padding\s*:\s*([^;]+)/i);
    if (!shorthand) continue;
    const values = shorthand[1].replace(/!important/gi, '').trim().split(/\s+/);
    const horizontalValues = values.length === 1 ? [values[0]]
      : values.length === 2 || values.length === 3 ? [values[1]]
        : [values[1], values[3]];
    if (horizontalValues.some((value) => !/^0(?:px)?$/i.test(value))) return true;
  }
  return false;
}

function appendLocalPreviewAssets(html, previewFile) {
  const sources = [html];
  const baseDir = dirname(previewFile);
  const scriptPattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html))) {
    const src = match[1];
    if (/^(?:https?:)?\/\//i.test(src) || src.startsWith('data:') || src.includes('/vendor/') || src.startsWith('./vendor/')) {
      continue;
    }

    const scriptPath = resolve(baseDir, src);
    if (existsSync(scriptPath) && statSync(scriptPath).isFile()) {
      sources.push(readFileSync(scriptPath, 'utf8'));
    }
  }

  const stylesheetPattern = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>|<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi;
  while ((match = stylesheetPattern.exec(html))) {
    const href = match[1] || match[2];
    if (/^(?:https?:)?\/\//i.test(href) || href.startsWith('data:') || href.includes('/vendor/') || href.startsWith('./vendor/')) {
      continue;
    }
    const stylesheetPath = resolve(baseDir, href);
    if (existsSync(stylesheetPath) && statSync(stylesheetPath).isFile()) {
      sources.push(readFileSync(stylesheetPath, 'utf8'));
    }
  }

  return sources.join('\n');
}

function findMatchingBracket(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '/' && next === '/') {
      const lineEnd = source.indexOf('\n', index + 2);
      index = lineEnd === -1 ? source.length : lineEnd;
      continue;
    }

    if (char === '/' && next === '*') {
      const commentEnd = source.indexOf('*/', index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 1;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function extractStepsItemBlocks(source) {
  const blocks = [];
  const stepPattern = /(?:h|React\.createElement)\(\s*Steps\b|<Steps\b/g;
  let match;

  while ((match = stepPattern.exec(source))) {
    const itemsIndex = source.indexOf('items', match.index);
    if (itemsIndex === -1 || itemsIndex - match.index > 5000) continue;

    const openBracket = source.indexOf('[', itemsIndex);
    if (openBracket === -1 || openBracket - itemsIndex > 160) continue;

    const closeBracket = findMatchingBracket(source, openBracket, '[', ']');
    if (closeBracket !== -1) {
      blocks.push(source.slice(openBracket + 1, closeBracket));
    }
  }

  return blocks;
}

function checkSource(html) {
  const source = stripComments(html);
  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasThemeCssValue = (variable, value) => new RegExp(`--${escapeRegExp(variable)}\\s*:\\s*${escapeRegExp(value)}\\s*;`, 'i').test(source);
  const hasThemeRuntimeToken = (token, value) => new RegExp(`["']${escapeRegExp(token)}["']\\s*:\\s*["']${escapeRegExp(value)}["']`, 'i').test(source);

  if (/(react(\.production)?\.min\.js|unpkg\.com\/react|cdn\.jsdelivr\.net\/npm\/react|window\.React\b)/i.test(source)) {
    pass('validate', 'React runtime referenced');
  } else {
    fail('validate', 'React runtime is not referenced');
  }

  if (/(antd(\.min)?\.js|antd-reset\.css|unpkg\.com\/antd|cdn\.jsdelivr\.net\/npm\/antd|window\.antd\b)/i.test(source)) {
    pass('validate', 'Ant Design runtime/style referenced');
  } else {
    fail('validate', 'Ant Design runtime/style is not referenced');
  }

  if (/(ant-design-icons|@ant-design\/icons|icons\.umd|window\.icons\b)/i.test(source)) {
    pass('validate', 'Ant Design Icons referenced');
  } else {
    fail('validate', 'Ant Design Icons are not referenced');
  }

  if (/yeepay-开放平台-DESIGN\.md|YOP\s*\/\s*YeePay Open Platform theme|开放平台-DESIGN/i.test(source)) {
    fail('validate', 'Boss Ledger preview references the YOP theme source');
  } else {
    pass('validate', 'No YOP theme source reference found in Boss Ledger preview');
  }

  const nativeTags = ['input', 'select', 'table', 'button'];
  for (const tag of nativeTags) {
    const pattern = new RegExp(`<\\s*${tag}(\\s|>|/)`);
    if (pattern.test(source)) {
      fail('validate', `Native <${tag}> tag found in preview source`);
    } else {
      pass('validate', `No handwritten native <${tag}> tag in preview source`);
    }
  }

  const englishDefaults = ['Start date', 'End date', 'OK', 'Cancel', 'No data', 'items/page'];
  for (const text of englishDefaults) {
    const pattern = new RegExp(`(^|[^\\w])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`, 'i');
    if (pattern.test(source)) {
      fail('chineseCopy', `English default copy found: ${text}`);
    }
  }
  if (groupStatus('chineseCopy') === 'pass') {
    pass('chineseCopy', 'No blocked English default copy found');
  }

  if (/chart-fallback/i.test(source)) {
    fail('charts', '`chart-fallback` found; formal charts must use Ant Design Charts or the platform chart wrapper');
  } else {
    pass('charts', 'No `chart-fallback` formal chart marker found');
  }

  if (/<\s*img\b[^>]*(class|alt|src)=["'][^"']*logo|<\s*img\b[^>]*(class|alt|src)=[^>]*boss-ledger-logo|React\.createElement\(\s*["']img["'][\s\S]{0,500}(?:boss-shell-logo|data-boss-logo-source)/i.test(source)) {
    pass('validate', 'Logo is rendered through an img/image asset');
  } else {
    fail('validate', 'Boss Ledger logo must use an img/image asset with logo semantics');
  }

  if (/(modules\/boss-ledger\/assets\/boss-logo\.svg|data-boss-logo-source=["']modules\/boss-ledger\/assets\/boss-logo\.svg["'])/i.test(source)) {
    pass('validate', 'Boss Ledger logo references the canonical module asset');
  } else {
    fail('validate', 'Boss Ledger logo must reference or copy the canonical `modules/boss-ledger/assets/boss-logo.svg` asset; custom generated logos are not allowed');
  }

  const contentBorderPattern = /(?:\.(?:content|business|query|filter|table|result|list|stat|summary|chart|workspace|panel|module|card)[^{]{0,80}\{[^}]*border\s*:\s*1px\b)|(?:data-boss-(?:content|query|table|summary|chart)[^>]*style=["'][^"']*border\s*:\s*1px\b)/i;
  if (contentBorderPattern.test(source)) {
    fail('validate', 'Content business module uses `border: 1px`; Boss Ledger modules must be separated by background and 16px spacing');
  } else {
    pass('validate', 'No `border: 1px` detected on content business modules');
  }

  const hasQueryListModules = pageSpec?.metadata?.family === 'list'
    && /\bboss-query-module\b/i.test(source)
    && /\bboss-result-module\b/i.test(source);
  if (hasQueryListModules) {
    const whiteSurface = '(?:#fff(?:fff)?|rgb\\(\\s*255\\s*,\\s*255\\s*,\\s*255\\s*\\)|var\\(--boss-container\\))';
    const sharedWhiteRule = new RegExp(`\\.boss-query-module\\s*,\\s*\\.boss-result-module\\s*\\{[^}]*background\\s*:\\s*${whiteSurface}`, 'i').test(source);
    const queryWhiteRule = new RegExp(`\\.boss-query-module(?:[^,{]*)\\{[^}]*background\\s*:\\s*${whiteSurface}`, 'i').test(source);
    const resultWhiteRule = new RegExp(`\\.boss-result-module(?:[^,{]*)\\{[^}]*background\\s*:\\s*${whiteSurface}`, 'i').test(source);
    if ((sharedWhiteRule || (queryWhiteRule && resultWhiteRule)) && hasThemeCssValue('boss-container', '#FFFFFF')) {
      pass('validate', 'Query and result modules declare persistent white backgrounds');
    } else {
      fail('validate', 'Query-list pages must explicitly keep both .boss-query-module and .boss-result-module white for their full height');
    }

    if (/\.boss-content-stack\s*\{[^}]*gap\s*:\s*16px\b/i.test(source)) {
      pass('validate', 'Query and result modules use the mandatory 16px sibling gap');
    } else {
      fail('validate', 'Query-list white modules must be separated by exactly 16px on .boss-content-stack');
    }

    const transparentOverride = /\.(?:boss-query-module|boss-result-module)[^{]*\{[^}]*(?:background|background-color)\s*:\s*(?:transparent|none)\b/i.test(source);
    if (transparentOverride) {
      fail('validate', 'Query/result module white backgrounds must not be overridden with transparent or none');
    } else {
      pass('validate', 'No transparent query/result module background override detected');
    }

    const queryOwnsInset = /\.boss-query-module(?:[^,{]*)\{[^}]*padding\s*:\s*16px\b/i.test(source);
    const resultOwnsInset = /\.boss-result-module(?:[^,{]*)\{[^}]*padding\s*:\s*0\s+16px\s+16px\b/i.test(source);
    const modulesOwnSingleInset = queryOwnsInset && resultOwnsInset;
    if (modulesOwnSingleInset) {
      pass('validate', 'Query module owns 16px inset and result module keeps the required zero top inset');
    } else {
      fail('validate', 'Query module must own 16px inset; result module must use 0 16px 16px so Toolbar starts at the top');
    }

    const queryRowsUseGridGap = /\.boss-query-grid\s*\{[^}]*row-gap\s*:\s*16px\b/i.test(source)
      && /\.boss-query-field\s+\.ant-form-item\s*\{[^}]*margin-bottom\s*:\s*0\b/i.test(source);
    if (queryRowsUseGridGap) {
      pass('validate', 'Query grid keeps 16px row gaps without adding trailing space below the final row');
    } else {
      fail('validate', 'Query fields must use the grid 16px row gap and no per-field bottom margin so the final row ends at the module inset');
    }

    const repeatedResultPadding = hasNonZeroHorizontalPadding(source, [
      'boss-result-summary', 'boss-result-toolbar', 'boss-table-body', 'boss-table-pagination'
    ]);
    if (repeatedResultPadding) {
      fail('validate', 'Direct result summary/toolbar/table/pagination regions must not add horizontal padding on top of the module 16px inset');
    } else {
      pass('validate', 'Direct result regions do not stack a second horizontal content inset');
    }

    const containedTableBody = /\.boss-table-body\s*\{[^}]*width\s*:\s*100%[^}]*max-width\s*:\s*100%[^}]*overflow-x\s*:\s*auto/i.test(source)
      && /\.boss-result-module(?:[^,{]*)\{[^}]*width\s*:\s*100%[^}]*max-width\s*:\s*100%/i.test(source)
      && /const tableMinimumWidth = columns\.reduce[\s\S]{0,500}scroll:\s*\{\s*x:\s*tableSpec\.scrollX\s*\|\|\s*tableMinimumWidth\s*\}/i.test(source);
    if (containedTableBody) {
      pass('validate', 'Wide Table columns are constrained to the result module and scroll only inside the Table body');
    } else {
      fail('validate', 'Query-list Table width must follow the result module; wide columns require inner Table scrolling, not module or page overflow');
    }

    const hasQueryStatistic = /(?:h|React\.createElement)\(\s*Statistic\b|<Statistic\b/i.test(source);
    if (hasQueryStatistic && !/\bboss-result-summary\b/i.test(source)) {
      fail('validate', 'Query-list Statistic groups must use boss-result-summary so result padding ownership is auditable');
    } else if (hasQueryStatistic) {
      pass('validate', 'Query-list Statistic group uses boss-result-summary');
    }

    if (hasQueryStatistic && usesTemplate('list.card-summary')) {
      const cardSummaryAboveToolbar = /boss-result-summary[\s\S]{0,1800}boss-result-toolbar/i.test(source);
      const cardSummaryGap = /(?:boss-result-summary|settlement-summary)[^\{]*\{[^}]*margin-bottom\s*:\s*8px/i.test(source)
        || /boss-result-summary\s*\+\s*boss-result-toolbar[^\{]*\{[^}]*margin-top\s*:\s*8px/i.test(source);
      const equalWidthCards = /grid-template-columns\s*:\s*repeat\(\s*(?:var\(--boss-summary-columns[^)]*\)|\d+)\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/i.test(source);
      if (cardSummaryAboveToolbar && cardSummaryGap && equalWidthCards) {
        pass('validate', 'Card summary is evenly distributed above the Table Toolbar with a fixed 8px gap');
      } else {
        fail('validate', 'Card summary must use equal-width columns above the Table Toolbar with a fixed 8px gap');
      }
    }

    const hasGrayStatisticCards = hasQueryStatistic && /(?:\.taipai-stat\b|\.statistic-card\b|background\s*:\s*#f6f6f6)/i.test(source);
    if (hasGrayStatisticCards) {
      const cardSummaryTopInset = /\.boss-result-summary(?:-[\w-]+)?[^\{]*\{[^}]*padding-top\s*:\s*16px/i.test(source)
        || /\.boss-result-summary(?:-[\w-]+)?[^\{]*\{[^}]*padding\s*:\s*16px\s+0(?:\s|;|\})/i.test(source);
      if (cardSummaryTopInset) {
        pass('validate', 'Gray Statistic cards keep the mandatory 16px result content top inset');
      } else {
        fail('validate', 'Gray Statistic cards must declare padding-top: 16px on the result summary content area');
      }
    }
  } else {
    pass('validate', 'No query-list module pair detected; persistent white-module checks skipped');
  }

  const hasQueryArea = pageSpec
    ? pageSpec.metadata?.family === 'list'
    : /(data-boss-query-layout|data-boss-query-grid|boss-query-grid|query-grid|queryFields|查询条件)/i.test(source);
  if (!hasQueryArea) {
    pass('validate', 'No query area detected; adaptive query-layout check skipped');
  } else {
    const hasAdaptiveQueryLayout = /\.boss-query-grid\s*\{[^}]*display\s*:\s*grid[^}]*grid-template-columns\s*:\s*repeat\(\s*3\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/i.test(source)
      && /@media\s*\(max-width:\s*1080px\)\s*\{[\s\S]{0,1600}\.boss-query-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*2\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/i.test(source)
      && /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]{0,1800}\.boss-query-grid\s*\{[^}]*grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/i.test(source)
      && /\.boss-query-field\s*\{[^}]*min-width\s*:\s*0/i.test(source)
      && /data-boss-query-layout/i.test(source);
    const hasDedicatedDateRow = /\.boss-query-date-range-field\s*\{[^}]*grid-column\s*:\s*1\s*\/\s*-1/i.test(source);
    const hasMeasuredRows = /queryRowTops\(container\)[\s\S]{0,800}rowTops\.length\s*>\s*2/i.test(source)
      && /data-boss-query-row/i.test(source)
      && /queryHasOverflow/i.test(source);
    const keepsConditionsVisibleWhileMeasuring = !/\.boss-query-grid\.is-measuring\s*\{[^}]*visibility\s*:\s*hidden/i.test(source);
    const hasGridAlignedActions = /\.boss-query-actions\s*\{[^}]*grid-column\s*:\s*3[^}]*justify-self\s*:\s*end/i.test(source);
    if (hasAdaptiveQueryLayout && hasDedicatedDateRow && hasMeasuredRows && keepsConditionsVisibleWhileMeasuring && hasGridAlignedActions) {
      pass('validate', 'Query area uses responsive 3/2/1 grid columns with visible remeasurement, Label-plus-control units, a dedicated date row, and measured two-row overflow');
    } else {
      fail('validate', 'Query area must use responsive 3/2/1 grid columns with visible remeasurement, Label-plus-control units, a dedicated date row, a final-column action area, and measured two-row overflow; field-count collapse is not allowed');
    }
  }

  if (!hasQueryArea) {
    pass('validate', 'No query area detected; query label-alignment check skipped');
  } else {
    const hasContentSizedQueryLabels = /\.boss-query-field\s+\.ant-form-item-label\s*\{[^}]*(?:flex\s*:\s*0\s+0\s+auto|max-width\s*:\s*none)/i.test(source);
    const hasRightAlignedQueryLabels = /\.boss-query-field\s+\.ant-form-item-label\s*\{[^}]*text-align\s*:\s*right/i.test(source)
      && /\.boss-query-field\s+\.ant-form-item-label\s*>\s*label\s*\{[^}]*justify-content\s*:\s*flex-end/i.test(source);
    const usesHorizontalQueryForm = /React\.createElement\(\s*Form\s*,\s*\{[^}]*layout\s*:\s*['"]horizontal['"]/i.test(source)
      || /\bh\(\s*Form\s*,\s*\{[^}]*layout\s*:\s*['"]horizontal['"]/i.test(source)
      || /<Form\b[^>]*\blayout\s*=\s*['"]horizontal['"]/i.test(source);
    if (hasContentSizedQueryLabels && hasRightAlignedQueryLabels && usesHorizontalQueryForm) {
      pass('validate', 'Query form uses content-sized, right-aligned horizontal Labels');
    } else {
      fail('validate', 'Query-list conditions must use horizontal, content-sized, right-aligned Labels with their controls kept as one unit');
    }
  }

  const dateRangeQueryFields = pageSpec?.list?.query?.fields?.filter((field) => field.control === 'date-range') || [];
  if (!dateRangeQueryFields.length) {
    pass('validate', 'No date-range query field declared; default date shortcut check skipped');
  } else {
    const firstDateRange = dateRangeQueryFields[0];
    const expectsDatePresets = firstDateRange.showPresets !== false;
    const hasDefaultDatePresets = /DEFAULT_QUERY_DATE_PRESETS\s*=\s*\[['"]今日['"],\s*['"]近 7 日['"],\s*['"]近 30 日['"]\]/i.test(source);
    const hasDateShortcutInteraction = /boss-query-date-presets/i.test(source)
      && /form\.setFieldsValue\(\{\s*\[field\.key\]\s*:\s*range\s*\}\)/i.test(source)
      && /queryInitialValues\(list\.query\)/i.test(source);
    const hasCompactDateRange = /\.boss-query-date-range-control\s*>\s*\.boss-query-date-range-picker\s*\{[^}]*width\s*:\s*max-content[^}]*min-width\s*:\s*320px/i.test(source);
    const hasPrimaryDerivedPresetSelection = /const\s+selected\s*=\s*isSameQueryDateRange\(value,\s*range\)/i.test(source)
      && /boss-query-date-preset\$\{selected\s*\?\s*['"]\s+is-selected['"]\s*:\s*['"]['"]\}/i.test(source)
      && /\.boss-query-date-preset\.is-selected[^}]*color\s*:\s*var\(--boss-primary\)[^}]*background\s*:\s*var\(--boss-selected-bg\)/i.test(source);
    const limitsPresetsToFirstDateRange = /const\s+datePresetFieldKey\s*=\s*usesQueryDatePresets\(list\.query,\s*firstDateRangeField\)[\s\S]{0,120}?firstDateRangeField\.key/i.test(source)
      && /field\.key\s*===\s*datePresetFieldKey/i.test(source)
      && /queryItem\(field,\s*form,\s*showDatePresets\)/i.test(source);
    const supportsStandardDateRangeFallback = /if\s*\(showDatePresets\)\s*\{[\s\S]{0,300}QueryDateRangeControl/i.test(source)
      && /if\s*\(field\.control\s*===\s*['"]date-range['"]\)\s*return\s+h\(DatePicker\.RangePicker/i.test(source);
    if (limitsPresetsToFirstDateRange && supportsStandardDateRangeFallback && (!expectsDatePresets || (hasDefaultDatePresets && hasDateShortcutInteraction && hasCompactDateRange && hasPrimaryDerivedPresetSelection))) {
      pass('validate', expectsDatePresets
        ? 'Only the first date-range query defaults to today and shows the active shortcut with primary-derived selection styling'
        : 'The first date-range explicitly disables shortcuts and uses the standard Ant Design RangePicker');
    } else {
      fail('validate', 'Only the first date-range query may show default shortcuts; showPresets: false and all later date ranges must use the standard Ant Design RangePicker without shortcuts');
    }
  }

  if (hasQueryArea && /\bcollapseThreshold\b/i.test(source)) {
    fail('validate', 'Query expansion must be determined from actual rows, not collapseThreshold field counts');
  } else {
    pass('validate', 'Query expansion does not use field-count collapse thresholds');
  }

  const hasQueryExpand = hasQueryArea && /(?:DownOutlined|UpOutlined)/i.test(source) && /(?:展开|收起)/.test(source);
  if (hasQueryExpand) {
    const usesExpandContract = /className\s*:\s*['"][^'"]*boss-query-expand-button/i.test(source)
      || /className\s*=\s*['"][^'"]*boss-query-expand-button/i.test(source);
    const expandUsesPrimaryText = /\.boss-query-expand-button[^{}]*\{[^}]*color\s*:\s*(?:var\(--boss-text\)|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*\.85\))/i.test(source);
    if (usesExpandContract && expandUsesPrimaryText) {
      pass('validate', 'Query expand/collapse text and icon use primary text color');
    } else {
      fail('validate', 'Query expand/collapse must use boss-query-expand-button with primary text color rgba(0, 0, 0, .85)');
    }
  } else {
    pass('validate', 'No query expand/collapse control detected; primary-text color check skipped');
  }

  if (/data-boss-shell["']?\s*:\s*["']footer["']|data-boss-shell=["']footer["']/i.test(source)) {
    pass('validate', 'Platform footer is owned by the canonical Shell');
  } else {
    fail('validate', 'Platform footer must be rendered by the canonical Shell');
  }

  if (/\.boss-shell-content[^{]*\{[^}]*padding\s*:\s*0\s+16px(?:\s*;|[^0-9a-z%])/i.test(source)) {
    pass('validate', 'Shell content has no bottom padding');
  } else {
    fail('validate', 'Shell content must use `padding: 0 16px` with no bottom padding');
  }

  if (/\.boss-shell-footer[^{]*\{[^}]*margin\s*:\s*12px\s+0\s+0(?:\s*;|[^0-9a-z%])/i.test(source)) {
    pass('validate', 'Shell footer has the required 12px top spacing');
  } else {
    fail('validate', 'Shell footer must use `margin: 12px 0 0`');
  }

  if (/\.boss-shell-footer[^{]*\{[^}]*(?:height\s*:\s*32px[\s\S]*flex\s*:\s*0\s+0\s+32px|flex\s*:\s*0\s+0\s+32px[\s\S]*height\s*:\s*32px)/i.test(source)) {
    pass('validate', 'Shell footer keeps a fixed 32px height');
  } else {
    fail('validate', 'Shell footer must keep `height: 32px` and `flex: 0 0 32px`');
  }

  if (/\.boss-shell-footer[^{]*\{[^}]*position\s*:\s*(?:fixed|sticky)/i.test(source)) {
    fail('validate', 'Shell footer must stay in normal content flow, not fixed or sticky');
  } else {
    const isolatedWorkspaceScroll = /\.boss-shell\s*\{[^}]*(?<!-)height\s*:\s*100vh[^}]*overflow\s*:\s*hidden/i.test(source)
      && /\.boss-shell-body\s*\{[^}]*(?<!-)height\s*:\s*calc\(100vh\s*-\s*92px\)[^}]*overflow\s*:\s*hidden/i.test(source)
      && /\.boss-shell-workspace\s*\{[^}]*min-height\s*:\s*0/i.test(source)
      && /\.boss-shell-content\s*\{[^}]*flex\s*:\s*1[^}]*overflow\s*:\s*auto/i.test(source)
      && /\.boss-shell-content-body\s*\{[^}]*flex\s*:\s*1\s+(?:0|1)\s+auto[^}]*overflow\s*:\s*visible/i.test(source);
    if (isolatedWorkspaceScroll) {
      pass('validate', 'Only the workspace content scrolls, and long business content pushes the Footer below it');
    } else {
      fail('validate', 'The Shell must stay fixed while the workspace content scrolls with the Footer after business content');
    }
  }

  if (/\.boss-shell-footer[^{]*\{[^}]*background\s*:\s*var\(--boss-page-bg\)[^}]*border-top\s*:\s*1px\s+solid\s+var\(--boss-divider\)/i.test(source)) {
    pass('validate', 'Shell Footer is visually separated from the content area');
  } else {
    fail('validate', 'Shell Footer must use a page-background band and top divider so it does not merge with content');
  }

  const shellEmptyRule = /\.boss-shell-empty\s*\{[^}]*flex\s*:\s*1[^}]*min-height\s*:\s*\d+px[^}]*display\s*:\s*flex[^}]*align-items\s*:\s*center[^}]*justify-content\s*:\s*center[^}]*background\s*:\s*(?:#fff|var\(--boss-container\))/i.test(source);
  if (shellEmptyRule && hasThemeCssValue('boss-container', '#FFFFFF')) {
    pass('validate', 'Empty business routes use a full-height white module with centered Empty content');
  } else {
    fail('validate', 'Empty business routes must use .boss-shell-empty as a full-height white module with centered content');
  }

  const fullHeightResultRule = /\.boss-shell-content-body\s*\{[^}]*flex\s*:\s*1\s+(?:0|1)\s+auto[^}]*min-height\s*:\s*0/i.test(source)
    && /\.boss-content-stack\s*\{[^}]*flex\s*:\s*1\s+1\s+auto[^}]*min-height\s*:\s*(?:0|100%)/i.test(source)
    && /\.boss-result-module\s*\{[^}]*flex\s*:\s*1\s+(?:0|1)\s+auto/i.test(source)
    && /\.boss-result-page\s*\{[^}]*flex\s*:\s*1\s+0\s+auto[^}]*min-height\s*:\s*100%[^}]*align-items\s*:\s*center[^}]*justify-content\s*:\s*center/i.test(source);
  if (fullHeightResultRule) {
    pass('validate', 'Success Result surfaces fill the Shell content area and center their content');
  } else {
    fail('validate', 'Success Result surfaces must fill the Shell content area instead of using a fixed minimum height');
  }

  if (/(?:const\s+Menu\s*=\s*antd\.Menu|antd\.Menu|<Menu\b|React\.createElement\(\s*Menu\b|ant-menu-inline)/i.test(source)) {
    pass('validate', 'Left navigation uses Ant Design Menu');
  } else {
    fail('validate', 'Left secondary navigation must use Ant Design Menu or a project wrapper based on Ant Design Menu');
  }

  if (/(inlineCollapsed\s*=|inlineCollapsed\s*:)/i.test(source)) {
    pass('validate', 'Left navigation declares collapsible Ant Design Menu state');
  } else {
    fail('validate', 'Left secondary navigation must remain collapsible through Ant Design Menu inlineCollapsed or equivalent controlled state');
  }

  if (/(onOpenChange\s*=|onOpenChange\s*:)/i.test(source)) {
    pass('validate', 'Left navigation wires Ant Design Menu onOpenChange for submenu expand/collapse');
  } else {
    fail('validate', 'Ant Design Menu submenu expand/collapse must be interactive via onOpenChange; do not hard-code openKeys');
  }

  if (/data-boss-sider-collapse/i.test(source)) {
    pass('validate', 'Sider collapse control marker found');
  } else {
    fail('validate', 'Sider collapse / expand control must include `data-boss-sider-collapse`');
  }

  if (/(?:sider-toggle|data-boss-sider-collapse)[\s\S]{0,700}(?:justify-content\s*:\s*flex-start|justifyContent\s*:\s*["']flex-start["']|text-align\s*:\s*left|textAlign\s*:\s*["']left["']|align-items\s*:\s*flex-start|alignItems\s*:\s*["']flex-start["'])/i.test(source)) {
    pass('validate', 'Sider collapse / expand icon is declared left-aligned');
  } else {
    fail('validate', 'Sider collapse / expand icon must be left-aligned, not centered or right-aligned');
  }

  if (/data-boss-tab-static-icon/i.test(source)) {
    pass('validate', 'Static tab-left icon marker found');
  } else {
    fail('validate', 'Every tab label must include a static left icon marked with `data-boss-tab-static-icon`');
  }

  if (/(ReloadOutlined|icons\.ReloadOutlined)/i.test(source)) {
    pass('validate', 'Tab-left static icon uses ReloadOutlined');
  } else {
    fail('validate', 'Tab-left static icon must use Ant Design Icons `ReloadOutlined`');
  }

  if (/(LoadingOutlined|FileDoneOutlined\s+data-boss-tab-static-icon)/i.test(source)) {
    fail('validate', 'Tab-left refresh icon must be ReloadOutlined and must not use loading state or page-type icons');
  } else {
    pass('validate', 'Tab-left refresh icon does not use loading state or page-type icons');
  }

  if (/(<Descriptions\b[^>]*(?:\sbordered\b|bordered\s*=\s*{?\s*true)|React\.createElement\(\s*Descriptions\s*,\s*\{[^}]*bordered\s*:\s*true|className\s*:\s*["'][^"']*detail[^"']*table|data-boss-detail[^>]*bordered)/i.test(source)) {
    fail('validate', 'Detail Descriptions must use the default non-bordered style; table-shaped detail descriptions are not allowed');
  } else {
    pass('validate', 'Detail Descriptions do not use bordered/table-shaped styling');
  }

  const hasStepsUsage = pageSpec
    ? pageSpec.metadata?.family === 'form' && pageSpec.content?.capabilities?.includes('form.steps')
    : /(?:\bSteps\b|<Steps\b|React\.createElement\(\s*Steps\b|h\(\s*Steps\b)/i.test(source);
  if (/wizard-field-grid/i.test(source)) {
    const wizardSpacing = /\.wizard-field-grid\s*\{[^}]*gap\s*:\s*16px\b/i.test(source);
    const hasInputNumber = /InputNumber|ant-input-number/i.test(source);
    const wizardControlWidth = !hasInputNumber || /\.wizard-field-grid\s+\.ant-input-number-group-wrapper[^{]*\{[^}]*width\s*:\s*100%/i.test(source);
    if (wizardSpacing && wizardControlWidth) {
      pass('validate', 'Wizard form fields use 16px grid spacing and equal-width InputNumber controls');
    } else {
      fail('validate', 'Wizard form fields must use 16px row/column spacing and equal-width controls, including InputNumber addons');
    }
  }
  const stepsItemBlocks = extractStepsItemBlocks(source);
  const declaredWizardStepsHaveDescriptions = /(?:const|let|var)\s+wizardSteps\s*=\s*\[[\s\S]*\btitle\s*:[\s\S]*\bdescription\s*:/i.test(source);
  const pageSpecWizardStepsHaveDescriptions = Array.isArray(pageSpec?.form?.steps)
    && pageSpec.form.steps.length > 0
    && pageSpec.form.steps.every((step) => typeof step.title === 'string' && step.title.trim() && typeof step.description === 'string' && step.description.trim());
  if (hasStepsUsage && stepsItemBlocks.length > 0) {
    const invalidBlocks = stepsItemBlocks.filter((block) => {
      const titleCount = (block.match(/\btitle\s*:/g) || []).length;
      const descriptionCount = (block.match(/\bdescription\s*:/g) || []).length;
      return titleCount > 0 && descriptionCount < titleCount;
    });
    if (invalidBlocks.length === 0) {
      pass('validate', 'Every Boss Ledger Wizard Steps item includes a description');
    } else {
      fail('validate', 'Every Boss Ledger Wizard Steps item must include description; title-only Steps are not allowed');
    }
  } else if (hasStepsUsage && (declaredWizardStepsHaveDescriptions || pageSpecWizardStepsHaveDescriptions)) {
    pass('validate', 'Every Boss Ledger Wizard Steps item includes a description');
  } else if (hasStepsUsage) {
    fail('validate', 'Boss Ledger Steps usage must expose an items array whose every item includes description');
  } else {
    pass('validate', 'No Steps usage detected; Steps description rule skipped');
  }

  if (hasStepsUsage || /\bwizard-page\b|boss-wizard-page/i.test(source)) {
    const duplicateWizardHeader = /(?:wizard-header|wizard-page-title|boss-wizard-page-header)/i.test(source);
    const topWizardReturn = /(?:wizard-header|wizard-page-title|boss-wizard-page-header)[\s\S]{0,700}(返回列表|返回查询|退出新增)/i.test(source);
    if (duplicateWizardHeader) {
      fail('validate', 'Wizard content must use the active Tab as its only page title; duplicate Wizard header/title blocks are forbidden');
    } else {
      pass('validate', 'Wizard content does not render a duplicate page title block');
    }
    if (topWizardReturn) {
      fail('validate', 'Wizard top header must not contain list-return actions; keep 返回列表 on the success Result page');
    } else {
      pass('validate', 'Wizard top header does not contain a list-return action');
    }

    const wizardGrayBlock = /(?:confirm-section|wizard-page|boss-wizard-page)[^{]*\{[^}]*background\s*:\s*#F6F6F6/i.test(source);
    const wizardDivider = /(?:confirm-section|wizard-aside|wizard-page|boss-wizard-page)[^{]*\{[^}]*border(?:-(?:left|right|top|bottom))?\s*:/i.test(source);
    if (wizardGrayBlock) {
      fail('validate', 'Wizard business content must not use gray summary blocks; keep Wizard content white');
    } else {
      pass('validate', 'Wizard business content has no gray summary blocks');
    }
    if (wizardDivider) {
      fail('validate', 'Wizard business content must not use decorative divider lines between form and illustration');
    } else {
      pass('validate', 'Wizard business content has no decorative divider lines');
    }

    const wizardActionFixed = /\.wizard-action-bar[^\{]*\{[^}]*position\s*:\s*fixed[^}]*left\s*:\s*208px[^}]*right\s*:\s*0[^}]*bottom\s*:\s*0[^}]*height\s*:\s*48px[^}]*border-top\s*:\s*1px\s+solid\s+var\(--boss-divider\)/i.test(source);
    if (wizardActionFixed) {
      pass('validate', 'Wizard action area is fixed over the Footer at the workspace bottom');
    } else {
      fail('validate', 'Wizard action area must be a 48px workspace-fixed surface covering the Footer');
    }

    const wizardContentCentered = /\.wizard-content-frame[^\{]*\{[^}]*justify-content\s*:\s*center/i.test(source);
    if (wizardContentCentered) {
      pass('validate', 'Wizard Steps and content group declares vertical centering');
    } else {
      fail('validate', 'Wizard Steps and content group must be vertically centered as one frame');
    }

    const wizardSplit = /(?:\.wizard-body-grid|\.wizard-content-grid)[^\{]*\{[^}]*grid-template-columns\s*:\s*(?:minmax\(0,\s*)?65%\)?\s+(?:minmax\(0,\s*)?35%\)?/i.test(source);
    if (wizardSplit && !/65%\s*\+\s*45%|65fr[^}]*45fr/i.test(source)) {
      pass('validate', 'Wizard form and illustration regions use the canonical 65% / 35% split');
    } else {
      fail('validate', 'Wizard must use a non-overflowing 65% / 35% form and illustration split');
    }

    const wizardDoubleColumn = /(?:\.wizard-field-grid|\.form-grid)[^\{]*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*2\s*,/i.test(source);
    if (wizardDoubleColumn) pass('validate', 'Wizard form uses an equal two-column field grid');
    else fail('validate', 'Wizard left form must use an equal two-column field grid');

    const wizardGap16 = /(?:\.wizard-field-grid|\.form-grid)[^\{]*\{[^}]*\b(?:gap|row-gap)\s*:\s*16px/i.test(source)
      && /(?:\.wizard-field-grid|\.form-grid)[^\{]*\{[^}]*\b(?:gap|column-gap)\s*:\s*16px/i.test(source);
    if (wizardGap16) pass('validate', 'Wizard field grid uses 16px horizontal and vertical spacing');
    else fail('validate', 'Wizard field grid must use 16px row and column spacing');

    const wizardGuideAsset = /(?:assets\/wizard-guide\.(?:png|jpe?g|webp)|wizard-guide-image)/i.test(source)
      && /(?:<img\b|createElement\(\s*['"]img['"])/i.test(source);
    if (wizardGuideAsset) pass('validate', 'Wizard uses a local illustration asset with an image element');
    else fail('validate', 'Wizard must render the local illustration asset from assets/');

    const wizardGuideCopy = /wizard-guide-title/i.test(source)
      && /wizard-guide-text/i.test(source)
      && /font-size\s*:\s*16px/i.test(source)
      && /wizard-guide-text[^}]*font-size\s*:\s*14px/i.test(source);
    if (wizardGuideCopy) pass('validate', 'Wizard guide includes required 16px primary and 14px secondary descriptions');
    else fail('validate', 'Wizard guide must include a primary 16px description and secondary 14px description below the resource image');

    const wizardStates = /validateFields\s*\(/i.test(source)
      && /\bloading\s*[:=]/i.test(source)
      && /Result[\s\S]{0,400}status\s*[:=]\s*['"]success['"]/i.test(source);
    if (wizardStates) pass('validate', 'Wizard includes validation, submit loading, and success-result states');
    else fail('validate', 'Wizard must include validation, submit loading, and success-result states');

    const resultHasCustomIcon = /React\.createElement\(\s*Result\b[\s\S]{0,900}\bicon\s*:/i.test(source)
      || /<Result\b[\s\S]{0,900}\bicon\s*=/i.test(source)
      || /\.wizard-result[^\{]*\.ant-result-icon[^{]*\{/i.test(source);
    if (resultHasCustomIcon) {
      fail('validate', 'Wizard success Result must use the official Ant Design success icon without custom icon or icon-style overrides');
    } else {
      pass('validate', 'Wizard success Result uses the official icon presentation');
    }
  }

  if (/\b(?:const|let|var)\s+Modal\s*=\s*antd\.Modal\b|antd\.Modal\b|Modal\.confirm\b|<Modal\b|React\.createElement\(\s*Modal\b/i.test(source)) {
    pass('validate', 'Modal uses official Ant Design component structure');
  } else {
    pass('validate', 'No Modal usage detected; official Modal structure check skipped');
  }

  const modalVerticalCentering = /\.ant-modal-wrap\s*\{[^}]*display\s*:\s*flex[^}]*align-items\s*:\s*center[^}]*justify-content\s*:\s*center/i.test(source)
    && /\.ant-modal-wrap\s+\.ant-modal\s*\{[^}]*top\s*:\s*0[^}]*margin\s*:\s*0\s+auto/i.test(source)
    && /Modal\.confirm\(\{[\s\S]{0,180}centered\s*:\s*true/i.test(source);
  if (modalVerticalCentering) {
    pass('validate', 'Modal and second-confirmation dialogs use the shared vertical-centering layout');
  } else {
    fail('validate', 'Modal and second-confirmation dialogs must be vertically centered in the viewport');
  }

  const confirmationSource = source
    .replace(/const\s+wizardSteps\s*=\s*\[[\s\S]*?\];/i, '')
    .replace(/items\s*:\s*\[[\s\S]*?\]/i, '');
  const hasConfirmationCopy = /(提交确认|二次确认|删除确认|停用确认|启用确认|撤销确认|作废确认|确认提交|确认删除|确认停用|确认启用|确认撤销|确认作废)/i.test(confirmationSource);
  const usesModalConfirm = /\bModal\.confirm\s*\(/i.test(source);
  const usesPopconfirmForConfirm = /\bPopconfirm\b|antd\.Popconfirm\b/i.test(source);
  const usesControlledModalForConfirm = /(?:h\(\s*Modal\b|React\.createElement\(\s*Modal\b|<Modal\b)[\s\S]{0,1200}(提交确认|二次确认|删除确认|停用确认|启用确认|撤销确认|作废确认|确认提交|确认删除|确认停用|确认启用|确认撤销|确认作废)/i.test(source);

  if (hasConfirmationCopy && usesModalConfirm) {
    pass('validate', 'Submit/second-confirmation interactions use Ant Design Modal.confirm');
  } else if (hasConfirmationCopy) {
    fail('validate', 'Submit confirmations and second-confirmation interactions must use Ant Design Modal.confirm');
  } else {
    pass('validate', 'No submit/second-confirmation copy detected; Modal.confirm requirement skipped');
  }

  if (usesPopconfirmForConfirm) {
    fail('validate', 'Boss Ledger submit/second confirmations must not use Popconfirm; use Modal.confirm');
  } else {
    pass('validate', 'No Popconfirm usage detected for Boss Ledger confirmations');
  }

  if (usesControlledModalForConfirm) {
    fail('validate', 'Submit/second confirmations must not be implemented with a normal controlled Modal; use Modal.confirm');
  } else {
    pass('validate', 'No controlled Modal implementation detected for submit/second confirmations');
  }

  if (usesModalConfirm) {
    const confirmBodyHasPadding24 = /\.ant-modal(?:\.[\w-]+)?\.ant-modal-confirm\s+\.ant-modal-body[^{]*\{[^}]*padding\s*:\s*24px\s*!important(?:\s*;|[^0-9a-z%])/i.test(source)
      || /\.ant-modal-confirm(?:\s+[^{]+)?\s+\.ant-modal-body[^{]*\{[^}]*padding\s*:\s*24px\s*!important(?:\s*;|[^0-9a-z%])/i.test(source);
    if (confirmBodyHasPadding24) {
      pass('validate', 'Modal.confirm body hard-codes padding: 24px !important on all sides');
    } else {
      fail('validate', 'Modal.confirm `.ant-modal-body` must hard-code padding: 24px !important on all sides');
    }
    const confirmThemeColor = /boss-confirm-button[\s\S]{0,500}(?:#F36046|colorPrimary\s*:\s*['"]#F36046['"])/i.test(source)
      || /okButtonProps\s*:[\s\S]{0,500}(?:#F36046|boss-confirm-button)/i.test(source);
    if (confirmThemeColor && !/boss-confirm-button[^}]*background\s*:\s*(?:#1677FF|#1890FF)/i.test(source)) {
      pass('validate', 'Modal.confirm actions are constrained to the Boss Ledger theme color');
    } else {
      fail('validate', 'Modal.confirm actions must explicitly use Boss Ledger theme color #F36046 and cannot fall back to Ant Design blue');
    }
  } else {
    pass('validate', 'No Modal.confirm usage detected; confirm body padding rule skipped');
  }

  if (/\.ant-modal(?:\s+[^{]+)?\s+\.ant-modal-content[^{]*\{[^}]*padding\s*:\s*0(?:\s*;|[^0-9a-z%])/i.test(source)) {
    pass('validate', 'Modal content padding is zero so dividers can span full width');
  } else {
    fail('validate', 'Ant Design Modal content must set padding: 0 so header/footer dividers are full width');
  }

  const modalWidthMatches = [...source.matchAll(/<Modal\b[\s\S]{0,500}?\bwidth\s*=\s*(?:{\s*(\d+)\s*}|["'](\d+)["'])/g)].map((match) => Number(match[1] || match[2]));
  const invalidModalWidths = modalWidthMatches.filter((width) => width < 480 || width > 520);
  if (invalidModalWidths.length > 0) {
    fail('validate', `Normal Ant Design form Modal width must stay within 480-520px; found ${invalidModalWidths.join(', ')}`);
  } else if (modalWidthMatches.length > 0) {
    pass('validate', 'Normal Ant Design form Modal width stays within 480-520px');
  } else {
    pass('validate', 'No explicit normal form Modal width detected; width range check skipped');
  }

  if (/\.ant-modal(?:\s+[^{]+)?\s+\.ant-modal-header[^{]*\{[^}]*border-bottom\s*:\s*1px\s+solid\s+(?:var\(--(?:boss-)?divider\)|#F0F0F0)/i.test(source) && hasThemeCssValue('boss-divider', '#F0F0F0')) {
    pass('validate', 'Modal header declares required full-width bottom divider');
  } else {
    fail('validate', 'Ant Design Modal header must include a full-width `1px solid #F0F0F0` bottom divider');
  }

  if (/\.ant-modal(?:\s+[^{]+)?\s+\.ant-modal-footer[^{]*\{[^}]*border-top\s*:\s*1px\s+solid\s+(?:var\(--(?:boss-)?divider\)|#F0F0F0)/i.test(source) && hasThemeCssValue('boss-divider', '#F0F0F0')) {
    pass('validate', 'Modal footer declares required full-width top divider');
  } else {
    fail('validate', 'Ant Design Modal footer must include a full-width `1px solid #F0F0F0` top divider');
  }

  if (/\.ant-modal(?:\s+[^{]+)?\s+\.ant-modal-body[^{]*\{[^}]*padding\s*:\s*24px\s+24px\s+0(?:\s*;|[^0-9a-z%])/i.test(source)) {
    pass('validate', 'Modal body declares required padding: 24px 24px 0');
  } else {
    fail('validate', 'Ant Design Modal body must use padding: 24px 24px 0');
  }

  const hasRuleDrivenFormLayout = /function resolveFormLayout\(formSpec, fields\)[\s\S]{0,500}const isDrawer = presentation === 'drawer';[\s\S]{0,300}const useSideLabel = !isDrawer && fieldCount <= 6;[\s\S]{0,300}const useSingleColumn = isDrawer \? fieldCount <= 8 : useSideLabel;[\s\S]{0,400}layout: useSideLabel \? 'horizontal' : 'vertical',[\s\S]{0,300}labelCol: useSideLabel \? \{ flex: '136px' \} : undefined,[\s\S]{0,300}fieldsClassName: useSingleColumn \? 'boss-form-stack' : ''/i.test(source);
  const hasSingleColumnStack = /\.boss-form-grid\.boss-form-stack[\s\S]{0,300}grid-template-columns\s*:\s*minmax\(0,\s*640px\)/i.test(source);
  const hasResponsiveHorizontalFormFallback = /@media\s*\(max-width:\s*768px\)[\s\S]{0,5000}\.boss-horizontal-form\s+\.ant-form-item-row\s*\{[^}]*flex-direction\s*:\s*column/i.test(source)
    && /\.boss-horizontal-form\s+\.ant-form-item-label\s*\{[^}]*text-align\s*:\s*left/i.test(source);
  if (hasRuleDrivenFormLayout && hasSingleColumnStack && hasResponsiveHorizontalFormFallback) {
    pass('validate', 'Standalone forms follow the 6-field threshold; Drawer forms use label-above layouts with the 8-field grid threshold');
  } else {
    fail('validate', 'Standalone forms must use side-label layout at or below 6 fields; Drawer forms must use label-above layouts with the 8-field grid threshold');
  }

  if (usesTemplate('form.modal-simple') || usesTemplate('form.page-simple') || usesTemplate('form.guided-simple')) {
    if (hasRuleDrivenFormLayout) {
      pass('validate', 'Modal and independent forms use the rule-driven 6-field layout threshold');
    } else {
      fail('validate', 'Modal and independent forms must use the rule-driven 6-field layout threshold');
    }
  } else {
    pass('validate', 'Simple-form template not selected; simple form alignment check skipped');
  }

  if (usesTemplate('form.staged-flow')) {
    const wizardUsesCurrentStep = /const currentFields = currentStep\.fields \|\| currentGroups\.flatMap\(\(group\) => group\.fields \|\| \[\]\);\s*const resolvedFormLayout = resolveFormLayout\(formSpec, currentFields\);[\s\S]{0,400}const formLayout = usesGroupedSteps[\s\S]{0,400}: resolvedFormLayout;/i.test(source);
    if (hasRuleDrivenFormLayout && wizardUsesCurrentStep) {
      pass('validate', 'Staged form evaluates the 6-field threshold from the current step only');
    } else {
      fail('validate', 'Staged forms must evaluate the 6-field threshold from the current step only');
    }
  } else {
    pass('validate', 'Staged-form template not selected; current-step layout check skipped');
  }

  if (usesTemplate('form.staged-grouped-flow')) {
    const stagedGroupedLayout = /const usesGroupedSteps = spec\.metadata\.templateId === 'form\.staged-grouped-flow';[\s\S]{0,1200}const currentGroups = currentStep\.groups \|\| \[\];[\s\S]{0,1200}currentGroups\.flatMap\(\(group\) => group\.fields \|\| \[\]\)/i.test(source)
      && /usesGroupedSteps\s*\?\s*\{\s*\.\.\.resolvedFormLayout,\s*layout:\s*'vertical',\s*labelCol:\s*undefined,\s*className:\s*'boss-vertical-form'/i.test(source)
      && /size:\s*usesGroupedSteps\s*\?\s*'small'\s*:\s*undefined/i.test(source)
      && /currentStep\.review[\s\S]{0,900}usesGroupedSteps[\s\S]{0,300}boss-staged-grouped-review[\s\S]{0,300}h\(Descriptions/i.test(source)
      && /usesGroupedSteps\s*\?\s*h\('div', \{ className: `boss-staged-grouped-step/i.test(source)
      && /usesGroupedSteps\s*\?\s*null\s*:\s*h\('aside', \{ className: 'wizard-guide-pane'/i.test(source)
      && /\.boss-staged-grouped-page[^\{]*\{[^}]*padding\s*:\s*0\s+0\s+64px/i.test(source)
      && /\.boss-staged-grouped-page \.boss-wizard-steps[^\{]*\{[^}]*margin\s*:\s*0\s+0\s+16px/i.test(source)
      && /\.boss-staged-grouped-step\s*\{[^}]*display\s*:\s*flex[^}]*flex-direction\s*:\s*column[^}]*align-items\s*:\s*stretch/i.test(source)
      && /\.boss-staged-grouped-step \.boss-form-section-card[^\{]*\{[^}]*border\s*:\s*0/i.test(source)
      && /\.boss-staged-grouped-step \.boss-form-grid[^\{]*\{[^}]*grid-template-columns\s*:\s*repeat\(4,/i.test(source)
      && /\.boss-staged-grouped-review[^\{]*\{[^}]*background\s*:\s*var\(--boss-container\)[^}]*border-radius\s*:\s*var\(--boss-card-radius\)/i.test(source)
      && /\.wizard-action-bar[^\{]*\{[^}]*position\s*:\s*fixed[^}]*height\s*:\s*48px/i.test(source);
    if (stagedGroupedLayout) {
      pass('validate', 'Staged grouped forms keep Steps visible, render the current step as separated full-page groups, omit the guide pane, and retain the fixed action bar');
    } else {
      fail('validate', 'Staged grouped forms must keep Steps visible, render separated full-page groups without a guide pane, and retain the fixed action bar');
    }
  } else {
    pass('validate', 'Staged grouped-form template not selected; grouped-step layout check skipped');
  }

  const hasDrawer = /\bDrawer\b/.test(source);
  if (hasDrawer) {
    const drawerHeaderUsesRightClose = /closeIcon\s*:\s*false[\s\S]{0,700}(?:drawer-title|关闭详情|CloseOutlined)/i.test(source)
      && /Drawer[\s\S]{0,1400}extra\s*:\s*React\.createElement\(Button[\s\S]{0,300}(?:CloseOutlined|关闭详情)/i.test(source);
    if (drawerHeaderUsesRightClose) {
      pass('validate', 'Drawer header places title left and close icon right');
    } else {
      fail('validate', 'Drawer header must place title left and close icon right, with closeIcon disabled when customized');
    }
    if (/Drawer[\s\S]{0,1400}\bfooter\s*:/i.test(source) || /\.ant-drawer-footer/i.test(source)) {
      pass('validate', 'Drawer business actions use the official footer action area');
    } else {
      fail('validate', 'Drawer business actions must be placed in the official footer action area');
    }
    if (/(?:drawer-footer-actions|ant-drawer-footer)[^{]{0,80}\{[^}]*text-align\s*:\s*right/i.test(source)
      || /justify-content\s*:\s*flex-end/i.test(source)) {
      pass('validate', 'Drawer footer actions are right-aligned');
    } else {
      fail('validate', 'Drawer footer actions must be right-aligned');
    }
    const drawerHeaderHasBusinessCopy = /Drawer[\s\S]{0,900}extra\s*:[\s\S]{0,500}(?:Badge|statusMap|启用|停用)/i.test(source);
    if (drawerHeaderHasBusinessCopy) {
      fail('validate', 'Drawer header may contain only the title and close icon; status and auxiliary business copy belong in the body');
    } else {
      pass('validate', 'Drawer header contains no status or auxiliary business copy');
    }
  } else {
    pass('validate', 'No Drawer usage detected; Drawer header/footer checks skipped');
  }

  const embeddedDrawerForms = [
    pageSpec?.list?.table?.primaryAction?.form,
    ...(pageSpec?.list?.table?.rowActions || []).filter((action) => action.type === 'edit').map((action) => action.form)
  ].filter(Boolean);
  const hasEmbeddedDrawerForm = embeddedDrawerForms.length > 0;
  if (hasEmbeddedDrawerForm) {
    if (hasRuleDrivenFormLayout && /\.boss-drawer-form\s+\.ant-drawer-body\s*\{[^}]*padding-inline\s*:\s*24px/i.test(source)) {
      pass('validate', 'List-contained Drawer forms use label-above fields with 24px horizontal content insets');
    } else {
      fail('validate', 'List-contained Drawer forms must use label-above fields and 24px horizontal content insets');
    }
  } else {
    pass('validate', 'No list-contained Drawer form is declared; Drawer form alignment check skipped');
  }

  const inlineSimpleActionLayout = /usesInlinePageActions\s*=\s*presentation\s*===\s*'page'[\s\S]{0,180}\['form\.page-simple', 'form\.guided-simple'\][\s\S]{0,1100}boss-inline-form-actions/i.test(source)
    && /\.boss-inline-form-actions[^{]*\{[^}]*width\s*:\s*min\(100%,\s*640px\)[^}]*justify-content\s*:\s*flex-start[^}]*gap\s*:\s*16px/i.test(source)
    && /\.boss-horizontal-form[^{]*\{[^}]*--boss-form-label-width\s*:\s*136px[^}]*--boss-form-control-offset\s*:\s*var\(--boss-form-label-width\)/i.test(source)
    && /\.boss-horizontal-form\s+\.boss-inline-form-actions[^{]*\{[^}]*margin-left\s*:\s*var\(--boss-form-control-offset\)/i.test(source)
    && /data-boss-form-action-mode[^\n]{0,160}inline/i.test(source);
  if (usesTemplate('form.page-simple') || usesTemplate('form.guided-simple')) {
    const fixedBarExcludesInlinePages = /data-boss-full-page-action-bar'\s*:\s*presentation\s*===\s*'page'\s*&&\s*!usesInlinePageActions\s*\?\s*true/i.test(source);
    if (inlineSimpleActionLayout && fixedBarExcludesInlinePages) {
      pass('validate', 'Independent simple forms use the inline input-aligned primary-then-secondary action area');
    } else {
      fail('validate', 'Independent simple forms must place input-aligned primary-then-secondary actions directly after the fields, without a fixed bottom bar');
    }
  } else {
    pass('validate', 'Independent simple form not selected; inline action-area check skipped');
  }

  if (usesTemplate('form.guided-simple')) {
    const guidedLayout = /boss-form-side-guide-image[\s\S]{0,260}guided-form-default\.png/i.test(source)
      && /\.boss-guided-form-layout[^{]*\{[^}]*width\s*:\s*min\(100%,\s*1200px\)/i.test(source)
      && /\.boss-guided-form-layout[^{]*\{[^}]*padding-inline\s*:\s*16px/i.test(source)
      && /@media\s*\(max-width:\s*768px\)[\s\S]{0,2500}\.boss-form-side-guide\s*\{[^}]*display\s*:\s*none/i.test(source);
    if (guidedLayout) {
      pass('validate', 'Guided simple forms use the default illustration in a centered 1200px desktop layout with 16px insets and hide the guide on narrow screens');
    } else {
      fail('validate', 'Guided simple forms must use the default illustration, a centered 1200px desktop layout with 16px insets, and a hidden narrow-screen guide');
    }
  } else {
    pass('validate', 'Guided simple form not selected; default-guide layout check skipped');
  }

  if (usesTemplate('form.grouped-page')) {
    const fullPageActionBarCss = /\.boss-full-page-action-bar[^\{]*\{[^}]*position\s*:\s*fixed[^}]*left\s*:\s*208px[^}]*right\s*:\s*0[^}]*bottom\s*:\s*0[^}]*height\s*:\s*48px/i.test(source)
      && /\.boss-shell-sider\.collapsed\s*\+\s*\.boss-shell-workspace\s+\.boss-full-page-action-bar[^\{]*\{[^}]*left\s*:\s*48px/i.test(source)
      && /\.boss-full-page-form\s+\.boss-form-grid\s+\.ant-form-item[^\{]*\{[^}]*margin-bottom\s*:\s*0/i.test(source)
      && /\.boss-full-page-form\s+\.boss-form-grid[^\{]*\{[^}]*row-gap\s*:\s*24px/i.test(source);
    const fullPageActionBar = /(?:boss-full-page-action-bar|data-boss-full-page-action-bar)/i.test(source) && fullPageActionBarCss;
    if (fullPageActionBar) {
      pass('validate', 'Full-page form action area is fixed over the Footer and final-row fields have no trailing 24px margin');
    } else {
      fail('validate', 'Full-page forms must use a 48px workspace-fixed action area over the Footer and remove the final-row field margin');
    }
    const fullPageSafeArea = /\.boss-full-page-form[^\{]*\{[^}]*padding-bottom\s*:\s*64px/i.test(source);
    if (fullPageSafeArea) {
      pass('validate', 'Full-page form reserves a 64px scroll-safe area so the final content remains visible above the Footer-overlaid action area');
    } else {
      fail('validate', 'Full-page form must reserve a 64px scroll-safe area for the Footer-overlaid action area');
    }
  } else {
    pass('validate', 'Grouped full-page form not selected; Footer-overlaid action-area check skipped');
  }

  if (!hasQueryArea) {
    pass('validate', 'No query area detected; query-action alignment check skipped');
  } else if (/data-boss-query-row['"]?\s*[:=]\s*['"]actions['"]/i.test(source)
    && /\.boss-query-actions\s*\{[^}]*display\s*:\s*flex[^}]*grid-column\s*:\s*3[^}]*justify-self\s*:\s*end/i.test(source)) {
    pass('validate', 'Query action area occupies the final responsive grid column and aligns right within it');
  } else {
    fail('validate', 'Query action area must occupy the final responsive grid column and align right within it');
  }

  const hasTableOperationColumn = /(?:title\s*:\s*['"]操作['"]|data-boss-operation-column|operation-(?:links|actions|column))/i.test(source);
  if (hasTableOperationColumn) {
    if (/data-boss-operation-column/i.test(source)) {
      pass('validate', 'Table operation wrapper includes the required theme-color marker');
    } else {
      fail('validate', 'Table operation wrapper must include `data-boss-operation-column`');
    }

    const directThemeTokens = /colorPrimary\s*:\s*['"]#F36046['"][\s\S]{0,500}colorLink\s*:\s*['"]#F36046['"][\s\S]{0,500}colorLinkHover\s*:/i.test(source)
      || /colorLink\s*:\s*['"]#F36046['"][\s\S]{0,500}colorLinkHover\s*:[\s\S]{0,500}colorPrimary\s*:\s*['"]#F36046['"]/i.test(source);
    const generatedThemeTokens = /theme\s*:\s*\{[\s\S]{0,180}token\s*:\s*(?:theme|bossLedgerTheme)\.antTokens/i.test(source)
      && hasThemeRuntimeToken('colorPrimary', '#F36046')
      && hasThemeRuntimeToken('colorLink', '#F36046')
      && hasThemeRuntimeToken('colorLinkHover', '#D94E36');
    if (directThemeTokens || generatedThemeTokens) {
      pass('validate', 'Boss Ledger primary and link theme tokens are explicitly configured');
    } else {
      fail('validate', 'Table operations require explicit `colorPrimary`, `colorLink: #F36046`, and `colorLinkHover` tokens');
    }

    if (/\[data-boss-operation-column\][\s\S]{0,700}\{[^}]*color\s*:\s*(?:#F36046|var\(--boss-primary\))/i.test(source)) {
      pass('validate', 'Table operation column has a scoped primary-color CSS fallback');
    } else {
      fail('validate', 'Table operations require a scoped `[data-boss-operation-column]` primary-color CSS fallback');
    }
  } else {
    pass('validate', 'No Table operation column detected; operation theme-color checks skipped');
  }

  const hasRenderedTable = /(?:h|React\.createElement)\(\s*Table\b|<Table\b/i.test(source);
  const hasColumnSetting = /boss-column-setting-button/i.test(source) && /SettingOutlined/i.test(source);
  const hasFunctionalColumnSetting = hasColumnSetting && /\b(?:Dropdown|Popover)\b/i.test(source) && /\bCheckbox\b/i.test(source);
  if (hasRenderedTable && !hasFunctionalColumnSetting) {
    fail('validate', 'Every query-list Table must include functional SettingOutlined column settings using Dropdown/Popover plus Checkbox');
  } else if (hasRenderedTable) {
    pass('validate', 'Table includes mandatory functional column visibility settings');
  } else {
    pass('validate', 'No rendered Table detected; mandatory column-setting check skipped');
  }

  if (hasColumnSetting) {
    const columnSettingHasGrayBackground = /(?:column-setting|boss-column-setting-button)[^{}]{0,180}\{[^}]*background\s*:\s*(?:#FAFAFA|var\(--boss-tool-bg\))/i.test(source);
    const columnSettingKeepsSecondaryColor = /(?:column-setting|boss-column-setting-button)[^{}]{0,220}\{[^}]*color\s*:\s*(?:rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*\.45\)|#666|#595959|var\(--boss-tertiary\))/i.test(source);
    const columnSettingIconKeepsSecondaryColor = /\.boss-column-setting-button\s+(?:\.anticon|svg)[^{}]*\{[^}]*color\s*:\s*(?:rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*\.45\)|var\(--boss-tertiary\))/i.test(source);
    if (columnSettingHasGrayBackground && columnSettingKeepsSecondaryColor && columnSettingIconKeepsSecondaryColor && hasThemeCssValue('boss-tool-bg', '#FAFAFA') && hasThemeCssValue('boss-tertiary', 'rgba(0,0,0,.45)')) {
      pass('validate', 'Column setting Button and icon use #FAFAFA background with secondary text color in every state');
    } else {
      fail('validate', 'Column setting Button, .anticon, and SVG must keep secondary text color rgba(0, 0, 0, .45) in every state');
    }
  } else {
    pass('validate', 'No column-setting control detected; color checks skipped');
  }

  const persistentTableHelper = /\b(?:selection-hint|table-helper-copy|toolbar-helper-copy)\b/i.test(source)
    || /['"]请选择(?:订单|数据|记录)['"]/i.test(source)
    || /['"]请先选择['"]/i.test(source);
  if (persistentTableHelper) {
    fail('validate', 'Table toolbar must not render persistent selection/helper copy such as 请选择订单');
  } else {
    pass('validate', 'Table toolbar contains no persistent selection/helper copy');
  }

  const hasPaginationConfig = /pagination\s*:/i.test(source);
  if (hasPaginationConfig) {
    const compactPagination = /pagination\s*:\s*\{[^}]{0,500}\bsize\s*:\s*['"](?:small|mini)['"]/i.test(source)
      || /<Table\b[^>]*\bsize\s*=\s*['"](?:small|mini)['"]/i.test(source);
    if (compactPagination) {
      fail('validate', 'Pagination must use Ant Design default size; compact / mini sizing is forbidden');
    } else {
      pass('validate', 'Pagination uses Ant Design default size');
    }
  } else {
    pass('validate', 'No pagination config detected; pagination size check skipped');
  }

  const buttonIconMatches = [...source.matchAll(/<Button\b[^>]*\bicon\s*=\s*\{/gi)].map((match) => match[0]);
  const businessButtonIcons = buttonIconMatches.filter((block) => !/column-setting|列设置|aria-label/i.test(block));
  if (businessButtonIcons.length > 0) {
    fail('validate', 'Business action Buttons must be text-only; icons are reserved for icon-only tool affordances');
  } else {
    pass('validate', 'Business action Buttons do not use decorative icons');
  }

  const hasStatusColumn = /dataIndex\s*:\s*['"]status['"]|title\s*:\s*['"]状态['"]|状态列/i.test(source);
  if (hasStatusColumn) {
    if (/\bBadge\b|data-boss-status-badge/i.test(source)) {
      pass('validate', 'Table status column uses a Badge status-dot presentation');
    } else {
      fail('validate', 'Table status columns must use Badge status dot plus Chinese text');
    }
    if (/<Tag\b|\bTag\s*\(/i.test(source)) {
      fail('validate', 'Table status columns must not use Tag; use Badge status dot plus text');
    } else {
      pass('validate', 'Table status column does not use Tag');
    }
  } else {
    pass('validate', 'No Table status column detected; status presentation checks skipped');
  }

  const hasSummary = /(data-boss-query-summary|query-summary|查询统计|Statistic)/i.test(source);
  if (hasSummary) {
    const tableModuleContainsSummary = /(data-boss-table-module|table-module|table-panel|result-module|list-module)[\s\S]{0,3000}(data-boss-query-summary|query-summary|查询统计|Statistic)/i.test(source);
    if (tableModuleContainsSummary) {
      pass('validate', 'Query summary appears inside the table/result module in source order');
    } else {
      fail('validate', 'Query summary must be inside the table/result module, before Table and Pagination');
    }

    const lightweightSummary = usesTemplate('list.inline-summary')
      && /data-boss-query-summary[\s\S]{0,800}boss-result-summary-prefix[\s\S]{0,800}boss-result-summary-inline-value[\s\S]{0,800}boss-result-summary-inline-divider/i.test(source);
    const hasResultTitle = /(toolbar-title|result-title|list-title)[^>]*>[^<]*(查询列表|查询结果|列表数据)|>\s*(查询列表|查询结果|列表数据)\s*</i.test(source);
    if (lightweightSummary && hasResultTitle) {
      fail('validate', 'Lightweight query summary must not be rendered together with the result-section title');
    } else {
      pass('validate', 'Lightweight query summary and result-section title are not rendered together');
    }

    const lightweightSummarySharesToolbar = /className:\s*['"]boss-result-toolbar['"][\s\S]{0,800}className:\s*['"]boss-result-toolbar-left['"][\s\S]{0,800}summary[\s\S]{0,800}className:\s*['"]boss-result-toolbar-right['"]/i.test(source);
    if (lightweightSummary && lightweightSummarySharesToolbar) {
      pass('validate', 'Lightweight query summary shares the toolbar row with right-side actions');
    } else if (lightweightSummary) {
      fail('validate', 'Lightweight query summary must use the original left toolbar-title position and share the same row as right-side actions');
    }
  } else {
    pass('validate', 'No query summary detected; table-module summary placement is not applicable');
  }
}

if (!existsSync(previewPath)) {
  console.error(`preview.html not found: ${previewPath}`);
  process.exit(2);
}

const html = readFileSync(previewPath, 'utf8');
checkSource(appendLocalPreviewAssets(html, previewPath));

const statuses = {
  validate: groupStatus('validate'),
  charts: groupStatus('charts'),
  '中文文案': groupStatus('chineseCopy'),
};
const overall = Object.values(statuses).every((status) => status === 'pass') ? 'pass' : 'failed';

console.log(`validate: ${statuses.validate}`);
console.log(`charts: ${statuses.charts}`);
console.log(`中文文案: ${statuses['中文文案']}`);
console.log(`overall: ${overall}`);
console.log('');
console.log('details:');

for (const [group, checks] of Object.entries(result)) {
  for (const check of checks) {
    console.log(`- ${check.ok ? 'pass' : 'failed'} [${group}]: ${check.message}`);
  }
}

process.exit(overall === 'pass' ? 0 : 1);
