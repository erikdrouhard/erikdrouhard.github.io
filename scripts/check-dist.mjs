#!/usr/bin/env node
/**
 * Verifies the built site, not the dev server.
 *
 * The old Vite build rewrote <img src> but not <a href>, so a link to a
 * source-tree asset resolved in dev and 404'd in production. Astro's public/
 * copy behaves differently, but the failure mode is the same class of bug and
 * it is invisible until someone clicks. So: walk dist/, resolve every local
 * href/src/poster, and fail on anything that is not on disk.
 *
 * It also asserts the routes the old site published still exist, because a
 * migration that silently drops a URL is the expensive kind of regression.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, sep } from "node:path";

const DIST = resolve(process.cwd(), "dist");

/* Every route the previous site published. None of these may 404.
   `work/index.html` is deliberately absent: the work index was retired while
   there is only one body of work to show, and the case studies are reached
   from the home-page grid. Do not add it back to "fix" a 404 — /work/ is meant
   to 404, and check-acceptance.mjs asserts that it does.

   The four /experiments/ routes are gone for the same reason. They were built
   on the retired stylesheet and are now at `public/.archive/experiments/`;
   DESIGN-SYSTEM.md retires them outright, and an integration in
   astro.config.mjs strips `dist/.archive` after the build so they are kept but
   not served. Reviving one means rebuilding it on tokens, not restoring a
   route here. */
const REQUIRED_ROUTES = [
  "index.html",
  "work/dragon-drive/index.html",
  "work/microsoft/index.html",
  "work/mix-dialog/index.html",
  "work/verse-design-system/index.html",
  "work/core-ai/index.html",
  // added by the redesign
  "about/index.html",
];

const failures = [];

/* macOS is case-insensitive; GitHub Pages is not. existsSync() on this machine
   happily resolves /assets/ERIK-DROUHARD-PORTRAIT.PNG and the link then 404s in
   production, where nobody is looking. So every path segment under dist/ is
   matched against the real directory listing, exactly. */
const dirCache = new Map();
function entriesOf(dir) {
  let names = dirCache.get(dir);
  if (!names) {
    try {
      names = new Set(readdirSync(dir));
    } catch {
      names = new Set();
    }
    dirCache.set(dir, names);
  }
  return names;
}

function existsExact(target) {
  if (!existsSync(target)) return false;
  const rel = relative(DIST, target);
  // outside dist/ (shouldn't happen) — fall back to the plain check
  if (rel.startsWith("..")) return true;
  let dir = DIST;
  for (const segment of rel.split(sep)) {
    if (!segment || segment === ".") continue;
    if (!entriesOf(dir).has(segment)) return false;
    dir = join(dir, segment);
  }
  return true;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error("dist/ not found — run `npm run build` first.");
  process.exit(1);
}

for (const route of REQUIRED_ROUTES) {
  if (!existsSync(join(DIST, route))) failures.push(`missing route: /${route}`);
}

// href/src/poster attributes pointing at a same-origin path
const ATTR = /(?:href|src|poster)\s*=\s*"([^"]+)"/g;

for (const file of walk(DIST)) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(DIST.length + 1);
  let m;
  while ((m = ATTR.exec(html))) {
    const raw = m[1];
    if (!raw || /^(https?:|mailto:|tel:|data:|#|\/\/)/.test(raw)) continue;

    const path = decodeURI(raw.split("#")[0].split("?")[0]);
    if (!path) continue;

    const target = path.startsWith("/")
      ? join(DIST, path)
      : resolve(dirname(file), path);

    if (existsExact(target)) {
      // a directory URL must resolve to an index.html
      if (statSync(target).isDirectory() && !existsExact(join(target, "index.html"))) {
        failures.push(`${rel}: "${raw}" is a directory with no index.html`);
      }
      continue;
    }
    // "/work/foo/" style links land on the directory's index.html
    if (existsExact(join(target, "index.html"))) continue;
    if (existsExact(target + ".html")) continue;

    failures.push(`${rel}: "${raw}" does not exist in dist/`);
  }
}

/* Keyboard shortcuts are resolved per page against what is visible, so two
   controls on the SAME page claiming one key means the second is unreachable.
   Collisions across different pages are fine and expected. */
const KEY = /<kbd[^>]*data-key="([^"]+)"/g;
for (const file of walk(DIST)) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(DIST.length + 1);
  const seen = new Map();
  let k;
  while ((k = KEY.exec(html))) {
    const key = k[1].toLowerCase();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [key, n] of seen) {
    if (n > 1) failures.push(`${rel}: shortcut "${key}" claimed by ${n} keycaps`);
  }
}

if (failures.length) {
  console.error(`check-dist: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("check-dist: every local link and asset in dist/ resolves.");
