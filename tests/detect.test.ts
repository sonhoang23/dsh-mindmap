import { describe, expect, it } from 'vitest'
import { detectMindmap, isMarkdownPath, isMindmapMarkdown, shouldAutoOpenMindmap } from '../src/client/detect.ts'

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value)

describe('mindmap opt-in', () => {
  it('accepts only Markdown paths', () => {
    expect(isMarkdownPath('docs/map.md')).toBe(true)
    expect(isMarkdownPath('docs/map.MARKDOWN')).toBe(true)
    expect(isMarkdownPath('config.json')).toBe(false)
  })

  it('requires frontmatter at the start, not a body mention', () => {
    expect(isMindmapMarkdown('---\nmarkmap: true\n---\n# Root')).toBe(true)
    expect(isMindmapMarkdown('\uFEFF---\r\nmarkmap: "true"\r\n---\r\n# Root')).toBe(true)
    expect(isMindmapMarkdown('---\nmarkmap:\n  theme: cards\n---\n# Root')).toBe(true)
    expect(isMindmapMarkdown('# Root\nmarkmap: true')).toBe(false)
    expect(isMindmapMarkdown('---\nmarkmap: false\n---\n# Root')).toBe(false)
    expect(isMindmapMarkdown('---\nother: true\n---\nmarkmap: true')).toBe(false)
  })

  it('uses loaded content regardless of the presence of sniff head', () => {
    expect(shouldAutoOpenMindmap('topic-taxonomy-mindmap.md', '---\nmarkmap: true\nsource: topic-taxonomy.md\n---\n# Root')).toBe(true)
    expect(shouldAutoOpenMindmap('normal.md', '# Normal Markdown')).toBe(false)
    expect(shouldAutoOpenMindmap('notes.txt', '---\nmarkmap: true\n---')).toBe(false)
  })

  it('uses sniff-only matching', () => {
    expect(detectMindmap('map.md', bytes('---\nmarkmap: true\n---\n# Root'))).toBe(true)
    expect(detectMindmap('doc.md', bytes('# Normal Markdown'))).toBe(false)
    expect(detectMindmap('map.txt', bytes('---\nmarkmap: true\n---'))).toBe(false)
  })
})
