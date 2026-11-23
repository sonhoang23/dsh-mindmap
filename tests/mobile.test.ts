import { describe, expect, it } from 'vitest'
import { shouldRefitView } from '../src/client/mobile.ts'

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
