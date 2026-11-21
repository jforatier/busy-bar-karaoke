# 20 — Catalog and contest

How BB Karaoke gets into the [BUSY Apps Catalog](https://github.com/busy-app/busy-apps-catalog) and what the BUSY Bar Apps Hackathon asks.

Sources: the catalog's `CONTRIBUTING.md` and `TERMS.md`, the [official rules](https://busy.app/pages/terms-of-js-apps-contest) (updated 2026-11-13). Re-read them before submitting: they can change.

## Dates (contest)

| When (UTC) | What |
|---|---|
| 2026-11-13 → 12-07 23:59 | Entry period. The version judged is the one in the PR at the end |
| 2026-12-10 | The app must be **approved and published** to win or get the promo code |
| 2026-12-11 | Winners announced on Discord |

## How the catalog builds and checks an app

- Source in a **public GitHub repo**, pinned by a full 40-character `commit_sha`.
- Built by the catalog with `busy-cli build`, **without network or secrets**, after an npm install from the committed lockfile.
- Automated checks on every commit, an AI review of code, texts and images, then a human moderator.
- Each `.js` file ≤ 250 KiB, archive ≤ 100 MB.

## Submission checklist

| Item | State |
|---|---|
| Public repo `jforatier/busy-bar-karaoke` | to create |
| `LICENSE` (MIT, standard text) at the commit submitted | done |
| `package-lock.json` committed | done |
| `src/appmeta/manifest.json`: `format_version`, `id`, `name`, `version`, `api_version` | done, id `net.foratier.karaoke` |
| Icons 8×8 front, 11×11 back | done |
| Builds from a clean clone with `busy-cli build` alone | done: `vite.config.mjs` generates the songs during the build; checked on a scratch copy of the committable files and by CI |
| Tested on the latest release firmware or the emulator | done: firmware 1.4.1 on a real bar, and the official emulator (firmware 1.4.1, bar speed) |
| Screenshots: 1–10 PNG, 72×16 (+ optional back 160×80) | done: `screenshots/front-1.png` (cover: the comet) to `front-4.png` (giant word, song list, BRAVO), captured in the emulator; `back-1.png` (the prompter, the same moment as `front-1`) and `back-2.png` (the song list, as `front-3`), raw captures from the bar with its system icons. The catalog's norm: 3–5 front captures and 1–2 back ones, raw, icons included |
| `CHANGELOG.md` section `[1.0.0]` with Highlights; manifest and package at `1.0.0`; tag `1.0.0` | done (checker, tests, typecheck, audit and a clean-copy build green); tag at the release commit |
| Fork of the catalog with only `applications/net.foratier.karaoke/manifest.yml` added | at submission |

## Catalog texts and the emulator's check

The texts live in the repo: `catalog.json` (category, short description, changelog; the description points to `CATALOG.md`, written for the catalog's page). The emulator's `check` reads them with `screenshots/` and runs the catalog's 66 checks locally (some need the pushed repo). Its notes on the catalog's build: `npm ci` without install scripts, then `busy-cli build` alone, in a container without network.

## Draft `manifest.yml`

```yaml
sourcecode:
  type: git
  location:
    origin: https://github.com/jforatier/busy-bar-karaoke.git
    commit_sha: <40 chars>  # tag 1.0.0
category: music
short_description: Sing along on your BUSY Bar: synthesized backing tracks and lyrics in sync, with a count-in.
description: |
  <50–4000 chars: what it does, the songs included (all public domain), controls, settings, how to add your own songs in a private build.>
changelog: |  # the release's Highlights: node scripts/changelog.mjs notes 1.0.0 --highlights
  <user-facing bullets>
screenshots:
  - screenshots/front-1.png   # cover: the comet over "In a one-horse open sleigh"
  - screenshots/front-2.png   # giant words
  - screenshots/front-3.png   # song list
  - screenshots/front-4.png   # BRAVO finale
back_screenshots:
  - screenshots/back-1.png    # the prompter at the same moment as front-1
  - screenshots/back-2.png    # the song list
```

## Contest specifics

- Each app is a separate entry, in one category; one app wins at most one prize. Our category: **`music`**.
- In the PR template, tick the contest box (accepts the rules) and the authorship box.
- Criteria, unweighted: usefulness, originality, code quality, UX and ease of use, aesthetics. Judges: BUSY product, marketing, engineering and design staff. Likes and views don't count.
- Optional: a public post (link to busy.app, `#BUSYBarContest #ad`) linked in the PR by 2026-12-07 raises the promo code from 15 % to 25 % if the app doesn't win.
- Entering grants Flipper a broad non-exclusive licence on the app and its materials for the catalog and marketing; the code stays MIT and ours.
