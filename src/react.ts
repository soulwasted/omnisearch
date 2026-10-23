import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  createOmnisearch,
  type OmnisearchController,
  type OmnisearchOptions,
} from "@soulwasted/omnisearch";

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
export function Omnisearch({ ref, ...options }: OmnisearchProps): null {
  const controller = useRef<OmnisearchController | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    const instance = createOmnisearch(latest.current);
    controller.current = instance;
    return () => {
      instance.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.update(options);
  });

  useImperativeHandle(
    ref,
    () => ({
      open: (query?: string) => controller.current?.open(query),
      close: () => controller.current?.close(),
      toggle: () => controller.current?.toggle(),
      refresh: () => controller.current?.refresh(),
      get isOpen() {
        return controller.current?.isOpen ?? false;
      },
    }),
    [],
  );

  return null;
}
