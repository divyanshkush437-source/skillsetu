import fs from "node:fs";
import { train, predict } from "../backend/skill-model.mjs";
import { config } from "../backend/validation.mjs";
const load = (name) =>
  JSON.parse(fs.readFileSync(new URL(name, import.meta.url), "utf8"));
const examples = load("../training/examples.json"),
  evaluation = load("../training/evaluation.json");
for (const s of Object.keys(examples))
  if (!config.skills.includes(s)) throw Error("Unknown training label: " + s);
const model = train(examples);
fs.writeFileSync(
  new URL("../backend/trained-skills.json", import.meta.url),
  JSON.stringify(model) + "\n",
);
let correct = 0,
  count = 0;
const seen = new Set(
  Object.values(examples)
    .flat()
    .map((x) => x.toLowerCase().trim()),
);
for (const [expected, items] of Object.entries(evaluation)) {
  for (const text of items) {
    if (seen.has(text.toLowerCase().trim()))
      throw Error("Duplicated evaluation example: " + text);
    const actual = predict(model, text) ?? "abstain";
    if (expected === actual) correct++;
    else console.log(JSON.stringify({ text, expected, actual }));
    count++;
  }
}
console.log(
  model.rows.length +
    " training examples; " +
    correct +
    "/" +
    count +
    " expected outcomes on synthetic evaluation.",
);
