"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shows a fixed-width document (the A4 registration sheet) scaled down to fit narrow screens, so a
 * phone sees the whole page instead of its left half. Uses CSS zoom, which also shrinks the space the
 * sheet takes. Printing is never scaled: the sheet prints at its exact size.
 */
export function FitToWidth({ width, children }: { width: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={ref} className="w-full">
      <div style={{ zoom: scale }} className="print:[zoom:1]!">{children}</div>
    </div>
  );
}
