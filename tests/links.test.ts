import { describe, expect, it } from 'vitest'
import { resolveMarkdownLink } from '../src/client/links.ts'

describe('resolveMarkdownLink', () => {
  const source = 'knowledge/mindmaps/articles/marketing/2026-02/article.mindmap.md'
  it('resolves the actual translation link', () => {
    expect(resolveMarkdownLink(source, '../../../../explorations/marketing/2026-11/2026-11-23-startup-marketing-101-vi.md')).toBe('knowledge/explorations/marketing/2026-11/2026-11-23-startup-marketing-101-vi.md')
  })
  it('supports Windows and POSIX paths', () => {
    expect(resolveMarkdownLink('C:\\repo\\maps\\a.md', '../wiki/b.md')).toBe('C:/repo/wiki/b.md')
    expect(resolveMarkdownLink('/repo/maps/a.md', '../wiki/b.md')).toBe('/repo/wiki/b.md')
  })
  it('handles encoded filenames and fragments', () => {
    expect(resolveMarkdownLink(source, './a%20b.md#heading')).toBe('knowledge/mindmaps/articles/marketing/2026-02/a b.md')
  })
  it.each(['https://example.com/a.md', '//example.com/a.md', '#heading', 'mailto:a@b.com', 'javascript:alert(1)', 'https://example.com', 'bad%zz.md'])('leaves %s alone', href => {
    expect(resolveMarkdownLink(source, href)).toBeNull()
  })
})
