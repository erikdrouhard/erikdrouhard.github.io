#!/usr/bin/env node
/** Syntax-aware design-contract gate. This command never approves tokens or grows exemptions.
 * The reviewed token-contract.json freezes scope, names and values. Changing that file
 * requires explicit human approval; there is deliberately no snapshot-update CLI.
 * Legacy seed entries are prohibited now that migration is complete.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { scanSources } from "./token-policy.mjs";
export { scanSources, TYPE_ROLES, JS_TOKENS } from "./token-policy.mjs";
const ROOT = new URL("../", import.meta.url).pathname;
export function scanTree(root, options = {}) {
  const files = {};
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          ![".archive", "node_modules", ".git", "dist", ".astro"].includes(
            entry.name,
          )
        )
          walk(path);
      } else if (/\.(?:css|astro|mdx|html|[cm]?[jt]sx?)$/.test(entry.name))
        files[relative(root, path).split(sep).join("/")] = readFileSync(
          path,
          "utf8",
        );
    }
  }
  walk(join(root, "src"));
  walk(join(root, "public"));
  const contractPath = join(root, "scripts/token-contract.json");
  if (existsSync(contractPath) && options.contract === undefined)
    options = {
      ...options,
      contract: JSON.parse(readFileSync(contractPath, "utf8")).tokens,
    };
  return scanSources(files, options);
}
const key = (v) => `${v.file}\t${v.rule}\t${v.text}`;

function group(violations) {
  const counts = new Map();
  for (const v of violations) counts.set(key(v), (counts.get(key(v)) || 0) + 1);
  return counts;
}

/** Render violations in the seed format. */
export function serializeSeed(violations) {
  const counts = group(violations);
  const lines = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, n]) => {
      const [file, rule, text] = k.split("\t");
      return `${file}\t${rule}\t${n}\t${text}`;
    });
  return (
    "# path\\trule\\tcount\\ttext — see scripts/check-tokens.mjs.\n" +
    "# Historical format only. Entries cannot be added or regenerated.\n" +
    lines.join("\n") +
    (lines.length ? "\n" : "")
  );
}

/**
 * Parse a seed. Pass the text directly, or a path to read it from.
 * A missing file is an empty seed, so the check still fails on new drift.
 */
export function readSeed(text, path) {
  let body = text;
  if (typeof body !== "string") {
    if (!path || !existsSync(path)) return [];
    body = readFileSync(path, "utf8");
  }
  const out = [];
  for (const line of body.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [file, rule, count, ...rest] = line.split("\t");
    out.push({ file, rule, count: Number(count), text: rest.join("\t") });
  }
  return out;
}

/** Compare a scan against a seed. New drift and stale entries both fail. */
export function compareToSeed(violations, seed) {
  const found = group(violations);
  const allowed = new Map(
    seed.map((s) => [`${s.file}\t${s.rule}\t${s.text}`, s.count]),
  );

  const unlisted = [];
  for (const [k, n] of found) {
    const cap = allowed.get(k) || 0;
    if (n > cap) {
      const [file, rule, text] = k.split("\t");
      const example = violations.find((v) => key(v) === k);
      unlisted.push({
        file,
        rule,
        text,
        line: example.line,
        extra: n - cap,
      });
    }
  }

  const stale = [];
  for (const [k, n] of allowed) {
    const now = found.get(k) || 0;
    if (now < n) {
      const [file, rule, text] = k.split("\t");
      stale.push({ file, rule, text, gone: n - now });
    }
  }

  const ok = unlisted.length === 0 && stale.length === 0;
  return {
    ok,
    unlisted,
    stale,
    summary: ok
      ? `all ${violations.length} violations are seeded`
      : `${unlisted.length} unlisted, ${stale.length} stale`,
  };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--write")) {
    console.error(
      "check-tokens: --write is disabled. Fix violations; token-contract changes require explicit human approval.",
    );
    return 1;
  }
  const arg = (name, fallback) =>
    argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback;
  const root = arg("--root", ROOT);
  const seedPath = arg("--seed", join(root, "scripts/token-violations.txt"));
  const seed = readSeed(null, seedPath);
  if (seed.length) {
    console.error(
      "check-tokens: seed expansion is prohibited; all violations must be fixed.",
    );
    return 1;
  }
  const contractPath = join(root, "scripts/token-contract.json");
  if (!existsSync(contractPath)) {
    console.error("check-tokens: missing reviewed token contract.");
    return 1;
  }
  const contractText = readFileSync(contractPath, "utf8");
  const expectedHash = readFileSync(
    new URL("./token-contract.sha256", import.meta.url),
    "utf8",
  ).trim();
  if (
    createHash("sha256").update(contractText).digest("hex") !== expectedHash
  ) {
    console.error(
      "check-tokens: token contract changed. Explicit human approval is required before updating its pinned digest.",
    );
    return 1;
  }
  const violations = scanTree(root);
  for (const v of violations)
    console.error(`${v.file}:${v.line}  ${v.rule}  ${v.text}`);
  console.log(
    `check-tokens: ${violations.length ? "FAIL" : "PASS"} — ${violations.length} violations; reviewed token contract checked`,
  );
  return violations.length ? 1 : 0;
}
if (process.argv[1] && process.argv[1].endsWith("check-tokens.mjs"))
  process.exit(main());
