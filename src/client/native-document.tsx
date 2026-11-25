import { createElement as h } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ReactNode } from 'react'
import { MindmapPanel } from './preview.tsx'
import { parseSessionFile, sessionFileAddress, decodeMindmap } from './native-file.ts'

const ID = 'dsh-mindmap:document'
const SLOT = 'sidebar.right.tab.document'
interface Registry {
  register(definition: { id: string; extensions: string[]; priority: 'extension'; title: () => string; loading: 'bytes-complete'; wrap: boolean }): () => void
}
interface NativeProps {
  resourceAddress: string
  content: { kind: 'bytes'; data: Uint8Array } | { kind: 'text'; text: string; eof: boolean } | { kind: 'renderer' }
  useTabInfo: () => { tab: { actions: { openResource(address: string): void } } }
}
interface Slots {
  inject(name: string, callback: () => () => void): () => void
  register(descriptor: { name: string; key: string }, component: (props: NativeProps) => ReactNode): () => void
}
function NativeDocument(props: NativeProps) {
  const { tab } = props.useTabInfo()
  const file = parseSessionFile(props.resourceAddress)
  if (!file) return h('p', { role: 'alert' }, 'Địa chỉ file workspace không hợp lệ.')
  if (props.content.kind !== 'bytes') return h('p', { role: 'status' }, 'Đang đọc Mindmap…')
  let content: string
  try { content = decodeMindmap(props.content.data) }
  catch (error) { return h('p', { role: 'alert' }, String(error)) }
  return h('div', { style: { height: '100%', minHeight: 0, minWidth: 0, whiteSpace: 'normal' }, 'data-dsh-mindmap-document': '' },
    h(MindmapPanel, { key: props.resourceAddress, path: file.path, content,
      onOpenLink: (target: string) => tab.actions.openResource(sessionFileAddress(file.sessionId, target)),
    }))
}

/** Only compound mindmap suffixes are claimed; ordinary Markdown stays native. */
export function registerNativeDocument(ctx: Context): void {
  ctx.inject(['slots', 'documentPreviews'], scope => {
    const { slots, documentPreviews } = scope as unknown as { slots: Slots; documentPreviews: Registry }
    scope.effect(() => slots.inject(SLOT, () => slots.register({ name: SLOT, key: ID }, NativeDocument)), 'dsh-mindmap: native document body')
    scope.effect(() => documentPreviews.register({
      id: ID, extensions: ['mindmap.md', 'mindmap.markdown'], priority: 'extension',
      title: () => 'Mindmap', loading: 'bytes-complete', wrap: false,
    }), 'dsh-mindmap: native document metadata')
  })
}
