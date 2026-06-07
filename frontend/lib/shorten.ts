const BASE = process.env.NEXT_PUBLIC_SHORTENER_BASE_URL ?? "https://short.akbarakma.tech";

/** Shorten a long URL via the shorten-url service. Returns the short link. */
export async function shortenUrl(longUrl: string): Promise<string> {
  const res = await fetch(`${BASE}/api/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: longUrl }),
  });
  if (!res.ok) throw new Error(`shorten failed: ${res.status}`);
  const { code } = (await res.json()) as { code: string };
  return `${BASE}/${code}`;
}
