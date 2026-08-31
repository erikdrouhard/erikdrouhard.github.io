#!/usr/bin/env node
/**
 * Guards the active Case Studies navigation treatment.
 *
 * The shimmer uses transparent text fill in supporting browsers, so its
 * active-page underline must be painted independently from the text.
 * The work index owns that active state; individual case studies keep normal
 * links back to the index without claiming to be the current page.
 *
 * Run with `npm run check:navigation`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = readFileSync(join(ROOT, "styles.css"), "utf8");
const WORK_PAGES = [
  { path: "work/index.html", expectedActiveLinks: 2 },
  { path: "work/microsoft/index.html", expectedActiveLinks: 0 },
  { path: "work/mix-dialog/index.html", expectedActiveLinks: 0 },
  { path: "work/dragon-drive/index.html", expectedActiveLinks: 0 },
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

for (const { path, expectedActiveLinks } of WORK_PAGES) {
  const source = readFileSync(join(ROOT, path), "utf8");
  const workLinks = [...source.matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /href="\/work\/"/.test(tag));
  const activeLinks = workLinks.filter((tag) =>
    /aria-current="page"/.test(tag),
  );

  if (workLinks.length !== 2) {
    violations.push(
      `${path} must retain desktop and mobile links back to Case Studies`,
    );
  }

  if (activeLinks.length !== expectedActiveLinks) {
    violations.push(
      expectedActiveLinks
        ? `${path} must mark both Case Studies links as current`
        : `${path} must not mark Case Studies links as current`,
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
  "✓ Case Studies is active only on the work index",
);
