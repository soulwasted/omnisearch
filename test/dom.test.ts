import { afterEach, describe, expect, mock, test } from "bun:test";
import { createOmnisearch, openOmnisearch } from "../src/index.js";
import type { OmnisearchController, OmnisearchItem, OmnisearchOptions } from "../src/index.js";

let palette: OmnisearchController | undefined;

afterEach(() => {
  palette?.destroy();
  palette = undefined;
  document.body.innerHTML = "";
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

const items: OmnisearchItem[] = [
  { id: "home", label: "Home", group: "Pages", href: "/" },
  { id: "settings", label: "Settings", group: "Pages", href: "/settings", active: true },
  { id: "docs", label: "Docs", group: "Links", href: "https://example.com", external: true },
];

function setup(options: OmnisearchOptions = {}) {
  palette = createOmnisearch({ items, ...options });
  const root = palette.element.shadowRoot!;
  const input = root.querySelector("input")!;
  return {
    root,
    input,
    options: () => [...root.querySelectorAll<HTMLElement>('[role="option"]')],
    labels: () => [...root.querySelectorAll(".item-label")].map((label) => label.textContent),
    selected: () => root.querySelector('[aria-selected="true"] .item-label')?.textContent,
    type(value: string) {
      input.value = value;
      input.dispatchEvent(new Event("input"));
    },
    key(key: string, extra: KeyboardEventInit = {}) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, ...extra }));
    },
  };
}

const pressGlobal = (key: string, extra: KeyboardEventInit = {}) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key, code: `Key${key.toUpperCase()}`, bubbles: true, ...extra }));

describe("opening and closing", () => {
  test("Cmd+K and Ctrl+K toggle the palette", () => {
    setup();
    expect(palette!.isOpen).toBe(false);
    pressGlobal("k", { metaKey: true });
    expect(palette!.isOpen).toBe(true);
    expect(palette!.element.hidden).toBe(false);
    pressGlobal("k", { ctrlKey: true });
    expect(palette!.isOpen).toBe(false);
  });

  test("Escape closes and restores focus", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const ui = setup();
    palette!.open();
    expect(ui.root.activeElement).toBe(ui.input);
    ui.key("Escape");
    expect(palette!.isOpen).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  test("[data-omnisearch-open] triggers and the window event open it with a query", () => {
    const ui = setup();
    const trigger = document.createElement("button");
    trigger.setAttribute("data-omnisearch-open", "set");
    document.body.append(trigger);
    trigger.click();
    expect(palette!.isOpen).toBe(true);
    expect(ui.input.value).toBe("set");
    palette!.close();
    openOmnisearch("docs");
    expect(ui.input.value).toBe("docs");
  });

  test("bare-key hotkeys are ignored while typing in a field", () => {
    setup({ hotkey: ["mod+k", "/"] });
    const field = document.createElement("input");
    document.body.append(field);
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true, composed: true }));
    expect(palette!.isOpen).toBe(false);
    pressGlobal("/");
    expect(palette!.isOpen).toBe(true);
  });

  test("locks page scroll while open", () => {
    setup();
    palette!.open();
    expect(document.documentElement.style.overflow).toBe("hidden");
    palette!.close();
    expect(document.documentElement.style.overflow).toBe("");
  });
});

describe("searching and selecting", () => {
  test("filters, highlights and announces results", () => {
    const ui = setup();
    palette!.open();
    expect(ui.labels()).toEqual(["Home", "Settings", "Docs"]);
    ui.type("sett");
    expect(ui.labels()).toEqual(["Settings"]);
    expect(ui.root.querySelector("mark")?.textContent).toBe("Sett");
    expect(ui.root.querySelector('[role="status"]')?.textContent).toBe("1 results");
    ui.type("zzz");
    expect(ui.root.querySelector(".empty")?.textContent).toBe("No results");
  });

  test("arrow keys wrap and keep aria-activedescendant in sync", () => {
    const ui = setup();
    palette!.open();
    expect(ui.selected()).toBe("Home");
    ui.key("ArrowUp");
    expect(ui.selected()).toBe("Docs");
    ui.key("ArrowDown");
    expect(ui.selected()).toBe("Home");
    const active = ui.root.querySelector('[aria-selected="true"]')!;
    expect(ui.input.getAttribute("aria-activedescendant")).toBe(active.id);
  });

  test("Enter navigates through the router hook", () => {
    const navigate = mock();
    const ui = setup({ navigate });
    palette!.open();
    ui.key("ArrowDown");
    ui.key("Enter");
    expect(navigate).toHaveBeenCalledWith("/settings", items[1]);
    expect(palette!.isOpen).toBe(false);
  });

  test("external links and Cmd+Enter open a new tab", () => {
    const open = mock();
    window.open = open as unknown as typeof window.open;
    const ui = setup({ navigate: mock() });
    palette!.open();
    ui.key("Enter", { metaKey: true });
    expect(open).toHaveBeenCalledWith("/", "_blank", "noopener,noreferrer");
  });

  test("perform runs after closing and receives the context", async () => {
    let seen: { query: string; wasOpen: boolean } | undefined;
    const ui = setup({
      items: [{ id: "run", label: "Run task", perform: (context) => void (seen = { query: context.query, wasOpen: palette!.isOpen }) }],
    });
    palette!.open();
    ui.type("run");
    ui.key("Enter");
    await Promise.resolve();
    expect(seen).toEqual({ query: "run", wasOpen: false });
  });

  test("toggles stay open and re-read function items", async () => {
    let dark = false;
    const ui = setup({
      items: () => [{ id: "dark", label: "Dark mode", checked: dark, perform: () => void (dark = !dark) }],
    });
    palette!.open();
    expect(ui.root.querySelector(".switch")?.hasAttribute("data-on")).toBe(false);
    ui.key("Enter");
    await Promise.resolve();
    expect(palette!.isOpen).toBe(true);
    expect(ui.root.querySelector(".switch")?.hasAttribute("data-on")).toBe(true);
  });

  test("skips disabled items", () => {
    const ui = setup({
      items: [
        { id: "a", label: "Alpha", disabled: true },
        { id: "b", label: "Beta" },
      ],
    });
    palette!.open();
    expect(ui.selected()).toBe("Beta");
    ui.key("ArrowDown");
    expect(ui.selected()).toBe("Beta");
  });

  test("shows the active badge", () => {
    const ui = setup();
    palette!.open();
    expect(ui.options()[1]?.querySelector(".badge")?.textContent).toBe("Current");
  });

  test("remembers recent selections", () => {
    const ui = setup({ recent: true, navigate: () => {} });
    palette!.open();
    ui.type("docs");
    ui.key("Enter");
    palette!.open();
    expect(ui.root.querySelector(".group-label")?.textContent).toBe("Recent");
    expect(ui.labels()[0]).toBe("Docs");
  });
});

describe("async sources", () => {
  test("debounces, aborts stale requests and appends results", async () => {
    const signals: AbortSignal[] = [];
    const ui = setup({
      sources: [
        {
          id: "remote",
          group: "Remote",
          debounce: 5,
          search: async (query, signal) => {
            signals.push(signal);
            return [{ id: `r-${query}`, label: `Result for ${query}` }];
          },
        },
      ],
    });
    palette!.open();
    ui.type("ab");
    ui.type("abc");
    expect(ui.root.querySelector(".spinner")?.hasAttribute("hidden")).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(signals).toHaveLength(1);
    expect(ui.labels()).toContain("Result for abc");
    expect(ui.root.querySelector(".group-label")?.textContent).toBe("Remote");
    expect(ui.root.querySelector(".spinner")?.hasAttribute("hidden")).toBe(true);
  });
});

describe("theme", () => {
  test("follows the page theme marker", async () => {
    setup();
    expect(palette!.element.getAttribute("data-scheme")).toBe("light");
    document.documentElement.classList.add("dark");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(palette!.element.getAttribute("data-scheme")).toBe("dark");
    palette!.update({ theme: "light" });
    expect(palette!.element.getAttribute("data-scheme")).toBe("light");
  });
});
