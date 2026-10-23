import type { OmnisearchItem } from "../types";
import { type Range } from "./match";
export interface ResultRow {
    item: OmnisearchItem;
    ranges: Range[];
}
export interface ResultGroup {
    /** Empty string for items without a group. */
    name: string;
    rows: ResultRow[];
}
export interface BuildResultsOptions {
    /** Item ids, most recent first. Listed in their own group when the query is empty. */
    recentIds?: string[];
    recentLabel?: string;
    /** Maximum number of rows while searching. */
    limit?: number;
}
/**
 * Turns items and a query into grouped rows.
 *
 * Empty query: items keep their order (minus `searchOnly`), recent items first.
 * With a query: items are ranked by score, ties keep their order, and groups
 * are ordered by their best match.
 */
export declare function buildResults(items: OmnisearchItem[], query: string, options?: BuildResultsOptions): ResultGroup[];
