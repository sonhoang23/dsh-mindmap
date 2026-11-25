const PREFIX = 'dsh-resource://file/session/'
export function parseSessionFile(address: string): { sessionId: string; path: string } | null {
  if (!address.startsWith(PREFIX)) return null
  try {
    const [id, ...parts] = address.slice(PREFIX.length).split(/[?#]/, 1)[0]!.split('/')
    if (!id || !parts.length) return null
    const path = parts.map(decodeURIComponent).join('/')
    return path ? { sessionId: decodeURIComponent(id), path } : null
  } catch { return null }
}
export function sessionFileAddress(sessionId: string, path: string): string {
  const encode = (part: string) => encodeURIComponent(part).replace(/%3A/gi, ':')
  return PREFIX + encode(sessionId) + '/' + path.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '').split('/').map(encode).join('/')
}
export function decodeMindmap(data: Uint8Array): string {
  if (data.byteLength > 2 * 1024 * 1024) throw new Error('File Mindmap vượt quá 2 MB.')
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data)
  if (text.includes('\0')) throw new Error('File không phải Markdown văn bản.')
  return text
}
