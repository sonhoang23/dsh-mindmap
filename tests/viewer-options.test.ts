import { describe, expect, it, vi } from 'vitest'
import { applyInitialLevel, defaultPreferences, exportScheme, resolveViewerOptions, visibleWarnings, viewportPresets } from '../src/client/viewer-options.ts'

const md = '---\nmarkmap:\n  theme: cards\n  colorScheme: dark\n  layout: org-chart\n  color: "#3983b8"\n  levelGap: 110\n  siblingGap: 9\n  wrapWidth: 330\n  foldLevel: 2\n  fitPadding: 40\n---\n# Root\n## Branch\n- Leaf'
const resolve = (preferences = defaultPreferences, layout = 'document', width = 'auto', text = md) =>
  resolveViewerOptions(text, preferences, layout, width, 180)

describe('viewer options', () => {
  it('honors frontmatter in document mode and the actual root depth', () => {
    const { options, warnings } = resolve()
    expect(options.theme?.name).toBe('cards')
    expect(options.layout?.name).toBe('org-chart')
    expect(options).toMatchObject({ colorScheme: 'dark', levelGap: 110, siblingGap: 9, wrapWidth: 330, foldLevel: 2, fitPadding: 40 })
    expect(warnings).toEqual([])
  })
  it('applies temporary overrides over document settings without changing source', () => {
    const before = md
    const { options } = resolve({ ...defaultPreferences, theme: 'classic', scheme: 'light', palette: 'mono', colorDepth: '2', levelGap: '40', siblingGap: '2', viewport: 'compact' }, 'two-sided', '280')
    expect(options.theme?.name).toBe('classic')
    expect(options.layout?.name).toBe('two-sided')
    expect(options).toMatchObject({ colorScheme: 'light', levelGap: 40, siblingGap: 2, wrapWidth: 280, ...viewportPresets.compact })
    expect(options.theme?.tokens['mm-branch-0']).toBe('#3983b8')
    expect(md).toBe(before)
    expect(resolve().options.colorScheme).toBe('dark')
  })
  it('uses adaptive wrap only when the document has no width', () => {
    expect(resolve(defaultPreferences, 'document', 'auto', '# Root').options.wrapWidth).toBe(180)
    expect(resolve(defaultPreferences, 'document', '0').options.wrapWidth).toBe(0)
  })
  it('retains warnings masked by overrides, clears corrected warnings and accepts boolean marker', () => {
    const broken = '---\nmarkmap:\n  theme: wrong\n  levelGap: nope\n  strangeOption: true\n---\n# Root'
    const warnings = visibleWarnings(resolve({ ...defaultPreferences, theme: 'cards', levelGap: '80' }, 'document', 'auto', broken).warnings)
    expect(warnings.some(w => w.includes('theme'))).toBe(true)
    expect(warnings.some(w => w.includes('levelGap'))).toBe(true)
    expect(warnings.some(w => w.includes('strangeOption'))).toBe(true)
    expect(warnings.join(' ')).not.toContain('wrong')
    expect(resolve(defaultPreferences, 'document', 'auto', '---\nmarkmap: true\n---\n# Root').warnings).toEqual([])
  })
  it('keeps palettes out of Minimal effective options', () => {
    const { options, warnings } = resolve({ ...defaultPreferences, theme: 'minimal', palette: 'mono', colorDepth: '2' })
    expect(options.theme?.name).toBe('minimal')
    expect(warnings).toEqual([])
  })
  it('rejects unexpected control values and bounds viewport presets', () => {
    expect(resolve({ ...defaultPreferences, levelGap: '99999', viewport: 'unknown' }).options.levelGap).toBe(110)
    for (const preset of Object.values(viewportPresets)) {
      expect(preset.minScale).toBeGreaterThan(0)
      expect(preset.maxScale).toBeGreaterThan(preset.minScale)
      expect(preset.fitMaxScale).toBeLessThanOrEqual(preset.maxScale)
      expect(preset.fitPadding).toBeGreaterThanOrEqual(0)
    }
  })
  it('uses the same fixed export scheme for both formats at download time', () => {
    expect(exportScheme('auto', true)).toBe('dark')
    expect(exportScheme('auto', false)).toBe('light')
    expect(exportScheme('light', true)).toBe('light')
    expect(exportScheme('dark', false)).toBe('dark')
    expect(exportScheme(undefined, true)).toBe('light')
  })
  it('applies an opening level only when explicitly requested by the caller', () => {
    const map = { expandAll: vi.fn(), foldToLevel: vi.fn() }
    applyInitialLevel(map, 'document')
    expect(map.expandAll).not.toHaveBeenCalled()
    expect(map.foldToLevel).not.toHaveBeenCalled()
    applyInitialLevel(map, 'all')
    expect(map.expandAll).toHaveBeenCalledOnce()
    applyInitialLevel(map, '2')
    expect(map.foldToLevel).toHaveBeenCalledWith(2)
  })
})
