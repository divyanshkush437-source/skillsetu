import test from "node:test";
import assert from "node:assert/strict";
import {
  visible,
  available,
  areasOf,
  draftMessage,
} from "../backend/listing.mjs";
import { profile, publicWorker } from "../backend/validation.mjs";
import { localityCounts } from "../backend/coverage.mjs";
const w = {
  id: "w1",
  skill: "Plumber",
  locality: "Powai",
  name: "Example",
  experience: "5+ years",
  priceRange: "Project-based",
  whatsapp: "+919000000000",
  availability: true,
  confirmedAt: "2026-11-24T12:00:00Z",
};
test("Legacy listing, paused owner, hidden moderator and missing worker", () => {
  assert.ok(visible(w));
  for (const r of [
    undefined,
    { ...w, listed: false },
    { ...w, moderation: "hidden", listed: true },
  ])
    assert.equal(visible(r), false);
});
test("Availability expires exactly 24 hours after confirmation; reading the dashboard cannot renew it", () => {
  assert.equal(available(w, Date.parse(w.confirmedAt) + 86399999), true);
  assert.equal(available(w, Date.parse(w.confirmedAt) + 86400000), null);
  assert.equal(
    available({
      ...w,
      confirmedAt: undefined,
      lastSeen: new Date().toISOString(),
    }),
    null,
  );
  assert.equal(available({ ...w, availability: false }), false);
});
test("Legacy service coverage and duplicate area handling", () => {
  assert.deepEqual(areasOf(w), ["Powai"]);
  const row = profile({ ...w, serviceAreas: ["Powai", "Juhu", "Juhu"] });
  assert.deepEqual(areasOf(row), ["Powai", "Juhu"]);
  assert.deepEqual(
    localityCounts([row], { exclude: "Powai", skill: "Plumber" }),
    [{ locality: "Juhu", count: 1 }],
  );
  assert.throws(() =>
    profile({ ...w, serviceAreas: ["Juhu", "Colaba", "Worli"] }),
  );
  assert.throws(() => profile({ ...w, serviceAreas: ["Fake locality"] }));
});
test("Public profile includes fee and listing date while withholding contact and moderation data", () => {
  const view = publicWorker({
    ...w,
    phone: w.whatsapp,
    whatsappLink: "https://wa.me/919000000000",
    reviewedBy: "private",
    createdAt: "2026-11-24T12:00:00Z",
  });
  assert.equal(view.priceRange, w.priceRange);
  assert.ok(view.createdAt);
  assert.doesNotMatch(JSON.stringify(view), /9000000000|reviewedBy/);
});
test("Enquiry drafts include requested area, task, time and quote", () => {
  const msg = draftMessage("Plumber", "Powai", "tap repair", "tomorrow");
  for (const s of [
    "plumber",
    "Powai",
    "tap repair",
    "tomorrow",
    "visit charge",
  ])
    assert.ok(msg.includes(s));
});
