# Changelog

## streamlens 0.1.1 — 2026-10-23

### Changed

- Bilingual README: English by default, Simplified Chinese in `README.zh-CN.md`, with switch links at the top of both files.
- HAR exports now report the actual package version as the creator version.

## streamlens npm 0.1.0 — 2026-10-22

### Added

- `streamlens` npm package: in-page floating panel, no browser extension required.
- Vue UI mounted in a Shadow DOM host with light/dark theme, resize, and mobile layout.
- Direct page hooks for `fetch` streaming bodies and `EventSource` (including custom event types).
- `CaptureController` with 50 ms batched UI updates, public `installStreamLens()` / `getStreamLens()` API.
- JSON / JSONL / HAR export from the panel and programmatic `exportJson()` / `exportHar()`.
- ESM + IIFE builds with Vue bundled (no runtime dependencies).
- Demo pages `/npm.html` and `/npm-iife.html` in the SSE demo server.

### Notes

- Chrome extension under `apps/extension` is kept and can still be loaded locally.

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
