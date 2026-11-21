import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { midi, chord, melody, layout, render, lyricLines, RATE } from './synth.mjs';

test('note names to MIDI', () => {
  assert.equal(midi('C4'), 60);
  assert.equal(midi('C5'), 72);
  assert.equal(midi('F#4'), 66);
  assert.equal(midi('Bb3'), 58);
  assert.throws(() => midi('H2'), /bad note/);
});

test('chords keep their root between G3 and F#4', () => {
  assert.deepEqual(chord('C'), [60, 64, 67]);
  assert.deepEqual(chord('G'), [55, 59, 62]);
  assert.deepEqual(chord('Dm'), [62, 65, 69]);
  assert.deepEqual(chord('G7'), [55, 59, 62, 65]);
  assert.deepEqual(chord('Bdim'), [59, 62, 65]);
  assert.throws(() => chord('Csus4'), /bad chord/);
});

test('melody tokens: default beat, durations, rests', () => {
  assert.deepEqual(melody('C5 D5:2 r:0.5'), [[72, 1], [74, 2], [null, 0.5]]);
  assert.throws(() => melody('C5:0'), /bad duration/);
});

test('layout checks the melody against the chords, pickup included', () => {
  const s = { bpm: 120, meter: 3, intro: ['C'], chords: ['C', 'G'], melody: 'G4 C5:3 D5:3' , pickup: 1 };
  assert.equal(layout(s).melodyStart, 2);
  assert.throws(() => layout({ ...s, pickup: 0 }), /melody lasts 7 beats, chords cover 6/);
});

test('the bundled sample renders to its expected length and level', () => {
  const score = JSON.parse(readFileSync('songs/au-clair-de-la-lune/score.json', 'utf8'));
  const pcm = render(score);
  assert.equal(pcm.length, 38 * RATE * 2); // 19 bars of 4 beats at 120 BPM = 38 s
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)));
  assert.equal(peak, Math.round(0.85 * 32767));
});

test('lyrics are timed on the score, pickup and intro included', () => {
  const s = { bpm: 120, meter: 3, intro: ['C'], chords: ['C', 'G'], melody: 'G4 C5:3 D5:3', pickup: 1, lyrics: [[0, 'We'], [1, 'wish'], [4, '']] };
  assert.deepEqual(lyricLines(s), [
    { t: 1000, text: 'We', syl: [{ t: 1000, i: 0 }], end: 1500 },
    { t: 1500, text: 'wish', syl: [{ t: 1500, i: 0 }], end: 3000 },
    { t: 3000, text: '', syl: [], end: 3000 },
  ]);
  assert.throws(() => lyricLines({ ...s, lyrics: [[1, 'a'], [1, 'b']] }), /increasing/);
  assert.throws(() => lyricLines({ ...s, lyrics: [[9, 'a']] }), /inside the song/);
});

test('syllables take one note each: | splits a word, _ joins words, ~ holds a note', () => {
  const s = { bpm: 60, meter: 4, chords: ['C', 'C'], melody: 'C5 D5 E5 F5 G5 A5 B5 C6' };
  const [line] = lyricLines({ ...s, lyrics: [[0, 'Si|lent night ~ le_est ~ a|b']] });
  assert.equal(line.text, 'Silent night le est ab');
  assert.deepEqual(line.syl.map((x) => [x.t, x.i]), [[0, 0], [1000, 2], [2000, 7], [4000, 13], [6000, 20], [7000, 21]]);
  assert.equal(line.end, 8000);
  assert.throws(() => lyricLines({ ...s, lyrics: [[0, 'too few']] }), /2 syllables for 8 notes/);
  assert.throws(() => lyricLines({ ...s, lyrics: [[0.5, 'x'], [1, '']] }), /no note starts/);
});

test('the bundled sample keeps its lyric timing (a line every 2 bars from 4 s)', () => {
  const score = JSON.parse(readFileSync('songs/au-clair-de-la-lune/score.json', 'utf8'));
  assert.deepEqual(lyricLines(score).map((l) => l.t), [4000, 8000, 12000, 16000, 20000, 24000, 28000, 32000, 36000]);
  // "Au clair de la lu|ne,": six syllables on the six notes of the first two bars.
  assert.deepEqual(lyricLines(score)[0].syl.map((x) => x.t), [4000, 4500, 5000, 5500, 6000, 7000]);
});
