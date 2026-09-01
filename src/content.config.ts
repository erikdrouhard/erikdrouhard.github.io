import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/* Card metadata for the home-page grid — and nothing else.

   The four published studies are hand-written pages under src/pages/work/;
   their prose, meta and figures live there. So these entries carry no body and
   the schema keeps only what WorkCard and the home page actually read. The
   fields the retired MDX template rendered (description, role, team, timeline,
   metric) are gone: a field nothing renders is a field that quietly goes stale.
   The originals are in .archive/src/content/work/ if any of it is wanted back.

   `draft: true` keeps an entry out of the grid and off the entry count while
   its copy is still a stub. */
const work = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/work" }),
  schema: z.object({
    title: z.string(),
    org: z.string(), // display string, e.g. "Nuance · 2021–2023"
    summary: z.string(), // card blurb
    featured: z.boolean().default(false),
    order: z.number(),
    key: z.string().length(1), // keycap on the card, resolved by keys.js
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
