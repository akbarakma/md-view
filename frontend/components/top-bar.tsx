"use client";

import { useEffect, useRef, useState } from "react";

const MD_ACCEPT = ".md,.markdown,.mdown,.mkd,text/markdown,text/plain";

type ShareOutcome = "ok" | "ok-long" | "too-large" | "failed";

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
}: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");
  const [shareState, setShareState] = useState<
    "idle" | "loading" | "ok" | "ok-long" | "too-large" | "err"
  >("idle");
  const copyTimerRef = useRef<number | null>(null);
  const shareTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current);
    };
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
      outcome === "ok"
        ? "ok"
        : outcome === "ok-long"
          ? "ok-long"
          : outcome === "too-large"
            ? "too-large"
            : "err",
    );
    if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current);
    shareTimerRef.current = window.setTimeout(() => setShareState("idle"), 1600);
  };

  const shareLabel =
    shareState === "loading"
      ? "Sharing…"
      : shareState === "ok"
        ? "Link copied"
        : shareState === "ok-long"
          ? "Copied long link"
          : shareState === "too-large"
            ? "Too large"
            : shareState === "err"
              ? "Share failed"
              : "Share";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-rule px-6">
      <div className="flex items-baseline gap-3">
        <span className="text-[20px] font-semibold leading-none tracking-tight text-ink">
          Markdown
        </span>
        <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
          Viewer
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={MD_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
          tabIndex={-1}
        />

        <ToolbarButton
          onClick={onToggleSearch}
          label="Search"
          tone={searchOpen ? "ember" : "default"}
        >
          <IconSearch />
        </ToolbarButton>

        <ToolbarButton onClick={() => fileInputRef.current?.click()} label="Import">
          <IconUpload />
        </ToolbarButton>

        <ToolbarButton onClick={onExport} label="Export">
          <IconDownload />
        </ToolbarButton>

        <ToolbarButton
          onClick={handleCopy}
          label={copyState === "ok" ? "Copied" : copyState === "err" ? "Copy failed" : "Copy"}
          tone={copyState === "ok" ? "ember" : copyState === "err" ? "ember" : "default"}
          aria-live="polite"
        >
          {copyState === "ok" ? <IconCheck /> : <IconCopy />}
        </ToolbarButton>

        <ToolbarButton
          onClick={handleShare}
          label={shareLabel}
          tone={shareState === "idle" ? "default" : "ember"}
          disabled={shareState === "loading"}
          aria-live="polite"
        >
          {shareState === "ok" || shareState === "ok-long" ? <IconCheck /> : <IconShare />}
        </ToolbarButton>

        <span aria-hidden className="mx-1 h-5 w-px bg-rule" />

        <button
          id={toggleId}
          type="button"
          onClick={onToggleDrawer}
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          className="group inline-flex items-center gap-2 rounded-full border border-rule px-4 py-1.5 text-[12px] font-medium uppercase tracking-[0.18em] text-ink-soft transition-colors duration-150 ease-out hover:border-ember hover:text-ember focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember"
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-ink-muted transition-colors duration-150 group-hover:bg-ember"
          />
          Cheat sheet
        </button>
      </div>
    </header>
  );
}

type ToolbarButtonProps = {
  onClick: () => void;
  label: string;
  tone?: "default" | "ember";
  disabled?: boolean;
  children: React.ReactNode;
  "aria-live"?: "polite" | "off" | "assertive";
};

function ToolbarButton({
  onClick,
  label,
  tone = "default",
  disabled = false,
  children,
  ...rest
}: ToolbarButtonProps) {
  const toneClass =
    tone === "ember"
      ? "border-ember text-ember"
      : "border-rule text-ink-soft hover:border-ember hover:text-ember";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors duration-150 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:opacity-60 ${toneClass}`}
      {...rest}
    >
      <span aria-hidden className="grid size-3.5 place-items-center">
        {children}
      </span>
      {label}
    </button>
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
