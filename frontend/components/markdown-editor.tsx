"use client";

type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
};

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      aria-label="Markdown input"
      placeholder="Start writing in Markdown…"
      className="h-full w-full resize-none bg-transparent px-6 py-6 font-mono text-[14px] leading-[1.75] text-ink-soft caret-ember placeholder:text-ink-muted/60 focus:outline-none"
    />
  );
}
