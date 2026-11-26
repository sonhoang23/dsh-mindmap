// @markmap/canvas 1.1.1 uses 20px padding on each side and a default 2x scale.
// Bound both the canvas area and longest edge before allocation; a dimension
// limit alone does not protect mobile browsers from large pixel buffers.
const padding = 20
const preferredScale = 2
const maxPixels = 12 * 1024 * 1024
const maxSize = 8192

type Bounds = { width: number; height: number }
type PngOptions = { padding: number; scale: number; maxSize: number; colorScheme: 'light' | 'dark' }

export function pngExportScale(bounds: Bounds): number {
  const width = bounds.width + padding * 2
  const height = bounds.height + padding * 2
  if (!Number.isFinite(width) || !Number.isFinite(height) || bounds.width < 0 || bounds.height < 0) {
    throw new Error('Kích thước sơ đồ không hợp lệ.')
  }
  let scale = Math.min(preferredScale, maxSize / Math.max(width, height), Math.sqrt(maxPixels / width / height))
  // Markmap rounds both dimensions up. Account for that before allocating.
  while (Math.ceil(width * scale) * Math.ceil(height * scale) > maxPixels) scale *= 0.99
  return scale
}

function canRetry(error: unknown): boolean {
  return error instanceof RangeError || (error instanceof Error &&
    /Could not export a |Canvas 2D is not available|canvas.*(?:memory|size|area)/i.test(error.message))
}

// Retry known allocation/encoding failures at successively smaller sizes.
// Do not hide unrelated errors (e.g. tainted canvas / SecurityError).
export async function exportAdaptivePng<T>(
  bounds: Bounds, colorScheme: PngOptions['colorScheme'], render: (options: PngOptions) => Promise<T>,
): Promise<{ png: T; reduced: boolean }> {
  let scale = pngExportScale(bounds)
  for (let attempt = 0; ; attempt++) {
    try {
      const png = await render({ padding, scale, maxSize, colorScheme })
      return { png, reduced: scale < preferredScale }
    } catch (error) {
      if (attempt >= 2 || !canRetry(error)) throw error
      scale /= 2
    }
  }
}
