// Builds the song catalogue: songs/<id>/ → src/sounds/<id>.snd + src/songs.gen.ts. User guide: docs/add-your-songs.md.
// Runs inside `busy-cli build` (vite.config.mjs), so a clean clone builds with no extra step; `npm run songs` runs it alone.
import { readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { registerFontMaps, textWidth } from '@busy-app/busy-lib';
import { small, bold } from '@busy-app/busy-lib/fonts';
import { parseLrc, toAscii } from './lrc.mjs';
import { findAudio } from './files.mjs';
import { render, lyricLines } from './synth.mjs';
import { splitLine } from './split.mjs';

// Text widths are measured here, with the bar's own font metrics, so the app does not carry font maps.
// Artists are drawn in `small`; titles and lyrics in `bold` (the largest font that leaves rows 0-5 free).
registerFontMaps(small);
registerFontMaps(bold);
const width = (text) => (text ? textWidth(text, 'small') : 0);
const lyricWidth = (text) => (text ? textWidth(text, 'bold') : 0);

// Paths from the repo root, whatever directory the build runs from.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SONGS_DIR = join(ROOT, 'songs');
const SOUNDS_DIR = join(ROOT, 'src/sounds');
const OUT = join(ROOT, 'src/songs.gen.ts');
const ARTIST_MAX_W = 54;
const BACK_W = 146; // the back display is 160 px wide, its right 12 px hold the system icons
const BYTES_PER_MS = 88.2; // 44 100 Hz × 2 bytes, mono
const MAX_BYTES = 100 * 1024 * 1024; // the package limit is 104 MB, keep room for the app

const songError = (id, message) => new Error(`songs: ${id ? `songs/${id}: ` : ''}${message}`);

function ascii(id, where, value) {
  const { text, unknown } = toAscii(value);
  if (unknown.length) console.warn(`songs: songs/${id}: ${where}: no ASCII for ${unknown.join(' ')} (shown as ?)`);
  return text;
}

function convert(id, src, dest) {
  const args = ['-v', 'error', '-y', '-i', src, '-ac', '1', '-af', 'loudnorm=I=-6:TP=-2',
    '-acodec', 'pcm_s16le', '-f', 's16le', '-ar', '44100', dest];
  const r = spawnSync('ffmpeg', args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.error?.code === 'ENOENT') {
    throw songError(id, 'ffmpeg not found. Install it (Windows: winget install ffmpeg, macOS: brew install ffmpeg) and retry.');
  }
  if (r.status !== 0) throw songError(id, `ffmpeg failed on ${src}`);
}

/**
 * Lyrics are sung, not read as prose: punctuation goes (it costs pixels and the music already gives the breaths);
 * apostrophes and hyphens stay, they belong to the words (n'ai, 'ncoppa, one-horse).
 */
const unpunctuate = (text) => text.replace(/[,.;:!?]/g, '').replace(/ {2,}/g, ' ');

/**
 * Syllable timing of a line, in the ASCII text the bar draws:
 * k = [t0, x0, t1, x1, …, end, w] (each syllable's start time and the bold width of the text before it, then the
 * end of its last note and the line's width), c = each syllable's first character.
 * A line without a score is one "syllable" from its time to the next line's.
 */
function syllables(line, w, nextT) {
  if (!line.syl) return { k: [line.t, 0, nextT, w], c: [0] };
  // Prefixes go through the same cleaning as the line: transliteration can change their length (œ → oe).
  const before = line.syl.map((s) => unpunctuate(toAscii(line.text.slice(0, s.i)).text));
  return {
    k: [...line.syl.flatMap((s, n) => [s.t, before[n] ? lyricWidth(before[n]) + 1 : 0]), line.end, w],
    c: before.map((b) => b.length),
  };
}

/**
 * Where a line wraps on the back display: [i1, x1, i2, x2, …] = first character and bold x of each row after the
 * first (balanced rows, at spaces). x is measured like k's, so a syllable starting a row has the same x.
 */
export function backRows(text, w = lyricWidth, max = BACK_W) {
  const r = [];
  let i = 0;
  for (const part of splitLine(text, w, max).slice(0, -1)) {
    i += part.length + 1;
    r.push(i, w(text.slice(0, i)) + 1);
  }
  return r;
}

function readJson(id, path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw songError(id, `${path.split(/[\\/]/).pop()} is not valid JSON (${e.message})`);
  }
}

/** Writes the audio of every song with timed lyrics, then the catalogue module. Throws on the first bad song. */
export function buildSongs() {
  rmSync(SOUNDS_DIR, { recursive: true, force: true });
  mkdirSync(SOUNDS_DIR, { recursive: true });

  const songs = [];
  let totalBytes = 0;
  const ids = readdirSync(SONGS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

  for (const id of ids) {
    const dir = join(SONGS_DIR, id);
    // Keeps sounds/<id>.snd within the 64-char audio path limit.
    if (!/^[a-z0-9-]{1,40}$/.test(id)) throw songError(id, 'folder name must be lowercase letters, digits and -, 40 chars max');

    // A score (bundled public-domain songs) carries its own lyrics, timed on its beats; any other song has a lyrics.lrc.
    const scorePath = join(dir, 'score.json');
    const score = existsSync(scorePath) ? readJson(id, scorePath) : null;
    const lrcPath = join(dir, 'lyrics.lrc');
    let lrc;
    if (score?.lyrics) {
      try {
        lrc = { lines: lyricLines(score), title: '', artist: '', offsetMs: 0 };
      } catch (e) {
        throw songError(id, `score.json: ${e.message}`);
      }
    } else if (existsSync(lrcPath)) {
      lrc = parseLrc(readFileSync(lrcPath, 'utf8'));
    } else {
      // A song still being prepared (no timed lyrics yet) must not block the others.
      console.warn(`songs: songs/${id}: skipped, no lyrics.lrc yet (write lyrics.txt, then npm run sync ${id})`);
      continue;
    }
    if (lrc.lines.length === 0) throw songError(id, 'no timed lyric line');

    const metaPath = join(dir, 'song.json');
    const meta = existsSync(metaPath) ? readJson(id, metaPath) : {};

    // A score is synthesized; any other song brings its own audio.
    const dest = join(SOUNDS_DIR, `${id}.snd`);
    if (score) {
      try {
        writeFileSync(dest, render(score));
      } catch (e) {
        throw songError(id, `score.json: ${e.message}`);
      }
    } else {
      const track = findAudio(dir);
      if (!track) throw songError(id, 'no audio: add the MP3 you downloaded (or any format ffmpeg reads)');
      // A .snd is already in the bar's format.
      if (/\.snd$/i.test(track)) copyFileSync(join(dir, track), dest);
      else convert(id, join(dir, track), dest);
    }

    const bytes = statSync(dest).size;
    totalBytes += bytes;
    const durationMs = Math.round(bytes / BYTES_PER_MS);
    const last = lrc.lines[lrc.lines.length - 1].t;
    if (last > durationMs) console.warn(`songs: songs/${id}: last lyric at ${last} ms is after the end of the audio (${durationMs} ms)`);

    // The count-in ticks on the song's beat (a dotted quarter in 6/8), every other beat when a beat is shorter than
    // 450 ms (a 3-2-1 in one second can't be read); 1 s when the tempo is unknown.
    const bpm = score?.bpm ?? (Number(meta.bpm) > 0 ? Number(meta.bpm) : 0);
    const beatMs = bpm > 0 ? (60000 / bpm) * (score?.meter === 6 ? 3 : 1) : 1000;
    const countMs = Math.round(beatMs < 450 ? beatMs * 2 : beatMs);
    const title = ascii(id, 'title', meta.title || lrc.title || id);
    const artist = ascii(id, 'artist', meta.artist || lrc.artist || '');
    // The song list puts the artist on the top line, left of the position ("4/4"): it must stop short of it.
    if (width(artist) > ARTIST_MAX_W) console.warn(`songs: songs/${id}: artist "${artist}" is ${width(artist)} px, over ${ARTIST_MAX_W}: shorten it in song.json`);
    songs.push({
      id,
      title,
      titleW: lyricWidth(title),
      artist,
      durationMs,
      offsetMs: (Number(meta.offsetMs) || 0) + lrc.offsetMs,
      countMs,
      lines: lrc.lines.map((l, i) => {
        const text = unpunctuate(ascii(id, `lyric line ${i + 1}`, l.text)).trim();
        const w = lyricWidth(text);
        return { t: l.t, text, w, ...(text ? syllables(l, w, lrc.lines[i + 1]?.t ?? durationMs) : { k: [], c: [] }), r: backRows(text) };
      }),
    });
    console.log(`songs: ${id} (${(durationMs / 1000).toFixed(1)} s, ${lrc.lines.length} lines)`);
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1);
  if (totalBytes > MAX_BYTES) throw songError(null, `${mb(totalBytes)} MB of audio, over the ${mb(MAX_BYTES)} MB budget. Remove a song from songs/.`);

  writeFileSync(OUT, `// Generated from songs/ by scripts/songs.mjs (run by the build and by \`npm run songs\`). Do not edit.
/**
 * t = start time (ms from audio start), w = width in px in the "bold" font,
 * k = syllables [t0, x0, t1, x1, …, end, w] (start time and x of each, then the end of the last note),
 * c = first character of each syllable in text,
 * r = rows after the first on the back display [i1, x1, …] (first character and bold x of each).
 */
export interface Line {
  t: number;
  text: string;
  w: number;
  k: number[];
  c: number[];
  r: number[];
}

export interface Song {
  id: string;
  title: string;
  titleW: number;
  artist: string;
  durationMs: number;
  offsetMs: number;
  /** One count of the 3-2-1 count-in, in ms (the song's beat). */
  countMs: number;
  lines: Line[];
}

export const SONGS: Song[] = ${JSON.stringify(songs, null, 2)};
`);
  console.log(`songs: ${songs.length} song(s), ${mb(totalBytes)} MB of audio → src/songs.gen.ts`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    buildSongs();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
