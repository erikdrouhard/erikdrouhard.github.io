import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const experimentsRoot = resolve(root, "experiments");
const entries = await readdir(experimentsRoot, { withFileTypes: true });
const pages = [resolve(experimentsRoot, "index.html")];

for (const entry of entries) {
  if (entry.isDirectory() && !entry.name.startsWith("_")) {
    pages.push(resolve(experimentsRoot, entry.name, "index.html"));
  }
}

const failures = [];

for (const page of pages) {
  let source;
  try {
    source = await readFile(page, "utf8");
  } catch {
    failures.push(`${page}: missing index.html`);
    continue;
  }

  if (!/<meta\s+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(source)) {
    failures.push(`${page}: missing robots noindex directive`);
  }

  if (page !== pages[0]) {
    if (!/<a[^>]+href=["']\/["'][^>]+aria-label=["']Homepage["']/i.test(source)) {
      failures.push(`${page}: missing homepage logo link`);
    }

    if (!/<a[^>]+href=["']\/experiments\/["']/i.test(source)) {
      failures.push(`${page}: missing back-to-experiments link`);
    }

    if (!/<main(?:\s|>)/i.test(source)) {
      failures.push(`${page}: missing main landmark`);
    }
  }
}

if (failures.length) {
  console.error(`Experiment contract failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log(`Experiment contract passed for ${pages.length} pages.`);
