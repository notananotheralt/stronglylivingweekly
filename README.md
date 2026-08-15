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
- Commitment or user-saved quote strip
- Local version-two persistence with migration from the original beta
- Version-one and version-two JSON backup import
- Version-two JSON backup export including daily notes

The passive view intentionally has no live clock. It is designed to become the
source for a periodically generated desktop wallpaper, while the operating
system or a future lightweight widget owns live time.

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
|-- storage/          Local persistence, migration, and backups
|-- App.tsx           Application state and interaction modes
`-- App.css           16:10 passive and focused layouts
```

The React application remains platform-neutral. Future wallpaper, launcher,
Tauri, and desktop-environment integrations should consume the same core logic
and privacy-filtered view model rather than duplicating journal behavior.

## Linux handoff

The intended Hyprland architecture, Windows-side test options, remaining beta
work, and first Ubuntu ARM64 bring-up checklist are documented in
[`docs/ubuntu-hyprland-handoff.md`](docs/ubuntu-hyprland-handoff.md).

For the command-level port sequence, native file contracts, Tauri boundary,
version-sensitive Hyprland rule templates, packaging steps, and acceptance
matrix, use
[`docs/ubuntu-hyprland-port-runbook.md`](docs/ubuntu-hyprland-port-runbook.md).
