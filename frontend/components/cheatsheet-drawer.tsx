"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Entry = {
  name: string;
  syntax: string;
  preview?: string;
};

const ENTRIES: Entry[] = [
  { name: "Heading 1", syntax: "# Heading 1" },
  { name: "Heading 2", syntax: "## Heading 2" },
  { name: "Heading 3", syntax: "### Heading 3" },
  { name: "Bold", syntax: "**bold text**" },
  { name: "Italic", syntax: "*italic text*" },
  { name: "Strikethrough", syntax: "~~struck out~~" },
  { name: "Inline code", syntax: "Use `code` inline." },
  {
    name: "Code block",
    syntax: "```\nconst answer = 42;\n```",
  },
  {
    name: "Blockquote",
    syntax: "> A quoted line.\n> A second quoted line.",
  },
  {
    name: "Unordered list",
    syntax: "- First\n- Second\n- Third",
  },
  {
    name: "Ordered list",
    syntax: "1. First\n2. Second\n3. Third",
  },
  {
    name: "Task list",
    syntax: "- [x] Done\n- [ ] Todo",
  },
  { name: "Link", syntax: "[Anthropic](https://anthropic.com)" },
  {
    name: "Image",
    syntax: "![alt text](https://placehold.co/80x40)",
  },
  {
    name: "Table",
    syntax: "| Col A | Col B |\n| ----- | ----- |\n| 1     | 2     |",
  },
  { name: "Horizontal rule", syntax: "---" },
];

type CheatsheetDrawerProps = {
  open: boolean;
  onClose: () => void;
  drawerId: string;
  toggleId: string;
};

export function CheatsheetDrawer({
  open,
  onClose,
  drawerId,
  toggleId,
}: CheatsheetDrawerProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    headingRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      document.getElementById(toggleId)?.focus();
    }
  }, [open, toggleId]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] transition-opacity ${
          open
            ? "pointer-events-auto opacity-100 duration-[240ms] ease-out"
            : "pointer-events-none opacity-0 duration-[160ms] ease-out"
        }`}
      />
      <aside
        id={drawerId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${drawerId}-title`}
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(440px,92vw)] flex-col border-l border-rule bg-paper transition-transform ${
          open
            ? "translate-x-0 duration-[240ms] ease-out"
            : "translate-x-full duration-[160ms] ease-out"
        }`}
        style={{ backgroundImage: "var(--noise)" }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-rule px-6">
          <h2
            id={`${drawerId}-title`}
            ref={headingRef}
            tabIndex={-1}
            className="text-[17px] font-semibold tracking-tight text-ink focus:outline-none"
          >
            Markdown Cheat Sheet
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cheat sheet"
            className="grid size-8 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-paper-deep hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M2 2 L12 12 M12 2 L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <p className="mb-6 text-[13px] leading-relaxed text-ink-soft">
            A short reference of what this viewer can render. Each entry shows
            the syntax and how it appears once rendered.
          </p>
          <ul className="flex flex-col gap-7">
            {ENTRIES.map((entry) => (
              <li key={entry.name} className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                  {entry.name}
                </h3>
                <pre className="rounded-sm border-l-2 border-ember bg-paper-deep px-3 py-2 font-mono text-[12.5px] leading-[1.6] text-ink-soft overflow-x-auto">
                  <code>{entry.syntax}</code>
                </pre>
                <div className="prose prose-paper max-w-none border-t border-rule pt-3 text-[14px]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {entry.preview ?? entry.syntax}
                  </ReactMarkdown>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
