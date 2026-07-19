"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * Lazily loaded mermaid singleton. The library is ~2–3 MB, so we keep it out of
 * the main bundle and only pull it in the first time a diagram scrolls into view.
 */
type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default as unknown as MermaidApi;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        themeVariables: {
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: "13px",
          background: "#faf7f2",
          primaryColor: "#f1ece0",
          primaryBorderColor: "#c9bfad",
          primaryTextColor: "#1a1815",
          secondaryColor: "#efe9dc",
          tertiaryColor: "#faf7f2",
          lineColor: "#7a7468",
          textColor: "#4a463f",
          pie1: "#c2410c",
          pie2: "#e8845a",
          pie3: "#7a7468",
          pie4: "#c9bfad",
          pie5: "#4a463f",
          pieStrokeColor: "#e5dfd3",
          pieOuterStrokeColor: "#e5dfd3",
        },
        er: { useMaxWidth: false },
        flowchart: { useMaxWidth: false },
        sequence: { useMaxWidth: false },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

type Transform = { scale: number; tx: number; ty: number };

/**
 * A pan/zoom canvas for a rendered mermaid SVG string. Drag to pan, wheel or the
 * ± buttons to zoom. Auto-fits the diagram the first time an SVG is shown.
 */
function DiagramViewport({
  svg,
  fullscreen = false,
  onToggleFullscreen,
}: {
  svg: string;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  // Single source of truth for the current transform. Pan/zoom mutate this ref
  // and write straight to the DOM (via `paint`), so dragging a large diagram
  // never triggers a React re-render of the injected SVG subtree — the old
  // setState path reconciled thousands of SVG nodes on every pointer frame,
  // which is what made fullscreen pan feel laggy on mobile.
  const tRef = useRef<Transform>({ scale: 1, tx: 0, ty: 0 });
  const rafRef = useRef<number | null>(null);
  const dropTimer = useRef<number | null>(null);

  // Coalesce every transform change into one style write per animation frame.
  const paint = useCallback(() => {
    rafRef.current = null;
    const el = contentRef.current;
    if (!el) return;
    const { scale, tx, ty } = tRef.current;
    el.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, []);
  const schedulePaint = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(paint);
  }, [paint]);

  // Promote the content to its own compositor layer only while interacting, then
  // drop it so a big SVG isn't held in GPU memory for the whole life of the modal.
  const enableLayer = useCallback(() => {
    if (dropTimer.current != null) {
      clearTimeout(dropTimer.current);
      dropTimer.current = null;
    }
    if (contentRef.current) contentRef.current.style.willChange = "transform";
  }, []);
  const scheduleDropLayer = useCallback(() => {
    if (dropTimer.current != null) clearTimeout(dropTimer.current);
    dropTimer.current = window.setTimeout(() => {
      dropTimer.current = null;
      if (contentRef.current) contentRef.current.style.willChange = "auto";
    }, 400);
  }, []);

  // Normalise the injected SVG to its natural pixel size and return it.
  const naturalSize = useCallback((): { w: number; h: number } | null => {
    const svgEl = contentRef.current?.querySelector("svg");
    if (!svgEl) return null;
    const vb = svgEl.viewBox?.baseVal;
    const w = vb && vb.width ? vb.width : svgEl.getBoundingClientRect().width;
    const h = vb && vb.height ? vb.height : svgEl.getBoundingClientRect().height;
    svgEl.style.maxWidth = "none";
    svgEl.setAttribute("width", String(w));
    svgEl.setAttribute("height", String(h));
    return { w, h };
  }, []);

  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const size = naturalSize();
    if (!vp || !size || size.w === 0) return;
    const pad = 24;
    const cw = vp.clientWidth - pad;
    const ch = vp.clientHeight - pad;
    const scale = Math.max(MIN_SCALE, Math.min(cw / size.w, ch / size.h, 1));
    const tx = (vp.clientWidth - size.w * scale) / 2;
    const ty = (vp.clientHeight - size.h * scale) / 2;
    tRef.current = { scale, tx, ty };
    paint();
  }, [naturalSize, paint]);

  // Fit whenever the diagram content changes.
  useLayoutEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, fullscreen]);

  // Zoom around a viewport-local point, keeping that point stationary.
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const t = tRef.current;
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor));
      const k = scale / t.scale;
      tRef.current = { scale, tx: px - (px - t.tx) * k, ty: py - (py - t.ty) * k };
      enableLayer();
      scheduleDropLayer();
      schedulePaint();
    },
    [enableLayer, scheduleDropLayer, schedulePaint],
  );
  const zoomByCenter = useCallback(
    (factor: number) => {
      const vp = viewportRef.current;
      zoomAt(factor, vp ? vp.clientWidth / 2 : 0, vp ? vp.clientHeight / 2 : 0);
    },
    [zoomAt],
  );

  // Non-passive wheel listener so we can preventDefault the page scroll.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Cancel any pending frame / timer on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (dropTimer.current != null) clearTimeout(dropTimer.current);
    },
    [],
  );

  // Active pointers (two = pinch). Pan and pinch are both driven imperatively
  // through tRef + schedulePaint, so touch gestures stay off the React render path.
  const rectRef = useRef<DOMRect | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ id: number; x: number; y: number; tx: number; ty: number } | null>(null);
  const pinch = useRef<{ dist: number; mx: number; my: number; scale: number; tx: number; ty: number } | null>(null);

  const localPoint = (e: React.PointerEvent) => {
    const r = rectRef.current;
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const startPan = (id: number, p: { x: number; y: number }) => {
    const t = tRef.current;
    pan.current = { id, x: p.x, y: p.y, tx: t.tx, ty: t.ty };
  };
  const releaseCapture = (id: number) => {
    try {
      viewportRef.current?.releasePointerCapture(id);
    } catch {
      /* pointer already gone (e.g. pointercancel) */
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pointers.current.size === 0) {
      rectRef.current = viewportRef.current?.getBoundingClientRect() ?? null;
    }
    viewportRef.current?.setPointerCapture?.(e.pointerId);
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    setDragging(true);
    enableLayer();

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const t = tRef.current;
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        scale: t.scale,
        tx: t.tx,
        ty: t.ty,
      };
      pan.current = null;
    } else if (pointers.current.size === 1) {
      startPan(e.pointerId, p);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const s = pinch.current;
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s.scale * (dist / s.dist)));
      // The content point under the gesture's initial midpoint stays under the
      // current midpoint — folds pinch-zoom and two-finger pan into one update.
      const cx = (s.mx - s.tx) / s.scale;
      const cy = (s.my - s.ty) / s.scale;
      tRef.current = { scale, tx: mx - cx * scale, ty: my - cy * scale };
      schedulePaint();
    } else if (pan.current && pan.current.id === e.pointerId) {
      const d = pan.current;
      const t = tRef.current;
      tRef.current = { scale: t.scale, tx: d.tx + (p.x - d.x), ty: d.ty + (p.y - d.y) };
      schedulePaint();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    releaseCapture(e.pointerId);
    pointers.current.delete(e.pointerId);

    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      // Resume single-finger pan with the finger still on screen.
      const [[id, p]] = [...pointers.current.entries()];
      startPan(id, p);
    } else if (pointers.current.size === 0) {
      pan.current = null;
      setDragging(false);
      scheduleDropLayer();
    }
  };

  return (
    <div className="mermaid-viewport-wrap">
      <div
        ref={viewportRef}
        className={`mermaid-viewport${dragging ? " is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Rendered diagram"
      >
        <div ref={contentRef} className="mermaid-content" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="mermaid-controls">
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomByCenter(1 / 1.2)}>
          −
        </button>
        <button type="button" title="Reset view" aria-label="Reset view" onClick={fit}>
          ⤢
        </button>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomByCenter(1.2)}>
          +
        </button>
        {onToggleFullscreen && (
          <button
            type="button"
            title={fullscreen ? "Exit full screen" : "Full screen"}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={onToggleFullscreen}
          >
            {fullscreen ? "×" : "⛶"}
          </button>
        )}
      </div>
    </div>
  );
}

function MermaidDiagramImpl({ code }: { code: string }) {
  const reactId = useId();
  const safeId = "mmd-" + reactId.replace(/[^a-zA-Z0-9-]/g, "");
  const seq = useRef(0);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const staticRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Only render once the block scrolls near the viewport.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  // Render (debounced once a diagram already exists, so editing keeps the last
  // good picture on screen instead of flashing).
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const run = async () => {
      try {
        const mermaid = await loadMermaid();
        const id = `${safeId}-${seq.current++}`;
        const out = await mermaid.render(id, code);
        if (!cancelled) {
          setSvg(out.svg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    const hasPrevious = svg !== "";
    const t = setTimeout(run, hasPrevious ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, inView, safeId]);

  // Make the inline (non-fullscreen) SVG scale to the pane width so the page
  // scrolls normally over it — zoom/pan is reserved for the fullscreen view.
  useLayoutEffect(() => {
    const svgEl = staticRef.current?.querySelector("svg");
    if (!svgEl) return;
    svgEl.style.maxWidth = "100%";
    svgEl.style.height = "auto";
  }, [svg]);

  // Close the fullscreen modal on Escape.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <div ref={boxRef} className="mermaid-block not-prose">
      {svg ? (
        <div className="mermaid-static-wrap">
          <div ref={staticRef} className="mermaid-static" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mermaid-controls">
            <button type="button" title="Full screen" aria-label="Full screen" onClick={() => setExpanded(true)}>
              ⛶
            </button>
          </div>
          {error && <div className="mermaid-stale">Diagram not updated — syntax error while editing.</div>}
        </div>
      ) : error ? (
        <div className="mermaid-error">
          <div className="mermaid-error-title">Couldn’t render this diagram</div>
          <pre>{error}</pre>
          <pre className="mermaid-error-src">{code}</pre>
        </div>
      ) : (
        <div className="mermaid-loading">Rendering diagram…</div>
      )}

      {expanded && svg && (
        <div className="mermaid-modal" role="dialog" aria-modal="true" onClick={() => setExpanded(false)}>
          <div className="mermaid-modal-inner" onClick={(e) => e.stopPropagation()}>
            <DiagramViewport svg={svg} fullscreen onToggleFullscreen={() => setExpanded(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

// Memoised on the source so typing elsewhere in the document never re-renders a
// diagram that didn't change.
export const MermaidDiagram = memo(MermaidDiagramImpl, (a, b) => a.code === b.code);
