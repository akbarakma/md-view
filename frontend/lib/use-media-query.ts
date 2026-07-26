"use client";

import { useCallback, useSyncExternalStore } from "react";

// useSyncExternalStore calls getSnapshot on every render of every subscriber, so
// hand back one MediaQueryList per query instead of allocating a new one each time.
const cache = new Map<string, MediaQueryList>();

function mql(query: string): MediaQueryList {
  let m = cache.get(query);
  if (!m) {
    m = window.matchMedia(query);
    cache.set(query, m);
  }
  return m;
}

/**
 * Subscribe to a CSS media query.
 *
 * The server snapshot is always `false`, i.e. the prerendered markup is the
 * *narrow* layout, and wide viewports swap to their layout once JS runs. That way
 * round is deliberate: phones — the slower devices, and the ones that hydrate
 * last — get the correct layout in the very first paint, and the brief swap is
 * paid by desktops, which hydrate fast enough that it is a single frame.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const m = mql(query);
      m.addEventListener("change", onStoreChange);
      return () => m.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => mql(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
