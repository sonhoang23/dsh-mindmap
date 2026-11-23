/**
 * Browser half: contributes a sniff-only auto viewer and explicit "View as
 * Mindmap" choices without replacing Better Sidebar's regular .md editor.
 */
import { createElement as h } from 'react'
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import type {
  BetterSidebarService,
  FileViewerProps,
  TabComponentProps,
} from 'dsh-better-sidebar'
import { isMarkdownPath, shouldAutoOpenMindmap } from './detect.ts'
import { ManualMindmap, MindmapPanel } from './preview.tsx'

export const inject = ['betterSidebar']
const TAB = 'dsh-mindmap:file'

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function markmapIcon() {
  return h('span', { role: 'img', 'aria-label': 'Mindmap' }, '🧠')
}

export function apply(ctx: CordisContext): void {
  const service = (ctx as CordisContext & { betterSidebar: BetterSidebarService }).betterSidebar
  if (!service) throw new Error('[dsh-mindmap] Better Sidebar service is required')

  ctx.effect(() => {
    const disposers: Array<() => void> = []
    const viewer = (props: FileViewerProps) => {
      if (props.largeFile || props.content === undefined) {
        return h('p', { role: 'status' }, 'File này không thể mở thành sơ đồ (quá lớn hoặc không phải văn bản).')
      }
      return h(MindmapPanel, {
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
  }, 'dsh-mindmap: Better Sidebar contributions')
}
