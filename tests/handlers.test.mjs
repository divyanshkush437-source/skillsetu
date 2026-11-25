// Integrate the real Lambda business handlers with in-memory cloud boundaries.
// Authentication itself and DynamoDB expression execution require provider tests.
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(new URL("../backend/config.json", import.meta.url)),
);
async function loadHandlers() {
  const sources = {
    common: `const s=globalThis.__skillsetuTests;export const workers='workers',state='state',jobs='jobs',now=()=>2000000,hash=s=>s,key=id=>({PK:'worker#'+id,SK:'profile'}), endpoint=f=>f, increment=async()=>s.rate,secret=async()=>'',get=async(table,key)=>s.items.get(key.PK),proveContact=async()=>{throw Error('Proof required')},db={send:async c=>{s.calls.push(c.input);return {}}};export class PutCommand{constructor(input){this.input=input}};export const UpdateCommand=PutCommand;`,
    directory: `export const candidateIds=async()=>['a','b','c'],currentWorkers=async ids=>ids.map(id=>globalThis.__skillsetuTests.items.get('worker#'+id)).filter(Boolean);`,
    enquiries: `export const totals=async()=>({}),beginEnquiry=async()=>'receipt';`,
    commands: `export class TransactWriteCommand{constructor(input){this.input=input}}`,
  };
  const out = await build({
    stdin: {
      contents: [
        "searchWorkers",
        "getWorker",
        "moderate",
        "contact",
        "registerWorker",
      ]
        .map(
          (name) =>
            "export {handler as " +
            name +
            '} from "./backend/' +
            name +
            '.mjs";',
        )
        .join("\n"),
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "cloud-fixtures",
        setup(b) {
          b.onResolve(
            { filter: /^\.\/(common|directory|enquiries)\.mjs$/ },
            (args) => ({ path: args.path.slice(2, -4), namespace: "fixture" }),
          );
          b.onResolve({ filter: /^@aws-sdk\/lib-dynamodb$/ }, () => ({
            path: "commands",
            namespace: "fixture",
          }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: sources[args.path],
          }));
          b.onLoad({ filter: /validation\.mjs$/ }, (args) => ({
            contents: readFileSync(args.path, "utf8").replace(
              /export const config = JSON\.parse\([\s\S]*?\n\);/,
              "export const config=" + JSON.stringify(config) + ";",
            ),
          }));
        },
      },
    ],
  });
  return import(
    "data:text/javascript;base64," +
      Buffer.from(out.outputFiles[0].text).toString("base64")
  );
}
globalThis.__skillsetuTests = {};
const api = await loadHandlers();
const worker = {
  id: "a",
  name: "Example",
  skill: "Plumber",
  locality: "Powai",
  serviceAreas: ["Powai", "Juhu"],
  whatsapp: "+919000000000",
  phone: "+919000000000",
  experience: "5+ years",
  priceRange: "Project-based",
  availability: true,
  verified: true,
};
function reset() {
  const s = {
    rate: 1,
    items: new Map([
      ["worker#a", worker],
      ["worker#b", { ...worker, id: "b", moderation: "hidden" }],
      ["worker#c", { ...worker, id: "c", listed: false }],
    ]),
    calls: [],
  };
  return Object.assign(globalThis.__skillsetuTests, s);
}
const event = {
  pathParameters: { id: "a" },
  requestContext: { http: { method: "PATCH" } },
};
test("Cached IDs are rechecked against current moderation and owner visibility on search and counts", async () => {
  const s = reset();
  s.items.set("candidates-v2#Plumber", {
    expiresAt: 3000000,
    ids: ["a", "b", "c"],
  });
  const search = (query) =>
    api.searchWorkers({
      event: { queryStringParameters: { skill: "Plumber", ...query } },
    });
  assert.deepEqual(
    (await search({ locality: "Juhu" })).map((x) => x.id),
    ["a"],
  );
  assert.deepEqual(await search({ view: "localities", exclude: "Powai" }), [
    { locality: "Juhu", count: 1 },
  ]);
  s.items.set("worker#a", { ...worker, listed: false });
  assert.deepEqual(await search({ locality: "Juhu" }), []);
  await assert.rejects(api.getWorker({ event }), /not found/);
  await assert.rejects(api.contact({ event, ip: "local" }), /unavailable/);
});
test("Review decisions require the admin claim and use conditional writes", async () => {
  const s = reset();
  await assert.rejects(
    api.moderate({
      user: { uid: "x" },
      event,
      body: { decision: "hidden", admin: true },
    }),
    /Reviewer access/,
  );
  assert.equal(s.calls.length, 0);
  await api.moderate({
    user: { uid: "reviewer", admin: true },
    event,
    body: { decision: "hidden", reports: 2, version: 1 },
  });
  assert.equal(s.calls[0].ExpressionAttributeValues[":m"], "hidden");
  assert.ok(s.calls[0].ConditionExpression.includes("reviewVersion"));
});
test("Contact disclosure enforces per-IP quota and verification of an alternate number", async () => {
  const s = reset();
  s.rate = 21;
  await assert.rejects(api.contact({ event, ip: "local" }), /limit/);
  s.rate = 1;
  s.items.set("worker#a", { ...worker, phone: "+919000000001" });
  await assert.rejects(api.contact({ event, ip: "local" }), /verify/);
  s.items.set("worker#a", worker);
  assert.deepEqual(await api.contact({ event, ip: "local" }), {
    url: "https://wa.me/919000000000",
    receipt: "receipt",
  });
});
test("Registration atomically claims a contact and ignores client moderator fields", async () => {
  const s = reset();
  const result = await api.registerWorker({
    body: { ...worker, moderation: "active", listed: false },
    user: { uid: "owner", phone_number: worker.phone },
  });
  assert.equal(result.id, "owner");
  const writes = s.calls[0].TransactItems;
  assert.ok(writes[0].Put.ConditionExpression.includes("ownerId"));
  assert.equal(writes[1].Update.Key.PK, "worker#owner");
  assert.ok(
    !Object.values(writes[1].Update.ExpressionAttributeNames).includes(
      "moderation",
    ),
  );
  await assert.rejects(
    api.registerWorker({
      body: { ...worker, whatsapp: "+919000000001" },
      user: { uid: "owner", phone_number: worker.phone },
    }),
    /Verify/,
  );
});
