import { totals } from "./enquiries.mjs";
import { endpoint, db, workers, key, UpdateCommand } from "./common.mjs";
import { candidateIds, currentWorkers } from "./directory.mjs";
import { allowed, reject, publicWorker } from "./validation.mjs";
export const handler = endpoint(async ({ user, event, body }) => {
  if (user.admin !== true) reject("Reviewer access required.", 403);
  if (event.requestContext.http.method === "GET") {
    const rows = await currentWorkers(await candidateIds(""));
    const numbers = new Map();
    for (const row of rows)
      numbers.set(row.whatsapp, (numbers.get(row.whatsapp) || 0) + 1);
    return {
      counts: await totals(),
      rows: rows
        .map((w) => ({
          ...publicWorker(w),
          moderation: w.moderation || "active",
          sharedContact: numbers.get(w.whatsapp) > 1,
          version: w.reviewVersion || 0,
          reports: w.reports || 0,
          reason: w.reportReason || "",
        }))
        .sort((a, b) => b.reports - a.reports),
    };
  }
  const moderation = allowed(body.decision, ["active", "hidden"]);
  try {
    await db.send(
      new UpdateCommand({
        TableName: workers,
        Key: key(event.pathParameters.id),
        ConditionExpression:
          "attribute_exists(PK) AND (attribute_not_exists(reports) OR reports = :seen) AND (attribute_not_exists(reviewVersion) OR reviewVersion = :ver)",
        UpdateExpression:
          "SET moderation = :m, reports = :zero, reviewedAt = :t, reviewedBy = :u REMOVE reportReason ADD reviewVersion :one",
        ExpressionAttributeValues: {
          ":m": moderation,
          ":one": 1,
          ":ver": Number.isSafeInteger(body.version) ? body.version : 0,
          ":seen": Number.isSafeInteger(body.reports) ? body.reports : 0,
          ":zero": 0,
          ":t": new Date().toISOString(),
          ":u": user.uid,
        },
      }),
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException")
      reject("Listing changed. Refresh the queue.");
    throw e;
  }
  return { moderation };
}, true);
