# Changelog

## 0.2.0 — 2026-03-21

### Added

- Optional CDP metadata enrichment (`debugger` optional permission).
- Session snapshot persist/restore via `chrome.storage.session`.
- HAR 1.2 export with `_streamlens` extension payload.
- `@streamlens/sse-parser` npm publish metadata and package README.

## 0.1.0 — 2026-03-21

### Added

- Chrome DevTools panel with capture toolbar, filters, virtualized lists.
- Injected `fetch` (tee) and `EventSource` hooks.
- `@streamlens/sse-parser`, `@streamlens/core`, `@streamlens/adapters-ai-stream`.
- OpenAI chat/completions adapter and `[DONE]` handling.
- Settings (storage): AI adapter, export redaction, cache limits.
- Export JSON / JSONL with confirmation preview.
- Integration tests (demo server) and optional Playwright E2E (`RUN_E2E=1`).

### Security

- Bridge message validation, session isolation, export redaction helpers.
