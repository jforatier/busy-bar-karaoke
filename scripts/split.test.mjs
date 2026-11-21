import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLyrics, splitLine, timeParts, tapsFromParts } from './split.mjs';

test('tapsFromParts recovers the taps from the split screen lines', () => {
  const lines = ['aaaa bbbb cccc dddd eeee', 'ffff', '', 'gggg hhhh'];
  const taps = [1000, 3500, 5000, 7000];
  assert.deepEqual(tapsFromParts(lines, timeParts(lines, taps, w, 40), w, 40), taps);
});

const w = (s) => s.length * 4; // ~ the "small" font: 4 px per char

test('readLyrics drops blank lines and keeps ~ as a break', () => {
  assert.deepEqual(readLyrics('Un deux\r\n\r\nTrois\n\n~\n\nQuatre\n'), ['Un deux', 'Trois', '', 'Quatre']);
});

test('short lines stay whole', () => {
  assert.deepEqual(splitLine('Mon ami Pierrot,', w), ['Mon ami Pierrot,']); // 64 px
});

test('long lines split at spaces into balanced parts that fit', () => {
  const line = 'Frere Jacques, frere Jacques, dormez-vous? Dormez-vous?'; // 54 chars, 216 px
  const parts = splitLine(line, w);
  assert.equal(parts.join(' '), line);
  assert.ok(parts.every((p) => w(p) <= 70), parts.join(' | '));
  assert.ok(parts.length <= 4);
});

test('a single word wider than the screen is kept (it will scroll)', () => {
  assert.deepEqual(splitLine('Anticonstitutionnellement', w), ['Anticonstitutionnellement']);
});

test('parts are timed by characters between taps; the last line uses the median pace', () => {
  const lines = ['aaaa bbbb cccc dddd eeee', 'ffff', ''];
  const out = timeParts(lines, [1000, 3500, 5000], w, 40); // 24 chars over 2.5 s
  assert.deepEqual(out, [
    { t: 1000, text: 'aaaa bbbb' },
    { t: 2042, text: 'cccc dddd' },
    { t: 3083, text: 'eeee' },
    { t: 3500, text: 'ffff' },
    { t: 5000, text: '' },
  ]);
});
