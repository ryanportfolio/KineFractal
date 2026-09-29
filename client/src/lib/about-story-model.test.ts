import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Board, LabReport } from "@/data/lab-data";
import {
  AUTOPLAY_AT, BEATS, FrameGovernor, fmtPct, yearsThrough, EPISODE_EVENTS, FREE_RATE, SCROLL_LEAD, StoryPlayback, buildStory, episodeClock, paceLimit,
  readSecs, stepShown, windowAlpha,
  type Episode, type PaceWindow,
} from "./about-story-model";

const json = <T>(rel: string): T =>
  JSON.parse(readFileSync(new URL(`../../public/fearlab/${rel}`, import.meta.url), "utf8")) as T;

const board = json<Board>("board.json");
const ep = json<Episode>("episodes/spy-2020.json");
const reportKey = (sym: string) => board.combos.find((c) => c.sym === sym && c.start === "full")!.key;
const reports = {
  spy: json<LabReport>(`${reportKey("SPY")}.json`),
  qqq: json<LabReport>(`${reportKey("QQQ")}.json`),
  iwm: json<LabReport>(`${reportKey("IWM")}.json`),
};
const story = buildStory(reports, board, ep);
const dayIndex = new Map(ep.days.map((d, i) => [d.d, i]));

test("every narrated 2020 event matches a same-side simulated fill in the episode file", () => {
  assert.equal(story.episode.events.length, EPISODE_EVENTS.length);
  for (const e of EPISODE_EVENTS) {
    assert.ok(ep.fills.some((f) => f.d === e.d && f.side === e.side), `${e.d} ${e.side}`);
    // a day with several same-side fills must name the engine it narrates
    const same = ep.fills.filter((f) => f.d === e.d && f.side === e.side);
    if (same.length > 1) assert.ok(e.eng, `${e.d} needs an engine to pick one of ${same.length} fills`);
  }
  const may29 = story.episode.events.find((e) => ep.days[e.i].d === "2020-05-29");
  assert.equal(may29?.fill.eng, "Reclaim");
});

test("the 2020 captions' factual claims hold in the episode data", () => {
  // "fills at the open on Mar 23. That day ends on the lowest close of the year"
  assert.equal(ep.days[story.episode.lowIndex].d, "2020-03-23");
  // "Three sessions later, ... buys ... back in"
  assert.equal(dayIndex.get("2020-03-12")! - dayIndex.get("2020-03-09")!, 3);
  // "Prices are still near their high": within 3% of the high so far
  const i = dayIndex.get("2020-02-03")!;
  const high = Math.max(...ep.days.slice(0, i + 1).map((d) => d.c));
  assert.ok(ep.days[i].c >= high * 0.97);
  // the Mar 9 caption quotes the fear reading known when the sell was decided: the prior close
  assert.match(story.episode.events[1].text, new RegExp(`with fear at ${ep.days[dayIndex.get("2020-03-09")! - 1].fear}\\.`));
});

test("scoreboard counts are derived from the artifacts", () => {
  assert.equal(story.cohorts.length, board.startCohorts.rows.length);
  assert.equal(story.cohortsAhead, board.startCohorts.rows.filter((r) => r.edge_pp > 0).length);
  for (const f of story.funds) {
    const r = reports[f.sym.toLowerCase() as keyof typeof reports];
    const done = r.yearly.filter((y) => !y.partial);
    assert.equal(f.total, done.length);
    assert.equal(f.ahead, done.filter((y) => y.edge > 0).length);
  }
});

test("episode clock is monotonic and inverts progressAt", () => {
  const clock = episodeClock(ep.days.length, story.episode.events.map((e) => e.i));
  let prev = -1;
  for (let p = BEATS.episode[0]; p <= BEATS.episode[1]; p += 0.001) {
    const c = clock.cursor(p);
    assert.ok(c >= prev - 1e-9);
    prev = c;
  }
  for (const i of [0, 21, 46, 49, 120, ep.days.length - 1]) {
    assert.ok(Math.abs(clock.cursor(clock.progressAt(i)) - i) < 1e-6, `session ${i}`);
  }
});

test("back-to-back caption windows never overlap", () => {
  for (let p = 0.3; p < 0.5; p += 0.0005) {
    assert.ok(windowAlpha(p, 0.3, 0.4, 0.01) + windowAlpha(p, 0.4, 0.5, 0.01) <= 1 + 1e-9);
  }
  assert.equal(windowAlpha(0.35, 0.3, 0.4), 1);
});

test("a flick to the end still holds every caption for its reading time", () => {
  const windows: PaceWindow[] = [
    { a: 0.1, b: 0.12, read: readSecs("A breadth warning trims 85% while prices are still near the high.") },
    { a: 0.12, b: 0.125, read: 3 },
    { a: 0.4, b: 0.6, read: 6 },
  ];
  const up = new Map<PaceWindow, number>();
  let shown = 0, t = 0;
  const dt = 1 / 60;
  while (shown < 1 && t < 600) {
    for (const w of windows) if (shown >= w.a && shown < w.b) up.set(w, (up.get(w) ?? 0) + dt);
    shown = stepShown(windows, shown, 1, dt);
    t += dt;
  }
  assert.equal(shown, 1);
  for (const w of windows) assert.ok((up.get(w) ?? 0) >= w.read * 0.98, `${w.a}: ${up.get(w)} < ${w.read}`);
  // gaps between captions still take at least their free-rate time
  assert.ok(t >= (1 - 0.22) / FREE_RATE * 0.98);
});

test("reading time follows caption length within its bounds", () => {
  assert.equal(readSecs(""), 3);
  assert.equal(readSecs("word ".repeat(80)), 16);
  assert.ok(readSecs("word ".repeat(40)) >= 13); // a long caption is not cut short
  assert.ok(readSecs("one two three four five six seven eight nine ten") > readSecs("one two three"));
});

const PACE: PaceWindow[] = [{ a: 0.1, b: 0.14, read: 4 }, { a: 0.5, b: 0.52, read: 3 }];
const DT = 1 / 60;

test("a small push past the ignition beat autoplays the film to the end with no more scrolling", () => {
  const play = new StoryPlayback(PACE, 0);
  let t = 0;
  play.onScroll(AUTOPLAY_AT + 0.005, 0);
  while (!play.finished && t < 600) { play.tick(DT); t += DT; }
  assert.ok(play.finished);
  assert.equal(play.shown, 1);
});

test("scrolling down during autoplay never speeds the film up or runs the page ahead of it", () => {
  const play = new StoryPlayback(PACE, 0);
  let t = 0;
  while (!play.finished && t < 600) {
    const hold = play.onScroll(1, t * 1000); // reader hammers the wheel every frame
    const page = hold ?? 1;
    assert.ok(page <= play.shown + SCROLL_LEAD + 1e-9);
    const before = play.shown;
    play.tick(DT);
    assert.ok(play.shown - before <= paceLimit(PACE, before) * DT + 1e-9);
    t += DT;
  }
  assert.ok(play.finished);
});

test("scrolling up pauses autoplay and rewinds; scrolling down again resumes it", () => {
  const play = new StoryPlayback(PACE, 0);
  play.onScroll(AUTOPLAY_AT + 0.005, 0);
  for (let i = 0; i < 60 * 20; i++) play.tick(DT);
  assert.ok(play.auto);
  const at = play.shown;
  play.onScroll(at - 0.05, 0);
  assert.equal(play.auto, false);
  for (let i = 0; i < 60 * 10; i++) play.tick(DT);
  assert.ok(Math.abs(play.shown - (at - 0.05)) < 1e-3);
  play.onScroll(play.shown + 0.01, 0);
  play.tick(DT);
  assert.ok(play.auto);
});

test("after the film finishes, scroll drives it directly", () => {
  const play = new StoryPlayback(PACE, 0);
  play.skip();
  assert.equal(play.onScroll(0.2, 0), null);
  for (let i = 0; i < 120; i++) play.tick(DT);
  assert.ok(Math.abs(play.shown - 0.2) < 1e-3);
  assert.equal(play.onScroll(0.9, 0), null);
  assert.equal(play.skipOffered(0), false);
});

test("reports with carried calendar years leave the years beat out instead of showing Infinity", () => {
  const carried = (r: LabReport): LabReport => ({ ...r, yearlyBasis: "carried" });
  const s = buildStory({ spy: carried(reports.spy), qqq: carried(reports.qqq), iwm: carried(reports.iwm) }, board, ep);
  assert.equal(s.hasYears, false);
  assert.ok(Number.isFinite(s.firstYear) && Number.isFinite(s.lastYear));
  assert.equal(story.hasYears, true);
});

test("data that arrives late never starts the film as finished", () => {
  const pace: PaceWindow[] = [{ a: 0.1, b: 0.2, read: 5 }];
  // reader already below the film: parked at the end, not finished, page left alone
  const below = StoryPlayback.atLoad(pace, 1);
  const bp = below.play;
  assert.equal(bp.finished, false);
  assert.equal(bp.parked, true);
  assert.equal(below.holdAt, null);
  for (let k = 0; k < 30; k++) assert.equal(bp.tick(1 / 30), null);
  // scrolling back up into the film never holds or yanks the page, and never starts autoplay
  assert.equal(bp.onScroll(0.9, 0), null);
  for (let k = 0; k < 600; k++) assert.equal(bp.tick(1 / 60), null);
  assert.equal(bp.auto, false);
  assert.ok(Math.abs(bp.shown - 0.9) < 1e-3, `rewound to the page, got ${bp.shown}`);
  assert.equal(bp.finished, false);
  // a fresh downward push starts paced playback from there
  bp.onScroll(0.91, 0);
  assert.equal(bp.auto, true);
  // reader part-way through the film: held back to its start
  const inside = StoryPlayback.atLoad(pace, 0.5);
  assert.equal(inside.play.finished, false);
  assert.equal(inside.holdAt, 0);
  // reader above the film: nothing to do
  assert.equal(StoryPlayback.atLoad(pace, 0).holdAt, null);
});

test("a fund with carried years is marked unavailable, never counted as 0 of 0", () => {
  const s = buildStory({ spy: reports.spy, qqq: { ...reports.qqq, yearlyBasis: "carried" }, iwm: reports.iwm }, board, ep);
  const qqq = s.funds.find((f) => f.sym === "QQQ")!;
  assert.equal(qqq.available, false);
  assert.equal(s.hasYears, true);
  assert.ok(s.funds.filter((f) => f.sym !== "QQQ").every((f) => f.available && f.total > 0));
});

test("keyboard focus jumping below an unplayed film parks it instead of clamping the page", () => {
  const play = new StoryPlayback([{ a: 0.1, b: 0.2, read: 5 }], 0);
  play.onScroll(0.005, 0);
  play.park();
  assert.equal(play.onScroll(1, 0), null);
  assert.equal(play.tick(1 / 60), null);
  assert.equal(play.finished, false);
});

test("rewinding tracks the reader's scroll promptly, with no reading-pace cap", () => {
  const pace: PaceWindow[] = [{ a: 0, b: 1, read: 60 }];
  let shown = 0.81;
  for (let k = 0; k < 30; k++) shown = stepShown(pace, shown, 0.449, 1 / 60); // half a second
  assert.ok(shown - 0.449 < 0.01, `still ${shown}`);
  // forward stays capped by the caption's reading time
  assert.ok(stepShown(pace, 0.2, 0.9, 1 / 60) - 0.2 <= (1 / 60) / 60 + 1e-9);
});

test("a steady 30 Hz display never loses resolution; a real stall does, and recovers", () => {
  const g30 = new FrameGovernor();
  for (let k = 0; k < 2000; k++) assert.equal(g30.report(33.3, 4), 1);
  assert.ok(Math.abs(g30.budget - 33.3) < 0.5);
  const g = new FrameGovernor();
  for (let k = 0; k < 60; k++) g.report(16.7, 3);
  for (let k = 0; k < 7; k++) g.report(60, 20); // sustained stalls
  assert.equal(g.scale, 0.8);
  for (let k = 0; k < 300; k++) g.report(16.7, 3);
  assert.equal(g.scale, 1);
});

test("hiccup pairs (one long frame, one short catch-up) do not pull the learned interval down", () => {
  const g = new FrameGovernor();
  for (let k = 0; k < 40; k++) g.report(33.3, 4);
  for (let k = 0; k < 400; k++) {
    if (k % 10 === 0) { g.report(50, 4); g.report(16.7, 4); } else g.report(33.3, 4);
  }
  assert.ok(Math.abs(g.budget - 33.3) < 0.5, `budget ${g.budget}`);
  assert.equal(g.scale, 1);
});

test("a small upward scroll pauses autoplay; the next tick does not carry the page back down", () => {
  const play = new StoryPlayback([{ a: 0, b: 1, read: 400 }], 0.02);
  play.onScroll(0.03, 0);
  for (let k = 0; k < 60; k++) play.tick(1 / 60);
  assert.equal(play.auto, true);
  const at = play.page;
  assert.equal(play.onScroll(at - 0.0005, 0), null); // a few px up
  assert.equal(play.auto, false);
  for (let k = 0; k < 60; k++) assert.equal(play.tick(1 / 60), null);
});

test("cohort values are signed, never +-", () => {
  assert.equal(fmtPct(-10), "−10%");
  assert.equal(fmtPct(4814.2), "+4,814%");
  assert.equal(fmtPct(-0.4), "0%");
  assert.equal(fmtPct(0.4), "0%");
});

test("on a 400 px tall viewport, own scrolls are skipped and a genuine 1 px upward scroll pauses", () => {
  // 1100vh film on a 400 px window: 4,000 px of scroll span; the component
  // drops scroll events that land on the pixel its own scrollTo produced
  const span = 4000;
  const play = new StoryPlayback([{ a: 0, b: 1, read: 400 }], 0.02);
  play.onScroll(0.03, 0);
  let ownPx = -1;
  const scrollEvent = (px: number) => { if (px !== ownPx) play.onScroll(px / span, 0); };
  for (let k = 0; k < 600; k++) {
    const carry = play.tick(1 / 60);
    if (carry != null) { ownPx = Math.floor(carry * span); scrollEvent(ownPx); }
  }
  assert.equal(play.auto, true);
  assert.ok(play.shown > 0.03, `stalled at ${play.shown}`);
  scrollEvent(ownPx - 1); // the reader nudges up one pixel
  assert.equal(play.auto, false);
});

test("sustained slow frames lower quality and do not raise it again while they stay slow", () => {
  const g = new FrameGovernor();
  for (let k = 0; k < 60; k++) g.report(16.7, 3);
  for (let k = 0; k < 2000; k++) g.report(33.3, 12);
  assert.equal(g.scale, 0.6);
  // the steady slower rate is eventually adopted as the display's (so it stops
  // counting as misses), but quality is not raised for it
  assert.ok(Math.abs(g.budget - 33.3) < 0.5, `target ${g.budget}`);
  for (let k = 0; k < 300; k++) g.report(16.7, 3); // frames recover
  assert.ok(g.scale > 0.6);
});

test("a reader jump past the film's end mid-play parks it instead of pulling the page back", () => {
  const play = new StoryPlayback([{ a: 0, b: 1, read: 400 }], 0.02);
  play.onScroll(0.03, 0);
  for (let k = 0; k < 60; k++) play.tick(1 / 60);
  play.park(); // what the page does when a reader scroll lands past the film's end
  assert.equal(play.parked, true);
  assert.equal(play.onScroll(1, 0), null);
  for (let k = 0; k < 120; k++) assert.equal(play.tick(1 / 60), null);
});

test("after late data holds the reader at the film start, the first downward scroll plays", () => {
  const { play, holdAt } = StoryPlayback.atLoad([{ a: 0, b: 1, read: 400 }], 0.4);
  assert.equal(holdAt, 0);
  assert.equal(play.page, 0);
  // the first downward scroll is read as downward (not as a rewind from 0.4)
  play.onScroll(0.008, 0);
  assert.equal(play.auto, false);
  assert.equal(play.wanted, 0.008);
  for (let k = 0; k < 60; k++) play.tick(1 / 60);
  assert.ok(play.shown > 0.002, `did not start: ${play.shown}`);
});

test("a display that slows (144 Hz to 60) relearns its target, and cheap draws bring quality back", () => {
  const g = new FrameGovernor();
  for (let k = 0; k < 100; k++) g.report(6.9, 2);
  for (let k = 0; k < 3000; k++) g.report(16.7, 2);
  assert.ok(Math.abs(g.budget - 16.7) < 0.5, `target ${g.budget}`);
  // draws cost ~2 ms of a 16.7 ms frame: quality comes back (E28)
  assert.equal(g.scale, 1);
});

test("a parked film stays parked while a smooth scroll travels down through it", () => {
  const play = new StoryPlayback([{ a: 0, b: 1, read: 400 }], 0.2);
  play.park(0.2); // End key pressed at 0.2
  for (const p of [0.25, 0.5, 0.8, 1]) assert.equal(play.onScroll(p, 0), null);
  assert.equal(play.parked, true);
  play.onScroll(0.9, 0); // then the reader scrolls back up into it
  assert.equal(play.parked, false);
});

test("years caption names each fund's own end date when the annual reports differ", () => {
  const iso = (x: string) => x;
  assert.match(yearsThrough(story, iso), new RegExp(`^data through ${reports.spy.window.end}$`));
  const older = { ...reports.qqq, window: { ...reports.qqq.window, end: "2026-09-01" } };
  const mixed = buildStory({ spy: reports.spy, qqq: older, iwm: reports.iwm }, board, ep);
  assert.equal(yearsThrough(mixed, iso), `data through ${reports.spy.window.end} (SPY), 2026-09-01 (QQQ), ${reports.iwm.window.end} (IWM)`);
});

test("cheap draws do not raise quality while frames stay well above the display target (GPU-bound)", () => {
  const g = new FrameGovernor();
  for (let k = 0; k < 60; k++) g.report(16.7, 2);
  // uneven slow frames (never a steady new display rate) with little JS work
  for (let k = 0; k < 3000; k++) g.report(30 + (k % 5) * 4, 2);
  assert.equal(g.scale, 0.6);
});

test("quality is raised only once frames are back near the display budget, not merely faster than the slowdown", () => {
  const g = new FrameGovernor();
  for (let k = 0; k < 60; k++) g.report(16.7, 3);
  for (let k = 0; k < 20; k++) g.report(60, 20); // a stall drops quality
  const low = g.scale;
  assert.ok(low < 1);
  for (let k = 0; k < 2000; k++) g.report(26.3, 12); // ~38 fps: better, still well off 60
  assert.equal(g.scale, low);
  for (let k = 0; k < 600; k++) g.report(16.7, 3);
  assert.equal(g.scale, 1);
});

test("a raise that makes GPU-bound frames slower is undone and not retried while frames stay slow", () => {
  const g = new FrameGovernor();
  for (let k = 0; k < 60; k++) g.report(16.7, 3);
  // GPU-bound: frame time follows resolution; JS work stays small
  const iv = () => (g.scale <= 0.6 ? 38 : g.scale <= 0.8 ? 55 : 70);
  let raisedTo = 0;
  for (let k = 0; k < 4000; k++) { g.report(iv(), 3); raisedTo = Math.max(raisedTo, g.scale); }
  assert.equal(g.scale, 0.6);
});
