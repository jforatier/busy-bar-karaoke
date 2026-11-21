# Changelog

All notable changes to BB Karaoke. The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning 2.0.0](https://semver.org/), as the BUSY Bar platform does (rules in [specs/10](specs/10-quality.md#versions-and-changelog)).

Each release opens with **Highlights**, written for people who use the app: they become the release notes in the BUSY Apps Catalog. The sections below them (Added, Changed, Deprecated, Removed, Fixed, Security) are the technical record.

## [Unreleased]

## [1.0.0] - 2026-11-25

### Highlights
- Sing along on your BUSY Bar: pick a song with the wheel, press Start, and follow the lyrics with a 3-2-1 count-in before each verse.
- Two displays driven by the music: a comet with a rainbow streak that lands on every syllable on its note, and giant words for a whole room. The count-in ticks on the beat in each display's own way, and a BRAVO! finale.
- Lyrics on both sides of the bar: the back display shows the verse like a prompter, the line being sung filling in white syllable by syllable, the next lines below, so people behind the bar can sing too. The song list shows there as well.
- Seven public-domain songs: Funiculì Funiculà, La Cucaracha and the Can-Can (sung on "ta") for parties, Jingle Bells, We Wish You a Merry Christmas and Silent Night for Christmas, and Au clair de la lune, all with backing tracks made by the app's own synthesizer.

### Added
- Song list, playback with wall-clock lyric sync (each frame computed for the moment it shows), volume on the wheel (silent, so the song keeps playing), BRAVO! finale.
- A display setting; OK switches it during a song. The lyric clock is calibrated on the bar (halfway through the play request).
- Build pipeline: LRC parser with ASCII transliteration, text widths measured at build time, line splitting, tap-to-sync tool.
- Bundled songs are written as scores (`songs/<id>/score.json`: tempo, meter, chords, melody, and lyrics split into syllables, one per note) and synthesized during `busy-cli build`, so a clean clone builds with no extra step.
- Specs for behaviour, design, platform, quality, security, performance, legal and catalog submission; catalog texts (`catalog.json`, `CATALOG.md`), screenshots and a README GIF captured in the official emulator.
- Back display (160×80): song list, prompter and a progress rule, count-in, finale; line wrap points measured at build time (`r` in `songs.gen.ts`).
- `npm run preview <song-id>` renders a score to a WAV file, to listen while writing it.
- `CHANGELOG.md` with a checker (`npm run changelog`) used by CI and the release workflow.

[Unreleased]: https://github.com/jforatier/busy-bar-karaoke/compare/1.0.0...HEAD
[1.0.0]: https://github.com/jforatier/busy-bar-karaoke/releases/tag/1.0.0
