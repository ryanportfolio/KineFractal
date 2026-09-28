// phosphor — whole-tube theme switching with a physical degauss thump.
//
// One attribute on <html> recolors every surface, glow, trace and shader
// (see index.css). Switching themes is a physical event on a real tube, so
// it gets the one-shot degauss animation.

export type PhosphorTheme = "emerald" | "amber" | "ice";

export function setPhosphor(theme: PhosphorTheme) {
  const el = document.documentElement;
  if (theme === "emerald") el.removeAttribute("data-phosphor");
  else el.setAttribute("data-phosphor", theme);
  try {
    localStorage.setItem("kf_phosphor", theme === "emerald" ? "" : theme);
    if (theme === "emerald") localStorage.removeItem("kf_phosphor");
  } catch {
    /* private mode — theme just doesn't persist */
  }
  // degauss: retint with a body
  el.classList.remove("kf-degauss");
  // force a reflow so back-to-back switches re-trigger the animation
  void el.offsetWidth;
  el.classList.add("kf-degauss");
  window.setTimeout(() => el.classList.remove("kf-degauss"), 400);
}

export function currentPhosphor(): PhosphorTheme {
  const v = document.documentElement.getAttribute("data-phosphor");
  return v === "amber" || v === "ice" ? v : "emerald";
}
