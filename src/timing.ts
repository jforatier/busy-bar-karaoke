// Pure timing maths for the lyrics displays. No device calls here: tested by scripts/timing.test.mjs.
import type { Line } from "./songs.gen.ts";

/** Index of the line whose time has come (last line whose t <= e), or -1 before the first line. */
export function lineAt(lines: Line[], e: number): number {
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].t <= e) i++;
  return i;
}

/** End of a sung line: when its last note ends. */
export const lineEnd = (line: Line): number => line.k[line.k.length - 2];

/**
 * The sung line to show at e ms: from the end of the previous sung line (at most `leadMs` before its own time, so the
 * singer can read it), until its own end. -1 between lines.
 */
export function shownLine(lines: Line[], e: number, leadMs: number): number {
  let prevEnd = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text) continue;
    if (e < lineEnd(line)) return e >= Math.max(prevEnd, line.t - leadMs) ? i : -1;
    prevEnd = lineEnd(line);
  }
  return -1;
}

/** Index of the syllable being sung (-1 before the first one). */
export function syllableAt(line: Line, e: number): number {
  let j = -1;
  while (j + 1 < line.c.length && line.k[2 * (j + 1)] <= e) j++;
  return j;
}

/** The text sung so far: whole syllables, up to and including syllable j. */
export function sungText(line: Line, j: number): string {
  if (j < 0) return "";
  const to = j + 1 < line.c.length ? line.c[j + 1] : line.text.length;
  return line.text.slice(0, to).trimEnd();
}

/**
 * The word holding syllable j (j < 0: the first word). A syllable sung across two words (an elision: "le est" on one
 * note in "Ma chandelle est morte") shows the last word it starts, the one heard: the first one hid "est" entirely.
 */
export function wordAt(line: Line, j: number): string {
  let i = line.c[Math.max(0, j)] ?? 0;
  const next = line.c[Math.max(0, j) + 1] ?? line.text.length;
  const space = line.text.lastIndexOf(" ", next - 2); // the syllable's own trailing space is not a word start
  if (space >= i) i = space + 1;
  const start = line.text.lastIndexOf(" ", i - 1) + 1;
  const end = line.text.indexOf(" ", i);
  return line.text.slice(start, end < 0 ? undefined : end);
}

/** Centre x of each syllable, from its start to the next one's (or the line's end). */
function centres(line: Line): number[] {
  const n = line.c.length;
  const xs: number[] = [];
  for (let s = 0; s < n; s++) xs.push((line.k[2 * s + 1] + (s + 1 < n ? line.k[2 * s + 3] : line.w)) / 2);
  return xs;
}

/**
 * The comet, in line coordinates (x from the line's left edge, y = row): it lands on each syllable's centre on its
 * note, arcing `height` px between landings; before the first syllable it hops in from the left; on the last one it
 * bounces in place.
 */
export function cometAt(line: Line, e: number, ground: number, height: number, leadMs: number): { x: number; y: number } {
  const cx = centres(line);
  const j = syllableAt(line, e);
  const arc = (p: number, h: number) => ground - h * Math.sin(Math.PI * p);
  if (j < 0) {
    const start = line.k[0] - leadMs;
    const p = Math.min(1, Math.max(0, (e - start) / Math.max(1, line.k[0] - start)));
    return { x: -4 + (cx[0] + 4) * p, y: arc(p, height) };
  }
  if (j + 1 < cx.length) {
    const p = (e - line.k[2 * j]) / Math.max(1, line.k[2 * j + 2] - line.k[2 * j]);
    return { x: cx[j] + (cx[j + 1] - cx[j]) * p, y: arc(p, height) };
  }
  return { x: cx[j], y: arc(((e - line.k[2 * j]) / 300) % 1, 1) };
}

/** A line's rows on the back display: characters [a, b) and the bold x where the row starts in the line. */
export function backRows(line: Line): { a: number; b: number; x: number }[] {
  const starts = [0, 0, ...line.r];
  const rows: { a: number; b: number; x: number }[] = [];
  for (let n = 0; n < starts.length; n += 2) {
    const b = n + 2 < starts.length ? starts[n + 2] - 1 : line.text.length; // a row ends before the space
    rows.push({ a: starts[n], b, x: starts[n + 1] });
  }
  return rows;
}

/**
 * x of a title wider than the screen, moved by the app (the firmware's native scroll stops after a clockwise turn of
 * the wheel): rests at x 1, slides left at `pxPerMs` until its end shows, rests, starts over.
 */
export function marqueeX(width: number, ms: number, restMs = 1200, endMs = 2000, pxPerMs = 0.025): number {
  const over = width - 71;
  if (over <= 0) return 1;
  const move = over / pxPerMs;
  const p = ms % (restMs + move + endMs);
  if (p < restMs) return 1;
  return 1 - Math.round(Math.min(over, (p - restMs) * pxPerMs));
}

/** How far a line wider than the screen (70 px) slides left so that `focus` stays near x = 44. */
export function followShift(width: number, focus: number): number {
  return Math.round(Math.min(Math.max(0, width - 70), Math.max(0, focus - 44)));
}

/** True while waiting for a count-in that has not started yet (the gap before the next sung line is ≥ 3 counts). */
export function countInAhead(lines: Line[], e: number, unitMs: number): boolean {
  const i = lineAt(lines, e);
  if (i >= 0 && lines[i].text) return false;
  let j = i + 1;
  while (j < lines.length && !lines[j].text) j++;
  if (j >= lines.length) return false;
  const gapStart = i >= 0 ? lines[i].t : 0;
  return lines[j].t - gapStart >= 3 * unitMs && lines[j].t - e > 3 * unitMs;
}

/**
 * Count-in before a sung line: 3, 2, 1 on the last three counts (`unitMs` each, the song's beat) of the intro or of
 * an instrumental gap at least three counts long. Returns 0 when no count-in is due.
 */
export function countIn(lines: Line[], e: number, unitMs: number): number {
  const i = lineAt(lines, e);
  if (i >= 0 && lines[i].text) return 0; // a line is being sung
  let j = i + 1;
  while (j < lines.length && !lines[j].text) j++;
  if (j >= lines.length) return 0;
  const gapStart = i >= 0 ? lines[i].t : 0;
  const left = lines[j].t - e;
  if (lines[j].t - gapStart < 3 * unitMs || left > 3 * unitMs) return 0;
  return Math.ceil(left / unitMs);
}
