// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

// erikdrouhard.github.io is a GitHub *user* site, so it is served from the
// domain root. No `base` path — adding one would break every absolute
// /work/... and /assets/... URL the old site already published.
export default defineConfig({
  site: "https://erikdrouhard.github.io",
  integrations: [mdx()],
  build: { format: "directory" },
  redirects: {
    // The Copilot Studio + CoreAI story lives at /work/microsoft/ now.
    // This route shipped on the old site; it must not 404.
    "/work/core-ai": "/work/microsoft/",
  },
});
