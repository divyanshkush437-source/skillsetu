import {
  endpoint,
  query,
  byTrade,
  db,
  get,
  state,
  workers,
  hash,
  now,
  PutCommand,
  increment,
  secret,
} from "./common.mjs";
import {
  publicWorker,
  publicFields as fields,
  allowed,
  config,
  reject,
  nearbyAreas,
} from "./validation.mjs";
// A locality search also returns workers from neighbouring localities;
// the app shows them under "Also nearby".
function inArea(skill, area) {
  return skill
    ? byTrade(workers, skill, area, projection)
    : query({
        TableName: workers,
        IndexName: "locality-index",
        KeyConditionExpression: "areaKey = :a",
        ExpressionAttributeValues: { ":a": "locality#" + area },
        ...projection,
      });
}
const projection = {
  ProjectionExpression: fields.map((_, i) => "#f" + i).join(","),
  ExpressionAttributeNames: Object.fromEntries(
    fields.map((k, i) => ["#f" + i, k]),
  ),
};
export const handler = endpoint(async ({ event, ip }) => {
  const { skill = "", locality = "" } = event.queryStringParameters || {};
  if (skill) allowed(skill, config.skills);
  if (locality) allowed(locality, config.areas);
  if (
    process.env.TURNSTILE_PARAMETER &&
    (await increment("search#" + hash(ip), 300)) > 10
  ) {
    const token = event.headers?.["x-captcha-token"];
    if (!token) reject("Complete the search verification.", 429);
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret: await secret(process.env.TURNSTILE_PARAMETER),
          response: token,
          remoteip: ip,
        }),
      },
    );
    if (!(await r.json()).success)
      reject("Complete the search verification.", 429);
  }
  const PK = "search#" + hash(JSON.stringify([skill, locality]));
  const cached = await get(state, { PK });
  if (cached?.expiresAt > now()) return cached.rows;
  const rows = locality
    ? (
        await Promise.all(
          [locality, ...nearbyAreas(locality)].map((a) => inArea(skill, a)),
        )
      ).flat()
    : skill
      ? await byTrade(workers, skill, "", projection)
      : (
          await Promise.all(
            config.skills.map((s) => byTrade(workers, s, "", projection)),
          )
        ).flat();
  const shaped = rows
    .map(publicWorker)
    .sort(
      (a, b) =>
        Number(b.availability) - Number(a.availability) ||
        a.name.localeCompare(b.name),
    );
  if (Buffer.byteLength(JSON.stringify(shaped)) < 300000)
    await db.send(
      new PutCommand({
        TableName: state,
        Item: { PK, rows: shaped, expiresAt: now() + 60 },
      }),
    );
  return shaped;
});
