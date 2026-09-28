// Return-to paths for /account?next=... Only same-origin relative paths pass,
// so the parameter cannot send a visitor to another site after sign-in.

const NEXT_LABELS: Record<string, string> = {
  "/charts/": "charts",
};

/** The `next` value if it is a safe same-origin path, else null. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://kinefractal.invalid");
    if (url.origin !== "https://kinefractal.invalid") return null;
    const out = url.pathname + url.search + url.hash;
    // Dot segments can normalize "/%2e%2e//host" into "//host", which a browser
    // reads as another site; check the normalized result, not just the input.
    if (!out.startsWith("/") || out.startsWith("//") || out.startsWith("/\\")) return null;
    return out;
  } catch {
    return null;
  }
}

/** Short name for the page a `next` path returns to, for link text. */
export function nextLabel(next: string): string {
  const path = next.split(/[?#]/)[0];
  return NEXT_LABELS[path] ?? "where you were";
}
