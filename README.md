# StreamLens

Chrome DevTools 扩展：捕获并分析页面中的 **SSE** 与 **fetch 流式响应**（MVP）。

## 功能（当前版本）

- DevTools 独立面板 **StreamLens**
- 用户主动 **Start / Stop / Clear** 采集
- 页面注入采集：`fetch`（`ReadableStream` tee）与 `EventSource`
- 标准 SSE 解析（跨 chunk、多行 data、UTF-8）
- 请求列表、事件时间线、JSON 解析与错误展示
- 首事件延迟、总耗时、事件数 / 解析失败数
- 复制单条事件、导出 JSON（含敏感信息确认提示）
- OpenAI `chat/completions` 风格适配（delta 归一化、`[DONE]` 结束标记）
- EventSource 自定义事件（如 `progress`）
- 导出脱敏（URL 参数、Bearer/JWT、常见密钥字段）
- 事件间隔统计、UI 批量刷新（减轻高频流式更新压力）
- 刷新/导航后自动重新注入 hook 并延续采集；MV3 后台重启后恢复会话
- Panel 与后台断线后自动重连
- 本地处理，无默认上传
- 集成测试：Demo SSE 服务 + `CaptureSession` 端到端

## 限制

- 必须在 **开启采集后刷新页面**，才能 hook 到页面加载阶段的请求；已发生的请求无法追溯。开启采集后刷新会自动延续采集，无需重新 Start。
- `fetch` 侧按 `Content-Type` 启发式识别流式响应；非 SSE 格式的纯文本流也会尝试按 SSE 解析。
- 需要 `<all_urls>` 与 `scripting` 权限以注入采集脚本。

## 开发

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run demo   # http://localhost:4173
pnpm run build:e2e
# 本地有界面 Chrome 时（非 CI）：
# Windows: $env:RUN_E2E='1'; pnpm exec playwright test
```

文档：

- [架构](docs/ARCHITECTURE.md)
- [已知限制](docs/LIMITATIONS.md)
- [MVP 验收清单](docs/MVP-CHECKLIST.md)
- [Phase 4 功能](docs/PHASE4.md)

### 加载扩展

1. 打开 `chrome://extensions`，开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择 `apps/extension/dist`
3. 打开演示页 http://localhost:4173
4. DevTools → **StreamLens** → **Start Capture** → **刷新页面**（采集自动延续）→ 点击测试按钮

开发时可运行 `pnpm --filter @streamlens/extension dev` 构建 watch，然后在扩展页点击刷新。

## 仓库结构

- `apps/extension` — Chrome 扩展 + Vue 面板
- `packages/protocol` — 消息与数据模型
- `packages/sse-parser` — 独立 SSE 解析器（Vitest）
- `packages/core` — 会话、指标、脱敏与导出
- `packages/adapters/ai-stream` — AI 流式协议适配（OpenAI 等）
- `fixtures/sse-demo-server` — 本地 SSE 演示服务
- `tests/integration` — Node 集成测试（不依赖 Chrome）

## 隐私

采集数据仅在浏览器本地内存中处理；导出前会二次确认。URL 查询参数中的 token 类字段在脱敏工具中可扩展（导出 JSON 时建议使用脱敏后的副本）。

## License

MIT — 见 [LICENSE](./LICENSE)
