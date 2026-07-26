"use client";

import { isValidElement, memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { rehypeHighlight } from "@/lib/rehype-highlight";

type MarkdownPreviewProps = {
  source: string;
  searchQuery?: string;
  /** 0-based index of the match to focus, among the rendered `.search-hl` marks. */
  activeIndex?: number;
  /** Reports how many matches the *rendered* text contains. Must be referentially stable. */
  onMatchCountChange?: (count: number) => void;
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

// Memoised on its (primitive) props so re-renders of the page while typing don't
// re-parse the whole document — only an actual change to the debounced source or
// the search query re-runs ReactMarkdown.
export const MarkdownPreview = memo(function MarkdownPreview({
  source,
  searchQuery = "",
  activeIndex = 0,
  onMatchCountChange,
}: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const lastScrollKeyRef = useRef<string | null>(null);

  // Stepping through matches only changes `activeIndex`, which is applied
  // imperatively below — but it still re-renders this component, and
  // react-markdown re-parses the whole document on every render. Holding the
  // element in a memo keyed on what actually affects the output lets React reuse
  // the identical element and skip that subtree entirely, so Next/Prev on a large
  // document costs one classList toggle instead of a full remark/rehype pass.
  const rendered = useMemo(() => {
    const rehypePlugins: PluggableList = searchQuery ? [[rehypeHighlight, searchQuery]] : [];
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins} components={components}>
        {source}
      </ReactMarkdown>
    );
  }, [source, searchQuery]);

  // The rehype plugin emits one <mark class="search-hl"> per hit, in document
  // order, so the rendered DOM is the source of truth for both the count and the
  // active match. Counting the *rendered* text is the point: `**bold**` should
  // match "bold" and not "**", and mermaid blocks (whose marks are collapsed away
  // by toText) correctly contribute nothing.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // No query means no marks — skip walking the whole preview on every
    // keystroke just to count zero.
    if (!searchQuery) {
      onMatchCountChange?.(0);
      lastScrollKeyRef.current = null;
      return;
    }

    const marks = root.querySelectorAll<HTMLElement>(".search-hl");
    onMatchCountChange?.(marks.length);

    if (marks.length === 0) {
      lastScrollKeyRef.current = null;
      return;
    }

    const safeIndex = Math.min(activeIndex, marks.length - 1);
    marks.forEach((mark, i) => mark.classList.toggle("search-hl-active", i === safeIndex));

    // Only scroll when the query or the selected match changes — not on every
    // keystroke in the editor, which would otherwise yank the preview around
    // while the user is typing.
    const scrollKey = `${searchQuery}::${safeIndex}`;
    if (lastScrollKeyRef.current !== scrollKey) {
      lastScrollKeyRef.current = scrollKey;
      marks[safeIndex].scrollIntoView({ block: "center" });
    }
  }, [source, searchQuery, activeIndex, onMatchCountChange]);

  return (
    <article
      ref={containerRef}
      className="prose prose-paper h-full max-w-none overflow-auto px-7 py-7 prose-headings:mt-8 prose-headings:mb-3 first:prose-headings:mt-0"
    >
      {rendered}
    </article>
  );
});
