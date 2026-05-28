"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownPreviewProps = {
  source: string;
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

export function MarkdownPreview({ source }: MarkdownPreviewProps) {
  return (
    <article className="prose prose-paper h-full max-w-none overflow-auto px-7 py-7 prose-headings:mt-8 prose-headings:mb-3 first:prose-headings:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
