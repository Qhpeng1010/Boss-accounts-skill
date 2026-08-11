# Boss Ledger 场景回归目录

本目录保存老板管账的人工提示词和可执行规格基线。提示词用于新的 AI 对话中回归自然语言路由、页面生成和人工验收；规格基线用于静态契约与发布检查。

自由组合页面是否晋级为固定配方，按 [自由组合晋级配方流程](../../../../workflows/recipe-promotion.md) 由设计师决定。

## 文件分工

- [recipe-regression-prompts.md](./recipe-regression-prompts.md)：已通过人工验收的参数化配方提示词。需求应命中统一入口的快速生成配方，重点验证字段解析、数量阈值和配方内可选操作。
- [rule-combination-prompts.md](./rule-combination-prompts.md)：根据导演规则组合页面能力的人工提示词。它们用于验证列表统计、批量、展开子表、详情分组、表单分组等组合，不默认命中快速配方。
- [manual-regression-prompts.md](./manual-regression-prompts.md)：15 个业务场景的完整人工回归集，覆盖表单、列表、详情和结果流程。
- [component-regression-prompts.md](./component-regression-prompts.md)：组件专项人工回归集，补充复杂表单控件和列表分类/更多操作的可用性验证；不修改已验收的 15 条业务基线。
- [capability-scenarios.mjs](./capability-scenarios.mjs)：可执行的 Page Spec 场景基线，由静态契约和能力场景检查使用。
- [legacy-template-coverage-prompts.md](./legacy-template-coverage-prompts.md)：历史模板覆盖提示词，仅用于补充旧项目回归，不作为当前页面规则来源。

配方提示词和规则组合提示词都必须保持业务表达，不写模板编号、代码或构建命令。配方已通过人工验收后，才可登记到生成策略的稳定组合中。
