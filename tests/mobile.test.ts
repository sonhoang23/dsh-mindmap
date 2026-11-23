import { describe, expect, it } from 'vitest'
import { deepestParentLevel, shouldRefitView } from '../src/client/mobile.ts'

describe('mobile viewport refit', () => {
  const initial = { width: 390, height: 680 }

  it('refits when a map becomes visible or the sidebar width changes', () => {
    expect(shouldRefitView({ width: 0, height: 0 }, initial)).toBe(true)
    expect(shouldRefitView(initial, { width: 300, height: 680 })).toBe(true)
    expect(shouldRefitView(initial, { width: 680, height: 390 })).toBe(true)
  })

  it('ignores temporary browser chrome shifts to preserve manual zoom', () => {
    expect(shouldRefitView(initial, initial)).toBe(false)
    expect(shouldRefitView(initial, { width: 394, height: 635 })).toBe(false)
    expect(shouldRefitView(initial, { width: 390, height: 600 })).toBe(false)
  })

  it('responds to large height-only panel changes and rejects zero-sized viewports', () => {
    expect(shouldRefitView(initial, { width: 390, height: 500 })).toBe(true)
    expect(shouldRefitView(initial, { width: 0, height: 500 })).toBe(false)
    expect(shouldRefitView(initial, { width: 390, height: 0 })).toBe(false)
  })
})

describe('Level selection for compact mindmap controls', () => {
  it('matches the native toolbar: root without branches has no selectable levels', () => {
    expect(deepestParentLevel(undefined)).toBe(0)
    expect(deepestParentLevel({ children: [] })).toBe(0)
  })

  it('offers one level when only the root has children', () => {
    expect(deepestParentLevel({
      children: [{ children: [] }, { children: [] }],
    })).toBe(0)
  })

  it('counts the deepest parent, not the deepest leaf', () => {
    expect(deepestParentLevel({
      children: [
        { children: [] },
        { children: [
          { children: [{ children: [] }] },
        ] },
      ],
    })).toBe(2)
  })

  it('updates when the rendered tree gains a deeper branch', () => {
    const original = { children: [{ children: [{ children: [] }] }] }
    const updated = { children: [{ children: [{ children: [{ children: [] }] }] }] }
    expect(deepestParentLevel(original)).toBe(1)
    expect(deepestParentLevel(updated)).toBe(2)
  })
})
