import { describe, expect, it } from 'vitest'
import { parseSessionFile, sessionFileAddress, decodeMindmap } from '../src/client/native-file.ts'
describe('native document resources', () => {
  it('round trips encoded paths in the addressed session', () => {
    for (const path of ['C:/My notes/a #?.mindmap.md', '/home/me/map.mindmap.md', 'notes/map.mindmap.md', '//server/share/map.md']) {
      expect(parseSessionFile(sessionFileAddress('session 1', path))).toEqual({ sessionId: 'session 1', path })
    }
  })
  it('rejects invalid and non-session addresses', () => {
    expect(parseSessionFile('dsh-resource://file/absolute/x.md')).toBeNull()
    expect(parseSessionFile('dsh-resource://file/session/s/%FF')).toBeNull()
  })
  it('decodes UTF-8 and rejects binary and oversized input', () => {
    expect(decodeMindmap(new TextEncoder().encode('# Kiến thức'))).toBe('# Kiến thức')
    expect(() => decodeMindmap(new Uint8Array([255]))).toThrow()
    expect(() => decodeMindmap(new Uint8Array([0]))).toThrow()
    expect(() => decodeMindmap(new Uint8Array(2*1024*1024+1))).toThrow()
  })
})
