// Renders a bundled song's score to dist/<id>.wav, to listen on a computer while writing a score (specs/03).
//   npm run preview <song-id>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render, RATE } from './synth.mjs';

const id = process.argv[2];
if (!id) {
  console.error('usage: npm run preview <song-id>   (a folder of songs/ with a score.json)');
  process.exit(1);
}
const pcm = render(JSON.parse(readFileSync(`songs/${id}/score.json`, 'utf8')));
// A WAV is the bar's raw PCM (s16le mono) behind a 44-byte header.
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(pcm.length, 40);
mkdirSync('dist', { recursive: true });
writeFileSync(`dist/${id}.wav`, Buffer.concat([header, pcm]));
console.log(`preview: dist/${id}.wav (${(pcm.length / (RATE * 2)).toFixed(1)} s)`);
