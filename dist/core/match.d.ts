import type { OmnisearchItem } from "../types.js";
/** Half-open range `[start, end)` in the original label. */
export type Range = [number, number];
export interface Match {
    score: number;
    /** Matched parts of the label, for highlighting. Sorted, non-overlapping. */
    ranges: Range[];
}
/**
 * Scores an item against normalized query terms. Every term has to match
 * somewhere (label, keywords, description or group), otherwise returns null.
 * Label hits outrank keyword hits, which outrank description and group hits.
 */
export declare function matchItem(item: OmnisearchItem, terms: string[]): Match | null;
