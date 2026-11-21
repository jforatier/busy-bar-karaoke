# 11 — Security

What protects the app and its users today.

## Trust boundaries

- **On the bar**, the app talks only to the bar's own local API (`localhost`): `display/draw`, `audio/play`, `audio/volume`, `apps/settings` (read). It makes **no network request**, holds no account, key or token, and collects nothing.
- **Stored data**: one `localStorage` key, `song` (the id of the last song played). Nothing personal.
- **Settings** come from the BUSY app/web UI and are validated by the firmware against `appmeta/settings.json` (enum, integer ranges, colours). The app still clamps the offset and falls back to defaults when a value is missing.
- **Build-time input**: the files in `songs/` (LRC, `song.json`, audio) are read by `scripts/` on the developer's own machine. The parser rejects invalid `song.json`, invalid folder ids (`^[a-z0-9-]{1,40}$`, used in paths) and non-ASCII it cannot transliterate; ffmpeg is called with an argument array, never through a shell string.
- **The build runs our own code**: `vite.config.mjs` calls `scripts/songs.mjs` before bundling. On a clean clone it only reads the committed `songs/` and synthesizes the scores in pure Node: no network, no external binary (ffmpeg is spawned only for a user's own audio files).
- **Audio paths** sent to the bar are built from validated song ids and stay under the 64-character limit; the firmware also refuses `../`.

## Supply chain

- Runtime dependency: `@busy-app/busy-lib` (MIT, official). Dev: `@busy-app/cli`, `typescript`, `vite` (pinned by the official template). Lockfile committed; CI uses `npm ci`.
- `postinstall` runs `scripts/patch-busy-cli.mjs`: it rewrites one line of `@busy-app/cli` to fix a Windows path bug, does nothing when the line is absent, and touches no other file. To be removed once fixed upstream.
- The catalog builds the package itself from the public source at a pinned commit, without network or secrets.

## Accepted risks

- `npm audit` reports `vite` 8.1.4 (high, `launch-editor` advisories). It only affects Vite's **dev server**, which this project never runs (`busy-cli build` only); nothing of Vite ships in the package. Upgrade when `@busy-app/cli` accepts a fixed Vite.

## Last audit

2026-11-25, version 1.0.0: `npm audit --omit=dev` 0 vulnerabilities (nothing that ships); the full audit only reports Vite's dev server (see above). `npm outdated`: typescript 7.0.2 and vite 8.3.8 available, the template pins 6.0.3 and 8.1.4. No network code, no secrets in the tree. Earlier audits are in git.
