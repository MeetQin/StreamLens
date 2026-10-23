# StreamLens Architecture

## Layers

| Layer     | Package / path                | Responsibility                                              |
| --------- | ----------------------------- | ----------------------------------------------------------- |
| Protocol  | `packages/protocol`           | Shared types, settings keys, limits                         |
| Parser    | `packages/sse-parser`         | Incremental SSE parsing (no DOM/Chrome)                     |
| Adapters  | `packages/adapters/ai-stream` | Vendor stream normalization                                 |
| Core      | `packages/core`               | `CaptureSession`, metrics, export redaction                 |
| In-page   | `packages/streamlens`         | npm plugin: page hooks, `CaptureController`, Shadow DOM UI  |
| Extension | `apps/extension`              | MV3 background, content bridge, injected hooks, DevTools UI |

## In-page npm plugin

`packages/streamlens` is the primary delivery target (`npm i streamlens`). It runs entirely in the page:

```text
Page (streamlens runtime)
  fetch / EventSource hooks
  → CaptureController (direct calls, 50 ms batching)
  → CaptureSession (parser, adapters, redaction)
  → Vue panel mounted in a Shadow DOM host
```

- No extension permissions or `chrome.*` APIs.
- `installStreamLens()` is idempotent and stores the instance on `window.__streamlens`.
- `destroy()` restores `fetch` / `EventSource` (unless another script wrapped them later) and unmounts the panel.
- The UI is bundled with Vue and all workspace packages, so the published package has no runtime dependencies.
- State is in-memory only; reloading the page clears captured data.

## Extension message flow

```text
Page (injected hooks)
  → window.postMessage (streamlens-page)
Content script (bridge + validation)
  → chrome.runtime (streamlens-bridge)
Background (CaptureSession)
  → chrome.runtime.Port (batch updates)
DevTools panel (Vue)
```

## Capture model

- User starts capture from DevTools → background persists `{sessionId, capturing}` in `chrome.storage.session`, registers `sessionId` on tab → content injects `injected.js`.
- The background creates per-tab sessions through `ensureTab`, which restores the session ID and snapshot after an MV3 service worker restart.
- On page load the content script sends `STREAMLENS_HELLO`; if capture is active, the background returns the session ID and the bridge re-injects page hooks. Hook re-binding updates the current session ID without reinstalling `fetch` / `EventSource`.
- Page navigation keeps capture active; open requests from the previous document are finished as `aborted` and CDP per-tab mappings are reset.
- `injected.js` runs in the MAIN world as a classic script, so the build bundles it as a self-contained IIFE (esbuild) rather than an ES module with chunk imports.
- `fetch` uses `ReadableStream.tee()` so business code keeps full body consumption.
- Parsing runs in the service worker, not in the page thread.
- The DevTools panel reconnects its port with exponential backoff and reloads a fresh snapshot.

## E2E bridge (test builds only)

When built with `STREAMLENS_E2E=1`, pages with `data-streamlens-e2e="1"` may trigger `E2E_START_CAPTURE` / `E2E_GET_SNAPSHOT` via content script for Playwright tests.
