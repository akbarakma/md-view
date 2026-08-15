import LZString from "lz-string";

// New links compress with the browser-native deflate-raw codec (shorter URLs).
// `#s=` is the legacy LZString prefix — still decoded so old shared links open.
const PREFIX_DEFLATE = "#d=";
const PREFIX_LZ = "#s=";

export async function encodeShare(md: string): Promise<string> {
  const stream = new Blob([md])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return PREFIX_DEFLATE + toBase64Url(compressed);
}

export async function decodeShareFromHash(hash: string): Promise<string | null> {
  if (hash.startsWith(PREFIX_DEFLATE)) {
    try {
      const bytes = fromBase64Url(hash.slice(PREFIX_DEFLATE.length));
      const stream = new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      const text = await new Response(stream).text();
      return text || null;
    } catch {
      return null; // corrupt/truncated payload — fall through to the local draft
    }
  }
  if (hash.startsWith(PREFIX_LZ)) {
    return LZString.decompressFromEncodedURIComponent(hash.slice(PREFIX_LZ.length)) || null;
  }
  return null;
}

// `btoa(String.fromCharCode(...bytes))` overflows the call stack on large docs,
// so build the binary string in chunks before base64url-encoding.
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
