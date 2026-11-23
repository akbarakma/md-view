"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef,
  type Layout,
} from "react-resizable-panels";

const STORAGE_KEY = "md-view:split-layout";
const SAVE_DEBOUNCE_MS = 150;

type SplitPaneProps = {
  left: ReactNode;
  right: ReactNode;
  hidden?: "left" | "right";
};

function isValidLayout(value: unknown): value is Layout {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.left === "number" && typeof obj.right === "number";
}

export function SplitPane({ left, right, hidden }: SplitPaneProps) {
  const groupRef = useGroupRef();
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValidLayout(parsed)) groupRef.current?.setLayout(parsed);
    } catch {
      // ignore parse / storage errors
    }
  }, [groupRef]);

  const handleLayoutChanged = (layout: Layout) => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      } catch {
        // ignore quota / disabled
      }
    }, SAVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <Group
      orientation="horizontal"
      className="h-full w-full"
      groupRef={groupRef}
      onLayoutChanged={handleLayoutChanged}
    >
      {/* Hidden with CSS, not unmounted, so the saved layout survives and the
          preview never re-renders its mermaid diagrams on a mode switch. */}
      <Panel
        id="left"
        defaultSize={50}
        minSize={20}
        className="flex flex-col h-full"
        data-pane-hidden={hidden === "left" || undefined}
      >
        {left}
      </Panel>
      <Separator className="resize-handle" data-pane-hidden={hidden ? true : undefined} />
      <Panel
        id="right"
        defaultSize={50}
        minSize={20}
        className="flex flex-col h-full"
        data-pane-hidden={hidden === "right" || undefined}
      >
        {right}
      </Panel>
    </Group>
  );
}
