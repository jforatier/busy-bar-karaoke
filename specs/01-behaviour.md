# 01 — App behaviour

What the app does. Each screen is drawn on the real bar before it is coded: [ui-mockups/](ui-mockups/) holds the scripts that draw the candidates from the PC (`04-fun/proto.py` plays a song and draws a front display live, `05-back/back.py` does the same for the back).

## Displays (setting `display`, OK cycles them during a song)

Two ways to show the lyrics, both driven by the score's notes. A line shows as soon as the previous line is over, however long the gap, so the singer can read it and the screen never sits empty mid-song. Lyrics are `bold` at y = 5 (caps on rows 7–13), the largest font that leaves rows 0–5 free; the part sung so far is drawn again on top in the sung colour, syllable by syllable. A line wider than 70 px slides to keep the action near x = 44.
- **Comet** (default): a 3×3 white star hops from syllable to syllable on rows 0–5 and lands on each syllable's centre on its note, a rainbow streak (6 segments of 1×2 px, where the comet was over the last 260 ms) behind it. Before a line it hops in from the left; on the last syllable it bounces in place.
- **Giant words**: the current word in `extra_large`, centred, a new rainbow colour on each syllable and a 1-px pop on its note: the rhythm is in the word itself. Made to be read from across a room. A syllable sung across two words (an elision: "le est" on one note in *Au clair de la lune*) shows the last word it starts, the one heard ("est").

A song without a score (a user's own) has no syllable timing: its lines light up evenly and the comet glides across.

**Count-in, per display**: in comet, the digit (`bold`, amber) stands at the start of the lyric row with the line to come dimmed after it, and the comet bounces on the digit, landing on each count, then leaps onto the first syllable (a small digit in a corner is too hard to see); giant words show `3`, `2`, `1` themselves, one colour each, and stay blank before a count-in (an early preview of the line would flash its first word before the `3`). Lyrics drop their punctuation at build time (`,` `.` `;` `:` `!` `?`): it costs pixels and the music already gives the breaths; apostrophes and hyphens stay, they belong to the words. Titles keep theirs.

## Screens

Code: `src/main.ts` (screens and flow), `src/display.ts` (display sender) and `src/timing.ts` (pure timing maths, unit-tested).

### 1. Song list
- Top line (`small`, y = −1): the artist, dimmed, on the left, and the position `1/7` in amber on the right. The artist must fit in 54 px so it never touches the position: the build warns otherwise ("Pierpont, 1857", not "J. Pierpont, 1857").
- Below, the title, the focal point: `bold` at y = 5, white; a title wider than 71 px is moved by the app (rest 1.2 s, slide at 25 px/s until its end shows, rest 2 s, start over), because the firmware's native text scroll stops after a clockwise turn of the wheel ([04](04-platform.md)). One 40 ms clock runs every screen, list included.
- Wheel: next/previous song (wraps around). **Start** or **OK**: play. **Back**: quit (stop the clock, clear the display, unbind input).
- The last song played is remembered in `localStorage` (`song` = id), written once per song started.

### 2. Playing
- The clock starts with the sound (`t0`, see Sync model). From Start until the first count-in, the list's screen stays on (artist and title, without the position): list → 3-2-1 → song, with no screen in between. If the play call fails: `Audio error` for 2 s, then the list.
- One `setInterval` at 40 ms asks for a frame; the display sender keeps one draw in flight and builds the next frame only when it sends it. It sends only the elements that changed, and parks the removed ones at x = −4000 (never a DELETE between frames: it would flash a blank screen).
- **Count-in** (always): before the first line, and after an instrumental gap of at least 3 counts, the last 3 counts are counted in on the song's beat (a dotted quarter in 6/8; every other beat when a beat is shorter than 450 ms, so a fast song's 3-2-1 stays readable; 1 s for a song without a tempo), each display in its own way (see Displays). The screen is blank only after the last line (until BRAVO) and, in giant words, before a count-in. No filler screen between lines: it would read as a glitch.
- **Lyrics**: see "Displays" above. OK switches between the two displays for this song.
- No progress bar on the front: row 15 is kept for descenders (anything else touching it looks cut off).
- Wheel: volume ±5 (`AudioVolumeSet` with `silent: 1`, starting from `AudioVolumeGet`: without it the bar plays a volume-change sound that replaces the song, [04](04-platform.md)), shown as `VOL 60` in an opaque black column over the full height for 1 s, the comet hidden meanwhile (the bar draws the star over the box whatever the `z_index`).
- **Start** or **Back**: `AudioStop`, then back to the list.

### 3. End of song
- At `t0 + durationMs`: the **rainbow wave**. The letters of `BRAVO!` (`extra_large`) drop in one by one every 120 ms, bounce on a sine wave (±2 px) with cycling rainbow colours, while sparkle pixels appear. At 2.6 s a white flash leaves `BRAVO!` in amber on screen. Total 3.2 s. The stock sound `shared/sounds/calendar_event_starts.snd` plays, then the list comes back.

## Back display (160×80)

The bar has a screen on each side; the back shows the lyrics too, for whoever sits behind it (a whole open space can sing along). It is greyscale, so brightness carries the meaning ([02](02-design.md)), and the right 12 px are under the system icons. Nothing on the back moves between syllables: motion there (a comet) would cost the front its frame rate, its rainbow streak and a smooth BRAVO.
- **Song list**: `KARAOKE` and a rule on top, then five titles in `bold`: the chosen one white after a `>`, two neighbours dimmed on each side (no repeats with fewer than five songs). A title too wide is cut by the icons, the chosen one included (the front shows it whole).
- **Playing** (both front displays): the song title and a progress rule on top; the line just sung, faint; the current line, wrapped on up to two balanced rows (`r` in the build), filling from grey to white syllable by syllable; then the lines to come, dimmed, as many as fit. During a count-in the digit stands before the current line, dimmed, or above it (in the past line's place) when the line would otherwise reach the icons. From Start to the first count-in it already shows the first lines, to read ahead.
- **End**: the letters of `BRAVO!` drop in like the front's, then a wave of light runs through them (greys for the front's rainbow, stepping every 120 ms to keep the front's frame rate), then the same white flash.

## Sync model

```
lineVisibleAt = t0 + line.t + song.offsetMs
```
- `song.offsetMs` (in `song.json`) fixes one song's timing, e.g. a track with a count-in.
- `t0` is halfway between sending the `AudioPlay` request and its answer, measured on every play: the sound starts while the bar handles the request, so the answer time is late and the request time early. No user offset: the app is calibrated, a user could not judge one.
- A frame is computed when it is sent, for the moment it will show: now + 150 ms (`DRAW_LEAD_MS`, set by ear on the bar: the text a touch ahead of the voice, in sync from the first line to the last). On the bar, building a frame takes 65–100 ms and drawing it 70–95 ms, both slower towards the end of a song, so the lead is fixed: one that follows the measured draw time would move the lyrics during the song.
- Drift: there is no position API; the bar plays at its nominal 44.1 kHz (a 38.0 s file ends within 100 ms of its length), and the lyrics stay in sync to the end of every bundled song (up to 65 s).

## Settings (`appmeta/settings.json`)

One setting: **`display`**, enum `comet` / `words`, default `comet`; OK still switches it during a song. Fewer choices, fewer cases to test: the count-in and the end sound are always on, the colours are the design's ([02](02-design.md)), the sync is calibrated in code, and the back display is always on (it costs the front nothing visible). Schema `version` 5; bumping it resets the stored values.

Field ids **must match `^[a-z][a-z0-9_]*$`**: with camelCase, the bar shows "Settings file is invalid." and the app doesn't start. From the PC, `PUT /api/apps/settings?app_id=…` with `{"version":5,"values":{"display":"words"}}` sets it.

## Not in v1

Duets, marking the bar BUSY during a song.
