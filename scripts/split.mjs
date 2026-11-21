// Turns lyrics as pasted (one sung line per line, any length) into screen lines that fit the bar.

/** Lyrics text → sung lines. Blank lines are ignored (pasted lyrics are full of them); a line "~" marks an instrumental break (""). */
export function readLyrics(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => (l === '~' ? '' : l));
}

/** Splits a line at spaces into balanced parts no wider than `max` px (a single longer word stays whole and scrolls). */
export function splitLine(text, width, max = 70) {
  if (!text || width(text) <= max) return [text];
  const n = Math.ceil(width(text) / max);
  const target = width(text) / n;
  const parts = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && (width(next) > max || width(next) > target * 1.2)) {
      parts.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

/** Recovers the tap times (first part of each sung line) from screen lines written by timeParts, to resume a sync. */
export function tapsFromParts(lines, parts, width, max = 70) {
  const taps = [];
  let k = 0;
  for (const line of lines) {
    if (k >= parts.length) break;
    taps.push(parts[k].t);
    k += splitLine(line, width, max).length;
  }
  return taps;
}

/**
 * Sung lines + one tap time per line (ms) → timed screen lines.
 * Each part of a split line starts at a time interpolated by characters between its tap and the next one.
 * The last line, with no next tap, uses the song's median ms per character.
 */
export function timeParts(lines, taps, width, max = 70) {
  const perChar = [];
  for (let i = 0; i + 1 < taps.length; i++) if (lines[i]) perChar.push((taps[i + 1] - taps[i]) / lines[i].length);
  perChar.sort((a, b) => a - b);
  const median = perChar.length ? perChar[perChar.length >> 1] : 80;
  const out = [];
  taps.forEach((t, i) => {
    const parts = splitLine(lines[i], width, max);
    const total = lines[i].length || 1;
    const span = i + 1 < taps.length ? taps[i + 1] - t : total * median;
    let done = 0;
    for (const p of parts) {
      out.push({ t: Math.round(t + (span * done) / total), text: p });
      done += p.length + 1;
    }
  });
  return out;
}
