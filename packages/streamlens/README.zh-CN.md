# StreamLens

在页面内调试 **SSE / AI 流式响应** 的 npm 插件。

一行代码在页面右下角挂出调试面板，捕获 `fetch` 流式响应与 `EventSource`，按请求查看事件时间线、JSON、原始数据、解析错误与延迟指标。**不需要浏览器扩展，也不需要上架 Chrome Web Store。**

[English](https://github.com/MeetQin/StreamLens/blob/main/packages/streamlens/README.md) | 简体中文

- 页面内悬浮面板，Shadow DOM 隔离，不污染宿主样式
- 标准 SSE 解析（跨 chunk、多行 `data`、UTF-8）
- OpenAI `chat/completions` 风格适配（`delta` 归一化、`[DONE]` 结束标记）
- EventSource 自定义事件（如 `progress`）
- 首包延迟、总耗时、平均 / 最大事件间隔、解析错误统计
- 导出 JSON / JSONL / HAR 1.2，默认尝试脱敏 token 类字段
- 数据只在浏览器内存中处理，无默认上传
- ESM 与 IIFE 两种产物，Vue 运行时已打包，零配置

## 安装

```bash
npm i streamlens
# 或 pnpm add streamlens / yarn add streamlens
```

## 使用

在浏览器端入口调用一次即可：

```ts
import { installStreamLens } from 'streamlens'

const streamlens = installStreamLens()
```

默认会立即开始采集，并以悬浮按钮的形式显示在页面右下角。点击按钮展开面板。

### React

```tsx
// main.tsx
import { installStreamLens } from 'streamlens'

installStreamLens()
```

如果入口可能在 SSR 环境执行，请放到 `useEffect` 中：

```tsx
useEffect(() => {
  const streamlens = installStreamLens()
  return () => streamlens.destroy()
}, [])
```

### Vue

```ts
// main.ts
import { installStreamLens } from 'streamlens'

installStreamLens()
```

### 普通 HTML / CDN

```html
<script src="https://unpkg.com/streamlens"></script>
<script>
  const streamlens = StreamLens.installStreamLens()
</script>
```

也可以用 ESM CDN：

```html
<script type="module">
  import { installStreamLens } from 'https://esm.sh/streamlens'
  installStreamLens()
</script>
```

> `installStreamLens()` 必须在浏览器环境调用；模块本身没有副作用，可以安全地静态导入。

## 配置

```ts
installStreamLens({
  autoStart: true,          // 安装后立即采集；默认 true
  open: false,              // 直接展开面板；默认显示悬浮按钮
  position: 'bottom-right', // 'bottom-right' | 'bottom-left'
  theme: 'auto',            // 'auto' | 'light' | 'dark'
  enableAiAdapter: true,    // OpenAI / AI 流适配
  redactOnExport: true,     // 导出时脱敏
  limits: {
    maxRequests: 500,
    maxEventsPerRequest: 10_000,
    maxEventDataChars: 256 * 1024,
  },
  zIndex: 2147483647,
})
```

重复调用会返回同一个实例，不会重复注入 hook。

## API

```ts
const streamlens = installStreamLens()

streamlens.start()             // 继续采集
streamlens.stop()              // 暂停采集；进行中的请求标记为 aborted
streamlens.clear()             // 清空已捕获数据
streamlens.open()              // 展开面板
streamlens.close()             // 收起为悬浮按钮
streamlens.isCapturing()       // 是否正在采集
streamlens.getRequests()       // CapturedRequest[]
streamlens.getEvents(id)       // CapturedEvent[]
streamlens.exportJson()        // 脱敏后的导出记录
streamlens.exportHar()         // HAR 1.2 文件对象
streamlens.destroy()           // 卸载面板、恢复 fetch / EventSource
```

也可以从控制台访问：

```js
window.__streamlens.getRequests()
```

## 捕获范围与限制

- **只捕获安装之后发起的请求**，无法回溯已完成的请求。
- 数据保存在页面内存中，**刷新或导航后清空**。
- `fetch` 侧按 `Content-Type` / URL / `Accept` 启发式识别流式响应；非 SSE 的纯文本流也会尝试按 SSE 解析。
- `EventSource` 自定义事件只有在页面通过 `addEventListener` 注册对应类型时才能观察到。
- 不捕获请求头和请求体，只捕获响应流内容。
- 只作用于安装所在的页面上下文；iframe 内的请求需要在对应 frame 中单独安装。
- 导出内容仍可能包含业务敏感信息，导出前会二次确认，默认尝试脱敏 URL 参数、Bearer/JWT 与常见密钥字段。

## 隐私

采集数据只在浏览器本地内存中处理，默认不上传、不写磁盘。导出由用户主动触发。

## 开发

仓库内开发：

```bash
pnpm install
pnpm --filter streamlens build
pnpm --filter streamlens test
pnpm demo   # http://localhost:4173/npm.html 与 /npm-iife.html
```

## License

MIT
