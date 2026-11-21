# Contributing to BB Karaoke

Thanks for wanting to help. BB Karaoke is a small app kept by a single maintainer, so the rules below keep things simple for you and reviewable for us.

> **Contest freeze.** The app is entered in the BUSY Bar Apps Contest, whose rules require the entry to be the author's own work. Until the results are announced (mid-December 2026), **issues are welcome but pull requests from outside are not merged**. Open an issue; it will be picked up after the contest.

## What helps most

| Welcome | Please don't |
|---|---|
| Bug reports with steps and a capture ([bug form](https://github.com/jforatier/busy-bar-karaoke/issues/new?template=bug.yml)) | Songs that are still protected, even "just the chorus" or re-synthesized: see [specs/13](specs/13-legal.md) |
| **Public-domain songs** as scores, with proof of their status ([song form](https://github.com/jforatier/busy-bar-karaoke/issues/new?template=song.yml)) | Pull requests with no issue agreed first (typo fixes excepted) |
| Fixes to timing, display or docs | Reformatting, renames or refactors nobody asked for |
| Ideas that fit the app ([idea form](https://github.com/jforatier/busy-bar-karaoke/issues/new?template=idea.yml)) | Features that need a firmware change ([AGENTS.md](AGENTS.md)) |

Questions about the BUSY Bar itself (setup, firmware, the catalog) belong to [BUSY](https://busy.app), not here.

## How a change gets in

1. **Open an issue first** and wait for a go. It saves you work on something that would not be merged.
2. Fork, branch from `main`, keep the change to that one issue.
3. Run the checks below; all must pass.
4. Open the pull request with the template filled in. Small and focused beats big and complete.

Pull requests are squash-merged. A pull request without an agreed issue, without the checks, or that ignores the template may be closed without review.

## Set up and check

Node **24** (`.nvmrc`; Node 26 breaks the BUSY tools). On Windows, use PowerShell or cmd, not Git Bash. Then:

```sh
npm ci
npm test            # unit tests (node --test)
npm run changelog   # CHANGELOG.md format and versions
npm run build       # busy-cli build: generates the songs, then the package
npm run typecheck   # after the build, which generates src/songs.gen.ts
```

Test what you changed **on a BUSY Bar or in the official [emulator](https://github.com/busy-app/busybar-emulator)** (the emulator has no sound), and attach a capture of the screen to the pull request ([README](README.md#quick-start) shows how to install).

## What a good change includes

- **Specs updated** in the same change when behaviour changes: [specs/](specs/00-index.md) describe the app as it is.
- **A line in `CHANGELOG.md`** under `## [Unreleased]` for anything a user would notice (Keep a Changelog sections; a user-facing line under `### Highlights` if it matters to them).
- **Code that matches its surroundings**: TypeScript, small functions, a comment only for the *why*. Pure logic goes in `src/timing.ts` with a test in `scripts/timing.test.mjs`.
- **Display text in ASCII**: the bar's fonts have no accents; the build transliterates lyrics.

## Adding a song

Only songs whose **melody and words** are in the public domain in both the EU (author died more than 70 years ago) and the US (published 1930 or earlier, in 2026), or released under a licence that allows redistribution and adaptation. Translations count as separate works. The checks and the traps are in [specs/13](specs/13-legal.md); the score format is in [specs/03](specs/03-songs.md#scores).

A song pull request adds `songs/<id>/score.json` and `song.json`, a line in specs/13 with the authors' dates and the melody source, and a changelog line. Listen to it with `npm run preview <id>` before opening it.

## AI tools

AI assistants are welcome, on these terms:

- **You are the author.** You understand every line, you ran the checks and tested on a bar or the emulator yourself, and you can answer review questions without asking the tool.
- **Say so** in the pull request (the template has a box): which tool, and for what.
- **No unattended agents.** Pull requests opened by an agent on its own, or generated in bulk, are closed.
- Agents working in this repo follow [AGENTS.md](AGENTS.md) (platform rules) and this file.

## Licence

By contributing, you agree that your contribution is released under the project's [MIT licence](LICENSE), and that you have the right to submit it (your own work, or public domain with its source).

## Conduct

Be kind and specific. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues are reported privately: see [SECURITY.md](SECURITY.md).
