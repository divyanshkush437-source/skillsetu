import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { reject } from "./validation.mjs";
export { GetCommand, QueryCommand, UpdateCommand, PutCommand };
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({})),
  workers = process.env.WORKERS,
  jobs = process.env.JOBS,
  state = process.env.STATE;
const auth = getAuth(
    initializeApp({ projectId: process.env.FIREBASE_PROJECT }),
  ),
  ssm = new SSMClient({});
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export function key(id) {
  return { PK: "worker#" + id, SK: "profile" };
}
export const now = () => Math.floor(Date.now() / 1000);
export async function get(table, Key) {
  return (
    await db.send(
      new GetCommand({ TableName: table, Key, ConsistentRead: true }),
    )
  ).Item;
}
export async function query(params) {
  const rows = [];
  let cursor;
  do {
    const r = await db.send(
      new QueryCommand({ ...params, ExclusiveStartKey: cursor }),
    );
    rows.push(...r.Items);
    cursor = r.LastEvaluatedKey;
  } while (cursor);
  return rows;
}
export function byTrade(table, skill, locality, projection) {
  return query({
    TableName: table,
    IndexName: "skill-locality-index",
    KeyConditionExpression:
      "tradeKey = :s" + (locality ? " AND areaKey = :a" : ""),
    ExpressionAttributeValues: {
      ":s": "skill#" + skill,
      ...(locality ? { ":a": "locality#" + locality } : {}),
    },
    ...projection,
  });
}
export async function increment(id, seconds) {
  const PK = "rate#" + id;
  const t = now();
  try {
    return (
      await db.send(
        new UpdateCommand({
          TableName: state,
          Key: { PK },
          UpdateExpression: "SET hits = :one, expiresAt = :end",
          ConditionExpression: "attribute_not_exists(PK) OR expiresAt <= :t",
          ExpressionAttributeValues: {
            ":one": 1,
            ":end": t + seconds,
            ":t": t,
          },
          ReturnValues: "ALL_NEW",
        }),
      )
    ).Attributes.hits;
  } catch (e) {
    if (e.name !== "ConditionalCheckFailedException") throw e;
  }
  return (
    await db.send(
      new UpdateCommand({
        TableName: state,
        Key: { PK },
        UpdateExpression: "ADD hits :one",
        ExpressionAttributeValues: { ":one": 1 },
        ReturnValues: "ALL_NEW",
      }),
    )
  ).Attributes.hits;
}
export async function secret(path) {
  return (
    await ssm.send(
      new GetParameterCommand({ Name: path, WithDecryption: true }),
    )
  ).Parameter.Value;
}
export function endpoint(handler, protectedRoute = false) {
  return async (event) => {
    let status = 200,
      data = null,
      error = null;
    try {
      const ip = event.requestContext?.http?.sourceIp || "unknown";
      if ((await increment("ip#" + hash(ip), 1)) > 100)
        reject("Too many requests. Try again shortly.", 429);
      let user = null;
      if (protectedRoute) {
        try {
          const bearer = (event.headers?.authorization || "").match(
            /^Bearer (.+)$/,
          );
          if (!bearer) throw Error();
          user = await auth.verifyIdToken(bearer[1]);
          if (!user.phone_number || user.firebase?.sign_in_provider !== "phone")
            throw Error();
        } catch {
          reject("Sign in with your phone to continue.", 401);
        }
      }
      let body = {};
      try {
        body = JSON.parse(event.body || "{}");
        if (!body || Array.isArray(body) || typeof body !== "object")
          throw Error();
      } catch {
        reject("Invalid JSON body.");
      }
      data = await handler({ event, body, user, ip });
      console.info(
        JSON.stringify({
          route: event.routeKey,
          status,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (e) {
      status = e.status || 500;
      error = e.status
        ? e.message
        : "Unable to complete the request. Please try again.";
      console.error(
        JSON.stringify({ route: event.routeKey, status, kind: e.name }),
      );
    }
    return {
      statusCode: status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ success: !error, data, error }),
    };
  };
}
