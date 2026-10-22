# Phase 4 — Implemented

## CDP metadata adapter (optional)

- Settings → **启用 CDP 元数据**
- On **Start Capture**, requests optional `debugger` permission and attaches CDP `Network` domain
- Enriches existing injected requests (status / MIME) or adds **`source: cdp`** metadata-only rows when injection missed the request
- Does **not** read streaming response bodies unless the body-stream prototype is enabled (below)

## CDP response-body stream (prototype)

- Settings → **CDP 响应体流式读取**
- Attaches the same CDP session as metadata (requires **debugger**; Chrome shows the “Debugger attached” banner)
- On `Network.responseReceived` for stream-like MIME types, calls `Network.streamResourceContent` then loops `IO.read` (64 KiB) and feeds chunks into the session SSE parser
- If streaming APIs fail, falls back to `Network.getResponseBody` on `Network.loadingFinished`
- **Injection wins**: if the page hook already captured the URL (`fetch-stream` / `event-source`), CDP only updates status/MIME — no duplicate body pump
- **Limits**: Chrome version / policy dependent; binary or very large bodies may still buffer; not a replacement for injection on same-origin pages where the hook runs

## Session persistence

- Settings → **保留采集快照** (default on)
- Uses `chrome.storage.session` keyed by inspected tab id
- Restored when DevTools panel sends `INIT`
- Cleared on **Clear** or tab close

## HAR export

- Toolbar **Export HAR** / **HAR Request**
- HAR 1.2 with `log.entries[].response.content.text` reconstructed from SSE events
- Custom field `log.entries[]._streamlens` retains full events + metrics

## npm package `@streamlens/sse-parser`

- See [packages/sse-parser/README.md](../packages/sse-parser/README.md)
- Publish: `cd packages/sse-parser && npm publish --access public` (after login)

## Not in scope

- Production-grade CDP-only capture (injection remains primary)
- Cross-tab session merge
- HAR without `_streamlens` extension block
