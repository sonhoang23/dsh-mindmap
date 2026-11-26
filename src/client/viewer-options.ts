import { parse } from '@markmap/parse'
import { resolveViewOptions } from '@markmap/view'

export type ViewOptions = ReturnType<typeof resolveViewOptions>['options']
export type ViewerPreferences = {
  theme: string
  scheme: string
  palette: string
  colorDepth: string
  levelGap: string
  siblingGap: string
  viewport: string
}

export const defaultPreferences: ViewerPreferences = {
  theme: 'document', scheme: 'document', palette: 'document',
  colorDepth: 'document', levelGap: 'document', siblingGap: 'document', viewport: 'document',
}

// Mid-tone colors remain distinguishable against both built-in backgrounds.
// Minimal intentionally does not support branch palettes.
const palettes: Record<string, string[]> = {
  ocean: ['#2683b5', '#0d9488', '#7c75c8', '#b56c39'],
  contrast: ['#2879b9', '#c46b28', '#258c67', '#ac64a3', '#78823c'],
  mono: ['#3983b8'],
}
export const viewportPresets = {
  compact: { fitPadding: 12, fitMaxScale: 2, minScale: 0.1, maxScale: 8 },
  large: { fitPadding: 24, fitMaxScale: 1, minScale: 0.05, maxScale: 6 },
} as const

export type InitialLevel = 'document' | 'all' | '1' | '2' | '3' | '4'
export const initialLevels: InitialLevel[] = ['document', 'all', '1', '2', '3', '4']
const initialLevelKey = 'dsh-mindmap:initial-level:v1'
export function readInitialLevel(): InitialLevel {
  try {
    const stored = localStorage.getItem(initialLevelKey)
    if (initialLevels.includes(stored as InitialLevel)) return stored as InitialLevel
  } catch { /* Storage may be disabled; use the document default. */ }
  return 'document'
}
export function writeInitialLevel(level: InitialLevel): void {
  try { localStorage.setItem(initialLevelKey, level) } catch { /* Session-only fallback. */ }
}
export function applyInitialLevel(map: { expandAll(): void; foldToLevel(level: number): void }, level: InitialLevel): void {
  if (level === 'all') map.expandAll()
  else if (level !== 'document') map.foldToLevel(Number(level))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const oneOf = (value: string, allowed: string[]) => allowed.includes(value)

// The element merges document options *after* its options property. Resolve a
// separate effective configuration via the public API instead of changing YAML.
// Preserve the exact draft for editing, saving and Markdown export.
export function resolveViewerOptions(
  markdown: string, preferences: ViewerPreferences, layout: string, width: string, autoWidth: number,
): { options: ViewOptions; warnings: string[] } {
  const raw: unknown = parse(markdown).frontmatter.markmap
  const documentOptions = isRecord(raw) ? raw : {}
  const effective = { ...documentOptions }
  const p = preferences
  if (oneOf(layout, ['tree', 'two-sided', 'org-chart'])) effective.layout = layout
  if (oneOf(p.theme, ['classic', 'cards', 'minimal'])) effective.theme = p.theme
  if (oneOf(p.scheme, ['light', 'dark', 'auto'])) effective.colorScheme = p.scheme
  if (oneOf(width, ['0', '180', '280', '400'])) effective.wrapWidth = Number(width)
  if (Object.hasOwn(palettes, p.palette)) effective.color = [...palettes[p.palette]!]
  if (oneOf(p.colorDepth, ['0', '1', '2', '3', '4'])) effective.colorDepth = Number(p.colorDepth)
  if (oneOf(p.levelGap, ['40', '80', '120'])) effective.levelGap = Number(p.levelGap)
  if (oneOf(p.siblingGap, ['2', '5', '12'])) effective.siblingGap = Number(p.siblingGap)
  if (p.viewport === 'compact' || p.viewport === 'large') Object.assign(effective, viewportPresets[p.viewport])
  // Palette options do not apply to Minimal. Keep them in the document and
  // preferences so switching back to Classic/Cards restores their effect.
  if (effective.theme === 'minimal') {
    delete effective.color
    delete effective.colorDepth
  }
  const resolved = resolveViewOptions({ wrapWidth: autoWidth }, effective)
  // A bad document option remains visible even if a temporary override masks it.
  const source = resolveViewOptions({}, documentOptions)
  const invalidContainer = raw != null && raw !== true && raw !== false && !isRecord(raw)
  return {
    options: resolved.options,
    warnings: [
      ...(invalidContainer ? ['Markmap options must be an object.'] : []),
      ...source.warnings, ...resolved.warnings,
    ],
  }
}

// Markmap warnings are strings. Unknown theme/layout messages may include an
// arbitrary frontmatter value: report the option name, never that value.
export function visibleWarnings(warnings: readonly string[]): string[] {
  return [...new Set(warnings.map(warning => {
    if (/^Unknown (theme|layout) /i.test(warning)) {
      return 'Unknown ' + (/^Unknown theme /i.test(warning) ? 'theme' : 'layout') + '; choose a supported value.'
    }
    const unknown = /^Unknown option `([A-Za-z0-9_.-]{1,64})`$/.exec(warning)
    if (warning.startsWith('Unknown option ')) return unknown ? 'Unknown option: ' + unknown[1] : 'Unknown Markmap option.'
    return warning.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 180)
  }))].slice(0, 30)
}

export function exportScheme(scheme: unknown, dark: boolean): 'light' | 'dark' {
  return scheme === 'dark' || (scheme === 'auto' && dark) ? 'dark' : 'light'
}
