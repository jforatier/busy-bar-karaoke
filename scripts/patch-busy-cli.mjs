// postinstall: fixes a Windows-only build failure in @busy-app/cli 0.6.0.
// Its font-maps plugin writes `import f0 from 'C:\...\bold.json'`, which Rolldown can't resolve.
// shortcut: patches node_modules in place; delete this script (and the postinstall entry) once @busy-app/cli ships the fix.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const file = 'node_modules/@busy-app/cli/dist/lib/fontMapsPlugin.js';
const bad = "import f${i} from '${resolve(maps, `${f}.json`)}';`";
const good = "import f${i} from ${JSON.stringify(resolve(maps, `${f}.json`).replace(/\\\\/g, '/'))};`";

if (!existsSync(file)) process.exit(0);
const code = readFileSync(file, 'utf8');
if (code.includes(bad)) {
  writeFileSync(file, code.replace(bad, good));
  console.log('patch-busy-cli: fixed Windows font-map import paths');
} else if (!code.includes(good)) {
  console.warn('patch-busy-cli: @busy-app/cli changed, patch not applied (check if the Windows bug is fixed upstream)');
}
