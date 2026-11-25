import { createElement as h } from 'react'
import type { ReactNode } from 'react'
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import { StandaloneStudio } from './standalone.tsx'
const NATIVE_TAB = 'dsh-mindmap'
const NATIVE_KEY = 'dsh-mindmap:native'

interface NativeTabInfo { tab: { id: string; visible: boolean } }
interface NativeProps { useTabInfo: () => NativeTabInfo }
interface TabRegistry {
  register(descriptor: {
    id: string; kind: string; keepMounted?: boolean; priority: 'extension'
    title: (address: string) => string
    guide?: { id: string; title: () => string; description: () => string; order: number }[]
  }): () => void
}
interface SlotRegistry {
  inject(name: string, callback: () => () => void): () => void
  register(
    descriptor: { name: string; key: string; inject: (sessionId: string) => object },
    component: (props: NativeProps) => ReactNode,
  ): () => void
}

function NativeStudio(props: NativeProps): ReactNode {
  const { tab } = props.useTabInfo()
  return h('div', { style: { height: '100%', minHeight: 0 }, 'data-dsh-mindmap-native': '' },
    h(StandaloneStudio, { key: tab.id }))
}

export function registerNativeStudio(ctx: CordisContext): () => void {
  const seat = ctx.inject(['slots', 'sidebarRightTabs'], injected => {
    const tabs = (injected as unknown as { sidebarRightTabs?: TabRegistry }).sidebarRightTabs
    if (!tabs) return
    const slots = (injected as unknown as { slots: SlotRegistry }).slots
    const disposeType = tabs.register({
      id: NATIVE_KEY, kind: NATIVE_TAB, keepMounted: true, priority: 'extension',
      title: () => 'Mindmap Studio',
      guide: [{
        id: NATIVE_KEY, title: () => 'Mindmap Studio',
        description: () => 'Xem và chỉnh sửa Markdown Mindmap', order: 70,
      }],
    })
    let disposeSlot: (() => void) | undefined
    try {
      disposeSlot = slots.inject('sidebar.right.pane.tab', () => slots.register({
        name: 'sidebar.right.pane.tab', key: NATIVE_KEY, inject: () => ({}),
      }, NativeStudio))
    } catch (error) {
      disposeType()
      throw error
    }
    return () => { disposeSlot?.(); disposeType() }
  })
  return () => { void seat.dispose() }
}


