import { endpoint, db, workers, key, UpdateCommand } from "./common.mjs";
import { profile, waMessage } from "./validation.mjs";
export const handler = endpoint(async ({ body, user }) => {
  const f = profile(body),
    time = new Date().toISOString();
  const w = {
    ...f,
    id: user.uid,
    phone: user.phone_number,
    tradeKey: "skill#" + f.skill,
    areaKey: "locality#" + f.locality,
    lastSeen: time,
    verified: true,
    whatsappLink:
      "https://wa.me/" +
      f.whatsapp.slice(1) +
      "?text=" +
      encodeURIComponent(waMessage(f.skill, f.locality)),
  };
  const names = {},
    values = { ":t": time };
  const sets = Object.entries(w).map(([k, v], i) => {
    names["#f" + i] = k;
    values[":v" + i] = v;
    return "#f" + i + " = :v" + i;
  });
  sets.push("createdAt = if_not_exists(createdAt, :t)");
  await db.send(
    new UpdateCommand({
      TableName: workers,
      Key: key(user.uid),
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
  return { id: user.uid };
}, true);
