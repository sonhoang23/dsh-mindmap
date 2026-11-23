/** Conservative, content-based opt-in: no ordinary Markdown is hijacked. */
export function isMarkdownPath(path: string): boolean {
  return /\.(?:md|markdown)$/i.test(path)
}

export function isMindmapMarkdown(markdown: string): boolean {
  const text = markdown.replace(/^\uFEFF/, '')
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text)
  if (match === null) return false
  return /^[ \t]*markmap[ \t]*:[ \t]*(?:true|"true"|'true'|(?=$))[ \t]*(?:#.*)?$/im.test(match[1] ?? '')
}

export function detectMindmap(path: string, head: Uint8Array): boolean {
  if (!isMarkdownPath(path) || head.byteLength === 0) return false
  return isMindmapMarkdown(new TextDecoder('utf-8').decode(head))
}

/**
 * Body-based routing runs after Better Sidebar's fsRead completes.
 * This is reliable even when its initial viewer selection has no sniff bytes.
 */
export function shouldAutoOpenMindmap(path: string, content: string): boolean {
  return isMarkdownPath(path) && isMindmapMarkdown(content)
}
