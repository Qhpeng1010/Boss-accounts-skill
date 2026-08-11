# Boss Ledger Domain

Boss Ledger 是易宝运营、商户、审核、财务、风控、客服和系统配置类后台的业务域。

## Route Boundary

- 运营后台、商户后台、审核、查询、配置、Dashboard、表单、详情和步骤流程进入本模块。
- YOP、开放平台、API/SDK 文档、错误码和接入指南不进入本模块。
- 未指定平台时先询问所属服务，不得因为“列表”“表单”“查询”等通用页面词默认路由到本模块。

## Progressive Loading

`domain.json` 是页面意图的机器路由合约。不要直接扫描所有 `modules/`；运行 `scripts/resolve-resources.mjs` 后，只读取当前阶段返回的 Markdown 路径。

对单一且已开放的页面，首次使用 `--stage generate` 路由，只读取 `core.md`、`index.md` 和恰好一个页面族规则包。已路由后不得再分类、扫描历史 Change、读取其他模块或旧模板、使用通用 UI 技能重选页面类型，或逐段阅读固定渲染器；路由不明确或能力缺失时才退出快路径。

Boss Ledger 始终使用 `modules/boss-ledger/shell/` 的固定壳层。它是执行资产，不是需要逐文件读入上下文的设计规范。

## Director And Execution Boundary

- `director-rules/` 是 Boss Ledger 唯一的人类可读设计决策层。
- `execution/generation-policy.json` 声明当前页面族能力与 `shadow / page-spec-default / page-spec-only` 模式。
- `execution/page-spec.schema.json` 与语义验证器阻止非法组合。
- `execution/renderer/` 从 `page-spec.json` 确定性生成业务页面并复用 canonical Shell。
- `execution/release-manifest.json` 绑定规则、策略、契约、渲染器与 Shell 版本。
- adapter 返回的需求覆盖命令在构建前逐项核对原始需求，防止字段、操作或流程被静默删除。

当前 `list` 与 `dashboard` 默认使用 Page Spec；`form` 和 `detail` 处于 shadow；独立 `result` 与 `empty-state` 尚未作为独立入口开放。列表内新增或编辑属于 `list` 的受控组合，不作为脱离来源上下文的独立抽屉表单入口。

页面选择对业务用户使用中文方案名称，例如“分阶段配置流程”；`form.staged-flow` 等实现模板 ID 只出现在 `page-design.md`、Page Spec 和执行证据中。
