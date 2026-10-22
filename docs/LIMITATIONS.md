# Known Limitations

## Capture scope

| Scenario                         | Supported | Notes                                                            |
| -------------------------------- | --------- | ---------------------------------------------------------------- |
| `fetch` + streaming body         | Partial   | Heuristic on `Content-Type`, URL, `Accept`                       |
| `EventSource`                    | Yes       | Standard + custom events via `addEventListener`                  |
| XHR streaming                    | No        | Not hooked                                                       |
| WebSocket                        | No        | Out of MVP scope                                                 |
| Requests before capture + inject | No        | Reload after Start Capture                                       |
| Page reload while capturing      | Yes       | Hooks are re-injected; in-flight requests are marked aborted     |
| MV3 service worker restart       | Yes       | Capture state always; session snapshot requires `persistSession` |
| Cross-tab aggregation            | No        | One inspected tab per DevTools panel                             |
| CDP / debugger API               | Optional  | Metadata only (`enableCdpMetadata` + `debugger` permission)      |

## Capture lifecycle

- Capture state (`sessionId` + `capturing`) is persisted in `chrome.storage.session` so a restarted MV3 service worker can resume the same session.
- After a reload, the content script announces itself (`HELLO`); if capture is active the background returns the session ID and the page hooks are injected again.
- Scripts already running in the new document may issue requests before hook injection completes; those early requests can still be missed.
- Optional CDP attach is not restored after an MV3 worker restart; `fetch` / `EventSource` capture resumes without it. Stop → Start re-attaches and keeps captured data.

## Security

- Content script runs on `<all_urls>` when extension is installed; capture only processes messages when capture is active and `sessionId` matches.
- Page messages are validated (`message-guard`) before entering `CaptureSession`.
- Export may still contain business-sensitive payloads; use settings → export redaction.

## Performance

- Virtual scrolling for request list and event timeline (fixed row height).
- Background batches UI updates (~32ms).
- Hard limits: max requests, events per request, event string length (configurable in Settings).

## AI protocols

- OpenAI-style `chat/completions` SSE is normalized; other vendors need new adapters in `packages/adapters/ai-stream`.
