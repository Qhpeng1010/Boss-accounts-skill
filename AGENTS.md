# Boss Accounts Skill Instructions

For a new Boss Ledger page request, 先读取 `SKILL.md`，再只运行一次统一入口：

```text
node scripts/generate-page.mjs --request "<original request>"
```

The standalone skill is already scoped to Boss Ledger. The returned JSON is the only routing context. On `natural-generation`, call `design_get_context_pack({ serviceId, family })` exactly once before authoring, verify every accepted package with `knowledge_check_verification({ ref: "package:<packageId>" })`, then record the raw responses using `references/design-mcp-evidence.md` at the returned `mcp.receiptPath`. Use only the verified MCP context and the returned local execution commands; do not read the returned local knowledge resources. On `/yeepay:fast`, add `--recipe auto`; an `awaiting-mcp` result is only classified, so after the same MCP evidence gate execute its returned `commands.fast` exactly once. `--mcp-verified` requires the validated receipt path and a bare flag is invalid. Only a `generated` result has completed the build and static preflight.

不得再次路由、扫描全部规则包、读取历史 Change、修改固定渲染器，或使用通用 UI 指引替换已路由的页面方案。Design MCP 不可达或知识包验证失败时立即停止并报告；不得静默读取 `director-rules/`、本地 `context-packs/` 或其他仓库知识副本。通用技能或工具只能辅助执行已路由的方案，不能成为页面结构或视觉决策的额外输入。Existing Change work does not create a new Change or rerun the entry. Preserve the 1-2 inline and 3-5 card rule for query-list statistics.

An existing prepared list Change can resume through the verified fast command only when it is `blocked` or `ready-for-page-spec` and has no `page-spec.json`; pass it with `--change`. The normal list compiler still requires a nonexistent Change directory.

Every build packages local browser dependencies under the Change `vendor/` directory. After shared-rule upgrades, run `npm run rebuild:history` before delivery. Only static preflight is available; do not claim human acceptance without explicit confirmation.
