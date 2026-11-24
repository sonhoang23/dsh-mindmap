/** Resolve local Markdown links against the source file, never the web origin. */
export function resolveMarkdownLink(source: string, href: string): string | null {
  const raw = href.trim()
  if (!raw || raw.startsWith('#') || raw.startsWith('//') || raw.startsWith('\\\\') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null
  let target: string
  try { target = decodeURIComponent(raw.split(/[?#]/, 1)[0]!) } catch { return null }
  if (!/\.(md|markdown)$/i.test(target) || /[\u0000-\u001f]/.test(target)) return null
  target = target.replace(/\\/g, '/')
  if (target.startsWith('/') || /^[a-z]:/i.test(target)) return null
  const base = source.replace(/\\/g, '/')
  const prefix = base.startsWith('//') ? '//' : base.startsWith('/') ? '/' : ''
  const parts = base.slice(prefix.length).split('/')
  parts.pop()
  for (const part of target.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length && parts[parts.length - 1] !== '..' && !/^[a-z]:$/i.test(parts[parts.length - 1]!)) parts.pop()
      else if (!prefix && !/^[a-z]:/i.test(base)) parts.push('..')
      else return null
    } else parts.push(part)
  }
  return prefix + parts.join('/')
}
