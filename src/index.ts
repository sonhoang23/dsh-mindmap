/**
 * DSH Mindmap: the host half intentionally does no file I/O.
 * All workspace reads/writes use Better Sidebar's session-scoped routes,
 * and the browser half owns viewer registrations.
 */
import Schema from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'

export interface PluginConfig {}
export const Config: Schema<PluginConfig> = Schema.object({})
export const name = 'dsh-mindmap'
export const inject: string[] = []
export function apply(_ctx: Context, _config: PluginConfig): void {}
