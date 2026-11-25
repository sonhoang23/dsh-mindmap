/** Optional Better Sidebar integration; native code does not depend on this service. */
import { createElement as h, useEffect, useState, useCallback } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { BetterSidebarService, FileViewerProps, TabComponentProps } from 'dsh-better-sidebar'
import { isMarkdownPath, shouldAutoOpenMindmap } from './detect.ts'
import { MindmapPanel } from './preview.tsx'
const TAB = 'dsh-mindmap:file'
function fileName(path: string): string { return path.split(/[\\/]/).pop() ?? path }
function markmapIcon() { return h('span', { role: 'img', 'aria-label': 'Mindmap' }, '🧠') }
interface Scope { sessionId: string; cwd?: string }
type ReadResult =
  | { kind: 'text'; content: string; mtimeMs?: number; size: number }
  | { kind: 'binary' | 'too-large'; size: number }

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

interface SidebarProps {
  path: string; scope: Scope; service: BetterSidebarService; content: string; mtimeMs?: number; onReload?: () => void
}
function SidebarMindmap({ path, scope, service, content, mtimeMs, onReload }: SidebarProps) {
  const openLink = useCallback(async (target: string) => {
    await readMarkdown(service, scope, target)
    service.openFile(scope, target)
  }, [service, scope.sessionId, scope.cwd])
  const save = useCallback((draft: string, expected: number) => saveMarkdown(service, scope, path, draft, expected), [service, scope.sessionId, scope.cwd, path])
  return h(MindmapPanel, { path, content, mtimeMs, onReload, onOpenLink: openLink, onSave: save })
}
export function registerBetterSidebar(ctx: Context): void {
  ctx.effect(() => {
    const seat = ctx.inject(['betterSidebar'], scope => {
      const service = (scope as unknown as { betterSidebar?: BetterSidebarService }).betterSidebar
      return service ? registerSidebar(service) : undefined
    })
    return () => { void seat.dispose() }
  }, 'dsh-mindmap: optional Better Sidebar integration')
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
  return h(SidebarMindmap, {
    key: path + ':' + reload,
    path, scope, service, content: data.content, mtimeMs: data.mtimeMs,
    onReload: () => setReload(v => v + 1),
  })
}

export function registerSidebar(service: BetterSidebarService): () => void {
    const disposers: Array<() => void> = []
    const viewer = (props: FileViewerProps) => {
      if (props.largeFile || props.content === undefined) {
        return h('p', { role: 'status' }, 'File này không thể mở thành sơ đồ (quá lớn hoặc không phải văn bản).')
      }
      return h(SidebarMindmap, {
        key: props.path,
        path: props.path,
        scope: props.scope,
        service,
        content: props.content,
        mtimeMs: props.mtimeMs,
        ...(props.onReload ? { onReload: props.onReload } : {}),
      })
    }

    // Better Sidebar may choose the viewer BEFORE it has any bytes to
    // sniff. Claim .md by extension, then delegate non-Markmap files
    // to the original Markdown viewer with its original viewerId.
    // This preserves the original editor, toolbar and save behavior.
    const smartViewer = (props: FileViewerProps) => {
      if (!props.largeFile && props.content !== undefined && shouldAutoOpenMindmap(props.path, props.content)) {
        return viewer(props)
      }
      const fallback = service.getFileViewers().find(item =>
        item.id === 'markdown' && service.isViewerEnabled(item.id),
      ) ?? service.getFileViewers().find(item =>
        item.id === 'code' && service.isViewerEnabled(item.id),
      )
      if (fallback) {
        return h(fallback.component, { ...props, viewerId: fallback.id })
      }
      return h('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
        props.content ?? 'Không có trình xem Markdown khả dụng.')
    }

    const open = (path: string, sessionId: string) => {
      service.openTab({
        type: TAB,
        id: TAB + ':' + path,
        title: 'Mindmap: ' + fileName(path),
        path,
      }, { sessionId })
    }

    try {
      // Extension-based routing guarantees a loaded text body even when
      // Better Sidebar initially chooses the viewer without sniff bytes.
      // smartViewer then delegates regular Markdown to the exact original
      // markdown/code component, instead of rendering it as a mindmap.
      disposers.push(service.registerFileViewer({
        id: 'dsh-mindmap:auto',
        title: 'Markdown / Mindmap',
        priority: 100,
        exts: ['md', 'markdown'],
        fetchStrategy: 'fsRead',
        component: smartViewer,
      }))

      // Lower priority than the built-in Markdown viewer: only a deliberate
      // Open With selection uses it for unmarked .md / .markdown documents.
      disposers.push(service.registerFileViewer({
        id: 'dsh-mindmap:manual',
        title: 'Mindmap',
        priority: -20,
        exts: ['md', 'markdown'],
        fetchStrategy: 'fsRead',
        component: viewer,
      }))

      // Dedicated path tab supports an explicit file-tree action even in
      // Better Sidebar versions/skins that do not list extension viewers in
      // their Open With submenu.
      disposers.push(service.registerTab({
        id: TAB,
        title: 'Mindmap',
        description: 'Xem file Markdown dưới dạng sơ đồ tư duy tương tác',
        icon: markmapIcon,
        hidden: true,
        dedupeKey: tab => tab.path,
        component: (props: TabComponentProps) =>
          props.tab.path
            ? h(ManualMindmap, {
                key: props.tab.path,
                path: props.tab.path,
                scope: props.scope,
                service,
              })
            : h('p', null, 'Chọn một file Markdown trong Files để xem Mindmap.'),
      }))

      disposers.push(service.registerFileAction({
        id: 'dsh-mindmap:view-file',
        label: 'View as Mindmap',
        icon: markmapIcon,
        order: 40,
        when: row => !row.isDir && Boolean(row.sessionId) && isMarkdownPath(row.path),
        run: row => {
          if (!row.sessionId) return
          open(row.path, row.sessionId)
        },
      }))

      disposers.push(service.registerTabAction({
        id: 'dsh-mindmap:view-tab',
        label: 'Mindmap',
        title: 'Mở file này trong Mindmap',
        icon: markmapIcon,
        order: 40,
        when: tab => !tab.isDir && tab.tabType === 'editor' && isMarkdownPath(tab.path),
        run: tab => open(tab.path, tab.sessionId),
      }))
    } catch (error) {
      disposers.reverse().forEach(dispose => dispose())
      throw error
    }

    return () => { disposers.reverse().forEach(dispose => dispose()) }
}

