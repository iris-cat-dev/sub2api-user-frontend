# sub2api-user-frontend

## 画图工作台

登录后从侧栏进入 `/drawing`，工作台嵌入主站布局。已绑定、启用生图的 OpenAI 与 Grok 分组密钥可选择对应图片模型，普通密钥也会列出并说明不可用原因。支持文生图及 PNG/JPEG/WebP 参考图编辑：OpenAI `gpt-image-*` 最多 16 张参考图，编辑保留原始文件并使用 `image[]` 表单字段；文生图默认流式预览，编辑默认非流式（部分上游流式编辑会在 Cloudflare 125 秒限制处超时），两种模式可分别切换预览并支持取消；Grok `grok-imagine-image*` 最多 3 张参考图，编辑通过 JSON 图片数据发送，不提供流式预览。请求均经本站 `/v1/images/generations` 或 `/v1/images/edits` 发出。

开发时可分别运行 `pnpm dev` 与 `pnpm dev:drawing`；独立构建入口位于 `/drawing-app/`，主站内嵌工作台位于 `/drawing`。`pnpm build` 会将主站和独立画图入口一起构建至 `dist/`。Cloudflare Pages 部署 `dist/`，并为预览、生产环境分别配置 `API_UPSTREAM` 指向后端；Pages Functions 将同源 `/api`、`/v1` 请求转发至该地址。

画图任务与图片存于当前站点来源的浏览器 IndexedDB，按登录用户隔离；换设备或浏览器不会同步。与原画图站点共用同一来源时可手动认领其未归属历史；不同来源的浏览器存储不能自动读取。