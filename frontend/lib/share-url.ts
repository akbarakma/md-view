import LZString from "lz-string";

const PREFIX = "#s=";

export function encodeShare(md: string): string {
  return PREFIX + LZString.compressToEncodedURIComponent(md);
}

export function decodeShareFromHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  const out = LZString.decompressFromEncodedURIComponent(hash.slice(PREFIX.length));
  return out || null;
}
