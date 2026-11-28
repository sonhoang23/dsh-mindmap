# Mobile smoke test

[← README](../README.md) · [Developer guide](./development.md)

This document covers the compact-screen controls added in the mobile-experience branch. **Code review and unit tests do not replace testing on real devices.** The plugin is still experimental.

## What changed

- A compact toolbar is selected by **the available panel width** (container query at 640px), not merely by the browser viewport width. This also helps narrow desktop sidebars.
- Mindmap reading removes the fixed toolbar; **⋯** opens editing, saving (if supported), appearance, zoom and export actions. The Markdown editor keeps its toolbar.
- The compact floating cluster keeps **Level** and **Fit**. Zoom buttons remain in ⋯, and pinch-to-zoom is unchanged. Focus Mode expands the same mounted map over the host using a manual top-layer popover when available, or fixed positioning as fallback. Desktop retains Markmap's native toolbar.
- Overview fits the current visible tree. Opt-in Reading mode folds dense deep maps to Level 2 when no explicit opening Level is saved, then fits and makes a conservative zoom-in step if still dense. Preferences and optional 4.5-second auto-hide are saved locally; touch/focus reveals controls. Focus is session-only.
- Touch input is owned only by the map surface (`touch-action: none`); toolbars and Markdown editing retain browser touch handling. Native Markmap gestures are reused rather than replaced.
- Small view-height changes are ignored; significant panel changes trigger a debounced fit. This limits disruption to manual pan/zoom while mobile browser chrome shifts.
- Mobile Markdown editor uses 16px text to avoid Safari's focus-zoom behavior.

## Acceptance matrix

Try a long map (at least 30 nodes, including deep branches) and a regular Markdown file in each environment:

| Environment | Width / situation |
| --- | --- |
| Android Chrome | 360px, 390px, 430px; portrait and landscape |
| iOS Safari | 375px or 390px; portrait and landscape |
| Tablet browser | 768px and a narrow Better Sidebar pane |
| Desktop | 1280px browser with both narrow and wide Better Sidebar pane |

Test these interactions:

1. No clipping or overlapping header controls; map occupies all remaining pane height.
2. Tap Mindmap and Markdown. Open **⋯**, choose another layout, export MD/SVG/PNG and close with Escape or an outside tap.
3. Tap and pinch the map: a one-finger pan should move nodes, two-finger gesture should zoom, tapping a branch circle should fold/unfold. The page should not be pulled while manipulating the map.
4. Try **Level** 1, 2, deeper levels (if available), and **All**; verify the expected branches fold/unfold. Then try **−**, **Fit**, **+** and **Mở tất cả nhánh**. The native Markmap Level selector remains available on wide panes.
5. Manually zoom or pan, then reveal/hide the mobile browser address bar. A small vertical resize should **not** reset the map; an orientation change should refit after movement settles.
6. Open Markdown and focus the editor; keyboard should not zoom text or hide the toolbar. Type, switch back to map, save, reopen and confirm the text persisted. Verify conflict protection is unchanged.
7. Open an ordinary `.md` without `markmap: true`: it must still use Better Sidebar's original Markdown viewer.
8. Open a second file and disable/reload the plugin: controls and registrations must not leak into other tabs or host UI.

## Limitations

- Focus Mode is an in-page overlay, not browser fullscreen. Safari browser chrome remains outside plugin control; validate top-layer and fixed fallback behavior in actual DSH hosts before release.
- No custom gesture handlers are installed. If touch behavior still fails, diagnose Markmap and the host's pointer/scroll chain before implementing a parallel gesture engine.
- Running DSH inside a narrow host pane may impose limitations outside this plugin's CSS.
- A source change is not a verified installation; run `pnpm run check`, rebuild and reinstall the linked plugin, restart DSH Web, and perform manual testing before release.

### Viewer options (#4–#10)

- On a narrow native Files panel, open ⋯; scroll the options, select each control and dismiss via outside tap or Escape. Verify touch targets, no horizontal overflow, readable themes, and access to existing export actions.
- Compare both Fit/Zoom presets with document defaults on a small map and a dense six-level map; verify pinch, pan, Fit, orientation change and SVG/PNG export. Record observed framing improvement before finalizing presets.
- Reopen with the saved opening Level, manually fold/unfold, change theme and switch Markdown/Mindmap. Check that ordinary editing retains folds. Test warnings and system dark-mode changes, then repeat with optional Better Sidebar enabled.

### Large PNG regression

- Open a dense map whose default 2x PNG would be at least 2564 × 6599. Export PNG in native Files on desktop and iOS/Android; verify the file opens, contains every visible branch and retains the selected light/dark scheme. If downscaled, check the feedback. Repeat with Better Sidebar enabled and verify SVG remains available even if PNG fails.

- For a reduced PNG export, verify the brief notice overlays the map without reducing its viewport height, disappears after four seconds, and can be closed immediately with ×. Confirm save success also clears automatically, export errors stay until dismissed or replaced, and opening options still works above the notice. Repeat on desktop and check that dismissing does not reset map zoom or folds.

### Mobile First reader acceptance

- Open a 40+ node deep map at 320, 375, 390 and 430px. Verify there is no fixed reader toolbar, both top corner controls are reachable, and Level/Fit do not obscure excessive canvas area.
- Enter and leave Focus Mode in portrait and landscape, including Escape and switching to Markdown. Verify the same map element remains mounted, folds and draft survive, no host UI is left obscured, and zoom/pan are not reset by the plugin resize handler. Verify fixed fallback in a browser without Popover API.
- Toggle Overview/Reading; verify dense trees fold only when an explicit opening Level is not selected, small maps are not forcibly folded, and manual pan/zoom cancels the delayed zoom step. Reload and confirm saved reader preference. Fit still fits the current visible tree and All still expands it.
- Enable auto-hide, wait 4.5s, tap/pan to reveal, then disable via ⋯. Confirm Level/Fit remain available in the menu even while hidden, menu and exit remain reachable, and all hit targets remain 44px or larger.
- Test a dirty Markdown draft, native export and Better Sidebar save, warnings, errors, export PNG/SVG, multiple tabs and plugin unmount. Check wide desktop toolbar remains unchanged.
