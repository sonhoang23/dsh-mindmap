# Development and architecture

[← README](../README.md) · [Installation](./installation.md) · [Troubleshooting](./troubleshooting.md)

## Development loop

Work inside this standalone plugin checkout with Node.js **24.9+** and pnpm:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Or run the complete gate:

```bash
pnpm run check
```

The `build` command runs `tsdown` followed by `node scripts/check-client-bundle.mjs`. The resulting browser bundle must register **exactly one** valid DSH client module factory under `dsh-mindmap`, with no Node-only module imports or unknown DSH module-table imports.

**Do not loosen the audit to make a failed build pass.** Correct the browser resolution/bundling boundary instead.

## Project map

| File | Responsibility |
| --- | --- |
| `src/index.ts` | Host entry: schema/registration; intentionally does not perform workspace file I/O |
| `src/client/index.tsx` | Registers Better Sidebar auto/manual viewers, a dedicated tab, a file action and an editor action; cleans up registrations |
| `src/client/detect.ts` | Conservative Markdown path/frontmatter detection; regular Markdown falls back to the original viewer |
| `src/client/preview.tsx` | Markmap UI, Markdown editing, layout selection, exports, guarded saves, resize/refit behavior |
| `tsdown.config.ts` | Host ESM and browser CJS builds; browser import boundary and post-minify loader wrapper |
| `scripts/check-client-bundle.mjs` | Browser bundle integrity checks |
| `tests/detect.test.ts` | Detection regression tests |

## Key implementation rules

- **Respect ordinary Markdown.** Automatic map mode requires a `.md` / `.markdown` file with explicit `markmap: true` frontmatter. Do not claim arbitrary files solely because of their extension. Structured `markmap:` options alone are not currently recognized by auto-detection.
- **Keep source as truth.** The map visualizes the editable Markdown draft. Switching views does not automatically persist edits.
- **Use Better Sidebar routes for I/O.** Reads use `sidebar/api/fs.read` and writes use `sidebar/write`, authenticated and scoped to the active session. Do not introduce arbitrary filesystem URLs.
- **Reject stale writes.** Saves send the original `expectedMtimeMs` and surface conflicts rather than silently overwriting external edits.
- **Keep a browser-safe bundle.** Built-in Node imports are not client externals; browser-specific resolutions and polyfills belong at the bundle boundary.
- **Dispose contributions.** The plugin registers five Better Sidebar contributions and releases them on cleanup.
- **Keep the viewer responsive.** The canvas fills the panel under the toolbar and calls `fit()` after its viewport actually changes.

## Manual acceptance checklist

The code-level gate cannot prove host compatibility. After `pnpm run check`, verify against a compatible DSH Web profile:

- [ ] Unmarked Markdown still uses the original viewer.
- [ ] Marked Markdown auto-opens as a map; pan, zoom and folding work.
- [ ] File action and editor/tab action open mind-map mode manually.
- [ ] Both views share one editable draft; explicit save persists safely.
- [ ] Simulated stale modification time rejects an overwrite.
- [ ] Markdown, SVG and PNG exports work.
- [ ] Sidebar resize, split view, light/dark themes and reload behave acceptably.
- [ ] Plugin disable/reload removes registrations without residual UI.

The previous README recorded this live acceptance as **pending**, not passed.

## Planned, not implemented

AI node expansion, source links and in-chat mind maps were identified as future ideas in the original README. They are **not** presented as shipping features.

## Contributing

Include an issue/PR description, exact DSH and Better Sidebar versions, steps to reproduce, logs where relevant, and the result of `pnpm run check`. Avoid committing generated fix notes to the README hero; capture the change in [CHANGELOG.md](../CHANGELOG.md) and troubleshooting details here or in [troubleshooting](./troubleshooting.md).
