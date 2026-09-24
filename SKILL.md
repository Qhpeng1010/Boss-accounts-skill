---
name: boss-accounts-skill
description: Generate, design, update, and statically validate Boss Ledger (老板管账) business pages. Use when requests concern Boss Ledger lists, forms, details, dashboards, staged workflows, result pages, or an existing Boss Ledger Change that needs review.
---

# Boss Accounts Skill

Use this standalone skill only for Boss Ledger. It retains the established controlled natural-language fallback, verified recipes, fixed renderer, and static preflight.

## Generate A New Page

1. Read this file and prepare the request from the user's instructions and conversation context, then only run the unified entry once (`只运行一次统一入口`):

   ```text
   node scripts/generate-page.mjs --request "<request with resolved requirements>"
   ```

   Interpret whether and what to supplement from the full user intent, including restrictions, without requiring particular phrases. Preserve declared fields, operations, and workflows; use business context for reasonable missing details within the requested scope, and record additions as assumptions alongside the original request in the Change. Clarify only unresolved decisions that materially affect the business task. Submit the resolved requirements to the entry as explicit fields and steps; when no supplements are needed, pass the original request unchanged.

   The unified entry automatically classifies the request against the verified recipes: query list, list plus simple create, list plus staged create, and standalone staged configuration. A matching request uses the recipe in the same call; a non-matching request falls back directly to controlled natural generation. `--recipe auto` explicitly selects the default behavior; `--recipe off` is reserved for intentional natural-generation use or diagnostics. The executable bridge only canonicalizes equivalent wording; it never fills business fields or steps from trigger phrases. Do not treat an unknown row operation as a recipe failure or retry routing.

2. Handle the returned status:
   - `natural-generation`: Read only its returned Markdown resources. Write the Change artifacts, then run the returned coverage, contract, build, and static-preflight commands in order.
   - `generated`: The fast recipe has already generated, built, and statically checked the Change. Do not reroute or rebuild it.
   - `clarify`: Ask only the returned business question.
   - `blocked`: Report the real missing specification, renderer, or infrastructure condition.

3. 页面方案只决策一次。不得再次路由、扫描全部规则包、读取历史 Change、读取固定渲染器源代码，或使用通用 UI 技能重新选择页面结构。通用技能和工具只能辅助执行已路由的方案，不能替换页面结构或视觉决策。

## Linked List And Task Tabs

- 列表发起的新增、编辑或配置可以使用应用内 Shell Tab。当前能力会在同一个 Boss Ledger 工作区打开可关闭的新任务 Tab，保留来源列表的查询条件、分页和临时状态，提交后可返回并刷新来源列表。
- 快速列表配方保留用户声明的全部行操作。查看详情、编辑/修改和删除等已知别名会映射到对应交互；启用/禁用、更多操作及其他未登记业务操作也会作为可点击的通用行操作生成，若需求同时声明状态字段和确认影响则沿用状态变更确认交互，不因操作名称陌生而回退或丢失。
- 统一入口对每个整理后的需求最多尝试一次快速配方；脚本不根据固定词补齐业务字段。如果需求声明多个业务信息分组，简单全页配方不得压缩分组，直接转入自然语言生成，由分组表单方案承载。
- 这里的“新标签页”指应用内 Shell Tab，不是浏览器 `window.open`、操作系统窗口或外部浏览器标签。请求包含列表字段、查询条件和“新标签页/新 Tab/全页表单”等完整信息时，统一入口会选择已验证的列表加全页表单流程；信息不足时才会要求补充。
- 不要把“当前没有浏览器自动化”误写成“不支持新标签页”。静态预检不会替代人工点击验收，但 Shell Tab 的路由与回退属于固定运行时能力。

## Delivery And Upgrades

- 查询列表的列设置遵循当前 `BL-TPL-016`：浮层总宽度为 `200px`（含四周 `12px` 内边距），所有列（包括操作列）默认可显示/隐藏、重置和拖拽排序；拖拽顺序必须同步到表格，列名超长单行省略，六点拖拽图标为 `16px`，图标与文字间距为 `8px`。
- Every Change receives a physical `vendor/` directory containing its required browser dependencies. A preview is therefore portable and does not rely on a link back to this skill project.
- Local previews use linked vendor files by default; only pass `--portable` when the Change must be copied to another environment.
- After upgrading shared rules, theme, renderer, Shell, or browser runtime, run:

  ```text
  npm run rebuild:history
  ```

  This rebuilds every `changes/*/page-spec.json` and runs static preflight. Add `-- --strict` to enforce governance checks as well.
- Use the Page Spec as the only editable implementation source. Never hand-edit the fixed renderer, Shell, theme, or generated preview.
- For list statistics, use an inline toolbar summary for one or two items and statistic cards for three to five items.
- Keep static preflight and human acceptance separate. Boss Ledger has no browser automation, screenshot, or pixel acceptance. Previews remain pending human acceptance unless the user explicitly confirms them.
- Existing Change reviews or modifications do not create a new Change or rerun the unified entry.
- 面向业务用户的最终回复不得出现 `form.*`、`list.*`、`detail.*`、页面族、策略或 Page Spec 等工程术语。
