# DSH Mindmap

## Full-height Better Sidebar canvas — v0.1.4

When viewing a large taxonomy mindmap inside Better Sidebar, older releases could render the white map surface only about 400px high, leaving most of the sidebar empty. The Markmap web component has an internal `:host { height: 400px }` default, and percent heights on an unconstrained flex child did not replace that intrinsic limit reliably.

v0.1.4 makes the viewer a **flex-filling child of Better Sidebar's editorMain**, reserves only the toolbar height, and positions `<markmap-view>` absolutely inside the remaining viewport with an explicit inline `height: 100%`. Both Mindmap and Markdown editor now fill the available viewport. A `ResizeObserver` watches the element and calls `mm.fit()` when the sidebar or split-pane viewport changes.

The fix is confined to `src/client/preview.tsx`; **it does not change Better Sidebar** or any Markdown source file.

### Smoke test

1. Update your local plugin checkout without dropping local changes, then run `pnpm run check` from the repository root.
2. Re-install the linked package for your DSH Web profile, restart DSH Web, and reload the browser. Confirm Plugin Manager shows **v0.1.4**.
3. Open `knowledge/knowledge_queue/topic-taxonomy-mindmap.md`. Its map background should fill **the entire panel below the viewer toolbar**, not stop around 400px from the top.
4. Resize the right sidebar and toggle the split-pane/maximize controls; the mindmap should fit its updated viewport.
5. Switch to Markdown and confirm the text editor fills the panel too; ordinary unmarked `.md` files must still use Better Sidebar's original viewer.

Live DSH browser acceptance is not yet verified by this repository commit alone.


## Fix for "wrong DSH client module id" (v0.1.3)

The v0.1.2 `pnpm run check` command could finish TypeScript, unit tests and the client build, then fail its last audit with `wrong DSH client module id`.

**Cause:** the bundle used executable `banner` and `footer` around a minified CJS output. Rolldown documents that these sections may be stripped during minification, which can remove the DSH loader registration itself.

**Fix in v0.1.3:** use Rolldown `postBanner` / `postFooter` so the loader wrapper is inserted after minification. The post-build audit now evaluates the generated script against an isolated fake `window.__ModuleLoader__` to verify that exactly one factory registers under the exact `dsh-mindmap` id. It does not just search for a quoted string.

Run the targeted check **from the mindmap plugin directory**, rather than a whole-workspace fork build:

```powershell
cd 'C:\path\to\dsh-mindmap'
git status -sb
git fetch origin
# If your working tree is clean, merge the new remote commits:
git merge origin/main
cd 'C:\path\to\dsh-mindmap'
pnpm install
pnpm run check
```

Expected final line:

```text
[dsh-mindmap] browser bundle verified: id=dsh-mindmap, one valid factory, no Node builtins or unregistered module-table imports
```

Only after that command passes, reinstall the linked plugin with `dsh plugin --profile web add .` and `dsh plugin --profile web install`, then restart DSH Web and hard-refresh the browser. The plugin manager should show **v0.1.3**.

The workspace-level `scripts/build-forks.ps1` message `3 plugin build(s) failed` counts failures across the monorepo; it does not mean three failures in this plugin. Diagnose other plugin builds separately, without relaxing the mindmap browser audit.

This release has not yet passed a user DSH browser smoke test.


Markdown-first interactive mindmaps inside DeepSeek Harness (DSH) and Better Sidebar. The single Markdown file remains the source of truth.

**Status: experimental implementation.** Live DSH profile and browser acceptance remain unverified. **Committing this source to GitHub does NOT install it into your local DSH profile.**

## User experience

1. Click a .md or .markdown file in Better Sidebar.
   - When the YAML frontmatter begins with `markmap: true`, DSH Mindmap automatically shows the interactive mindmap.
   - All other Markdown files keep the existing Better Sidebar viewer/editor.
2. Right-click any Markdown file and choose **View as Mindmap**, or use the **Mindmap** action in the editor toolbar. This opens a dedicated Mindmap tab.
3. A second lower-priority viewer is registered for **Open With -> Mindmap** where the Better Sidebar UI exposes it.
4. Switch between **Mindmap** and **Markdown** within the view. The Markdown tab is editable; your draft feeds the visual map immediately on return.
5. Save through Better Sidebar's authenticated, session-scoped, mtime-conflict-checked file route. Export Markdown, SVG or PNG.

## Example file

```markdown
---
markmap: true
---

# DeepSeek Harness
## Model
- DeepSeek
- Kimi
## Tools
- Files
- Search
## Plugins
- Better Sidebar
- DSH Mindmap
```

Markmap also supports native structured options:

```yaml
---
markmap:
  theme: cards
  layout: two-sided
---
```

Automatic detection accepts both the explicit Boolean marker and Markmap's native options object. The plugin selects Markdown by extension, inspects the loaded body and delegates ordinary Markdown to the original Better Sidebar viewer. This avoids relying on optional sniff bytes.

## Browser bundle update: version 0.1.2

Version **0.1.2** resolves the Markmap dependency graph for browsers, including `vfile`'s upstream `#minpath`, `#minproc`, `#minurl` browser implementations, a maintained `buffer` polyfill, and a browser-targeted client bundle.

The bundle now has an automated build gate (`node scripts/check-client-bundle.mjs`) and a focused GitHub Actions workflow (`.github/workflows/dsh-mindmap.yml`) running `pnpm run check`. **The checks still need to pass in your DSH checkout before activation can be considered verified.**

For the specific build error `dsh-mindmap browser bundle imports Node builtin "process"`, `"buffer"` or `"node:url"`:

```powershell
cd 'C:\path\to\dsh-mindmap'
git status -sb
git fetch origin
# If the worktree is clean and the branch diverged: git merge origin/main
cd 'C:\path\to\dsh-mindmap'
pnpm install
pnpm run check
```

**Do not reinstall or restart DSH when `pnpm run check` fails.** Send the complete first build error. The bundle audit must finish with `[dsh-mindmap] browser bundle verified`. Only then run `dsh plugin --profile web add .` and `dsh plugin --profile web install`, fully restart DSH Web, and hard-refresh the browser. Plugin Manager should show v0.1.2 after the reinstall.

### Earlier node:process issue

#### Browser error: `require('node:process')` is not in the DSH module table

**Superseded by v0.1.2.** The earlier v0.1.1 process-only fix was insufficient: vfile and other Markdown utilities also resolve Node paths and Buffer imports in some bundle configurations.

This is a browser bundle error, not a frontmatter problem: the client bundle is attempting to load a Node-only module. The DSH browser module loader cannot provide `node:process`. Do **not** add Node.js builtins to the DSH module table or disable its checks.

After safely bringing local Git history up to date (see below), build **in the plugin directory**:

```powershell
cd 'C:\path\to\dsh-mindmap'
pnpm install
pnpm run check
```

The build must end with:

```text
[dsh-mindmap] browser bundle verified: no Node builtins or unregistered module-table imports
```

Then reconcile the linked package in your Web profile:

```powershell
dsh plugin --profile web add .
dsh plugin --profile web install
```

Shut down DSH Web completely, start it again, and hard-refresh the browser (Ctrl+Shift+R). Plugin Manager should show **DSH Mindmap v0.1.2**. If the post-build audit fails, that build is **not ready to enable**; preserve the first error message and its dependency name to correct the browser entry rather than bypassing the audit.

This source fix has **not yet been validated by a live DSH Web run**. Installing a linked package without rebuilding leaves the old `lib/client.js` in place.

## Troubleshooting on Windows: `Package unavailable`, TypeScript, and Git divergence

These are separate issues. Solve in order; an `allow-version --accept-risk` exemption is **not** a safe replacement for compatible DSH and Better Sidebar releases.

### 1. Reconcile your existing plugin checkout without losing local commits

The reported `git pull --ff-only origin main` aborted because local `main` and `origin/main` diverged. The old command cannot be repeated until history is reconciled. Inspect first:

```powershell
cd 'C:\path\to\dsh-mindmap'
git status -sb
git fetch origin
git log --oneline --left-right HEAD...origin/main
```

If the worktree is **clean**, use `git merge origin/main` to preserve both local and remote commits. Resolve any conflicts before proceeding. If the worktree is dirty, commit or stash the local edits first; do not reset/clean/force-pull. There is no universal conflict-free command that is safe without inspecting this output.

### 2. Check the active DSH runtime before installing the plugin

```powershell
dsh --version
Get-Command dsh | Select-Object Source
git -C 'C:\path\to\deepseek-harness' status -sb
```

Logs from 2026-11-23 show **DSH 0.2.1-rc.2**. This plugin declares `engines.dsh: >=0.2.2-0 <0.3.0`, and Better Sidebar 0.32.1 has DSH 0.2.2-rc.2 peers. Upgrade the **actual running** DSH installation to a compatible release **before** reinstalling the plugins; keep the profile backup and follow the DSH repository's source build instructions. Also check `node -v` (this plugin requires >=24.9). The bundled `@deepseek-ai/*` packages in the profile must match the updated host line.

Do not assume updating a GitHub checkout updates a separately installed `dsh` executable. Run `dsh --version` again after the DSH upgrade and verify its location with `Get-Command dsh`.

### 3. Build and install the plugin

Once your plugin checkout is merged with `origin/main`, and the active DSH runtime is compatible:

```powershell
$plugin = 'C:\path\to\dsh-mindmap'
cd $plugin
pnpm install
pnpm run check
dsh plugin --profile web add .
dsh plugin --profile web install
dsh web --dump-config | Select-String 'dsh-mindmap'
```

The TypeScript `TS5097` error was corrected by enabling `allowImportingTsExtensions` in this plugin's `tsconfig.json` (build/typecheck must still be run locally). Do not attempt step 3 if step 2 still shows DSH 0.2.1-rc.2: the installer will reject the version.

After successful install, fully restart DSH Web, reload the browser, and reopen `knowledge/knowledge_queue/topic-taxonomy-mindmap.md`. The Mindmap | Markdown UI should appear. If not, check the browser console and whether Better Sidebar's file menu contains **View as Mindmap**.

### 4. Additional errors reported by the Web profile

The logs also show unresolved official bundles (`@deepseek-ai/dsh-experimental-forge-bundle`, `@deepseek-ai/dsh-personalized-recommendations`, and `@deepseek-ai/dsh-cua-bundle`) plus stale `cordis.patch.yml` target warnings. These are **independent profile/DSH issues**, not Markmap parsing failures. After upgrading the host, inspect `dsh web --dump-config` and the profile's installed bundles; back up the profile before altering any of its patches or dependencies.

## Local development

Requires a compatible DSH Web 0.2.2 release candidate (Better Sidebar 0.32.1 targets 0.2.2-rc.2+), Node 24.9+, and pnpm.

```powershell
cd 'C:\path\to\dsh-mindmap'
pnpm install
pnpm typecheck
pnpm test
pnpm build
dsh plugin --profile web add "link:<ABSOLUTE_PLUGIN_DIRECTORY>"
dsh --profile web --dump-config
dsh --profile web
```

Restart DSH and hard-refresh your browser.

## Architecture

- `src/index.ts`: host half (no direct filesystem API).
- `src/client/index.tsx`: five Better Sidebar contributions with clean disposal: auto viewer, manual viewer, dedicated tab, file action, editor action.
- `src/client/detect.ts`: conservative body-based frontmatter detection; normal Markdown is delegated to Better Sidebar's built-in viewer.
- `src/client/preview.tsx`: Markmap 1.x web component, dual-mode Markdown editor, export and guarded save.
- `tests/detect.test.ts`: regression coverage for path and opt-in detection.

All workspace reads/writes use the existing Better Sidebar routes and the active session id. Do not access arbitrary filesystem URLs. When another process edits the source, a stale save must fail rather than overwrite it.

## Live acceptance checklist

- [ ] Unmarked Markdown still opens normally.
- [ ] Marked Markdown automatically renders an interactive mindmap with pan, zoom and fold.
- [ ] View as Mindmap works on any regular .md/.markdown file.
- [ ] Mindmap and Markdown tabs share an editable draft.
- [ ] Save persists; stale mtime edits are rejected; reload is available.
- [ ] SVG, PNG and Markdown exports work.
- [ ] Uninstall/reload removes registrations; light/dark modes and reverse proxy work.

Next phase (not included): AI expand node, source links and in-chat maps.
