import { createElement as h, useEffect, useRef, useState } from 'react'
import '@markmap/element'
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
  '.dsh-mindmap {display:flex;flex:1 1 0;flex-direction:column;min-width:0;min-height:0;height:100%;overflow:hidden;color:var(--dsw-alias-text-primary,inherit);}',
  '.dsh-mindmap-toolbar {display:flex;flex:none;align-items:center;gap:6px;padding:9px;border-bottom:1px solid var(--dsw-alias-border-subtle,#7775);flex-wrap:wrap;}',
  '.dsh-mindmap-grow {flex:1;}',
  '.dsh-mindmap button {font:inherit;font-size:12px;padding:5px 9px;border:1px solid var(--dsw-alias-border-subtle,#8887);background:transparent;color:inherit;border-radius:6px;cursor:pointer;}',
  '.dsh-mindmap button[aria-pressed="true"] {background:var(--dsw-alias-bg-layer-3,#8883);font-weight:600;}',
  '.dsh-mindmap button:disabled {opacity:.5;cursor:default;}',
  '.dsh-mindmap-view {position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;--mm-bg:transparent;}',
  '.dsh-mindmap-editor {position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;box-sizing:border-box;resize:none;border:0;outline:0;padding:16px;background:transparent;color:inherit;font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;}',
  '.dsh-mindmap-body {position:relative;flex:1 1 0;min-width:0;min-height:0;overflow:hidden;}',
  '.dsh-mindmap-feedback {margin:0;padding:6px 12px;font-size:12px;color:var(--dsw-alias-text-secondary,inherit);}',
  '.dsh-mindmap-error {color:var(--dsw-alias-state-error-primary,#c33);}',
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

  // The Better Sidebar editor is resizable, but Markmap fits its content
  // only on first render. Re-fit when the actual map viewport changes.
  // Observe the map itself (not window): dragging the sidebar divider and
  // changing split panes do not necessarily fire a window resize.
  useEffect(() => {
    if (view !== 'mindmap' || typeof ResizeObserver === 'undefined') return
    const element = mapRef.current
    if (!element) return
    let width = element.clientWidth
    let height = element.clientHeight
    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth
      const nextHeight = element.clientHeight
      if (nextWidth <= 0 || nextHeight <= 0 || (nextWidth === width && nextHeight === height)) return
      width = nextWidth
      height = nextHeight
      element.mm?.fit()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [view])

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

  const button = (label: string, action: () => void, pressed?: boolean, disabled?: boolean) =>
    h('button', {
      type: 'button',
      onClick: action,
      ...(pressed === undefined ? {} : { 'aria-pressed': pressed }),
      disabled,
    }, label)

  return h('div', { className: 'dsh-mindmap' },
    h('style', null, CSS),
    h('div', { className: 'dsh-mindmap-toolbar' },
      button('Mindmap', () => setView('mindmap'), view === 'mindmap'),
      button('Markdown', () => setView('markdown'), view === 'markdown'),
      h('select', {
        'aria-label': 'Bố cục sơ đồ',
        title: 'Bố cục sơ đồ',
        value: layout,
        onChange: (e: { target: { value: string } }) => setLayout(e.target.value as typeof layout),
        style: { color: 'inherit', background: 'transparent', border: '1px solid var(--dsw-alias-border-subtle,#8887)', borderRadius: 6, padding: '5px' },
      },
        h('option', { value: 'document' }, 'Theo file'),
        h('option', { value: 'tree' }, 'Tree'),
        h('option', { value: 'two-sided' }, 'Two-sided'),
        h('option', { value: 'org-chart' }, 'Org chart'),
      ),
      h('span', { className: 'dsh-mindmap-grow' }),
      button('Lưu' + (dirty ? ' •' : ''), () => { void save() }, undefined, !dirty || saving),
      button('Nạp lại', () => {
        if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu và nạp lại?')) return
        setFeedback('')
        setDraft(saved)
        onReload?.()
      }, undefined, !onReload),
      button('MD ↓', () => download(new Blob([draft], { type: 'text/markdown;charset=utf-8' }), fileStem(path) + '.md')),
      button('SVG ↓', () => { void exportImage('svg') }, undefined, view !== 'mindmap' || busyExport),
      button('PNG ↓', () => { void exportImage('png') }, undefined, view !== 'mindmap' || busyExport),
    ),
    feedback ? h('p', { className: 'dsh-mindmap-feedback' + (feedback.startsWith('Không') ? ' dsh-mindmap-error' : ''), role: 'status' }, feedback) : null,
    h('div', { className: 'dsh-mindmap-body' },
      view === 'mindmap'
        ? h('markmap-view', {
            ref: (el: HTMLElement | null) => { mapRef.current = el as MapElement | null },
            className: 'dsh-mindmap-view',
            // <markmap-view>'s own :host sets height:400px. Inline sizing
            // wins over that shadow default and fills the flex viewport.
            style: { position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0 },
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
