---
name: boss-accounts-skill
description: Generate, design, update, and statically validate Boss Ledger (老板管账) business pages. Use when requests concern Boss Ledger lists, forms, details, dashboards, staged workflows, result pages, or an existing Boss Ledger Change that needs review.
---

# Boss Accounts Skill

Use this standalone skill only for Boss Ledger. It retains the established controlled natural-language flow, optional fast recipes, fixed renderer, and static preflight.

## Generate A New Page

1. Read this file, then run the unified entry exactly once:

   ```text
   node scripts/generate-page.mjs --request "<original request>"
   ```

   Use `--recipe auto` only when the user explicitly requests `/yeepay:fast`. Do not run the entry again to retrieve route, resources, commands, or timings.

2. Handle the returned status:
   - `natural-generation`: Read only its returned Markdown resources. Write the Change artifacts, then run the returned coverage, contract, build, and static-preflight commands in order.
   - `generated`: The fast recipe has already generated, built, and statically checked the Change. Do not reroute or rebuild it.
   - `clarify`: Ask only the returned business question.
   - `blocked`: Report the real missing specification, renderer, or infrastructure condition.

3. 页面方案只决策一次。不得再次路由、扫描全部规则包、读取历史 Change、读取固定渲染器源代码，或使用通用 UI 技能重新选择页面结构。

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
