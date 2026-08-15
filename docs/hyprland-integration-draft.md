# Hyprland integration draft

Status: initial architecture draft. The web application remains the source of
truth until the Linux environment is available for direct testing.

## Intended experience

Strongly Living Weekly should feel like part of the desktop without replacing
the user's wallpaper or leaving the complete life grid behind transparent
terminal windows.

The default Linux presentation will have two states:

1. **Capsule** — a small translucent surface at the top-center of the desktop.
2. **Application** — the complete life map and editor, opened on demand.

The capsule shows only compact information:

```text
975 / 4,160 weeks  ·  2d left  ·  current commitment
```

In Privacy mode, the commitment is omitted. Clicking the capsule opens the
complete application. A Hyprland key binding can perform the same action.

The full application opens as a centered, borderless, translucent window. It
contains the life grid, review sheet, daily notes, themes, privacy controls,
and backups. Closing it returns to the capsule instead of terminating the
desktop integration.

## Proposed components

```text
React application
├── calculations and models
├── life grid and review interface
├── settings and themes
└── local/cloud data adapters
          │
          ▼
Tauri application
├── native application window
├── local database and backup access
├── summary writer
└── show, hide, and focus commands
          │
          ▼
Hyprland capsule
├── reads a sanitized summary
├── displays passive information
└── launches or reveals the Tauri window
```

### Full application

The existing React application will be packaged with Tauri. On Linux, its
window will have a stable application identifier so Hyprland can apply:

- floating and centered placement;
- no operating-system decorations;
- compositor blur behind transparent areas;
- an opening and closing animation;
- optional pinning to the current workspace;
- privacy protection during screen sharing, if desired.

The normal application window should not be forced permanently above every
other window. It is an interactive application that appears when requested and
can be dismissed with `Escape` or the normal close command.

### Capsule

The capsule should be a real Wayland layer-shell surface rather than a normal
floating window. That makes it behave like a desktop-shell component and keeps
it out of normal window switching and tiling.

The implementation should match the user's existing rice:

- **Waybar:** add a custom Strongly Living Weekly module.
- **Quickshell:** add a small QML layer-shell surface.
- **AGS or Eww:** add the equivalent native widget.
- **No existing shell framework:** ship a minimal dedicated layer-shell host.

We should not select a widget framework until the actual Hyprland environment
and current bar configuration have been inspected.

## Shared summary

The shell component must not read the journal database directly. The
application will write a small, sanitized summary to a user-state directory:

```json
{
  "currentWeek": 975,
  "totalWeeks": 4160,
  "daysRemaining": 2,
  "yearProgress": 0.62,
  "recordedWeeks": 0,
  "commitment": "",
  "privacyMode": "privacy",
  "themeId": "observatory",
  "updatedAt": "2026-08-15T10:00:00Z"
}
```

The future location should follow the XDG state-directory convention instead
of assuming a Windows or hardcoded Linux path.

Updates occur when:

- the app starts;
- a review or daily note is saved;
- privacy or appearance settings change;
- the date or current week changes;
- the lightweight background process performs its periodic clock update.

## Transparency model

The application will use transparent HTML and window backgrounds. Hyprland,
not the web application, supplies the blur effect. Theme colors remain opaque
enough for text and editable sheets, while unused regions of the window reveal
the existing wallpaper.

Suggested defaults:

```text
Application canvas       55–70% opacity
Editing sheets           88–94% opacity
Capsule                   65–80% opacity
Grid elapsed cells       55–70% opacity
Grid future cells        20–40% opacity
Current week             95–100% opacity
```

The browser preview will approximate these values. Final tuning must happen on
the real compositor because Hyprland blur, wallpaper brightness, monitor
calibration, and terminal opacity all affect the result.

## Operating modes

The settings page will eventually offer:

- **Capsule** — recommended; only the small shell widget stays visible.
- **Hidden** — no persistent surface; open with a key binding.
- **Ambient grid** — optional layer behind normal windows for users who want
  the complete map on the desktop.

Ambient grid mode is explicitly optional. It will not be the default because
it can show through translucent terminals and overpower the existing rice.

## Startup and lifecycle

Only the lightweight capsule and data bridge should start with Hyprland. The
full webview window should be created or shown on demand.

Proposed sequence:

```text
Hyprland session starts
        ↓
Capsule starts
        ↓
Read last sanitized summary
        ↓
User clicks capsule or presses key binding
        ↓
Start/show Tauri app
        ↓
App refreshes summary and opens the map
```

The exact autostart configuration will be written for the Hyprland version
installed on the target machine rather than copied from an older configuration
format.

## ARM64 and packaging

The Linux target is Ubuntu ARM64 on a Snapdragon X Elite ThinkPad. The project
should therefore:

- avoid x86-only native dependencies;
- build and test the web application on ARM64 continuously;
- build the Tauri binary natively on Ubuntu ARM64 where possible;
- initially provide a `.deb` package and an unpackaged development binary;
- keep the Hyprland integration in a separate directory from shared React
  code;
- test fractional display scaling on the actual ThinkPad panel.

## Repository direction

The intended structure is:

```text
src/                         shared React application
src-tauri/                   native application wrapper
integrations/hyprland/
├── README.md
├── summary-schema.json
├── waybar/                  optional module
├── quickshell/              optional widget
└── config/                  version-specific rule templates
```

Only the integration matching the user's installed shell/bar should be built
out initially.

## Implementation phases

### Phase 1 — desktop-ready web interface

- Finish the centered responsive grid.
- Finalize themes, opacity tokens, and Privacy mode.
- Add a dedicated compact/capsule preview inside the web app.
- Keep all storage and calculations platform-independent.

### Phase 2 — Tauri application

- Add the Tauri wrapper without changing React behavior.
- Add a borderless Linux window configuration.
- Implement show, hide, close-to-capsule, and `Escape` behavior.
- Add local backup paths and the sanitized summary writer.

### Phase 3 — real Hyprland integration

- Inspect the installed Hyprland version and current rice.
- Identify Waybar, Quickshell, AGS, Eww, or another shell framework.
- Create the capsule using that framework.
- Add compositor blur, placement, animation, and screen-sharing rules.
- Add an application key binding and session startup.

### Phase 4 — ARM64 hardening

- Build on the actual Ubuntu ARM64 installation.
- Test sleep/wake, display scaling, multi-monitor behavior, and autostart.
- Measure idle CPU and memory use.
- Package a reproducible ARM64 beta.

## Decisions to make on the Linux machine

Before implementing the capsule, record:

1. Ubuntu version and Hyprland version.
2. Bar or shell framework in the rice.
3. Monitor resolution, scale, and refresh rate.
4. Whether the capsule should share the existing bar or float below it.
5. Whether opening the app should use the current workspace or a dedicated
   special workspace.
6. Whether the capsule should disappear when a fullscreen window is active.
7. Whether screen sharing should hide only journal text or the entire surface.

## Relevant platform references

- Hyprland window and layer rules:
  <https://wiki.hypr.land/Configuring/Basics/Window-Rules/>
- Wayland layer-shell protocol:
  <https://wayland.app/protocols/wlr-layer-shell-unstable-v1>
- Quickshell desktop-shell toolkit:
  <https://quickshell.outfoxxed.me/docs/about>
- Tauri window configuration:
  <https://v2.tauri.app/reference/config/>
