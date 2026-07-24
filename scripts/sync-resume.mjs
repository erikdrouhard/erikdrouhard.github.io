#!/usr/bin/env node
/**
 * Copies the current ATS resume build into the two asset paths the site
 * serves it from, and verifies they match.
 *
 * There are two copies because the download links are written two ways:
 * `index.html` uses a relative `./assets/...`, while the `work/` pages use an
 * absolute `/assets/...` that Vite resolves out of `public/`. Update one and
 * not the other and the home page quietly serves a different PDF than the
 * case studies do.
 *
 * This is deliberately NOT a build step. `resume/` lives outside this git
 * repository, so the GitHub Actions checkout cannot see it — the copies under
 * `assets/` and `public/assets/` must stay committed. Run this locally after
 * rebuilding the resume, then commit the result.
 *
 * Run with `npm run sync:resume`.
 */

import { copyFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* The canonical build, produced by ../resume/build-ats-resume.py. The Chrome
   print-to-PDF version is not a substitute: it emits text one glyph at a time
   and does not survive ATS extraction. */
const SOURCE = join(ROOT, '..', 'resume', 'Erik-Drouhard-Resume-2026-ATS.pdf');
const TARGETS = ['assets/erik-drouhard-resume.pdf', 'public/assets/erik-drouhard-resume.pdf'];

const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

if (!existsSync(SOURCE)) {
  console.error(`sync-resume: source not found at ${SOURCE}`);
  console.error('Build it first: python3 resume/build-ats-resume.py && soffice --headless --convert-to pdf ...');
  process.exit(1);
}

const want = sha(SOURCE);

for (const target of TARGETS) {
  const full = join(ROOT, target);
  const before = existsSync(full) ? sha(full) : null;
  if (before === want) {
    console.log(`  ok        ${target}`);
    continue;
  }
  copyFileSync(SOURCE, full);
  console.log(`  ${before === null ? 'created  ' : 'updated  '} ${target}`);
}

/* Verify rather than trust the copy — a half-written file here ships a broken
   download to every page on the site. */
const mismatched = TARGETS.filter((t) => sha(join(ROOT, t)) !== want);
if (mismatched.length) {
  console.error(`sync-resume: copy verification failed for ${mismatched.join(', ')}`);
  process.exit(1);
}

console.log(`sync-resume: all copies at ${want.slice(0, 12)}…`);
