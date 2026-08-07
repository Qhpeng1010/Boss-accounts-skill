# 老板管账规则模板索引

> 由导演规则和生成策略自动生成。请勿直接编辑。

规则模板是选择规则，不是设计截图或布局实现。每个页面需求读取核心规则包和恰好一个所选页面族规则包。

| 页面方案 | 规则模板 ID | 页面族 | 当前状态 | 选择条件 |
| --- | --- | --- | --- | --- |
| 常规查询列表 | `list.regular` | `list` | available / page-spec-default | 需要按条件查找、比较或处理一组记录，且不需要页面级统计汇总。 |
| 行内汇总查询列表 | `list.inline-summary` | `list` | available / page-spec-default | 查询结果只需 1 至 2 个轻量指标，并且这些指标应服务于结果工具栏扫描。 |
| 统计卡片查询列表 | `list.card-summary` | `list` | available / page-spec-default | 查询结果需要 3 至 5 个重要指标，且统计不承担独立业务操作。 |
| 简短弹窗表单 | `form.modal-simple` | `form` | available / shadow | 6 个及以下相互独立字段，从来源页面发起且关闭后应保留来源上下文。 |
| 独立简单表单页 | `form.page-simple` | `form` | available / shadow | 从菜单、深链接、待办或独立任务进入；字段少且相互独立，不需要业务分组、右侧说明或步骤流转。 |
| 分组全页表单 | `form.grouped-page` | `form` | available / shadow | 字段超过 10 个，或存在多个可在同一阶段完成、但必须分别核对的业务分组。 |
| 带引导的简单表单 | `form.guided-simple` | `form` | available / shadow | 字段较少的单阶段资金、结算、开户或规则配置任务，右侧引导能直接帮助核对或理解业务影响。 |
| 分阶段与上传复核流程 | `form.staged-flow` | `form` | available / shadow | 后续工作依赖前一步完成，或需要上传、解析、复核、提交和结果反馈的明确阶段。 |
| 受控记录详情 | `detail.record` | `detail` | available / shadow | 只读查看一个业务对象；根据上下文连续性和信息规模选择 Modal、Drawer 或独立详情页。 |
| 流程结果反馈 | `result.workflow` | `result` | workflow-only / page-spec-only | 已知来源操作完成、失败、警告或处理中需要反馈和恢复动作；不能作为独立业务入口。 |
| 经营概览首页 | `dashboard.overview` | `dashboard` | available / page-spec-default | 主要任务是监控业务健康度、分布或趋势；使用统一数据范围、3 至 5 个核心指标、分布、趋势和排行，且不包含逐条查询或处理。 |
| 页面内状态 | `state.embedded` | `empty-state` | pending / page-spec-only | 空数据、错误、无权限或缺少前置条件属于来源页面的状态，不单独替代原页面家族。 |

## 选择边界

- 每个页面需求选择一个主规则模板。
- 结果或页面状态通常是所选主页面族中的流转或状态，不是第二个页面入口。
- 生成策略是可用性和已批准组合的最终权威。
