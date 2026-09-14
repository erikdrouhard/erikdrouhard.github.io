// @ts-check
import { existsSync, mkdtempSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

/**
 * The retired stylesheets, components, and experiments live at
 * `public/.archive/` — renamed rather than deleted, per the workspace rule and
 * the `public/` section of `.scratch/design-system-remediation/DESIGN-SYSTEM.md`.
 * Astro copies everything under `public/` verbatim, dotfolders included, so
 * without this the archive ships and the old system is served alongside the
 * new one at a live URL. Kept on disk, dropped from the build.
 */
function dropPublicArchive() {
  /** @type {import("astro").AstroIntegration} */
  const integration = {
    name: "drop-public-archive",
    hooks: {
      "astro:build:done": ({ dir }) => {
        const archive = fileURLToPath(new URL(".archive", dir));
        if (existsSync(archive)) {
          // Preserve generated copies too: retirement never deletes originals.
          const destination = mkdtempSync(join(tmpdir(), "portfolio-build-archive-"));
          renameSync(archive, join(destination, ".archive"));
        }
      },
    },
  };
  return integration;
}

// erikdrouhard.github.io is a GitHub *user* site, so it is served from the
// domain root. No `base` path — adding one would break every absolute
// /work/... and /assets/... URL the old site already published.
export default defineConfig({
  site: "https://erikdrouhard.github.io",
  integrations: [mdx(), dropPublicArchive()],
  build: { format: "directory" },
  redirects: {
    // The Copilot Studio + CoreAI story lives at /work/microsoft/ now.
    // This route shipped on the old site; it must not 404.
    "/work/core-ai": "/work/microsoft/",
  },
});
