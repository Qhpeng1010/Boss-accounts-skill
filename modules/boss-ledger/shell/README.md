# Boss Ledger Shell

This directory is the canonical, reusable Boss Ledger framework layer. It is independent of every `changes/` page.

The shell owns the top information bar, primary navigation, left Ant Design Menu, collapse control, multi-tabs, workspace, content scroll viewport, and platform footer. A generated page supplies configuration and renders business content through `children`; the business page must not render another footer.

浏览器依赖由根目录 `package.json` 锁定，并通过 `npm run build:runtime` 生成到
`modules/shared/browser-runtime/vendor/`。老板管账与易账通共用这套离线运行时，
Shell 不再维护第三方压缩源码。普通预览使用软链接；页面构建命令加 `--portable`
时才复制当前页面所需的运行文件。

`lodash.min.js` 和 `ant-design-charts.min.js` 只在 Dashboard 页面写入预览 HTML。
列表、表单、详情与结果页不会加载图表依赖。Ant Design 图标包也只包含固定 Shell
和页面渲染器实际引用的图标。

Page Spec previews are built by `scripts/build-boss-ledger-page-spec.mjs`. The renderer owns `preview.html`, `preview-app.js` and business CSS; this directory only supplies the fixed runtime and shell CSS.

`content-base.css` owns the single `16px` inset for every Query / Result module. Generated business CSS must not add horizontal padding to `boss-result-summary`, `boss-result-toolbar`, `boss-table-body`, or `boss-table-pagination`. Use `boss-query-expand-button` for primary-text-color expand/collapse and `boss-column-setting-button` for the secondary-text-color Setting icon.

Business pages must not copy query, table, pagination, drawer, or other content modules into this directory.
