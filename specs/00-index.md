# 00 — Index

> These specs describe **version 1.0.0** (2026-11-25), as it is: no history here. Changes are in [CHANGELOG.md](../CHANGELOG.md), the rest is in git.

## Product

BB Karaoke (`net.foratier.karaoke`) is an open-source JavaScript app for the [BUSY Bar](https://busy.app). It plays a backing track through the bar's speaker and shows the lyrics on the 72×16 front display, line by line, in sync, with a count-in before each verse. It ships with public-domain songs whose tracks are synthesized by this repo, and lets anyone add their own songs to a private build.

Goals, in order:
1. **Fun**: count-ins, colours, a song menu, a finale. A tiny karaoke machine, not a demo.
2. **Clean on rights**: the repo and the published app contain only public-domain songs, rendered by our own code ([13](13-legal.md)).
3. **Customizable**: two displays (a setting, or OK during a song); your own songs in your own build ([03](03-songs.md)).

It is entered in the BUSY Bar Apps Hackathon (Nov–Dec 2026), category Music ([20](20-catalog.md)).

## Spec map

| # | File | Content |
|---|---|---|
| **Product** | | |
| 01 | [01-behaviour.md](01-behaviour.md) | Screens, controls, settings, sync model |
| 02 | [02-design.md](02-design.md) | Visual intentions: grid, palette, motion, icon, sound |
| 03 | [03-songs.md](03-songs.md) | Song format, LRC lyrics, synth, `npm run songs`, size budget |
| **Platform** | | |
| 04 | [04-platform.md](04-platform.md) | BUSY Bar facts verified on a real bar (audio, display, input, limits, tooling) |
| **Cross-cutting** | | |
| 10 | [10-quality.md](10-quality.md) | Code conventions, tests, CI, what a reviewer checks |
| 11 | [11-security.md](11-security.md) | Trust boundaries, dependencies, audit log |
| 12 | [12-performance.md](12-performance.md) | Heap, redraw rate, package size, install time |
| 13 | [13-legal.md](13-legal.md) | Music and lyrics rights, licences, privacy |
| **Release** | | |
| 20 | [20-catalog.md](20-catalog.md) | BUSY Apps Catalog submission, contest checklist |

Also: [ui-mockups/](ui-mockups/) (screens captured on the bar, and the scripts that capture them) and the user guide [docs/add-your-songs.md](../docs/add-your-songs.md).

## Decisions

- **No protected music or lyrics in the repo.** User songs live in git-ignored folders.
- **Lyrics format: LRC** (`[mm:ss.xx] line`): the de-facto standard, writable by hand.
- **Songs are baked into the package at build time.** No runtime download: the firmware guidelines ask apps to package their assets. The 104 MB package limit caps how many songs one build holds ([03](03-songs.md)).
- **Tooling stays on Node** (the BUSY tools already need it). ffmpeg is the only external binary, and only for user songs.
- **Icon**: a thin microphone held diagonally like the 🎤 emoji, silver head, pink handle (8×8 front), plus an 11×11 grey version (back), in `src/appmeta/`.
- **Stack**: the official scaffold (`npm create @busy-app/app`), TypeScript, `@busy-app/busy-lib`, `busy-cli`. No firmware changes.
- **Names**: the project and its docs are **BB Karaoke** (repo `busy-bar-karaoke`); the app is named **Karaoke** on the bar and in the catalog, where the device goes without saying.
- **App id `net.foratier.karaoke`** (reverse domain of foratier.net, which the author owns; ids are never shown to users and can never change). The GitHub repo is `jforatier/busy-bar-karaoke`.
- **The published app bundles public-domain songs only**, Christmas carols included, with tracks synthesized by `scripts/` from scores we write. Bought tracks remain a private-build feature ([13](13-legal.md)).
- **Specs are public** and part of the repo: they document intent for reviewers, human or AI.
- **English-first repo.** README, specs and guide are in English.
