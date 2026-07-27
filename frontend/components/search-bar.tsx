"use client";

import { useEffect, useRef } from "react";

export type SearchScope = "editor" | "preview";

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  count: number;
  current: number; // 1-based index of the active match, 0 when none
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  /** Hidden on mobile, where the scope always follows the active pane tab. */
  showScopeToggle: boolean;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
};

export function SearchBar({
  query,
  onQueryChange,
  count,
  current,
  scope,
  onScopeChange,
  showScopeToggle,
  onNext,
  onPrev,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const counter = count > 0 ? `${current}/${count}` : query ? "0/0" : "";

  return (
    <div
      role="search"
      // On mobile the pane tab row occupies the top of <main>, so the pill drops
      // below it; on desktop it keeps its original position over the pane label.
      className="absolute right-4 top-12 z-10 flex items-center gap-1.5 rounded-full border border-rule bg-paper/95 py-1 pl-3 pr-1.5 shadow-sm backdrop-blur md:top-3"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search text…"
        aria-label={`Search text in the ${scope}`}
        // 16px on touch stops iOS Safari auto-zooming the page: this autofocuses
        // when the pill opens, so the toolbar tap alone triggered it. See the
        // composer in ai-chat.tsx for the full reasoning.
        className="w-32 bg-transparent text-[13px] text-ink-soft placeholder:text-ink-muted/60 focus:outline-none pointer-coarse:text-[16px] sm:w-44"
      />

      {showScopeToggle ? (
        <div
          role="group"
          aria-label="Search scope"
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-paper-deep/70 p-0.5"
        >
          <ScopeButton active={scope === "editor"} onClick={() => onScopeChange("editor")}>
            Editor
          </ScopeButton>
          <ScopeButton active={scope === "preview"} onClick={() => onScopeChange("preview")}>
            Preview
          </ScopeButton>
        </div>
      ) : null}

      {/* Stays mounted so the live region can still announce, but takes no layout
          space until there is a count to show — reserving the width permanently
          left a dead gap between the scope toggle and the arrows. `min-w-8` is
          just enough that stepping 9/100 -> 10/100 doesn't nudge the arrows. */}
      <span
        aria-live="polite"
        className={
          counter ? "min-w-8 text-right text-[11px] tabular-nums text-ink-muted" : "sr-only"
        }
      >
        {counter}
      </span>
      <SearchIconButton onClick={onPrev} disabled={count === 0} label="Previous match">
        <IconChevronUp />
      </SearchIconButton>
      <SearchIconButton onClick={onNext} disabled={count === 0} label="Next match">
        <IconChevronDown />
      </SearchIconButton>
      <SearchIconButton onClick={onClose} label="Close search">
        <IconClose />
      </SearchIconButton>
    </div>
  );
}

type ScopeButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ScopeButton({ active, onClick, children }: ScopeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-150 ease-out focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ember ${
        active ? "bg-paper text-ember shadow-sm" : "text-ink-muted hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

type SearchIconButtonProps = {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
};

function SearchIconButton({ onClick, label, disabled = false, children }: SearchIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-6 shrink-0 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-rule/40 hover:text-ember disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ember"
    >
      {children}
    </button>
  );
}

function IconChevronUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 8.5L7 5L10.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 5.5L7 9L10.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
