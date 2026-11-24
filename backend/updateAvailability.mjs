import { endpoint, db, workers, key, UpdateCommand } from "./common.mjs";
import { bool, reject } from "./validation.mjs";
export const handler = endpoint(async ({ user, event, body }) => {
  if (user.uid !== event.pathParameters.id)
    reject("You can only update your own availability.", 401);
  const value = bool(body.availability);
  try {
    await db.send(
      new UpdateCommand({
        TableName: workers,
        Key: key(user.uid),
        UpdateExpression: "SET availability = :v, lastSeen = :t",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: {
          ":v": value,
          ":t": new Date().toISOString(),
        },
      }),
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException")
      reject("Create your profile first.");
    throw e;
  }
  return { availability: value };
}, true);
