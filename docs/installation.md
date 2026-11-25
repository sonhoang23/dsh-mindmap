# Installation and verification

[← README](../README.md) · [Tiếng Việt](../README.vi.md)

DSH Mindmap is currently an **experimental, source-installed DSH Web plugin**. The npm package metadata includes `private: true`; do not assume a public package install is available.

## 1. Check the host environment

- **DSH:** `>=0.2.2-0 <0.3.0`
- **Better Sidebar (optional):** compatible version satisfying peer dependency `^0.32.1`
- **Node.js:** `>=24.9.0`
- **Package manager:** pnpm
- **Interface:** DSH Web, using the chosen `web` profile in the commands below

Check the **running installation**, not only a source checkout:

```powershell
dsh --version
node --version
Get-Command dsh | Select-Object Source
```

Historical logs used DSH 0.2.1-rc.2, which does **not** satisfy the plugin's engine requirement. Upgrade the active DSH runtime and, if installed, the compatible Better Sidebar installation before enabling the plugin. Do **not** use version-bypass flags as a substitute for compatibility.

## 2. Download and build

```bash
git clone https://github.com/sonhoang23/dsh-mindmap.git
cd dsh-mindmap
pnpm install
pnpm run check
```

The `check` script runs TypeScript typechecking, Vitest unit tests, a host/client build, and an audit of the browser bundle. **Stop if it fails.** Do not install a failed browser bundle into your DSH profile.

## 3. Register the local plugin

Run from the cloned plugin root:

```bash
dsh plugin --profile web add .
dsh plugin --profile web install
```

Then fully stop and restart DSH Web and hard-refresh the browser (`Ctrl+Shift+R` on Windows). Confirm that the DSH plugin manager shows **dsh-mindmap v0.2.0**, with no client-module error.

> These commands are profile-specific. If your DSH setup uses a profile other than `web`, adapt the profile flag consistently.

## 4. Verify the UI

Create or open a Markdown file containing:

```markdown
---
markmap: true
---

# My project
## Research
- Sources
- Notes
## Build
- Tasks
- Tests
```

First test without Better Sidebar: open Mindmap Studio from the native right sidebar, create/import a Markdown file, edit, export MD/SVG/PNG, and check mobile. Export downloads a copy; it does not write the workspace. Then install Better Sidebar if desired and confirm the following manually:

1. A marked `.md` file displays the mind-map view; a file without that marker still uses the normal Markdown viewer.
2. **View as Mindmap** works from a file action; the Mindmap tab/editor action is available where the host UI exposes it.
3. Pan, zoom and branch expansion work. Resize the sidebar and confirm the canvas fills the available height.
4. Switch between **Mindmap** and **Markdown**; edit, save, and reopen the source file.
5. Download Markdown, SVG and PNG; confirm each result.
6. Check light/dark appearance, browser console, and expected cleanup after removing or disabling the plugin where relevant.

**At the time these docs were reorganized, successful end-to-end DSH Web verification had not been confirmed by the repository notes.**

## Updating an existing clone safely

First inspect local changes; never discard work with a blind reset/clean/force-pull:

```powershell
git status -sb
git fetch origin
git log --oneline --left-right HEAD...origin/main
```

When the worktree is **clean** and your history has diverged, `git merge origin/main` can preserve both histories. If there are uncommitted edits, commit or stash them safely first and resolve conflicts deliberately.

After incorporating updates:

```bash
pnpm install
pnpm run check
dsh plugin --profile web add .
dsh plugin --profile web install
```

Restart DSH Web completely and hard-refresh again. A GitHub commit or a `git pull` alone does **not** update the built client files or an existing linked profile installation.

## Need help?

See [troubleshooting](./troubleshooting.md) for DSH version mismatch, browser-loader errors, full-height layout, Git divergence, and TypeScript/build issues.
