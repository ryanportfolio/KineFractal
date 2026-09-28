import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Board, LabReport } from "@/data/lab-data";
import { BEATS, EPISODE_EVENTS, buildStory, episodeClock, windowAlpha, type Episode } from "./about-story-model";

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
