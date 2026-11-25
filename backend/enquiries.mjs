import { randomUUID } from "node:crypto";
import {
  db,
  jobs,
  PutCommand,
  UpdateCommand,
  query,
  now,
  endpoint,
} from "./common.mjs";
import { allowed, reject } from "./validation.mjs";
export const outcomes = [
  "Awaiting reply",
  "Received a quote",
  "Visit agreed",
  "Work completed",
  "No reply",
  "Cancelled or no-show",
];
const day = (t) => new Date(t).toISOString().slice(0, 10);
export async function beginEnquiry() {
  const date = day(Date.now()),
    id = randomUUID();
  await db.send(
    new PutCommand({
      TableName: jobs,
      Item: {
        PK: "pilot#" + date,
        SK: id,
        outcome: "Opened contact",
        expiresAt: now() + 604800,
      },
    }),
  );
  return date + "_" + id;
}
export const handler = endpoint(async ({ event, body }) => {
  const match = /^(\d{4}-\d\d-\d\d)_([a-f0-9-]{36})$/.exec(
    event.pathParameters.id,
  );
  if (!match) reject("Invalid enquiry.");
  const outcome = allowed(body.outcome, outcomes);
  try {
    await db.send(
      new UpdateCommand({
        TableName: jobs,
        Key: { PK: "pilot#" + match[1], SK: match[2] },
        ConditionExpression: "attribute_exists(PK) AND expiresAt > :t",
        UpdateExpression: "SET outcome = :o",
        ExpressionAttributeValues: { ":o": outcome, ":t": now() },
      }),
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException")
      reject("This enquiry has expired.");
    throw e;
  }
  return { outcome };
});
export async function totals() {
  const pages = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      query({
        TableName: jobs,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: {
          ":p": "pilot#" + day(Date.now() - 86400000 * i),
        },
        ProjectionExpression: "outcome, expiresAt",
      }),
    ),
  );
  const counts = { "Opened contact": 0 };
  for (const row of pages.flat())
    if (row.expiresAt > now())
      counts[row.outcome] = (counts[row.outcome] || 0) + 1;
  return counts;
}
