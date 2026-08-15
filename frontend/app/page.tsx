"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AiChat } from "@/components/ai-chat";
import { CheatsheetDrawer } from "@/components/cheatsheet-drawer";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownPreview } from "@/components/markdown-preview";
import { PaneLabel } from "@/components/pane-label";
import { PaneTabs, type Pane } from "@/components/pane-tabs";
import { SearchBar, type SearchScope } from "@/components/search-bar";
import { SplitPane } from "@/components/split-pane";
import { TopBar } from "@/components/top-bar";
import { copyText } from "@/lib/clipboard";
import { findMatches } from "@/lib/find-matches";
import { encodeShare } from "@/lib/share-url";
import { shortenUrl } from "@/lib/shorten";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePersistedMd } from "@/lib/use-persisted-md";

// Must stay below the shortener's nginx proxy_buffer_size (256k) — opening a
// short link 302s the whole URL back in a Location header nginx buffers whole.
const SHARE_URL_LIMIT = 240_000;
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
  // Re-parsing a large document on every keystroke is what makes the preview lag
  // (e.g. the 46-table ERD). The editor stays instant; the preview catches up
  // after a brief pause in typing.
  const debouncedMd = useDebouncedValue(md, 150);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Below `md` the split view is unusable, so the panes become tabs instead.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [activePane, setActivePane] = useState<Pane>("preview");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);
  const [desktopScope, setDesktopScope] = useState<SearchScope>("preview");
  const [previewCount, setPreviewCount] = useState(0);
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const effectiveQuery = searchOpen ? debouncedQuery : "";

  // On mobile only one pane is on screen, so searching the other one would be
  // meaningless — the scope simply follows the active tab.
  const scope: SearchScope = isDesktop ? desktopScope : activePane;

  // Only the scoped pane is highlighted; the other is handed an empty query.
  const editorQuery = scope === "editor" ? effectiveQuery : "";
  const previewQuery = scope === "preview" ? effectiveQuery : "";

  // Reset selection to the first match whenever the (debounced) query or the
  // scope changes. Adjusting state during render is React's endorsed alternative
  // to an effect; it also covers closing search, where effectiveQuery becomes "".
  const resetKey = `${scope}::${effectiveQuery}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setActiveMatch(0);
  }

  const editorMatches = useMemo(() => findMatches(md, editorQuery), [md, editorQuery]);

  // Editor matches come from the raw source; preview matches are counted from the
  // rendered DOM, so `**bold**` matches "bold" there and not "**".
  const matchCount = scope === "editor" ? editorMatches.length : previewCount;
  const safeActive = matchCount > 0 ? Math.min(activeMatch, matchCount - 1) : 0;
  const matchRange: [number, number] | null =
    scope === "editor" && editorMatches.length > 0
      ? [editorMatches[safeActive], editorMatches[safeActive] + editorQuery.length]
      : null;

  // Closing search clears the box so reopening starts fresh; highlights vanish
  // because effectiveQuery becomes "".
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
  }, []);

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
    const longUrl = `${window.location.origin}${window.location.pathname}${await encodeShare(md)}`;
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

  // The cheat sheet and the chat both occupy the right edge — only one at a time.
  const openChat = useCallback(() => {
    setDrawerOpen(false);
    setChatOpen(true);
  }, []);

  const toggleDrawer = useCallback(() => {
    setChatOpen(false);
    setDrawerOpen((v) => !v);
  }, []);

  const editor = <MarkdownEditor value={md} onChange={setMd} matchRange={matchRange} />;
  const preview = (
    <MarkdownPreview
      source={debouncedMd}
      searchQuery={previewQuery}
      activeIndex={safeActive}
      onMatchCountChange={setPreviewCount}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        drawerOpen={drawerOpen}
        onToggleDrawer={toggleDrawer}
        toggleId={TOGGLE_ID}
        drawerId={DRAWER_ID}
        searchOpen={searchOpen}
        onToggleSearch={searchOpen ? closeSearch : () => setSearchOpen(true)}
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
            scope={scope}
            onScopeChange={setDesktopScope}
            showScopeToggle={isDesktop}
            onNext={goNext}
            onPrev={goPrev}
            onClose={closeSearch}
          />
        )}
        {isDesktop ? (
          <SplitPane
            left={
              <>
                <PaneLabel index="01" label="Editor" hint="Plain Markdown" />
                <div className="flex-1 overflow-hidden">{editor}</div>
              </>
            }
            right={
              <>
                <PaneLabel index="02" label="Preview" hint="Rendered" />
                <div className="flex-1 overflow-hidden">{preview}</div>
              </>
            }
          />
        ) : (
          // Both panes stay mounted and the inactive one is hidden, so switching
          // tabs never re-parses the document or re-renders its mermaid diagrams.
          <div className="flex h-full flex-col">
            <PaneTabs active={activePane} onChange={setActivePane} />
            <div
              role="tabpanel"
              id="pane-panel-editor"
              aria-labelledby="pane-tab-editor"
              hidden={activePane !== "editor"}
              className="flex-1 overflow-hidden"
            >
              {editor}
            </div>
            <div
              role="tabpanel"
              id="pane-panel-preview"
              aria-labelledby="pane-tab-preview"
              hidden={activePane !== "preview"}
              className="flex-1 overflow-hidden"
            >
              {preview}
            </div>
          </div>
        )}
      </main>
      <CheatsheetDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        drawerId={DRAWER_ID}
        toggleId={TOGGLE_ID}
      />
      <AiChat doc={md} open={chatOpen} onOpen={openChat} onClose={() => setChatOpen(false)} />
    </div>
  );
}
