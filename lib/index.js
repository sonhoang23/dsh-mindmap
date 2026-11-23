import Schema from "@deepseek-ai/schemastery";
// src/index.ts
/**
* DSH Mindmap: the host half intentionally does no file I/O.
* All workspace reads/writes use Better Sidebar's session-scoped routes,
* and the browser half owns viewer registrations.
*/
const Config = Schema.object({});
const name = "dsh-mindmap";
const inject = [];
function apply(_ctx, _config) {}
export { Config, apply, inject, name };
