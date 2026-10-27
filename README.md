# Strongly Living Weekly

A quiet, local-first 4,160-week map built around a deliberate weekly review.

## Current beta

- Fixed 4,160-week calendar anchored to the birthdate
- Full 80-column by 52-row desktop map
- Privacy and Personal display modes
- Monday-only reviews for the week that just ended
- Three-part weekly review: what happened, one 1-5 rating, and one commitment
- Clearly distinct on-time, missed, and retrospective weeks
- Optional same-day notes inside the current week
- "This week in previous years" when historical records exist
- Editable, overlapping colored life chapters and one-day milestones
- Rotating motivational strip that alternates a current commitment with quotes
- Previous-commitment reminder during the next weekly review
- Local version-two persistence with migration from the original beta
- Version-one and version-two JSON backup import
- Version-two JSON backup export including daily notes and life chapters

The passive view intentionally has no live clock. The native Linux build writes
a privacy-filtered desktop summary for the included DankMaterialShell capsule,
which owns live week rollover without keeping the WebKit view open.

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run lint
npm run build
```

## Architecture

```text
src/
|-- components/       Map, sheets, setup, and settings
|-- core/             Pure models and date/review calculations
|-- platform/         Browser and Tauri desktop adapters
|-- storage/          Local persistence, migration, and backups
|-- App.tsx           Application state and interaction modes
`-- App.css           16:10 passive and focused layouts

src-tauri/            ARM64-native shell, packaging, and secure summary writer
integrations/         Optional desktop-shell adapters
```

The React application remains platform-neutral. Tauri and desktop-environment
integrations consume the same core logic and privacy-filtered view model rather
than duplicating journal behavior.

## Linux desktop beta

The Tauri v2 application uses the stable identifier
`com.notananotheralt.stronglylivingweekly`, a single-instance native window,
native JSON export, and an atomic summary at
`$XDG_STATE_HOME/stronglylivingweekly/summary-v1.json` (with the standard
`~/.local/state` fallback). Private journal text and daily notes never enter the
summary.

After installing the Debian/Ubuntu Tauri prerequisites:

```bash
npm ci
npm test
npm run lint
npm run tauri dev
npm run tauri build -- --bundles deb
```

The first native milestone deliberately keeps WebKit `localStorage`; import a
browser JSON backup into the native app and export it again before any later
storage migration.

The supported Quickshell integration lives in
[`integrations/dank-material-shell/stronglyLivingWeekly`](integrations/dank-material-shell/stronglyLivingWeekly).
It validates the summary schema, derives week rollover, keeps the bar label
compact, and inherits the live Ricemood/DMS widget colors. The optional user
timer in [`integrations/systemd-user`](integrations/systemd-user) checks hourly
during waking hours on Mondays and sends privacy-safe reminders only while the
newly opened review remains incomplete. Clicking the capsule directly toggles
the full native map beneath the bar.

## Port documentation

The intended Hyprland architecture, Windows-side test options, remaining beta
work, and first Ubuntu ARM64 bring-up checklist are documented in
[`docs/ubuntu-hyprland-handoff.md`](docs/ubuntu-hyprland-handoff.md).

For the command-level port sequence, native file contracts, Tauri boundary,
version-sensitive Hyprland rule templates, packaging steps, and acceptance
matrix, use
[`docs/ubuntu-hyprland-port-runbook.md`](docs/ubuntu-hyprland-port-runbook.md).
