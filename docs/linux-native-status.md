# Linux native beta status

## Implemented

- Tauri v2 shell with ARM64-native Rust target support
- stable application ID, binary name, main-window label, 16:10 minimum size,
  custom close action, transparent native canvas, and JetBrains Mono UI
- single-instance focus/show behavior for repeated `--show` launches
- platform adapter isolating browser downloads from native window and dialog APIs
- native JSON save dialog backed by a validated, atomic Rust write
- privacy-projected `stronglylivingweekly.summary.v1` generation
- Rust-side schema validation and mode-0600 atomic state writes
- DMS/Quickshell capsule that reads no private database or browser storage
- generated Linux application icon and Debian bundle target

## Validation commands

```bash
npm test
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri dev
npm run tauri build -- --bundles deb
```

The final three commands require the Ubuntu WebKitGTK development packages.

## First data transfer

1. Export JSON from the existing browser beta.
2. Start the native application and complete setup if necessary.
3. Import the JSON backup in Settings.
4. Compare weekly-entry and daily-note counts and spot-check three records.
5. Export a new JSON backup from the native save dialog.
6. Keep both backups until a future native-storage migration has been read back.

## Desktop summary boundary

The capsule may read only:

```text
$XDG_STATE_HOME/stronglylivingweekly/summary-v1.json
```

With an unset `XDG_STATE_HOME`, both writer and reader use
`~/.local/state/stronglylivingweekly/summary-v1.json`. Privacy mode forces both
commitment fields to `null`; no birthdate, journal narrative, rating, daily note,
backup path, or database identifier is serialized.
