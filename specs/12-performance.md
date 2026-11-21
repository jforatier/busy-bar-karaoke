# 12 — Performance

The bar runs JerryScript on a 128 KiB heap, redraws over a local HTTP call, and installs packages at ~160 KB/s over USB. These budgets keep the app smooth and quick to install.

## Budgets

| What | Budget | Measured | How |
|---|---|---|---|
| Heap | default 128 KiB (no `heap_size_kib`) | a 4:48 song with ~120 lines plays to the end, redrawing every tick | full run on the bar |
| Redraw | ≤ 1 draw in flight; only changed elements sent; 40 ms tick; frame built when sent | front comet: star + 6 streak segments + 2 texts; words: 1 text; back: only when the line, syllable, count-in or progress pixel changes | display sender in `display.ts` |
| Tick | 40 ms `setInterval`, frame recomputed from the clock | cheap when nothing changes | — |
| Frame cost on the bar | as little as possible per frame | building a frame of ~15 elements: 65–100 ms; a draw: 70–95 ms; both slower towards the end of a song | a localStorage probe over Silent Night |
| Lyric sync | line visible within ±100 ms of its timestamp | in sync by ear, stable from start to end; audio plays at its nominal rate (a 38.0 s file ends within 100 ms) | wall clock from `audio/play` + 150 ms draw lead |
| Package | ≤ 25 MB for the published build (bundled songs) | 21.3 MB with seven songs | `ls dist/*.tgz` |
| Install over USB | ≤ 2.5 min for the published build | 14.3 MB in 88 s; 27 MB in 165 s | stage + install API |

## Levers

- **Audio is the whole package.** `.snd` is raw 44.1 kHz PCM (5.3 MB/min) and barely compresses. Bundled songs are therefore short (one or two verses, ~1 min) and the published build holds a handful.
- **Build-time work**: widths, transliteration and timings are precomputed ([10](10-quality.md)); the app parses nothing.
- **Small moving parts**: the line is drawn once per syllable (its sung copy); only the star and its streak move every frame. Measured in the emulator at the bar's speed: about 15 distinct frames per second while the comet moves.
- **The back display is cached and still between syllables**: building and comparing all its elements on every frame would cut the frame rate to ~5/s, and any motion on the back (a comet) slows the front. Its text is rebuilt only when it changes and the sender skips elements passed again as the same object; its finale steps every 120 ms.
- **The front comet's streak is computed from the score** (6 samples of where the comet was over the last 260 ms), not from the frames shown, so it keeps its colours whatever the frame rate; more samples make the bar lag.
- `localStorage` is written once per song started (each write rewrites flash).
