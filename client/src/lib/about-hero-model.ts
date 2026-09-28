export const KINE_WORDS = [
  "MATICS",
  "FRACTAL",
  "MOMENTUM",
  "RATIO",
  "REGIME",
  "STRUCTURE",
  "SIGNAL",
  "CONTEXT",
] as const;

export const ABOUT_CTA_CHANNELS = [
  {
    channel: "CH1",
    title: "SECTOR_ROTATION",
    description: "Market sector analysis",
    href: "/sector-rotation",
    phosphor: "emerald",
  },
  {
    channel: "CH2",
    title: "RATIO_RELEVANCE",
    description: "Capital-flow analysis",
    href: "/ratio-relevance",
    phosphor: "amber",
  },
  {
    channel: "CH3",
    title: "ALERT_TERMINAL",
    description: "Free custom email alerts",
    href: "/alerts",
    phosphor: "ice",
  },
] as const;

export function nextKineWordIndex(index: number): number {
  return (index + 1) % KINE_WORDS.length;
}
