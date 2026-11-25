import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { db, workers, byTrade, key } from "./common.mjs";
import { config } from "./validation.mjs";
export async function candidateIds(skill) {
  const groups = await Promise.all(
    (skill ? [skill] : config.skills).map((s) =>
      byTrade(workers, s, "", {
        ProjectionExpression: "#id",
        ExpressionAttributeNames: { "#id": "id" },
      }),
    ),
  );
  return [...new Set(groups.flat().map((w) => w.id))];
}
// Cache candidate IDs only. Read current records before exposing a listing.
export async function currentWorkers(ids) {
  const result = [];
  for (let i = 0; i < ids.length; i += 100) {
    let request = {
      [workers]: { Keys: ids.slice(i, i + 100).map(key), ConsistentRead: true },
    };
    for (let attempt = 0; request[workers]?.Keys?.length; attempt++) {
      if (attempt === 5) throw Error("Directory temporarily busy");
      const page = await db.send(
        new BatchGetCommand({ RequestItems: request }),
      );
      result.push(...(page.Responses?.[workers] || []));
      request = page.UnprocessedKeys || {};
      if (request[workers]?.Keys?.length)
        await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
  return result;
}
