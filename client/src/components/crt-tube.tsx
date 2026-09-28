// CrtTube — the one global CRT overlay stack (see "THE TUBE" in DESIGN.md).
//
// The page doesn't get per-widget CRT effects; the whole viewport sits behind
// one piece of curved glass. Layers (all fixed, pointer-events:none, tokens
// from index.css so phosphor theme swaps recolor the tube): raster, barrel
// vignette, corner glare, and a slow rolling scan bar. Costs zero JS after
// mount. (A full-tube flicker layer was tried and cut: too loud for an
// instrument.)
export function CrtTube() {
  return (
    <div aria-hidden="true" data-testid="crt-tube">
      <div className="tube-layer tube-raster" />
      <div className="tube-layer tube-vignette" />
      <div className="tube-layer tube-glare" />
      <div className="tube-layer tube-scanroll" />
    </div>
  );
}
