"use client";

import { useCallback, useState } from "react";
import { CheatsheetDrawer } from "@/components/cheatsheet-drawer";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-preview";
import { PaneLabel } from "@/components/pane-label";
import { SplitPane } from "@/components/split-pane";
import { TopBar } from "@/components/top-bar";
import { encodeShare } from "@/lib/share-url";
import { usePersistedMd } from "@/lib/use-persisted-md";

const SHARE_URL_LIMIT = 32_000;
type ShareOutcome = "ok" | "too-large" | "failed";

const DEFAULT_SAMPLE = `# A quieter Markdown viewer

Write on the left. Read on the right. Drag the hairline between them to give
each side the room it needs.

## Why this exists

Most Markdown previewers feel like dev tools. This one is closer to a *typeset
draft* — a place where the words come first and the chrome stays out of the way.

> "The page is a sheet of paper. Treat it like one."

### What you can do

- Format text with **bold**, *italic*, and ~~strike~~.
- Drop a \`code\` snippet inline, or a full block:

\`\`\`
function greet(name) {
  return \`Hello, \${name}.\`;
}
\`\`\`

- Keep a list of things to do:
  - [x] Sketch the layout
  - [x] Pick the typefaces
  - [ ] Write the first real document

| Element  | Shortcut     |
| -------- | ------------ |
| Heading  | \`#\` then text |
| Link     | \`[text](url)\` |
| Image    | \`![alt](url)\`  |

---

Open the **Cheat sheet** in the top-right whenever you need a reminder.
`;

const DRAWER_ID = "cheatsheet-drawer";
const TOGGLE_ID = "cheatsheet-toggle";

function deriveFilename(md: string): string {
  const h1 = md.match(/^\s*#\s+(.+?)\s*$/m)?.[1];
  const base = h1
    ? h1
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 60)
    : "";
  const date = new Date().toISOString().slice(0, 10);
  return `${base || "markdown"}-${date}.md`;
}

export default function Home() {
  const [md, setMd] = usePersistedMd(DEFAULT_SAMPLE);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleImport = useCallback(
    (text: string) => {
      setMd(text);
    },
    [setMd],
  );

  const handleExport = useCallback(() => {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = deriveFilename(md);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [md]);

  const handleShare = useCallback(async (): Promise<ShareOutcome> => {
    const url = `${window.location.origin}${window.location.pathname}${encodeShare(md)}`;
    if (url.length > SHARE_URL_LIMIT) return "too-large";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return "ok";
      }
    } catch {
      // fall through to textarea fallback
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok ? "ok" : "failed";
    } catch {
      return "failed";
    }
  }, [md]);

  const handleCopy = useCallback(async (): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(md);
        return true;
      }
    } catch {
      // fall through to fallback
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = md;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, [md]);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        toggleId={TOGGLE_ID}
        drawerId={DRAWER_ID}
        onImport={handleImport}
        onExport={handleExport}
        onCopy={handleCopy}
        onShare={handleShare}
      />
      <main className="flex-1 overflow-hidden">
        <SplitPane
          left={
            <>
              <PaneLabel index="01" label="Editor" hint="Plain Markdown" />
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor value={md} onChange={setMd} />
              </div>
            </>
          }
          right={
            <>
              <PaneLabel index="02" label="Preview" hint="Rendered" />
              <div className="flex-1 overflow-hidden">
                <MarkdownPreview source={md} />
              </div>
            </>
          }
        />
      </main>
      <CheatsheetDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        drawerId={DRAWER_ID}
        toggleId={TOGGLE_ID}
      />
    </div>
  );
}
