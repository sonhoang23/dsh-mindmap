/** Pure viewport heuristic for the Better Sidebar / mobile mind-map canvas.
 * Tiny mobile browser chrome changes must not repeatedly reset zoom/pan.
 * Keep this independent of DOM so behavior can be regression-tested.
 */
export interface ViewportSize {
  width: number
  height: number
}

export function shouldRefitView(previous: ViewportSize, next: ViewportSize): boolean {
  if (next.width <= 0 || next.height <= 0) return false
  if (previous.width <= 0 || previous.height <= 0) return true
  return Math.abs(next.width - previous.width) >= 8
    || Math.abs(next.height - previous.height) >= 120
}
