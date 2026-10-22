# @streamlens/sse-parser

Incremental **Server-Sent Events (SSE)** parser for TypeScript. No DOM or Chrome dependencies.

## Install

```bash
npm install @streamlens/sse-parser
# or
pnpm add @streamlens/sse-parser
```

## Usage

```ts
import { SseParser, enrichWithJson } from '@streamlens/sse-parser'

const parser = new SseParser()
for (const chunk of chunks) {
  for (const event of parser.push(chunk)) {
    const withJson = enrichWithJson(event, true)
    console.log(withJson.data, withJson.parsedData)
  }
}
```

## Features

- LF / CRLF line endings
- Multi-line `data:` fields
- `event`, `id`, `retry`, comments
- Arbitrary chunk boundaries (including UTF-8)

## Publish

From repo root after `pnpm run build`:

```bash
cd packages/sse-parser
npm publish --access public
```

## License

MIT
