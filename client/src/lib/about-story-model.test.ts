import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Board, LabReport } from "@/data/lab-data";
import {
  AUTOPLAY_AT, BEATS, EPISODE_EVENTS, FREE_RATE, SCROLL_LEAD, StoryPlayback, buildStory, episodeClock, paceLimit,
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
  }
});

test("the 2020 captions' factual claims hold in the episode data", () => {
  // "lands on the lowest close of the year"
  assert.equal(ep.days[story.episode.lowIndex].d, "2020-03-23");
  // "Three sessions later, redeploy buys back"
  assert.equal(dayIndex.get("2020-03-12")! - dayIndex.get("2020-03-09")!, 3);
  // "trims ... while prices are still near the high": within 3% of the high so far
  const i = dayIndex.get("2020-02-03")!;
  const high = Math.max(...ep.days.slice(0, i + 1).map((d) => d.c));
  assert.ok(ep.days[i].c >= high * 0.97);
  // "Fear reads N" comes from the file, not the copy
  assert.match(story.episode.events[1].text, new RegExp(`Fear reads ${ep.days[dayIndex.get("2020-03-09")!].fear}\\.`));
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
  assert.equal(readSecs(""), 2.5);
  assert.equal(readSecs("word ".repeat(80)), 7);
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
