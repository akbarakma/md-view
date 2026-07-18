"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type MarkdownEditorProps = {
  value: string;
  onChange: (next: string) => void;
  matchRange?: [number, number] | null;
};

// Computed styles the hidden mirror must share with the textarea so it wraps
// identically, letting us measure each logical line's rendered height.
const MIRRORED_STYLES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "tabSize",
  "paddingLeft",
  "paddingRight",
  "textIndent",
] as const;

// The gutter renders one node per logical line (hundreds for a big file), so it
// lives in its own memoised component: while typing it only re-renders when the
// line heights actually change, not on every keystroke.
const Gutter = memo(function Gutter({
  rowHeights,
  innerRef,
}: {
  rowHeights: number[];
  innerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const digits = String(Math.max(rowHeights.length, 1)).length;
  return (
    <div className="editor-gutter" style={{ width: `calc(${digits}ch + 1.65rem)` }} aria-hidden="true">
      <div ref={innerRef} className="editor-gutter-inner">
        {rowHeights.map((h, i) => (
          <div key={i} className="editor-gutter-num" style={{ height: h }}>
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
});

export function MarkdownEditor({ value, onChange, matchRange = null }: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const gutterInnerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [rowHeights, setRowHeights] = useState<number[]>([]);

  const start = matchRange ? matchRange[0] : null;
  const end = matchRange ? matchRange[1] : null;

  const syncScroll = useCallback(() => {
    const ta = ref.current;
    const gi = gutterInnerRef.current;
    if (ta && gi) gi.style.transform = `translateY(${-ta.scrollTop}px)`;
  }, []);

  // Measure each logical line by mirroring the textarea's wrapping in a hidden
  // div, then read the per-line heights so the gutter can leave a gap under any
  // line that wraps (VSCode word-wrap behaviour).
  const measure = useCallback(() => {
    const ta = ref.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;

    const cs = getComputedStyle(ta);
    for (const prop of MIRRORED_STYLES) mirror.style[prop] = cs[prop];
    mirror.style.width = `${ta.clientWidth}px`;

    const lines = ta.value.split("\n");
    const frag = document.createDocumentFragment();
    for (const line of lines) {
      const div = document.createElement("div");
      div.textContent = line.length ? line : "​";
      frag.appendChild(div);
    }
    mirror.replaceChildren(frag);

    const heights: number[] = [];
    for (const child of Array.from(mirror.children)) {
      heights.push((child as HTMLElement).offsetHeight);
    }
    // Keep the same array reference when nothing wrapped differently, so the
    // memoised gutter skips re-rendering its hundreds of line-number nodes.
    setRowHeights((prev) =>
      prev.length === heights.length && prev.every((h, i) => h === heights[i]) ? prev : heights,
    );
    syncScroll();
  }, [syncScroll]);

  // Coalesce measures to one per frame so typing in a large document stays smooth.
  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    measure();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scheduleMeasure();
  }, [value, scheduleMeasure]);

  // Re-measure when the pane is resized (e.g. dragging the split all the way left
  // forces more lines to wrap).
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(ta);
    return () => ro.disconnect();
  }, [scheduleMeasure]);

  // Reveal the active search match by selecting it and centering its line.
  // Skip while the textarea is focused so we never hijack the user's cursor mid-edit.
  useEffect(() => {
    const ta = ref.current;
    if (!ta || start === null || end === null) return;
    if (document.activeElement === ta) return;
    ta.setSelectionRange(start, end);
    const paddingTop = parseFloat(getComputedStyle(ta).paddingTop) || 0;
    const line = ta.value.slice(0, start).split("\n").length - 1;
    let top = paddingTop;
    for (let i = 0; i < line && i < rowHeights.length; i++) top += rowHeights[i];
    ta.scrollTop = Math.max(0, top - ta.clientHeight / 2);
    syncScroll();
  }, [start, end, rowHeights, syncScroll]);

  // Smart Home: jump to the first non-whitespace character, then to column 0 on a
  // second press. Shift extends the selection. Handles Home (Win/Linux) and
  // ⌘←/Ctrl+← so it behaves like VSCode across platforms.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isHome = e.key === "Home" && !e.altKey && !e.ctrlKey && !e.metaKey;
    const isModLeft = e.key === "ArrowLeft" && (e.metaKey || e.ctrlKey) && !e.altKey;
    if (!isHome && !isModLeft) return;

    const ta = e.currentTarget;
    const val = ta.value;
    const dir = ta.selectionDirection;
    const activePos = dir === "backward" ? ta.selectionStart : ta.selectionEnd;
    const anchor = dir === "backward" ? ta.selectionEnd : ta.selectionStart;

    const lineStart = val.lastIndexOf("\n", activePos - 1) + 1;
    const nextNl = val.indexOf("\n", lineStart);
    const lineEnd = nextNl === -1 ? val.length : nextNl;
    const indent = val.slice(lineStart, lineEnd).match(/^[ \t]*/)?.[0].length ?? 0;
    const firstNonWs = lineStart + indent;

    let target: number;
    if (indent === lineEnd - lineStart) target = lineStart; // blank / whitespace-only
    else if (activePos === firstNonWs) target = lineStart; // toggle back to column 0
    else target = firstNonWs;

    e.preventDefault();
    if (e.shiftKey) {
      const lo = Math.min(anchor, target);
      const hi = Math.max(anchor, target);
      ta.setSelectionRange(lo, hi, target < anchor ? "backward" : "forward");
    } else {
      ta.setSelectionRange(target, target);
    }
  };

  return (
    <div className="editor-shell">
      <Gutter rowHeights={rowHeights} innerRef={gutterInnerRef} />
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={onKeyDown}
        spellCheck={false}
        aria-label="Markdown input"
        placeholder="Start writing in Markdown…"
        className="editor-textarea"
      />
      <div ref={mirrorRef} className="editor-mirror" aria-hidden="true" />
    </div>
  );
}
