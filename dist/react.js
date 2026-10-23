"use client";

// src/react.ts
import { useEffect, useImperativeHandle, useRef } from "react";
import {
  createOmnisearch
} from "./index.js";
import { openOmnisearch } from "./index.js";
function Omnisearch({ ref, ...options }) {
  const controller = useRef(null);
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
  useImperativeHandle(ref, () => ({
    open: (query) => controller.current?.open(query),
    close: () => controller.current?.close(),
    toggle: () => controller.current?.toggle(),
    refresh: () => controller.current?.refresh(),
    get isOpen() {
      return controller.current?.isOpen ?? false;
    }
  }), []);
  return null;
}
export {
  openOmnisearch,
  Omnisearch
};
