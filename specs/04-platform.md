# 04 — BUSY Bar platform facts

Verified on a real bar running firmware 1.4.1 (HTTP API `27.15.0`, from `GET /api/version`), against its `/openapi.yaml`, the `busybar-firmware` sources and `@busy-app/cli` 0.6.0. Re-check this file after a firmware update.

## Audio

| Fact | Value | Source |
|---|---|---|
| File format | `.snd` = **raw PCM, signed 16-bit little-endian, mono, 44 100 Hz, no header** | `scripts/audio.py` (official converter: `ffmpeg … -acodec pcm_s16le -f s16le -ar 44100`), `AUDIO_SAMPLE_RATE 44100` in `services/audio/audio_i.h`, bytes of the stock sounds |
| Data rate | 88 200 B/s ≈ **5.3 MB per minute** | derived |
| Duration | `bytes / 88200` seconds; no header, so the file size is the duration | derived; on the bar a 38.0 s file ends within 100 ms of its length |
| Official loudness | `loudnorm i=-6 tp=-2` + a speaker EQ curve (`scripts/audio_eq.txt`, points from ~1.4 kHz to ~8 kHz). The speaker is small and weak in the bass. | `scripts/audio.py` |
| Play | `POST /api/audio/play` `{ application_name, path }`. `path` is relative to the app's assets folder, max **64 chars**, `[a-zA-Z0-9._/-]`. Answers in ~90 ms; the sound starts while the bar handles the request | openapi `PlayAudio`, `AssetsPath`; bar |
| Stock sounds | `{ application_name, stock_path: "shared/sounds/…" }` | openapi |
| Stop | `DELETE /api/audio/play`: 200 while a sound plays, 410 once it has ended (a crude, destructive "is it playing" probe) | openapi, bar |
| Volume | `GET/POST /api/audio/volume`, 0–100. **Pass `silent=1` during playback**: by default the bar plays a volume-change sound, and with a single audio channel that sound replaces the song | openapi, bar |
| Fades | the firmware fades in over 100 ms at start; the amplifier warms up for 100 ms | `audio_i.h` |
| **Not available** | pause, seek, playback position, "is playing", end-of-playback event | openapi |
| From the PC | `audio/play` also works with no app running, at the **system volume** | bar |

Consequences for BB Karaoke:
- Lyric sync uses the **wall clock** from the moment the sound starts ([01](01-behaviour.md#sync-model)).
- The end of a song is known from its duration, computed at build time.
- "Pause" can't exist, only stop.

## Display

- Front display: **72×16 px**, colour (`#RRGGBBAA`, all 8 hex digits).
- Back display: **160×80 px, 16 greys** (`display: "back"` on an element). The system icons cover x ≥ 148 and cut any text reaching them; amber, pink and cyan all render as mid-grey.
- `POST /api/display/draw` `{ application_name, priority 1–100, elements[] }`. An element is `text | image | animation | countdown | rectangle | xpmbitmap`, with a stable `id` (reusing an id replaces the element).
- **Give every element an explicit `z_index`**: a text without one is drawn over a `z_index: 1` text sent after it in the same call. With `z_index: 0` set, the stacking follows the indexes, except that an `xpmbitmap` is drawn over a rectangle with a higher `z_index`.
- Text: **printable ASCII only** (`^[\x20-\x7E]+$`). Fonts: `tiny, small, normal, condensed, bold, large, extra_large, global, superscript`. Optional native scrolling with `width`, `scroll_rate` (px/min), `scroll_start_delay`, `scroll_repeat_delay` (ms); it stops after a clockwise turn of the wheel inside an app.
- So the build must **transliterate lyrics to ASCII** (é→e, œ→oe, ’→'). See 03.
- During a BUSY or CUSTOM session, the app's drawing is hidden.
- A draw from the app takes 70–95 ms; building a frame of ~15 elements takes 65–100 ms in JerryScript, both slower towards the end of a 65 s song ([12](12-performance.md)).

## Input

`listen("input", e => …)` with `e.key ∈ encoder | ok | start | back`, `e.action ∈ press | release | short | long | repeat | clockwise | counterclockwise`, and `e.delta = ±1` on the encoder. Treat `short` as a press. `back` + `long` is reserved (it force-quits the app). From the PC, `POST /api/input?key=down` reaches the app as the wheel.

## Runtime limits

- JerryScript engine. Heap 128 KiB by default, up to 512 KiB (`heap_size_kib` in the manifest); a 4:48 song plays to the end on the default heap.
- One app runs at a time. The app exits when no timer, request or listener keeps it alive.
- `localStorage`: text only. Each write rewrites flash, so write rarely.
- Settings are read-only from the app (`apps/settings`) and edited in the BUSY app/web UI, using the schema in `appmeta/settings.json`.
- USB install speed is **~160 KB/s** (a 21 MB package takes about 2 min), so a package full of real songs (~80 MB) takes several minutes to install.
- Package `.tgz` ≤ **104 MB**. Full path ≤ 256 chars. Internal storage: several GB free.
- Local API over USB: `http://10.0.4.20`, no auth.
- An app gets its **own storage sandbox** mapped to `/ext/data` (write, read, list); its location on the PC side is unknown, so songs pushed from the PC go to `/ext/user_assets/<id>/` or ship inside the package.
- An HTTPS `fetch` from an app takes ~1.7 s per call.

## Tooling (dev machine)

- Node **24** (`.nvmrc` 24.16.0). On Node 26, `app install` fails with `UND_ERR_RES_CONTENT_LENGTH_MISMATCH` (Node 26's fetch rejects the bar's answers); the stage → install → launch API called with `curl` works.
- Windows: `busy-cli build` calls `tar` from `PATH`, so build from PowerShell or cmd (Windows `tar.exe`). Git Bash's GNU tar fails with `Cannot connect to C:`.
- Windows: `@busy-app/cli` 0.6.0 emits unresolvable `C:\…` font-map imports as soon as the app uses busy-lib layout with a font. `scripts/patch-busy-cli.mjs` (postinstall) fixes it.
- **Screenshot**: `GET /api/screen?display=0` returns the front display as **base64 raw pixels, 72×16, BGR order** (3456 bytes): swap bytes 0 and 2 of each pixel (`#FFB000` reads `00B0FF`). Colours sent to `display/draw` are correct as written: only the capture is reversed. `display=1` is the back display: **160×80, 4-bit grey**, 2 pixels per byte with the **low nibble first** (6400 bytes), system icons included.
- **Files pushed from the PC**:
  - `POST /api/storage/write?path=/ext/…` (raw body) uploads at ~500 KB/s. `DELETE /api/storage/remove?path=…` deletes.
  - A `.snd` written into `/ext/user_assets/<id>/sounds/` plays with `audio/play` (`path: "sounds/x.snd"`), but **a reinstall of the app wipes it**: the install replaces the whole folder.
  - The app's `localStorage` file (`/ext/apps_data/jsrunner/<id>.localstorage.json`, `{"format_version":1,"data":{…}}`), written by the PC while the app is closed, **is loaded by the app and survives a reinstall**. The PC can read it with `GET /api/storage/read?path=…`: the way to get measurements out of an app.
  - `audio/play` refuses `../` paths ("Invalid path") and silently ignores absolute paths. `stock_path: "shared/…"` plays files dropped in `/ext/apps_assets/shared/`, but that is the firmware's own folder: not something to rely on.
- **Uninstall** (`busy-cli app uninstall`) removes `/ext/user_assets/<id>/` but **keeps** `/ext/apps_data/jsrunner/<id>.localstorage.json` and `<id>.settings.json`. For a clean removal, delete them with `DELETE /api/storage/remove?path=…`.
- The launcher caches app icons until a real restart (Settings → System → Power → Restart device). A reinstall or the off button (standby) is not enough.
- `console.log` from an app does not appear in `POST /api/log_dump`.
