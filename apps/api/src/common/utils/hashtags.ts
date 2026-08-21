/** Strips the leading `#`, lowercases and trims a hashtag. Returns null if empty. */
export function normalizeHashtag(tag: string): string | null {
  const normalized = tag.replace(/^#/, "").toLowerCase().trim();
  return normalized.length > 0 ? normalized : null;
}
