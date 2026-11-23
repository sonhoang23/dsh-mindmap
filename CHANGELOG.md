# Changelog

Release notes for DSH Mindmap. This history was consolidated from the original README on 2026-11-23. Entries describe source-level changes, not a guarantee that live DSH Web acceptance tests have passed.

## v0.1.5 — Browser module factory fix

- Fixed a potential `ReferenceError: module is not defined` when enabling the browser client.
- Initialized `module` and `exports` inside the post-minification DSH client factory, before executing bundled code.
- Strengthened the post-build audit to require the initialization prefix alongside module-loader registration and import checks.
- **Validation:** the original release notes did not confirm a successful live browser-profile smoke test.

## v0.1.4 — Full-height Better Sidebar canvas

- Made the mind-map and Markdown editor fill the available Better Sidebar panel below the toolbar instead of stopping near Markmap's default 400px height.
- Added a `ResizeObserver` that refits the map when the sidebar or split-pane dimensions change.
- Kept the change local to `src/client/preview.tsx`; Better Sidebar and Markdown files are not modified by this layout fix.
- **Validation:** real-profile visual acceptance remained pending in the original notes.

## v0.1.3 — Stable DSH client registration

- Moved the DSH browser module-loader wrapper to Rolldown `postBanner` / `postFooter` to avoid minification stripping the registration.
- Extended bundle verification to evaluate the output with a fake `window.__ModuleLoader__` and require a single factory registered as `dsh-mindmap`.
- The browser registration check is narrower and more meaningful than a simple string search.

## v0.1.2 — Browser dependency boundary

- Resolved browser-targeting issues from Markdown/Markmap dependencies, including `vfile` browser alternatives for `#minpath`, `#minproc` and `#minurl`.
- Added a maintained `buffer` polyfill and browser-targeted client bundling.
- Added the post-build browser audit (`scripts/check-client-bundle.mjs`) to reject Node-only imports and unregistered dependencies.

## v0.1.1 — Earlier browser process mitigation

- Addressed an initial `node:process` browser-import issue, but subsequent dependency checks showed that additional Node/browser import fixes were required in v0.1.2.

## Testing & release notes

For any release:

```bash
pnpm install
pnpm run check
```

A successful build and unit tests do not substitute for a manual DSH Web acceptance run. For the current verification checklist see [development](./docs/development.md), and for historical failure modes see [troubleshooting](./docs/troubleshooting.md).
