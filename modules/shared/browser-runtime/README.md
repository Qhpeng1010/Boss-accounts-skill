# Shared Browser Runtime

老板管账和易账通预览共用这里生成的浏览器运行依赖。依赖版本以根目录
`package.json` 和 `package-lock.json` 为准，不直接维护压缩后的第三方源码。

日常页面生成直接使用仓库内已构建的离线运行文件，不需要安装 `node_modules`。
升级前端依赖、调整图标集合、修改构建逻辑或发布 Skill 时，再安装开发依赖并重建：

```bash
npm ci
npm run build:runtime
```

生成文件位于 `vendor/`，源码仓库忽略该目录。Skill 发布或需要直接打开
`preview.html` 时必须包含该目录。普通 Change 使用硬链接复用同一份磁盘数据；需要
完全独立的交付副本时，通过页面构建命令的 `--portable` 参数复制所需运行文件。

图标包只包含固定 Shell 与页面渲染器实际引用的图标。图表依赖只会写入
Dashboard 预览，普通列表、表单、详情和结果页不会加载图表脚本。
