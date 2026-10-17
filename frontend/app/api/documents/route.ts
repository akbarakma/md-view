import type { NextRequest } from "next/server";
import { dbErrorCode, documentUrls, markdownError, publishDocument, publicOrigin } from "@/lib/documents";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Body must be JSON." }, { status: 400 });
  }
  const markdown = (body as { markdown?: unknown } | null)?.markdown;
  const error = markdownError(markdown);
  if (error) return Response.json({ detail: error }, { status: 422 });

  let slug: string | null;
  try {
    slug = await publishDocument(markdown as string, clientIp(req.headers));
  } catch (err) {
    console.error("create document failed:", dbErrorCode(err));
    return Response.json({ detail: "Could not save the document." }, { status: 500 });
  }
  if (slug === null) {
    return Response.json({ detail: "Too many shared documents. Try again later." }, { status: 429 });
  }
  return Response.json(documentUrls(publicOrigin(req.headers), slug), { status: 201 });
}
