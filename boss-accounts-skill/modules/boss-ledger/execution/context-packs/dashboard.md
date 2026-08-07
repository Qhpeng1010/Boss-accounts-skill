# 老板管账首页规则包

> 由导演规则编译。请勿直接编辑。

## 当前策略

- 页面族：`dashboard`
- 状态：available / page-spec-default
- 已开放能力：`dashboard.scope`、`dashboard.metrics`、`dashboard.distribution`、`dashboard.trend`、`dashboard.ranking`

## 可选方案

### 经营概览首页

- 规则模板：`dashboard.overview`
- 适用条件：主要任务是监控业务健康度、分布或趋势；使用统一数据范围、3 至 5 个核心指标、分布、趋势和排行，且不包含逐条查询或处理。
- 规则：
- `BL-TPL-002` `dashboard-family`（经营概览家族） 只有主要任务是监控业务健康度、分布或趋势时才使用 Dashboard。表格上方有少量汇总数据并不等于 Dashboard。
- `BL-TPL-020` `dashboard-boundary`（经营概览边界） Dashboard 只服务于跨记录的经营监控。它必须使用统一的数据范围控件、3 至 5 个核心指标，并至少包含一个分布、一个趋势和一个排行视图；不能混入查询结果表格、分页、行操作或批量操作。需要逐条查询、核对或处理记录时，改用查询列表。
- `BL-INT-001` `information-hierarchy`（信息层级） 按任务依赖关系排列信息：页面上下文、必要摘要、查询或输入、主要结果、行级或后续操作、补充说明。统计和装饰不得把主要任务挤出首个有效视口。
- `BL-INT-015` `dashboard-scope-consistency`（概览范围一致性） Dashboard 的数据范围控件必须同时作用于全部指标和图表；页面首屏优先展示范围、核心指标和最重要趋势，分布与排行作为同一监控任务的补充。Dashboard 不得借用查询条件、结果表格或分页来承载逐条业务操作。
