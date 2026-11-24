import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { endpoint, get, workers, key, increment, hash } from "./common.mjs";
import { reject } from "./validation.mjs";
const ses = new SESClient({});
export const handler = endpoint(async ({ event, ip }) => {
  const id = event.pathParameters.id;
  if ((await increment("report#" + hash(ip), 3600)) > 3)
    reject("Report limit reached. Try again later.", 429);
  if (!(await get(workers, key(id)))) reject("Profile not found.");
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
  return { received: true };
});
