"use client";

import { isValidElement, useEffect, useRef, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { rehypeHighlight } from "@/lib/rehype-highlight";

type MarkdownPreviewProps = {
  source: string;
  searchQuery?: string;
};

// Collapse React children (which may contain <mark> highlight elements injected
// by the search plugin) back down to their raw text.
function toText(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (isValidElement(node)) return toText((node.props as { children?: ReactNode }).children);
  return "";
}

function isMermaid(className: unknown): boolean {
  return typeof className === "string" && /\blanguage-mermaid\b/.test(className);
}

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
  // Drop the <pre> chrome when it wraps a mermaid block — the diagram supplies
  // its own frame.
  pre: ({ children, ...rest }) => {
    if (isValidElement(children) && isMermaid((children.props as { className?: string }).className)) {
      return <>{children}</>;
    }
    return <pre {...rest}>{children}</pre>;
  },
  code: ({ className, children, ...rest }) => {
    if (isMermaid(className)) {
      return <MermaidDiagram code={toText(children).replace(/\n$/, "")} />;
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
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
