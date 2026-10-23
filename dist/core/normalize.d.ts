/** Lowercases and strips diacritics, so "Číslo" matches "cislo". */
export declare function normalize(value: string): string;
export interface NormalizedText {
    text: string;
    /** For every UTF-16 unit of `text`, the index of the source character it came from. */
    map: number[];
}
/** Normalizes `value` and keeps a map back to the original, for highlighting. */
export declare function normalizeWithMap(value: string): NormalizedText;
/** Splits a query into normalized terms. */
export declare function toTerms(query: string): string[];
