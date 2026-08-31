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
import { join, resolve, dirname } from "node:path";

const DIST = resolve(process.cwd(), "dist");

// Every route the previous site published. None of these may 404.
const REQUIRED_ROUTES = [
  "index.html",
  "work/index.html",
  "work/dragon-drive/index.html",
  "work/microsoft/index.html",
  "work/mix-dialog/index.html",
  "work/verse-design-system/index.html",
  "work/core-ai/index.html",
  "experiments/index.html",
  "experiments/seeded-tower-defense/index.html",
  "experiments/resume-as-a-system/index.html",
  "experiments/verse-token-playground/index.html",
  // added by the redesign
  "about/index.html",
];

const failures = [];

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

    if (existsSync(target)) {
      // a directory URL must resolve to an index.html
      if (statSync(target).isDirectory() && !existsSync(join(target, "index.html"))) {
        failures.push(`${rel}: "${raw}" is a directory with no index.html`);
      }
      continue;
    }
    // "/work/foo/" style links land on the directory's index.html
    if (existsSync(join(target, "index.html"))) continue;
    if (existsSync(target + ".html")) continue;

    failures.push(`${rel}: "${raw}" does not exist in dist/`);
  }
}

if (failures.length) {
  console.error(`check-dist: ${failures.length} problem(s)\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log("check-dist: every local link and asset in dist/ resolves.");
