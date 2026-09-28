// useDocumentMeta — set the per-route <title> + description/OG/Twitter tags.
//
// This is a client-side (JS) hook: it fixes the browser tab title and helps
// crawlers that render JS (Google). OG scrapers that don't run JS (Slack,
// iMessage, Discord, Twitter, Facebook) still read the static index.html — so
// this does NOT produce per-route share cards. That needs server-side
// injection, deliberately deferred (report links aren't shared).
//
// On unmount every touched tag is restored to its prior value, so navigating
// from a page that sets meta back to one that doesn't (e.g. Home) reverts to
// the index.html defaults instead of keeping the last page's title.
import { useEffect } from "react";

const BRAND = "Kine Fractal";

function setMeta(selector: string, attr: "content", value: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  let created = false;
  if (!el) {
    el = document.createElement("meta");
    // selector is like `meta[name="description"]` or `meta[property="og:title"]`
    const m = selector.match(/meta\[(name|property)="([^"]+)"\]/);
    if (m) el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.getAttribute(attr);
  el.setAttribute(attr, value);
  return () => {
    if (created) el!.remove();
    else if (prev != null) el!.setAttribute(attr, prev);
  };
}

export interface DocumentMeta {
  /** Page title WITHOUT the brand suffix; " · Kine Fractal" is appended. */
  title: string;
  description?: string;
}

export function useDocumentMeta({ title, description }: DocumentMeta): void {
  useEffect(() => {
    const fullTitle = `${title} · ${BRAND}`;
    const prevTitle = document.title;
    document.title = fullTitle;

    const restores: Array<() => void> = [
      setMeta('meta[property="og:title"]', "content", fullTitle),
      setMeta('meta[name="twitter:title"]', "content", fullTitle),
    ];
    if (description) {
      restores.push(
        setMeta('meta[name="description"]', "content", description),
        setMeta('meta[property="og:description"]', "content", description),
        setMeta('meta[name="twitter:description"]', "content", description),
      );
    }

    return () => {
      document.title = prevTitle;
      for (const restore of restores) restore();
    };
  }, [title, description]);
}
