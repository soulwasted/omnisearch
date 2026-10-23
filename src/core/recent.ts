// Storage can be missing or throw (private mode, blocked cookies), so every access is guarded.

export function readRecent(storageKey: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(storageKey: string, id: string, limit: number): void {
  const next = [id, ...readRecent(storageKey).filter((existing) => existing !== id)].slice(0, limit);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Recent history is a convenience; losing it is fine.
  }
}
