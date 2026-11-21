// LRC lyrics parsing and ASCII transliteration (the bar's fonts are ASCII-only). Format: docs/add-your-songs.md.

const TIME_TAG = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g;
const META_TAG = /^\[(ti|ar|offset):(.*)\]$/i;

/**
 * Parses LRC text.
 * Returns { lines: [{ t, text }], title, artist, offsetMs }, with lines sorted by t (ms).
 * offsetMs follows our sync model (negative = earlier), so the LRC `[offset:+n]` (n ms earlier) is negated.
 */
export function parseLrc(source) {
  const lines = [];
  const meta = { title: '', artist: '', offsetMs: 0 };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const m = META_TAG.exec(line);
    if (m) {
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (key === 'ti') meta.title = value;
      else if (key === 'ar') meta.artist = value;
      else meta.offsetMs = -(parseInt(value, 10) || 0);
      continue;
    }
    const times = [];
    let rest = line;
    for (let t; (t = /^\[(\d+):(\d+(?:[.:]\d+)?)\]/.exec(rest)); rest = rest.slice(t[0].length)) {
      times.push(Math.round((Number(t[1]) * 60 + Number(t[2].replace(':', '.'))) * 1000));
    }
    if (times.length === 0) continue;
    // Word-level timing tags (<mm:ss.xx>) are not used in v1.
    const text = rest.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').replace(TIME_TAG, '').trim();
    for (const t of times) lines.push({ t, text });
  }
  lines.sort((a, b) => a.t - b.t);
  return { lines, ...meta };
}

/** ms → "[mm:ss.xx]" */
export function lrcTime(ms) {
  const cs = Math.max(0, Math.round(ms / 10));
  const mm = String(Math.floor(cs / 6000)).padStart(2, '0');
  const ss = String(Math.floor((cs % 6000) / 100)).padStart(2, '0');
  return `[${mm}:${ss}.${String(cs % 100).padStart(2, '0')}]`;
}

const MAP = {
  'œ': 'oe', 'Œ': 'OE', 'æ': 'ae', 'Æ': 'AE', 'ß': 'ss', 'ø': 'o', 'Ø': 'O', 'đ': 'd', 'ł': 'l', 'Ł': 'L',
  '’': "'", '‘': "'", '´': "'", '`': "'", '“': '"', '”': '"', '«': '"', '»': '"', '„': '"',
  '…': '...', '–': '-', '—': '-', '‐': '-', ' ': ' ', ' ': ' ', '\t': ' ',
};

/** Returns { text, unknown }: text is printable ASCII, unknown lists the characters replaced by '?'. */
export function toAscii(input) {
  const unknown = [];
  const text = [...input.normalize('NFD').replace(/[̀-ͯ]/g, '')]
    .map((c) => MAP[c] ?? c)
    .join('')
    .replace(/[^\x20-\x7E]/g, (c) => (unknown.push(c), '?'));
  return { text, unknown };
}
