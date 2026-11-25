import test from "node:test";
import assert from "node:assert/strict";
import { prepareJob, sameJob } from "../backend/job.mjs";
import { readFileSync } from "node:fs";
import { train, predict } from "../backend/skill-model.mjs";
const model = JSON.parse(
  readFileSync(new URL("../backend/trained-skills.json", import.meta.url)),
);
const examples = JSON.parse(
  readFileSync(new URL("../training/examples.json", import.meta.url)),
);
const request = {
  skill: "auto",
  description: "My kitchen tap is leaking",
  locality: "Andheri West",
  posterPhone: "9000000000",
  requestId: "7e2ade09-55e0-4424-8302-8dcf7cbced46",
};
test("The shipped model is reproducible from the labelled examples", () =>
  assert.deepEqual(train(examples), model));
test("Auto-classification produces the skill and locality keys used by the dashboard and alerts", () => {
  const now = new Date("2026-11-25T06:00:00Z"),
    j = prepareJob(request, "household-a", now);
  assert.equal(j.skill, "Plumber");
  assert.equal(j.tradeKey, "skill#Plumber");
  assert.equal(j.areaKey, "locality#Andheri West");
  assert.equal(j.expiresAt, now.getTime() / 1000 + 604800);
});
test("Manual trade wins, even when the description suggests a different one", () => {
  assert.equal(prepareJob({ ...request, skill: "Other" }, "a").skill, "Other");
});
test("Vague, unknown or equally supported skills need an explicit selection", () => {
  assert.throws(
    () =>
      prepareJob({ ...request, description: "Need somebody urgently" }, "a"),
    /choose the trade/,
  );
  assert.equal(
    predict(
      train({ Cook: ["cook dinner"], Painter: ["paint walls"] }),
      "cook dinner paint walls",
    ),
    null,
  );
});
test("Phone, locality, skill and request ID are validated before saving", () => {
  for (const overrides of [
    { posterPhone: "abc" },
    { locality: "Unknown" },
    { skill: "MadeUp" },
    { requestId: "-".repeat(36) },
  ])
    assert.throws(() => prepareJob({ ...request, ...overrides }, "a"));
});
test("Retries preserve a household’s job ID and detect changed payloads", () => {
  const j = prepareJob(request, "a");
  assert.equal(j.id, prepareJob(request, "a").id);
  assert.notEqual(j.id, prepareJob(request, "b").id);
  assert.ok(sameJob(j, j));
  assert.ok(
    sameJob(
      Object.fromEntries(Object.entries(j).map(([k, v]) => [k, { S: v }])),
      j,
    ),
  );
  assert.equal(sameJob(j, { ...j, locality: "Powai" }), false);
});
