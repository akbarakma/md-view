"use client";

import { useEffect, useRef } from "react";

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  count: number;
  current: number; // 1-based index of the active match, 0 when none
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
};

export function SearchBar({
  query,
  onQueryChange,
  count,
  current,
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
      className="absolute right-4 top-3 z-10 flex items-center gap-1.5 rounded-full border border-rule bg-paper/95 py-1 pl-3 pr-1.5 shadow-sm backdrop-blur"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search text…"
        aria-label="Search text in editor and preview"
        className="w-44 bg-transparent text-[13px] text-ink-soft placeholder:text-ink-muted/60 focus:outline-none"
      />
      <span className="min-w-[2.5rem] text-right text-[11px] tabular-nums text-ink-muted" aria-live="polite">
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
      className="grid size-6 place-items-center rounded-full text-ink-muted transition-colors duration-150 hover:bg-rule/40 hover:text-ember disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ember"
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
