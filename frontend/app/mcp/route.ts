import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  dbErrorCode,
  documentUrls,
  markdownError,
  publicOrigin,
  publishDocument,
  readDocument,
  slugFromLink,
} from "@/lib/documents";
import { clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// nginx rejects bodies over 10 MB first; this only lifts the SDK's 4 MiB default above that.
const MAX_BODY_BYTES = 16 * 1024 * 1024;

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

function buildServer(origin: string, ip: string): McpServer {
  const server = new McpServer({ name: "md-view", version: "1.0.0" });

  server.registerTool(
    "create_document",
    {
      title: "Share a Markdown document",
      description:
        "Publish Markdown on md-view and get a public share link. Anyone with the link can read it. " +
        "Documents never change after creation: to revise one, create a new document. " +
        "Sharing identical content again returns the same link.",
      inputSchema: { markdown: z.string().min(1).describe("The full Markdown document.") },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ markdown }) => {
      const error = markdownError(markdown);
      if (error) return textResult(error, true);
      let slug: string | null;
      try {
        slug = await publishDocument(markdown, ip);
      } catch (err) {
        console.error("mcp create_document failed:", dbErrorCode(err));
        return textResult("Could not save the document. Try again later.", true);
      }
      if (slug === null) return textResult("Too many shared documents. Try again later.", true);
      const { url, rawUrl } = documentUrls(origin, slug);
      return textResult(`Share link: ${url}\nRaw Markdown: ${rawUrl}`);
    },
  );

  server.registerTool(
    "read_document",
    {
      title: "Read a shared Markdown document",
      description:
        "Return the Markdown source of an md-view share link, e.g. https://md.akbarakma.com/d/AbCdE12345.",
      inputSchema: {
        link: z.string().describe("A share link, its .md URL, or the bare 10-character id."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ link }) => {
      const slug = slugFromLink(link);
      if (!slug) return textResult(`Not an md-view share link: ${link}`, true);
      let content: string | null;
      try {
        content = await readDocument(slug);
      } catch (err) {
        console.error("mcp read_document failed:", dbErrorCode(err));
        return textResult("Could not read the document. Try again later.", true);
      }
      if (content === null) return textResult(`Document not found: ${slug}`, true);
      return textResult(content);
    },
  );

  return server;
}

// Stateless: no GET event stream or DELETE session teardown, so Next answers both with 405.
export async function POST(req: NextRequest): Promise<Response> {
  const server = buildServer(publicOrigin(req.headers), clientIp(req.headers));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  await server.connect(transport);
  return transport.handleRequest(req);
}
