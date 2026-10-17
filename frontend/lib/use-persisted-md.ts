"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "md-view:document";
const DEBOUNCE_MS = 200;

export function usePersistedMd(initialValue: string, sharedDoc?: string) {
  const [value, setValue] = useState(sharedDoc ?? initialValue);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<number | null>(null);
  // Strict Mode runs mount effects twice; without this the replace prompt would show twice.
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fall back to initial
    }

    if (sharedDoc === undefined) {
      if (stored !== null) setValue(stored);
    } else {
      const hasOwnDraft = stored !== null && stored !== initialValue && stored !== sharedDoc;
      if (
        hasOwnDraft &&
        !window.confirm("Load shared document? This will replace your current draft.")
      ) {
        // The share URL stays, so the user can save their draft and reload to open the link later.
        setValue(stored!);
      } else {
        // Deferred: Next patches history.replaceState in a parent effect that runs after this one.
        window.setTimeout(() => window.history.replaceState(null, "", "/"), 0);
      }
    }
    setHydrated(true);
  }, [initialValue, sharedDoc]);

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
