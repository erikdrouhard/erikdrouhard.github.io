import { getCollection, type CollectionEntry } from "astro:content";

export type WorkEntry = CollectionEntry<"work">;

/* One ordering for the whole site. Drafts never reach a listing, so the
   "04 entries" count on the home page is computed from the same list that
   renders the cards and can never drift from it. */
export async function getPublishedWork(): Promise<WorkEntry[]> {
  const entries = await getCollection("work", ({ data }) => data.draft !== true);
  return entries.sort((a, b) => a.data.order - b.data.order);
}

/* The home page shows the first four; the work index shows everything. */
export async function getFeaturedWork(): Promise<WorkEntry[]> {
  return (await getPublishedWork()).slice(0, 4);
}

export function neighbours(entries: WorkEntry[], id: string) {
  const i = entries.findIndex((e) => e.id === id);
  return {
    prev: i > 0 ? entries[i - 1] : undefined,
    next: i >= 0 && i < entries.length - 1 ? entries[i + 1] : undefined,
  };
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
