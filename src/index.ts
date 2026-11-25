/** Native-first plugin; no custom host filesystem I/O. */
import Schema from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'

export interface PluginConfig {}
export const Config: Schema<PluginConfig> = Schema.object({})
export const name = 'dsh-mindmap'
export const inject: string[] = []
export function apply(_ctx: Context, _config: PluginConfig): void {}
