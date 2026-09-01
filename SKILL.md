---
name: boss-accounts-skill
description: Generate, design, update, and statically validate Boss Ledger (老板管账) business pages. Use when requests concern Boss Ledger lists, forms, details, dashboards, staged workflows, result pages, or an existing Boss Ledger Change that needs review.
---

# Boss Accounts Skill

Use this standalone skill only for Boss Ledger. It retains the established controlled natural-language flow, optional fast recipes, fixed renderer, and static preflight. Design and business knowledge comes from Design MCP; the local repository remains the execution layer.

## 生成前置：最小 Design MCP 上下文

For every new page, run the local unified entry exactly once before any generation work:

```text
node scripts/generate-page.mjs --request "<original request>"
```

Use `--recipe auto` only when the user explicitly requests `/yeepay:fast`. Treat that one JSON response as the complete local route result and retain:

- `serviceId`: `boss-ledger` (also returned as `route.serviceId`)
- `family`: the returned `route.family`
- `commands`: the returned local execution commands

Do not run the local entry again to retrieve route, resources, commands, or timings. Before generating or reading any design guidance, call exactly once:

```text
design_get_context_pack({ serviceId, family })
```

The context response is the only design-context entry point. Do not list or scan all knowledge packages first. The allowed package IDs are:

- `boss-ledger-domain-overview`
- `boss-ledger-business-core`
- `boss-ledger-design-visual`
- `boss-ledger-design-page-selection`
- `boss-ledger-interaction-acceptance`
- `boss-ledger-context-core`
- `boss-ledger-context-dashboard`
- `boss-ledger-context-detail`
- `boss-ledger-context-form`
- `boss-ledger-context-list`
- `boss-ledger-context-result`
- `boss-ledger-context-empty-state`
- `shared-requirement-product-core`

Before accepting any package returned by the context pack or a later MCP call, verify it with the package URI form (never the bare package ID):

```text
knowledge_check_verification({ ref: "package:<packageId>" })
```

Use a package only when that check succeeds. A missing, failed, unverifiable, or stale check is a hard stop. The `ref` value must never be a bare package ID.

Record the raw context response and every raw verification response using [Design MCP Evidence](references/design-mcp-evidence.md). The unified entry returns the receipt destination in `mcp.receiptPath`. Validate and normalize the receipt before local preflight:

```text
node scripts/record-boss-ledger-mcp-receipt.mjs --input <raw-receipt.json> --output <mcp.receiptPath> --request "<original request>" --family <family>
```

`--mcp-verified` takes this receipt path as its value; a bare flag or a prose assertion is not evidence.

Only when the routed request needs more detail, call the corresponding Design MCP tool, and verify the package before using its response:

- rule text: `design_get_rule({ serviceId, packageId, ruleId })`
- template options: `design_list_templates({ serviceId, packageId, family })`
- theme tokens: `design_get_theme_tokens({ serviceId, packageId })`
- acceptance scenarios: `design_get_acceptance_scenarios({ serviceId, packageId })`

If Design MCP is unreachable, returns an error, or any verification fails, stop and report the condition. Never silently read `director-rules/`, local `context-packs/`, or another repository knowledge copy as a fallback. The MCP context is authoritative for domain, business, design rules, templates, theme tokens, and acceptance scenarios.

## 本地执行层

Always keep these local and unchanged: `generation-policy`, Page Spec schema, scripts, fixed renderer, Shell, theme runtime, browser runtime, and static preflight. MCP supplies knowledge only; it does not replace local routing, Page Spec authoring, rendering, building, or verification.

## Generate A New Page

1. Use the verified MCP context and the original request to make the page-solution decision once. Do not route again, scan all rule packages, read historical Changes, inspect fixed renderer source, or use a generic UI guide to choose a different structure.

2. Handle the returned status:
   - `natural-generation`: Use only the verified MCP context and route metadata. Write the Change artifacts, then run the returned local coverage, contract, build, and static-preflight commands in order.
   - `awaiting-mcp`: The fast recipe has only been classified. After the MCP context and all package verifications succeed, execute the returned `commands.fast` exactly once. That command carries the original single-route context and returns `generated`; do not reroute.
   - `generated`: The fast recipe has generated, built, and statically checked the Change after the MCP gate. Do not reroute or rebuild it.
   - `clarify`: Ask only the returned business question.
   - `blocked`: Report the real missing specification, renderer, infrastructure, or MCP condition.

3. 页面方案只决策一次。不得再次路由、扫描全部规则包、读取历史 Change、读取固定渲染器源代码，或使用通用 UI 技能重新选择页面结构。

4. An existing prepared list Change may resume only when it has `generation-state.json`, has no `page-spec.json`, and is `blocked` or `ready-for-page-spec`. Pass that exact path with `--change` to the verified fast command. The ordinary list recipe continues to require a new directory and never overwrites a Page Spec.

## Delivery And Upgrades

- Every Change receives a physical `vendor/` directory containing its required browser dependencies. A preview is therefore portable and does not rely on a link back to this skill project.
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
