"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheatsheetDrawer } from "@/components/cheatsheet-drawer";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-preview";
import { PaneLabel } from "@/components/pane-label";
import { SearchBar } from "@/components/search-bar";
import { SplitPane } from "@/components/split-pane";
import { TopBar } from "@/components/top-bar";
import { copyText } from "@/lib/clipboard";
import { findMatches } from "@/lib/find-matches";
import { encodeShare } from "@/lib/share-url";
import { shortenUrl } from "@/lib/shorten";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { usePersistedMd } from "@/lib/use-persisted-md";

const SHARE_URL_LIMIT = 32_000;
type ShareOutcome = "ok" | "ok-long" | "too-large" | "failed";

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

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const effectiveQuery = searchOpen ? debouncedQuery : "";

  const editorMatches = useMemo(() => findMatches(md, effectiveQuery), [md, effectiveQuery]);
  const matchCount = editorMatches.length;
  const safeActive = matchCount > 0 ? Math.min(activeMatch, matchCount - 1) : 0;
  const matchRange: [number, number] | null =
    matchCount > 0
      ? [editorMatches[safeActive], editorMatches[safeActive] + effectiveQuery.length]
      : null;

  // Reset to the first match whenever the (debounced) query changes.
  useEffect(() => {
    setActiveMatch(0);
  }, [effectiveQuery]);

  // Clear the query when the search bar is closed so highlights disappear.
  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery("");
      setActiveMatch(0);
    }
  }, [searchOpen]);

  // ⌘/Ctrl+F opens the in-app search instead of the browser's find.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goNext = useCallback(() => {
    setActiveMatch((i) => (matchCount === 0 ? 0 : (Math.min(i, matchCount - 1) + 1) % matchCount));
  }, [matchCount]);

  const goPrev = useCallback(() => {
    setActiveMatch((i) =>
      matchCount === 0 ? 0 : (Math.min(i, matchCount - 1) - 1 + matchCount) % matchCount,
    );
  }, [matchCount]);

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
    const longUrl = `${window.location.origin}${window.location.pathname}${encodeShare(md)}`;
    if (longUrl.length > SHARE_URL_LIMIT) return "too-large";
    try {
      const short = await shortenUrl(longUrl);
      return (await copyText(short)) ? "ok" : "failed";
    } catch {
      // Shortener unreachable / rate-limited — fall back to the long inline link.
      return (await copyText(longUrl)) ? "ok-long" : "failed";
    }
  }, [md]);

  const handleCopy = useCallback(async (): Promise<boolean> => copyText(md), [md]);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        toggleId={TOGGLE_ID}
        drawerId={DRAWER_ID}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
        onImport={handleImport}
        onExport={handleExport}
        onCopy={handleCopy}
        onShare={handleShare}
      />
      <main className="relative flex-1 overflow-hidden">
        {searchOpen && (
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            count={matchCount}
            current={matchCount > 0 ? safeActive + 1 : 0}
            onNext={goNext}
            onPrev={goPrev}
            onClose={() => setSearchOpen(false)}
          />
        )}
        <SplitPane
          left={
            <>
              <PaneLabel index="01" label="Editor" hint="Plain Markdown" />
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor value={md} onChange={setMd} matchRange={matchRange} />
              </div>
            </>
          }
          right={
            <>
              <PaneLabel index="02" label="Preview" hint="Rendered" />
              <div className="flex-1 overflow-hidden">
                <MarkdownPreview source={md} searchQuery={effectiveQuery} />
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
