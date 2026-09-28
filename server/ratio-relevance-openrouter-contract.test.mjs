import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./gemini-analyzer.ts", import.meta.url), "utf8");

function exportedFunctionSource(name) {
  const startMatch = new RegExp(`export\\s+async\\s+function\\*?\\s+${name}\\s*\\(`).exec(source);
  assert(startMatch, `missing exported ${name}`);

  const start = startMatch.index;
  const nextFunction = /\nexport\s+async\s+function\*?\s+\w+\s*\(/g;
  nextFunction.lastIndex = start + startMatch[0].length;
  const nextMatch = nextFunction.exec(source);
  return source.slice(start, nextMatch?.index ?? source.length);
}

function assertTerminalCatchOutput(functionSource, name) {
  assert.match(
    functionSource,
    /catch\s*\(\s*error\s*\)[\s\S]*?\[KINE\] ✗ Analysis engine encountered an error/,
    `${name} must preserve the terminal error headline`,
  );
  assert.match(
    functionSource,
    /catch\s*\(\s*error\s*\)[\s\S]*?\[KINE\] → Analysis unavailable/,
    `${name} must provide a generic terminal error detail`,
  );
  assert.doesNotMatch(
    functionSource,
    /error\.message/,
    `${name} must not interpolate provider error messages into browser terminal lines`,
  );
}

test("Ratio Relevance streaming and non-streaming analysis use OpenRouter without Gemini", () => {
  const streaming = exportedFunctionSource("streamAnalyzeRatioRelevance");
  const nonStreaming = exportedFunctionSource("analyzeRatioRelevance");

  for (const [name, functionSource] of [
    ["streamAnalyzeRatioRelevance", streaming],
    ["analyzeRatioRelevance", nonStreaming],
  ]) {
    assert.match(functionSource, /createOpenRouterRatioAdapter\s*\(/, `${name} must create the OpenRouter adapter`);
    assert.doesNotMatch(functionSource, /\bgetAI\s*\(/, `${name} must not use Gemini getAI()`);
    assert.doesNotMatch(functionSource, /gemini-2\.5-flash/, `${name} must not select the Gemini model`);
    assertTerminalCatchOutput(functionSource, name);
  }
});
