#!/usr/bin/env node
/**
 * Guards the type system's single source of truth.
 *
 * Rule: only styles.css may declare font-family, font-size, font-weight, or
 * line-height. Every other stylesheet consumes a role — either by the markup
 * carrying a `type-*` class, or by referencing a `--type-*` / `--weight-*`
 * custom property.
 *
 * The Mix.dialog condition-stack demo is the one sanctioned exception: it
 * simulates the product's own UI and owns a scoped `--sim-*` token set.
 *
 * Run with `npm run check:type`.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** styles.css owns the roles; the demo owns its scoped simulation tokens. */
const OWNERS = new Set(['styles.css', 'work/mix-dialog/condition-stack-demo.css']);

/* Scan declarations wherever they sit, not just at line starts — a rule
   collapsed onto one line must be caught too. */
const TYPE_PROPS = /(?:^|[{;])\s*(font-family|font-size|font-weight|line-height)\s*:\s*([^;}]+)/g;
const TOKEN_REF = /var\(\s*--(type|font|weight|track|sim|space)-/;

function cssFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', 'assets', 'public', 'references'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith('.css')) out.push(full);
  }
  return out;
}

const violations = [];

for (const file of cssFiles(ROOT)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  if (OWNERS.has(rel)) continue;

  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(TYPE_PROPS)) {
    const value = m[2].trim();
    if (TOKEN_REF.test(value)) continue;
    const line = src.slice(0, m.index).split('\n').length;
    violations.push(`${rel}:${line}  ${m[1]}: ${value}`);
  }
}

if (violations.length) {
  console.error(
    `\n✗ ${violations.length} type declaration(s) outside the type system:\n`
  );
  violations.forEach((v) => console.error('  ' + v));
  console.error(
    '\nUse a `type-*` class in the markup, or reference a role token.' +
      '\nRole definitions live in styles.css. See wiki/portfolio-font-and-style-guidelines.md.\n'
  );
  process.exit(1);
}

console.log('✓ type system intact — all type resolves through styles.css');
