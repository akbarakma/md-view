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
  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

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
    setTransform({ scale, tx, ty });
  }, [naturalSize]);

  // Fit whenever the diagram content changes.
  useLayoutEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, fullscreen]);

  const zoomBy = useCallback((factor: number, cx?: number, cy?: number) => {
    setTransform((t) => {
      const vp = viewportRef.current;
      const px = cx ?? (vp ? vp.clientWidth / 2 : 0);
      const py = cy ?? (vp ? vp.clientHeight / 2 : 0);
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale * factor));
      const k = scale / t.scale;
      // Keep the point under the cursor stationary.
      return { scale, tx: px - (px - t.tx) * k, ty: py - (py - t.ty) * k };
    });
  }, []);

  // Non-passive wheel listener so we can preventDefault the page scroll.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: transform.tx, ty: transform.ty };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setTransform((t) => ({ ...t, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) }));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div className="mermaid-viewport-wrap">
      <div
        ref={viewportRef}
        className={`mermaid-viewport${dragging ? " is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="img"
        aria-label="Rendered diagram"
      >
        <div
          ref={contentRef}
          className="mermaid-content"
          style={{
            transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
      <div className="mermaid-controls">
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          −
        </button>
        <button type="button" title="Reset view" aria-label="Reset view" onClick={fit}>
          ⤢
        </button>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
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
        <>
          <DiagramViewport svg={svg} onToggleFullscreen={() => setExpanded(true)} />
          {error && <div className="mermaid-stale">Diagram not updated — syntax error while editing.</div>}
        </>
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
