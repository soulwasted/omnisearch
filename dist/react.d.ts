import { type Ref } from "react";
import { type OmnisearchController, type OmnisearchOptions } from "@soulwasted/omnisearch";
export { openOmnisearch } from "@soulwasted/omnisearch";
export type { OmnisearchItem, OmnisearchOptions, OmnisearchSource, OmnisearchController } from "@soulwasted/omnisearch";
/** Imperative handle exposed through `ref`. */
export type OmnisearchHandle = Pick<OmnisearchController, "open" | "close" | "toggle" | "refresh" | "isOpen">;
export interface OmnisearchProps extends OmnisearchOptions {
    ref?: Ref<OmnisearchHandle>;
}
/**
 * Mounts the palette for the lifetime of the component. Renders nothing itself.
 * Props are applied on every render, so `items` can be derived from state directly.
 */
export declare function Omnisearch({ ref, ...options }: OmnisearchProps): null;
