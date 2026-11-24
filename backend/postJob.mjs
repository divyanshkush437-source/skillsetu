import { endpoint, db, jobs, PutCommand, now, hash } from "./common.mjs";
import { config, allowed, clean, phone, reject } from "./validation.mjs";
export const handler = endpoint(async ({ body, user }) => {
  const skill = allowed(body.skill, config.skills),
    locality = allowed(body.locality, config.areas),
    description = clean(body.description, 500, 5),
    posterPhone = phone(body.posterPhone);
  if (!/^[a-f\d-]{36}$/i.test(body.requestId)) reject("Invalid request ID.");
  const id = hash(user.uid + ":" + body.requestId).slice(0, 32);
  const item = {
    PK: "job#" + id,
    SK: "post",
    id,
    skill,
    locality,
    description,
    posterPhone,
    tradeKey: "skill#" + skill,
    areaKey: "locality#" + locality,
    createdAt: new Date().toISOString(),
    expiresAt: now() + 604800,
    status: "open",
  };
  try {
    await db.send(
      new PutCommand({
        TableName: jobs,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
      }),
    );
  } catch (e) {
    if (e.name !== "ConditionalCheckFailedException") throw e;
  }
  return { id };
}, true);
