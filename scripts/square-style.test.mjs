/**
 * Source-only assertions about the retired pill. These run before a build and
 * without a browser, so a reintroduced `.pill` fails in `npm test` rather than
 * surviving until someone runs the Playwright check.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const pagesDir = new URL("src/pages/work/", root);
const stylesDir = new URL("src/styles/", root);

const pageFiles = readdirSync(pagesDir).filter((f) => f.endsWith(".astro"));

function read(dirUrl, name) {
  return readFileSync(new URL(name, dirUrl), "utf8");
}

/* Every class="…" value in a file, split into its tokens. Matching on tokens
   rather than on the substring "pill" keeps `--radius-pill` and prose out of
   it. */
function classTokens(source) {
  const tokens = [];
  for (const m of source.matchAll(/class="([^"]*)"/g)) {
    tokens.push(...m[1].split(/\s+/).filter(Boolean));
  }
  return tokens;
}

function cssFilesUnder(dirUrl) {
  const out = [];
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...cssFilesUnder(new URL(entry.name + "/", dirUrl)));
    } else if (entry.name.endsWith(".css")) {
      out.push(new URL(entry.name, dirUrl));
    }
  }
  return out;
}

test("1. no case-study page carries a pill class", () => {
  assert.ok(pageFiles.length >= 4, "expected the four case studies");
  for (const file of pageFiles) {
    const tokens = classTokens(read(pagesDir, file));
    for (const banned of ["pill", "pill-primary", "pill-secondary"]) {
      assert.ok(
        !tokens.includes(banned),
        `${file} still uses the ${banned} class`,
      );
    }
  }
});

test("2. every case-study page uses the site's primary button", () => {
  for (const file of pageFiles) {
    const source = read(pagesDir, file);
    const hasPrimary = [...source.matchAll(/class="([^"]*)"/g)].some((m) => {
      const tokens = m[1].split(/\s+/).filter(Boolean);
      return tokens.includes("btn") && tokens.includes("primary");
    });
    assert.ok(hasPrimary, `${file} has no "btn primary" button`);
  }
});

test("3. no stylesheet declares a .pill selector", () => {
  for (const url of cssFilesUnder(stylesDir)) {
    const source = readFileSync(url, "utf8");
    const hit = source.match(/^[^\n]*(?:^|[\s,>+~(])\.pill\b[^\n]*$/m);
    assert.ok(
      !hit,
      `${url.pathname.split("/src/")[1]} still selects the pill: ${hit && hit[0].trim()}`,
    );
  }
});

test("4. press-state.js is retired and unwired", () => {
  assert.ok(
    !existsSync(new URL("src/scripts/press-state.js", root)),
    "src/scripts/press-state.js should have moved to .archive/",
  );
  const site = readFileSync(new URL("src/scripts/site.js", root), "utf8");
  assert.ok(
    !site.includes("press-state"),
    "site.js still references press-state.js",
  );
});
