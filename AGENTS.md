# AGENTS.md — Native-first development

- DSH native is the primary product. Every new core feature must work without Better Sidebar; test native Files first, then optional integration.
- Use public DSH services/slots and verify contracts against the target host version. Never patch DSH core or depend on private DOM/store internals.
- Keep `preview.tsx` host-agnostic. All Better Sidebar types, routes and registration belong in `better-sidebar.tsx`. Native adapters use DSH's document registry and resource navigation.
- Keep ordinary Markdown in its default native viewer; claim only explicit compound mindmap suffixes unless the host offers a safe content-aware hook. Do not register an extension that takes over every .md file just to inspect frontmatter.
- Native workspaceFiles is read-only. Do not invent write endpoints, bypass sandbox permissions or use browser-local paths as host paths. Native exports are copies; implement direct saves only with a documented, authorized, conflict-aware API.
- Preserve zoom, Fit, Level, layouts, wrap, links, exports, draft safety, dark/light appearance and mobile usability.
- Run pnpm run check (typecheck, tests, build, bundle audit). Test native with Better Sidebar disabled and integrated mode with it enabled. Never claim live acceptance based solely on CI.
- Keep README.md, README.vi.md, docs and changelog aligned. Prefer small reversible changes and protect unrelated user work.
