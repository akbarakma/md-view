"use client";

import { useSyncExternalStore } from "react";

export type ViewMode = "editor" | "split" | "preview";

const STORAGE_KEY = "md-view:view-mode";

function isViewMode(value: unknown): value is ViewMode {
  return value === "editor" || value === "split" || value === "preview";
}

// Kept in memory as well, so switching still works when storage is disabled.
let current: ViewMode | null = null;
const listeners = new Set<() => void>();

function read(): ViewMode {
  if (current === null) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      current = isViewMode(stored) ? stored : "split";
    } catch {
      current = "split";
    }
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setViewMode(mode: ViewMode) {
  current = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore quota / disabled storage
  }
  listeners.forEach((listener) => listener());
}

export function useViewMode(): ViewMode {
  return useSyncExternalStore(subscribe, read, () => "split");
}
