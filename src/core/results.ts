import type { OmnisearchItem } from "../types";
import { matchItem, type Range } from "./match";
import { toTerms } from "./normalize";

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

function groupRows(rows: ResultRow[]): ResultGroup[] {
  const groups = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const name = row.item.group ?? "";
    const list = groups.get(name);
    if (list) list.push(row);
    else groups.set(name, [row]);
  }
  return [...groups].map(([name, rows]) => ({ name, rows }));
}

/**
 * Turns items and a query into grouped rows.
 *
 * Empty query: items keep their order (minus `searchOnly`), recent items first.
 * With a query: items are ranked by score, ties keep their order, and groups
 * are ordered by their best match.
 */
export function buildResults(
  items: OmnisearchItem[],
  query: string,
  options: BuildResultsOptions = {},
): ResultGroup[] {
  const terms = toTerms(query);

  if (terms.length === 0) {
    const byId = new Map(items.map((item) => [item.id, item]));
    const recent = (options.recentIds ?? [])
      .map((id) => byId.get(id))
      .filter((item): item is OmnisearchItem => item !== undefined && !item.disabled);
    const recentSet = new Set(recent);
    const rest = items.filter((item) => !item.searchOnly && !recentSet.has(item));
    const groups = groupRows(rest.map((item) => ({ item, ranges: [] })));
    if (recent.length === 0) return groups;
    return [
      { name: options.recentLabel ?? "Recent", rows: recent.map((item) => ({ item: { ...item, indent: false }, ranges: [] })) },
      ...groups,
    ];
  }

  const scored: { row: ResultRow; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const match = matchItem(item, terms);
    if (match) scored.push({ row: { item, ranges: match.ranges }, score: match.score, index });
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return groupRows(scored.slice(0, options.limit ?? 50).map((entry) => entry.row));
}
