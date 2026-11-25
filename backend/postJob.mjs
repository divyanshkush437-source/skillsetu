import { endpoint, db, jobs, PutCommand } from "./common.mjs";
import { prepareJob, sameJob } from "./job.mjs";
import { reject } from "./validation.mjs";
export const handler = endpoint(async ({ body, user }) => {
  const item = prepareJob(body, user.uid);
  try {
    await db.send(
      new PutCommand({
        TableName: jobs,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
        ReturnValuesOnConditionCheckFailure: "ALL_OLD",
      }),
    );
  } catch (error) {
    if (error.name !== "ConditionalCheckFailedException") throw error;
    if (!sameJob(error.Item, item))
      reject("This request already posted a different job. Start a new post.");
  }
  return { id: item.id, skill: item.skill };
}, true);
