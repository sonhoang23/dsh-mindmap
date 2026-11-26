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

## Viewer options acceptance

Source-level tests cover frontmatter precedence, bounded presets, opening Level, warnings and export scheme. Run the full check/build before using the generated client. Do not ship or close issues based on source review alone.

1. Disable Better Sidebar. Open a compound-suffix map containing theme: cards, colorScheme: dark, layout: org-chart, foldLevel: 2, custom color/spacing/fit options. Check Theo file, every override, reset, then export Markdown and verify the original bytes have not changed.
2. Preview Classic/Cards/Minimal with each palette and scheme (including changing system light/dark while Auto is selected). Check text/branch readability and compare SVG and PNG with the current scheme. Minimal ignores palette/depth; org-chart sibling spacing is tripled.
3. Open a small map (root and three branches), a dense map (at least 100 branches, six levels, long labels), and a narrow/mobile panel (320–640px). Compare document default to both viewport presets; record whether each preset improves framing, Fit shows every visible node, zoom/pinch/pan limits remain usable, resize refit and exports work. If no benefit, remove the preset before closing #10.
4. Select an opening Level, reopen/reload, switch documents, and change manual folds; change appearance and toggle Markdown/editor back. Existing folds should remain, and new maps should use the selected opening Level. Test storage disabled and reset to Theo file.
5. Try invalid theme, spacing, color and unknown option keys; warnings must appear without raw option values, disappear on correction, and not change Markdown. Check screen-reader access.
6. Repeat with Better Sidebar enabled, then disable it again. Record DSH version, desktop browser, iOS/Android browser, results and screenshots. No live acceptance is implied by this checklist.
