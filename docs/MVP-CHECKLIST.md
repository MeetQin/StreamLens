# MVP Definition of Done

| Item | Status |
|------|--------|
| StreamLens DevTools panel | Done |
| Start / Stop / Clear capture | Done |
| Demo page SSE capture | Done |
| fetch + EventSource boundaries documented | Done (`docs/LIMITATIONS.md`) |
| SSE parser unit tests | Done |
| Request list, timeline, detail | Done |
| Latency, duration, counts, errors | Done |
| Copy event + export JSON | Done (+ JSONL, summary) |
| Limits, session cleanup, redaction | Done |
| README install / dev | Done |
| CI typecheck, test, build | Done |
| Known limitations documented | Done |

### Phase 3 (开源质量)

| Item | Status |
|------|--------|
| README / CONTRIBUTING / LICENSE | Done |
| GitHub Actions (lint, typecheck, test, build) | Done |
| Issue 模板 | Done |
| CHANGELOG | Done |

### Phase 4

| Item | Status |
|------|--------|
| CDP 元数据适配（可选 debugger） | Done — see [PHASE4.md](./PHASE4.md) |
| 会话持久化（storage.session） | Done |
| HAR 导出（含 `_streamlens`） | Done |
| `@streamlens/sse-parser` npm 发布配置 | Done |
| Playwright 扩展 E2E（CI 稳定） | 本地 headed + `RUN_E2E=1` |
