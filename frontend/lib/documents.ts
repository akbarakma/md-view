import { createHash, randomInt } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { reserveCreate } from "@/lib/rate-limit";

const SLUG_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 10;
const SLUG_PATTERN = /^[A-Za-z0-9]{10}$/;

export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

function newSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i += 1) slug += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return slug;
}

function isSlugCollision(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string; constraint?: string } }).cause ?? err;
  const pgErr = cause as { code?: string; constraint?: string };
  return pgErr.code === "23505" && pgErr.constraint === "documents_slug_unique";
}

async function findLiveSlug(contentHash: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ slug: documents.slug })
    .from(documents)
    .where(and(eq(documents.contentHash, contentHash), isNull(documents.deletedAt)))
    .limit(1);
  return row?.slug ?? null;
}

/** Returns why the content can't be shared, or null when it can. */
export function markdownError(content: unknown): string | null {
  if (typeof content !== "string" || content.trim() === "") return "markdown: must be a non-empty string";
  // Postgres text columns reject NUL bytes outright.
  if (content.includes("\u0000")) return "markdown: must not contain NUL characters";
  return null;
}

/**
 * Return the slug for this content, creating the document if needed, or null when the IP is over its limit.
 * Only a new row counts against the limit, so re-sharing the same content is always free.
 */
export async function publishDocument(content: string, ip: string): Promise<string | null> {
  const contentHash = createHash("sha256").update(content).digest("hex");
  const existing = await findLiveSlug(contentHash);
  if (existing) return existing;
  const release = reserveCreate(ip);
  if (!release) return null;
  try {
    const { slug, created } = await insertDocument(content, contentHash);
    if (!created) release();
    return slug;
  } catch (err) {
    release();
    throw err;
  }
}

async function insertDocument(
  content: string,
  contentHash: string,
): Promise<{ slug: string; created: boolean }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [row] = await getDb()
        .insert(documents)
        .values({ slug: newSlug(), content, contentHash })
        .onConflictDoNothing({
          target: documents.contentHash,
          where: sql`${documents.deletedAt} is null`,
        })
        .returning({ slug: documents.slug });
      if (row) return { slug: row.slug, created: true };
      const existing = await findLiveSlug(contentHash);
      if (existing) return { slug: existing, created: false };
    } catch (err) {
      if (!isSlugCollision(err)) throw err;
    }
  }
  throw new Error("could not allocate a document slug");
}

export async function readDocument(slug: string): Promise<string | null> {
  if (!isSlug(slug)) return null;
  const [row] = await getDb()
    .select({ content: documents.content })
    .from(documents)
    .where(and(eq(documents.slug, slug), isNull(documents.deletedAt)))
    .limit(1);
  return row?.content ?? null;
}

/** Origin as the visitor sees it. nginx forwards the public Host and sets X-Forwarded-Proto. */
/** A loggable summary that never includes query params, which hold the whole document. */
export function dbErrorCode(err: unknown): string {
  const cause = (err as { cause?: { code?: string } }).cause;
  return cause?.code ?? (err instanceof Error ? err.name : "unknown");
}

export function publicOrigin(headers: Headers): string {
  const host = headers.get("host") ?? "localhost";
  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export function documentUrls(origin: string, slug: string) {
  return { slug, url: `${origin}/d/${slug}`, rawUrl: `${origin}/d/${slug}.md` };
}

/** Accept a share link, its `.md` URL, or a bare slug. */
export function slugFromLink(link: string): string | null {
  const trimmed = link.trim();
  if (isSlug(trimmed)) return trimmed;
  const match = trimmed.match(/\/d\/([A-Za-z0-9]{10})(?:\.md)?\/?(?:[?#].*)?$/);
  return match ? match[1] : null;
}
