# StreamLens

调试 **SSE / AI 流式响应**：npm 页面内悬浮面板（推荐），也可作为 Chrome DevTools 扩展本地加载。

[English](https://github.com/MeetQin/StreamLens/blob/main/README.md) | 简体中文

不用上架 Chrome Web Store，也不用安装扩展：`npm i streamlens` 后调用一次 `installStreamLens()`，页面右下角就会出现调试面板。

## 快速开始（npm 插件）

```bash
npm i streamlens
```

```ts
import { installStreamLens } from 'streamlens'

installStreamLens()
```

默认立即开始采集，页面右下角出现 StreamLens 悬浮按钮。发起任意 SSE / 流式 `fetch` 请求后点击按钮即可查看。

React / Vue 入口直接用一行 `installStreamLens()` 即可；SSR 环境请在 `useEffect` 或 `onMounted` 中调用。

CDN 用法：

```html
<script src="https://unpkg.com/streamlens"></script>
<script>
  StreamLens.installStreamLens()
</script>
```

完整用法、配置项与 API 见 [packages/streamlens/README.zh-CN.md](https://github.com/MeetQin/StreamLens/blob/main/packages/streamlens/README.zh-CN.md)。

## 功能

- 页面内悬浮面板，Shadow DOM 隔离，不污染宿主页面样式
- 捕获 `fetch` 流式响应（`ReadableStream.tee`）与 `EventSource`
- 标准 SSE 解析（跨 chunk、多行 data、UTF-8）
- 请求列表、事件时间线、JSON 解析与错误展示、Raw 事件流
- 首包延迟、总耗时、事件数 / 解析失败数、平均 / 最大事件间隔
- OpenAI `chat/completions` 风格适配（delta 归一化、`[DONE]` 结束标记）
- EventSource 自定义事件（如 `progress`）
- 导出 JSON / JSONL / HAR 1.2，默认尝试脱敏
- 数据仅在浏览器本地内存处理，无默认上传
- 也可作为 Chrome DevTools 扩展本地加载（无需上架）

## 限制

- 必须在请求发生**之前**安装插件；已完成的请求无法追溯。
- 刷新或导航会清空页面内存中的数据（Chrome 扩展形态支持跨刷新延续）。
- `fetch` 侧按 `Content-Type` / URL / `Accept` 启发式识别流式响应。
- `EventSource` 自定义事件需要页面注册对应类型的 `addEventListener` 才能捕获。
- 不捕获请求头与请求体，只读取响应流内容。
- 只作用于安装所在的页面上下文；iframe 内需单独安装。

## 本地开发

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run demo       # http://localhost:4173
pnpm run build:e2e
# 本地有界面 Chrome 时（非 CI）：
# Windows: $env:RUN_E2E='1'; pnpm exec playwright test
```

演示页：

- `/npm.html` — ESM 方式加载 npm 插件（需先构建 `packages/streamlens`）
- `/npm-iife.html` — `<script>` / IIFE 方式
- `/` — Chrome 扩展形态的采集演示

发布 npm 包（需要先 `npm login`）：

```bash
pnpm run publish:streamlens
```

## 仓库结构

- `packages/streamlens` — **npm 页面内插件**（Vue 面板 + fetch/EventSource hook）
- `apps/extension` — Chrome DevTools 扩展（保留，可本地加载）
- `packages/protocol` — 消息与数据模型
- `packages/sse-parser` — 独立 SSE 解析器（Vitest）
- `packages/core` — 会话、指标、脱敏与导出
- `packages/adapters/ai-stream` — AI 流式协议适配（OpenAI 等）
- `fixtures/sse-demo-server` — 本地 SSE 演示服务
- `tests/integration` — Node 集成测试（不依赖 Chrome）

## Chrome 扩展（可选）

扩展形态保留，仍可在本地使用：

1. 打开 `chrome://extensions`，开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择 `apps/extension/dist`
3. 打开演示页 http://localhost:4173
4. DevTools → **StreamLens** → **Start Capture** → **刷新页面** → 点击测试按钮

文档：

- [架构](docs/ARCHITECTURE.md)
- [已知限制](docs/LIMITATIONS.md)
- [MVP 验收清单](docs/MVP-CHECKLIST.md)
- [Phase 4 功能](docs/PHASE4.md)

## 隐私

采集数据仅在浏览器本地内存中处理；导出前会二次确认。URL 查询参数中的 token 类字段在脱敏工具中可扩展（导出 JSON 时建议使用脱敏后的副本）。

## License

MIT — 见 [LICENSE](./LICENSE)
