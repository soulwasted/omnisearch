export interface Hotkey {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

type KeyEventLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

/** Parses "mod+k", "shift+mod+p" or "/". `mod` is Cmd on macOS and Ctrl elsewhere. */
export function parseHotkey(spec: string): Hotkey {
  const parts = spec.toLowerCase().split("+").map((part) => part.trim());
  const key = parts.pop() || "+";
  return {
    key,
    mod: parts.some((part) => part === "mod" || part === "cmd" || part === "meta" || part === "ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
  };
}

export function matchesHotkey(event: KeyEventLike, hotkey: Hotkey): boolean {
  const isLetter = /^[a-z]$/.test(hotkey.key);
  const key = event.key.toLowerCase();
  // Option+letter produces a different character on macOS, so fall back to the physical key.
  const keyMatches = key === hotkey.key || (isLetter && event.code === `Key${hotkey.key.toUpperCase()}`);
  if (!keyMatches) return false;
  if ((event.metaKey || event.ctrlKey) !== hotkey.mod) return false;
  if (event.altKey !== hotkey.alt) return false;
  // Shift is only enforced for letters: "/" or "?" need it on some layouts and not on others.
  if (hotkey.shift && !event.shiftKey) return false;
  if (!hotkey.shift && isLetter && event.shiftKey) return false;
  return true;
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Display label, e.g. "⌘K" on macOS and "Ctrl K" elsewhere. */
export function formatHotkey(hotkey: Hotkey, mac = isMac()): string {
  const key = hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key;
  if (mac) return `${hotkey.alt ? "⌥" : ""}${hotkey.shift ? "⇧" : ""}${hotkey.mod ? "⌘" : ""}${key}`;
  return [hotkey.mod && "Ctrl", hotkey.alt && "Alt", hotkey.shift && "Shift", key].filter(Boolean).join(" ");
}
