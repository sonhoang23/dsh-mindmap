/** Pure viewport heuristic for the Better Sidebar / mobile mind-map canvas.
 * Tiny mobile browser chrome changes must not repeatedly reset zoom/pan.
 * Keep this independent of DOM so behavior can be regression-tested.
 */
export type MobileView = 'overview' | 'reading'
export interface MobilePreferences { mode: MobileView; autoHide: boolean }
const readerKey = 'dsh-mindmap:mobile-reader:v1'

export function parseMobilePreferences(raw: string | null): MobilePreferences {
  try {
    const value = raw ? JSON.parse(raw) : null
    return { mode: value?.mode === 'reading' ? 'reading' : 'overview', autoHide: value?.autoHide === true }
  } catch { return { mode: 'overview', autoHide: false } }
}
export function readMobilePreferences(): MobilePreferences {
  try { return parseMobilePreferences(localStorage.getItem(readerKey)) }
  catch { return parseMobilePreferences(null) }
}
export function writeMobilePreferences(value: MobilePreferences): void {
  try { localStorage.setItem(readerKey, JSON.stringify(value)) } catch { /* session only */ }
}
export function readingFoldLevel(tree: FoldTreeNode | undefined, explicitLevel: boolean): number | undefined {
  if (!tree || explicitLevel || deepestParentLevel(tree) < 2) return undefined
  let count = 0
  const pending = [tree]
  while (pending.length && count < 40) {
    const node = pending.pop()!
    count++
    for (const child of node.children ?? []) pending.push(child)
  }
  return count >= 40 ? 2 : undefined
}
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


/** Match Markmap's built-in "fold-level" menu: only nodes with children
 * count as levels, so the deepest leaf is not offered as a no-op option.
 */
export interface FoldTreeNode {
  children?: readonly FoldTreeNode[]
}

export function deepestParentLevel(node: FoldTreeNode | undefined, depth = 0): number {
  if (!node?.children?.length) return 0
  return Math.max(depth, ...node.children.map(child => deepestParentLevel(child, depth + 1)))
}
