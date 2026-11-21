import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, notes } from './changelog.mjs';

const OK = `# Changelog

## [Unreleased]

### Added
- Something cooking.

## [1.1.0] - 2026-12-20

### Highlights
- Two new carols.

### Added
- Scores for two carols.

## [1.0.0] - 2026-11-28

### Highlights
- First release.

[Unreleased]: https://example.com/compare/1.1.0...HEAD
`;

test('accepts a valid changelog and matching versions', () => {
  assert.equal(check(OK, { manifestVersion: '1.1.0', packageVersion: '1.1.0', release: '1.1.0' }).length, 3);
});

test('rejects what breaks the format', () => {
  assert.throws(() => check(OK.replace('## [Unreleased]\n\n### Added\n- Something cooking.\n\n', '')), /Unreleased/);
  assert.throws(() => check(OK.replace('[1.1.0] - 2026-12-20', '[1.1] - 2026-12-20')), /bad release heading/);
  assert.throws(() => check(OK.replace('### Added\n- Scores', '### New\n- Scores')), /unknown section/);
  assert.throws(() => check(OK.replace('### Highlights\n- Two new carols.\n', '')), /Highlights/);
  assert.throws(() => check(OK.replace('[1.1.0] - 2026-12-20', '[0.9.0] - 2026-12-20')), /newest first/);
});

test('rejects versions that disagree', () => {
  assert.throws(() => check(OK, { manifestVersion: '1.1.0', packageVersion: '1.0.0' }), /package.json/);
  assert.throws(() => check(OK, { manifestVersion: '1.1.0', packageVersion: '1.1.0', release: '1.2.0' }), /tag/);
  assert.throws(() => check(OK, { manifestVersion: '1.2.0', packageVersion: '1.2.0', release: '1.2.0' }), /no "## \[1.2.0\]/);
});

test('extracts the user view and the full notes', () => {
  assert.equal(notes(OK, '1.1.0', { highlights: true }), '- Two new carols.');
  assert.equal(notes(OK, '1.1.0'), '### Highlights\n\n- Two new carols.\n\n### Added\n\n- Scores for two carols.');
});
