import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";

//#region src/index.d.ts
interface PluginConfig {}
declare const Config: Schema<PluginConfig>;
declare const name = "dsh-mindmap";
declare const inject: string[];
declare function apply(_ctx: Context, _config: PluginConfig): void;
//#endregion
export { Config, PluginConfig, apply, inject, name };