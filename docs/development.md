# Development — Native First

[README](../README.md) · [AGENTS.md](../AGENTS.md)

## Architecture

| Module | Responsibility |
| --- | --- |
| src/client/index.tsx | Native-first client registration; optional integration |
| src/client/native-document.tsx | Native document registry and resource navigation |
| src/client/native-file.ts | Session resource addresses and bounded UTF-8 decode |
| src/client/native-studio.tsx | Optional native page entry |
| src/client/standalone.tsx | Local import/new draft |
| src/client/preview.tsx | Host-independent map UI, draft, exports, callbacks |
| src/client/better-sidebar.tsx | Optional Better Sidebar routes, guarded writes and viewer registrations |
| src/client/detect.ts | Frontmatter detection for optional integration |
| src/index.ts | Host entry; no custom file I/O |

The core accepts callbacks for link opening and saving, not host services. Native document metadata selects compound suffixes only; ordinary Markdown remains under DSH's own renderer. The official workspaceFiles service currently exposes reads/list/search/stat/watch, not mutations. Native edits export a copy. Do not implement unsafe replacement writes or broad Markdown takeovers.

## Checks

```bash
pnpm install
pnpm run check
```

TypeScript, Vitest, tsdown and the browser bundle audit must pass. Do not weaken the loader audit. Keep generated bundle imports browser-safe.

## Acceptance matrix

First disable/uninstall Better Sidebar and restart DSH. Open *.mindmap.md through native Files; verify Markdown fallback, relative links, draft export, zoom, fit, levels, wrapping, layout, dark/light mode and mobile. Open ordinary .md and verify its normal viewer. If Studio is visible, test local import and new map. Then enable Better Sidebar and repeat; verify explicit menu actions, frontmatter detection, guarded save and stale modification conflicts. Disable again and verify cleanup. Record exact DSH version and profile. v0.2.1 native file opening was reported working on 0.2.2-rc.5; this does not establish full acceptance of v0.2.2.

## Roadmap

Native direct save only with documented authorized conflict-aware write API; frontmatter-only auto detection only with safe content-aware host extension point. See [mobile checklist](./mobile-testing.md).
