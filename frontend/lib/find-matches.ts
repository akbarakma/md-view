/** Start offsets of every case-insensitive occurrence of `query` in `text`. */
export function findMatches(text: string, query: string): number[] {
  if (!query) return [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const offsets: number[] = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    offsets.push(idx);
    from = idx + needle.length;
  }
  return offsets;
}
