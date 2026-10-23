import { readFileSync } from 'node:fs'

const files = ['../dist/streamlens.js', '../dist/streamlens.iife.js']

for (const file of files) {
  const code = readFileSync(new URL(file, import.meta.url), 'utf8')
  if (code.includes('process.env')) {
    console.error(`[streamlens] unresolved process.env reference in ${file}`)
    process.exit(1)
  }
}
