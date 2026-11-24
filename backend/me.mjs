import { endpoint, db, workers, key, UpdateCommand } from "./common.mjs";
import { publicWorker } from "./validation.mjs";
export const handler = endpoint(async ({ user }) => {
  try {
    const { Attributes: w } = await db.send(
      new UpdateCommand({
        TableName: workers,
        Key: key(user.uid),
        UpdateExpression: "SET lastSeen = :t",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: { ":t": new Date().toISOString() },
        ReturnValues: "ALL_NEW",
      }),
    );
    return {
      ...publicWorker(w),
      whatsapp: w.whatsapp,
      alerts: w.alerts ?? false,
    };
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException") return null;
    throw e;
  }
}, true);
