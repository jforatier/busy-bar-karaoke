import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, toAscii, lrcTime } from './lrc.mjs';

test('lrcTime formats and round-trips through parseLrc', () => {
  assert.equal(lrcTime(0), '[00:00.00]');
  assert.equal(lrcTime(21504), '[00:21.50]');
  assert.equal(lrcTime(288270), '[04:48.27]');
  assert.equal(parseLrc(`${lrcTime(83456)}x`).lines[0].t, 83460);
});

test('parses timestamps, sorts, keeps empty lines as gaps', () => {
  const { lines } = parseLrc('[00:12.40]B\r\n[00:01.5]A\n\n[01:02.123]\njunk line\n');
  assert.deepEqual(lines, [
    { t: 1500, text: 'A' },
    { t: 12400, text: 'B' },
    { t: 62123, text: '' },
  ]);
});

test('expands several timestamps on one line', () => {
  const { lines } = parseLrc('[00:10.00][01:20.00]Chorus');
  assert.deepEqual(lines.map((l) => [l.t, l.text]), [[10000, 'Chorus'], [80000, 'Chorus']]);
});

test('strips word-level tags', () => {
  assert.equal(parseLrc('[00:01.00]<00:01.00>Hel <00:01.50>lo').lines[0].text, 'Hel lo');
});

test('reads metadata; positive LRC offset means earlier', () => {
  const r = parseLrc('[ti:Song]\n[ar:Me]\n[offset:+250]\n[00:01.00]x');
  assert.equal(r.title, 'Song');
  assert.equal(r.artist, 'Me');
  assert.equal(r.offsetMs, -250);
});

test('accepts mm:ss:xx', () => {
  assert.equal(parseLrc('[00:02:50]x').lines[0].t, 2500);
});

test('transliterates French and typography to ASCII', () => {
  assert.deepEqual(toAscii('Prête-moi ta plume, écrire… « cœur » l’amour — Ça'), {
    text: 'Prete-moi ta plume, ecrire... " coeur " l\'amour - Ca',
    unknown: [],
  });
});

test('replaces unknown characters with ? and reports them', () => {
  assert.deepEqual(toAscii('ok ♪ 日'), { text: 'ok ? ?', unknown: ['♪', '日'] });
});
