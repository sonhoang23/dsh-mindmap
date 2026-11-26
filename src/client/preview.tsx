import { createElement as h, useEffect, useRef, useState } from 'react'
import '@markmap/element'
import { resolveMarkdownLink } from './links.ts'
import { deepestParentLevel, shouldRefitView } from './mobile.ts'
import type { FoldTreeNode } from './mobile.ts'
import { toSVGString } from '@markmap/render'
import { toPNG } from '@markmap/canvas'
import { exportAdaptivePng } from './png-export.ts'
import { applyInitialLevel, defaultPreferences, exportScheme, initialLevels, readInitialLevel, resolveViewerOptions, visibleWarnings, writeInitialLevel } from './viewer-options.ts'
import type { InitialLevel, ViewerPreferences, ViewOptions } from './viewer-options.ts'


interface MapEngine {
  result?: Parameters<typeof toSVGString>[0]
  options: ViewOptions
  setOptions(options: ViewOptions): void
  fit(): void
  zoomIn(): void
  zoomOut(): void
  expandAll(): void
  foldToLevel(level: number): void
  tree?: FoldTreeNode
}

type MapElement = HTMLElement & { markdown: string; options: ViewOptions; warnings?: readonly string[]; mm?: MapEngine }
export interface MindmapPanelProps {
  path: string
  onSave?: (draft: string, expectedMtimeMs: number) => Promise<number>
  onOpenLink?: (target: string) => void | Promise<void>
  onOpenLocal?: () => void
  onNewLocal?: () => void
  onDirtyChange?: (dirty: boolean) => void
  content: string
  mtimeMs?: number
  onReload?: () => void
}

const CSS = [
  '.dsh-mindmap {display:flex;flex:1 1 0;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;position:relative;container-type:inline-size;color:var(--dsw-alias-text-primary,inherit);}',
  '.dsh-mindmap-toolbar {display:flex;flex:none;align-items:center;gap:6px;padding:9px;border-bottom:1px solid var(--dsw-alias-border-subtle,#7775);flex-wrap:wrap;}',
  '.dsh-mindmap-grow {flex:1;}',
  '.dsh-mindmap button {font:inherit;font-size:12px;min-height:32px;padding:5px 9px;border:1px solid var(--dsw-alias-border-subtle,#8887);background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;border-radius:6px;cursor:pointer;touch-action:manipulation;}',
  '.dsh-mindmap button:focus-visible,.dsh-mindmap select:focus-visible {outline:2px solid currentColor;outline-offset:2px;}',
  '.dsh-mindmap button[aria-pressed="true"] {background:var(--dsw-alias-bg-layer-3,#8883);font-weight:600;}',
  '.dsh-mindmap button:disabled {opacity:.5;cursor:default;}',
  '.dsh-mindmap-view {position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;touch-action:none;overscroll-behavior:contain;}',
  '.dsh-mindmap-editor {position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;box-sizing:border-box;resize:none;border:0;outline:0;padding:16px;background:transparent;color:inherit;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;}',
  '.dsh-mindmap-body {position:relative;flex:1 1 0;min-width:0;min-height:0;overflow:hidden;}',
  '.dsh-mindmap-feedback {margin:0;padding:6px 12px;font-size:12px;color:var(--dsw-alias-text-secondary,inherit);}',
  '.dsh-mindmap-error {color:var(--dsw-alias-state-error-primary,#c33);}',
  '.dsh-mindmap-toolbar-mobile,.dsh-mindmap-mobile-controls {display:none;}',
  '.dsh-mindmap-mobile-menu {position:relative;flex:none;}',
  '.dsh-mindmap-mobile-popover {position:absolute;top:calc(100% + 7px);right:0;z-index:15;display:grid;gap:7px;padding:12px;width:264px;max-width:calc(100cqw - 22px);max-height:min(64dvh,420px);overflow:auto;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff));color:var(--dsw-alias-text-primary,inherit);border:1px solid var(--dsw-alias-border-subtle,#8887);border-radius:10px;box-shadow:0 8px 24px #0003;}',
  '.dsh-mindmap-mobile-popover button {width:100%;text-align:left;}',
  '.dsh-mindmap-settings-note {font-size:11px;margin:0;line-height:1.4;}',
  '.dsh-mindmap-warnings {flex:none;max-height:100px;overflow:auto;padding:6px 12px;font-size:12px;border-bottom:1px solid var(--dsw-alias-border-subtle,#8887);}',
  '.dsh-mindmap-warnings ul {margin:4px 0;padding-left:18px;overflow-wrap:anywhere;}',
  '.dsh-mindmap-mobile-popover label {display:grid;gap:4px;font-size:12px;}',
  '.dsh-mindmap-mobile-popover select {width:100%;min-height:44px;box-sizing:border-box;font:inherit;font-size:16px;color:inherit;background:var(--dsw-alias-bg-layer-1,transparent);border:1px solid var(--dsw-alias-border-subtle,#8887);border-radius:6px;padding:8px;}',
  '@media (pointer:coarse) {.dsh-mindmap-toolbar-desktop button {min-height:44px;}}',
  '@container (max-width: 640px) {',
  ' .dsh-mindmap-toolbar-desktop {display:none;}',
  ' .dsh-mindmap-toolbar-mobile {display:flex;gap:6px;flex-wrap:nowrap;padding:6px 8px;min-height:56px;box-sizing:border-box;}',
  ' .dsh-mindmap-toolbar-mobile button {min-height:44px;min-width:44px;font-size:13px;padding:6px 8px;}',
  ' .dsh-mindmap-mobile-tabs {display:flex;flex:1;min-width:0;gap:3px;}',
  ' .dsh-mindmap-mobile-tabs button {flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
  ' .dsh-mindmap-mobile-controls {position:absolute;z-index:5;bottom:max(12px,env(safe-area-inset-bottom,0px));right:12px;display:flex;gap:4px;padding:4px;border:1px solid var(--dsw-alias-border-subtle,#8887);background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff));border-radius:10px;box-shadow:0 2px 10px #0002;}',
  ' .dsh-mindmap-mobile-controls button {min-width:44px;min-height:44px;font-size:18px;font-weight:600;}',
  ' .dsh-mindmap-mobile-controls select {min-height:44px;min-width:78px;max-width:110px;box-sizing:border-box;padding:6px;border:1px solid var(--dsw-alias-border-subtle,#8887);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff));color:inherit;font:inherit;font-size:14px;touch-action:manipulation;}',

  ' .dsh-mindmap-editor {font-size:16px;padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom,0px));}',
  ' markmap-view::part(toolbar) {display:none;}',
  '}',
].join('')

function fileStem(path: string): string {
  const last = path.split(/[\\/]/).pop() ?? 'mindmap.md'
  return last.replace(/\.(?:md|markdown)$/i, '') || 'mindmap'
}

function download(content: Blob, name: string): void {
  const url = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/**
 * Markdown and mindmap use the same live draft. Writes are explicit and
 * conditional on the mtime baseline, so another editor cannot be overwritten.
 */
export function MindmapPanel(props: MindmapPanelProps) {
  const { path, content, mtimeMs, onReload, onOpenLink, onSave } = props
  const [view, setView] = useState<'mindmap' | 'markdown'>('mindmap')
  const [layout, setLayout] = useState<'document' | 'tree' | 'two-sided' | 'org-chart'>('document')
  const [nodeWidth, setNodeWidth] = useState('auto')
  const [compactPanel, setCompactPanel] = useState(() => window.innerWidth <= 640)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const autoWidth = compactPanel ? 180 : 280
  const [preferences, setPreferences] = useState<ViewerPreferences>(defaultPreferences)
  const [initialLevel, setInitialLevel] = useState<InitialLevel>(readInitialLevel)
  const [mapEpoch, setMapEpoch] = useState(0)
  const [warnings, setWarnings] = useState<string[]>([])
  const [draft, setDraft] = useState(content)
  const [saved, setSaved] = useState(content)
  const [baseline, setBaseline] = useState(mtimeMs)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [busyExport, setBusyExport] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [maxFoldLevel, setMaxFoldLevel] = useState(0)
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const mapRef = useRef<MapElement | null>(null)
  const initializedMap = useRef<MapElement | null>(null)
  const dirty = draft !== saved
  useEffect(() => { props.onDirtyChange?.(dirty) }, [dirty, props.onDirtyChange])

  useEffect(() => {
    if (dirty) return // Do not silently discard unsaved edits during a host reload.
    setDraft(content)
    setSaved(content)
    setBaseline(mtimeMs)
  }, [content, mtimeMs, path])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const update = () => setCompactPanel(panel.clientWidth <= 640)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [])

  // Keep the element mounted when switching to the editor so existing fold
  // state survives a Markdown round trip. Recreate only for a new document or
  // explicit reload. The initial Level setting is not a live fold command.
  useEffect(() => {
    if (view !== 'mindmap') return
    const element = mapRef.current
    if (!element) return
    const initial = initializedMap.current !== element
    const resolved = resolveViewerOptions(draft, preferences, layout, nodeWidth, autoWidth)
    if (initial) element.options = { wrapWidth: autoWidth }
    if (initial || element.markdown !== draft) element.markdown = draft
    // The element has already parsed the source and applied document options.
    // Override only the effective in-memory view through Markmap's public API.
    const mm = element.mm
    if (!mm) return
    mm.setOptions(resolved.options)
    setWarnings(visibleWarnings([...(element.warnings ?? []), ...resolved.warnings]))
    if (initial) {
      initializedMap.current = element
      applyInitialLevel(mm, initialLevel)
      mm.fit()
    }
  }, [view, draft, preferences, layout, nodeWidth, autoWidth, initialLevel, path, mapEpoch])


  // Markmap uses a shadow root; composedPath exposes the original anchor.
  // Capture before the renderer/browser can navigate to the web origin.
  useEffect(() => {
    if (view !== 'mindmap') return
    const element = mapRef.current
    if (!element) return
    const onLink = (event: MouseEvent) => {
      const anchor = event.composedPath().find((node): node is Element =>
        node instanceof Element && node.localName === 'a')
      const href = anchor?.getAttribute('href') ?? anchor?.getAttribute('xlink:href')
      if (!href) return
      const target = resolveMarkdownLink(path, href)
      if (!target) return
      event.preventDefault()
      event.stopPropagation()
      if (!onOpenLink) { setFeedback('Mở file liên kết bằng nút Mở Markdown; bản nháp cục bộ không truy cập workspace.'); return }
      void Promise.resolve().then(() => onOpenLink(target)).catch(() => {
        setFeedback('Không thể mở file: ' + target)
      })
    }
    element.addEventListener('click', onLink, true)
    return () => element.removeEventListener('click', onLink, true)
  }, [view, path, onOpenLink, mapEpoch])

  // Markmap renders asynchronously. Read available fold levels from the actual
  // rendered tree, just like its native toolbar, rather than guessing from MD.
  useEffect(() => {
    if (view !== 'mindmap') return
    const element = mapRef.current
    if (!element) return
    const refreshLevels = () => setMaxFoldLevel(deepestParentLevel(element.mm?.tree))
    element.addEventListener('render', refreshLevels)
    const frame = window.requestAnimationFrame(refreshLevels)
    return () => {
      element.removeEventListener('render', refreshLevels)
      window.cancelAnimationFrame(frame)
    }
  }, [view, path, mapEpoch])

  // Defer refitting until a panel resize settles. Re-fitting on every
  // ResizeObserver callback resets user zoom/pan during mobile gestures.
  useEffect(() => {
    if (view !== 'mindmap' || typeof ResizeObserver === 'undefined') return
    const element = mapRef.current
    if (!element) return

    let fittedSize = { width: element.clientWidth, height: element.clientHeight }
    let timeout: number | undefined
    let lastInteraction = 0
    const markInteraction = () => {
      lastInteraction = Date.now()
      window.clearTimeout(timeout)
    }
    const observer = new ResizeObserver(() => {
      const nextSize = { width: element.clientWidth, height: element.clientHeight }
      if (!shouldRefitView(fittedSize, nextSize)) return
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => {
        // Do not override a zoom or pan gesture that just happened.
        if (Date.now() - lastInteraction < 500) return
        const settled = { width: element.clientWidth, height: element.clientHeight }
        if (!shouldRefitView(fittedSize, settled) || !element.mm) return
        element.mm.fit()
        fittedSize = settled
      }, 200)
    })
    element.addEventListener('pointerdown', markInteraction, { passive: true })
    element.addEventListener('wheel', markInteraction, { passive: true })
    observer.observe(element)
    return () => {
      window.clearTimeout(timeout)
      observer.disconnect()
      element.removeEventListener('pointerdown', markInteraction)
      element.removeEventListener('wheel', markInteraction)
    }
  }, [view, path, mapEpoch])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) setMobileMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMobileMenuOpen(false)
      mobileMenuButtonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen])

  const save = async () => {
    if (!onSave || !dirty || saving) return
    if (baseline === undefined) {
      setFeedback('Không có phiên bản gốc an toàn để ghi. Hãy tải lại file.')
      return
    }
    setSaving(true)
    setFeedback('')
    try {
      const nextMtime = await onSave(draft, baseline)
      setSaved(draft)
      setBaseline(nextMtime)
      setFeedback('Đã lưu Markdown.')
    } catch (error) {
      setFeedback('Không thể lưu: ' + (error instanceof Error ? error.message : String(error)) + '. Hãy kiểm tra xung đột phiên bản.')
    } finally {
      setSaving(false)
    }
  }

  const exportImage = async (kind: 'svg' | 'png') => {
    const mm = mapRef.current?.mm
    const result = mm?.result
    if (!result) {
      setFeedback('Chuyển sang Mindmap và đợi sơ đồ hiển thị trước khi xuất ảnh.')
      return
    }
    const scheme = exportScheme(mm?.options.colorScheme, window.matchMedia('(prefers-color-scheme: dark)').matches)
    setBusyExport(true)
    setFeedback('')
    try {
      if (kind === 'svg') {
        download(new Blob([toSVGString(result, { colorScheme: scheme })], { type: 'image/svg+xml;charset=utf-8' }), fileStem(path) + '.svg')
      } else {
        const { png, reduced } = await exportAdaptivePng<unknown>(result.bounds, scheme, options => toPNG(result, options))
        if (png instanceof Blob) {
          download(png, fileStem(path) + '.png')
        } else if (png instanceof Uint8Array || png instanceof ArrayBuffer) {
          download(new Blob([png as BlobPart], { type: 'image/png' }), fileStem(path) + '.png')
        } else if (typeof png === 'string' && png.startsWith('data:image/png')) {
          const data = await fetch(png).then(r => r.blob())
          download(data, fileStem(path) + '.png')
        } else {
          throw new Error('Định dạng PNG không được hỗ trợ trong trình duyệt này.')
        }
        if (reduced) setFeedback('Đã giảm độ phân giải PNG để phù hợp với trình duyệt. Xuất SVG nếu cần giữ độ nét khi phóng to.')
      }
    } catch (error) {
      setFeedback('Không thể xuất ảnh: ' + (error instanceof Error ? error.message : String(error)) + (kind === 'png' ? '. Hãy thử xuất SVG hoặc gập bớt nhánh.' : ''))
    } finally {
      setBusyExport(false)
    }
  }

  const button = (
    label: string,
    action: () => void,
    pressed?: boolean,
    disabled?: boolean,
    extra: Record<string, unknown> = {},
  ) => h('button', {
    type: 'button',
    onClick: action,
    ...(pressed === undefined ? {} : { 'aria-pressed': pressed }),
    disabled,
    ...extra,
  }, label)

  const switchView = (next: 'mindmap' | 'markdown') => {
    setMobileMenuOpen(false)
    setView(next)
  }
  const changeLayout = (value: string) => {
    setLayout(value as typeof layout)
    setMobileMenuOpen(false)
  }
  const layoutSelect = () => h('select', {
    'aria-label': 'Bố cục sơ đồ',
    title: 'Bố cục sơ đồ',
    value: layout,
    onChange: (e: { target: { value: string } }) => changeLayout(e.target.value),
  },
    h('option', { value: 'document' }, 'Theo file'),
    h('option', { value: 'tree' }, 'Tree'),
    h('option', { value: 'two-sided' }, 'Two-sided'),
    h('option', { value: 'org-chart' }, 'Org chart'),
  )
  const nodeWidthSelect = () => h('select', {
    'aria-label': 'Chiều rộng node',
    title: 'Chiều rộng node',
    value: nodeWidth,
    onChange: (event: { target: { value: string } }) => setNodeWidth(event.target.value),
  },
    h('option', { value: 'auto' }, 'Width: Auto'),
    h('option', { value: '180' }, 'Compact (180px)'),
    h('option', { value: '280' }, 'Normal (280px)'),
    h('option', { value: '400' }, 'Wide (400px)'),
    h('option', { value: '0' }, 'Unlimited'),
  )
  const selectPreference = (key: keyof ViewerPreferences, label: string, options: [string, string][]) =>
    h('label', { key }, label,
      h('select', {
        'aria-label': label,
        value: preferences[key],
        onChange: (event: { target: { value: string } }) =>
          setPreferences(previous => ({ ...previous, [key]: event.target.value })),
      }, h('option', { value: 'document' }, 'Theo file'),
      ...options.map(([value, text]) => h('option', { key: value, value }, text))),
    )
  const setOpeningLevel = (value: InitialLevel) => {
    if (!initialLevels.includes(value)) return
    setInitialLevel(value)
    writeInitialLevel(value)
  }
  const appearanceControls = () => h('div', { style: { display: 'grid', gap: 7 } },
    h('p', { className: 'dsh-mindmap-settings-note' }, 'Chỉ thay đổi cách hiển thị, không sửa Markdown. Theo file = dùng frontmatter hoặc mặc định Markmap.'),
    selectPreference('theme', 'Theme', [['classic', 'Classic'], ['cards', 'Cards'], ['minimal', 'Minimal']]),
    selectPreference('scheme', 'Chế độ màu', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto (hệ thống)']]),
    selectPreference('palette', 'Màu nhánh (Classic/Cards)', [['ocean', 'Ocean'], ['contrast', 'Contrast'], ['mono', 'Một màu']]),
    selectPreference('colorDepth', 'Độ sâu màu (gốc = 1)', [['0', 'Không giới hạn'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]),
    h('p', { className: 'dsh-mindmap-settings-note' }, 'Minimal không dùng bảng màu nhánh. Các node sâu hơn kế thừa màu của cấp đã chọn.'),
    selectPreference('levelGap', 'Khoảng cách cấp', [['40', 'Gọn (40px)'], ['80', 'Chuẩn (80px)'], ['120', 'Rộng (120px)']]),
    selectPreference('siblingGap', 'Khoảng cách nhánh cùng cấp', [['2', 'Gọn (2px)'], ['5', 'Chuẩn (5px)'], ['12', 'Rộng (12px)']]),
    h('p', { className: 'dsh-mindmap-settings-note' }, 'Org chart dùng khoảng cách cùng cấp gấp 3 lần.'),
    h('label', null, 'Level khi mở (gốc = 0)',
      h('select', {
        'aria-label': 'Level khi mở hoặc nạp lại file',
        value: initialLevel,
        onChange: (event: { target: { value: string } }) => setOpeningLevel(event.target.value as InitialLevel),
      }, ...initialLevels.map(level => h('option', { key: level, value: level },
        level === 'document' ? 'Theo file' : level === 'all' ? 'Mở tất cả' : 'Level ' + level))),
    ),
    h('p', { className: 'dsh-mindmap-settings-note' }, 'Ghi nhớ trên trình duyệt; áp dụng lần mở/nạp tiếp theo. Dùng nút Level để gập ngay.'),
    selectPreference('viewport', 'Fit / Zoom', [['compact', 'Panel nhỏ (padding 12px)'], ['large', 'Map lớn (padding 24px)']]),
    h('p', { className: 'dsh-mindmap-settings-note' }, 'Preset chỉ giới hạn zoom tương tác; Fit vẫn có thể thu nhỏ hơn để hiện toàn bộ sơ đồ.'),
    button('Khôi phục theo file', () => {
      setPreferences(defaultPreferences)
      setLayout('document')
      setNodeWidth('auto')
      setOpeningLevel('document')
    }),
  )
  const optionsButton = () => h('button', {
    type: 'button', ref: mobileMenuButtonRef,
    'aria-label': 'Tùy chọn sơ đồ',
    'aria-expanded': mobileMenuOpen, 'aria-haspopup': 'true',
    onClick: () => setMobileMenuOpen(open => !open),
  }, compactPanel ? '⋯' : 'Tùy chỉnh')

  const reload = () => {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu và nạp lại?')) return
    setMobileMenuOpen(false)
    setFeedback('')
    setDraft(saved)
    setMapEpoch(epoch => epoch + 1)
    onReload?.()
  }
  const exportMarkdown = () => {
    download(new Blob([draft], { type: 'text/markdown;charset=utf-8' }), fileStem(path) + '.md')
    if (!onSave) setFeedback('Đã yêu cầu tải bản Markdown; file gốc không bị ghi đè.')
  }
  const localAction = (action?: () => void) => {
    if (dirty && !window.confirm('Bản nháp đã thay đổi. Tiếp tục và bỏ bản nháp?')) return
    action?.()
  }
  const mapAction = (action: 'fit' | 'zoomIn' | 'zoomOut' | 'expandAll') => {
    const mm = mapRef.current?.mm
    if (!mm) {
      setFeedback('Sơ đồ chưa sẵn sàng. Hãy thử lại khi đã hiển thị.')
      return
    }
    mm[action]()
    setMobileMenuOpen(false)
  }

  // An action menu, not a persistent setting: manual node folding may change
  // the map immediately after a Level command, so reset to the "Level" prompt.
  const foldLevelSelect = () => h('select', {
    title: 'Chọn Level (mức hiển thị nhánh)',
    'aria-label': 'Chọn Level của mindmap',
    defaultValue: '',
    disabled: maxFoldLevel === 0,
    onChange: (event: { target: HTMLSelectElement }) => {
      const selected = event.target.value
      event.target.value = ''
      const mm = mapRef.current?.mm
      if (!mm) {
        setFeedback('Sơ đồ chưa sẵn sàng. Hãy thử lại khi đã hiển thị.')
        return
      }
      if (selected === 'all') {
        mm.expandAll()
        return
      }
      const level = Number(selected)
      if (selected && Number.isInteger(level) && level > 0 && level <= maxFoldLevel) {
        mm.foldToLevel(level)
      }
    },
  },
    h('option', { value: '' }, 'Level'),
    ...Array.from({ length: maxFoldLevel }, (_, i) =>
      h('option', { key: i + 1, value: String(i + 1) }, 'Level ' + (i + 1))),
    h('option', { value: 'all' }, 'All'),
  )

  const mapControl = (text: string, ariaLabel: string, action: 'fit' | 'zoomIn' | 'zoomOut') =>
    button(text, () => mapAction(action), undefined, false, {
      'aria-label': ariaLabel,
      title: ariaLabel,
    })

  return h('div', { className: 'dsh-mindmap', ref: panelRef },
    h('style', null, CSS),
    h('div', { className: 'dsh-mindmap-toolbar dsh-mindmap-toolbar-desktop' },
      button('Mindmap', () => switchView('mindmap'), view === 'mindmap'),
      button('Markdown', () => switchView('markdown'), view === 'markdown'),
      layoutSelect(),
      nodeWidthSelect(),
      !compactPanel ? h('div', { className: 'dsh-mindmap-mobile-menu', ref: mobileMenuRef },
        optionsButton(),
        mobileMenuOpen ? h('div', { className: 'dsh-mindmap-mobile-popover', role: 'group', 'aria-label': 'Tùy chỉnh cách hiển thị' }, appearanceControls()) : null,
      ) : null,
      h('span', { className: 'dsh-mindmap-grow' }),
      onSave ? button('Lưu' + (dirty ? ' •' : ''), () => { void save() }, undefined, !dirty || saving) : null,
      props.onOpenLocal ? button('Mở Markdown', () => localAction(props.onOpenLocal)) : null,
      props.onNewLocal ? button('Tạo mới', () => localAction(props.onNewLocal)) : null,
      onReload ? button('Nạp lại', reload, undefined, !onReload) : null,
      button('MD ↓', exportMarkdown),
      button('SVG ↓', () => { void exportImage('svg') }, undefined, view !== 'mindmap' || busyExport),
      button('PNG ↓', () => { void exportImage('png') }, undefined, view !== 'mindmap' || busyExport),
    ),
    h('div', { className: 'dsh-mindmap-toolbar dsh-mindmap-toolbar-mobile' },
      h('div', { className: 'dsh-mindmap-mobile-tabs', role: 'group', 'aria-label': 'Chế độ xem' },
        button('Mindmap', () => switchView('mindmap'), view === 'mindmap'),
        button('Markdown', () => switchView('markdown'), view === 'markdown'),
      ),
      onSave ? button('Lưu' + (dirty ? ' •' : ''), () => { void save() }, undefined, !dirty || saving, {
        'aria-label': dirty ? 'Lưu thay đổi Markdown' : 'Không có thay đổi để lưu',
      }) : button('MD ↓', exportMarkdown),
      compactPanel ? h('div', { className: 'dsh-mindmap-mobile-menu', ref: mobileMenuRef },
        optionsButton(),
        mobileMenuOpen
          ? h('div', { className: 'dsh-mindmap-mobile-popover', role: 'group', 'aria-label': 'Tùy chọn và xuất file' },
              h('label', null, 'Bố cục', layoutSelect()),
              h('label', null, 'Chiều rộng node', nodeWidthSelect()),
              appearanceControls(),
              onReload ? button('Nạp lại', reload, undefined, !onReload) : null,
              props.onOpenLocal ? button('Mở Markdown', () => localAction(props.onOpenLocal)) : null,
              props.onNewLocal ? button('Tạo mới', () => localAction(props.onNewLocal)) : null,
              button('Xuất Markdown', () => { exportMarkdown(); setMobileMenuOpen(false) }),
              button('Xuất SVG', () => { void exportImage('svg'); setMobileMenuOpen(false) }, undefined, view !== 'mindmap' || busyExport),
              button('Xuất PNG', () => { void exportImage('png'); setMobileMenuOpen(false) }, undefined, view !== 'mindmap' || busyExport),
              button('Mở tất cả nhánh', () => mapAction('expandAll'), undefined, view !== 'mindmap'),
            )
          : null,
      ) : null,
    ),
    feedback ? h('p', { className: 'dsh-mindmap-feedback' + (feedback.startsWith('Không') ? ' dsh-mindmap-error' : ''), role: 'status' }, feedback) : null,
    view === 'mindmap' && warnings.length ? h('div', { className: 'dsh-mindmap-warnings', role: 'status', 'aria-live': 'polite' },
      h('strong', null, 'Cảnh báo cấu hình Markmap (' + warnings.length + ')'),
      h('ul', null, ...warnings.map(warning => h('li', { key: warning }, warning))),
    ) : null,
    h('div', { className: 'dsh-mindmap-body' },
      h('markmap-view', {
            key: path + ':' + mapEpoch,
            ref: (el: HTMLElement | null) => { mapRef.current = el as MapElement | null },
            className: 'dsh-mindmap-view',
            // <markmap-view>'s own :host sets height:400px. Inline sizing
            // wins over that shadow default and fills the flex viewport.
            style: { position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0, touchAction: 'none', visibility: view === 'mindmap' ? 'visible' : 'hidden' },
            toolbar: '',
            'aria-hidden': view !== 'mindmap',
            'aria-label': 'Sơ đồ tư duy của ' + fileStem(path),
          }),
      view === 'markdown' ? h('textarea', {
            className: 'dsh-mindmap-editor',
            value: draft,
            onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
            spellCheck: false,
            'aria-label': 'Chỉnh sửa Markdown',
          }) : null,
      view === 'mindmap'
        ? h('div', { className: 'dsh-mindmap-mobile-controls', role: 'group', 'aria-label': 'Điều khiển sơ đồ' },
            foldLevelSelect(),
            mapControl('−', 'Thu nhỏ sơ đồ', 'zoomOut'),
            mapControl('⤢', 'Vừa màn hình', 'fit'),
            mapControl('+', 'Phóng to sơ đồ', 'zoomIn'),
          )
        : null,
    ),
  )
}

