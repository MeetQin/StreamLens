import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 4173)

function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    })
    res.end()
    return
  }

  if (req.url === '/e2e.html') {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'e2e.html'), 'utf8')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (req.url === '/' || req.url === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (req.url === '/api/sse') {
    sseHeaders(res)
    let i = 0
    const timer = setInterval(() => {
      i += 1
      const payload =
        i === 3
          ? { message: '中文与 emoji 🚀', n: i }
          : i === 5
            ? '{ invalid json'
            : { message: `event-${i}`, n: i }
      res.write(`event: tick\ndata: ${JSON.stringify(payload)}\n\n`)
      if (i >= 8) {
        clearInterval(timer)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }, 400)
    req.on('close', () => clearInterval(timer))
    return
  }

  if (req.url === '/api/eventsource') {
    sseHeaders(res)
    res.write('data: {"via":"eventsource"}\n\n')
    setTimeout(() => res.end(), 2000)
    return
  }

  if (req.url === '/api/eventsource-custom') {
    sseHeaders(res)
    res.write('event: progress\ndata: {"pct":50}\n\n')
    setTimeout(() => {
      res.write('event: progress\ndata: {"pct":100}\n\n')
      res.end()
    }, 300)
    return
  }

  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    sseHeaders(res)
    const chunks = [
      { choices: [{ index: 0, delta: { content: '你' } }] },
      { choices: [{ index: 0, delta: { content: '好' } }] },
    ]
    let i = 0
    const timer = setInterval(() => {
      if (i < chunks.length) {
        res.write(`data: ${JSON.stringify(chunks[i])}\n\n`)
        i += 1
      } else {
        res.write('data: [DONE]\n\n')
        clearInterval(timer)
        res.end()
      }
    }, 200)
    req.on('close', () => clearInterval(timer))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`SSE demo: http://localhost:${PORT}`)
})
