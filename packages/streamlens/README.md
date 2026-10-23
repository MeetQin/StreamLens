# StreamLens

An npm plugin for debugging **SSE / AI streaming responses** directly in the page.

One line mounts a debug panel in the bottom-right corner, captures streaming `fetch` responses and `EventSource`, and lets you inspect event timelines, JSON, raw data, parse errors and latency metrics per request. **No browser extension and no Chrome Web Store listing required.**

English | [简体中文](https://github.com/MeetQin/StreamLens/blob/main/packages/streamlens/README.zh-CN.md)

- In-page floating panel isolated with Shadow DOM, with no impact on host styles
- Standards-compliant SSE parsing (chunk boundaries, multi-line `data`, UTF-8)
- OpenAI `chat/completions` style adapter (`delta` normalization, `[DONE]` end marker)
- EventSource custom events (e.g. `progress`)
- Time to first event, total duration, average / max event interval, parse-error stats
- JSON / JSONL / HAR 1.2 export with best-effort token redaction by default
- Data stays in browser memory; nothing is uploaded by default
- ESM and IIFE builds with the Vue runtime bundled, zero configuration

## Install

```bash
npm i streamlens
# or pnpm add streamlens / yarn add streamlens
```

## Usage

Call it once from a browser entry point:

```ts
import { installStreamLens } from 'streamlens'

const streamlens = installStreamLens()
```

Capture starts immediately and a launcher appears in the bottom-right corner. Click it to open the panel.

### React

```tsx
// main.tsx
import { installStreamLens } from 'streamlens'

installStreamLens()
```

If the entry point may run during SSR, call it inside `useEffect`:

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

### Plain HTML / CDN

```html
<script src="https://unpkg.com/streamlens"></script>
<script>
  const streamlens = StreamLens.installStreamLens()
</script>
```

ESM CDN is also supported:

```html
<script type="module">
  import { installStreamLens } from 'https://esm.sh/streamlens'
  installStreamLens()
</script>
```

> `installStreamLens()` must be called in a browser environment. The module itself has no side effects and is safe to import statically.

## Options

```ts
installStreamLens({
  autoStart: true,          // start capturing on install; default true
  open: false,              // open the panel immediately; default shows the launcher
  position: 'bottom-right', // 'bottom-right' | 'bottom-left'
  theme: 'auto',            // 'auto' | 'light' | 'dark'
  enableAiAdapter: true,    // OpenAI / AI stream adapter
  redactOnExport: true,     // redact sensitive fields in exports
  limits: {
    maxRequests: 500,
    maxEventsPerRequest: 10_000,
    maxEventDataChars: 256 * 1024,
  },
  zIndex: 2147483647,
})
```

Repeated calls return the same instance and do not install duplicate hooks.

## API

```ts
const streamlens = installStreamLens()

streamlens.start()             // resume capture
streamlens.stop()              // pause capture; in-flight requests become aborted
streamlens.clear()             // clear captured data
streamlens.open()              // open the panel
streamlens.close()             // collapse to the launcher
streamlens.isCapturing()       // whether capture is active
streamlens.getRequests()       // CapturedRequest[]
streamlens.getEvents(id)       // CapturedEvent[]
streamlens.exportJson()        // redacted export records
streamlens.exportHar()         // HAR 1.2 file object
streamlens.destroy()           // unmount panel, restore fetch / EventSource
```

Also reachable from the console:

```js
window.__streamlens.getRequests()
```

## Capture scope and limitations

- **Only requests issued after installation are captured**; completed requests cannot be recovered.
- Data lives in page memory and is **cleared on reload or navigation**.
- Streaming detection on `fetch` is heuristic, based on `Content-Type` / URL / `Accept`; non-SSE plain text streams are also parsed as SSE on a best-effort basis.
- `EventSource` custom events are only observable when the page registers the matching type with `addEventListener`.
- Request headers and bodies are not captured; only the response stream is read.
- Only applies to the page context where it is installed; requests inside iframes require a separate install.
- Exports may still contain business-sensitive data. A confirmation is required before export, and URL parameters, Bearer/JWT tokens and common secret fields are redacted by default.

## Privacy

Captured data is processed only in local browser memory. Nothing is uploaded or written to disk by default; exports are triggered explicitly by the user.

## Development

Inside the repository:

```bash
pnpm install
pnpm --filter streamlens build
pnpm --filter streamlens test
pnpm demo   # http://localhost:4173/npm.html and /npm-iife.html
```

## License

MIT
