import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Restore the phosphor theme before first paint so the tube never flashes
// the default color. Values are validated — anything unknown falls back to
// the emerald default (no attribute).
try {
  const phos = localStorage.getItem("kf_phosphor");
  if (phos === "amber" || phos === "ice") {
    document.documentElement.setAttribute("data-phosphor", phos);
  }
} catch {
  /* storage unavailable (private mode) — emerald default */
}

createRoot(document.getElementById("root")!).render(<App />);
