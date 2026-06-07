"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { rehypeHighlight } from "@/lib/rehype-highlight";

type MarkdownPreviewProps = {
  source: string;
  searchQuery?: string;
};

const components: Components = {
  a: ({ href, children, ...rest }) => {
    const external = !!href && /^(https?:|mailto:|\/\/)/i.test(href);
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    ) : (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
};

export function MarkdownPreview({ source, searchQuery = "" }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const rehypePlugins: PluggableList = searchQuery ? [[rehypeHighlight, searchQuery]] : [];

  // Bring the first match into view when the query changes.
  useEffect(() => {
    if (!searchQuery) return;
    containerRef.current?.querySelector(".search-hl")?.scrollIntoView({ block: "center" });
  }, [searchQuery]);

  return (
    <article
      ref={containerRef}
      className="prose prose-paper h-full max-w-none overflow-auto px-7 py-7 prose-headings:mt-8 prose-headings:mb-3 first:prose-headings:mt-0"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={components}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
