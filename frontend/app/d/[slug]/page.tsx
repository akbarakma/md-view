import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { readDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/d/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  return { alternates: { types: { "text/markdown": `/d/${slug}.md` } } };
}

export default async function SharedDocumentPage(props: PageProps<"/d/[slug]">) {
  const { slug } = await props.params;
  const content = await readDocument(slug);
  if (content === null) notFound();
  return <Workspace sharedDoc={content} />;
}
