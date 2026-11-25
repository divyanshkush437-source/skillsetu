import test from "node:test";
import assert from "node:assert/strict";
import { localityCounts } from "../backend/coverage.mjs";
test("Coverage counts only matching profiles and excludes the original locality", () => {
  const rows = [
    ["Powai", "Plumber", true],
    ["Juhu", "Plumber", true],
    ["Juhu", "Plumber", false],
    ["Bandra East", "Electrician", true],
  ].map(([locality, skill, availability]) => ({
    locality,
    skill,
    availability,
  }));
  assert.deepEqual(
    localityCounts(rows, {
      skill: "Plumber",
      exclude: "Powai",
      available: true,
    }),
    [{ locality: "Juhu", count: 1 }],
  );
  assert.deepEqual(
    localityCounts(rows, { skill: "Plumber", exclude: "Powai" }),
    [{ locality: "Juhu", count: 2 }],
  );
  assert.deepEqual(
    localityCounts(rows, { skill: "Painter", exclude: "Powai" }),
    [],
  );
});
