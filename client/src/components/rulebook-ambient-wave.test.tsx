import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name: string) => readFile(new URL(name, import.meta.url), "utf8");

test("Rulebook lazy-loads the ambient wave only near its corner cell", async () => {
  const source = await read("./rulebook.tsx");

  assert.match(source, /lazy\(\(\)\s*=>\s*import\("@\/components\/ambient-wave"\)\)/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /rootMargin:\s*"[^"]+"/);
  assert.equal(source.match(/<LazyAmbientWave\b/g)?.length, 1);
  assert.doesNotMatch(source, /import\s+\{\s*KfLogo\s*\}/);
});

test("ambient wave is decorative and independent of strategy data", async () => {
  const source = await read("./ambient-wave.tsx");

  assert.match(source, /createPersistenceEngine/);
  assert.doesNotMatch(source, /prefers-reduced-motion/);
  assert.match(source, /aria-hidden="true"/);
  assert.doesNotMatch(source, /useFearState|FundFear|fearlab-board|lab-data/);
});

test("ambient wave keeps running while visible instead of following the one-shot Rulebook phase", async () => {
  const [rulebook, wave] = await Promise.all([
    read("./rulebook.tsx"),
    read("./ambient-wave.tsx"),
  ]);

  assert.match(rulebook, /<AmbientWave\s*\/>/);
  assert.doesNotMatch(rulebook, /<AmbientWave\s+active=/);
  assert.match(wave, /new IntersectionObserver/);
  assert.match(wave, /entry\.isIntersecting[\s\S]*?engine\.start\(\)[\s\S]*?engine\.stop\(\)/);
  assert.doesNotMatch(wave, /function AmbientWave\(\{\s*active\s*\}/);
});

test("ambient wave powers down and reignites through beam state, not canvas opacity", async () => {
  const source = await read("./ambient-wave.tsx");

  assert.match(source, /sampleAmbientWaveCycle\(visibleClock\)/);
  assert.match(source, /onFrame:\s*\(api,\s*_t,\s*dt\)/);
  assert.match(source, /visibleClock\s*\+=\s*dt/);
  assert.match(source, /api\.setTau\(state\.tau\)/);
  assert.match(source, /state\.traceReveal/);
  assert.doesNotMatch(source, /style=\{\{[^}]*opacity/);
  assert.doesNotMatch(source, /state\.phase[\s\S]{0,160}engine\.(?:stop|clear)\(\)/);
});
