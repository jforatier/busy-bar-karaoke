# 10 — Quality

How the code is kept small and reviewable. The BUSY catalog runs automated checks and an AI review (on Anthropic models) on code, texts and images before a moderator decides; the contest jury scores code quality. Both read the repo cold, so it must explain itself.

## Code map

| Path | Role |
|---|---|
| `src/main.ts` | The app: front screens (song list, comet, giant words, finale), back screens (list, prompter, finale), input and flow |
| `src/display.ts` | The single display sender (only what changed, removed elements parked off-screen) and the element helpers |
| `src/timing.ts` | Pure timing maths (which line, syllable, word, comet position, count-in, back-display rows). No runtime import, so Node tests load it directly |
| `src/appmeta/` | Manifest, settings schema, icons |
| `shared/` | Thin typed wrappers over the device API (from the official template) |
| `scripts/` | Build-time tools: song generation (run by the build through `vite.config.mjs`), synth and its WAV preview, LRC parsing, line splitting, sync tool, changelog checker, the busy-cli patch |
| `scripts/*.test.mjs` | Unit tests (`node --test`) |
| `specs/ui-mockups/` | Design rounds drawn live on the bar from the PC, and the capture scripts |
| `.github/` | CI, release and Dependabot workflows; issue forms (bug, song, idea; blank issues off) and the pull request template |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | How to contribute (an issue first, the checks, the AI and song rules), conduct (Contributor Covenant 3.0), private vulnerability reports |
| `songs/` | Song sources (only public-domain songs are committed) |

## Conventions

- **TypeScript, strict**, the template's `tsconfig`. Logic that can be pure is pure and tested (`timing.ts`, `lrc.mjs`, `split.mjs`).
- **One display sender**: it keeps `id → last element sent`, sends only what changed, and parks removed elements off-screen. No other code calls `display/draw`.
- **Work at build time, not on the bar**: text widths, transliteration and timings are computed by `scripts/`, so the app carries no font maps and does no parsing.
- **Comments say why**, never what. A known limit is marked `shortcut: <limit>, <when to upgrade>`.
- **No dependency** beyond the BUSY toolchain and TypeScript. The synth is plain Node.
- Errors in build scripts name the song folder and the fix; the app shows a short message on the bar instead of failing silently (`Audio error`).

## Checks

Run before every commit; CI runs the same on each push and pull request:

```sh
npm test            # node --test: LRC parser, transliteration, splitting, synth, changelog, timing
npm run changelog   # CHANGELOG.md format, versions in sync
npm run build       # busy-cli build → dist/<id>.tgz; generates the songs first (vite.config.mjs)
npm run typecheck   # tsc, after the build (it imports the generated src/songs.gen.ts)
```

A check counts only if its own summary line was seen (test count, `Done → dist/…`).

## Versions and changelog

**[Semantic Versioning 2.0.0](https://semver.org/)**, like the platform (the manifest `version` and `api_version` are SemVer, and so are the official apps). For an app, the public interface is what the user sees and keeps:

| Bump | When | Examples |
|---|---|---|
| MAJOR | the user loses something | stored settings reset (`settings.json` `version` bumped), a setting or feature removed, a higher minimum firmware (`api_version`) |
| MINOR | the user gains something | new songs, a new display option, a new setting |
| PATCH | nothing visible changes but a fix | sync or display fix, performance, docs, dependencies |

`0.x` is pre-release; the first catalog release is `1.0.0`.

**[`CHANGELOG.md`](../CHANGELOG.md)** follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), with one addition: every release opens with **`### Highlights`**, 1–5 bullets written for users. Two readings come out of one file:
- **product view**: `node scripts/changelog.mjs notes <version> --highlights` → the catalog `changelog` field and the top of the GitHub release;
- **technical view**: the standard sections (Added, Changed, Deprecated, Removed, Fixed, Security) → the rest of the release notes.

Every change that matters lands in `## [Unreleased]` in the same commit. To release: rename `Unreleased` to `[x.y.z] - YYYY-MM-DD`, open a new empty `Unreleased`, set the same version in `src/appmeta/manifest.json` and `package.json`, commit, tag `x.y.z`, push the tag.

## CI/CD

| Workflow | When | What |
|---|---|---|
| `ci.yml` | every push to `main` and every pull request | `npm ci`, tests, changelog check, `npm audit` of runtime dependencies, `busy-cli build` alone (proves a clean clone builds), typecheck |
| `release.yml` | a tag `x.y.z` | checks tag = manifest = package version and the changelog section, builds, publishes a GitHub release with the `.tgz` and the changelog notes |
| `dependabot.yml` | weekly | one grouped PR for npm, one for GitHub Actions |

The catalog submission stays manual: a PR to busy-apps-catalog pointing at the tagged commit ([20](20-catalog.md)).

## What a reviewer sees first

Kept true at every release:
- [ ] README: what it is, a capture of the bar, how to build, controls, licence. No stale status.
- [ ] `LICENSE` (MIT), `package-lock.json`, `src/appmeta/manifest.json` with the final id.
- [ ] The repo builds from a clean clone with `npm ci && busy-cli build`, offline ([20](20-catalog.md)).
- [ ] No protected content, no secret, no personal data, no leftover debug code or commented-out blocks.
- [ ] Every spec matches the code (a changed behaviour changes its spec in the same commit).
- [ ] Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
