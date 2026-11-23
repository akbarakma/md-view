"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SiteCredit } from "@/components/site-credit";
import type { ViewMode } from "@/lib/use-view-mode";

const MD_ACCEPT = ".md,.markdown,.mdown,.mkd,text/markdown,text/plain";

type ShareOutcome = "ok" | "too-large" | "failed";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "split", label: "Split" },
  { id: "preview", label: "Preview" },
];

type TopBarProps = {
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  toggleId: string;
  drawerId: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onImport: (text: string, filename: string) => void;
  onExport: () => void;
  onCopy: () => Promise<boolean> | boolean;
  onShare: () => Promise<ShareOutcome> | ShareOutcome;
  onPaste: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

export function TopBar({
  drawerOpen,
  onToggleDrawer,
  toggleId,
  drawerId,
  searchOpen,
  onToggleSearch,
  onImport,
  onExport,
  onCopy,
  onShare,
  onPaste,
  viewMode,
  onViewModeChange,
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const [shareState, setShareState] = useState<
    "idle" | "loading" | "ok" | "too-large" | "err"
  >("idle");
  const copyTimerRef = useRef<number | null>(null);
  const shareTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const resetScrollPosition = () => {
      toolbar.scrollLeft = 0;
      window.requestAnimationFrame(() => {
        toolbar.scrollLeft = 0;
      });
    };

    resetScrollPosition();
    window.addEventListener("pageshow", resetScrollPosition);
    return () => window.removeEventListener("pageshow", resetScrollPosition);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      onImport(text, file.name);
    };
    reader.readAsText(file);
    // Reset so re-selecting the same file fires onChange again
    e.target.value = "";
  };

  const handleCopy = async () => {
    const ok = await onCopy();
    setCopyState(ok ? "ok" : "err");
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const handleShare = async () => {
    if (shareState === "loading") return;
    setShareState("loading");
    const outcome = await onShare();
    setShareState(
      outcome === "ok" ? "ok" : outcome === "too-large" ? "too-large" : "err",
    );
    if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current);
    shareTimerRef.current = window.setTimeout(() => setShareState("idle"), 1600);
  };

  const shareLabel =
    shareState === "loading"
      ? "Sharing…"
      : shareState === "ok"
        ? "Link copied"
        : shareState === "too-large"
          ? "Too large"
          : shareState === "err"
            ? "Share failed"
            : "Share";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule px-3 sm:px-6">
      <div className="flex shrink-0 flex-col justify-center gap-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[20px] font-semibold leading-none tracking-tight text-ink">
            Markdown
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
            Viewer
          </span>
        </div>
        {/* On mobile the header has no room for a byline — it moves to the right
            end of the pane tab row instead (see PaneTabs). */}
        <SiteCredit className="hidden text-[10px] leading-none md:block" />
      </div>

      <div className="relative min-w-0 flex-1">
        <div
          ref={toolbarRef}
          aria-label="Toolbar actions. Swipe left to access more actions."
          className="toolbar-scroll flex overflow-x-auto md:overflow-visible"
        >
          {/* `ml-auto` right-aligns the group when it fits, and collapses to 0
              when it doesn't — so on a narrow screen the row simply overflows
              and scrolls from the left. Using `justify-end` here instead would
              push the overflow off the left edge, where it can't be scrolled to. */}
          <div className="ml-auto flex w-max shrink-0 items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={MD_ACCEPT}
            className="hidden"
            onChange={handleFileChange}
            aria-hidden
            tabIndex={-1}
          />

          <ToolbarButton onClick={onPaste} label="Paste" tone="primary">
            <IconPaste />
          </ToolbarButton>

          <div
            role="group"
            aria-label="View"
            className="hidden shrink-0 items-center rounded-full border border-rule p-0.5 md:inline-flex"
          >
            {VIEW_MODES.map((mode) => {
              const active = mode.id === viewMode;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onViewModeChange(mode.id)}
                  className={`inline-flex h-7 cursor-pointer items-center rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors md:max-xl:px-2 md:max-xl:tracking-[0.1em] duration-150 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember ${
                    active ? "bg-ink text-paper" : "text-ink-soft hover:text-ember"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <span aria-hidden className="mx-1 hidden h-5 w-px shrink-0 bg-rule md:block" />

          <ToolbarButton
            onClick={onToggleSearch}
            label="Search"
            tone={searchOpen ? "ember" : "default"}
            compact
          >
            <IconSearch />
          </ToolbarButton>

          <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Import" compact>
            <IconUpload />
          </ToolbarButton>

          <ToolbarButton onClick={onExport} label="Export" compact>
            <IconDownload />
          </ToolbarButton>

          <ToolbarButton
            onClick={handleCopy}
            label={copyState === "ok" ? "Copied" : copyState === "err" ? "Copy failed" : "Copy"}
            tone={copyState === "ok" ? "ember" : copyState === "err" ? "ember" : "default"}
            aria-live="polite"
            compact
          >
            {copyState === "ok" ? <IconCheck /> : <IconCopy />}
          </ToolbarButton>

          <ToolbarButton
            onClick={handleShare}
            label={shareLabel}
            tone={shareState === "idle" ? "default" : "ember"}
            disabled={shareState === "loading"}
            aria-live="polite"
            compact
          >
            {shareState === "ok" ? <IconCheck /> : <IconShare />}
          </ToolbarButton>

          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-rule" />

          <button
            id={toggleId}
            type="button"
            onClick={onToggleDrawer}
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            title="Cheat sheet"
            className="group inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember md:max-xl:-ml-1.5 md:max-xl:size-10"
          >
            <span className="inline-flex items-center justify-center gap-2 rounded-full border border-rule px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors duration-150 ease-out group-hover:border-ember group-hover:text-ember md:max-xl:size-7 md:max-xl:p-0">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-ink-muted transition-colors duration-150 group-hover:bg-ember md:max-xl:hidden"
              />
              <span aria-hidden className="hidden size-3.5 place-items-center md:max-xl:grid">
                <IconBook />
              </span>
              <span className="md:max-xl:sr-only">Cheat sheet</span>
            </span>
          </button>
          </div>
        </div>
      </div>
    </header>
  );
}

type ToolbarButtonProps = {
  onClick: () => void;
  label: string;
  tone?: "default" | "ember" | "primary";
  disabled?: boolean;
  /** From 768px to 1279px the label hides, leaving a 40px icon button with a tooltip. */
  compact?: boolean;
  children: React.ReactNode;
  "aria-live"?: "polite" | "off" | "assertive";
};

function ToolbarButton({
  onClick,
  label,
  tone = "default",
  disabled = false,
  compact = false,
  children,
  ...rest
}: ToolbarButtonProps) {
  const toneClass =
    tone === "primary"
      ? "border-ember bg-ember font-semibold text-paper group-hover:border-ember-soft group-hover:bg-ember-soft"
      : tone === "ember"
        ? "border-ember text-ember"
        : "border-rule text-ink-soft group-hover:border-ember group-hover:text-ember";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={compact ? label : undefined}
      className={`group inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "md:max-xl:-mx-1.5 md:max-xl:size-10" : ""
      }`}
      {...rest}
    >
      <span
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-150 ease-out ${toneClass} ${
          compact ? "md:max-xl:size-7 md:max-xl:p-0" : ""
        }`}
      >
        <span aria-hidden className="grid size-3.5 place-items-center">
          {children}
        </span>
        <span className={compact ? "md:max-xl:sr-only" : undefined}>{label}</span>
      </span>
    </button>
  );
}

function IconBook() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 2.5h3.2A1.3 1.3 0 0 1 7 3.8v8a1 1 0 0 0-1-1H2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M11.5 2.5H8.3A1.3 1.3 0 0 0 7 3.8v8a1 1 0 0 1 1-1h3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function IconPaste() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="2.5" width="9" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 2.5V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="3.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8.7 8.7L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M7 11V3M7 3L3.5 6.5M7 3L10.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M7 3V11M7 11L3.5 7.5M7 11L10.5 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 3V2.25A1.25 1.25 0 0 1 6.75 1H11a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1h-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3 7.5L6 10.5L11 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <circle cx="4" cy="7" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="3.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.4 6.2L9.1 4.3M5.4 7.8L9.1 9.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
