import { candidateIds, currentWorkers } from "./directory.mjs";
import { visible, areasOf } from "./listing.mjs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { get, db, state, PutCommand, now } from "./common.mjs";
const sns = new SNSClient({}),
  ses = new SESClient({});
export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    const job = record.dynamodb.NewImage;
    if (job.SK?.S !== "post") continue;
    const matched = (
      await currentWorkers(await candidateIds(job.skill.S))
    ).filter(
      (w) =>
        visible(w) &&
        w.skill === job.skill.S &&
        areasOf(w).includes(job.locality.S),
    );
    for (const w of matched) {
      if (!w.alerts) continue;
      const PK = "sent#" + job.id.S + "#" + w.id;
      if (await get(state, { PK })) continue;
      await sns.send(
        new PublishCommand({
          PhoneNumber: w.phone,
          Message:
            "New job near you! " +
            job.locality.S +
            " needs a " +
            job.skill.S +
            ". " +
            process.env.ORIGIN +
            "/dashboard",
          MessageAttributes: {
            "AWS.SNS.SMS.SMSType": {
              DataType: "String",
              StringValue: "Transactional",
            },
          },
        }),
      );
      await db.send(
        new PutCommand({
          TableName: state,
          Item: { PK, expiresAt: now() + 604800 },
        }),
      );
    }
    const PK = "digest#" + job.id.S;
    if (!(await get(state, { PK }))) {
      await ses.send(
        new SendEmailCommand({
          Source: process.env.SENDER,
          Destination: { ToAddresses: [process.env.REVIEWER] },
          Message: {
            Subject: { Data: "New SkillSetu job · " + job.locality.S },
            Body: {
              Text: {
                Data:
                  job.skill.S +
                  " requested in " +
                  job.locality.S +
                  ". Matching profiles: " +
                  matched.length +
                  ". Job " +
                  job.id.S,
              },
            },
          },
        }),
      );
      await db.send(
        new PutCommand({
          TableName: state,
          Item: { PK, expiresAt: now() + 604800 },
        }),
      );
    }
  }
};
