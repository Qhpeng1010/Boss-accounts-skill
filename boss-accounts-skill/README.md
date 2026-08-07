# Boss-accounts-skill

独立的老板管账页面生成技能，包含业务规则、固定渲染器、浏览器运行时、快速配方、构建与静态校验工具。

## 生成页面

```bash
node scripts/generate-page.mjs --request "<老板管账页面需求>"
```

仅在明确使用 `/yeepay:fast` 时追加 `--recipe auto`。新页面的受控自然语言流程由入口一次路由后返回最小规则资源及后续命令。

## 可迁移交付

每次构建会将当前页面所需的浏览器依赖复制到 `changes/<change-id>/vendor/`。交付目录不依赖技能工程内的软链接，移动后可继续打开预览。

共享规则、主题、渲染器、Shell 或浏览器运行时升级后，运行：

```bash
npm run rebuild:history
```

该命令会批量重建所有历史页面并执行静态预检；使用 `npm run rebuild:history -- --strict` 可同时执行严格治理校验。

页面预览仅通过静态预检，仍需人工验收。
