import { candidateIds, currentWorkers } from "./directory.mjs";
import { visible, areasOf } from "./listing.mjs";
import { localityCounts } from "./coverage.mjs";
import {
  endpoint,
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
import { publicWorker, allowed, config, reject } from "./validation.mjs";
export const handler = endpoint(async ({ event, ip }) => {
  const {
    skill = "",
    locality = "",
    view,
    exclude = "",
    available,
  } = event.queryStringParameters || {};
  const coverage = view === "localities";
  if (coverage && exclude) allowed(exclude, config.areas);
  const present = (rows) =>
    coverage
      ? localityCounts(rows, { skill, exclude, available: available === "1" })
      : rows;
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
  const PK = "candidates-v2#" + skill;
  const cached = await get(state, { PK });
  let ids = cached?.expiresAt > now() ? cached.ids : null;
  if (!ids) {
    ids = await candidateIds(skill);
    if (Buffer.byteLength(JSON.stringify(ids)) < 300000)
      await db.send(
        new PutCommand({
          TableName: state,
          Item: { PK, ids, expiresAt: now() + 60 },
        }),
      );
  }
  const rows = (await currentWorkers(ids))
    .filter(
      (w) =>
        visible(w) &&
        (!skill || w.skill === skill) &&
        (!locality || areasOf(w).includes(locality)),
    )
    .map(publicWorker)
    .sort(
      (a, b) =>
        Number(b.availability) - Number(a.availability) ||
        a.name.localeCompare(b.name),
    );
  return present(rows);
});
