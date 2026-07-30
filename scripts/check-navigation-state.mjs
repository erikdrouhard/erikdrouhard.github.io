#!/usr/bin/env node
/**
 * Guards the active Case Studies navigation treatment.
 *
 * The shimmer uses transparent text fill in supporting browsers, so its
 * active-page underline must be painted independently from the text.
 * Every published work page also needs the active state in both the desktop
 * and mobile navigation.
 *
 * Run with `npm run check:navigation`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");
const WORK_PAGES = [
  "work/index.html",
  "work/microsoft/index.html",
  "work/mix-dialog/index.html",
  "work/dragon-drive/index.html",
];

const violations = [];
const markerRule = STYLES.match(
  /\.case-studies-link\[aria-current="page"\]::after\s*\{([^}]*)\}/,
)?.[1];

if (
  !markerRule ||
  !/content:\s*""/.test(markerRule) ||
  !/height:\s*1px/.test(markerRule) ||
  !/background:\s*currentColor/.test(markerRule)
) {
  violations.push(
    "styles.css must paint the active desktop indicator with an independent ::after marker",
  );
}

if (
  !/\.mobile-nav a\[aria-current="page"\]\s*\{[^}]*text-decoration:\s*underline/s.test(
    STYLES,
  )
) {
  violations.push(
    "styles.css must underline the active mobile Case Studies link",
  );
}

for (const page of WORK_PAGES) {
  const source = readFileSync(join(ROOT, page), "utf8");
  const workLinks = [...source.matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /href="\/work\/"/.test(tag));
  const activeLinks = workLinks.filter((tag) =>
    /aria-current="page"/.test(tag),
  );

  if (activeLinks.length !== 2) {
    violations.push(
      `${page} must mark both desktop and mobile Case Studies links as current`,
    );
  }
}

if (violations.length) {
  console.error(`\n✗ ${violations.length} navigation state issue(s):\n`);
  violations.forEach((violation) => console.error(`  ${violation}`));
  console.error();
  process.exit(1);
}

console.log(
  "✓ Case Studies active state is present in desktop and mobile navigation",
);
