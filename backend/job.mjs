import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { config, allowed, clean, phone, reject } from "./validation.mjs";
import { predict } from "./skill-model.mjs";

const model = JSON.parse(
  readFileSync(new URL("./trained-skills.json", import.meta.url)),
);
export function prepareJob(body, uid, time = new Date()) {
  const description = clean(body.description, 500, 5);
  const locality = allowed(body.locality, config.areas);
  const posterPhone = phone(body.posterPhone);
  const skill =
    body.skill === "auto"
      ? predict(model, description)
      : allowed(body.skill, config.skills);
  if (!skill) reject("Please choose the trade for this job.");
  if (
    typeof body.requestId !== "string" ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.requestId)
  )
    reject("Invalid request ID.");
  const id = createHash("sha256")
    .update(uid + ":" + body.requestId)
    .digest("hex")
    .slice(0, 32);
  return {
    PK: "job#" + id,
    SK: "post",
    id,
    skill,
    locality,
    description,
    posterPhone,
    tradeKey: "skill#" + skill,
    areaKey: "locality#" + locality,
    createdAt: time.toISOString(),
    expiresAt: Math.floor(time.getTime() / 1000) + 604800,
    status: "open",
  };
}
export function sameJob(stored, item) {
  return ["description", "skill", "locality", "posterPhone"].every((field) => {
    // Conditional failure images may still have DynamoDB AttributeValue wrappers.
    const value = stored?.[field];
    return (typeof value === "string" ? value : value?.S) === item[field];
  });
}
