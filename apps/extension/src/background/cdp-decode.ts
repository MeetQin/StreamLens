/** Decode CDP IO.read payload (often base64) to UTF-8 text for SSE parser */
export function decodeCdpIoData(data: string, base64Encoded?: boolean): string {
  if (!base64Encoded) return data
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
