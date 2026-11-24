import test from "node:test";
import assert from "node:assert/strict";
import {
  config,
  profile,
  publicWorker,
  phone,
  clean,
} from "../backend/validation.mjs";
const form = {
  name: "  <b>Ramesh</b> Kumar ",
  skill: "Plumber",
  locality: "Andheri West",
  experience: config.experience[2],
  priceRange: config.prices[1],
  availability: true,
  whatsapp: "9876543210",
};
test("Normalizes Indian and international numbers and strips markup", () => {
  assert.equal(profile(form).name, "Ramesh Kumar");
  assert.equal(profile(form).whatsapp, "+919876543210");
  assert.equal(phone("+447700900123"), "+447700900123");
  for (const v of ["123", "invalid", "+0123456789"])
    assert.throws(() => phone(v));
});
test("Rejects unlisted service area, trade, experience, fee and non-boolean availability", () => {
  for (const key of [
    "locality",
    "skill",
    "experience",
    "priceRange",
    "availability",
  ])
    assert.throws(() => profile({ ...form, [key]: "invented" }));
  assert.throws(() => profile({ ...form, name: "x".repeat(51) }));
  assert.throws(() => clean("x".repeat(501), 500));
});
test("Public projection omits account contact fields and database keys", () => {
  const w = publicWorker({
    ...form,
    id: "user",
    phone: "+919876543210",
    PK: "private",
    whatsappLink: "https://wa.me/919876543210",
  });
  assert.equal(w.whatsappLink, "https://wa.me/919876543210");
  for (const k of ["phone", "whatsapp", "PK", "SK", "alerts"])
    assert.equal(k in w, false);
});
import { waMessage, nearbyAreas } from "../backend/validation.mjs";
test("Pre-filled WhatsApp message names the skill and locality", () => {
  assert.equal(
    waMessage("Plumber", "Andheri West"),
    "Hi, I found you on SkillSetu. I need a plumber in Andheri West. Are you available today?",
  );
});
test("Every locality has listed neighbours and public data includes join date", () => {
  for (const a of config.areas) {
    assert.ok(nearbyAreas(a).length > 0, a);
    for (const b of nearbyAreas(a)) assert.ok(config.areas.includes(b), b);
  }
  assert.equal(publicWorker({ ...form, createdAt: "2026-11-01" }).createdAt, "2026-11-01");
});
