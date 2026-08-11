# 老板管账视觉宪法

## 产品气质

**BL-VIS-001** `product-register`（产品气质） 老板管账是安静、高密度、以任务为中心的运营系统。页面必须体现可靠和高效，不能做成营销页、插画页或装饰性页面。

**BL-VIS-002** `application-shell`（应用框架） 固定 Boss Ledger Shell 负责顶部信息栏、一级导航、侧边导航、收起控制、Tabs、工作区和 Footer。Footer 必须作为浅灰独立底栏，以顶部细分割线与内容区分隔，不能与白色任务模块融合。业务页面可以配置导航内容，但不得重新绘制 Shell 的结构或样式。

## 色彩

**BL-VIS-003** `brand-primary-color`（品牌主色） 品牌主色与主要操作色为 `#F36046`，Hover 为 `#D94E36`。它只用于唯一主操作、导航选中态、分页选中态、查询日期快捷项选中态和重要任务链接；需要背景的选中态使用同色系低强调选中背景，不可作为大面积装饰色。

**BL-VIS-004** `semantic-color-surface`（语义色与表面） 工作区使用浅中性灰背景，任务模块使用白色。文字采用深中性层级，边框和分隔线保持低对比度。成功、警告、错误、处理中和默认状态使用稳定语义色，不能只依赖颜色传达含义。

## 字体与密度

**BL-VIS-005** `typography-density`（字体与密度） 使用系统中文无衬线字体栈。默认业务文字为 `14px`，紧凑辅助文字可为 `12px`，模块标题通常为 `16px`。禁止使用 Hero 级标题、负字距和营销式排版。

**BL-VIS-006** `content-resilience`（内容容错） 优先保证紧凑且易读的信息密度和稳定对齐。过长的 Label、值和表格单元格必须换行、省略并提供完整提示，或给出足够列宽；不得覆盖其他控件。

## 间距、圆角与表面

**BL-VIS-007** `surface-restraint`（表面克制） 默认圆角为 `4px`，边框克制，阴影最小化。禁止大圆角卡片、玻璃效果、装饰渐变和卡片中嵌套装饰卡片。

**BL-VIS-008** `workspace-spacing`（工作区间距） 工作区内边距为 `16px`。独立任务模块各自使用 `16px` 内边距，模块间距为 `16px`。单一任务表面保持白色，多个独立任务表面之间应露出中性工作区背景。

**BL-VIS-009** `card-boundary`（卡片边界） `Card` 用于指标、重复对象和真正需要框定的任务单元。分组全页表单中的每个业务信息组都是独立核对单元：工作区保持浅中性灰背景，首个组紧贴当前 Tab 下方，组本身使用无边框、无标题分隔线的白色承载面，后续组之间露出工作区背景；每组四周内边距为 `20px`，标题与首行表单的间距为 `20px`，组内不再嵌套装饰性 `Card`。简单表单、带引导表单和同一任务表面内的轻量子分组默认使用 `Divider`，不能因为有标题就自动套 Card。

## 组件

**BL-VIS-010** `component-integrity`（组件完整性） 必须使用真实的 Ant Design 组件。页面不得用手写 HTML 模仿输入框、表格、下拉、抽屉、弹窗、分页或结果页。规则、Page Spec 和验收材料引用官方组件时，必须直接使用其 Ant Design 名称；引用自定义实现时，使用下表定义的中文语义名和稳定英文标识，不能用模板 ID、泛化英文或 CSS 样式描述代替组件名称。

### 组件分类与命名

| 使用语义 | 分类 | 规则、Page Spec 与验收中的写法 | 稳定实现标识 | 说明 |
| --- | --- | --- | --- | --- |
| 表单和字段 | Ant Design 官方组件 | `Form`、`Form.Item`、`Input`、`InputNumber`、`AutoComplete`、`Select`、`Cascader`、`TreeSelect`、`Checkbox`、`Radio`、`Switch`、`DatePicker`、`TimePicker`、`Transfer`、`Upload` | Ant Design 原组件名 | 表单字段、校验和输入控件直接使用官方名称；`Cascader` 与 `TreeSelect` 使用保留层级的选项数据，`Checkbox` 可表示单个布尔字段或多项选择，`Transfer` 用于明确的待选/已选对象分配。 |
| 任务操作 | Ant Design 官方组件 | `Button`、`Tooltip`、`Popover`、`Dropdown`、`Modal`、`Drawer` | Ant Design 原组件名 | 操作、提示和浮层直接使用官方名称；多个同级次要操作可收纳在 `Dropdown`，不能隐藏主操作或危险操作。 |
| 查询和记录结果 | Ant Design 官方组件 | `Table`、`Pagination`、`Badge`、`Tag`、`Empty`、`Spin`、`Alert` | Ant Design 原组件名 | 表格、分页、状态和页面内反馈直接使用官方名称；`Badge` 表示处理状态，`Tag` 表示类型、模式、渠道等离散分类，不能相互替代。 |
| 信息分组与指标 | Ant Design 官方组件 | `Divider`、`Card`、`Statistic` | Ant Design 原组件名 | `Divider` 用于同一任务表面内的普通信息组分隔；`Card` 仅用于指标、重复对象和需独立框定的业务组。 |
| 详情、流程和结果 | Ant Design 官方组件 | `Descriptions`、`Steps`、`Tabs`、`Statistic`、`Result` | Ant Design 原组件名 | 详情分组、流程、指标和基础结果直接使用官方名称。 |
| 业务引导区 | 自定义 React 组件 | 业务引导区（`BusinessGuide`） | `BusinessGuide` | 仅服务带引导的简单表单；它不是独立页面模板。 |
| 结果信息区 | 自定义 React 组件 | 结果信息区（`ResultSummary`） | `ResultSummary` | 与 `Result` 组合，承载多项金额、数量或处理明细。 |
| 结果反馈区 | 自定义 React 组件 | 结果反馈区（`ResultFeedback`） | `ResultFeedback` | 与 `Result` 组合，位于操作之后且不阻断主路径。 |

**BL-VIS-011** `action-hierarchy`（操作层级） 一个工作流只能有一个视觉上最突出的 `Button` 主操作。次要 `Button` 保持克制；危险操作必须独立、命名清楚并说明业务影响后再确认。

**BL-VIS-012** `query-form-layout`（查询条件布局） 查询列表的查询条件使用 `Form` 和 `Form.Item` 的标签右对齐横向布局。普通查询条件必须作为不可拆分的“Label + 控件”单元，在响应式栅格内横向平铺：宽屏使用 3 列、中等宽度使用 2 列、窄屏使用 1 列，列宽随容器等分变化；同一栅格列内 Label 按自身内容宽度占位且不得截断，同组控件使用剩余宽度并相应缩短，不使用跨字段的固定标签列。最后一行保留未使用的栅格列，已存在条件不得为了填满整行而变宽；各行的列起点保持左对齐。查询、重置和展开/收起操作参与同一栅格计算，操作区位于最后一列，操作行最小高度为 `32px`。查询任务模块的底部内边距固定为 `16px`；字段行间距由查询网格统一控制为 `16px`，末行字段不得再保留额外底部外边距。查询区有日期范围时，只有字段顺序中的首个日期范围可作为首个独立行：日期控件按内容保持紧凑，最小宽度为一列普通查询条件，不能拉伸填满整行；业务未指定其他周期时，默认值为“今日”，其右侧提供“今日”“近 7 日”“近 30 日”快捷项。当前范围对应的快捷项必须使用主色文字与同色系低强调选中背景，未选中项保持中性文字。其余日期范围一律作为普通查询栅格字段，仅使用 Ant Design `DatePicker.RangePicker`，不展示快捷项也不自动设为“今日”。业务明确要求不展示快捷项时，首个日期范围同样使用标准 `DatePicker.RangePicker`；字段可声明 `showPresets: false`。此规则只适用于查询列表的筛选区，不适用于新增、编辑、配置或提交等通用表单。

**BL-VIS-022** `business-form-layout`（通用表单布局） 新增、编辑、配置、提交和步骤流程中的可编辑字段按当前编辑范围的字段数布局。独立表单页不超过 6 项时，`Form.Item` 的 Label 与输入控件左右排列，表单标签列固定为 `136px` 并且不得截断，字段单列纵向堆叠；超过 6 项时，Label 在上、输入控件在下，字段按容器宽度使用 2 至 3 列网格平铺。`Modal` 仅承载不超过 6 项的表单，使用左右 Label/输入控件和单列堆叠；超过 6 项必须改用 `Drawer`。所有新增和编辑 `Drawer` 的 Label 必须在输入控件上方；不超过 8 项时字段单列纵向堆叠，超过 8 项时使用 2 列字段网格。抽屉内表单内容左右内边距固定为 `24px`。步骤表单按当前步骤的字段数判断，分组表单按全部可编辑字段数判断。窄屏时所有通用表单重排为 Label 在上、字段单列，且不得产生整页横向滚动。此规则不定义查询列表的日期范围、快捷条件或展开/收起行为。

**BL-VIS-013** `table-surface`（表格工作表面） `Table` 是紧凑、易扫描的工作表面，应有低强调表头、稳定列对齐、右侧操作列；`Pagination` 必须归属于结果模块。结果工具栏固定分为左右两区：左侧承载 1 至 2 项简单统计，未声明简单统计时展示业务结果名称；右侧承载新增、导出、刷新等结果操作，不能与左侧统计混排。简单统计必须以“查询统计：”作为左侧前缀；每项由指标名称、主色数值和中性单位组成，项目之间使用浅灰色 `|` 分隔，最后一项后不得出现分隔符。每个查询列表的结果工具栏都必须常驻一个列设置齿轮，固定在右侧操作区的最右端；它不因统计项、字段数量或其他结果操作缺失而省略。结果模块和 `Table` 外层宽度始终跟随可用工作区，不能被列宽撑破；列总宽度未超过可用宽度时，`Table` 填满结果模块，列总宽度超过可用宽度时，只能在 `Table` 自身区域内横向滚动，不能溢出白色结果模块或造成整页横向滚动。金额右对齐，并必须明确币种或单位。

**BL-VIS-014** `detail-structure`（详情结构） 详情信息使用分组 `Descriptions` 或结构化分区展示，不能把单个字段做成 Card。独立详情页存在多个需要分别核对的业务信息组时，工作区使用浅中性灰背景，每组使用带标题、分隔线等级边框的白色 `Card` 承载，组间露出工作区背景；`Card` 内仍以 `Descriptions` 或结构化表格呈现字段。需要保留来源上下文的分组详情在 `Drawer` 内展示时，Drawer 本身是唯一白色承载面：各信息组只用标题和稳定留白分隔，不再嵌套 Card；最后一个信息组可承载一张短明细 `Table`，宽度超过 Drawer 时只能在该表格区域横向滚动。详情过长时，只有在分组卡片仍无法满足直接扫描效率的情况下才增加锚点或分区导航。

**BL-VIS-019** `standalone-page-context`（独立页上下文） 独立表单页和独立详情页的业务上下文由固定 Shell 的当前 Tab 承担；任务模块内不得重复渲染页面名称或“独立表单页面”“独立详情页面”之类的泛化标题。需要分段时，只显示业务信息组标题。从现有列表或详情发起的全页表单、分阶段流程和上传复核流程必须在 Shell 中新增可关闭 Tab 打开，保留来源 Tab 及其查询、分页和临时输入状态，不能在来源 Tab 内替换页面；新 Tab 中的任务模块使用任务 Card 圆角，左上角不得为直角。

**BL-VIS-020** `guided-form`（带引导表单） 只有带引导的简单表单可以在桌面端使用业务引导区（`BusinessGuide`）中的固定老板管账插图、引导标题和说明文字；它服务资金、结算、开户、规则配置等需要额外理解的单阶段任务，不得作为装饰或营销内容。`Form` 与业务引导区整体最大宽度为 `1200px` 并在工作区居中，布局内部左右各保留 `16px` 留白；小于 `768px` 时隐藏整个引导区，只保留表单。

**BL-VIS-021** `result-composition`（结果页组合） 结果页以 `Result` 为基础，在白色任务表面中使用居中单列结构，依次呈现官方状态图标、结果标题、解释文字、可选结果信息区（`ResultSummary`）、`Button` 操作区和可选结果反馈区（`ResultFeedback`）。结果页白色任务表面必须填满 Shell 内除 Tab 和 Footer 外的全部可用内容区，不能只使用固定最小高度；内容在可用区域内垂直居中。结果页不得继承表单右侧引导图、步骤插图或其他业务配图；结果信息区使用低强调的两列信息面板，反馈区位于操作之后。

## 响应式与无障碍

**BL-VIS-015** `responsive-layout`（响应式布局） 桌面端是主要目标。窄屏应重排内容，不能整体缩小；查询网格和详情列逐级折叠，宽表格只在结果模块内部横向滚动，整页不得产生横向滚动。

**BL-VIS-016** `accessibility`（可访问性） 控件必须可通过键盘访问且名称明确。图标工具必须使用常见符号并提供 Tooltip；焦点、对比度、校验信息和状态含义即使不依赖颜色也必须可辨识。

## 视觉冲突规则

**BL-VIS-017** `visual-conflict-priority`（视觉冲突优先级） 当 Ant Design 通用默认值与本视觉宪法冲突时，以本视觉宪法为准。已选模板中更具体且不违反本宪法的布局规则，优先于本宪法的通用规则。

## 可编译主题 Token

**BL-VIS-018** `theme-tokens`（主题 Token） 下表是老板管账唯一的主题数据源。设计师只在本表维护跨页面的颜色、字体和圆角 Token；系统自动生成渲染器主题文件。业务页面、旧设计稿和 Page Spec 都不得覆盖这些 Token。

| Token | 值 | 用途 |
| --- | --- | --- |
| `colorPrimary` | `#F36046` | 唯一主操作、选中态、重要任务链接 |
| `colorPrimaryHover` | `#D94E36` | 主操作与链接 Hover |
| `colorPrimaryActive` | `#D94B35` | 主操作 Active |
| `colorLink` | `#F36046` | Ant Design 链接色 |
| `colorLinkHover` | `#D94E36` | Ant Design 链接 Hover |
| `colorPageBackground` | `#F4F4F4` | 工作区背景 |
| `colorContainer` | `#FFFFFF` | 模块、导航和浮层表面 |
| `colorTopInfoBar` | `#3A3A3A` | 顶部信息栏背景 |
| `colorSelectedBackground` | `#FEF2F0` | 与主色同色系的低强调选中背景，用于三级菜单与查询日期快捷项 |
| `colorStatisticBackground` | `#F6F6F6` | 列表统计与详情指标背景 |
| `colorToolBackground` | `#FAFAFA` | 列设置等轻量工具背景 |
| `colorBorder` | `#E5E6EB` | 常规控件边框 |
| `colorDivider` | `#F0F0F0` | 模块与浮层分隔线 |
| `colorTabDivider` | `#E6E6E6` | Tab 分隔线 |
| `colorSiderDivider` | `#EBEBEB` | 侧栏收起控制分隔线 |
| `colorTabInactiveBackground` | `#EEEEEE` | 非当前 Tab 背景 |
| `colorTextPrimary` | `rgba(0,0,0,.85)` | 强调标题和主要文字 |
| `colorTextSecondary` | `rgba(0,0,0,.65)` | 常规业务文字 |
| `colorTextTertiary` | `rgba(0,0,0,.45)` | 次要说明与工具图标 |
| `colorTextDisabled` | `rgba(0,0,0,.25)` | 禁用和占位文字 |
| `colorShellText` | `#1F2329` | 固定 Shell 主文字 |
| `colorShellSecondary` | `#4E5969` | 固定 Shell 次级文字 |
| `colorShellMuted` | `#B8B8B8` | 固定 Shell 弱化文字与图标 |
| `colorFooterText` | `#A8ABB2` | Footer 文字 |
| `colorSuccess` | `#52C41A` | 成功状态 |
| `colorWarning` | `#FAAD14` | 警告状态 |
| `colorError` | `#FF4D4F` | 错误状态 |
| `colorInfo` | `#1677FF` | 处理中状态 |
| `colorDefault` | `#86909C` | 默认状态 |
| `fontFamily` | `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif` | 系统中文无衬线字体栈 |
| `fontSize` | `14` | 默认业务字号（px） |
| `borderRadius` | `4` | Ant Design 控件圆角（px） |
| `cardBorderRadius` | `8px` | 任务模块与指标 Card 圆角 |
| `modalBorderRadius` | `6px` | Modal 圆角 |
| `drawerBorderRadius` | `0` | Drawer 圆角 |
| `navigationShadow` | `0 2px 8px rgba(0,0,0,.06)` | 一级导航阴影 |
