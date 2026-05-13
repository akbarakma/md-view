"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "md-view:document";
const DEBOUNCE_MS = 200;

export function usePersistedMd(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setValue(stored);
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fall back to initial
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // ignore quota / disabled storage
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [value, hydrated]);

  return [value, setValue] as const;
}
