#!/usr/bin/env node
/** Detect contract/policy edits against a trusted base; this is NOT an approval mechanism.
 * --report-only is for CI review notices. Required code-owner reviews must be
 * configured in GitHub branch protection before they can gate merging.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tokenSnapshot } from "./token-policy.mjs";

export const PROTECTED_FILES = [
  "scripts/typography-contract.mjs",
  "scripts/typography-contract.test.mjs",
  "scripts/check-typography.mjs",
  "scripts/typography-browser.html",
  "docs/typography-contract.md",
  "src/styles/tokens.css",
  "scripts/token-contract.json",
  "scripts/token-contract.sha256",
  "scripts/token-policy.mjs",
  "scripts/check-tokens.mjs",
  "scripts/check-tokens.test.mjs",
  "scripts/check-token-review.mjs",
  "scripts/check-token-review.test.mjs",
  "scripts/token-violations.txt",
  "package.json",
  "package-lock.json",
  ".github/CODEOWNERS",
  ".github/workflows/build.yml",
  ".github/workflows/deploy-pages.yml",
];
const comparable = (file, source) =>
  file === "src/styles/tokens.css" && source !== null
    ? JSON.stringify(tokenSnapshot(source))
    : source;
export function changedProtectedFiles(baseFiles, currentFiles) {
  return PROTECTED_FILES.filter(
    (file) =>
      comparable(file, baseFiles[file] ?? null) !==
      comparable(file, currentFiles[file] ?? null),
  );
}
export function main(argv = process.argv.slice(2)) {
  const root = new URL("../", import.meta.url).pathname;
  const arg = (name) =>
    argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined;
  const base = arg("--base");
  if (!base || base.startsWith("-")) {
    console.error(
      "Usage: npm run check:token-review -- --base <trusted-git-revision> [--report-only]",
    );
    return 2;
  }
  let revision;
  try {
    revision = execFileSync(
      "git",
      ["rev-parse", "--verify", `${base}^{commit}`],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch {
    console.error(`Cannot resolve trusted base revision: ${base}`);
    return 2;
  }
  const baseFiles = {},
    currentFiles = {};
  for (const file of PROTECTED_FILES) {
    try {
      baseFiles[file] = execFileSync("git", ["show", `${revision}:${file}`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      baseFiles[file] = null;
    }
    currentFiles[file] = existsSync(join(root, file))
      ? readFileSync(join(root, file), "utf8")
      : null;
  }
  const changed = changedProtectedFiles(baseFiles, currentFiles);
  if (!changed.length) {
    console.log(
      "token-review: protected contract and policy unchanged from trusted base.",
    );
    return 0;
  }
  console.log(
    `token-review: explicit human review required for changes since ${revision}:\n${changed.map((file) => `  ${file}`).join("\n")}`,
  );
  console.log(
    "A matching token digest only checks local integrity. It does not prove approval. GitHub required code-owner reviews must be configured separately.",
  );
  if (argv.includes("--report-only")) {
    console.log(
      "::notice title=Design contract review required::Protected design token or enforcement files changed. Review the listed files; local hashes do not approve design changes.",
    );
    return 0;
  }
  return 1;
}
if (process.argv[1]?.endsWith("check-token-review.mjs")) process.exit(main());
