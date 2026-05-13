"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownPreviewProps = {
  source: string;
};

export function MarkdownPreview({ source }: MarkdownPreviewProps) {
  return (
    <article className="prose prose-paper h-full max-w-none overflow-auto px-7 py-7 prose-headings:mt-8 prose-headings:mb-3 first:prose-headings:mt-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </article>
  );
}
