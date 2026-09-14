import test from "node:test";
import assert from "node:assert/strict";
import {
  changedProtectedFiles,
  PROTECTED_FILES,
} from "./check-token-review.mjs";

test("coordinated token snapshot and digest edits still require review", () => {
  const base = {
    "src/styles/tokens.css": ":root{--space-1:12px}",
    "scripts/token-contract.json": "original",
    "scripts/token-contract.sha256": "original",
  };
  const current = {
    "src/styles/tokens.css": ":root{--space-1:13px}",
    "scripts/token-contract.json": "replacement",
    "scripts/token-contract.sha256": "replacement",
  };
  assert.deepEqual(changedProtectedFiles(base, current), [
    "src/styles/tokens.css",
    "scripts/token-contract.json",
    "scripts/token-contract.sha256",
  ]);
});
test("review protection includes its own policy and CI definitions", () => {
  for (const file of [
    "scripts/check-token-review.mjs",
    "scripts/token-policy.mjs",
    ".github/CODEOWNERS",
    ".github/workflows/build.yml",
  ]) {
    assert.ok(PROTECTED_FILES.includes(file));
    assert.deepEqual(
      changedProtectedFiles({ [file]: "old" }, { [file]: "new" }),
      [file],
    );
  }
});
test("comments alone do not change the token value contract", () => {
  assert.deepEqual(
    changedProtectedFiles(
      { "src/styles/tokens.css": ":root{--space-1:12px}" },
      {
        "src/styles/tokens.css": "/* clarified */\n:root { --space-1: 12px; }",
      },
    ),
    [],
  );
});
test("new or missing protected files require review", () => {
  assert.deepEqual(
    changedProtectedFiles({}, { "scripts/token-policy.mjs": "new" }),
    ["scripts/token-policy.mjs"],
  );
  assert.deepEqual(
    changedProtectedFiles({ "scripts/token-policy.mjs": "old" }, {}),
    ["scripts/token-policy.mjs"],
  );
});
