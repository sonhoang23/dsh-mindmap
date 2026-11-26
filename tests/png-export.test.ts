import { describe, expect, it, vi } from 'vitest'
import { exportAdaptivePng, pngExportScale } from '../src/client/png-export.ts'

describe('adaptive PNG export', () => {
  it('keeps the default 2x quality for a small map', () => {
    expect(pngExportScale({ width: 400, height: 600 })).toBe(2)
  })

  it('bounds the reported 2564 × 6599 failure by area, including padding', () => {
    const scale = pngExportScale({ width: 1242, height: 3259.5 })
    expect(scale).toBeLessThan(2)
    expect(Math.ceil(1282 * scale) * Math.ceil(3299.5 * scale)).toBeLessThanOrEqual(12 * 1024 * 1024)
    expect(scale).toBeGreaterThan(1)
  })

  it('limits very wide maps by their longest edge', () => {
    const scale = pngExportScale({ width: 40000, height: 10 })
    expect(Math.ceil(40040 * scale)).toBeLessThanOrEqual(8192)
  })

  it('rejects invalid bounds without allocating a canvas', () => {
    expect(() => pngExportScale({ width: NaN, height: 100 })).toThrow()
    expect(() => pngExportScale({ width: -1, height: 100 })).toThrow()
  })

  it('retries a null-blob encoding failure with half the scale and preserves the scheme', async () => {
    const render = vi.fn()
      .mockRejectedValueOnce(new Error('Could not export a 2564×6599 image'))
      .mockResolvedValueOnce('png')
    const result = await exportAdaptivePng({ width: 400, height: 600 }, 'dark', render)
    expect(result).toEqual({ png: 'png', reduced: true })
    expect(render.mock.calls).toEqual([
      [{ padding: 20, scale: 2, maxSize: 8192, colorScheme: 'dark' }],
      [{ padding: 20, scale: 1, maxSize: 8192, colorScheme: 'dark' }],
    ])
  })

  it('limits retries and propagates the final error', async () => {
    const error = new Error('Could not export a 100×100 image')
    const render = vi.fn().mockRejectedValue(error)
    await expect(exportAdaptivePng({ width: 100, height: 100 }, 'light', render)).rejects.toBe(error)
    expect(render).toHaveBeenCalledTimes(3)
  })

  it('does not retry unrelated errors', async () => {
    const error = new Error('SecurityError: Tainted canvas')
    const render = vi.fn().mockRejectedValue(error)
    await expect(exportAdaptivePng({ width: 100, height: 100 }, 'light', render)).rejects.toBe(error)
    expect(render).toHaveBeenCalledTimes(1)
  })
})
