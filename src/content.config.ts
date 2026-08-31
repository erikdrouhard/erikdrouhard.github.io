import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/* Work entries drive the homepage grid, the work index, the case pages, and
   the prev/next sequence. `order` is the single sequence for all four, so a
   card cannot appear in one order on the home page and another in the nav.

   `draft: true` keeps an entry out of every listing and off the sitemap while
   its content is still a stub. Launch ships the four real studies. */
const work = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/work" }),
  schema: z.object({
    title: z.string(),
    org: z.string(), // display string, e.g. "Nuance · 2021–2023"
    summary: z.string(), // card blurb
    description: z.string().optional(), // <meta name="description">
    featured: z.boolean().default(false),
    order: z.number(),
    key: z.string().length(1), // keyboard shortcut on the work index
    // case-meta grid. Omitted rather than guessed — an absent field renders
    // no cell, which is the honest result when the source never said.
    role: z.string().optional(),
    team: z.string().optional(),
    timeline: z.string().optional(),
    // renders a metric bar. Present only where a real number exists.
    metric: z.object({ label: z.string(), value: z.number().min(0).max(100) }).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
