export interface Hotkey {
    key: string;
    mod: boolean;
    shift: boolean;
    alt: boolean;
}
type KeyEventLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;
/** Parses "mod+k", "shift+mod+p" or "/". `mod` is Cmd on macOS and Ctrl elsewhere. */
export declare function parseHotkey(spec: string): Hotkey;
export declare function matchesHotkey(event: KeyEventLike, hotkey: Hotkey): boolean;
export declare function isMac(): boolean;
/** Display label, e.g. "⌘K" on macOS and "Ctrl K" elsewhere. */
export declare function formatHotkey(hotkey: Hotkey, mac?: boolean): string;
export {};
