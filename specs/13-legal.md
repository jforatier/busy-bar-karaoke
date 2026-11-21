# 13 — Legal

Karaoke is a rights minefield: a song carries rights on the **composition** (melody), the **lyrics**, any **translation**, any **arrangement**, and each **recording**. This page says what Karaoke ships, why it is free to ship, and how to add your own songs without breaking anyone's rights.

*This is the project's own analysis, not legal advice. Copyright terms differ by country; when in doubt, don't ship the song.*

## What the repo and the published app contain

| Layer | What we ship | Why it is free |
|---|---|---|
| Composition and lyrics | Traditional songs and carols whose authors died long ago (list below) | In the public domain: the EU protects a work for 70 years after the author's death; in the US, works published in 1930 or earlier are public domain (as of 2026) |
| Translation | Only original-language texts, or translations whose translator died over 70 years ago | A translation is a new work with its own rights |
| Arrangement | Written by us, as note data in `songs/<id>/` | Our own work, MIT-licensed with the code |
| Recording | Synthesized at build time by `scripts/` | No sample, no third-party recording |

We write each score from the traditional melody itself, never by copying a modern published arrangement or edition (those can carry their own rights).

## Bundled songs

| Song | Authors | Status |
|---|---|---|
| *Au clair de la lune* | French traditional, 18th c. | Public domain |
| *Jingle Bells* (verse 1 and chorus) | James Lord Pierpont (1822–1893), published 1857 | Public domain |
| *We Wish You a Merry Christmas* (two verses) | English traditional | Public domain |
| *Silent Night* (verse 1, English words) | Franz Gruber (1787–1863), Joseph Mohr (1792–1848); English words John Freeman Young (1820–1885) | Public domain |
| *Funiculì, Funiculà* (chorus ×2, Neapolitan words) | Luigi Denza (1846–1922), words Peppino Turco (1846–1903), 1880 | Public domain |
| *La Cucaracha* (chorus ×2) | Mexican traditional, 19th c. | Public domain. We sing the original ending "las dos patitas de atrás": the best-known one, about marijuana, is a later substitution and not for a public catalog |
| *Can-Can* (*Galop infernal*, sung on "ta") | Jacques Offenbach (1819–1880), 1858; no original words, so the singer sings the notes | Public domain |

Melodies were checked against at least two public-domain melody transcriptions (ABC notation) before we wrote our own scores and chords.

Candidates (each checked again before it ships):

| Song | Authors | Status |
|---|---|---|
| *Deck the Halls* | Welsh traditional melody; English words Thomas Oliphant (1799–1880) | Public domain |
| *O Christmas Tree* | German traditional; words Ernst Anschütz (1780–1861) | Public domain |
| *Il est né le divin enfant* | French traditional, words published 1862 | Public domain |
| *Les anges dans nos campagnes* | French traditional, 18th c. | Public domain |

**Not now**: *Bella Ciao*. The tune is folk and the partisan words anonymous, published in the 1950s: likely free in the EU (70 years after publication of an anonymous work), less certain in the US (95 years for works published after 1929) and authorship has been claimed for some versions. The catalog is worldwide, so it waits for a proper check.

**Traps we deliberately avoid**: *Vive le vent* (French words by Francis Blanche, 1948), *Petit papa Noël* (1946), *White Christmas*, *Rudolph*, *Let It Snow*: all protected. A carol can be old while its popular French or English words are recent: check the words, not just the tune.

## Your own songs (private builds)

The app can play any song you add to `songs/` in your own build ([docs/add-your-songs.md](../docs/add-your-songs.md)):
- **Backing track**: buy it. Karaoke stores such as karaoke-version.com (French: version-karaoke.fr) sell instrumental versions for personal use, with a mixer that helps prepare a mix for the bar's small speaker. We only give guidance; nothing in the repo downloads anything.
- **Lyrics**: type or paste them yourself into `songs/<id>/lyrics.txt`; `npm run sync` times them by ear. Lyrics are protected like the music.
- **Keep it private**: `songs/*` is git-ignored except the bundled songs. Don't commit your songs, push them to a fork, or share a build (`.tgz`) that contains them.

## Forks and customisation

You are welcome to fork BB Karaoke (MIT). To publish a fork with other songs, either:
1. **write your own scores of public-domain songs** (`songs/<id>/`, synthesized like ours), after checking the rules above for each layer; or
2. **use songs you have a licence to distribute** (your own compositions, or tracks licensed for redistribution, e.g. under a Creative Commons licence that allows it: keep the attribution in the song folder and the README).

Changing the display needs no song at all: it is a setting, and OK switches it during a song.

## Code and assets

- Code, scores, synthesized tracks, icons: MIT, © Julien Foratier.
- Dependencies: `@busy-app/busy-lib` (MIT). Firmware fonts are drawn by the bar, not shipped.
- "BUSY" and "BUSY Bar" are trademarks of their owner; they are used only to say what the app runs on.

## Privacy

The app collects, stores and sends no personal data (see [11](11-security.md)): no privacy policy is needed for the catalog.
