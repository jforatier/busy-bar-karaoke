// `busy-cli build` hands Vite its own config, and Vite merges this file into it.
// The plugin generates the songs (src/sounds/*.snd, src/songs.gen.ts) before the app is bundled,
// so a clean clone builds with `busy-cli build` alone, as the BUSY Apps Catalog does.
import { buildSongs } from './scripts/songs.mjs';

export default {
  plugins: [{ name: 'songs', buildStart: buildSongs }],
};
