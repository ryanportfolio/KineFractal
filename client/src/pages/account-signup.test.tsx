import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./account.tsx", import.meta.url), "utf8");

test("signup asks for email and password without a name field", () => {
  assert.doesNotMatch(source, /placeholder="name \(optional\)"/);
  assert.doesNotMatch(source, /const \[name, setName\]/);
  assert.match(source, /signUp\.email\(\{ email, password, name: email\.split\("@"\)\[0\] \}\)/);
});
