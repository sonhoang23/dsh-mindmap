import { createElement as h, useEffect, useRef, useState } from 'react'
import '@markmap/element'
import { resolveMarkdownLink } from './links.ts'
import { deepestParentLevel, shouldRefitView } from './mobile.ts'
import type { FoldTreeNode } from './mobile.ts'
import { toSVGString } from '@markmap/render'
import { toPNG } from '@markmap/canvas'
import type { BetterSidebarService } from 'dsh-better-sidebar'

export interface Scope {
  sessionId: string
  cwd?: string
}

interface MapEngine {
  result?: Parameters<typeof toSVGString>[0]
  fit(): void
  zoomIn(): void
  zoomOut(): void
  expandAll(): void
  foldToLevel(level: number): void
  tree?: FoldTreeNode
}

type MapElement = HTMLElement & { markdown: string; mm?: MapEngine }
type ReadResult =
  | { kind: 'text'; content: string; mtimeMs?: number; size: number }
  | { kind: 'binary' | 'too-large'; size: number }

export interface MindmapPanelProps {
  path: string
  scope: Scope
  service: BetterSidebarService
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
  '.dsh-mindmap-view {position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;touch-action:none;overscroll-behavior:contain;--mm-bg:transparent;}',
  '.dsh-mindmap-editor {position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;box-sizing:border-box;resize:none;border:0;outline:0;padding:16px;background:transparent;color:inherit;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;}',
  '.dsh-mindmap-body {position:relative;flex:1 1 0;min-width:0;min-height:0;overflow:hidden;}',
  '.dsh-mindmap-feedback {margin:0;padding:6px 12px;font-size:12px;color:var(--dsw-alias-text-secondary,inherit);}',
  '.dsh-mindmap-error {color:var(--dsw-alias-state-error-primary,#c33);}',
  '.dsh-mindmap-toolbar-mobile,.dsh-mindmap-mobile-controls {display:none;}',
  '.dsh-mindmap-mobile-menu {position:relative;flex:none;}',
  '.dsh-mindmap-mobile-popover {position:absolute;top:calc(100% + 7px);right:0;z-index:15;display:grid;gap:7px;padding:12px;width:264px;max-width:calc(100cqw - 22px);max-height:min(64dvh,420px);overflow:auto;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff));color:var(--dsw-alias-text-primary,inherit);border:1px solid var(--dsw-alias-border-subtle,#8887);border-radius:10px;box-shadow:0 8px 24px #0003;}',
  '.dsh-mindmap-mobile-popover button {width:100%;text-align:left;}',
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

function routePayload(scope: Scope, path: string): Record<string, string> {
  return {
    sessionId: scope.sessionId,
    path,
    ...(scope.cwd ? { cwd: scope.cwd } : {}),
  }
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => null) as {
    ok?: boolean
    value?: T
    error?: { message?: string; code?: string }
  } | null
  if (!response.ok || value?.ok !== true || value.value === undefined) {
    throw new Error(value?.error?.message ?? ('HTTP ' + response.status))
  }
  return value.value
}

/** Only Better Sidebar's authenticated, session-scoped routes touch workspace files. */
export async function readMarkdown(
  service: BetterSidebarService,
  scope: Scope,
  path: string,
  signal?: AbortSignal,
): Promise<ReadResult> {
  const response = await fetch(service.hostRouteUrl('sidebar/api/fs.read'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(routePayload(scope, path)),
    signal,
  })
  return readEnvelope<ReadResult>(response)
}

async function saveMarkdown(
  service: BetterSidebarService,
  scope: Scope,
  path: string,
  content: string,
  expectedMtimeMs: number,
): Promise<number> {
  const query = new URLSearchParams({
    ...routePayload(scope, path),
    expectedMtimeMs: String(expectedMtimeMs),
  })
  const response = await fetch(service.hostRouteUrl('sidebar/write?' + query.toString()), {
    method: 'POST',
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: content.replace(/\r\n/g, '\n'),
  })
  const result = await readEnvelope<{ ok: true; mtimeMs?: number }>(response)
  if (typeof result.mtimeMs !== 'number') throw new Error('Máy chủ không trả về mốc phiên bản mới.')
  return result.mtimeMs
}

/**
 * Markdown and mindmap use the same live draft. Writes are explicit and
 * conditional on the mtime baseline, so another editor cannot be overwritten.
 */
export function MindmapPanel(props: MindmapPanelProps) {
  const { path, scope, service, content, mtimeMs, onReload } = props
  const [view, setView] = useState<'mindmap' | 'markdown'>('mindmap')
  const [layout, setLayout] = useState<'document' | 'tree' | 'two-sided' | 'org-chart'>('document')
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
  const dirty = draft !== saved

  useEffect(() => {
    if (dirty) return // Do not silently discard unsaved edits during a host reload.
    setDraft(content)
    setSaved(content)
    setBaseline(mtimeMs)
  }, [content, mtimeMs, path])

  useEffect(() => {
    if (view === 'mindmap' && mapRef.current) mapRef.current.markdown = draft
  }, [view, draft])


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
      void readMarkdown(service, scope, target).then(() => {
        service.openFile(scope, target)
      }).catch(() => {
        setFeedback('Không thể mở file: ' + target)
      })
    }
    element.addEventListener('click', onLink, true)
    return () => element.removeEventListener('click', onLink, true)
  }, [view, path, scope.sessionId, scope.cwd, service])

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
  }, [view])

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
  }, [view])

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
    if (!dirty || saving) return
    if (baseline === undefined) {
      setFeedback('Không có phiên bản gốc an toàn để ghi. Hãy tải lại file.')
      return
    }
    setSaving(true)
    setFeedback('')
    try {
      const nextMtime = await saveMarkdown(service, scope, path, draft, baseline)
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
    const result = mapRef.current?.mm?.result
    if (!result) {
      setFeedback('Chuyển sang Mindmap và đợi sơ đồ hiển thị trước khi xuất ảnh.')
      return
    }
    setBusyExport(true)
    setFeedback('')
    try {
      if (kind === 'svg') {
        download(new Blob([toSVGString(result)], { type: 'image/svg+xml;charset=utf-8' }), fileStem(path) + '.svg')
      } else {
        const png: unknown = await toPNG(result, { colorScheme: 'light' })
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
      }
    } catch (error) {
      setFeedback('Không thể xuất ảnh: ' + (error instanceof Error ? error.message : String(error)))
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
  const reload = () => {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu và nạp lại?')) return
    setMobileMenuOpen(false)
    setFeedback('')
    setDraft(saved)
    onReload?.()
  }
  const exportMarkdown = () =>
    download(new Blob([draft], { type: 'text/markdown;charset=utf-8' }), fileStem(path) + '.md')
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

  return h('div', { className: 'dsh-mindmap' },
    h('style', null, CSS),
    h('div', { className: 'dsh-mindmap-toolbar dsh-mindmap-toolbar-desktop' },
      button('Mindmap', () => switchView('mindmap'), view === 'mindmap'),
      button('Markdown', () => switchView('markdown'), view === 'markdown'),
      layoutSelect(),
      h('span', { className: 'dsh-mindmap-grow' }),
      button('Lưu' + (dirty ? ' •' : ''), () => { void save() }, undefined, !dirty || saving),
      button('Nạp lại', reload, undefined, !onReload),
      button('MD ↓', exportMarkdown),
      button('SVG ↓', () => { void exportImage('svg') }, undefined, view !== 'mindmap' || busyExport),
      button('PNG ↓', () => { void exportImage('png') }, undefined, view !== 'mindmap' || busyExport),
    ),
    h('div', { className: 'dsh-mindmap-toolbar dsh-mindmap-toolbar-mobile' },
      h('div', { className: 'dsh-mindmap-mobile-tabs', role: 'group', 'aria-label': 'Chế độ xem' },
        button('Mindmap', () => switchView('mindmap'), view === 'mindmap'),
        button('Markdown', () => switchView('markdown'), view === 'markdown'),
      ),
      button('Lưu' + (dirty ? ' •' : ''), () => { void save() }, undefined, !dirty || saving, {
        'aria-label': dirty ? 'Lưu thay đổi Markdown' : 'Không có thay đổi để lưu',
      }),
      h('div', { className: 'dsh-mindmap-mobile-menu', ref: mobileMenuRef },
        h('button', {
          type: 'button',
          ref: mobileMenuButtonRef,
          'aria-label': 'Tùy chọn sơ đồ',
          'aria-expanded': mobileMenuOpen,
          'aria-haspopup': 'true',
          onClick: () => setMobileMenuOpen(open => !open),
        }, '⋯'),
        mobileMenuOpen
          ? h('div', { className: 'dsh-mindmap-mobile-popover', role: 'group', 'aria-label': 'Tùy chọn và xuất file' },
              h('label', null, 'Bố cục', layoutSelect()),
              button('Nạp lại', reload, undefined, !onReload),
              button('Xuất Markdown', () => { exportMarkdown(); setMobileMenuOpen(false) }),
              button('Xuất SVG', () => { void exportImage('svg'); setMobileMenuOpen(false) }, undefined, view !== 'mindmap' || busyExport),
              button('Xuất PNG', () => { void exportImage('png'); setMobileMenuOpen(false) }, undefined, view !== 'mindmap' || busyExport),
              button('Mở tất cả nhánh', () => mapAction('expandAll'), undefined, view !== 'mindmap'),
            )
          : null,
      ),
    ),
    feedback ? h('p', { className: 'dsh-mindmap-feedback' + (feedback.startsWith('Không') ? ' dsh-mindmap-error' : ''), role: 'status' }, feedback) : null,
    h('div', { className: 'dsh-mindmap-body' },
      view === 'mindmap'
        ? h('markmap-view', {
            ref: (el: HTMLElement | null) => { mapRef.current = el as MapElement | null },
            className: 'dsh-mindmap-view',
            // <markmap-view>'s own :host sets height:400px. Inline sizing
            // wins over that shadow default and fills the flex viewport.
            style: { position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0, touchAction: 'none' },
            ...(layout === 'document' ? {} : { layout }),
            toolbar: '',
            'color-scheme': 'auto',
            'aria-label': 'Sơ đồ tư duy của ' + fileStem(path),
          })
        : h('textarea', {
            className: 'dsh-mindmap-editor',
            value: draft,
            onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
            spellCheck: false,
            'aria-label': 'Chỉnh sửa Markdown',
          }),
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

/** Manual Open with / file action mode: reads the same session-scoped file. */
export function ManualMindmap(props: { path: string; scope: Scope; service: BetterSidebarService }) {
  const { path, scope, service } = props
  const [reload, setReload] = useState(0)
  const [data, setData] = useState<ReadResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void readMarkdown(service, scope, path, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [service, scope.sessionId, scope.cwd, path, reload])

  if (loading) return h('p', { role: 'status' }, 'Đang mở Markdown…')
  if (error) return h('p', { role: 'alert' }, 'Không thể đọc file: ' + error)
  if (data?.kind !== 'text') return h('p', { role: 'status' }, 'File quá lớn hoặc không phải văn bản để hiển thị dưới dạng Mindmap.')
  return h(MindmapPanel, {
    key: path + ':' + reload,
    path, scope, service, content: data.content, mtimeMs: data.mtimeMs,
    onReload: () => setReload(v => v + 1),
  })
}
