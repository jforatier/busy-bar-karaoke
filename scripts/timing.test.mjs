import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineAt, lineEnd, shownLine, syllableAt, sungText, wordAt, cometAt, followShift, countIn, countInAhead, marqueeX, backRows } from '../src/timing.ts';

// "Dash|ing through": syllables at 1000, 1500, 2000 ms; x 0, 20, 34; last note ends at 2500; 60 px wide.
const dash = { t: 1000, text: 'Dashing through', w: 60, k: [1000, 0, 1500, 20, 2000, 34, 2500, 60], c: [0, 4, 8] };
const next = { t: 5000, text: 'the snow', w: 40, k: [5000, 0, 5500, 18, 6000, 40], c: [0, 4] };
const L = (t, text) => ({ t, text, w: text.length * 4, k: [t, 0, t + 1000, text.length * 4], c: [0] });
const lines = [L(4000, 'Au clair de la lune,'), L(8000, 'Mon ami Pierrot,'), L(12000, ''), L(20000, 'Prete-moi')];

test('lineAt finds the line whose time has come', () => {
  assert.equal(lineAt(lines, 0), -1);
  assert.equal(lineAt(lines, 4000), 0);
  assert.equal(lineAt(lines, 11999), 1);
  assert.equal(lineAt(lines, 99999), 3);
});

test('shownLine: a line shows up to the lead before its time, once the previous one is over', () => {
  const song = [dash, { t: 2500, text: '', w: 0, k: [], c: [] }, next];
  assert.equal(lineEnd(dash), 2500);
  assert.equal(shownLine(song, 0, 2500), 0); // the first line shows during the intro
  assert.equal(shownLine(song, 2400, 2500), 0);
  assert.equal(shownLine(song, 2499, 2500), 0);
  assert.equal(shownLine(song, 2500, 2500), 2); // the next line, 2.5 s ahead
  assert.equal(shownLine(song, 2000, 1000), 0);
  assert.equal(shownLine([dash, next], 3000, 1000), -1); // between lines, before the lead
  assert.equal(shownLine([dash, next], 9000, 1000), -1); // after the last line
});

test('syllables: the one being sung, and the text sung so far', () => {
  assert.equal(syllableAt(dash, 900), -1);
  assert.equal(syllableAt(dash, 1000), 0);
  assert.equal(syllableAt(dash, 1700), 1);
  assert.equal(syllableAt(dash, 9000), 2);
  assert.equal(sungText(dash, -1), '');
  assert.equal(sungText(dash, 0), 'Dash');
  assert.equal(sungText(dash, 1), 'Dashing'); // the trailing space is trimmed
  assert.equal(sungText(dash, 2), 'Dashing through');
  assert.equal(wordAt(dash, -1), 'Dashing');
  assert.equal(wordAt(dash, 1), 'Dashing');
  assert.equal(wordAt(dash, 2), 'through');
});

test('the comet lands on each syllable centre on its note and arcs in between', () => {
  // Centres: (0+20)/2 = 10, (20+34)/2 = 27, (34+60)/2 = 47.
  assert.deepEqual(cometAt(dash, 1000, 4, 3, 600), { x: 10, y: 4 });
  const mid = cometAt(dash, 1250, 4, 3, 600);
  assert.equal(mid.x, 18.5);
  assert.equal(mid.y, 1); // top of the arc: ground 4 - height 3
  assert.deepEqual(cometAt(dash, 2000, 4, 3, 600), { x: 47, y: 4 });
  assert.equal(cometAt(dash, 0, 4, 3, 600).x, -4); // waits off-screen left before hopping in
  assert.equal(cometAt(dash, 1000 - 300, 4, 3, 600).x, 3); // halfway in
});

test('marqueeX rests, slides a long title to its end, rests, starts over', () => {
  assert.equal(marqueeX(60, 5000), 1); // fits: never moves
  // 111 px: 40 px over, 1600 ms to slide at 25 px/s; cycle = 1200 + 1600 + 2000 = 4800 ms
  assert.equal(marqueeX(111, 0), 1);
  assert.equal(marqueeX(111, 1199), 1);
  assert.equal(marqueeX(111, 2000), -19);
  assert.equal(marqueeX(111, 3000), -39);
  assert.equal(marqueeX(111, 4799), -39);
  assert.equal(marqueeX(111, 4800), 1);
});

test('followShift keeps the focus near x 44, never past the line end', () => {
  assert.equal(followShift(60, 30), 0); // fits on screen
  assert.equal(followShift(100, 30), 0);
  assert.equal(followShift(100, 60), 16);
  assert.equal(followShift(100, 99), 30); // stops when the line end is on screen
});

test('countInAhead: waiting for a count-in that has not started', () => {
  assert.equal(countInAhead(lines, 500, 1000), true); // intro, 3.5 counts before the first line
  assert.equal(countInAhead(lines, 1000, 1000), false); // the count-in has started
  assert.equal(countInAhead(lines, 5000, 1000), false); // singing
  assert.equal(countInAhead(lines, 13000, 1000), true); // long gap before line 4
  assert.equal(countInAhead([L(2000, 'x')], 500, 1000), false); // intro too short for a count-in
});

test('countIn ticks on the song beat: 3-2-1 over the last three counts', () => {
  assert.equal(countIn(lines, 500, 1000), 0); // 3.5 counts left
  assert.equal(countIn(lines, 1000, 1000), 3);
  assert.equal(countIn(lines, 2500, 1000), 2);
  assert.equal(countIn(lines, 3999, 1000), 1);
  assert.equal(countIn(lines, 5000, 1000), 0); // singing
  assert.equal(countIn(lines, 17500, 1000), 3); // gap of 8 counts
  assert.equal(countIn([L(2000, 'x')], 1000, 1000), 0); // intro shorter than 3 counts
  assert.equal(countIn([L(3000, 'x')], 1000, 1000), 2); // an intro of exactly 3 counts gets its count-in
  assert.equal(countIn(lines, 4000 - 3 * 429, 429), 3); // 140 BPM
});

test('back display: a long line wraps at a space into balanced rows', async () => {
  const { backRows: wrap } = await import('./songs.mjs');
  const w4 = (t) => t.length * 4; // 4 px per character
  const text = 'Jingle bells jingle bells jingle all the way';
  assert.deepEqual(wrap('Dashing through', w4), []); // fits: one row
  const r = wrap(text, w4, 100);
  assert.deepEqual(r, [26, 105]); // balanced rows; x = width of the text before the row + 1, as in k
  const line = { t: 0, text, w: w4(text), k: [], c: [], r };
  const rows = backRows(line);
  assert.deepEqual(rows, [{ a: 0, b: 25, x: 0 }, { a: 26, b: text.length, x: 105 }]);
  assert.equal(text.slice(rows[0].a, rows[0].b), 'Jingle bells jingle bells');
  assert.deepEqual(backRows({ ...line, r: [] }), [{ a: 0, b: text.length, x: 0 }]);
});

test('giant words: a syllable sung across two words shows the word heard', () => {
  // "Ma chan-del-le est mor-te": "le est" is one note (elision).
  const line = { t: 0, text: 'Ma chandelle est morte', w: 0, k: [], c: [0, 3, 7, 10, 17, 20], r: [] };
  assert.equal(wordAt(line, 0), 'Ma');
  assert.equal(wordAt(line, 2), 'chandelle');
  assert.equal(wordAt(line, 3), 'est');
  assert.equal(wordAt(line, 4), 'morte');
  assert.equal(wordAt(line, 5), 'morte');
});
