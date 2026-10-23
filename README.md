# StreamLens

Debug **SSE / AI streaming responses** with an in-page floating panel distributed via npm (recommended), or as a Chrome DevTools extension loaded locally.

English | [简体中文](https://github.com/MeetQin/StreamLens/blob/main/README.zh-CN.md)

No Chrome Web Store listing and no extension install needed: run `npm i streamlens`, call `installStreamLens()` once, and a debug panel appears in the bottom-right corner.

## Quick start (npm plugin)

```bash
npm i streamlens
```

```ts
import { installStreamLens } from 'streamlens'

installStreamLens()
```

Capture starts immediately and a StreamLens launcher appears in the bottom-right corner. Fire any SSE / streaming `fetch` request, then click the launcher to inspect it.

For React / Vue, a single `installStreamLens()` call at your entry point is enough; in SSR environments call it inside `useEffect` or `onMounted`.

CDN usage:

```html
<script src="https://unpkg.com/streamlens"></script>
<script>
  StreamLens.installStreamLens()
</script>
```

See [packages/streamlens/README.md](packages/streamlens/README.md) for full usage, options and API reference.

## Features

- In-page floating panel isolated with Shadow DOM, with no impact on host page styles
- Captures streaming `fetch` responses (`ReadableStream.tee`) and `EventSource`
- Standards-compliant SSE parsing (chunk boundaries, multi-line data, UTF-8)
- Request list, event timeline, JSON parsing and errors, raw event stream
- Time to first event, total duration, event / parse-error counts, average / max event interval
- OpenAI `chat/completions` style adapter (delta normalization, `[DONE]` end marker)
- EventSource custom events (e.g. `progress`)
- JSON / JSONL / HAR 1.2 export with best-effort redaction by default
- Data stays in browser memory; nothing is uploaded by default
- Also loadable locally as a Chrome DevTools extension (no store listing)

## Limitations

- Must be installed **before** requests happen; completed requests cannot be recovered.
- Reloading or navigating clears in-page memory data (the Chrome extension flavor can survive reloads).
- Streaming detection on `fetch` is heuristic, based on `Content-Type` / URL / `Accept`.
- `EventSource` custom events are only observable when the page registers the matching `addEventListener` type.
- Request headers and bodies are not captured; only the response stream is read.
- Only applies to the page context where it is installed; iframes need a separate install.

## Local development

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run demo       # http://localhost:4173
pnpm run build:e2e
# With a headed local Chrome (not CI):
# Windows: $env:RUN_E2E='1'; pnpm exec playwright test
```

Demo pages:

- `/npm.html` — load the npm plugin as ESM (build `packages/streamlens` first)
- `/npm-iife.html` — `<script>` / IIFE usage
- `/` — Chrome extension capture demo

Publish the npm package (requires `npm login`):

```bash
pnpm run publish:streamlens
```

## Repository layout

- `packages/streamlens` — **npm in-page plugin** (Vue panel + fetch/EventSource hooks)
- `apps/extension` — Chrome DevTools extension (kept, loadable locally)
- `packages/protocol` — messages and data models
- `packages/sse-parser` — standalone SSE parser (Vitest)
- `packages/core` — session, metrics, redaction and export
- `packages/adapters/ai-stream` — AI streaming protocol adapters (OpenAI, etc.)
- `fixtures/sse-demo-server` — local SSE demo server
- `tests/integration` — Node integration tests (no Chrome required)

## Chrome extension (optional)

The extension flavor is retained and still works locally:

1. Open `chrome://extensions` and enable **Developer mode**
2. **Load unpacked** → select `apps/extension/dist`
3. Open the demo page at http://localhost:4173
4. DevTools → **StreamLens** → **Start Capture** → reload the page → click a test button

Documentation:

- [Architecture](docs/ARCHITECTURE.md)
- [Known limitations](docs/LIMITATIONS.md)
- [MVP checklist](docs/MVP-CHECKLIST.md)
- [Phase 4 features](docs/PHASE4.md)

## Privacy

Captured data is processed only in local browser memory; exports require explicit confirmation. Token-like URL query fields can be extended in the redaction helpers (prefer the redacted copy when exporting JSON).

## License

MIT — see [LICENSE](./LICENSE)
