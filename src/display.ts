// The display sender: draws frames on the bar, sending only what changed and never clearing between frames (specs/12).
import { device } from "@shared/device";
import manifest from "./appmeta/manifest.json";

/** The name the app draws and plays under; the device clears elements by this id. */
export const APP = manifest.id;

/** A display element; the device validates it. */
export type El = { id: string; x?: number; [key: string]: unknown };

export const report = (err: unknown) => console.error(`${APP}: ${err instanceof Error ? err.message : String(err)}`);

const sent: Record<string, string> = {};
/** Ids already parked off-screen: checked without parsing their JSON again on every frame. */
const parked: Record<string, true> = {};
/** The last element object sent per id: a cached element passed again is skipped without being serialized. */
const lastEl: Record<string, El> = {};
/** A frame, or a function that builds it when it is sent: a frame waiting for the draw in flight would be stale. */
let pending: El[] | (() => El[]) | null = null;
let drawing = false;

/** Draws a frame: at most one draw in flight, and only the latest frame waits behind it. */
export function show(frame: El[] | (() => El[])): void {
  pending = frame;
  if (!drawing) void flush();
}

async function flush(): Promise<void> {
  drawing = true;
  while (pending) {
    const frame = typeof pending === "function" ? pending() : pending;
    pending = null;
    const out: El[] = [];
    const ids: Record<string, true> = {};
    for (const el of frame) {
      ids[el.id] = true;
      if (lastEl[el.id] === el) continue;
      lastEl[el.id] = el;
      const json = JSON.stringify(el);
      if (sent[el.id] !== json) {
        sent[el.id] = json;
        delete parked[el.id];
        out.push(el);
      }
    }
    // Elements that left the frame are parked off-screen: a DELETE would flash a blank screen.
    // Each id keeps its type (the device refuses a text re-sent as a rectangle).
    for (const id in sent) {
      if (ids[id] || parked[id]) continue;
      const el = JSON.parse(sent[id]) as El;
      el.x = -4000;
      sent[id] = JSON.stringify(el);
      parked[id] = true;
      delete lastEl[id];
      out.push(el);
    }
    if (out.length === 0) continue;
    try {
      await device.DisplayDraw({ application_name: APP, priority: 50, elements: out as never });
    } catch (err) {
      report(err);
      for (const id in sent) delete sent[id]; // resend everything next frame
      for (const id in parked) delete parked[id];
      for (const id in lastEl) delete lastEl[id];
    }
  }
  drawing = false;
}

/** z_index is always explicit: the bar draws a text without one over a z_index 1 text sent after it (firmware 1.4.1). */
export const text = (id: string, s: string, font: string, x: number, y: number, c: string, extra: object = {}): El => ({
  id, type: "text", text: s, font, x: Math.round(x), y, align: "top_left", color: c, z_index: 0, ...extra,
});

/** A text centred on the front display. */
export const centered = (id: string, s: string, font: string, c: string, extra: object = {}): El => ({
  ...text(id, s, font, 36, 8, c, extra), align: "center",
});

export const rect = (id: string, x: number, y: number, w: number, h: number, c: string, z = 0): El => ({
  id, type: "rectangle", x: Math.round(x), y, width: Math.max(1, Math.round(w)), height: h,
  fill: "solid", fill_colors: [c], border_width: 0, align: "top_left", z_index: z,
});

/** Moves elements to the back display (160×80, greys), under their own ids. */
export const back = (els: El[]): El[] => els.map((el) => ({ ...el, id: `B.${el.id}`, display: "back" }));
