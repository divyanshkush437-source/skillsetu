import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  endpoint,
  db,
  workers,
  key,
  get,
  proveContact,
  hash,
} from "./common.mjs";
import { profile, reject } from "./validation.mjs";

const contactKey = (number) => ({ PK: "contact#" + hash(number), SK: "owner" });
export const handler = endpoint(async ({ body, user }) => {
  const f = profile(body),
    workerKey = key(user.uid),
    previous = await get(workers, workerKey);
  if (f.whatsapp !== user.phone_number) {
    if (body.contactProof) await proveContact(body.contactProof, f.whatsapp);
    else if (previous?.whatsapp !== f.whatsapp || !previous.contactVerified)
      reject("Verify this work number before publishing.");
  }
  const time = new Date().toISOString();
  const info = {
    ...f,
    contactVerified: true,
    id: user.uid,
    phone: user.phone_number,
    verified: true,
    tradeKey: "skill#" + f.skill,
    areaKey: "locality#" + f.locality,
    lastSeen: time,
    confirmedAt: time,
  };
  const values = { ":time": time },
    names = {},
    fields = [];
  for (const [name, value] of Object.entries(info)) {
    const index = fields.length;
    names["#f" + index] = name;
    values[":v" + index] = value;
    fields.push("#f" + index + " = :v" + index);
  }
  fields.push("createdAt = if_not_exists(createdAt,:time)");
  // Reserve the contact and move the profile together, including when the owner changes number.
  const writes = [
    {
      Put: {
        TableName: workers,
        Item: { ...contactKey(f.whatsapp), ownerId: user.uid },
        ConditionExpression: "attribute_not_exists(PK) OR ownerId = :uid",
        ExpressionAttributeValues: { ":uid": user.uid },
      },
    },
    {
      Update: {
        TableName: workers,
        Key: workerKey,
        ConditionExpression: previous
          ? "whatsapp = :prior"
          : "attribute_not_exists(PK)",
        UpdateExpression: "SET " + fields.join(", ") + " REMOVE whatsappLink",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: previous
          ? { ...values, ":prior": previous.whatsapp }
          : values,
      },
    },
  ];
  if (previous?.whatsapp && previous.whatsapp !== f.whatsapp) {
    const former = await get(workers, contactKey(previous.whatsapp));
    if (former?.ownerId === user.uid)
      writes.push({
        Delete: {
          TableName: workers,
          Key: contactKey(previous.whatsapp),
          ConditionExpression: "ownerId = :uid",
          ExpressionAttributeValues: { ":uid": user.uid },
        },
      });
  }
  try {
    await db.send(new TransactWriteCommand({ TransactItems: writes }));
  } catch (e) {
    if (
      e.name === "TransactionCanceledException" &&
      e.CancellationReasons?.some((r) => r.Code === "ConditionalCheckFailed")
    )
      reject(
        "This contact number is already listed or the profile changed. Check the number and refresh.",
      );
    throw e;
  }
  return { id: user.uid };
}, true);
