import type { Plugin } from "unified";

// Minimal hast node shape — the `hast` types package isn't installed, and we only
// need text/element/children here.
type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * Rehype plugin that wraps every case-insensitive occurrence of `query` in the
 * rendered text in `<mark class="search-hl">`.
 */
export const rehypeHighlight: Plugin<[string]> = (query) => {
  const needle = (query ?? "").toLowerCase();
  return (tree) => {
    if (!needle) return;
    walk(tree as HastNode, needle);
  };
};

function walk(node: HastNode, needle: string): void {
  if (!node.children) return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      next.push(...splitText(child.value, needle));
    } else {
      walk(child, needle);
      next.push(child);
    }
  }
  node.children = next;
}

function splitText(value: string, needle: string): HastNode[] {
  const lower = value.toLowerCase();
  const out: HastNode[] = [];
  let from = 0;
  for (;;) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) break;
    if (idx > from) out.push({ type: "text", value: value.slice(from, idx) });
    out.push({
      type: "element",
      tagName: "mark",
      properties: { className: ["search-hl"] },
      children: [{ type: "text", value: value.slice(idx, idx + needle.length) }],
    });
    from = idx + needle.length;
  }
  if (from === 0) return [{ type: "text", value }];
  if (from < value.length) out.push({ type: "text", value: value.slice(from) });
  return out;
}
