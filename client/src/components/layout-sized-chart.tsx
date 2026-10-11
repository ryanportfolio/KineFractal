import { cloneElement, useLayoutEffect, useRef, useState, type ReactElement } from "react";

/* Drop-in for Recharts' <ResponsiveContainer width="100%" height="100%">.

   ResponsiveContainer sizes the chart from getBoundingClientRect and from
   ResizeObserver's contentRect. Under the desktop root zoom (index.css, --pz)
   the first is in zoomed px everywhere, and Firefox 140 ESR also reports the
   second zoomed, so the chart stays drawn in screen px while Recharts divides
   the mouse position by the zoom: the hovered point and its tooltip land at
   1/1.4 of the cursor. offsetWidth/offsetHeight are layout px in every browser,
   so the chart is sized from those instead. */
export function LayoutSizedChart({ children }: { children: ReactElement<{ width?: number; height?: number }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize((s) =>
        s.width === el.offsetWidth && s.height === el.offsetHeight
          ? s
          : { width: el.offsetWidth, height: el.offsetHeight },
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {size.width > 0 && size.height > 0 && cloneElement(children, size)}
    </div>
  );
}
