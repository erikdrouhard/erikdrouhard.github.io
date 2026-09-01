import { getCollection, type CollectionEntry } from "astro:content";

export type WorkEntry = CollectionEntry<"work">;

/* One ordering, one listing. The home-page grid is now the only place work is
   listed, so it renders every published entry rather than a featured slice —
   a cap here would silently hide the fifth study from the whole site. Drafts
   never reach it, so the "04 entries" count is computed from the same list
   that renders the cards and can never drift from it. */
export async function getPublishedWork(): Promise<WorkEntry[]> {
  const entries = await getCollection("work", ({ data }) => data.draft !== true);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
