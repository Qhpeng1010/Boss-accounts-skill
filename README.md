# Boss Accounts Skill

独立的老板管账页面生成技能。它面向运营、商户、审核、财务、风控和系统管理等后台业务，通过受控的自然语言流程、稳定配方、固定渲染器和静态预检，生成可评审、可迁移的页面交付物。

本工程**仅生成老板管账业务页面**，不路由或生成其他产品、账户系统、开放平台或通用业务页面。

## 快速开始

用业务语言描述页面需求：

```bash
node scripts/generate-page.mjs --request "<老板管账页面需求>"
```

仅在明确使用 `/yeepay:fast` 时追加 `--recipe auto`。统一入口会在一次调用中返回页面方案、路由元数据、MCP 回执路径和后续命令；不要再次路由或重新执行入口来获取上下文。生成前必须通过 Design MCP 读取最小上下文并验证采信的知识包，将原始响应记录为可校验回执，不得回退读取仓库内的旧知识副本。`--mcp-verified` 必须携带真实回执路径，不能作为无值布尔开关使用。

例如：

```text
所属模块：商户管理
使用者：运营人员
主要任务：查询、核对和处理商户记录
查询条件：商户名称、商户编号、部门名称
列表字段：商户编号、商户名称、直属代理、状态、注册时间
允许操作：查看详情、停用
风险要求：停用前须说明对象、影响和操作后状态
```

## 生成流程

老板管账页面以 Page Spec 为唯一可编辑规格，并由固定渲染器构建预览：

```text
业务需求
  -> 统一入口识别页面意图和可用能力
  -> 通过 Design MCP 读取并验证最小上下文
  -> 填写 page-spec.json
  -> 固定渲染器生成预览
  -> 需求覆盖、规格契约与静态预检
  -> 人工验收
  -> 交付
```

入口返回的状态含义如下：

- `natural-generation`：使用已验证的 Design MCP 上下文和返回的本地命令完成 Change 的规格、构建与静态预检。
- `awaiting-mcp`：快速配方已完成分类，但必须先完成 Design MCP 上下文读取和知识包验证，再执行返回的快速命令。
- `generated`：快速配方已生成页面、完成构建和静态预检，无需重复构建。
- `clarify`：仅补充返回的业务问题。
- `blocked`：缺少可执行的规格、渲染器或基础设施，需要补齐实际能力。

静态预检不等同于人工验收。当前不提供浏览器自动交互、截图或像素级验收；预览在业务或设计人员明确确认前均视为待验收。

已存在但尚无 `page-spec.json` 的 prepared 列表 Change，可以在 MCP 回执验证通过后把原目录作为 `--change` 传给快速命令恢复生成。普通列表配方仍只创建新目录，且不会覆盖已有 Page Spec。

## 目录说明

```text
boss-accounts-skill/
├── SKILL.md                  生成、交付与边界说明
├── README.md                 本说明
├── modules/
│   ├── boss-ledger/          老板管账规则、固定 Shell 与执行能力
│   │   ├── director-rules/   视觉、模板与交互验收规则
│   │   ├── execution/        策略、规格、上下文、主题与固定渲染器
│   │   ├── shell/            固定后台壳层
│   │   ├── business-rules.md 业务字段、状态、权限与结果规则
│   │   └── domain.json       页面意图与执行配置
│   └── shared/               通用产品说明与浏览器运行时
├── scripts/                  生成、构建、校验和发布检查工具
├── changes/                  每次页面需求的独立交付目录
└── agents/                   默认执行代理配置
```

## 老板管账规则

[导演规则](modules/boss-ledger/director-rules/README.md)是本地执行资产的维护源，不是页面生成时的知识入口。页面生成必须使用已验证的 Design MCP 上下文；这些本地文件仅用于维护现有策略、编译产物和静态校验，不能在 MCP 不可用时作为回退知识副本。维护内容分为三部分：

1. `01-visual-constitution.md`：全局视觉气质、色彩、字体、密度、圆角和组件原则。
2. `02-template-application-rules.md`：页面家族的选择条件、组合方式和禁用组合。
3. `03-interaction-acceptance-rules.md`：用户流程、状态、权限、危险操作确认和验收要求。

单页字段、样例数据、文案和默认值只写入对应 Change 的 `page-spec.json`。通用规则变更必须增加 Rule ID 和验收场景，并由研发同步执行层能力与校验。

| 目标 | 唯一维护位置 | 不应直接修改 |
| --- | --- | --- |
| 全局视觉、组件气质与响应式原则 | `modules/boss-ledger/director-rules/01-visual-constitution.md` | `execution/theme/` 生成物、单页预览 |
| 页面家族、模板选择与页面组合 | `modules/boss-ledger/director-rules/02-template-application-rules.md` | 生成后的模板目录 |
| 流程、状态、权限、危险确认与验收 | `modules/boss-ledger/director-rules/03-interaction-acceptance-rules.md` | 生成的 HTML、CSS、JavaScript |
| 单页字段、数据、文案与默认值 | 当前 Change 的 `page-spec.json` | 跨页面导演规则 |
| 固定导航、Tabs、Footer 与运行时 | 先更新规则，再由研发同步 `shell/` | 单页 Page Spec |

`execution/` 下的策略、Schema、断言、主题和渲染器是执行实现，不是第四套设计规则。不要手改生成页面中的 `preview-app.js`、`business.css` 或 `preview.html` 来解决通用规则问题。

## 自由组合与稳定配方

老板管账支持两种生成方式：

- **自由组合**：需求未命中已验证配方时，依据导演规则和当前开放能力组合页面。适用于新的业务场景，生成后需要人工验收。
- **稳定配方**：对已人工验收、结构稳定且可由有限参数表达的页面，使用确定性解析和编译快速生成。

配方不取代规则，也不应静默遗漏原始需求中的字段、操作或流程。新页面组合先以自由组合完成并通过人工验收，再记录固定结构、可变参数、边界和回归样例后，才可登记为稳定配方。

回归资料位于 [场景回归目录](modules/boss-ledger/execution/scenarios/README.md)：

- `recipe-regression-prompts.md`：稳定配方和参数边界回归。
- `rule-combination-prompts.md`：导演规则驱动的自由组合回归。
- `manual-regression-prompts.md`：表单、列表、详情和结果流程的人工回归。

## Change 交付目录

每个页面需求对应一个 `changes/YYYYMMDD-功能名称/` 目录，常见内容如下：

```text
changes/YYYYMMDD-功能名称/
├── proposal.md               需求理解和范围
├── page-design.md            页面方案与规则选择
├── tasks.md                  实施任务
├── implementation.md         实现说明
├── page-spec.json            唯一可编辑的页面规格
├── page-spec-checklist.md    已选规则与能力检查清单
├── preview.html              可直接打开的页面预览
├── vendor/                   预览所需的本地浏览器依赖
└── review.md                 静态预检结果与人工验收记录
```

构建默认通过硬链接将所需浏览器依赖写入 Change 的 `vendor/` 目录，避免历史页面重复占用磁盘；需要完全独立的交付副本时增加 `--portable`，移动后仍可打开 `preview.html` 评审。

## 依赖与重建

React、ReactDOM、Ant Design、Ant Design Icons、Day.js、Lodash 与 Ant Design Charts 的版本由根目录 `package.json` 和 `package-lock.json` 锁定。重新安装并生成浏览器运行时：

日常页面生成直接使用仓库内已构建的浏览器运行时，不需要安装 `node_modules`。只有升级前端依赖、调整图标集合、修改运行库构建逻辑或发布 Skill 时，才需要执行以下维护命令：

```bash
npm ci
npm run build:runtime
npm run check:runtime
```

共享规则、主题、固定渲染器、Shell 或浏览器运行时升级后，运行：

```bash
npm run rebuild:history
```

该命令会重建所有历史页面并执行静态预检；使用 `npm run rebuild:history -- --strict` 可同时执行严格治理校验。

## 规则变更后的检查

修改导演规则、策略或规格能力后，至少执行：

```bash
node scripts/build-boss-ledger-context-packs.mjs
node scripts/check-boss-ledger-generation-policy.mjs
node scripts/refresh-boss-ledger-release-manifest.mjs
node scripts/verify-boss-ledger-release-manifest.mjs
node scripts/validate-boss-ledger-page-spec-system.mjs
```

规则发布还应同步更新受影响的策略、关键规则断言、回归样例和 `release-manifest.json`。发布指纹不一致时，系统会阻止构建交付。

## 常见问题

### 为什么页面不能生成？

未命中配方、未登记组合或治理策略状态并不会单独阻止受控自然语言生成。实际阻塞通常只有三类：所属模块或关键业务决策缺失、没有对应的可执行规格或渲染器、规格或构建错误导致无法形成可验收预览。入口会明确区分需要澄清、治理告警和真实阻塞。

### 为什么改了导演规则，页面没有变化？

视觉 Token 和逻辑模板目录会自动编译；如果变更涉及新的组件能力、页面结构或自动化检查，还需要同步扩展策略、规格校验、固定渲染器和回归样例。

### 页面预览可以直接打开吗？

可以。Change 中的 `preview.html` 是可独立打开的评审预览，默认仅通过静态预检，仍需要人工验收，不是生产前端工程。
