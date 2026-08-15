# Ubuntu ARM64 and Hyprland handoff

For the executable, command-level continuation guide, use
[`ubuntu-hyprland-port-runbook.md`](ubuntu-hyprland-port-runbook.md). This file
remains the broader planning and feature-priority brief.

Status: planning and bring-up guide for the first real Linux session.

This document is the continuation brief for Strongly Living Weekly. It records
the product decisions already made, the current beta, what can be tested while
Windows remains the primary operating system, and the exact work that should be
left for the real Hyprland environment.

## Product contract

Strongly Living Weekly is a quiet, local-first life calendar with a fixed
planning horizon:

- exactly 80 columns, one for each age year;
- exactly 52 cells per column;
- exactly 4,160 tracked weeks;
- the first cell begins on the birthdate;
- the final grid intentionally ends after 4,160 consecutive weeks rather than
  trying to reach the exact 80th birthday;
- Monday is the review day for the week that just ended;
- an on-time review can only be sealed during that Monday review window;
- a missed week remains visibly missed;
- later writing is allowed only as a clearly labelled retrospective and never
  changes a missed week into an on-time review.

The weekly review has only three required inputs:

1. What happened?
2. One combined 1-5 rating.
3. One commitment for the next week.

Daily notes are optional children of a week. Commitments are displayed quietly
in the interface; they do not produce reminder notifications.

## Intended Linux experience

The existing wallpaper should remain visible. The 4,160-cell map should not be
permanently painted over it because it would also appear behind translucent
terminals and weaken the rest of the desktop design.

The recommended Hyprland experience has two surfaces:

1. A small top-center capsule that is always available and displays a sanitized
   summary.
2. A centered translucent application window that opens from the capsule or a
   key binding and contains the full life map and editor.

The capsule should show something similar to:

```text
975 / 4,160 weeks  |  2d left  |  current commitment
```

Privacy mode omits the commitment. Personal mode may show it. The full
application is an ordinary interactive window; it is not a replacement
wallpaper and should not be permanently above other windows.

The capsule should eventually be a layer-shell surface supplied by the shell
framework already present in the user's rice. Do not choose Waybar,
Quickshell, AGS, Eww, or a custom host until the real configuration has been
inspected.

## Current browser beta

Implemented and working:

- exact 4,160-week generation and tested date primitives;
- a centered 80-by-52 grid with measured, even pixel spacing;
- elapsed, current, future, awaiting-review, recorded, missed, and retrospective
  visual states;
- Monday-only on-time reviews;
- the three-field weekly review and sealed records;
- optional daily notes for the current week;
- "This week in previous years" when past records exist;
- Privacy and Personal modes;
- a commitment or saved-quote strip;
- compact date, week, year progress, days-left, and recorded-week metrics;
- focus and normal interaction modes;
- Observatory, Graphite, Frost, Ember, and custom hexadecimal themes;
- local versioned persistence and migration from the original beta;
- validated JSON export, import, and restore;
- responsive desktop and smaller-screen layouts;
- automated unit tests, linting, type checking, and a production web build.

Intentionally absent from the passive view:

- a live clock;
- journal text in Privacy mode;
- commitment notifications;
- permanently visible explanatory copy;
- a logo or large application header.

## What can be tested without leaving Windows

### Browser tests: fully useful now

The current Vite application is the correct place to finish shared layout,
review behavior, privacy filtering, theme tokens, keyboard navigation, data
validation, and backup behavior. These do not depend on Hyprland.

A desktop-shell preview route can also simulate:

- the wallpaper visible behind a translucent application;
- the top-center capsule;
- click-to-open and Escape-to-hide transitions;
- Privacy versus Personal capsule content;
- several monitor aspect ratios and scale factors.

This will validate the design contract, but it will not reproduce compositor
blur or layer-shell focus rules.

### WSL2 and WSLg: useful smoke test, not a Hyprland test

WSL2 can install the Linux toolchain, run tests, compile the web application,
build a normal Linux Tauri window, and launch Linux GUI applications through
WSLg. It is useful for finding:

- case-sensitive path mistakes;
- missing Linux build dependencies;
- architecture-sensitive packages;
- Linux file-path and permission assumptions;
- basic GTK/WebKit window startup failures.

WSLg is hosted inside the Windows desktop and is not a complete Hyprland
session. It cannot provide authoritative results for:

- Hyprland window or layer rules;
- layer-shell anchoring and exclusive zones;
- compositor blur and opacity;
- special workspaces;
- focus, fullscreen, or tiling behavior;
- session autostart;
- multi-monitor placement under Hyprland;
- screen-sharing behavior.

Treat a WSLg launch as a Linux application smoke test only.

### Ubuntu ARM64 virtual machine: possible, optional, and imperfect

A full Ubuntu ARM64 guest with an accelerated VirtIO display can potentially
run Hyprland and exercise more compositor behavior. This is not the recommended
critical path on the Snapdragon Windows machine:

- the Windows-on-ARM virtualization route is more fiddly than a normal x86
  Ubuntu VM;
- Hyprland itself treats virtual-machine support as best effort;
- accelerated graphics setup may consume more time than this application;
- blur, fractional scaling, performance, sleep/wake, and monitor behavior in a
  VM still do not represent the ThinkPad panel and GPU accurately.

Use a VM only if experimenting with the Linux environment is itself desirable.
Do not block application development on it.

### GitHub Actions ARM64: build proof, not visual proof

An ARM64 workflow can run the test, lint, type-check, and web build matrix and
later build native Linux packages. This is the best way to catch dependency and
packaging regressions before changing operating systems. It cannot inspect the
actual window visually or verify Hyprland interaction.

ARM AppImages should be built on an ARM64 Linux runner rather than treated as a
normal cross-compile target.

## Recommended remaining Windows work

Complete these in this order before the final Ubuntu bring-up.

### 1. Desktop-shell preview

Add a development-only preview that places the application over a selectable
wallpaper image and includes a functional capsule mock. Test 16:10 at the
ThinkPad's native logical sizes, plus 100%, 125%, 150%, and 200% scaling.

Acceptance criteria:

- the map remains legible without covering the entire wallpaper;
- Privacy mode never places journal or commitment text in the capsule;
- the capsule opens the full view;
- Escape dismisses the full view back to the capsule;
- all theme opacity tokens work over both bright and dark wallpapers.

### 2. Sanitized desktop summary

Define one versioned summary object that contains only shell-safe data:

```json
{
  "schemaVersion": 1,
  "currentWeek": 975,
  "totalWeeks": 4160,
  "daysRemaining": 2,
  "yearProgress": 0.62,
  "recordedWeeks": 21,
  "commitment": null,
  "privacyMode": "privacy",
  "themeId": "observatory",
  "updatedAt": "2026-08-15T10:00:00Z"
}
```

Generate it from a pure function and add unit tests proving that Privacy mode
always returns `null` for `commitment`. The future shell widget must consume
this object, never the journal database.

### 3. Storage boundary

Move direct browser storage calls behind a repository interface. Keep JSON
backup/restore as the portable escape hatch. IndexedDB is a reasonable next
browser implementation; SQLite can be introduced inside Tauri later without
changing React components.

This is more important than cloud sync for the first Linux build. Cloud sync
should be added only after record ownership, conflict behavior, deletion, and
recovery are specified.

### 4. Tauri wrapper

Wrap the existing React build without moving calculations or journal behavior
into Rust. Add commands for:

- show and focus the main window;
- hide the main window;
- export a backup through a native file picker;
- write the sanitized summary to an XDG-compatible state location;
- report the application version and platform.

Test the wrapper as a normal window on Windows first. Transparent Linux window
configuration and compositor-specific rules remain separate.

### 5. ARM64 continuous integration

Add jobs for:

- `npm test`;
- `npm run lint`;
- `npm run build`;
- a Linux ARM64 Tauri development build;
- package artifacts only after the basic Tauri window is stable.

### 6. Beta polish

Before switching systems, add or verify:

- a clear empty state when no earlier-year review exists;
- keyboard focus restoration after closing a week sheet;
- confirmation before a backup import replaces current data;
- an obvious backup reminder in settings;
- error boundaries or a recoverable screen for invalid persisted data;
- tests around New Year, leap day, DST boundaries, and the final week;
- a short manual regression checklist for setup, review, notes, privacy, themes,
  export, and restore.

## Features that can wait until after the first Hyprland beta

These are valuable but are not prerequisites for a native Linux experience:

- Supabase authentication and cloud synchronization;
- encrypted cloud journal text;
- revision history and automatic local snapshots;
- life chapters, eras, and milestones;
- full-text search and filtering;
- recurring time blocks and estimated free hours remaining;
- richer daily-note navigation;
- health measurements and attachments;
- screen-time providers;
- wallpaper generation or ambient-grid mode;
- calendar import;
- Windows desktop integration.

The first post-port product goal is a reliable capsule plus local full app, not
feature parity with the long-term idea list.

## Work that genuinely requires the real Hyprland session

The following work should not be finalized in WSL or a browser simulation:

1. Inspect the installed Hyprland version and use the matching version of its
   documentation.
2. Inspect the existing bar/widget framework and implement exactly one capsule
   integration for it.
3. Assign a stable application class/app ID and write current window rules.
4. Tune centering, float size, opacity, blur, rounding, borders, and animation.
5. Decide current workspace versus special workspace behavior.
6. Add a key binding to show or hide the app.
7. Add session startup for only the capsule/bridge, not an always-rendering full
   webview.
8. Test fullscreen suppression, screen sharing, monitor hot-plugging,
   fractional scaling, sleep/wake, and restart recovery.
9. Measure idle CPU and memory use.
10. Build and install the native ARM64 beta on the Snapdragon X Elite.

## First-session information capture

Run these read-only commands in a terminal on the installed Ubuntu system and
save the complete output before editing any configuration:

```bash
cat /etc/os-release
uname -a
uname -m
hyprctl version
hyprctl monitors -j
hyprctl clients -j
hyprctl getoption decoration:blur:enabled
printf '%s\n' "$XDG_CURRENT_DESKTOP" "$XDG_SESSION_TYPE" "$XDG_STATE_HOME"
pgrep -af 'waybar|quickshell|ags|eww'
```

Also record:

- the repository URL and active branch;
- the monitor's native resolution, configured scale, and refresh rate;
- the paths to the active Hyprland and bar/widget configuration files;
- whether Secure Boot is enabled;
- whether the application should open on the current workspace or a special
  workspace;
- whether the capsule should hide under fullscreen windows;
- a screenshot of the desktop with no application windows open;
- a screenshot showing the preferred terminal transparency and blur.

Do not copy rules from an arbitrary Hyprland version. Hyprland documentation is
versioned and rule syntax changes. Match the output of `hyprctl version` first.

## Ubuntu bring-up sequence

1. Clone the repository and make a new `codex/linux-hyprland` branch (or another
   clearly named feature branch).
2. Install the current Node LTS and run the existing browser checks.
3. Open the Vite app in a browser and verify that imported Windows backup data
   restores correctly.
4. Install the Tauri prerequisites from the current official Tauri Linux guide.
5. Run the Tauri app as a normal decorated window before adding transparency.
6. Verify the native ARM64 binary can read and write its application data and
   summary file.
7. Add the stable app ID and the smallest possible Hyprland floating rule.
8. Add transparency and blur only after show, hide, focus, and Escape behavior
   work reliably.
9. Identify the existing shell framework and implement one capsule.
10. Add key binding and autostart last.
11. Reboot and run the manual regression checklist.
12. Export a fresh JSON backup before making cloud-sync changes.

## Definition of the first Hyprland beta

The Linux beta is complete when:

- the application builds natively on Ubuntu ARM64;
- the grid, reviews, daily notes, themes, and backups behave exactly like the
  browser beta;
- a top-center capsule starts with the Hyprland session;
- Privacy mode cannot leak commitment or journal text through the capsule;
- clicking the capsule and using a key binding both reveal the app;
- the app opens centered, translucent, and untiled without stealing focus
  unpredictably;
- Escape or close returns to the capsule;
- no full webview stays active unnecessarily while hidden;
- sleep/wake and a full reboot do not corrupt data or duplicate the capsule;
- idle resource use is measured and acceptable;
- JSON export and restore have been tested on Linux.

Cloud sync is not part of this definition.

## Prompt for continuing with a general-purpose GPT

Attach this document, `README.md`, `docs/hyprland-integration-draft.md`, and the
relevant source files. Then use this prompt:

```text
I am continuing Strongly Living Weekly on Ubuntu ARM64 with Hyprland on a
Snapdragon X Elite ThinkPad T14s. Read the attached handoff completely before
suggesting changes. Preserve the fixed 80 x 52 life map, Monday-only on-time
review rule, three-field weekly review, Privacy/Personal modes, local-first
data ownership, and capsule-plus-full-app architecture.

First inspect the environment information I provide, especially `hyprctl
version`, monitor scale, and my existing Waybar/Quickshell/AGS/Eww setup. Use
documentation matching my installed Hyprland version. Do not replace my rice,
do not choose a different widget framework unless the current one cannot meet
the requirements, and do not make the full life grid a permanent wallpaper.

Work in small reversible changes. Before editing, tell me which files will
change. After each change, give me exact verification commands and expected
behavior. Keep shared React logic independent of Hyprland, keep the shell
summary privacy-filtered, and never store journal content in shell scripts or
Hyprland configuration.

My first task is: [describe the next task here].
```

General-purpose GPT can prepare code and commands, but it cannot directly edit
the local repository unless it is connected to the files or used through an
editor integration. Keep the GitHub repository and JSON backup current before
the operating-system switch.

## Authoritative references to re-check at port time

- WSL GUI application limitations:
  <https://learn.microsoft.com/windows/wsl/tutorials/gui-apps>
- GitHub-hosted runner labels:
  <https://docs.github.com/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job>
- Hyprland installation and VM guidance:
  <https://wiki.hypr.land/Getting-Started/Installation/>
- Hyprland versioned documentation:
  <https://wiki.hypr.land/>
- Tauri Linux prerequisites:
  <https://v2.tauri.app/start/prerequisites/>
- Tauri AppImage notes, including ARM builds:
  <https://v2.tauri.app/distribute/appimage/>
