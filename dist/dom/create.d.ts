import type { OmnisearchController, OmnisearchOptions, OmnisearchStrings } from "../types";
/** Window event that opens every palette on the page. `detail.query` prefills the input. */
export declare const OPEN_EVENT = "omnisearch:open";
export declare const DEFAULT_STRINGS: OmnisearchStrings;
/** Opens every palette on the page, optionally with a prefilled query. */
export declare function openOmnisearch(query?: string): void;
/**
 * Creates a command palette and appends its (hidden) host element to the page.
 * Call it in the browser only; in SSR frameworks call it from an effect.
 */
export declare function createOmnisearch(initialOptions?: OmnisearchOptions): OmnisearchController;
