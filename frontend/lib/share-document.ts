export type ShareResult = { url: string } | { error: "too-large" | "failed" };

export async function shareDocument(markdown: string): Promise<ShareResult> {
  try {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });
    if (res.status === 413) return { error: "too-large" };
    if (!res.ok) return { error: "failed" };
    const { url } = (await res.json()) as { url: string };
    return { url };
  } catch {
    return { error: "failed" };
  }
}
