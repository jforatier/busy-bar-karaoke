// Shared lookups in a song folder (songs/<id>/).
import { readdirSync } from 'node:fs';

const AUDIO = /\.(snd|mp3|wav|flac|m4a|aac|ogg|opus|wma|aiff?)$/i;

/** The song's audio: track.* if present, otherwise the only audio file in the folder (e.g. the MP3 as downloaded). */
export function findAudio(dir) {
  const files = readdirSync(dir).filter((f) => AUDIO.test(f));
  return files.find((f) => /^track\./i.test(f)) ?? (files.length === 1 ? files[0] : undefined);
}
