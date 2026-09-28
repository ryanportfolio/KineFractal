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
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** Short name for the page a `next` path returns to, for link text. */
export function nextLabel(next: string): string {
  const path = next.split(/[?#]/)[0];
  return NEXT_LABELS[path] ?? "where you were";
}
