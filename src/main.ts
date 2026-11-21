import { device } from "@shared/device";
import manifest from "./appmeta/manifest.json";
import { APP, back, centered, type El, rect, report, show, text } from "./display.ts";
import { SONGS, type Line, type Song } from "./songs.gen.ts";
import { backRows, cometAt, countIn, countInAhead, followShift, lineAt, lineEnd, marqueeX, shownLine, sungText, syllableAt, wordAt } from "./timing.ts";

/** Frames are recomputed from the clock this often; the display sender drops frames while a draw is in flight. */
const TICK_MS = 40;
const BRAVO_MS = 3200;
/** A line shows as soon as the previous one is over, however long the gap: the screen never sits empty mid-song. */
const LEAD_MS = Number.POSITIVE_INFINITY;

const WHITE = "#FFFFFFFF";
const DIM = "#FFFFFF66";
const AMBER = "#FFB000FF";
const CYAN = "#3DDCFFFF";
const PINK = "#FF3D8BFF";
const RAINBOW = ["#FF3D8BFF", "#FFB000FF", "#FFE14DFF", "#3DDC84FF", "#3DDCFFFF", "#B04DFFFF"];
const SPARKLE = [WHITE, AMBER, CYAN, PINK];
/** "BRAVO!" in extra_large: letter widths, measured with busy-lib textWidth. */
const BRAVO: [string, number][] = [["B", 8], ["R", 8], ["A", 8], ["V", 9], ["O", 8], ["!", 3]];
/** The comet's head, a 3×3 star. */
const STAR = "! XPM2\n3 3 2 1\n. c None\nW c #FFFFFF\n.W.\nWWW\n.W.\n";

/** Grid (specs/02): rows 0-5 for the comet, a bold lyric line at y 5 (caps on rows 7-13). */
const LYRIC_Y = 5;
const COMET_GROUND = 4;
const COMET_HEIGHT = 3;
const TRAIL_MS = 260;
const TRAIL_STEPS = 6; // one streak sample every ~43 ms: more samples make the bar lag

/**
 * Back display (specs/02): 160×80 in greys, its right 12 px under the system icons, so brightness carries the meaning:
 * white = sung, grey = to sing now, dim = coming next, faint = just sung.
 */
const BACK_W = 146;
const B_TO_SING = "#8C8C8CFF";
const B_NEXT = "#5A5A5AFF";
const B_PAST = "#3C3C3CFF";
const B_RULE = "#2A2A2AFF";
/** The finale's wave of light: greys standing in for the front's rainbow. */
const B_WAVE = ["#FFFFFFFF", "#C8C8C8FF", "#909090FF", "#606060FF", "#909090FF", "#C8C8C8FF"];
/** Back grid: a header (title, progress rule on row 9), the line just sung at y 13, the current line from y 26. */
const B_PREV_Y = 13;
const B_LINE_Y = 26;
const B_ROW = 12;
const B_LAST_Y = 66;

const DISPLAYS = ["comet", "words"] as const;
type Display = (typeof DISPLAYS)[number];
/** Words still to sing, words sung (specs/02 palette). */
const LYRIC = WHITE;
const SUNG = AMBER;
const DEFAULT_DISPLAY: Display = "comet";

// ---------- Settings: one, the display (specs/01) ----------

async function loadSettings(): Promise<Display> {
  try {
    const doc = await device.AppsSettingsGet({ app_id: APP });
    const v = (doc.values ?? {}) as Record<string, unknown>;
    return DISPLAYS.find((d) => d === v.display) ?? DEFAULT_DISPLAY;
  } catch {
    return DEFAULT_DISPLAY; // no stored values yet
  }
}

/**
 * A frame is computed for the moment it will show: now + this. Building a frame takes 65–100 ms on the bar and drawing
 * it 70–95 ms; 150 ms is set by ear, the text a touch ahead of the voice. Fixed: following the measured draw time would
 * move the lyrics during a song, as both get slower towards its end.
 */
const DRAW_LEAD_MS = 150;

// ---------- State ----------

/** "wait": the play request is in flight, the clock has not started. */
type Mode = "list" | "wait" | "play" | "bravo";
let mode: Mode = "list";
let chosenDisplay: Display = DEFAULT_DISPLAY;
let display: Display = DEFAULT_DISPLAY;
let index = 0;
let song: Song = SONGS[0];
let t0 = 0; // wall clock when the audio started
let bravoAt = 0;
let volume = 50;
let volumeUntil = 0;
let listSince = 0; // when the current title came on screen, for its marquee
let timer: ReturnType<typeof setInterval> | undefined;

// ---------- Screens ----------

/**
 * Song list (specs/02): the artist, dimmed, and the position on the top line (`small` at y -1, caps on rows 1-5); the
 * title, the focal point, in `bold` below (caps on rows 7-13). A title wider than the screen is moved by the app:
 * the firmware's native scroll stops after a clockwise turn of the wheel.
 */
function listFrame(now: number): El[] {
  const s = SONGS[index];
  const els = [
    text("title", s.title, "bold", marqueeX(s.titleW, now - listSince), LYRIC_Y, WHITE),
    text("pos", `${index + 1}/${SONGS.length}`, "small", 71, -1, AMBER, { align: "top_right" }),
  ];
  if (s.artist) els.push(text("artist", s.artist, "small", 1, -1, DIM));
  return els;
}

/** The song list's screen without the position: what stays on screen from Start to the first count-in. */
function introFrame(now: number): El[] {
  return listFrame(now).filter((el) => el.id !== "pos");
}

/** The lyric line in bold, its sung syllables drawn again on top in the sung colour; slides to keep `focus` in view. */
function lyric(line: Line, e: number, focus: number): { els: El[]; x: number } {
  const x = 1 - followShift(line.w, focus);
  const sung = sungText(line, syllableAt(line, e));
  return {
    x,
    els: [
      text("lyr", line.text, "bold", x, LYRIC_Y, LYRIC),
      text("sung", sung || " ", "bold", x, LYRIC_Y, SUNG, { z_index: 1 }),
    ],
  };
}

/**
 * A: a comet hops from syllable to syllable, landing on each one on its note, a rainbow streak behind it.
 * During the count-in the digit stands at the start of the lyric row, the line to come dimmed after it, and the comet
 * bounces on the digit, landing on each count; after "1" it leaps onto the first syllable.
 */
function cometFrame(i: number, e: number, count = 0): El[] {
  const line = song.lines[i];
  const u = song.countMs;
  // Where the comet is at time t: bouncing on the digit during a count-in (landing on each count), else on the syllables.
  const at = (t: number) =>
    count > 0
      ? { x: 4, y: COMET_GROUND - COMET_HEIGHT * Math.sin((Math.PI * ((((t - line.t) % u) + u) % u)) / u) }
      : cometAt(line, t, COMET_GROUND, COMET_HEIGHT, 600);
  const c = at(e);
  let els: El[];
  let x: number;
  if (count > 0) {
    x = 0;
    els = [
      text("big", String(count), "bold", 1, LYRIC_Y, AMBER),
      text("lyr", line.text, "bold", 10, LYRIC_Y, DIM),
      text("sung", " ", "bold", 10, LYRIC_Y, SUNG, { z_index: 1 }),
    ];
  } else {
    ({ els, x } = lyric(line, e, c.x));
  }
  // The streak is where the comet was over the last TRAIL_MS, computed from the score: drawn from the frames actually
  // shown, it would thin out (fewer colours) whenever the frame rate drops.
  const seen: Record<string, true> = { [`${Math.round(x + c.x)},${Math.round(c.y)}`]: true };
  let n = 0;
  for (let k = 1; k <= TRAIL_STEPS; k++) {
    const p = at(e - (k * TRAIL_MS) / TRAIL_STEPS);
    const px = Math.round(x + p.x);
    const py = Math.round(p.y);
    if (seen[`${px},${py}`]) continue;
    seen[`${px},${py}`] = true;
    n++;
    els.push(rect(`t${n}`, px, py, 1, 2, RAINBOW[n % 6], 2));
  }
  els.push({ id: "star", type: "xpmbitmap", data: STAR, x: Math.round(x + c.x) - 1, y: Math.round(c.y) - 1, align: "top_left", z_index: 4 });
  return els;
}

/**
 * B: the current word, as big as the bar allows, pops and changes colour on each syllable: the rhythm is in the word
 * itself (no pulses at the edges: they disturb the reading). The count-in shows the digit itself.
 */
function wordsFrame(i: number, e: number, count = 0): El[] {
  const els: El[] = [];
  if (count > 0) {
    els.push(text("word", String(count), "extra_large", 36, 1, RAINBOW[(3 - count) % 6], { align: "top_mid" }));
    return els;
  }
  if (i < 0) return els;
  const line = song.lines[i];
  const j = syllableAt(line, e);
  const word = wordAt(line, j);
  if (j < 0) {
    els.push(text("word", word, "extra_large", 36, 1, DIM, { align: "top_mid" }));
  } else {
    const pop = e - line.k[2 * j] < 90 ? -1 : 0; // 1 px: 2 px cut the top of the caps
    els.push(text("word", word, "extra_large", 36, 1 + pop, RAINBOW[j % 6], { align: "top_mid" }));
  }
  return els;
}

/** The finale, centred on `cx` with its letters at `top`, flashing a w×h screen (the front by default). */
function bravoFrame(b: number, cx = 36, top = 0, w = 72, h = 16): El[] {
  if (b > 2600) {
    return [
      rect("flash", 0, 0, w, h, b < 2750 ? "#FFFFFFFF" : "#FFFFFF40"),
      { ...text("b", "BRAVO!", "extra_large", cx, top + 8, AMBER, { z_index: 2 }), align: "center" },
    ];
  }
  const els: El[] = [];
  let x = cx - 25;
  BRAVO.forEach(([ch, cw], k) => {
    if (b >= k * 120) {
      const dy = Math.round(2 * Math.sin(b / 111 - k * 0.9));
      els.push(text(`c${k}`, ch, "extra_large", x, top + 1 + dy, RAINBOW[(k + Math.floor(b / 125)) % 6]));
    }
    x += cw + 1;
  });
  for (let k = 0; k < 4; k++) {
    els.push(rect(`s${k}`, Math.floor(Math.random() * w), Math.floor(Math.random() * (h - 1)), 1, 1, SPARKLE[Math.floor(Math.random() * 4)], 3));
  }
  return els;
}

// ---------- Back display: the song list, then the verse as a prompter ----------

const backHeader = (title: string, progress: number): El[] => [
  text("head", title, "small", 0, -1, B_NEXT),
  rect("rule", 0, 9, BACK_W, 1, B_RULE),
  rect("prog", 0, 9, BACK_W * progress, 1, B_TO_SING, 1),
];

/**
 * The song list seen from behind: the chosen title bright after a ">", up to two neighbours dimmed on each side. A title
 * too wide is cut by the icons, chosen one included; the front shows it whole.
 */
function backList(): El[] {
  const n = SONGS.length;
  const els = backHeader(manifest.name.toUpperCase(), 0).slice(0, 2);
  for (let d = -2; d <= 2; d++) {
    if (d < -Math.floor((n - 1) / 2) || d > Math.ceil((n - 1) / 2)) continue; // fewer than 5 songs: no repeats
    const s = SONGS[(index + d + 3 * n) % n];
    const y = 12 + (d + 2) * 13;
    if (d === 0) els.push(text("arrow", ">", "bold", 0, y, WHITE), text("l2", s.title, "bold", 8, y, WHITE));
    else els.push(text(`l${d + 2}`, s.title, "bold", 0, y, B_NEXT));
  }
  return els;
}

/** Each line's back rows, computed once per song: the frame is rebuilt every few tens of ms on a slow engine. */
let rowsOf: ReturnType<typeof backRows>[] = [];
const rowsAt = (i: number) => rowsOf[i] || (rowsOf[i] = backRows(song.lines[i]));

/**
 * The back changes only with the line, the syllable, the count-in or a pixel of progress, yet frames come every few
 * tens of ms: its elements are rebuilt only when `key` changes, and the display sender skips them otherwise. Building
 * and comparing the whole back on every frame would cut the frame rate to ~5 per second (the comet's streak and BRAVO
 * would lose their smoothness).
 */
let backKey = "";
let backEls: El[] = [];
function backCached(key: string, build: () => El[]): El[] {
  if (key !== backKey) {
    backKey = key;
    backEls = back(build());
  }
  return backEls;
}

/** The back during a song: only its cached text; nothing on it moves between syllables (specs/01). */
function backPlayFrame(e: number, count: number): El[] {
  const lines = song.lines;
  const i = lines.findIndex((l) => l.text && e < lineEnd(l));
  const j = i < 0 ? -2 : syllableAt(lines[i], e);
  const px = Math.round(BACK_W * Math.min(1, Math.max(0, e / song.durationMs)));
  return backCached(`play|${song.id}|${i}|${j}|${count}|${px}`, () => backPlay(lines, i, e, count));
}

/**
 * The verse seen from behind (design round 5): the line just sung, faint; the current line `i` on one or two rows,
 * filling from grey to white syllable by syllable; then the lines to come, dimmed. During a count-in the digit stands
 * before the current line, dimmed. The front's display setting does not change it. No comet here: moving on every
 * frame, it would cost the front its frame rate.
 */
function backPlay(lines: Line[], i: number, e: number, count: number): El[] {
  const els = backHeader(song.title, Math.min(1, Math.max(0, e / song.durationMs)));
  if (i < 0) return els; // after the last line
  const line = lines[i];
  const rows = rowsAt(i);
  // The digit stands before the line when its first row still fits beside it, else above it, in the past line's place.
  const firstW = rows.length > 1 ? rows[1].x - 1 : line.w;
  const beside = count > 0 && firstW + 9 <= BACK_W;
  const x0 = beside ? 9 : 0;
  let p = i - 1;
  while (p >= 0 && !lines[p].text) p--;
  if (count > 0 && !beside) {
    els.push(text("prev", String(count), "bold", 0, B_PREV_Y, WHITE));
  } else if (p >= 0) {
    const past = rowsAt(p);
    const last = past[past.length - 1];
    els.push(text("prev", lines[p].text.slice(last.a, last.b), "bold", 0, B_PREV_Y, B_PAST));
  }
  if (beside) els.push(text("count", String(count), "bold", 0, B_LINE_Y, WHITE));
  const sung = count > 0 ? "" : sungText(line, syllableAt(line, e));
  rows.forEach((r, m) => {
    const y = B_LINE_Y + m * B_ROW;
    els.push(
      text(`row${m}`, line.text.slice(r.a, r.b), "bold", x0, y, count > 0 ? B_NEXT : B_TO_SING),
      text(`sung${m}`, sung.slice(r.a, r.b).trimEnd() || " ", "bold", x0, y, WHITE, { z_index: 1 }),
    );
  });
  let y = B_LINE_Y + rows.length * B_ROW + 2;
  let m = 0;
  for (let j = i + 1; j < lines.length && y <= B_LAST_Y; j++) {
    if (!lines[j].text) continue;
    for (const r of rowsAt(j)) {
      if (y > B_LAST_Y) break;
      els.push(text(`next${m++}`, lines[j].text.slice(r.a, r.b), "bold", 0, y, B_NEXT));
      y += B_ROW;
    }
  }
  return els;
}

function playFrame(now: number): El[] {
  const e = now - t0 - song.offsetMs;
  const lines = song.lines;
  const n = countIn(lines, e, song.countMs);
  let els: El[];
  const first = lines.findIndex((l) => l.text);
  if (n === 0 && lineAt(lines, e) < first) {
    // Until the first count-in, the list screen stays (no "...", no early line): list → 3-2-1 → song.
    els = introFrame(now);
  } else if (n > 0) {
    // Each display counts in its own way: the comet bounces on the counts, giant words show the digit itself.
    let j = lineAt(lines, e) + 1;
    while (!lines[j].text) j++;
    if (display === "words") els = wordsFrame(j, e, n);
    else els = cometFrame(j, e, n);
  } else {
    // Giant words show nothing while a count-in is coming: the first word flashed before the "3".
    const i = display === "words" && countInAhead(lines, e, song.countMs) ? -1 : shownLine(lines, e, LEAD_MS);
    if (i < 0) els = []; // before a count-in in giant words, and after the last line
    else els = display === "words" ? wordsFrame(i, e) : cometFrame(i, e);
  }
  if (now < volumeUntil) {
    // Opaque, and the comet hidden meanwhile: the bar draws the star over the box whatever its z_index.
    els = els.filter((el) => el.id !== "star" && !/^t\d/.test(el.id)); // the star and its streak segments t1…t6
    els.push(rect("volbg", 20, 0, 32, 16, "#000000FF", 8), centered("vol", `VOL ${volume}`, "small", WHITE, { z_index: 9 }));
  }
  return els.concat(backPlayFrame(e, n));
}

const listScreen = (now: number): El[] => listFrame(now).concat(backCached(`list|${index}`, backList));

/**
 * The finale from behind: the letters drop in like the front's, then a wave of light runs through them (greys stand in
 * for the rainbow), stepping every 120 ms only, to keep the front's frame rate; then the same flash.
 */
function backBravo(b: number): El[] {
  const step = Math.floor(b / 120);
  return backCached(`bravo|${b > 2600 ? (b < 2750 ? -1 : -2) : step}`, () => {
    if (b > 2600) return bravoFrame(b, 73, 32, BACK_W, 80);
    const els: El[] = [];
    let x = 73 - 25;
    BRAVO.forEach(([ch, cw], k) => {
      if (step >= k) els.push(text(`c${k}`, ch, "extra_large", x, 33, B_WAVE[(k + B_WAVE.length - (step % B_WAVE.length)) % B_WAVE.length]));
      x += cw + 1;
    });
    return els;
  });
}

// ---------- Flow ----------

function stopTimer(): void {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
}

function backToList(): void {
  mode = "list";
  listSince = Date.now();
  show(listScreen(listSince));
}

function tick(): void {
  const now = Date.now();
  if (mode === "play") {
    if (now - t0 >= song.durationMs) {
      mode = "bravo";
      bravoAt = now;
      device.AudioPlay({ application_name: APP, stock_path: "shared/sounds/calendar_event_starts.snd" }).catch(report);
    } else {
      show(() => playFrame(Date.now() + DRAW_LEAD_MS));
      return;
    }
  }
  if (mode === "wait") return;
  if (mode === "bravo") {
    const b = now - bravoAt;
    if (b >= BRAVO_MS) backToList();
    else show(bravoFrame(b).concat(backBravo(b)));
    return;
  }
  show(listScreen(now)); // only a long title's x changes, so almost nothing is sent
}

async function startSong(): Promise<void> {
  song = SONGS[index];
  mode = "wait";
  display = chosenDisplay;
  rowsOf = [];
  show(introFrame(Date.now()).concat(backPlayFrame(-song.offsetMs, 0)));
  try {
    localStorage.setItem("song", song.id); // written once per song: each write rewrites flash
  } catch (err) {
    report(err);
  }
  try {
    volume = (await device.AudioVolumeGet()).volume ?? volume;
  } catch (err) {
    report(err);
  }
  // The sound starts while the bar handles the request: the answer time makes the lyrics late, the request time early
  // (heard on the bar), so the clock starts halfway between the two, measured on every play.
  const requested = Date.now();
  try {
    await device.AudioPlay({ application_name: APP, path: `sounds/${song.id}.snd` });
  } catch (err) {
    report(err);
    show([centered("err", "Audio error", "small", PINK)]);
    setTimeout(backToList, 2000);
    return;
  }
  if (mode !== "wait") return; // stopped while the play request was in flight
  t0 = Math.round((requested + Date.now()) / 2);
  mode = "play";
  tick();
}

function stopSong(): void {
  device.AudioStop().catch(() => undefined); // 410 when nothing is playing
  backToList();
}

function setVolume(delta: number): void {
  volume = Math.max(0, Math.min(100, volume + delta * 5));
  volumeUntil = Date.now() + 1000;
  // silent: by default the bar plays a volume-change sound, which replaces the song on its single audio channel.
  device.AudioVolumeSet({ volume, silent: 1 }).catch(report);
}

/**
 * Entry point, called at the end of the file: the device runs this script from top to bottom and starts nothing by itself.
 */
async function main(): Promise<void> {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("song");
  } catch (err) {
    report(err);
  }
  index = Math.max(0, SONGS.findIndex((s) => s.id === saved));
  chosenDisplay = await loadSettings();
  backToList();
  // One clock for every screen: the list's marquee, the song, the finale.
  timer = setInterval(tick, TICK_MS);

  let quitting = false;
  const unbind = listen("input", (event) => {
    if (quitting) return;
    if (event.key === "encoder") {
      if (mode === "list") {
        index = (index + event.delta + SONGS.length) % SONGS.length;
        backToList();
      } else if (mode === "play") {
        setVolume(event.delta);
      }
      return;
    }
    if (event.action !== "short") return;
    if (mode === "list") {
      if (event.key === "start" || event.key === "ok") void startSong().catch(report);
      if (event.key === "back") {
        quitting = true;
        stopTimer();
        // Once the handler is detached, nothing keeps the app alive and the device takes the screen back.
        device.DisplayClear({ application_name: APP }).catch(report).finally(() => setTimeout(unbind, 0));
      }
    } else if (event.key === "ok" && mode === "play") {
      // OK switches the display during a song: comet ↔ giant words.
      display = DISPLAYS[(DISPLAYS.indexOf(display) + 1) % DISPLAYS.length];
    } else if (event.key === "start" || event.key === "back") {
      stopSong();
    }
  });
}

void main().catch(report);
