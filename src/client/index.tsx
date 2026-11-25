/** Native-first client entry. Better Sidebar is an optional extension adapter. */
import type { Context } from '@deepseek-ai/cordis'
import { registerNativeDocument } from './native-document.tsx'
import { registerNativeStudio } from './native-studio.tsx'
import { registerBetterSidebar } from './better-sidebar.tsx'

export const inject: string[] = []
export function apply(ctx: Context): void {
  registerNativeDocument(ctx)
  ctx.effect(() => registerNativeStudio(ctx), 'dsh-mindmap: native studio')
  registerBetterSidebar(ctx)
}
