// CHANGELOG.md tooling: Keep a Changelog 1.1.0 + SemVer 2.0.0 (specs/10-quality.md#versions-and-changelog).
//   node scripts/changelog.mjs check [--release <version>]   validate the file and the manifest/package versions
//   node scripts/changelog.mjs notes <version> [--highlights]  print a release's section (release notes) or only its user view
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SECTIONS = ['Highlights', 'Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

/** Splits a changelog into releases: [{ version, date, sections: { name: [lines] } }], Unreleased first. */
export function parse(text) {
  const releases = [];
  let rel = null, sec = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const at = `line ${i + 1}`;
    const h2 = /^## \[(.+?)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/.exec(line);
    if (line.startsWith('## ') && !h2) throw new Error(`${at}: release heading must be "## [version] - YYYY-MM-DD" or "## [Unreleased]"`);
    if (h2) {
      const [, version, date] = h2;
      if (version === 'Unreleased' ? date : !SEMVER.test(version) || !date) throw new Error(`${at}: bad release heading "${line}"`);
      releases.push(rel = { version, date, sections: {} });
      sec = null;
      return;
    }
    const h3 = /^### (.+?)\s*$/.exec(line);
    if (h3) {
      if (!rel) throw new Error(`${at}: section outside a release`);
      if (!SECTIONS.includes(h3[1])) throw new Error(`${at}: unknown section "${h3[1]}" (allowed: ${SECTIONS.join(', ')})`);
      rel.sections[sec = h3[1]] = [];
      return;
    }
    if (sec && line.trim() && !line.startsWith('[')) rel.sections[sec].push(line);
  });
  return releases;
}

const key = (v) => v.split('.').map(Number);
const newer = (a, b) => { const [x, y] = [key(a), key(b)]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

/** Throws on the first rule broken; returns the releases. */
export function check(text, { manifestVersion, packageVersion, release } = {}) {
  const releases = parse(text);
  if (releases[0]?.version !== 'Unreleased') throw new Error('the first section must be "## [Unreleased]"');
  const dated = releases.slice(1);
  dated.forEach((r, i) => {
    if (!r.sections.Highlights?.length) throw new Error(`${r.version}: a release needs a non-empty "### Highlights" (the user view)`);
    if (i > 0 && newer(dated[i - 1].version, r.version) <= 0) throw new Error(`${r.version}: releases must be listed newest first`);
  });
  if (manifestVersion !== undefined && manifestVersion !== packageVersion) throw new Error(`manifest version ${manifestVersion} ≠ package.json ${packageVersion}`);
  if (release !== undefined) {
    if (release !== manifestVersion) throw new Error(`tag ${release} ≠ manifest version ${manifestVersion}`);
    if (!dated.some((r) => r.version === release)) throw new Error(`no "## [${release}] - …" section in CHANGELOG.md`);
  }
  return releases;
}

/** A release's notes: every section (technical view) or only the Highlights bullets (user view). */
export function notes(text, version, { highlights = false } = {}) {
  const r = parse(text).find((x) => x.version === version);
  if (!r) throw new Error(`no section for ${version}`);
  if (highlights) return (r.sections.Highlights ?? []).join('\n');
  return Object.entries(r.sections).map(([name, lines]) => `### ${name}\n\n${lines.join('\n')}`).join('\n\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, arg] = process.argv.slice(2);
  const flag = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] ?? true : undefined; };
  try {
    const text = readFileSync('CHANGELOG.md', 'utf8');
    if (cmd === 'check') {
      const manifestVersion = JSON.parse(readFileSync('src/appmeta/manifest.json', 'utf8')).version;
      const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
      const n = check(text, { manifestVersion, packageVersion, release: flag('--release') }).length - 1;
      console.log(`changelog: OK (${n} release${n === 1 ? '' : 's'}, version ${manifestVersion})`);
    } else if (cmd === 'notes' && arg) {
      console.log(notes(text, arg, { highlights: process.argv.includes('--highlights') }));
    } else {
      throw new Error('usage: changelog.mjs check [--release <version>] | notes <version> [--highlights]');
    }
  } catch (e) {
    console.error(`changelog: ${e.message}`);
    process.exit(1);
  }
}
