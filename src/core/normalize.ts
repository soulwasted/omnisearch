/** Lowercases and strips diacritics, so "Číslo" matches "cislo". */
export function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export interface NormalizedText {
  text: string;
  /** For every UTF-16 unit of `text`, the index of the source character it came from. */
  map: number[];
}

/** Normalizes `value` and keeps a map back to the original, for highlighting. */
export function normalizeWithMap(value: string): NormalizedText {
  let text = "";
  const map: number[] = [];
  let index = 0;
  for (const char of value) {
    const normalized = normalize(char);
    for (let i = 0; i < normalized.length; i++) map.push(index);
    text += normalized;
    index += char.length;
  }
  return { text, map };
}

/** Splits a query into normalized terms. */
export function toTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}
