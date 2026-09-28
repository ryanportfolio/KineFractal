import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./lab-report.tsx", import.meta.url), "utf8");

function between(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `${start} source must be present`);
  return source.slice(from, to);
}

test("long lab grids freeze column labels below the navbar until their dataset ends", () => {
  assert.match(source, /const STICKY_COLUMN_HEADER\s*=/);
  assert.match(source, /sticky top-\[52px\] z-20/);
  assert.match(source, /bg-background\/95/);
  assert.match(source, /border-b border-beam-ghost\/70/);

  const yearTable = between("function YearTable", "function MiniBar");
  const monthHeat = between("function MonthHeat", "function Attribution");
  const recent = source.slice(source.indexOf("function Recent"));

  assert.match(yearTable, /STICKY_COLUMN_HEADER/);
  assert.match(recent, /STICKY_COLUMN_HEADER/);
  assert.match(monthHeat, /<thead className=\{STICKY_COLUMN_HEADER\}>/);
  assert.match(monthHeat, /overflow-x-auto md:overflow-visible/);
});

test("attribution presents repeated metrics as table columns", () => {
  const attribution = between("function Attribution", "function Trims");

  assert.match(attribution, /<table/);
  assert.match(attribution, /<th[^>]*>buy flow<\/th>/);
  assert.match(attribution, /<th[^>]*>buys<\/th>/);
  assert.match(attribution, /<th[^>]*>P&amp;L<\/th>/);
  assert.doesNotMatch(attribution, /of buy flow/);
  assert.match(attribution, /<td className=\{`[^`]*whitespace-nowrap[^`]*`\}>\{fmtPp/);
});
