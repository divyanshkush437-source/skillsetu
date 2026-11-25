import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  endpoint,
  get,
  workers,
  key,
  increment,
  hash,
  db,
  UpdateCommand,
} from "./common.mjs";
import { reasons, visible } from "./listing.mjs";
import { allowed, reject } from "./validation.mjs";
const ses = new SESClient({});
export const handler = endpoint(async ({ event, ip, body }) => {
  const id = event.pathParameters.id;
  if ((await increment("report#" + hash(ip), 3600)) > 3)
    reject("Report limit reached. Try again later.", 429);
  if (!visible(await get(workers, key(id)))) reject("Profile not found.");
  const reason = allowed(body.reason || "Other concern", reasons);
  await db.send(
    new UpdateCommand({
      TableName: workers,
      Key: key(id),
      ConditionExpression: "attribute_exists(PK)",
      UpdateExpression: "SET reportReason = :reason ADD reports :one",
      ExpressionAttributeValues: { ":reason": reason, ":one": 1 },
    }),
  );
  try {
    await ses.send(
      new SendEmailCommand({
        Source: process.env.SENDER,
        Destination: { ToAddresses: [process.env.REVIEWER] },
        Message: {
          Subject: { Data: "SkillSetu profile report" },
          Body: {
            Text: {
              Data:
                "Review this profile: " +
                process.env.ORIGIN +
                "/worker/" +
                encodeURIComponent(id),
            },
          },
        },
      }),
    );
  } catch (e) {
    console.warn(
      JSON.stringify({ event: "review_email_failed", type: e.name }),
    );
  }
  return { received: true };
});
