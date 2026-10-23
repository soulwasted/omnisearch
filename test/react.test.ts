import { expect, test } from "bun:test";
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { Omnisearch, type OmnisearchHandle } from "../src/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test("mounts, follows props and unmounts cleanly", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const ref = createRef<OmnisearchHandle>();

  await act(async () => {
    root.render(createElement(Omnisearch, { ref, items: [{ id: "a", label: "Alpha" }] }));
  });
  const host = document.querySelector("[data-omnisearch]")!;
  expect(host).not.toBeNull();

  act(() => ref.current!.open());
  expect(ref.current!.isOpen).toBe(true);

  await act(async () => {
    root.render(createElement(Omnisearch, { ref, items: [{ id: "b", label: "Beta" }] }));
  });
  expect(host.shadowRoot!.querySelector(".item-label")?.textContent).toBe("Beta");

  await act(async () => root.unmount());
  expect(document.querySelector("[data-omnisearch]")).toBeNull();
});
