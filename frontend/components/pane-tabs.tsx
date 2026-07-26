"use client";

import { SiteCredit } from "@/components/site-credit";

export type Pane = "editor" | "preview";

const TABS: { id: Pane; index: string; label: string }[] = [
  { id: "editor", index: "01", label: "Editor" },
  { id: "preview", index: "02", label: "Preview" },
];

type PaneTabsProps = {
  active: Pane;
  onChange: (pane: Pane) => void;
};

/**
 * Mobile-only replacement for the two <PaneLabel>s. Below the `md` breakpoint the
 * split view is unusable, so the panes become tabs and only one is shown at a
 * time — see app/page.tsx, which keeps both mounted and hides the inactive one.
 */
export function PaneTabs({ active, onChange }: PaneTabsProps) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next: Pane = active === "editor" ? "preview" : "editor";
    onChange(next);
    // The old tab drops to tabIndex=-1 once it stops being selected, so focus has
    // to follow the selection or keyboard focus and the visible tab disagree.
    document.getElementById(`pane-tab-${next}`)?.focus();
  };

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-rule">
      <div role="tablist" aria-label="Panes" onKeyDown={onKeyDown} className="flex items-stretch">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`pane-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`pane-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2.5 border-b-2 px-5 text-[10px] uppercase tracking-[0.28em] transition-colors duration-150 ease-out focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ember ${
                selected
                  ? "border-ember text-ink"
                  : "border-transparent text-ink-muted/70 hover:text-ink-soft"
              }`}
            >
              <span className={`font-mono ${selected ? "text-ember" : "text-ink-muted/60"}`}>
                {tab.index}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center pl-3 pr-4">
        <SiteCredit variant="compact" className="text-[10px] leading-none" />
      </div>
    </div>
  );
}
