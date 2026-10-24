import type { OmnisearchItem } from "../types.js";
import { normalize, normalizeWithMap, type NormalizedText } from "./normalize.js";

/** Half-open range `[start, end)` in the original label. */
export type Range = [number, number];

export interface Match {
  score: number;
  /** Matched parts of the label, for highlighting. Sorted, non-overlapping. */
  ranges: Range[];
}

interface Prepared {
  key: string;
  label: NormalizedText;
  keywords: string;
  description: string;
  group: string;
}

const cache = new WeakMap<OmnisearchItem, Prepared>();

function prepare(item: OmnisearchItem): Prepared {
  const keywords = Array.isArray(item.keywords) ? item.keywords.join(" ") : (item.keywords ?? "");
  const key = [item.label, item.description ?? "", keywords, item.group ?? ""].join("\u0000");
  const cached = cache.get(item);
  if (cached?.key === key) return cached;
  const prepared: Prepared = {
    key,
    label: normalizeWithMap(item.label),
    keywords: normalize(keywords),
    description: normalize(item.description ?? ""),
    group: normalize(item.group ?? ""),
  };
  cache.set(item, prepared);
  return prepared;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordStart(text: string, index: number): boolean {
  return index === 0 || !WORD_CHAR.test(text[index - 1] ?? "");
}

/** Index of the first occurrence of `term` that starts a word, or -1. */
function findWordStart(text: string, term: string): number {
  let index = text.indexOf(term);
  while (index !== -1) {
    if (isWordStart(text, index)) return index;
    index = text.indexOf(term, index + 1);
  }
  return -1;
}

/**
 * Matches `term` as an abbreviation of `text`: word prefixes in order, so
 * "ds" and "desys" find "Design system". Every character either continues the
 * previous one or starts a new word, which keeps long labels from matching
 * letters scattered across them.
 */
function abbreviation(text: string, term: string): number[] | null {
  const walk = (position: number, previous: number): number[] | null => {
    if (position === term.length) return [];
    const char = term[position] ?? "";
    if (previous >= 0 && text[previous + 1] === char) {
      const rest = walk(position + 1, previous + 1);
      if (rest) return [previous + 1, ...rest];
    }
    for (let i = text.indexOf(char, previous + 1); i !== -1; i = text.indexOf(char, i + 1)) {
      // previous + 1 was already tried as a continuation above.
      if ((previous >= 0 && i === previous + 1) || !isWordStart(text, i)) continue;
      const rest = walk(position + 1, i);
      if (rest) return [i, ...rest];
    }
    return null;
  };
  return walk(0, -1);
}

function toOriginalRanges(ranges: Range[], label: string, map: number[]): Range[] {
  const mapped = ranges
    .map(([start, end]): Range => {
      const from = map[start] ?? 0;
      const last = map[end - 1] ?? from;
      const lastLength = (label.codePointAt(last) ?? 0) > 0xffff ? 2 : 1;
      return [from, last + lastLength];
    })
    .sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const range of mapped) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

/**
 * Scores an item against normalized query terms. Every term has to match
 * somewhere (label, keywords, description or group), otherwise returns null.
 * Label hits outrank keyword hits, which outrank description and group hits.
 */
export function matchItem(item: OmnisearchItem, terms: string[]): Match | null {
  if (terms.length === 0) return { score: 0, ranges: [] };
  const prepared = prepare(item);
  const label = prepared.label.text;
  const hits: Range[] = [];
  let score = label === terms.join(" ") ? 1000 : 0;

  for (const term of terms) {
    let termScore = 0;
    const wordStart = findWordStart(label, term);
    const anywhere = wordStart === -1 ? label.indexOf(term) : wordStart;
    if (anywhere !== -1) {
      termScore = anywhere === 0 ? 100 : wordStart !== -1 ? 60 : 30;
      hits.push([anywhere, anywhere + term.length]);
    } else if (findWordStart(prepared.keywords, term) !== -1) {
      termScore = 20;
    } else if (prepared.keywords.includes(term)) {
      termScore = 12;
    } else if (prepared.description.includes(term)) {
      termScore = 6;
    } else if (prepared.group.includes(term)) {
      termScore = 4;
    } else if (term.length >= 2) {
      const indices = abbreviation(label, term);
      if (indices) {
        termScore = 2;
        for (const index of indices) hits.push([index, index + 1]);
      }
    }
    if (termScore === 0) return null;
    score += termScore;
  }

  return { score, ranges: toOriginalRanges(hits, item.label, prepared.label.map) };
}
