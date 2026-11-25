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
  assert.equal("whatsappLink" in w, false);
  for (const k of ["phone", "whatsapp", "PK", "SK", "alerts"])
    assert.equal(k in w, false);
});
