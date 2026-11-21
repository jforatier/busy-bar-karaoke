// Chiptune synth for the bundled public-domain songs: songs/<id>/score.json → .snd (raw PCM s16le mono 44.1 kHz).
// Score format and arrangement rules: specs/03-songs.md#scores. Pure: no file access.

export const RATE = 44100;
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C5" → 72, "F#4" → 66, "Bb3" → 58 (MIDI numbers, C4 = 60). */
export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}" (e.g. C5, F#4, Bb3)`);
  return NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}

/** "C" / "Dm" / "G7" / "Bdim" → triad (+ seventh) with the root between G3 and F#4, so the accompaniment stays low and steady. */
export function chord(name) {
  const m = /^([A-G][#b]?)(m|7|m7|maj7|dim)?$/.exec(name);
  if (!m) throw new Error(`bad chord "${name}" (e.g. C, Dm, G7, Bdim)`);
  let root = midi(`${m[1]}4`);
  if (root > 66) root -= 12;
  const q = m[2] ?? '';
  const third = q.startsWith('m') && q !== 'maj7' || q === 'dim' ? 3 : 4;
  const fifth = q === 'dim' ? 6 : 7;
  const notes = [root, root + third, root + fifth];
  if (q.endsWith('7')) notes.push(root + (q === 'maj7' ? 11 : 10));
  return notes;
}

/** "C5 D5:2 r:0.5 E5:1.5" → [[72, 1], [74, 2], [null, 0.5], [76, 1.5]] (beats default to 1, r = rest). */
export function melody(text) {
  return text.trim().split(/\s+/).map((tok) => {
    const [n, b = '1'] = tok.split(':');
    const beats = Number(b);
    if (!(beats > 0)) throw new Error(`bad duration in "${tok}"`);
    return [n === 'r' ? null : midi(n), beats];
  });
}

/**
 * Score → timing facts, without rendering: where the melody starts and how long the song lasts, in beats.
 * score = { bpm, meter, intro: [chords], chords: [one per bar], outro: [chords], melody, pickup? }
 */
export function layout(score) {
  const { bpm, meter = 4, intro = [], chords, outro = [], pickup = 0 } = score;
  if (!(bpm > 0) || ![2, 3, 4, 6].includes(meter) || !Array.isArray(chords) || !chords.length) {
    throw new Error('score needs bpm > 0, meter 2/3/4/6 and at least one bar in "chords"');
  }
  const notes = melody(score.melody);
  const melodyStart = intro.length * meter - pickup;
  const melodyBeats = notes.reduce((s, [, b]) => s + b, 0);
  const bodyBeats = chords.length * meter;
  if (melodyBeats !== bodyBeats + pickup) {
    throw new Error(`melody lasts ${melodyBeats} beats, chords cover ${bodyBeats + pickup} (pickup included)`);
  }
  const bars = [...intro, ...chords, ...outro];
  return { notes, bars, meter, beatSec: 60 / bpm, melodyStart, totalBeats: bars.length * meter };
}

/**
 * Lyrics timed note by note. score.lyrics = [[beat, "Dash|ing through the snow"], …]: the beat is counted from the first
 * melody note (0 = the pickup, or bar 1); spaces split words, "|" splits syllables inside a word, "_" is a space inside
 * one syllable (an elision: "le_est"), and a lone "~" holds the previous syllable over one more note. Each syllable takes
 * the next note from the line's beat, rests skipped, and a line must use exactly the notes before the next line.
 * → [{ t, text, syl: [{ t, i }], end }] in ms from the start of the audio; i = the syllable's first character in text.
 * An empty text marks a gap or the end.
 */
export function lyricLines(score) {
  const { notes, beatSec, melodyStart, totalBeats } = layout(score);
  const ms = (beat) => Math.round((melodyStart + beat) * beatSec * 1000);
  const sung = [];
  let at = 0;
  for (const [m, b] of notes) {
    if (m !== null) sung.push({ at, b });
    at += b;
  }
  const entries = score.lyrics ?? [];
  return entries.map(([beat, raw], k) => {
    const next = k + 1 < entries.length ? entries[k + 1][0] : Infinity;
    if (!(beat >= 0) || next <= beat || melodyStart + beat >= totalBeats) {
      throw new Error(`lyrics: beat ${beat} must be ≥ 0, increasing, and inside the song`);
    }
    const words = raw.trim() ? raw.trim().split(/\s+/) : [];
    if (!words.length) return { t: ms(beat), text: '', syl: [], end: ms(beat) };
    const own = sung.filter((n) => n.at >= beat && n.at < next);
    if (own[0]?.at !== beat) throw new Error(`lyrics: "${raw}" starts at beat ${beat}, where no note starts`);
    let text = '';
    let used = 0;
    const syl = [];
    for (const w of words) {
      if (w === '~') {
        used++;
        continue;
      }
      if (text) text += ' ';
      for (const part of w.split('|')) {
        if (used < own.length) syl.push({ t: ms(own[used].at), i: text.length });
        text += part.replace(/_/g, ' ');
        used++;
      }
    }
    if (used !== own.length) throw new Error(`lyrics: "${raw}" has ${used} syllables for ${own.length} notes`);
    const last = own[own.length - 1];
    return { t: ms(beat), text, syl, end: ms(last.at + last.b) };
  });
}

const freq = (m) => 440 * 2 ** ((m - 69) / 12);
const square = (p) => (p % 1 < 0.25 ? 1 : -1); // 25 % duty: bright, carries on the small speaker
const triangle = (p) => 4 * Math.abs((p % 1) - 0.5) - 1; // soft, for the accompaniment

/** Renders a score to the bar's .snd format (Buffer). Melody one octave up as written in the score. */
export function render(score) {
  const { notes, bars, meter, beatSec, melodyStart, totalBeats } = layout(score);
  const mix = new Float32Array(Math.ceil(totalBeats * beatSec * RATE));

  const note = (m, startBeat, beats, wave, gain) => {
    const start = Math.round(startBeat * beatSec * RATE);
    const len = Math.round(beats * beatSec * RATE * 0.9); // 10 % gap so repeated notes stay distinct
    const f = freq(m) / RATE;
    for (let i = 0; i < len && start + i < mix.length; i++) {
      const env = Math.min(1, i / 220) * (0.6 + 0.4 * Math.exp(-i / 3500)) * Math.min(1, (len - i) / 1800);
      mix[start + i] += wave(i * f) * env * gain;
    }
  };

  let beat = melodyStart;
  for (const [m, b] of notes) {
    if (m !== null) note(m, beat, b, square, 0.45);
    beat += b;
  }

  // Oom-pah: the root on strong beats, the rest of the chord on the others; the last bar holds its chord.
  const strong = meter % 3 === 0 ? 3 : 2;
  bars.forEach((name, bar) => {
    const c = chord(name);
    if (bar === bars.length - 1) return c.forEach((m) => note(m, bar * meter, meter, triangle, 0.2));
    for (let k = 0; k < meter; k++) {
      for (const m of k % strong === 0 ? [c[0]] : c.slice(1)) note(m, bar * meter + k, 1, triangle, 0.25);
    }
  });

  const peak = mix.reduce((p, v) => Math.max(p, Math.abs(v)), 0) || 1;
  const pcm = Buffer.alloc(mix.length * 2);
  mix.forEach((v, i) => pcm.writeInt16LE(Math.round((v / peak) * 0.85 * 32767), i * 2));
  return pcm;
}
