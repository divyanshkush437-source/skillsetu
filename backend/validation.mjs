import { available, areasOf } from "./listing.mjs";
import { readFileSync } from "node:fs";
export const config = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url)),
);
export function reject(message, status = 400) {
  throw Object.assign(Error(message), { status });
}
export function clean(value, max, min = 1) {
  if (typeof value !== "string") reject("Enter a valid text value.");
  const text = value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim();
  if (text.length < min || text.length > max)
    reject("Enter between " + min + " and " + max + " characters.");
  return text;
}
export function allowed(v, values) {
  if (!values.includes(v)) reject("Choose a listed option.");
  return v;
}
export function bool(v) {
  if (typeof v !== "boolean") reject("Choose an availability setting.");
  return v;
}
export function phone(v) {
  if (typeof v !== "string") reject("Enter a valid phone number.");
  if (/^[6-9]\d{9}$/.test(v)) return "+91" + v;
  if (/^91[6-9]\d{9}$/.test(v)) return "+" + v;
  if (/^\+[1-9]\d{7,14}$/.test(v)) return v;
  reject("Enter a valid mobile number with country code.");
}
export function profile(b) {
  const extra = b.serviceAreas ?? [];
  if (!Array.isArray(extra) || extra.length > 3)
    reject("Choose up to three service areas.");
  if (new Set([b.locality, ...extra]).size > 3)
    reject("Choose up to three service areas.");
  return {
    listed: bool(b.listed ?? true),
    serviceAreas: [
      ...new Set([b.locality, ...extra.map((a) => allowed(a, config.areas))]),
    ],
    name: clean(b.name, 50),
    skill: allowed(b.skill, config.skills),
    locality: allowed(b.locality, config.areas),
    experience: allowed(b.experience, config.experience),
    priceRange: allowed(b.priceRange, config.prices),
    availability: bool(b.availability),
    whatsapp: phone(b.whatsapp),
    alerts: bool(b.alerts ?? false),
  };
}
export function publicWorker(w) {
  return {
    ...Object.fromEntries(
      [
        "id",
        "name",
        "skill",
        "locality",
        "experience",
        "priceRange",
        "availability",
        "verified",
        "lastSeen",
        "createdAt",
        "confirmedAt",
      ].map((k) => [k, w[k]]),
    ),
    serviceAreas: areasOf(w),
    availability: available(w),
  };
}
