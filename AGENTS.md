# Strongly Living Weekly

## Product direction

This is a local-first life calendar and reflection dashboard. The portable React
application is the source of truth. Windows, Linux, Tauri, wallpaper, and GNOME
integrations must remain thin platform layers around the shared application.

## Architecture

- Keep date calculations in `src/core` as pure TypeScript.
- Represent journal dates as `YYYY-MM-DD` strings.
- Keep browser or operating-system APIs out of core calculations.
- Put persistence behind the storage module so localStorage can later be
  replaced by IndexedDB, SQLite, or synchronized cloud storage.
- Treat the ambient display as privacy-sensitive. Do not show reflection text
  there by default.
- Match filename and import casing exactly for Linux compatibility.

## Commands

- Install dependencies: `npm install`
- Start development: `npm run dev`
- Run tests: `npm test`
- Run lint: `npm run lint`
- Build production assets: `npm run build`

Before completing a change, run tests, lint, and the production build.
