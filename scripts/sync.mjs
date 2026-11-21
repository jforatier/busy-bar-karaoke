// Tap-along lyric timing: npm run sync <song-id>
// Plays songs/<id>/ audio on the PC; press Enter when each sung line of lyrics.txt starts → writes lyrics.lrc,
// with long lines split into screen-sized parts timed in between.
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { registerFontMaps, textWidth } from '@busy-app/busy-lib';
import { small } from '@busy-app/busy-lib/fonts';
import { lrcTime, toAscii } from './lrc.mjs';
import { findAudio } from './files.mjs';
import { readLyrics, timeParts, tapsFromParts } from './split.mjs';
import { parseLrc } from './lrc.mjs';

registerFontMaps(small);
const width = (text) => textWidth(toAscii(text).text, 'small');
/** Taps closer than this are ignored: a held key auto-repeats every ~30-130 ms. */
const DEBOUNCE_MS = 300;
/** On resume, the music restarts this long before the last kept line. */
const LEAD_IN_MS = 3000;

const id = process.argv[2];
const keepAt = process.argv.indexOf('--keep');
const keep = keepAt > 0 ? Number(process.argv[keepAt + 1]) : 0;
const dir = join('songs', id ?? '');
const die = (msg) => {
  console.error(`sync: ${msg}`);
  process.exit(1);
};

if (!id || !existsSync(dir)) die('usage: npm run sync <song-id> [-- --keep N]   (a folder in songs/; --keep N resumes after the first N lines of the current lyrics.lrc)');
if (keepAt > 0 && !(Number.isInteger(keep) && keep > 0)) die('--keep needs a number of lines, e.g. --keep 18');
const txt = join(dir, 'lyrics.txt');
if (!existsSync(txt)) die(`write ${txt} first: the lyrics, one sung line per line (paste them as they are), "~" alone on a line for an instrumental break.`);
const audio = findAudio(dir);
if (!audio || /\.snd$/i.test(audio)) die(`no MP3 (or other audio file) in ${dir}`);
if (!process.stdin.isTTY) die('run it in a terminal (it reads single key presses)');

const lines = readLyrics(readFileSync(txt, 'utf8'));
if (!lines.length) die(`${txt} is empty`);
let marks = [];
if (keep) {
  const lrc = join(dir, 'lyrics.lrc');
  if (!existsSync(lrc)) die(`--keep needs an existing ${lrc}`);
  marks = tapsFromParts(lines, parseLrc(readFileSync(lrc, 'utf8')).lines, width).slice(0, keep);
  if (marks.length < keep) die(`${lrc} only has ${marks.length} timed lines (did lyrics.txt change since?)`);
}
const startMs = keep ? Math.max(0, marks[keep - 1] - LEAD_IN_MS) : 0;

const show = () => {
  const next = lines[marks.length];
  const label = next === undefined ? '(all lines timed: press q to save)' : next || '~ instrumental break ~';
  process.stdout.write(`\r\x1b[K${marks.length}/${lines.length}  next ▶ ${label}`);
};

function save() {
  const lrc = join(dir, 'lyrics.lrc');
  if (existsSync(lrc)) copyFileSync(lrc, lrc + '.bak');
  const parts = timeParts(lines, marks, width);
  writeFileSync(lrc, parts.map((p) => `${lrcTime(p.t)}${p.text}`).join('\n') + '\n');
  console.log(`\nsync: ${marks.length}/${lines.length} lines timed, ${parts.length} screen lines → ${lrc}${existsSync(lrc + '.bak') ? ' (previous one in lyrics.lrc.bak)' : ''}`);
  if (marks.length < lines.length) console.log('sync: not all lines are timed: run it again, or finish lyrics.lrc by hand.');
}

console.log(`sync: ${audio}\n  Enter/Space = this line starts now (one short press, don't hold)   Backspace = undo   q = stop and save\n  Tip: tap at the first syllable, a hair early rather than late.`);
if (keep) console.log(`  Resuming: ${keep} lines kept, the music restarts at ${lrcTime(startMs)}.`);
console.log('  Press Enter to start the music.');

let player;
let t0 = 0;
process.stdin.setRawMode(true);
process.stdin.on('data', (buf) => {
  const key = buf.toString();
  if (key === '\u0003' || key === 'q') {
    player?.kill();
    if (player) save();
    process.exit(0);
  }
  if (!player) {
    if (key !== '\r') return;
    const seek = startMs ? ['-ss', String(startMs / 1000)] : [];
    player = spawn('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', ...seek, join(dir, audio)], { stdio: 'ignore' });
    player.on('error', () => die('ffplay not found: it comes with ffmpeg (winget install ffmpeg / brew install ffmpeg)'));
    player.on('exit', () => {
      save();
      process.exit(0);
    });
    t0 = Date.now() - startMs; // song time = Date.now() - t0
    show();
    return;
  }
  const now = Date.now() - t0;
  // A chunk can hold several repeated keys: look at the first one only.
  const k = key[0];
  if ((k === '\r' || k === ' ') && marks.length < lines.length) {
    if (!marks.length || now - marks[marks.length - 1] >= DEBOUNCE_MS) marks.push(now);
  } else if ((k === '\b' || k === '\x7f') && marks.length > keep) marks.pop();
  show();
});
