"use client";

import { useEffect, useRef } from "react";

type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  matchRange?: [number, number] | null;
};

export function MarkdownEditor({ value, onChange, matchRange = null }: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const start = matchRange ? matchRange[0] : null;
  const end = matchRange ? matchRange[1] : null;

  // Reveal the active search match by selecting it and centering its line.
  // Skip while the textarea is focused so we never hijack the user's cursor mid-edit.
  useEffect(() => {
    const ta = ref.current;
    if (!ta || start === null || end === null) return;
    if (document.activeElement === ta) return;
    ta.setSelectionRange(start, end);
    const cs = getComputedStyle(ta);
    const lineHeight = parseFloat(cs.lineHeight) || 24;
    const paddingTop = parseFloat(cs.paddingTop) || 0;
    const line = ta.value.slice(0, start).split("\n").length - 1;
    ta.scrollTop = Math.max(0, paddingTop + line * lineHeight - ta.clientHeight / 2);
  }, [start, end]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      aria-label="Markdown input"
      placeholder="Start writing in Markdown…"
      className="h-full w-full resize-none bg-transparent px-6 py-6 font-mono text-[14px] leading-[1.75] text-ink-soft caret-ember placeholder:text-ink-muted/60 focus:outline-none"
    />
  );
}
