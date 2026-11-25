# Troubleshooting

[← README](../README.md) · [Installation](./installation.md) · [Changelog](../CHANGELOG.md)

These notes consolidate the technical history formerly at the top of the README. Diagnose the **first failing step**, not downstream symptoms. The current source version is **v0.2.2**.

## Plugin reports "Package unavailable" / incompatible DSH version

Confirm the *active* DSH executable, rather than assuming a source checkout is the running CLI:

```powershell
dsh --version
Get-Command dsh | Select-Object Source
node --version
```

This plugin declares DSH `>=0.2.2-0 <0.3.0`, Node `>=24.9.0`, and optional Better Sidebar peer dependency `^0.32.1`. Historical DSH 0.2.1-rc.2 logs were below the required host range; Better Sidebar 0.32.1 targeted the DSH 0.2.2 release-candidate line. Update the compatible **installed** host and peer dependencies; do not bypass version protection with an `allow-version --accept-risk` override.

## "ReferenceError: module is not defined" in DSH Plugins

This was the **v0.1.4 → v0.1.5** browser bundle fix. A CommonJS factory referenced `module.exports`, but its `module` variable could disappear when earlier build steps placed it in a pre-minification `intro`. v0.1.5 places `var module = { exports: {} }; var exports = module.exports;` inside the post-minification factory prefix.

After safely updating your clone:

```bash
pnpm install
pnpm run check
```

Only on success:

```bash
dsh plugin --profile web add .
dsh plugin --profile web install
```

Fully restart DSH Web, hard-refresh (`Ctrl+Shift+R`), confirm the plugin manager shows the installed current version, and inspect the browser console. **The original source notes did not confirm a completed live DSH browser test of this fix.**

## Bundle audit: "wrong DSH client module id"

This was addressed in **v0.1.3**. Executable loader registration in normal Rolldown `banner`/`footer` may be dropped by minification. The client uses `postBanner` and `postFooter` instead, while the audit evaluates the output with a fake module loader to require one factory named `dsh-mindmap`.

Build from this plugin directory, not from an unrelated workspace-wide fork build:

```bash
pnpm run check
```

Do not bypass this audit. Correct the actual wrapper or registration error if it persists.

## Browser bundle imports Node builtins: process, buffer, node:url, etc.

Older bundles exposed `node:process` and transitive Markdown tooling imports to the browser module table. **v0.1.2** introduced browser-oriented `vfile` resolutions (`#minpath`, `#minproc`, `#minurl`), a `buffer` polyfill, and stronger import checks. The early **v0.1.1** process-only workaround was insufficient.

Never add Node builtins to DSH's client module table or disable the audit. Preserve the **first failing import and dependency name** and fix browser resolution at the appropriate boundary.

## Canvas only fills half of Better Sidebar

Older Markmap elements could retain an internal 400px height while the sidebar was taller. **v0.1.4** made both map and Markdown editor fill the available flex pane below the toolbar, set explicit element sizing, and observes actual canvas resizes.

After rebuilding and reinstalling, test resizing the right sidebar, toggling split panes/maximize, and reopening a large map. If it still clips, capture the computed height of the map element and its containing panel; do not modify Better Sidebar to compensate without diagnosis.

## Git pull fails: local and remote branches diverged

Preserve local commits and changes:

```powershell
git status -sb
git fetch origin
git log --oneline --left-right HEAD...origin/main
```

If the working tree is clean, `git merge origin/main` preserves both local and remote commits. If dirty, commit or stash the local changes first. Resolve merge conflicts explicitly. Avoid `git reset --hard`, `git clean`, blind force pulls or overwriting unrelated workspace edits.

## TypeScript TS5097

The historical `TS5097` issue involved imports ending in `.ts`. The plugin's `tsconfig.json` has been configured with `allowImportingTsExtensions`; run `pnpm typecheck` in this checkout. Do not assume an error in a different fork/build workspace belongs to DSH Mindmap.

## Other DSH profile warnings

Past logs also showed unresolved official bundle imports (`@deepseek-ai/dsh-experimental-forge-bundle`, `@deepseek-ai/dsh-personalized-recommendations`, `@deepseek-ai/dsh-cua-bundle`) and stale `cordis.patch.yml` targets. These can be independent **host/profile** issues, not Markmap parsing bugs. Back up the profile before changing patches or dependencies, and inspect `dsh web --dump-config`.

A separate workspace's `scripts/build-forks.ps1` summary such as "3 plugin build(s) failed" counts failures **across that workspace**; it does not show three independent failures in this plugin. Diagnose each project individually.

## Native Files shows ordinary Markdown instead of Mindmap

Use a compound suffix `*.mindmap.md` or `*.mindmap.markdown`, verify the active plugin version and native `documentPreviews` support, then rebuild and restart. Frontmatter alone on a normal `.md` file does not select native Mindmap. Studio is not required. Test with Better Sidebar disabled first.

## Still failing?

Attach the first build error or browser console stack trace, `dsh --version`, `node --version`, the plugin version shown in DSH, and the output of `pnpm run check`. Separate source/build validation from end-to-end DSH Web acceptance.
