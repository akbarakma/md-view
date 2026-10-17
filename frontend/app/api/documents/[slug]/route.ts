import type { NextRequest } from "next/server";
import { readDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[slug]">) {
  const { slug } = await ctx.params;
  const content = await readDocument(slug);
  if (content === null) {
    return new Response("Document not found.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(content, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
