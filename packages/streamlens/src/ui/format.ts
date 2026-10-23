export function fmtMs(value?: number): string {
  if (value === undefined) return '-'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(2)} s`
}

export function fmtTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

export function fmtDuration(startedAt: number, endedAt?: number): string {
  if (endedAt === undefined) return '进行中'
  return fmtMs(endedAt - startedAt)
}

export function previewText(text: string, max = 120): string {
  const singleLine = text.replace(/\s+/g, ' ').trim()
  return singleLine.length > max ? `${singleLine.slice(0, max)}…` : singleLine
}
