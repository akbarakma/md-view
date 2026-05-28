"use client";

import { useEffect, useRef, useState } from "react";
import { decodeShareFromHash } from "@/lib/share-url";

const STORAGE_KEY = "md-view:document";
const DEBOUNCE_MS = 200;

export function usePersistedMd(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearHash = () => {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    };

    const consumeHash = (confirmReplace: boolean): boolean => {
      const shared = decodeShareFromHash(window.location.hash);
      if (shared === null) return false;
      if (confirmReplace) {
        const ok = window.confirm(
          "Load shared document? This will replace your current draft.",
        );
        if (!ok) {
          clearHash();
          return false;
        }
      }
      setValue(shared);
      clearHash();
      return true;
    };

    if (!consumeHash(false)) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) setValue(stored);
      } catch {
        // localStorage unavailable (private mode, quota, etc.) — fall back to initial
      }
    }
    setHydrated(true);

    const onHashChange = () => {
      consumeHash(true);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
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
