# Strongly Living Weekly: Ubuntu ARM64 / Hyprland port runbook

This is the technical continuation document for the first Ubuntu session. It
describes what must exist when the port is complete, how to bring the current
browser beta up as a native ARM64 application, and which parts belong to Tauri,
Hyprland, and the desktop capsule.

Do not redesign the product during the port. First preserve the current browser
behavior, then add native integration around it.

## 0. Before rebooting Windows

The current local checkout is:

```text
C:\Users\derek\Documents\Codex\2026-07-19\go\stronglylivingweekly
```

Its configured remote is:

```text
https://github.com/notananotheralt/stronglylivingweekly.git
```

The current branch is `main`. Before rebooting, use VS Code's Source Control
panel or a Windows terminal with Git to preserve every local change:

```powershell
cd C:\Users\derek\Documents\Codex\2026-07-19\go\stronglylivingweekly
git status
git add .
git commit -m "Prepare Ubuntu Hyprland port"
git push origin main
```

Confirm that the latest commit and these files are visible on GitHub:

```text
README.md
docs/ubuntu-hyprland-handoff.md
docs/ubuntu-hyprland-port-runbook.md
src/components/LifeGrid.tsx
```

Also export the current application data as JSON from Settings and copy the
backup somewhere Ubuntu can access. Browser `localStorage` will not transfer
automatically into a Linux Tauri webview.

Do not reboot until either the commit is visible on GitHub or the complete
project folder has been copied to storage accessible from Ubuntu.

## 1. Fixed product behavior

The port must preserve these decisions:

- fixed 80-by-52 map, exactly 4,160 consecutive weeks;
- first week begins on the configured birthdate;
- Monday is the only on-time review day for the week that just ended;
- a late entry is a retrospective and never repairs a missed on-time review;
- weekly form contains `What happened`, one 1-5 rating, and one commitment;
- daily notes remain optional;
- commitments appear passively but never create commitment notifications;
- Privacy mode and Personal mode are the only privacy levels;
- Privacy mode never exposes journal or commitment text outside the full app;
- full grid is the main application view;
- the existing wallpaper remains the real desktop background;
- the default Linux integration is a small capsule plus an on-demand full app,
  not a permanently rendered grid wallpaper.

## 2. Definition of the Linux architecture

The finished first beta should contain three isolated layers:

```text
Shared React application
  - calendar calculations
  - review rules
  - life grid and sheets
  - themes and privacy projection
  - storage interface
           |
           v
Tauri v2 ARM64 application
  - native WebKitGTK window
  - stable Linux app ID
  - native data and backup paths
  - sanitized summary writer
  - single-instance show/focus handling
           |
           v
Hyprland integration
  - one window rule for the full app
  - one key binding
  - one capsule adapter for the installed shell/bar
  - session startup for the capsule only
```

The React application must not import Hyprland commands. Hyprland configuration
must not read journal records. Tauri is the boundary between them.

## 3. Required installed artifacts

Use these names consistently unless the existing Linux packaging forces a
change:

```text
Application name       Strongly Living Weekly
Binary                 stronglylivingweekly
Tauri window label     main
Application identifier com.notananotheralt.stronglylivingweekly
Desktop file           com.notananotheralt.stronglylivingweekly.desktop
Summary schema         stronglylivingweekly.summary.v1
```

Expected Linux locations:

```text
$XDG_DATA_HOME/stronglylivingweekly/
  durable application data or database

$XDG_STATE_HOME/stronglylivingweekly/summary-v1.json
  privacy-filtered capsule state

$XDG_CONFIG_HOME/stronglylivingweekly/
  integration preferences only, if needed

$XDG_RUNTIME_DIR/stronglylivingweekly/
  optional ephemeral socket or lock files only
```

Use XDG defaults when variables are empty:

```text
XDG_DATA_HOME   -> ~/.local/share
XDG_STATE_HOME  -> ~/.local/state
XDG_CONFIG_HOME -> ~/.config
```

Do not hardcode `/home/derek`, Windows paths, monitor names, or a particular
Hyprland configuration location in application code.

## 4. Capture the Ubuntu and Hyprland environment first

Before installing or editing anything, open a terminal and collect the output
of these commands:

```bash
cat /etc/os-release
uname -a
uname -m
hyprctl version
hyprctl systeminfo
hyprctl monitors -j
hyprctl clients -j
printf '%s\n' "$XDG_CURRENT_DESKTOP" "$XDG_SESSION_TYPE"
printf '%s\n' "$XDG_DATA_HOME" "$XDG_STATE_HOME" "$XDG_CONFIG_HOME"
printf '%s\n' "$WAYLAND_DISPLAY" "$XDG_RUNTIME_DIR"
pgrep -af 'waybar|quickshell|ags|eww'
find ~/.config/hypr -maxdepth 2 -type f -print
```

Also check the development tools:

```bash
git --version
node --version
npm --version
rustc --version
cargo --version
```

Expected architecture:

```text
aarch64
```

Record the monitor's resolution, scale, transform, and refresh rate from
`hyprctl monitors -j`. Do not assume the logical viewport is the same size as
the physical panel; fractional scaling changes the number of logical pixels
available to the Tauri window.

### Hyprland version boundary

Do not paste a window-rule template until `hyprctl version` is known.

- Hyprland 0.54 and earlier normally uses hyprlang configuration.
- Hyprland 0.55 and later uses the newer Lua configuration system; current
  upstream documentation says hyprlang is deprecated from 0.55.

Open the documentation version matching the installed release. An Ubuntu or
rice-specific Hyprland package may not match the latest wiki.

## 5. Clone and prove the browser beta first

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/notananotheralt/stronglylivingweekly.git
cd stronglylivingweekly
git switch -c codex/linux-hyprland
```

Use Node 22 LTS or another Node release supported by the checked-in Vite
version. Then install exactly the lockfile dependency graph:

```bash
npm ci
npm test
npm run lint
npm run build
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/`. Before touching Tauri, verify:

- setup loads;
- the 80-by-52 grid is evenly spaced and centered;
- week sheets open and close;
- Privacy and Personal modes differ correctly;
- every theme works;
- JSON export works;
- the Windows JSON backup imports and restores its records.

Commit this baseline result before native work:

```bash
git add .
git commit -m "Verify browser beta on Ubuntu ARM64"
```

If the browser beta fails, fix it as a shared web issue. Do not try to hide a
web failure with Hyprland rules.

## 6. Install the Ubuntu Tauri toolchain

Use the current Tauri v2 prerequisites for Debian/Ubuntu:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Install Rust through `rustup`, not an old distro Rust package, and keep the
default stable toolchain:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup default stable
rustc --version
cargo --version
```

Confirm that Rust is also ARM64-native:

```bash
rustc -vV
```

The host line should contain an `aarch64` Linux target.

## 7. Add Tauri without moving product logic into Rust

Install and initialize Tauri from the existing Vite project:

```bash
npm install --save-dev @tauri-apps/cli@latest
npm install @tauri-apps/api@latest
npm pkg set scripts.tauri=tauri
npx tauri init
```

Use these initialization values:

```text
Application name: Strongly Living Weekly
Window title: Strongly Living Weekly
Web assets: ../dist
Development URL: http://localhost:5173
Frontend dev command: npm run dev
Frontend build command: npm run build
```

The generated configuration should resolve to this shape. Preserve the schema
generated by the installed CLI if it differs slightly:

```json
{
  "productName": "Strongly Living Weekly",
  "version": "0.1.0",
  "identifier": "com.notananotheralt.stronglylivingweekly",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Strongly Living Weekly",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "resizable": true,
        "decorations": false,
        "transparent": true
      }
    ]
  }
}
```

The 1280-by-800 size is a 16:10 fallback. Hyprland should center the window;
the application must remain responsive instead of assuming this exact size.

Keep `src-tauri/capabilities/default.json` narrow. If React calls the native
window close API, add the specific close permission rather than broadly
granting every window mutation:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close"
  ]
}
```

Add new plugin permissions only when their corresponding UI is implemented.
For example, a future native backup dialog should use Tauri's dialog plugin and
only its save/open permissions; the frontend should never receive general shell
or unrestricted filesystem permissions.

First native launch:

```bash
npm run tauri dev
```

Acceptance criteria for this stage:

- the native window opens under Wayland;
- the same 23 or greater tests still pass;
- no case-sensitive imports fail;
- the full grid renders;
- input, sheets, backup import, and theme selection work;
- no Hyprland-specific code has been added to React.

If startup fails, capture:

```bash
RUST_BACKTRACE=1 RUST_LOG=debug npm run tauri dev
```

Do not add transparency, window rules, autostart, or a capsule until the normal
native window works.

## 8. Native window lifecycle

The capsule remains available independently. Therefore, the first beta does
not need to keep a hidden WebKit webview resident all day.

Required behavior:

```text
Capsule click or key binding
  -> run `stronglylivingweekly --show`
  -> if no instance exists, start and show the main window
  -> if an instance exists, show/unminimize/focus its main window

Escape or normal close
  -> close the full application process
  -> capsule remains present
```

Use Tauri's single-instance plugin so repeated capsule clicks focus the same
window instead of creating duplicates:

```bash
cd src-tauri
cargo add tauri-plugin-single-instance --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
cd ..
```

Register the single-instance plugin before every other Tauri plugin. Its
callback should obtain the `main` webview window, call `show`, unminimize if
needed, and then call `set_focus`. On Linux this plugin coordinates instances
over D-Bus.

The React Escape handler should request a native close only when running under
Tauri. In a browser it should keep the current behavior of closing the active
sheet or leaving focus mode. Avoid importing `@tauri-apps/api` unconditionally
into pure date or model modules.

Keep an explicit Quit action if close is later changed to hide instead of exit.
Never make it impossible to terminate the process cleanly.

## 9. Platform boundary in the TypeScript source

Add one adapter interface rather than scattering environment detection:

```text
src/platform/DesktopBridge.ts
src/platform/browser/BrowserDesktopBridge.ts
src/platform/tauri/TauriDesktopBridge.ts
```

The interface should stay small:

```ts
export interface DesktopBridge {
  readonly kind: 'browser' | 'tauri'
  closeMainWindow(): Promise<void>
  writeDesktopSummary(summary: DesktopSummary): Promise<void>
  exportBackup(contents: string, suggestedName: string): Promise<void>
}
```

Browser behavior:

- close the active overlay rather than the browser tab;
- simulate the capsule in a preview route;
- download backup JSON through a Blob;
- retain local storage until the repository migration is ready.

Tauri behavior:

- close the native window/process;
- invoke a narrowly scoped Rust command to atomically write the summary;
- use a native save dialog for backup export;
- expose no arbitrary shell-execution capability to the webview.

## 10. Durable data and migration

There are two distinct data classes:

### Private application data

Settings, weekly records, daily notes, and future sync metadata belong in the
application data directory. The long-term target is SQLite or another storage
implementation behind the existing repository boundary.

For the first native-window milestone, Tauri's WebKit `localStorage` may be
used temporarily so the existing UI can run. It is not the final durability
layer and must not be assumed to share data with Chrome, Windows, or another
Tauri installation.

Required migration path:

1. Export JSON from the Windows/browser beta.
2. Import JSON into the Linux Tauri beta.
3. Verify record counts and spot-check entries.
4. Export again from Tauri.
5. Only then replace the storage backend.

The future repository interface should support a one-time migration from the
webview store into native storage. Never silently delete the source data after
migration; keep a backup until the new store has been read back successfully.

### Public desktop summary

The capsule reads only a sanitized summary. It must never read browser storage,
SQLite tables, backups, or journal text.

Use this version-one schema:

```json
{
  "schema": "stronglylivingweekly.summary.v1",
  "generatedAt": "2026-08-15T10:00:00Z",
  "anchorWeekStart": "2026-08-10",
  "anchorWeekNumber": 970,
  "totalWeeks": 4160,
  "weekStartsOn": 1,
  "recordedWeeks": 21,
  "privacyMode": "privacy",
  "commitment": null,
  "commitmentValidThrough": null,
  "theme": {
    "surface": "#111714",
    "text": "#edf3ef",
    "accent": "#a8c7b5"
  }
}
```

Design details:

- `anchorWeekStart` and `anchorWeekNumber` let the capsule derive the current
  week after a rollover without starting the webview;
- `weekStartsOn` remains Monday (`1`) but is explicit;
- `commitment` is always `null` in Privacy mode;
- `commitmentValidThrough` lets a stale capsule hide an expired commitment;
- no birthdate, review content, daily notes, tags, database IDs, or backup paths
  appear in this file;
- custom theme output contains only colors required to render the capsule.

Add a pure function such as:

```text
src/core/desktopSummary.ts
```

Unit tests must prove:

- Privacy mode always removes commitment text;
- Personal mode includes only the current valid commitment;
- week number is clamped to 1 through 4,160;
- the summary contains no keys from `WeekEntry` other than the projected
  commitment;
- custom colors are validated before serialization.

The Rust command should write to a temporary file in the same directory and
rename it over `summary-v1.json`. The capsule must never observe a partially
written JSON file.

## 11. Transparent window implementation

Transparency requires cooperation between three layers:

1. Tauri window config: `transparent: true`, `decorations: false`.
2. Web document: transparent unused canvas.
3. Hyprland: blur and final placement.

The top-level CSS should be transparent only in native/desktop mode:

```css
html.is-native,
html.is-native body,
html.is-native #root {
  background: transparent;
}
```

Actual readable panels, sheets, and controls should keep RGBA backgrounds.
Do not apply opacity to the complete window in CSS because that also fades text.
Do not combine multiple compositor opacity multipliers without understanding
their product.

Initial target values:

```text
Unused canvas                    fully transparent
Map/status surfaces              65-78% opaque
Editing/settings sheets          90-95% opaque
Future grid cells                20-35% opaque
Elapsed grid cells               50-65% opaque
Current/review-required cell     95-100% opaque
```

Test over one bright wallpaper and one dark wallpaper. Text and focused controls
must satisfy normal readability even if blur is disabled.

## 12. Identify the real Wayland application class

After `npm run tauri dev` opens the window, inspect it:

```bash
hyprctl clients
hyprctl clients -j
```

With `jq` installed, this is easier to read:

```bash
hyprctl clients -j | jq '.[] | {class, initialClass, title, initialTitle, xwayland, size}'
```

Record the actual `class` and `initialClass`. Match that observed value in
Hyprland; do not guess that it equals the Tauri identifier.

Confirm `xwayland` is false. A normal Tauri/WebKitGTK window should use the
Wayland path in the Hyprland session.

## 13. Add the smallest Hyprland window rule

Start with only floating and centering. Let Tauri supply its fallback size.

For Hyprland 0.54 or earlier, a template is:

```text
windowrule {
  name = strongly-living-weekly
  match:class = ^ACTUAL_CLASS_FROM_HYPRCTL$

  float = on
  center = on
}
```

For Hyprland 0.55 or later, the equivalent belongs in the active Lua config:

```lua
hl.window_rule({
  name = "strongly-living-weekly",
  match = {
    class = "^ACTUAL_CLASS_FROM_HYPRCTL$"
  },
  float = true,
  center = true
})
```

These are templates, not instructions to paste both. Replace the class and
check the matching version's rule reference before reloading.

Reload and inspect errors using the method appropriate to the installed
Hyprland version. Then verify:

- one app window is floating;
- it is centered on the currently focused monitor;
- ordinary applications are unaffected;
- opening a sheet does not create an incorrectly tiled second window;
- fullscreen applications do not become unstable.

Only after that works should you tune a percentage size, rounding, border,
animation, or workspace behavior. Avoid global rules based only on the window
title.

## 14. Key binding

The installed `.deb` should make this command available:

```bash
stronglylivingweekly --show
```

For Hyprland 0.54 or earlier, the intended binding shape is:

```text
bind = SUPER, W, exec, stronglylivingweekly --show
```

For Hyprland 0.55 or later:

```lua
hl.bind("SUPER + W", hl.dsp.exec_cmd("stronglylivingweekly --show"))
```

Use a different key if the rice already owns `SUPER + W`. Test both cold launch
and focusing an already-open instance.

Do not put the app on a special workspace until normal floating behavior is
stable. A special workspace is an optional later UX decision, not a port
requirement.

## 15. Capsule implementation contract

First determine which shell component already exists:

```bash
pgrep -af 'waybar|quickshell|ags|eww'
```

Choose exactly one adapter:

### Existing Waybar

Add a `custom/stronglylivingweekly` module that:

- reads `summary-v1.json`;
- validates `schema` before rendering;
- derives the current week from `anchorWeekStart` and `anchorWeekNumber`;
- shows week count and days remaining;
- includes commitment only when `privacyMode` is `personal` and it has not
  expired;
- returns one-line JSON for Waybar;
- opens `stronglylivingweekly --show` on click;
- shows a neutral `Open Strongly Living Weekly` state if the summary is missing
  or invalid.

The module should poll slowly, such as once per minute, or be refreshed by a
signal when the app rewrites the summary. It does not need a second-by-second
clock.

### Existing Quickshell, AGS, or Eww

Create a native component inside that framework with the same summary and click
contract. It may float at the top center as a real layer-shell surface. Use the
framework's file-watching capability rather than polling if it is reliable.

### No existing widget framework

Prefer a small Waybar custom module if Waybar is already acceptable. A dedicated
layer-shell process is a last resort because it adds another toolkit, package,
lifecycle, and ARM64 build to maintain.

The capsule is not allowed to:

- import the journal database;
- display `whatHappened` or daily-note content;
- expose the birthdate;
- write application settings;
- run arbitrary strings obtained from the summary;
- start multiple application instances;
- reserve excessive screen space through an exclusive zone.

Target capsule geometry:

```text
Anchor       top center
Height       28-38 logical pixels
Width        content driven, maximum about 40% of monitor width
Margins      enough to clear the existing bar/gaps
Keyboard     no focus until clicked
Layer        top/overlay according to existing shell conventions
Fullscreen   hide or become unobtrusive, decided after real testing
```

## 16. Startup ownership

Only the capsule starts with Hyprland. The full Tauri application starts on
demand.

If the capsule is a Waybar module, the existing Waybar process already owns its
lifecycle; add no second autostart entry.

If it is a separate Quickshell/AGS/Eww process, choose one startup owner:

- existing rice startup configuration;
- Hyprland session startup;
- or a `systemd --user` service.

Do not enable both Tauri autostart and Hyprland `exec-once`. Duplicate ownership
causes duplicate surfaces and difficult restart behavior.

Version-sensitive templates:

```text
# Hyprland 0.54 or earlier
exec-once = YOUR_CAPSULE_COMMAND
```

```lua
-- Hyprland 0.55 or later
hl.on("hyprland.start", function()
  hl.exec_cmd("YOUR_CAPSULE_COMMAND")
end)
```

If the current rice already launches the selected framework, modify its existing
configuration rather than launching another copy.

## 17. Packaging for Ubuntu ARM64

Use `.deb` as the first installable target. Build natively on the ARM64 laptop:

```bash
npm test
npm run lint
npm run build
npm run tauri build -- --bundles deb
```

Inspect the output:

```bash
find src-tauri/target/release/bundle -maxdepth 3 -type f -print
file src-tauri/target/release/stronglylivingweekly
dpkg-deb --info src-tauri/target/release/bundle/deb/*.deb
ldd src-tauri/target/release/stronglylivingweekly
```

Expected binary architecture is ARM64/AArch64. `ldd` should show no `not found`
dependencies.

Install the local package:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/*.deb
```

Then verify:

```bash
command -v stronglylivingweekly
stronglylivingweekly --show
```

Build AppImage later. Tauri's AppImage tooling cannot treat ARM as an ordinary
cross-compile target; use the native ARM64 machine or an ARM64 runner.

## 18. CI target

After the native development build succeeds, add a GitHub Actions ARM64 job.
Use a currently available hosted label such as `ubuntu-26.04-arm` only after
confirming it is enabled for the repository.

The required CI order is:

```text
checkout
Node setup with npm cache
Rust stable setup with Cargo cache
install Ubuntu Tauri system dependencies
npm ci
npm test
npm run lint
npm run build
Tauri ARM64 build
upload .deb artifact
```

Do not add signing, automatic releases, or cloud deployment in the first port
workflow. First make pull requests prove that the ARM64 native build remains
healthy.

## 19. Manual acceptance matrix

Run this after installing the `.deb`.

### Native identity

- `uname -m` reports `aarch64`.
- `file` reports an AArch64 application binary.
- `hyprctl clients` reports the intended class and `xwayland: 0`/false.
- only one instance exists after repeated capsule clicks.

### Window behavior

- cold launch opens on the focused monitor;
- window floats and centers;
- 16:10 grid fits without clipping;
- 100%, 125%, 150%, and 200% logical scaling are checked where available;
- Escape and close behave consistently;
- reopening after close works;
- fullscreen, workspace switching, and focus history remain normal;
- transparency works with blur enabled and remains readable with blur disabled.

### Privacy

- switch to Privacy mode and close the app;
- inspect `summary-v1.json` directly;
- confirm `commitment` is `null` and no journal/daily-note text exists;
- confirm capsule text contains no private content;
- change to Personal mode and confirm only the allowed current commitment appears;
- screen-share once and verify the chosen capsule behavior.

### Data

- import the Windows JSON backup;
- compare weekly-entry and daily-note counts;
- spot-check at least three historical entries;
- save a daily note;
- export a new Linux backup;
- quit and relaunch;
- verify the record remains;
- restore the Linux export into a clean test profile before trusting it.

### Time rules

- tests pass for Monday review opening;
- tests pass for late retrospective status;
- tests cover New Year, leap day, DST transition, week 1, and week 4,160;
- capsule week calculation agrees with the application;
- an expired commitment is hidden even if the app has not opened since rollover.

### Lifecycle and resources

- capsule survives closing the app;
- restarting the capsule does not launch the full app;
- logout/login creates one capsule;
- reboot creates one capsule;
- sleep/wake preserves click behavior;
- no duplicate processes remain;
- idle CPU and memory are recorded for both capsule-only and full-app states.

## 20. Debugging commands

Useful read-only checks:

```bash
hyprctl clients -j | jq
hyprctl layers -j | jq
hyprctl monitors -j | jq
pgrep -af stronglylivingweekly
pgrep -af 'waybar|quickshell|ags|eww'
journalctl --user --since today
ls -la "${XDG_STATE_HOME:-$HOME/.local/state}/stronglylivingweekly"
ls -la "${XDG_DATA_HOME:-$HOME/.local/share}/stronglylivingweekly"
```

Development logging:

```bash
RUST_BACKTRACE=1 RUST_LOG=debug npm run tauri dev
```

If the window has an unexpected class, trust `hyprctl clients`, not the title or
the intended Tauri identifier. If transparency is black, first verify the page
canvas and Tauri `transparent` setting, then inspect compositor blur. If text is
faded, remove whole-window opacity multipliers before changing colors.

## 21. Work that is explicitly deferred

Do not block the first Hyprland beta on:

- Supabase or cloud synchronization;
- end-to-end encryption;
- life chapters and milestones;
- search;
- free-hour scheduling;
- screen-time or health providers;
- wallpaper generation;
- an ambient always-visible grid;
- Windows desktop integration;
- AppImage or Flatpak distribution;
- update servers or automatic releases.

The first beta is complete when the shared app runs natively on ARM64, data can
be backed up and restored, the window integrates cleanly with Hyprland, and one
privacy-safe capsule reliably opens it.

## 22. Prompt to give a general-purpose GPT on Ubuntu

Attach this document, `README.md`, `AGENTS.md`, the existing Hyprland draft, and
the environment command output. Then use:

```text
I am porting Strongly Living Weekly from its React/Vite browser beta to a native
Tauri v2 application on Ubuntu ARM64 and Hyprland. Read the attached technical
runbook and repository instructions completely before proposing edits.

The non-negotiable product behavior is a fixed 80 x 52 map, Monday-only on-time
reviews, distinct late retrospectives, a three-field weekly review,
Privacy/Personal modes, local-first storage, and a privacy-filtered capsule that
opens an on-demand full app. Do not turn the grid into my wallpaper and do not
put Hyprland commands inside shared React logic.

First analyze my pasted output from `hyprctl version`, `hyprctl monitors -j`,
`hyprctl clients -j`, and the shell-framework process check. Match instructions
to my installed Hyprland version. Do not replace or broadly rewrite my rice.

Work one milestone at a time. Before each edit, list the files and purpose.
After each edit, provide exact test commands, expected output, and rollback
steps. Preserve JSON backup compatibility. Never allow journal text into the
desktop summary, capsule scripts, Hyprland configuration, logs, or command-line
arguments.

The current milestone is: [paste one milestone from this runbook].
```

## 23. References to check during the port

- Tauri Linux prerequisites:
  <https://v2.tauri.app/start/prerequisites/>
- Tauri configuration:
  <https://v2.tauri.app/reference/config/>
- Tauri single-instance plugin:
  <https://v2.tauri.app/plugin/single-instance/>
- Tauri filesystem security and app directories:
  <https://v2.tauri.app/plugin/file-system/>
- Tauri ARM AppImage notes:
  <https://v2.tauri.app/distribute/appimage/>
- XDG base directories:
  <https://specifications.freedesktop.org/basedir/>
- Hyprland current/versioned documentation:
  <https://wiki.hypr.land/>
- Hyprland window rules:
  <https://wiki.hypr.land/Configuring/Basics/Window-Rules/>
- Hyprland autostart:
  <https://wiki.hypr.land/Configuring/Basics/Autostart/>

---

# Part II: Reusable Ubuntu ARM64 / Hyprland rice handoff

This part is deliberately separate from the Strongly Living Weekly port plan
above. It records the desktop environment that the application will eventually
join, the working window-management model established during the ricing session,
and the compatibility boundaries a future assistant must respect. The live
machine and live files remain authoritative: this is a handoff and recovery
guide, not permission to overwrite a working rice.

## 24. Known-good baseline and non-negotiable compatibility boundary

The last captured system state was:

```text
Operating system       Ubuntu 26.04 LTS
Architecture           arm64 / AArch64 (Snapdragon laptop)
Display protocol       Wayland
Compositor             Hyprland 0.53.3
Desktop shell          DankMaterialShell (DMS) 1.5.2
Shell runtime          Quickshell 0.3.0
DMS install type       System package
Hyprland config        ~/.config/hypr/hyprland.conf
Login manager          GDM, with GNOME retained as a recovery session
```

This version combination has one decisive constraint:

- Hyprland 0.53.3 uses the Hyprlang/INI-style `hyprland.conf` format.
- DMS 1.5.2's `dms setup` flow targets the Hyprland 0.55-or-newer Lua
  configuration generation and may create `hyprland.lua` plus DMS Lua files.
- Therefore, **do not run `dms setup` on this baseline**. Integrate DMS manually
  with the existing `hyprland.conf`.
- Do not copy `hl.bind(...)`, `hl.window_rule(...)`, `hyprland.lua`, or other
  0.55+ Lua examples into 0.53. Conversely, after a future upgrade to 0.55 or
  later, do not assume old Hyprlang snippets remain the active configuration.

Always verify the boundary again before editing; versions may have changed since
this document was written.

## 25. Capture the complete live environment before any rice change

Run the following as the ordinary desktop user. It creates a timestamped,
read-only diagnostic bundle without changing the rice:

```bash
capture_root="${XDG_STATE_HOME:-$HOME/.local/state}/rice-captures"
capture_stamp="$(date +%Y-%m-%d_%H-%M-%S)"
capture_dir="$capture_root/$capture_stamp"
mkdir -p "$capture_dir"

{
  printf 'captured_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'hostname=%s\n' "$(hostnamectl --static 2>/dev/null || hostname)"
  printf 'architecture=%s\n' "$(dpkg --print-architecture 2>/dev/null || uname -m)"
  printf 'kernel=%s\n' "$(uname -srmo)"
  printf 'session_type=%s\n' "${XDG_SESSION_TYPE:-unset}"
  printf 'current_desktop=%s\n' "${XDG_CURRENT_DESKTOP:-unset}"
  printf 'wayland_display=%s\n' "${WAYLAND_DISPLAY:-unset}"
  printf 'hyprland_signature=%s\n' "${HYPRLAND_INSTANCE_SIGNATURE:-unset}"
} > "$capture_dir/environment.txt"

cp -a /etc/os-release "$capture_dir/os-release"
hyprctl version > "$capture_dir/hyprland-version.txt" 2>&1
hyprctl systeminfo > "$capture_dir/hyprland-systeminfo.txt" 2>&1 || true
hyprctl configerrors > "$capture_dir/hyprland-configerrors.txt" 2>&1 || true
hyprctl monitors -j > "$capture_dir/hyprland-monitors.json" 2>&1 || true
hyprctl clients -j > "$capture_dir/hyprland-clients.json" 2>&1 || true
hyprctl layers -j > "$capture_dir/hyprland-layers.json" 2>&1 || true
hyprctl devices -j > "$capture_dir/hyprland-devices.json" 2>&1 || true
dms --version > "$capture_dir/dms-version.txt" 2>&1 || true
qs --version > "$capture_dir/quickshell-version.txt" 2>&1 || true
dms doctor -v > "$capture_dir/dms-doctor.txt" 2>&1 || true
systemctl --user is-enabled dms.service > "$capture_dir/dms-user-enabled.txt" 2>&1 || true
systemctl --user is-active dms.service > "$capture_dir/dms-user-active.txt" 2>&1 || true
systemctl --global is-enabled dms.service > "$capture_dir/dms-global-enabled.txt" 2>&1 || true
systemd-inhibit --list > "$capture_dir/inhibitors.txt" 2>&1 || true
loginctl show-session "$XDG_SESSION_ID" > "$capture_dir/login-session.txt" 2>&1 || true
pgrep -af 'dms|quickshell|/usr/bin/qs|waybar|mako|hyprpaper|hypridle' \
  > "$capture_dir/shell-processes.txt" 2>&1 || true

find ~/.config/hypr -maxdepth 3 -type f -printf '%p\n' 2>/dev/null \
  | sort > "$capture_dir/hypr-file-list.txt"
find ~/.config/DankMaterialShell -maxdepth 3 -type f -printf '%p\n' 2>/dev/null \
  | sort > "$capture_dir/dms-file-list.txt"

printf 'Environment capture: %s\n' "$capture_dir"
```

Also capture the active configuration contents before asking an assistant to
modify them:

```bash
sed -n '1,1200p' ~/.config/hypr/hyprland.conf
find ~/.config/hypr/scripts -maxdepth 1 -type f -print -exec sed -n '1,400p' {} \;
```

Do not publish the diagnostic bundle without reviewing it. Window titles,
process arguments, hostnames, and paths may contain private information.

## 26. Make a recoverable checkpoint before editing

Use a new checkpoint for every milestone rather than repeatedly overwriting one
backup:

```bash
backup_root="${XDG_STATE_HOME:-$HOME/.local/state}/rice-backups"
backup_stamp="$(date +%Y-%m-%d_%H-%M-%S)"
backup_dir="$backup_root/$backup_stamp"
mkdir -p "$backup_dir"

cp -a ~/.config/hypr "$backup_dir/hypr"
test ! -d ~/.config/DankMaterialShell \
  || cp -a ~/.config/DankMaterialShell "$backup_dir/DankMaterialShell"
test ! -d ~/.config/environment.d \
  || cp -a ~/.config/environment.d "$backup_dir/environment.d"

systemctl --user cat dms.service > "$backup_dir/dms-user-unit.txt" 2>&1 || true
printf '%s\n' "$backup_dir" > "$backup_root/LAST_BACKUP"
printf 'Rice backup: %s\n' "$backup_dir"
```

For a single `hyprland.conf` edit, a simple adjacent copy is also useful:

```bash
cp -a ~/.config/hypr/hyprland.conf \
  ~/.config/hypr/hyprland.conf.before-"$(date +%Y-%m-%d_%H-%M-%S)"
```

### Exact rollback of the user rice

First inspect the checkpoint path; do not run restoration against an empty or
unexpected path:

```bash
backup_dir="$(cat "${XDG_STATE_HOME:-$HOME/.local/state}/rice-backups/LAST_BACKUP")"
printf 'Restoring from: %s\n' "$backup_dir"
test -f "$backup_dir/hypr/hyprland.conf"
```

After the `test` succeeds:

```bash
cp -a ~/.config/hypr \
  ~/.config/hypr.failed-"$(date +%Y-%m-%d_%H-%M-%S)"
cp -a "$backup_dir/hypr/." ~/.config/hypr/

if test -d "$backup_dir/DankMaterialShell"; then
  mkdir -p ~/.config/DankMaterialShell
  cp -a "$backup_dir/DankMaterialShell/." ~/.config/DankMaterialShell/
fi

hyprctl reload
hyprctl configerrors
```

If Hyprland cannot start, log into the retained GNOME session or a text console,
perform the same copy, then log back into Hyprland. Do not uninstall GNOME or
GDM while this rice is still evolving.

## 27. DMS and Quickshell: ownership and responsibilities

The stack is intentionally layered:

```text
Hyprland
  Window placement, focus, floating/tiling, workspaces, input, animations,
  borders, compositor blur and layer rules

Quickshell
  QML runtime/toolkit used to render shell surfaces; it is not a finished bar
  by itself

DMS
  Finished Quickshell desktop shell: bar, launcher, settings, notifications,
  control center, lock screen, wallpaper UI and system controls
```

DMS must have exactly one startup owner. The chosen baseline is Hyprland-owned
startup because GNOME remains installed as a fallback desktop:

```ini
exec-once = dms run
```

The globally enabled and per-user DMS service should not also start it. Inspect
both scopes before changing anything:

```bash
systemctl --user is-enabled dms.service || true
systemctl --user is-active dms.service || true
systemctl --global is-enabled dms.service || true
pgrep -af 'dms|quickshell|/usr/bin/qs'
```

If retaining Hyprland ownership, disable the other owner and reload the user
manager:

```bash
systemctl --user disable --now dms.service 2>/dev/null || true
sudo systemctl --global disable dms.service
systemctl --user daemon-reload
```

Do not add a second `dms run`, Quickshell invocation, Waybar, Mako, or wallpaper
daemon until checking whether DMS already owns that visible function. Duplicate
owners produce duplicate bars, notifications, lock managers and confusing IPC
failures.

Useful baseline integration:

```ini
$menu = dms ipc call spotlight toggle
exec-once = dms run

bind = $mainMod, R, exec, $menu
bind = $mainMod, comma, exec, dms ipc call settings focusOrToggle
```

## 28. Current `hyprland.conf` editing workflow

The current file intentionally stays close to the upstream example: preserve its
section order, comments, working workspace/media/gesture bindings, DMS startup,
colors and other unrelated behavior. Add or change the smallest lines needed.

For every edit:

```bash
cp -a ~/.config/hypr/hyprland.conf \
  ~/.config/hypr/hyprland.conf.before-next-change

${EDITOR:-nano} ~/.config/hypr/hyprland.conf
hyprctl reload
hyprctl configerrors
```

Expected validation result: `hyprctl configerrors` prints nothing. Then exercise
the changed behavior manually and inspect the live objects:

```bash
hyprctl clients -j | jq '.[] | {address,class,title,workspace,floating,fullscreen}'
hyprctl activewindow -j | jq
hyprctl layers -j | jq
```

If an edit fails:

```bash
cp -a ~/.config/hypr/hyprland.conf.before-next-change \
  ~/.config/hypr/hyprland.conf
hyprctl reload
hyprctl configerrors
```

Never paste a whole online dotfile over this file. Arch-based rice repositories
often assume different package names, helper scripts, plugins, monitors, shell
frameworks and newer Hyprland syntax. Port one feature at a time.

## 29. Established compact hybrid/floating-first behavior

The intended laptop workflow is a compact hybrid that makes ordinary use feel
closer to a traditional floating desktop while retaining Hyprland tiling on
demand.

### Compact gaps and smart single-window gaps

The last complete configuration used approximately:

```ini
general {
    gaps_in = 5
    gaps_out = 10
    float_gaps = 6
    border_size = 2
    resize_on_border = true
    extend_border_grab_area = 10
    layout = dwindle
}

workspace = w[tv1]s[false], gapsout:4, gapsin:0
workspace = f[1]s[false], gapsout:4, gapsin:0
```

Treat these as recorded target values, not a replacement block: first compare
them with the live file. The selectors reduce wasted space for one tiled or
maximized window, while ordinary multi-window layouts keep compact separation.

### Floating and tiling controls

The established controls are:

```ini
bind = $mainMod, V, togglefloating
bind = $mainMod SHIFT, V, settiled

bindm = $mainMod, mouse:272, movewindow
bindm = $mainMod, mouse:273, resizewindow
```

- `Super+V` toggles the focused window between floating and tiled.
- `Super+Shift+V` explicitly returns it to the tiling layout.
- `Super+left-drag` moves a floating window and can rearrange a tiled window.
- `Super+right-drag` resizes the active window.

Floating windows snap near monitor edges and one another without automatically
becoming Windows-style half-screen tiles:

```ini
general {
    snap {
        enabled = true
        window_gap = 6
        monitor_gap = 8
        border_overlap = false
        respect_gaps = true
    }
}
```

Hyprland 0.53 snapping and tiling are separate operations. The reliable workflow
is drag, release, then `Super+Shift+V` when the window should rejoin the tiling
tree. Do not promise Windows Snap Layouts without a separately reviewed helper.

### Floating-first rules

The configuration evolved from app-specific floating rules for Kitty, Dolphin
and modal dialogs to a more consistently floating-first model. Before modifying
rules, inspect the live rule section and `hyprctl clients`; rule order and class
matching matter. A broad `match:class = .*` rule can also catch games, dialogs,
file choosers or utilities that should not be centered and resized.

The desired user-visible outcome is:

- ordinary new windows appear on the current workspace, focused and above other
  floating windows;
- common application windows open large and centered, not tiny;
- modal dialogs remain appropriately sized;
- explicit fullscreen requests and manual tiling remain available;
- special/layer-shell DMS surfaces are not treated as normal application
  windows.

Validate every rule with real class values from `hyprctl clients -j`; never guess
from a window title.

## 30. Springy animations and performance boundary

The rice added a mild overshoot curve rather than an extreme bounce:

```ini
animations {
    bezier = springy, 0.05, 0.9, 0.1, 1.1
    animation = windowsIn, 1, 4.1, springy, popin 87%
    animation = layersIn, 1, 4, springy, fade
    animation = workspacesIn, 1, 1.75, springy, fade
}
```

Keep exit animations quicker than entrance animations so the desktop does not
feel sluggish. On the Snapdragon laptop, change one of blur size, blur passes,
animation speed or animated wallpaper load at a time and then check frame pacing,
battery drain, suspend/wake and external-monitor behavior.

## 31. Stable focus and Alt+Tab

The earlier focus-history binding interacted poorly with pointer-follow focus.
The intended model is click-to-focus plus a predictable window cycle that raises
the selected floating window. The working binding shape for the 0.53 config is:

```ini
input {
    follow_mouse = 0
}

bind = ALT, Tab, cyclenext
bind = ALT, Tab, alterzorder, top
bind = ALT SHIFT, Tab, cyclenext, prev
bind = ALT SHIFT, Tab, alterzorder, top
```

Some intermediate versions used the `hist` argument. Preserve whichever live
variant currently passes `hyprctl configerrors` and behaves correctly; do not mix
arguments from a newer Lua tutorial. Test with at least three overlapping windows
and the pointer resting over a different window.

## 32. Two fullscreen modes

Both modes are deliberate:

```ini
bind = $mainMod, F, fullscreen, 0
bind = $mainMod SHIFT, F, fullscreen, 1
```

- `Super+F`: true fullscreen, covering the display and bar.
- `Super+Shift+F`: maximize within the usable desktop area, retaining the bar.

Do not keep a `suppress_event = maximize` rule if it prevents the intended
maximize behavior or application titlebar requests. Test native Wayland and
XWayland applications separately.

## 33. Show desktop with `Super+D`

Hyprland has no traditional minimized-window state. `Super+D` was designed as a
helper that moves the current workspace's ordinary windows to a hidden special
workspace and restores the same set on the next press. It must not close windows,
touch DMS layer surfaces, or lose the original workspace identity.

The live contract is:

```ini
bind = $mainMod, D, exec, ~/.config/hypr/scripts/show-desktop.sh
```

Before relying on it, verify:

```bash
test -x ~/.config/hypr/scripts/show-desktop.sh
sed -n '1,400p' ~/.config/hypr/scripts/show-desktop.sh
command -v jq
```

Test on a disposable workspace with tiled and floating windows. Press once to
hide them, switch away and back, then press again to restore. A session restart,
window closure while hidden, multi-monitor workspace changes or a helper crash
may invalidate saved addresses; the script must tolerate missing windows. If the
script is absent or unverified, remove/comment the bind rather than replacing it
with an unreviewed internet script.

## 34. Screenshot workflow

Install the Wayland-native tools:

```bash
sudo apt update
sudo apt install grim slurp wl-clipboard
```

The intended shortcuts are:

```ini
bind = , Print, exec, ~/.config/hypr/scripts/screenshot.sh region
bind = $mainMod, Print, exec, ~/.config/hypr/scripts/screenshot.sh screen
```

The helper should create `~/Pictures/Screenshots`, use a timestamped PNG, save
the image and copy `image/png` to the Wayland clipboard. Its core operations are:

```bash
# Region; Escape from slurp must exit without creating a broken file.
geometry="$(slurp)" || exit 0
grim -g "$geometry" - | tee "$screenshot_file" | wl-copy --type image/png

# All outputs as one compositor image.
grim - | tee "$screenshot_file" | wl-copy --type image/png
```

Validate:

```bash
command -v grim slurp wl-copy
test -x ~/.config/hypr/scripts/screenshot.sh
ls -lt ~/Pictures/Screenshots | head
wl-paste --list-types | grep -F image/png
```

## 35. Lid-close suspend and DMS lock-before-suspend

Lid policy belongs to `systemd-logind`, not `hyprland.conf`. First prove suspend
works and inspect inhibitors:

```bash
systemctl suspend
systemd-inhibit --list
```

Create a dedicated override only after backing up any existing one:

```bash
sudo mkdir -p /etc/systemd/logind.conf.d
sudo cp -a /etc/systemd/logind.conf.d/60-lid-suspend.conf \
  /etc/systemd/logind.conf.d/60-lid-suspend.conf.before-rice \
  2>/dev/null || true

sudo tee /etc/systemd/logind.conf.d/60-lid-suspend.conf >/dev/null <<'EOF'
[Login]
HandleLidSwitch=suspend
HandleLidSwitchExternalPower=suspend
HandleLidSwitchDocked=ignore
EOF

systemd-analyze cat-config systemd/logind.conf
```

The policy suspends on battery and external power, but ignores the lid while
docked. Programs holding a low-level `handle-lid-switch` inhibitor can override
it. A restart of `systemd-logind` can terminate graphical sessions; the safest
activation is to save work and reboot:

```bash
sudo reboot
```

After wake, validate the preceding boot:

```bash
journalctl -b -1 -u systemd-logind --no-pager \
  | grep -Ei 'lid|suspend|sleep'
```

To lock before a manually requested suspend, use a small tested helper:

```bash
dms ipc call lock lock
sleep 0.5
systemctl suspend
```

Confirm the IPC verb against the installed DMS before binding it:

```bash
dms ipc list 2>/dev/null | grep -i lock || true
dms ipc call lock lock
```

Locking before a logind-owned lid event is harder: DMS's own idle/session feature
or a compositor switch-event helper may hold a lid inhibitor and become the event
owner. Do not enable DMS lid handling and logind lid handling simultaneously
without confirming which owns `handle-lid-switch`. The required outcome is one
owner, one lock, and one suspend.

Rollback the logind override:

```bash
sudo cp -a /etc/systemd/logind.conf.d/60-lid-suspend.conf.before-rice \
  /etc/systemd/logind.conf.d/60-lid-suspend.conf \
  2>/dev/null \
  || sudo mv /etc/systemd/logind.conf.d/60-lid-suspend.conf \
       /etc/systemd/logind.conf.d/60-lid-suspend.conf.disabled
sudo reboot
```

## 36. DMS taskbar transparency and compositor blur

Use DMS's settings for alpha and Hyprland for compositor blur. The safe starting
point in DMS is:

```text
Super + ,
Appearance -> Dank Bar -> Opacity
Bar opacity: 65%
Widget opacity: 35%
```

The recorded Hyprland 0.53 layer rule is:

```ini
layerrule {
    name = blur-dms-toolbar
    match:namespace = ^dms:bar$

    blur = on
    blur_popups = on
    ignore_alpha = 0.15
}
```

The global decoration blur was approximately:

```ini
decoration {
    blur {
        enabled = true
        size = 5
        passes = 1
        ignore_opacity = true
        new_optimizations = true
        xray = true
        vibrancy = 0.1696
    }
}
```

Increase to size 7 and two passes only after measuring smoothness and battery
impact. DMS doctor may continue to report that Hyprland lacks
`ext-background-effect-v1`; that warning concerns DMS's direct blur protocol.
Hyprland's own namespace layer rule can still provide compositor blur.

DMS 1.5.2 exposes one alpha value across the bar. A true left-to-right alpha
gradient requires a maintained QML change in DMS, not a Hyprland layer rule.
Prefer uniform translucent glass. If experimenting with QML, never edit the
system package directly under `/usr/share/quickshell/dms`; updates will overwrite
it. Fork/copy the shell into a user-maintained path, record the upstream version,
and be prepared to rebase it.

## 37. External rice repositories: facts versus recommendations

The following facts were derived from each repository's README and selected
manifest/installer files as retrieved on 2026-08-15. Repository claims are not
independent compatibility guarantees. Recheck the repository before using it.

### 37.1 Pyroclear

Repository: <https://github.com/shreyanth-sureshkrishnaa/pyroclear>

**Repository-derived facts:**

- It is a Rust terminal `clear` replacement that renders a fire/burn animation,
  then clears the visible screen and scrollback.
- Its Unix dependency is `libc`; `Cargo.toml` recorded version 1.1.2 and Rust
  edition 2021.
- It supports transparent terminal backgrounds, saved TOML settings, custom
  gradients and many built-in palettes.
- The README documents `cargo install pyroclear` and explicitly lists
  `aarch64-linux` and `x86_64-linux` in its Nix example.
- It stores configuration under `$XDG_CONFIG_HOME/pyroclear` or
  `~/.config/pyroclear`.

**Recommendation/inference for this rice:**

This is the lowest-risk of the three experiments and should work on ARM64 when
built natively with Ubuntu's Rust toolchain. It contributes a terminal animation
and palette, not Hyprland/DMS behavior. Install it without replacing `clear`
first:

```bash
sudo apt install cargo
cargo install --locked pyroclear
command -v pyroclear
pyroclear --help
pyroclear --no-save --color ocean
```

If `--locked` is unsupported by the published package or its lockfile, stop and
inspect rather than silently dropping reproducibility. Only after testing, add a
shell alias. Remember that it erases scrollback; retain `/usr/bin/clear` for
scripts and troubleshooting. Roll back with:

```bash
cargo uninstall pyroclear
```

and remove only the alias line that was deliberately added to the relevant shell
startup file.

### 37.2 Ricemood

Repository: <https://github.com/f0x48/ricemood>

**Repository-derived facts:**

- The README explicitly says it is not plug-and-play.
- It extracts wallpaper swatches with `node-vibrant`, transforms colors with the
  `color` library, parses markers such as `^r@Vibrant>lighten(...)^`, and
  overwrites target configuration files.
- It advertises i3 configs, terminal schemes and SVG icons as possible targets.
- `package.json` records version 0.0.2, TypeScript 3.7.2-era tooling and older
  Node dependencies, with installation via `npm install -g ricemood`.

**Recommendation/inference for this rice:**

Do not point Ricemood at the live `hyprland.conf`, DMS settings, QML, GTK or Qt
files. Its general idea—derive a coordinated palette from a wallpaper—is useful,
but DMS already has Matugen-based dynamic theming and should remain the first
choice. If a missing application needs templating, run Ricemood in an isolated
test directory against a copy, diff the result, validate syntax, and then copy
only reviewed output:

```bash
mkdir -p ~/rice-lab/ricemood-test
cp -a ~/.config/kitty/kitty.conf ~/rice-lab/ricemood-test/kitty.conf.input
cp -a ~/rice-lab/ricemood-test/kitty.conf.input \
  ~/rice-lab/ricemood-test/kitty.conf.output

# Run ricemood only against files below ~/rice-lab/ricemood-test.
diff -u ~/rice-lab/ricemood-test/kitty.conf.input \
  ~/rice-lab/ricemood-test/kitty.conf.output
```

Because native image dependencies may have architecture or modern-Node build
issues, test with the installed ARM64 Node version and never use `sudo npm -g`.
A safer long-term implementation would copy the placeholder concept into a small,
version-controlled generator that writes generated theme fragments rather than
mutating hand-edited live files.

### 37.3 WinTux dual-boot GRUB theme

Repository:
<https://github.com/Harshil-Anuwadia/wintux-dualboot-grub-theme-updated>

**Repository-derived facts:**

- It is a fullscreen Matrix-inspired GRUB theme. The README claims testing on
  Ubuntu/Debian and other GRUB distributions, UEFI and BIOS, and multiple
  resolutions.
- `universal-installer.sh` requires root, detects package manager, resolution,
  scaling and boot mode, installs GRUB/ImageMagick/gettext/zip dependencies,
  builds the theme and regenerates GRUB configuration.
- The installer edits `/etc/default/grub`, setting `GRUB_GFXMODE`, `GRUB_THEME`
  and optionally `GRUB_DISABLE_MEMTEST`.
- Its default/auto path can patch `/etc/grub.d/10_linux` and
  `/etc/grub.d/30_uefi-firmware`.
- It creates `/etc/default/grub.wintux.bak` and backups under
  `/etc/grub.d/wintux-backup`, but only when those backups do not already exist.
- On ImageMagick 6 it may create `/usr/local/bin/magick` as a symlink to
  `convert`.
- Its own script warns that Secure Boot can affect custom font behavior.

**Recommendation/inference for this rice:**

This change is architecture-light artwork but boot-critical configuration. ARM64
does not itself make the images incompatible; the real risks are whether this
ThinkPad actually boots through GRUB, its UEFI/Secure Boot behavior, Ubuntu
updates replacing patched `/etc/grub.d` scripts, incorrect native-panel
resolution, and losing a usable boot menu. Do not run `--auto` or the root
installer blindly.

First capture the boot path and make independent backups:

```bash
test -d /sys/firmware/efi && echo UEFI || echo BIOS
findmnt /boot /boot/efi
bootctl status 2>/dev/null || true
efibootmgr -v 2>/dev/null || true
grub-install --version 2>/dev/null || true
grep -E '^(GRUB_THEME|GRUB_GFXMODE|GRUB_DISABLE_MEMTEST)=' /etc/default/grub || true

grub_backup="$HOME/rice-backup/grub-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$grub_backup"
sudo cp -a /etc/default/grub "$grub_backup/default-grub"
sudo cp -a /etc/grub.d "$grub_backup/grub.d"
sudo cp -a /boot/grub/grub.cfg "$grub_backup/grub.cfg.generated" 2>/dev/null || true
printf 'GRUB backup: %s\n' "$grub_backup"
```

Read the complete installer and build script locally before any `sudo` command.
Prefer the interactive installer, decline patches to `10_linux` and
`30_uefi-firmware` for the first test, keep memtest, and explicitly enter the
native panel resolution. Have Ubuntu recovery media and firmware boot-menu access
available.

Rollback must use the independently recorded backup path, restore both the
defaults and any patched scripts, then regenerate the configuration:

```bash
grub_backup="$HOME/rice-backup/REPLACE_WITH_THE_RECORDED_GRUB_BACKUP"
test -f "$grub_backup/default-grub"
test -d "$grub_backup/grub.d"

sudo cp -a "$grub_backup/default-grub" /etc/default/grub
sudo cp -a "$grub_backup/grub.d/." /etc/grub.d/
sudo update-grub
```

Do not restore the saved generated `grub.cfg` as the primary rollback method;
regenerate it from the restored source configuration. Do not reboot if
`update-grub` reports an error.

## 38. Current known caveats and unresolved decisions

- The baseline version numbers are historical facts, not upgrade pins. Capture
  current versions at the start of every new session.
- DMS `dms setup` remains blocked while Hyprland is 0.53.3; reassess only after a
  deliberate Hyprland 0.55+ migration and a complete config backup.
- DMS doctor can report direct background blur unsupported even when Hyprland
  layer-rule blur works.
- A true transparency gradient across the DMS bar needs maintained QML; uniform
  opacity plus wallpaper blur is the update-safe design.
- Floating-first global rules can mishandle games, popups and file choosers.
  Prefer observed class-specific exceptions and validate each application.
- Snapping does not automatically turn a floating window into a half-screen tile.
- Alt+Tab behavior depends on `follow_mouse`, selected dispatcher arguments and
  fullscreen state; test overlapping, tiled and fullscreen windows.
- Show-desktop and minimize are helper/special-workspace emulations, not native
  minimized states. They need explicit multi-monitor and session-restart tests.
- Lid suspend may be intercepted by an inhibitor. DMS and logind must not both
  claim ownership without a tested design.
- Blur passes, spring animations, animated wallpapers and high-refresh external
  displays can compound GPU use and battery drain on the Snapdragon laptop.
- Pyroclear erases scrollback, Ricemood overwrites files, and the WinTux installer
  edits boot-critical configuration; their rollback scopes are very different.
- Retain GNOME and GDM until Hyprland login, suspend/wake, networking, portals,
  screen sharing and recovery have all been proven over time.

## 39. Validation matrix after any desktop milestone

Run the syntax and ownership checks:

```bash
hyprctl reload
hyprctl configerrors
pgrep -af 'dms|quickshell|/usr/bin/qs|waybar|mako|hyprpaper'
systemctl --user is-active dms.service || true
systemctl --global is-enabled dms.service || true
```

Then manually test:

- DMS bar, launcher (`Super+R`) and settings (`Super+,`);
- one and multiple tiled windows with smart gaps;
- new-window focus and floating placement;
- `Super+V`, `Super+Shift+V`, move, resize and snap;
- Alt+Tab and reverse Alt+Tab with three overlapping windows;
- true fullscreen and bar-preserving maximize;
- `Super+D` hide, workspace switch and restore;
- region and full-screen screenshots plus clipboard paste;
- lock, manual suspend, lid suspend on battery/external power, and wake;
- bright and dark wallpapers with blur disabled and enabled;
- GNOME login as the recovery path.

Record failures immediately:

```bash
hyprctl configerrors
hyprctl activewindow -j | jq
hyprctl clients -j | jq
hyprctl layers -j | jq
journalctl --user --since '-10 minutes' --no-pager
journalctl -b -u systemd-logind --since '-10 minutes' --no-pager
```

## 40. New chat bootstrap prompt

Attach this runbook and paste the latest environment capture, then start a new
chat with the following prompt:

```text
Read the attached Ubuntu ARM64 / Hyprland runbook completely before proposing or
making any change. Preserve the Strongly Living Weekly port plan and treat Part
II as the current Linux-rice handoff.

First verify the live machine rather than trusting the historical baseline.
Capture and report the current Ubuntu release and architecture, Hyprland version,
DMS CLI/shell version, Quickshell version, Wayland session, DMS startup owner,
active shell processes, monitors, clients, layers, inhibitors, and
`hyprctl configerrors`. Inspect the complete live `~/.config/hypr/hyprland.conf`,
all sourced Hyprland files, and relevant helper scripts before editing.

The previous baseline was Ubuntu 26.04 ARM64, Hyprland 0.53.3, DMS 1.5.2 and
Quickshell 0.3.0. Do not assume those versions are still installed. In
particular, check the Hyprland configuration boundary: 0.53 uses the older
Hyprlang/`hyprland.conf` workflow, while 0.55+ uses Lua. Do not run `dms setup`,
copy a Lua rice into 0.53, or copy old Hyprlang blindly into 0.55+. Check ARM64,
Ubuntu package, Wayland protocol and helper-script compatibility before adopting
anything from Arch dotfiles or another repository.

Preserve working formatting, comments, DMS ownership, workspace/media/gesture
bindings and unrelated behavior. Prefer the smallest reversible change. Before
each milestone, create a timestamped backup and show its exact path. State which
files will change and why. After each milestone, reload, run validation, describe
expected output, exercise the affected behavior, and provide exact rollback
commands. Never overwrite the whole rice merely because an example config is
available.

The intended workflow is compact hybrid/floating-first: smart laptop gaps, mild
spring animations, snapping, Super+V float toggle, Super+Shift+V return to tile,
stable click-to-focus Alt+Tab, true fullscreen plus bar-preserving maximize,
Super+D show desktop, grim/slurp/wl-copy screenshots, logind lid suspend with one
lock/suspend owner, and DMS bar opacity with selective Hyprland blur. Treat the
live config as authoritative if it differs.

For Pyroclear, Ricemood, the WinTux GRUB theme, or any new rice repository,
separate repository-derived facts from your recommendations. Do not install
anything automatically. Audit scripts and manifests, check maintenance and
licenses, test against copies, and match rollback depth to risk. Never run an
unreviewed root installer or modify GRUB without independent backups and a tested
recovery path.

My next customization milestone is: [DESCRIBE ONE SMALL MILESTONE].
```

## 41. Additional desktop-rice references

- DMS documentation: <https://danklinux.com/docs/dankmaterialshell/>
- DMS repository: <https://github.com/AvengeMedia/DankMaterialShell>
- Hyprland documentation: <https://wiki.hypr.land/>
- Hyprland 0.53 release notes: <https://hypr.land/news/update53/>
- Pyroclear: <https://github.com/shreyanth-sureshkrishnaa/pyroclear>
- Ricemood: <https://github.com/f0x48/ricemood>
- WinTux GRUB theme:
  <https://github.com/Harshil-Anuwadia/wintux-dualboot-grub-theme-updated>
