import { describe, expect, test } from "bun:test";
import { buildResults, formatHotkey, matchesHotkey, matchItem, normalize, parseHotkey } from "../src/index";
import type { OmnisearchItem } from "../src/index";

const item = (label: string, extra: Partial<OmnisearchItem> = {}): OmnisearchItem => ({ id: label, label, ...extra });
const terms = (query: string) => normalize(query).split(/\s+/).filter(Boolean);

describe("normalize", () => {
  test("strips diacritics and lowercases", () => {
    expect(normalize("Žluťoučký Kůň")).toBe("zlutoucky kun");
  });
});

describe("matchItem", () => {
  test("matches without diacritics and maps highlight back to the original label", () => {
    const match = matchItem(item("Číselník úkolů"), terms("ukol"));
    expect(match).not.toBeNull();
    expect(match?.ranges).toEqual([[9, 13]]);
  });

  test("requires every term to match", () => {
    expect(matchItem(item("Design system"), terms("design stack"))).toBeNull();
    expect(matchItem(item("Design system"), terms("sys des"))).not.toBeNull();
  });

  test("ranks label prefix over word start over substring", () => {
    const prefix = matchItem(item("Settings"), terms("set"))!.score;
    const wordStart = matchItem(item("Quick settings"), terms("set"))!.score;
    const substring = matchItem(item("Reset"), terms("set"))!.score;
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(substring);
  });

  test("falls back to keywords, description and group without highlights", () => {
    const keyword = matchItem(item("Theme", { keywords: ["dark", "light"] }), terms("dark"));
    const description = matchItem(item("Theme", { description: "Dark or light" }), terms("dark"));
    expect(keyword?.ranges).toEqual([]);
    expect(keyword!.score).toBeGreaterThan(description!.score);
  });

  test("matches initials as a subsequence starting at a word", () => {
    expect(matchItem(item("Design system"), terms("ds"))?.ranges).toEqual([[0, 1], [7, 8]]);
    expect(matchItem(item("Design system"), terms("sd"))).toBeNull();
  });
});

describe("buildResults", () => {
  const items = [
    item("Home", { group: "Pages" }),
    item("Settings", { group: "Pages" }),
    item("Dark mode", { group: "Appearance" }),
    item("Delete account", { group: "Danger", searchOnly: true }),
  ];

  test("keeps order and groups without a query, hiding searchOnly items", () => {
    const groups = buildResults(items, "");
    expect(groups.map((group) => group.name)).toEqual(["Pages", "Appearance"]);
    expect(groups[0]!.rows.map((row) => row.item.label)).toEqual(["Home", "Settings"]);
  });

  test("shows searchOnly items once searching and orders groups by best match", () => {
    const groups = buildResults(items, "de");
    expect(groups[0]!.name).toBe("Danger");
  });

  test("lists recent items first and only once", () => {
    const groups = buildResults(items, "", { recentIds: ["Dark mode", "missing"], recentLabel: "Recent" });
    expect(groups[0]).toMatchObject({ name: "Recent", rows: [{ item: { id: "Dark mode" } }] });
    expect(groups.map((group) => group.name)).toEqual(["Recent", "Pages"]);
  });

  test("limits search results", () => {
    const many = Array.from({ length: 80 }, (_, index) => item(`Page ${index}`));
    expect(buildResults(many, "page", { limit: 10 })[0]!.rows).toHaveLength(10);
  });
});

describe("hotkeys", () => {
  const event = (key: string, extra: Partial<KeyboardEvent> = {}) =>
    ({ key, code: `Key${key.toUpperCase()}`, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra }) as KeyboardEvent;

  test("mod matches both Cmd and Ctrl", () => {
    const hotkey = parseHotkey("mod+k");
    expect(matchesHotkey(event("k", { metaKey: true }), hotkey)).toBe(true);
    expect(matchesHotkey(event("k", { ctrlKey: true }), hotkey)).toBe(true);
    expect(matchesHotkey(event("k"), hotkey)).toBe(false);
    expect(matchesHotkey(event("K", { metaKey: true, shiftKey: true }), hotkey)).toBe(false);
  });

  test("bare keys reject modifiers", () => {
    const slash = parseHotkey("/");
    expect(matchesHotkey(event("/"), slash)).toBe(true);
    expect(matchesHotkey(event("/", { metaKey: true }), slash)).toBe(false);
  });

  test("formats per platform", () => {
    expect(formatHotkey(parseHotkey("mod+k"), true)).toBe("⌘K");
    expect(formatHotkey(parseHotkey("shift+mod+p"), false)).toBe("Ctrl Shift P");
  });
});
