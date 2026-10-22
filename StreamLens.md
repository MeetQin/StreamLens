# StreamLens — Chrome DevTools SSE 调试插件需求与开发计划

> 文档版本：v0.1.0  
> 文档状态：MVP 规划稿  
> 项目形态：Chrome Extension（Manifest V3）+ Chrome DevTools Panel  
> 前端技术栈：Vue 3 + TypeScript + Vite  
> 项目目标：帮助前端开发者捕获、解析和分析网页中的 SSE / AI 流式响应。

---

## 1. 项目概述

### 1.1 项目背景

随着 AI 应用、实时通知和流式接口的普及，开发者经常需要排查 SSE（Server-Sent Events）请求中的事件顺序、响应内容、解析异常、首事件延迟以及连接中断等问题。

Chrome 自带的 Network 面板可以查看请求信息和部分 EventStream 内容，但在结构化事件解析、AI 协议适配、耗时统计、异常诊断和调试数据导出等方面，仍有进一步提升体验的空间。

StreamLens 希望提供一个集成在 Chrome DevTools 中的专用调试面板，帮助开发者更高效地分析流式请求。

### 1.2 项目定位

StreamLens 是一个面向前端开发者的轻量级 SSE / AI 流式响应调试工具。

**核心定位：不仅查看流式响应，还要帮助开发者理解事件、定位问题和分析耗时。**

### 1.3 项目目标

MVP 阶段目标：

- 在 Chrome DevTools 中提供独立的 StreamLens 面板。
- 在用户明确开启采集后，捕获支持范围内的 SSE / 流式请求。
- 将原始数据解析为结构化事件并按时间顺序展示。
- 展示请求生命周期、首事件延迟、总耗时和解析异常。
- 支持搜索、过滤、复制和导出调试记录。
- 保持低权限、默认本地处理，不自动上传用户请求数据。
- 建立可独立测试和复用的 TypeScript 核心解析包。

### 1.4 非目标

MVP 阶段暂不承诺：

- 完整替代 Chrome Network 面板。
- 捕获所有网络协议、所有浏览器请求或所有页面上下文中的请求。
- 无限制读取任意请求的完整响应正文。
- 支持所有厂商私有的 AI 流式协议。
- 自动上传日志、云端协作或团队权限管理。
- 提供生产环境的远程监控与告警服务。

---

## 2. 目标用户与使用场景

### 2.1 目标用户

- Vue / React 前端开发者。
- 调试 AI 聊天、文本生成、工具调用等流式交互的开发者。
- 使用 SSE 实现实时通知或任务进度的开发者。
- 需要定位流式响应异常、解析失败和延迟问题的开发者。

### 2.2 典型场景

1. 开发者打开网页并进入 Chrome DevTools 的 StreamLens 面板。
2. 用户主动开启采集；如果需要捕获页面初始化阶段的请求，插件提示重新加载页面。
3. 页面发起 `fetch` 流式请求或 `EventSource` 连接。
4. StreamLens 捕获支持范围内的请求和事件，并更新请求列表。
5. 开发者选择某条请求，查看请求概览、事件时间线、原始数据和解析结果。
6. 开发者定位首事件延迟过高、JSON 解析失败、流中断或事件缺失等问题。
7. 开发者复制单条事件或导出调试记录，用于本地排查或提交问题报告。

---

## 3. MVP 功能需求

优先级说明：

- **P0：** MVP 必须完成。
- **P1：** MVP 后或首个小版本完成。
- **P2：** 后续迭代。

### 3.1 DevTools 面板

| 编号 | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| UI-001 | 注册独立的 StreamLens DevTools 标签页 | P0 | 打开 Chrome DevTools 后能看到并进入 StreamLens |
| UI-002 | 展示当前被检查的 Tab 信息 | P0 | 能获取并显示当前调试标签页的标识 |
| UI-003 | 提供 Start / Stop Capture 操作 | P0 | 用户可以主动开启和停止采集 |
| UI-004 | 提供 Clear 操作 | P0 | 清空当前面板中的请求与事件记录 |
| UI-005 | 展示采集状态 | P0 | 明确显示未启动、采集中、已停止或发生错误 |
| UI-006 | 提供重新加载页面以捕获初始化请求的提示 | P0 | 用户能理解已发生的请求可能无法被注入式采集器追溯 |
| UI-007 | 支持亮色 / 暗色主题适配 | P2 | 跟随系统或 DevTools 主题显示 |

### 3.2 请求列表

| 编号 | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| REQ-001 | 展示请求 URL、方法、状态、Content-Type | P0 | 对可获取的字段准确显示，未知字段显示为空或 `-` |
| REQ-002 | 展示请求开始时间和当前状态 | P0 | 能区分 pending、streaming、completed、failed、aborted |
| REQ-003 | 按 URL 关键词过滤 | P0 | 输入关键词后只显示匹配请求 |
| REQ-004 | 按请求状态过滤 | P1 | 可以过滤进行中、成功、失败和中止的请求 |
| REQ-005 | 按请求类型过滤 | P1 | 可区分 fetch-stream 与 EventSource |
| REQ-006 | 选择请求查看详情 | P0 | 选中请求后展示对应详情 |
| REQ-007 | 请求列表虚拟滚动 | P2 | 大量请求时仍能保持可用的界面性能 |

### 3.3 SSE 采集与解析

| 编号 | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| SSE-001 | 捕获支持范围内的 `fetch` 流式响应 | P0 | 能捕获测试页面发起的目标流式请求 |
| SSE-002 | 捕获 `EventSource` 事件 | P0 | 能展示 message 和自定义事件的事件类型与数据 |
| SSE-003 | 解析标准 SSE 字段 | P0 | 支持 `data`、`event`、`id`、`retry` 和注释行 |
| SSE-004 | 支持跨 chunk 的行和事件边界 | P0 | 数据被任意分块时仍能正确解析 |
| SSE-005 | 支持 UTF-8 字符跨 chunk | P0 | 中文及其他多字节字符不会因分块而乱码 |
| SSE-006 | 支持多行 `data:` 拼接 | P0 | 同一事件中的多行 data 按 SSE 规则拼接 |
| SSE-007 | 记录 JSON 解析结果与解析错误 | P0 | 有效 JSON 展示结构化数据；无效 JSON 保留原文并标注错误 |
| SSE-008 | 识别 EOF、错误和主动中止 | P0 | 请求结束原因被记录，不能将所有结束都标记为成功 |
| SSE-009 | 可配置 AI 协议适配器 | P1 | 能将指定协议转换为统一事件模型 |
| SSE-010 | 识别如 `[DONE]` 的特定协议结束标记 | P1 | 作为可配置适配规则处理，而非误认为标准 SSE 语法 |
| SSE-011 | 支持 `Last-Event-ID`、自动重连等高级诊断 | P2 | 在采集方式能够提供相关信息时展示 |

### 3.4 事件详情与统计

| 编号 | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| EVT-001 | 按到达顺序展示事件时间线 | P0 | 事件序号稳定且可追踪 |
| EVT-002 | 展示事件时间戳、类型、原始 data | P0 | 能查看单条事件完整原始内容（受大小限制） |
| EVT-003 | 展示 JSON 格式化结果 | P0 | 有效 JSON 可展开查看 |
| EVT-004 | 计算首事件延迟 | P0 | 使用首个完整 SSE 事件时间减去请求开始时间 |
| EVT-005 | 计算请求总耗时 | P0 | 请求结束后展示结束时间减开始时间 |
| EVT-006 | 统计事件数量和解析失败数量 | P0 | 数量与事件列表一致 |
| EVT-007 | 展示流中断和异常原因 | P0 | 错误状态与错误信息可见 |
| EVT-008 | 展示 chunk 到达间隔和吞吐指标 | P2 | 明确区分 chunk 与 SSE event，不混用概念 |

### 3.5 搜索、复制与导出

| 编号 | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| EXP-001 | 搜索 URL、事件类型和事件内容 | P0 | 搜索结果能定位到匹配记录 |
| EXP-002 | 复制单条事件原始数据 | P0 | 点击复制后获得准确文本 |
| EXP-003 | 导出单条请求记录为 JSON | P0 | 文件包含请求元数据、事件和诊断指标 |
| EXP-004 | 导出全部当前采集记录为 JSON | P1 | 导出前提示可能包含敏感信息 |
| EXP-005 | 导出为 HAR 或自定义文本格式 | P2 | 需定义字段映射和隐私规则后再实施 |

### 3.6 隐私与稳定性

| 编号 | 需求 | 优先级 | 验收标准 |
|---|---|---|---|
| SEC-001 | 默认仅在本地处理采集数据 | P0 | 不向第三方服务发送日志 |
| SEC-002 | 用户主动开始和停止采集 | P0 | 默认不持续采集页面请求 |
| SEC-003 | 提供敏感字段脱敏配置 | P0 | 支持对常见 Token、Authorization、Cookie 等字段进行隐藏或移除 |
| SEC-004 | 限制单条事件大小 | P0 | 超过上限时截断并标记，不导致 UI 崩溃 |
| SEC-005 | 限制单个请求与全局缓存大小 | P0 | 长连接和大量事件不会无限占用内存 |
| SEC-006 | 页面关闭、刷新或断连时清理会话 | P0 | 资源和监听器能够正确释放 |
| SEC-007 | 消息协议校验与会话隔离 | P0 | 忽略无效消息，防止不同 Tab 的数据串线 |
| SEC-008 | 提供清空全部数据的操作 | P0 | 用户可以删除当前会话记录 |
| SEC-009 | 支持导出前预览与二次确认 | P1 | 用户知晓导出内容可能包含敏感信息 |

---

## 4. 技术架构

### 4.1 架构原则

1. **核心与 UI 分离：** SSE 解析器不依赖 Vue、Chrome API 或 DOM。
2. **采集与解析分离：** 采集方式可替换，解析逻辑保持稳定。
3. **协议统一：** 页面注入、DevTools API 和未来 CDP 适配器输出统一数据模型。
4. **最小权限：** 只申请实现功能所必需的 Chrome 权限。
5. **本地优先：** 默认不上传请求数据。
6. **可测试：** 解析器、请求状态机和指标计算均提供自动化测试。

### 4.2 推荐技术栈

| 层级 | 技术 |
|---|---|
| 浏览器扩展规范 | Chrome Extension Manifest V3 |
| UI | Vue 3 + TypeScript |
| 构建 | Vite + 经验证兼容的 Chrome 扩展插件 |
| 包管理 | pnpm workspace |
| 状态管理 | Vue composables；复杂后再引入 Pinia |
| 核心解析 | TypeScript 独立包 |
| 单元测试 | Vitest |
| 浏览器端到端测试 | Playwright（按实际扩展测试能力配置） |
| 代码规范 | ESLint + Prettier |
| CI | GitHub Actions |

### 4.3 目录结构

```text
streamlens/
├── apps/
│   └── extension/
│       ├── manifest.json
│       ├── src/
│       │   ├── devtools/
│       │   │   ├── devtools.html
│       │   │   └── devtools.ts
│       │   ├── panel/
│       │   │   ├── panel.html
│       │   │   ├── main.ts
│       │   │   ├── App.vue
│       │   │   ├── components/
│       │   │   │   ├── CaptureToolbar.vue
│       │   │   │   ├── RequestList.vue
│       │   │   │   ├── RequestOverview.vue
│       │   │   │   ├── EventTimeline.vue
│       │   │   │   ├── EventDetail.vue
│       │   │   │   └── JsonViewer.vue
│       │   │   ├── composables/
│       │   │   └── stores/
│       │   ├── background/
│       │   │   └── index.ts
│       │   ├── content/
│       │   │   └── bridge.ts
│       │   └── injected/
│       │       ├── fetch-hook.ts
│       │       └── event-source-hook.ts
│       └── vite.config.ts
├── packages/
│   ├── protocol/
│   │   └── src/
│   ├── sse-parser/
│   │   └── src/
│   ├── core/
│   │   └── src/
│   └── adapters/
│       └── ai-stream/
│           └── src/
├── fixtures/
│   └── sse-demo-server/
├── tests/
├── docs/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

> 说明：目录是建议结构。具体的脚本注入方式、Content Script、后台 Service Worker 和消息桥接关系，需要根据实际的 Chrome 权限与注入验证结果调整，不能假定所有上下文可直接互相访问。

---

## 5. Manifest V3 与权限策略

### 5.1 初始 Manifest

下面是一个最小 DevTools 面板起点，不代表完整采集能力已经具备：

```json
{
  "manifest_version": 3,
  "name": "StreamLens",
  "version": "0.1.0",
  "description": "Debug SSE and AI streaming responses in Chrome DevTools",
  "devtools_page": "devtools/devtools.html",
  "permissions": [
    "storage"
  ]
}
```

### 5.2 权限使用原则

| 权限 / API | 用途 | 策略 |
|---|---|---|
| `chrome.devtools.panels` | 注册 DevTools 面板 | 必需 API，不需要单独申请权限 |
| `storage` | 保存配置与用户偏好 | 推荐 |
| `scripting` | 通过扩展 API 注入脚本 | 仅在所选注入方案需要时申请 |
| `activeTab` | 用户主动操作后访问当前 Tab | 根据实际交互方式决定 |
| `host_permissions` | 对指定网站执行脚本或访问资源 | 尽量采用用户授权或限定站点 |
| `debugger` | 通过 CDP 附加到 Tab | MVP 不默认申请，后续评估 |

### 5.3 CDP 使用策略

CDP（Chrome DevTools Protocol）可作为后续采集适配器研究，但不应在未验证前成为 MVP 的唯一数据来源。

需要通过原型验证：

- 能否稳定接收目标请求的网络事件。
- 响应体读取的可用时机和完整性。
- 对持续中的 SSE 请求能否满足实时性要求。
- 与内置 DevTools 同时使用时的交互影响。
- 权限提示、调试器附加状态和异常恢复机制。

若 CDP 无法稳定提供实时完整流内容，应优先使用页面注入采集器捕获流式事件；CDP 可以补充请求元数据，但要明确两种来源的能力边界。

---

## 6. 核心数据模型

### 6.1 请求模型

```ts
export type RequestState =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'aborted'

export interface StreamRequest {
  id: string
  tabId: number
  url: string
  method: string
  status?: number
  contentType?: string
  startedAt: number
  firstEventAt?: number
  endedAt?: number
  state: RequestState
  source: 'fetch-stream' | 'event-source' | 'cdp'
  eventCount: number
  parseErrorCount: number
}
```

### 6.2 事件模型

```ts
export interface StreamEvent {
  id: string
  requestId: string
  index: number
  timestamp: number
  eventType?: string
  eventId?: string
  retry?: number
  data: string
  parsedData?: unknown
  parseError?: string
  truncated?: boolean
}
```

### 6.3 指标定义

- **首事件延迟：** `firstEventAt - startedAt`，仅表示首个完整 SSE 事件的观察时间差。
- **总耗时：** `endedAt - startedAt`。
- **事件数量：** 成功解析到的完整 SSE 事件数。
- **解析失败数：** 解析器或可选 JSON 解析阶段发生错误的数量；两类错误应区分记录。
- **事件间隔：** 相邻完整事件被观察到的时间差，不等同于网络层 chunk 间隔。

所有指标应基于明确记录的时间戳计算，避免把浏览器接收时间误认为服务端生成时间。

---

## 7. 采集与消息链路

### 7.1 目标链路

```text
用户在 DevTools 中开启采集
        ↓
初始化当前 Tab 的采集会话
        ↓
按选定方案启用页面采集器
        ↓
采集 fetch / EventSource 流式事件
        ↓
通过受控消息桥传递事件
        ↓
校验消息、关联 requestId、限制数据大小
        ↓
调用 SSE Parser 解析完整事件
        ↓
更新请求状态和统计指标
        ↓
Vue 3 面板展示并允许导出
```

### 7.2 `fetch` 采集要求

- 尽可能保持原请求参数、返回值和错误行为。
- 不应为了监控而提前消费业务代码需要读取的响应体。
- 支持响应流跨 chunk、UTF-8 多字节字符和连接中断。
- 监控分支出现异常时，不应破坏业务分支。
- 处理背压和大响应体，限制监控侧缓存。
- 仅记录必要数据，支持 URL 过滤与敏感字段脱敏。

### 7.3 `EventSource` 采集要求

- 记录连接建立、消息事件、错误与关闭状态。
- 支持标准 `message` 和自定义事件。
- 兼顾自动重连与 `Last-Event-ID` 等机制。
- 尽量保持原有构造参数和事件语义。
- 清理监听器，避免重复注入导致事件重复。

### 7.4 消息协议

建议所有采集来源输出统一的消息类型：

```ts
export type StreamLensMessage =
  | {
      type: 'CAPTURE_START'
      sessionId: string
      tabId: number
    }
  | {
      type: 'REQUEST_STARTED'
      sessionId: string
      request: StreamRequest
    }
  | {
      type: 'SSE_EVENT'
      sessionId: string
      event: StreamEvent
    }
  | {
      type: 'REQUEST_FINISHED'
      sessionId: string
      requestId: string
      reason: 'eof' | 'error' | 'abort' | 'closed'
    }
  | {
      type: 'CAPTURE_STOP'
      sessionId: string
    }
```

消息接收方必须校验字段、消息类型、会话 ID 和数据大小。来自页面环境的消息不能直接视为可信输入。

---

## 8. UI 交互需求

### 8.1 主面板布局

建议采用三栏或上下分区布局：

```text
┌─────────────────────────────────────────────────────────────┐
│ StreamLens   [Start Capture] [Stop] [Clear] [Export]        │
├─────────────────────────────────────────────────────────────┤
│ 搜索 URL / 事件内容   [状态筛选] [请求类型筛选]             │
├──────────────────────┬──────────────────────────────────────┤
│ 请求列表             │ 请求概览                             │
│                      ├──────────────────────────────────────┤
│ GET /api/chat        │ Events | Raw Data | JSON | Errors     │
│ POST /api/stream     ├──────────────────────────────────────┤
│ GET /events          │ 事件时间线 / 事件详情                │
│                      │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### 8.2 主要交互

- 点击 Start Capture：请求授权或启动采集，显示采集状态。
- 点击 Stop：停止继续采集，并清理采集端监听器。
- 点击 Clear：清空当前会话数据，必要时二次确认。
- 选择请求：显示请求概览和事件详情。
- 选择事件：显示原始 data、格式化 JSON 和解析错误。
- 点击 Copy：复制选中事件或请求摘要。
- 点击 Export：导出前执行脱敏并提示敏感信息风险。
- 过滤请求：按 URL、状态和类型筛选。
- 页面刷新或关闭：终止旧会话并允许重新开启采集。

### 8.3 性能要求

初始目标值，可根据实际测试调整：

- 常规调试场景下，面板能够持续接收并展示事件。
- 解析与 UI 更新不能阻塞目标页面的业务线程。
- 对大量事件采用批量更新或节流渲染。
- 对单条事件和单请求设置可配置的最大缓存。
- 数据被截断时必须有明确提示，不能静默丢失。

---

## 9. 测试计划

### 9.1 SSE Parser 单元测试

必须覆盖：

- LF 和 CRLF 换行。
- 单条及多条 `data:`。
- `event`、`id`、`retry` 字段。
- 注释行和心跳。
- 分块边界落在字段名、冒号、换行符和 UTF-8 字符中间。
- 空事件、无效 JSON、未完成帧。
- `[DONE]` 等协议特定标记由适配器处理。
- EOF 和错误结束。

### 9.2 浏览器集成测试

建立本地 SSE Demo 服务，至少测试：

1. 正常连续输出。
2. 延迟输出和长时间连接。
3. 中文及 emoji 内容。
4. 服务端主动关闭。
5. 网络中断或请求被取消。
6. 无效 JSON。
7. 大量事件和大字段。
8. 页面刷新与采集重启。
9. 采集器重复启用。
10. 页面消息伪造与无效消息。

### 9.3 验收原则

- 不破坏目标页面原始业务请求。
- 解析结果与测试服务发送的事件一致。
- 事件顺序和状态转换正确。
- 达到缓存上限时能提示截断并保持可用。
- 停止采集后不再继续记录新事件。
- 默认没有外部数据上传。
- 未支持的请求类型明确标记，不伪装成完整捕获。

---

## 10. 迭代路线图

### Phase 0：技术预研

**目标：验证 Chrome 扩展采集能力。**

- [ ] 创建最小 Manifest V3 扩展。
- [ ] 注册 DevTools Panel。
- [ ] 创建本地 Node.js SSE Demo 服务。
- [ ] 创建通过 `fetch` 读取 SSE 的测试页面。
- [ ] 验证面板打开后采集和重新加载后采集两种场景。
- [ ] 评估页面注入与 CDP 的能力边界。
- [ ] 记录权限要求、限制和技术决策。

**交付物：** 可运行的技术验证 Demo、架构决策记录（ADR）。

### Phase 1：核心 MVP

**目标：实现从采集到展示的最小闭环。**

- [ ] 完成扩展工程脚手架和构建。
- [ ] 完成 DevTools 面板注册。
- [ ] 完成用户主动开始 / 停止采集。
- [ ] 完成 `fetch` 与 `EventSource` 基础采集。
- [ ] 完成 SSE Parser 与单元测试。
- [ ] 完成统一消息协议与请求状态管理。
- [ ] 完成请求列表和事件详情。
- [ ] 完成首事件延迟、总耗时和解析错误展示。

**交付物：** 可在本地安装的 MVP 扩展。

### Phase 2：可用性与稳定性

- [ ] 搜索、过滤、复制和 JSON 导出。
- [ ] 敏感信息脱敏。
- [ ] 单条事件和总缓存上限。
- [ ] 页面刷新、关闭和连接断开处理。
- [ ] 批量更新和大数据量 UI 优化。
- [ ] 补齐浏览器集成测试。

**交付物：** 可供外部开发者试用的 Beta 版本。

### Phase 3：开源发布

- [ ] 编写项目 README 与功能截图。
- [ ] 编写安装、使用和排错文档。
- [ ] 添加 License、Contributing、Code of Conduct。
- [ ] 配置 GitHub Actions：Lint、Type Check、Unit Test、Build。
- [ ] 发布 Release 和变更日志。
- [ ] 收集 Issue 与使用反馈。

**交付物：** GitHub 首个公开版本。

### Phase 4：后续增强

- [ ] AI 流式协议适配器。
- [ ] 更丰富的请求与事件筛选。
- [ ] 事件时间间隔与吞吐分析。
- [ ] 可选 CDP 采集适配器。
- [ ] 采集会话保存与恢复。
- [ ] 可扩展的解析规则插件机制。
- [ ] npm 发布独立的 `sse-parser` 核心包。

---

## 11. GitHub 项目准备

### 11.1 仓库建议

- Repository：`streamlens`
- Description：`A Chrome DevTools extension for debugging SSE and AI streaming responses.`
- Topics：`chrome-extension`、`devtools`、`sse`、`typescript`、`vue3`、`ai-debugging`

### 11.2 README 应包含

1. 项目简介与目标用户。
2. 功能列表及明确的支持范围。
3. 安装与本地开发方式。
4. 演示 GIF 或截图。
5. 当前限制与常见问题。
6. 隐私说明。
7. 贡献方式和 License。

### 11.3 开源质量要求

- 使用明确的开源许可证。
- 不提交真实 Token、Cookie、用户日志或生产环境数据。
- Issue 模板要求报告时移除敏感信息。
- 变更记录遵循统一格式。
- PR 必须通过静态检查、类型检查、测试和构建。
- 对 Chrome API 的支持范围与已知限制保持透明。

---

## 12. 风险与应对

| 风险 | 影响 | 应对措施 |
|---|---|---|
| 页面注入无法捕获已经发出的请求 | 初始化阶段请求缺失 | 提供开启采集后重新加载页面的流程 |
| CDP 对持续 SSE 流的实时读取不符合预期 | 采集不完整 | 先做技术预研，必要时采用页面注入 |
| Hook 改变原始请求行为 | 影响被调试业务 | 以不干扰业务为原则，加入回归测试 |
| 大流量导致内存增长 | 插件卡顿或崩溃 | 限制缓存、截断大事件、节流渲染 |
| 敏感信息泄露 | 用户信任与安全风险 | 本地处理、脱敏、导出提醒、无默认上传 |
| Chrome 权限过宽 | 安装信任下降 | 最小权限、按需授权、清晰说明用途 |
| 页面伪造消息 | 错误数据或注入风险 | 校验消息格式、会话和来源，不信任页面输入 |
| Chrome 更新导致兼容性变化 | 功能异常 | 持续集成测试并记录支持版本 |

---

## 13. MVP 完成定义（Definition of Done）

只有同时满足以下条件，才认为首个 MVP 完成：

- [ ] 能在 Chrome DevTools 中打开 StreamLens 面板。
- [ ] 用户可以主动开启、停止和清空采集。
- [ ] 本地测试页面的目标 SSE 请求能够被捕获。
- [ ] `fetch` 流式响应与 `EventSource` 的支持边界有明确说明。
- [ ] 标准 SSE 事件解析通过核心单元测试。
- [ ] 请求列表、事件时间线和事件详情可用。
- [ ] 首事件延迟、总耗时、事件数量和解析错误可见。
- [ ] 能复制事件并导出 JSON 调试记录。
- [ ] 有数据大小限制、会话清理和敏感信息处理机制。
- [ ] README 能让其他开发者独立完成安装和测试。
- [ ] CI 中的类型检查、测试和构建通过。
- [ ] 已知限制和不支持的采集场景已写入文档。

---

## 14. 下一步行动

建议先完成 **Phase 0：技术预研**，不要直接进入完整 UI 开发。

首个可验证目标：

> 在本地 Node.js SSE Demo 页面中发起一个持续输出事件的 `fetch` 请求；用户打开 StreamLens DevTools 面板并开启采集后，能够看到请求状态和实时事件内容，且不影响页面原本的响应消费。

该目标通过后，再开始开发完整请求列表、事件详情、统计和导出功能。

